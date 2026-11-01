# Agent 入门 1：搭建工具调用 Harness

搭一个执行循环：读活动计划 → 算预算 → 申请保存 → 回答。

[Agent 工程](../agent-engineering/README.md)第一课，需基础 JavaScript 与终端操作；先用脚本模拟模型，无需训练模型或实现 MCP。

找到三个入口：<mark class="key">模型、工具、事件</mark>，分别是 `complete`、`runTool`、`emit`。

参考实现：[harness.mjs](labs/harness.mjs)。Node.js ≥22.22，在仓库根目录执行；学习 50 分钟，休息 10 分钟。

本章工具是本地函数。以后接入 MCP 时，换成客户端的 `callTool()`；限制与审批仍由 Harness 管理。

## 前十分钟 沿着一次任务看循环

先跑离线模式：

```bash
pnpm demo:harness
```

计划为 20 人、餐费每人 35 元、场地 80 元、预算 800 元。终端打印模型请求、工具提议、结果与回答：总额 780、余额 20；默认拒绝保存。

`scriptedModel()` 用固定回复检查循环，下一章接真实模型。

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

[![模型提出工具请求，Harness 检查并执行，把配对结果加入下一轮上下文](../../site/public/diagrams/ai-from-scaling/harness-loop.svg)](../../site/public/diagrams/ai-from-scaling/harness-loop.svg)

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

schema 描述输入契约；程序仍要检查工具名、参数 JSON、字段及数值范围。

本课使用三个工具：

| 工具 | 实际行为 | 谁提供能力 |
| --- | --- | --- |
| `read_plan` | 返回源码内置的活动计划 | 我们编写的函数 |
| `calculate_total` | 计算花费、余额和是否超预算 | 我们编写的函数 |
| `save_note` | 请求向启动时指定的路径创建摘要 | 我们编写的函数与审批逻辑 |

模型提议，客户端执行并返回结果。[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)

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

`arguments` 是 JSON 字符串，要解析并校验，不能作为代码执行。[Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)

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

先追加调用，再按 `tool_call_id` 追加结果。下一轮一起发给模型，它才能看到执行结果。

最多请求模型 4 次，每轮最多 4 个工具调用，拒绝重复 ID；文本须以 `stop`、工具须以 `tool_calls` 结束，截断等异常记为失败。

### 三个可自定义入口

包装三个函数，保留输入输出，添加调用前后的逻辑。

| 入口 | 什么时候经过这里 | 可以加什么 |
| --- | --- | --- |
| `complete(messages, { signal })` | 每次请求模型 | 计时、读取返回的 `usage`、请求前检查用量预算 |
| `runTool(call, options)` | 每次执行工具 | 参数检查、权限策略、等待审批、拒绝执行 |
| `emit(event)` | 产生运行事件时 | 记录 `model.request`、`model.usage`、`tool.proposed`、`tool.result` 与终态 |

先只给模型调用加计时。在仓库根目录运行下面的离线练习，无需 API key：

```bash
node --input-type=module <<'JS'
import { runHarness, scriptedModel } from './docs/ai-from-scaling/labs/harness.mjs';

const withTiming = (complete) => async (messages, options) => {
  const started = performance.now();
  try {
    return await complete(messages, options);
  } finally {
    console.log(JSON.stringify({ type: 'model.duration', elapsedMs: performance.now() - started }));
  }
};

const result = await runHarness({
  complete: withTiming(scriptedModel()),
  emit: (event) => console.log(JSON.stringify(event)),
});
console.log(result.answer);
JS
```

应看到四条 `model.duration` 和“已核算，未保存”；包装器保留信号、结果和异常，`return await` 覆盖完整耗时。

**执行前控制，`emit` 记录。** 它是同步回调；已有限轮与 `model.usage`，未实现累计 token 拦截、跨会话审计或持久化。离线无 token 用量，缺失 `usage` 记为未知。

统一统计模型与工具时，要让两类调用都经过这些入口。

<details class="qa">
<summary>LangChain 等框架怎样对应这三个入口？</summary>

下表只作接口对照，本课未引入框架依赖。

| 框架与官方入口 | 自己能写的逻辑 | 对照本课 |
| --- | --- | --- |
| [LangChain 自定义中间件](https://docs.langchain.com/oss/javascript/langchain/middleware/custom) | `createMiddleware` 定义模型与工具钩子 | 包装 `complete`、`runTool` |
| [Vercel AI SDK 模型中间件](https://ai-sdk.dev/docs/ai-sdk-core/middleware) | `wrapLanguageModel` 包装参数与回复 | 本例仅实现非流式调用 |
| [OpenAI Agents SDK 检查与审批](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals)、[运行追踪](https://developers.openai.com/api/docs/guides/agents/integrations-observability) | guardrail、审批与自定义 span | 输入输出检查、执行决策与记录 |

读 `wrapModelCall(request, handler)` 时，找检查发生的位置与调用 `handler` 的时机；顺序与状态约定以框架文档为准。

</details>

## 第三十到四十分钟 让保存经过你的决定

默认拒绝保存，`save_note` 返回 `permission_denied`，模型据此继续回答。

现在让程序有一个明确的保存目标：

```bash
AI_HARNESS_DIR=$(mktemp -d)
pnpm demo:harness --write-to "$AI_HARNESS_DIR/summary.md"
```

先核对内容与路径，输入 `n` 确认未创建；重跑输入 `y`，再查看：

```bash
cat "$AI_HARNESS_DIR/summary.md"
```

你应该读到总花费 780 元、余额 20 元。再运行并允许保存到同一路径，已有文件会被拒绝覆盖。

`--write-to` 固定路径，模型只提交文本；非交互终端拒绝审批，只允许创建你选定的新文件。

## 最后十分钟 分清终态和任务结果

参考实现使用四个终态：

| 终态 | 表示什么 | 还需要检查什么 |
| --- | --- | --- |
| `answered` | 收到了正常结束的最终回答 | 工具是否成功，用户任务是否完成 |
| `failed` | 模型请求或协议处理失败 | 错误原因与已经产生的结果 |
| `cancelled` | 用户发出取消，循环停止 | 停止前的工具是否已经执行 |
| `limit_reached` | 用完允许的模型请求次数 | 任务还有哪些部分没完成 |

工具失败可回传处理；<mark class="caution">回答结束不等于任务完成</mark>，拒绝保存时仍是“已核算，未保存”。

`AbortController` 统一取消信号；审批用 readline，还需连接它收到的 `Ctrl+C`：

```js
terminal.once('SIGINT', cancel);
```

`cancel()` 同时停止审批与模型请求；输入失败不能代替任务取消。[Node.js readline SIGINT](https://nodejs.org/api/readline.html#event-sigint)

沿 `runHarness()` 核对调用入口、写前审批与轮数限制；保存后检查文件内容。

事件仅保存在内存并打印到终端，退出不恢复；持久化见[Harness 工程实验](../agent-engineering/05-harness-vertical-slice.md)。

下一步：[Agent 入门 2：接真实模型并做对照实验](04-experiments.md)。
