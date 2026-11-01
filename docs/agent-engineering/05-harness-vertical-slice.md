# Harness：按下取消，再故意让它崩一次

中途取消、审批时崩溃、重启后对账：先亲手验证一次运行怎样收场。

加 MCP 与 Skills 前，先做<mark class="key">能取消、能恢复、可解释的 Run</mark>。

实现建议，状态名沿用 [Mac 本地 Harness](../architecture/mac-local-harness.md)。runtime 已有部分工具与审批，尚未通过全部恢复验收。核对：2026-10-23。

## 最值得拆穿的「能跑了」

有按钮、有调用，还需核对：

- 取消发生在流式输出中间，UI 还会不会收到迟到的 delta？
- 审批超时后，模型能不能继续回答？
- 工具 intent 已落盘、结果没落盘时崩溃，重启后知道发生了什么吗？
- 重复提交同一个 `commandId`，会创建两个 Run 吗？
- 事件顺序在重启后还可信吗？

用完整的 `submit → model → tool → result → end` 验证，不先拆成孤立模块。

## 切片包含什么

```text
run.submit
→ command.accepted
→ run.started
→ model request
→ tool.proposed
→ policy: allow / ask / deny
→ (ask) waiting_for_approval → approval.respond
→ ready → running → tool result / error / unknown
→ model request
→ run.succeeded / failed / cancelled / interrupted
```

先用 **fake model adapter** 固定返回一次工具调用和最终回答；无网络、无付费 API，也能测控制面。

```text
fake model: "调用 list_files"
→ Harness 执行只读工具
→ fake model: "根据结果回答完成"
```

真实模型 adapter 之后替换它；Run 状态、事件、审批和恢复逻辑不变。

[![Run 的取消和 ToolCall 的未知结果分别记录，恢复需要持久化数据](../../site/public/diagrams/agent-engineering/05-run-recovery.svg)](../../site/public/diagrams/agent-engineering/05-run-recovery.svg)

图中 Run 与 ToolCall 分层；工具结果未知时 Run 为 `interrupted`，不能记作副作用已撤销。

## 六个状态场景

| 注入 | 期望终态与证据 |
| --- | --- |
| 流式输出中取消 | Run `cancelling → cancelled`；取消后不再发布 delta；已发生的工具副作用保留记录 |
| 审批等待中超时 | ToolCall `failed` / `permission_denied`；Run 可继续生成无需该工具的回答 |
| 工具 intent 落盘后崩溃 | ToolCall `unknown`；Run `interrupted`；重启后提示对账，不自动重放 |
| 重复 `commandId`、相同输入 | 返回已有 Run，不创建第二个 |
| 重复 `commandId`、不同输入 | 返回冲突错误，不覆盖原任务 |
| 工具返回结构化错误 | 错误作为 tool result 回传模型；Run 不因单次工具失败直接崩溃 |

## 事件不变量

各路径都须保持：

- 同一 Store 的 `seq` 单调递增、不重用，允许缺口。
- 终态不可改写；补充信息另记新事件。
- tool call 与结果成对；取消或崩溃也留下无结果或 `unknown` 记录。
- 副作用前保存 intent，尝试后保存结果事件。
- 取消不证明撤销；已发生的写入、请求、计费仍保留。

## 小挑战：让六种结局各发生一次

1. 用 fake model 和内存 Store 跑通成功路径，确认事件顺序。
2. 在流式输出中触发取消，检查是否还有 delta。
3. 在审批等待中让审批超时，检查 ToolCall 与 Run 的终态。
4. Store 改用临时目录持久化：intent 落盘后退出子进程，新进程重读并确认 Run 为 `interrupted`；内存 Store 无法验证。
5. 重复提交同一个 `commandId`，分别测试相同与不同输入。
6. 让工具返回一个错误，确认模型能收到结构化结果并继续。

## 验收

- 六个场景都有自动化测试，不依赖真实模型和网络。
- 重启后能从事件重建“上次发生了什么”，不需要猜。
- 取消、失败、未知、成功四种终态不会互相伪装。
- 任何副作用都能追溯到 Run、ToolCall 和审批记录。

## 边界

- **日志恢复视图：** 不能据此重跑历史工具。
- <mark class="caution">取消不等于撤销</mark>：文件、请求与远端计费可能已发生。
- **保留 `unknown`：** 不改成虚假的失败或成功。
- **内存 Store 仅供测试：** 生产还需事务、迁移和单写者约束，见架构提案第 10 节。

## 和现有代码的关系

- 当前 runtime 的命令与事件：[`PROTOCOL.md`](../../examples/shared/runtime/PROTOCOL.md)
- 当前工具与取消行为：[runtime 说明](../../examples/shared/runtime/README.md)
- 目标状态机与事件语义：[Mac 本地 Harness](../architecture/mac-local-harness.md) 第 6、7、9 节

返回[总览](README.md) · 下一篇[Harness：上下文与运行报告](06-context-and-report.md)。
