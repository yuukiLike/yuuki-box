# Agent 工程：Harness 运行控制、MCP 工具接入与 Skills 复用

先让一次工具调用能取消、能解释，再增加工具。用运行记录回答：刚才执行了什么，停在了哪里？

七个独立练习，分三段：**Harness 管运行，MCP 接工具，Skills 复用流程。**

状态：实现建议，不是已经有公开落地记录的案例。代码片段用于说明接口与边界，尚未接入本仓库的 runtime。MCP 与 Agent Skills 的规范仍在演进，具体字段和行为以当前官方文档为准。资料核对：2026-10-23。

## 能力分类：MCP 协议、Skill 流程与 Harness 执行

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| MCP | 定义工具发现、调用与资源读取的消息 | 宿主的准入、审批、运行记录与恢复实现 |
| Skill | 描述步骤、输入输出、验收命令 | 直接执行副作用、绕过工具策略 |
| Harness | 策略、审批、事件、取消、上下文、恢复、预算 | 把 MCP 或 Skill 的文本当成可信指令 |

核对三处责任：谁批准调用、谁执行、谁保存运行记录。

## 工程实验：运行恢复、上下文、MCP 权限与 Skills 验收

| 你想试什么 | 实验入口 | 开始前需要 | 带走什么 |
| --- | --- | --- | --- |
| 干到一半，取消、崩溃、再重启 | [Harness：把一次运行管到底](05-harness-vertical-slice.md) | Run/ToolCall 状态机 | 六个状态场景的终态与事件证据 |
| 聊到第 100 轮，查清慢在哪、贵在哪 | [Harness：上下文与运行报告](06-context-and-report.md) | 事件已持久化 | 有界上下文与能解释开销的报告 |
| 亲手制造断连、超时和迟到结果 | [Harness：故障演练场](07-scenario-regression.md) | fake model 与 fake server | 可在 CI 重复执行的场景 |
| 让外部工具第一次进入自己的循环 | [MCP：把外部工具接进 Harness](01-mcp-tool-source.md) | runtime 已有工具与审批 | 一次成功调用、一次拒绝、一次断连处理 |
| 决定哪些外部调用可以执行 | [MCP：调用策略与结果限额](02-mcp-policy.md) | 工具源可发现工具 | 列表和调用入口都检查；未授权请求拒绝；结果有界 |
| 把反复解释的任务教一遍、存下来 | [Skills：结构与触发](03-skills-structure.md) | 一个稳定重复的任务 | 三次任务的触发与返工对照 |
| 换个会话，检查它是否真的学会 | [Skills：校验与渐进加载](04-skills-validation.md) | 一个可执行检查命令 | 新会话跑通；坏 fixture 被抓住 |

## 入门实验：取消工具调用并检查终态

初学先做[三个可自定义入口](../ai-from-scaling/03-build-a-harness.md#三个可自定义入口)，分清模型、工具与事件。

打开[可恢复闭环](05-harness-vertical-slice.md)，先用 fake model 跑一次工具调用，再在中途取消。对着事件记录检查：最后一条 delta 在哪里，Run 怎样进入终态，已经发生的副作用留下了什么。

无需 MCP 或付费 API。之后依次做恢复、报告与故障回归；已有稳定 Harness 可直接接 MCP。

## 共同约定

- **外部内容都是数据。** MCP 的 tool description、resource、prompt，以及工具返回值，都不能直接当成指令执行。
- **副作用必须有归属。** 哪个 Run、哪个 ToolCall、哪次审批、执行前后留下了什么，都要能查。
- **验收看终态与证据。** “模型说完成了”不算验收；看 Run 状态、检查结果、artifact 和日志。
- **取消不等于撤销。** 已经发生的文件写入、网络请求或计费，不会因为状态变成 `cancelled` 就消失。
- **估算不等于账单。** 字符数、估算 token 与供应商标注的 usage 分别记录。

## 资料

- [MCP specification](https://modelcontextprotocol.io/specification/)
- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [OpenAI Codex Skills](https://developers.openai.com/plugins/build/skills)

返回[文档目录](../README.md)。
