# Harness：查清这次慢在哪、贵在哪

用上下文清单与运行报告，查清模型读了什么、时间和用量花在哪里。

**保存完整历史，按预算装配每次上下文。**

状态：实现建议。字段名是示意，未接入当前 runtime。资料核对：2026-10-24。

## 两本账

| 账本 | 保存什么 | 用途 |
| --- | --- | --- |
| 完整历史 | 全部事件、工具结果、artifact 引用 | 恢复、审计、导出、对账 |
| 本次上下文 | 这次真正发给模型的内容 | 控制 token、保持工具调用成对、留出输出空间 |

“历史里有”不等于“这次要发给模型”。把所有历史每轮重发，会把成本、延迟和上下文超限一起放大。

## 上下文装配规则

第一版可以按固定规则装配：

1. 当前任务与明确约束。
2. 最近 N 个完整交互轮次；不要从一轮中间切断。
3. 与当前任务相关的工具请求和结果，必须成对保留。
4. 大输出只保留有界摘要 + artifact 引用。
5. 为模型输出、工具 schema 和下一次工具结果预留空间。
6. 无法构造合法上下文时停止，并显示原因；不要原样重试到超限。

接近预算时，先裁剪可重建的日志，再考虑摘要。摘要要标记覆盖范围，原始记录仍然保留；摘要不是无损压缩。

以上是内容保留的优先级。最终装配仍须保持接口要求的角色与时序，避免每轮把当前任务搬到历史前部而制造额外的前缀变化。

## `context.manifest`

每次请求前生成一份清单，说明“为什么发送这些内容”：

```json
{
  "runId": "r-7",
  "estimatedInputTokens": 18400,
  "reservedOutputTokens": 4096,
  "included": [
    "current-task",
    "constraints",
    "turn-8..turn-12",
    "tool-pair-31"
  ],
  "excluded": [
    { "reason": "older-than-window", "count": 24 },
    { "reason": "artifact-summary-only", "count": 3 }
  ],
  "artifacts": ["art-3", "art-5"],
  "method": "chars-div-4-with-10-percent-margin"
}
```

把清单也存成事件，便于回查发送内容、排除项与估算依据。

## `run.report`

每次 Run 结束生成一份报告，单独保存为 artifact：

```json
{
  "runId": "r-7",
  "status": "succeeded",
  "modelRequests": 3,
  "toolCalls": 4,
  "approvalWaitMs": 12000,
  "estimatedTokens": 27100,
  "actualUsage": { "prompt": 24000, "completion": 3100 },
  "resultBytes": 81234,
  "errors": [],
  "cancelledAt": null,
  "durationMs": 48300
}
```

字段按你的供应商能力取舍。关键是让报告能回答：

- 慢在哪：模型请求、工具执行、审批等待，还是持久化？
- 贵在哪：输入、输出、重试，还是重复发送历史？
- 失败在哪：网络、限流、工具错误、上下文超限，还是取消？
- 上下文是否接近预算：估算值与预留空间还剩多少？

## 缓存用量

每次请求保留原始 usage、供应商与模型。汇总时用“命中 token 总数 ÷ 有效输入 token 总数”，同时报告用量覆盖了多少请求；缺字段保留未知。

<details class="qa">
<summary>为什么不能直接相加或平均每轮命中率？</summary>

DeepSeek 的 `prompt_tokens` 已含命中；Pi 的 `input` 则把缓存读写另列。先统一口径，再汇总；不同大小请求的百分比也不能直接平均。

另记压缩、换模型与工具清单变化。详见 [DeepSeek](../kv-cache/03-prefix-cache-and-yuuki.md)、[dsh](../kv-cache/04-deepseek-harness.md)、[Pi](../kv-cache/05-pi.md)。这些观测尚未接入当前 runtime。

</details>

## 小挑战：聊到第 100 轮，再查一次账

合成一条包含 100 轮交互和多次大工具输出的会话：

1. 每轮都重新装配上下文，记录 `context.manifest`。
2. 检查 token 估算是否保持在预算内，而不是随历史线性增长。
3. 检查每个 tool call 和它的结果是否仍然成对。
4. 检查待审批、`unknown` 工具结果和取消记录没有被摘要裁掉。
5. 在接近预算时触发一次超限，确认系统停止并说明原因。

## 验收

- 只看 `run.report`，能说清这次 Run 的时间、token 和失败点。
- 100 轮合成会话不会无界增长；超出预算时停止，不原样重试。
- 上下文清单能解释“模型看到了什么、没看到什么”。
- 估算 token 与实际 usage 分开记录；差异大时能看到估算方法。

## 边界

- **估算不是账单。** 字符数除以 4 只是粗略估计；供应商的 tokenizer 和计费口径不同。记录方法并留余量。
- **摘要不是事实。** 摘要可能漏掉关键条件；需要精确信息时回查 artifact 或原始事件。
- **不要静默截断用户产物。** 用户要求保存的文件、报告和证据不能被日志清理策略悄悄删除。
- **不要把待审批和未知结果裁掉。** 它们影响下一步决策，不能因为“太旧”就消失。
- **报告本身也要限额。** 失败时不要递归生成巨大的错误报告。

## 和现有文档的关系

- 上下文与持久化建议：[Mac 本地 Harness](../architecture/mac-local-harness.md) 第 7.1、10 节
- 事件与输出边界：[PROTOCOL.md](../../examples/shared/runtime/PROTOCOL.md)
- 场景实验的计量口径：[十五个 Harness 场景](../learning/harness-scenario-lab.md)

返回[上一篇](05-harness-vertical-slice.md) · [总览](README.md) · 下一篇[Harness：场景回归](07-scenario-regression.md)。
