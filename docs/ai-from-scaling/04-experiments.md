# 第四小时 接真实模型并做对照实验

这一小时让前面的两份程序经历变化：增加训练、改变输入信息、接真实模型、拒绝动作、制造错误与中断。每次先预测结果，再运行，最后用概率、工具结果或文件内容来核对。

内容用 50 分钟，最后留 10 分钟复述。没有 API key 时，先完成所有离线实验，再在有凭据时补做真实模型部分。

## 前十分钟 接入真实模型

真实模式使用 DeepSeek 的 Chat Completions 工具接口，与仓库的[共享运行时](../../examples/shared/runtime/README.md)保持相同服务方向。它只发送本实验的任务、工具定义、内置活动计划和本轮工具结果。

在 macOS 默认的 zsh 终端中，交互输入自己的 key。输入隐藏，实际值不会写进这条命令的历史：

```zsh
read -r -s 'DEEPSEEK_API_KEY?输入 DeepSeek API key: '
print
export DEEPSEEK_API_KEY
export DEEPSEEK_MODEL='deepseek-flash'
node docs/ai-from-scaling/labs/harness.mjs --live
```

模型名可通过 `DEEPSEEK_MODEL` 改为账户可用、支持工具调用的模型。当前示例用 `deepseek-flash`，关闭 thinking，使用非流式回复，每次输出上限 512 tokens。请求与工具字段以 [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 为准。

真实模型可能合并调用、追问或尝试修正，步骤不保证与离线脚本相同。若达到 4 次请求上限，先检查记录，再决定是否给下一次运行更多轮数：

```bash
node docs/ai-from-scaling/labs/harness.mjs --live --max-rounds 6
```

每次请求最多等待 30 秒。网络、HTTP 或超时错误会结束运行，程序不自动重试；这些失败也不代表远端没有产生用量。用完后可以执行 `unset DEEPSEEK_API_KEY`，清除当前 shell 中的变量。

现在对照 `scriptedModel()` 与 `liveModel()`：它们都返回模型消息与结束原因，因此同一个 Harness 可以继续处理。模型接口的替换，没有替我们实现本地工具、审批或验证。

## 第十到二十分钟 对照训练计算与上下文

先保持上下文为 2，只改训练轮数：

```bash
node docs/ai-from-scaling/labs/tiny-model.mjs --context 2 --epochs 30
node docs/ai-from-scaling/labs/tiny-model.mjs --context 2 --epochs 120
```

两次使用相同语料、参数数量、学习率和初始值，改变的是参数更新次数。比较训练与验证 loss，再比较“猫吃”后“鱼”的概率。把发现限定在本例的配置与数据上。

接着回看第二小时的 1 字与 2 字上下文对照。它同时改变输入信息、参数规模与工作量。解释差异时，先指出这些变量，再讨论可能原因。

最后提出一个模型仍然做不到的问题：“告诉我明天的天气”。我们的语料、输入形式与模型结构都没有提供完成这个任务所需的能力。为它多训练原来的短句，不能据此期待它获得实时天气信息。

## 第二十到三十五分钟 故意让工具失败

逐条执行离线故障场景：

```bash
node docs/ai-from-scaling/labs/harness.mjs --scenario bad-json
node docs/ai-from-scaling/labs/harness.mjs --scenario unknown-tool
node docs/ai-from-scaling/labs/harness.mjs --scenario loop
```

| 场景 | 应当看到什么 | 核对哪项事实 |
| --- | --- | --- |
| 参数 JSON 损坏 | `tool_error` 回传，最终回答说明读取失败 | 没有假装成功读取计划 |
| 请求未知工具 | `run_shell` 被拒绝，作为错误结果回传 | 程序没有执行未注册动作 |
| 反复请求同一工具 | 最多请求模型 4 次，然后 `limit_reached` | 限额没有被模型绕过 |

前两个场景的离线脚本收到错误后按固定规则结束，这只验证错误通路。用真实模型测试纠错能力时，需要另做输入与结果对照。

循环场景的退出码是 1，这是“本次运行没有正常得到最终回答”的预期结果。不要为了让终端显示成功而把它改成 `answered`。

再打开 `executeTool()`，找到人数范围的检查，临时把离线计划中的人数改成 `-1` 后运行。确认返回的是工具错误，且没有继续请求保存。完成后把人数恢复为 20。

## 第三十五到四十五分钟 检查审批与取消

用新的临时目录打开保存审批：

```bash
AI_CANCEL_DIR=$(mktemp -d)
node docs/ai-from-scaling/labs/harness.mjs --write-to "$AI_CANCEL_DIR/summary.md"
```

等待“允许创建这个文件吗”出现，先不要回答，按 `Ctrl+C`。检查最后一条事件是 `run.cancelled`，终端停止，目录里没有新文件。

再运行一次并输入 `y`，核对文件确实创建。文件已经创建后再结束进程，文件仍会存在；取消请求不会撤销已经发生的写入。

把这件事接回真实模型：取消能让本地循环停止并中止等待中的请求，远端是否已处理请求、是否已计费，仍需要分别核对。

## 最后五分钟 用成果判断是否做对

把四种情况写到同一张记录里：

| 场景 | 最终状态 | 工具事实 | 用户任务完成情况 |
| --- | --- | --- | --- |
| 默认离线运行 | `answered` | 总额 780，余额 20；写入被拒绝 | 已核算，未保存 |
| 允许保存到新文件 | `answered` | 文件存在，内容与核算一致 | 已核算并保存 |
| 达到轮数上限 | `limit_reached` | 有工具结果，缺少最终回答 | 未完成，需要检查记录 |
| 审批时取消 | `cancelled` | 本次未创建文件 | 已停止，保存未完成 |

这张表帮助我们把“模型说了什么”“程序做了什么”“用户得到什么”分别核实。

## 最后十分钟 复述四小时

拿着保存的模型与 Harness 输出，依次解释：

1. 指出小模型的参数。训练和生成分别在什么地方发生？
2. 哪个实验增加了计算，哪个实验增加了模型可见的信息？
3. 实验里的学习现象，与大模型缩放研究之间有哪些相同点和范围差异？
4. 工具描述怎样进入模型请求，工具结果怎样回到下一轮上下文？
5. 收到最终回答之后，为什么还需要检查计算结果和保存的文件？

用下面这张短记录保留自己的发现，下一轮就从最难解释的一项继续：

```text
我亲手改动的地方：
我事先预测的结果：
实际看到的证据：
下一次要弄清的问题：
```

回到[四小时路线](README.md)。继续做产品时，从[共享运行时](../../examples/shared/runtime/README.md)对照真实模型适配与执行状态，再沿[Harness 工程实验](../agent-engineering/README.md)补持久化、恢复和故障回归。
