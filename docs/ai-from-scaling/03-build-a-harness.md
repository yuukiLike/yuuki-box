# 第三小时 搭建工具调用 Harness

这一小时完成一个具体任务：读取内置活动计划，核算预算，申请保存摘要，再给出回答。我们把模型放在一个自己编写的执行循环里，逐步看清请求、工具、权限和结果的关系。

参考实现：[harness.mjs](labs/harness.mjs)。使用 Node.js 22.22 或更高版本，在仓库根目录执行。内容用 50 分钟，留 10 分钟休息。

在[「接着做」MCP 开场](00-minimal-mcp.md)里，接续记录由独立服务进程保存和取回。本章换一个离线预算练习，把工具作为本地函数接入循环，看清模型请求、执行与结果回传；以后接入 MCP 工具时，由 MCP 客户端的 `callTool()` 发出调用，运行限制和审批继续由 Harness 管理。

## 前十分钟 沿着一次任务看循环

先跑离线模式：

```bash
node docs/ai-from-scaling/labs/harness.mjs
```

内置计划为 20 人、每人餐费 35 元、场地费 80 元、预算 800 元。终端按顺序打印模型请求、工具提议、工具结果和最终回答。总花费为 780 元，预算余额为 20 元；保存默认被拒绝。

离线的 `scriptedModel()` 按固定步骤提供工具请求与回答，模拟模型接口。它让我们先检查执行循环；真实模型怎样选择工具，留到第四小时观察。

把输出对回这条路径：

```text
用户任务
→ 请求模型
→ assistant 提出工具调用
→ Harness 验证并执行
→ 把 tool 结果追加到上下文
→ 再请求模型
→ 最终回答，或者因取消、错误、限额停止
```

从现在开始，把“模型想做什么”与“程序实际做了什么”分别记下来。

## 第十到二十分钟 写出工具契约与实现

工具定义告诉模型有哪些动作可以请求。先手写其中一个：

```js
{
  type: 'function',
  function: {
    name: 'calculate_total',
    description: '用人数、每人费用、场地费和预算计算总额与余额，金额单位为元。',
    parameters: {
      type: 'object',
      properties: {
        people: { type: 'integer' },
        perPerson: { type: 'number' },
        venue: { type: 'number' },
        budget: { type: 'number' },
      },
      required: ['people', 'perPerson', 'venue', 'budget'],
      additionalProperties: false,
    },
  },
}
```

随后在 `executeTool()` 里找到实际计算：

```js
const total = Math.round((people * perPerson + venue) * 100) / 100;
return {
  ok: true,
  total,
  remaining: Math.round((budget - total) * 100) / 100,
  withinBudget: total <= budget,
};
```

参考实现还会检查工具名、参数 JSON、字段是否多余，以及数字的类型和范围。这些检查由程序执行。工具定义中的 schema 描述输入契约，运行时仍然需要验证收到的值。

本课使用三个工具：

| 工具 | 实际行为 | 谁提供能力 |
| --- | --- | --- |
| `read_plan` | 返回源码内置的活动计划 | 我们编写的函数 |
| `calculate_total` | 计算花费、余额和是否超预算 | 我们编写的函数 |
| `save_note` | 请求向启动时指定的路径创建摘要 | 我们编写的函数与审批逻辑 |

模型提出调用，客户端执行函数并返回结果，这是 DeepSeek 工具接口规定的调用关系。[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)

## 第二十到三十分钟 接回工具结果

一次模型回复可能包含这样的调用片段：

```json
{
  "id": "calculate",
  "type": "function",
  "function": {
    "name": "calculate_total",
    "arguments": "{\"people\":20,\"perPerson\":35,\"venue\":80,\"budget\":800}"
  }
}
```

注意 `arguments` 在这个接口中是一段 JSON 字符串。我们需要解析它，再交给工具；不能将它直接当成代码执行。[Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)

在 `runHarness()` 里找到这几步，自己写一遍：

```js
messages.push({
  role: 'assistant',
  content: message.content ?? null,
  tool_calls: calls,
});

for (const call of calls) {
  const result = await runTool(call, { ...toolOptions, signal });
  messages.push({
    role: 'tool',
    tool_call_id: call.id,
    content: JSON.stringify(result),
  });
}
```

先追加模型自己的调用消息，再追加每个调用对应的结果。`tool_call_id` 用来把结果与请求配起来。下一轮把这些消息一起交给模型，它才看得到工具实际返回了什么。

参考实现最多请求模型 4 次，一轮最多接收 4 个工具调用，并拒绝重复调用 ID。它检查结束原因：正常文本回答需要 `stop`；工具请求需要 `tool_calls`。输出达到长度上限等异常结束会进入失败状态。

## 第三十到四十分钟 让保存经过你的决定

默认运行不会保存任何文件。`save_note` 收到的内容会被转换为 `permission_denied` 结果，交回模型继续回答。

现在让程序有一个明确的保存目标：

```bash
AI_HARNESS_DIR=$(mktemp -d)
node docs/ai-from-scaling/labs/harness.mjs --write-to "$AI_HARNESS_DIR/summary.md"
```

程序展示完整内容与路径，再询问是否允许创建。第一次输入 `n`，检查结果明确写着拒绝，目录中没有摘要。第二次重跑并输入 `y`，随后查看：

```bash
cat "$AI_HARNESS_DIR/summary.md"
```

你应该读到总花费 780 元、余额 20 元。再运行并允许保存到同一路径，已有文件会被拒绝覆盖。

路径来自你启动程序时的 `--write-to`，模型只能提交摘要文本。程序在终端不可交互时拒绝审批。这项设计把本次教学的写入范围保持在一个你明确选择的新文件上。

## 最后十分钟 分清终态和任务结果

参考实现使用四个终态：

| 终态 | 表示什么 | 还需要检查什么 |
| --- | --- | --- |
| `answered` | 收到了正常结束的最终回答 | 工具是否成功，用户任务是否完成 |
| `failed` | 模型请求或协议处理失败 | 错误原因与已经产生的结果 |
| `cancelled` | 用户发出取消，循环停止 | 停止前的工具是否已经执行 |
| `limit_reached` | 用完允许的模型请求次数 | 任务还有哪些部分没完成 |

工具自身失败会作为结构化结果回传，模型可以解释失败或提出修正。一项工具失败不必然使整个回答循环失败。

`answered` 只证明回答正常结束。默认示例在保存被拒绝以后也可以正常回答；检查任务成果时，应明确记录“已核算，未保存”。

取消也要从输入层接到整个运行。参考实现由 `AbortController` 提供共同信号；审批输入使用 readline，它会接收交互时的 `Ctrl+C`，所以还要连接这一个事件：

```js
terminal.once('SIGINT', cancel);
```

`cancel()` 中止共同信号，让等待审批与模型请求都能停止。只把一次输入标为失败，还不能表示整个任务已取消。[Node.js readline SIGINT](https://nodejs.org/api/readline.html#event-sigint)

打开源码，从 `runHarness()` 往下追，分别指出：

1. 哪个函数提供模型回复，哪个函数执行工具？
2. 写入审批发生在什么时候？
3. 哪一条工具结果证明文件已创建？怎样再用文件内容核对？
4. 哪个条件阻止模型无限继续调用工具？

本课的事件只保存在内存并打印到终端，进程退出后不会自动恢复。需要持久化与崩溃恢复时，继续做[Harness 工程实验](../agent-engineering/05-harness-vertical-slice.md)。

下一步：[第四小时 接真实模型并做对照实验](04-experiments.md)。
