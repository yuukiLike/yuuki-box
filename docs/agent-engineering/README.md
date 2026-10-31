# Agent 工程：从工具循环到运行控制、MCP 与 Skills

先跑通模型与工具之间的循环，再让运行能取消、能解释，随后接入外部工具与可复用流程。

本专题分四段：**入门跑循环 → 运行控制 → MCP 接入 → Skills 复用。** 模型训练是独立专题；入门两课可直接使用脚本模型与现成模型 API。

## 入门：先跑通两课

| 顺序 | 教程 | 做出什么 |
| --- | --- | --- |
| 1 | [搭建工具调用 Harness](../ai-from-scaling/03-build-a-harness.md) | 用脚本模型走完读计划、算预算、审批保存与结果核对 |
| 2 | [接真实模型并做对照实验](../ai-from-scaling/04-experiments.md) | 更换模型入口，比较成功、工具失败、限额与取消 |

这两课提供可运行的 [harness.mjs](../ai-from-scaling/labs/harness.mjs)。离线部分不需要 API key；真实调用需要自己的模型配置。只学习 Agent 时，第二课中的字符模型对照可以跳过。想同时理解训练原理，再跟随[四小时联读路线](../ai-from-scaling/README.md)。

准备使用 OpenAI 订阅赠送的 API 额度，先读 [OpenAI API：额度、图片与语音](openai-api.md)，确认领取入口、到期时间和模型用途。上面第二课的现有脚本使用 DeepSeek；OpenAI 这篇提供独立的 API 平台入门。

想让 Agent 在工具调用前后自动执行检查，读 [AI Hooks：Claude Code、DeepSeek Harness 与 Codex](hooks.md)。用同一条演示规则比较配置型 hook 与插件事件，并分清执行前拒绝、执行后反馈和 Stop 续跑。

后续七个工程练习是实现建议，代码片段用于说明接口与边界，尚未接入本仓库的 runtime。先跑通入门代码，再按需求选做。MCP 与 Agent Skills 的规范仍在演进，具体字段和行为以当前官方文档为准。资料核对：2026-10-23。

## 能力分类：MCP、Skill、Hook 与 Harness

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| MCP | 定义工具发现、调用与资源读取的消息 | 宿主的准入、审批、运行记录与恢复实现 |
| Skill | 描述步骤、输入输出、验收命令 | 直接执行副作用、绕过工具策略 |
| Hook | 在宿主定义的运行节点执行处理程序 | 自动覆盖所有操作路径、撤销已经发生的副作用 |
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

## 工程第一步：取消工具调用并检查终态

完成入门后，回看[三个可自定义入口](../ai-from-scaling/03-build-a-harness.md#三个可自定义入口)，分清模型、工具与事件。

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

想了解这些概念的来历，选读[工具调用简史](../ai-from-scaling/extra-tool-use-story.md)，其中记录了 Skills 首次推出与开放标准发布的日期。准备做 Mac 产品时，再查阅[本地 Harness 完整设计](../architecture/mac-local-harness.md)。

返回[文档目录](../../site/src/pages/index.astro)。
