# Agent 入门 2：接真实模型并做对照实验

接着[搭建 Harness](03-build-a-harness.md)，换成真实模型，再改变工具条件：<mark class="key">先预测，再用结果核对</mark>。

实验 50 分钟，结果复核 10 分钟；无 API key 先做离线部分，字符模型对照供[四小时联读路线](README.md)选做。

## 前十分钟 接入真实模型

真实模式使用 DeepSeek Chat Completions，发送本实验的任务、工具定义、活动计划与本轮结果。

macOS zsh 中隐藏输入 key，避免写进命令历史：

```zsh
read -r -s 'DEEPSEEK_API_KEY?输入 DeepSeek API key: '
print
export DEEPSEEK_API_KEY
export DEEPSEEK_MODEL='deepseek-flash'
pnpm demo:harness --live
```

`DEEPSEEK_MODEL` 须支持工具调用；本例用 `deepseek-flash`、关闭 thinking、非流式、最多输出 512 tokens。字段以 [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 为准。

真实模型的步骤可能不同。达到 4 轮上限后，先查记录，需要时再增加：

```bash
pnpm demo:harness --live --max-rounds 6
```

请求限时 30 秒，网络、HTTP 或超时错误不自动重试；<mark class="caution">失败仍可能产生用量</mark>。结束后执行 `unset DEEPSEEK_API_KEY`。

两种模型返回相同格式；工具、审批与验证沿用同一 Harness。

<details>
<summary>四小时路线选做：对照训练计算与上下文</summary>

先完成[字符模型训练](02-train-a-model.md)，再做下面的对照。

固定上下文 2，只改训练轮数：

```bash
pnpm demo:tiny-model --context 2 --epochs 30
pnpm demo:tiny-model --context 2 --epochs 120
```

比较训练/验证 loss 和“鱼”的概率；结论限于本例。

1 字与 2 字上下文对照则同时改变输入、参数和工作量，解释结果时要列出这些变量。

继续训练原有短句不会提供实时天气信息；这还需要相应数据或工具。

</details>

## 第二十到三十五分钟 故意让工具失败

逐条执行离线故障场景：

```bash
pnpm demo:harness --scenario bad-json
pnpm demo:harness --scenario unknown-tool
pnpm demo:harness --scenario loop
```

| 场景 | 应当看到什么 | 核对哪项事实 |
| --- | --- | --- |
| 参数 JSON 损坏 | `tool_error` 回传，最终回答说明读取失败 | 没有假装成功读取计划 |
| 请求未知工具 | `run_shell` 被拒绝，作为错误结果回传 | 程序没有执行未注册动作 |
| 反复请求同一工具 | 最多请求模型 4 次，然后 `limit_reached` | 限额没有被模型绕过 |

前两项只验证错误通路，不衡量模型纠错能力。循环场景预期退出码为 1，终态保持 `limit_reached`。

在 `executeTool()` 找人数校验，临时将计划人数改为 `-1`；确认工具报错且不请求保存，再恢复为 20。

## 第三十五到四十五分钟 检查审批与取消

用新的临时目录打开保存审批：

```bash
AI_CANCEL_DIR=$(mktemp -d)
pnpm demo:harness --write-to "$AI_CANCEL_DIR/summary.md"
```

审批出现时按 `Ctrl+C`；应以 `run.cancelled` 结束，目录无新文件。

重跑输入 `y`，核对文件；写入后结束进程不会撤销文件。

真实调用取消后，本地停止；远端处理与计费仍须另查。

## 最后五分钟 用成果判断是否做对

把四种情况写到同一张记录里：

| 场景 | 最终状态 | 工具事实 | 用户任务完成情况 |
| --- | --- | --- | --- |
| 默认离线运行 | `answered` | 总额 780，余额 20；写入被拒绝 | 已核算，未保存 |
| 允许保存到新文件 | `answered` | 文件存在，内容与核算一致 | 已核算并保存 |
| 达到轮数上限 | `limit_reached` | 有工具结果，缺少最终回答 | 未完成，需要检查记录 |
| 审批时取消 | `cancelled` | 本次未创建文件 | 已停止，保存未完成 |

<span id="最后十分钟-回顾与验收"></span>

## 练习后的十分钟 回顾与验收

用 Harness 输出解释调用、回传，以及任务为何可能未完成。

四小时路线再结合模型文件，回答：

1. 参数在哪里更新？生成时又使用了什么？
2. 哪次实验改变计算量，哪次改变输入和容量？结论适用到哪里？
3. 工具请求怎样执行、结果怎样回传，又怎样证明任务完成？

记录结果与待解决项：

```text
我亲手改动的地方：
我事先预测的结果：
实际看到的证据：
下一次要弄清的问题：
```

回到[四小时路线](README.md)。继续做产品时，从[共享运行时](../../examples/shared/runtime/README.md)对照真实模型适配与执行状态，再沿[Harness 工程实验](../agent-engineering/README.md)补持久化、恢复和故障回归。
