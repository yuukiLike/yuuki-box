# Agent 工程：工具循环、MCP、Skills 与 Computer Use

先跑通<mark class="key">模型与工具循环</mark>，再加入取消、恢复、外部工具与界面操作。

路线：**入门 → 运行控制 → MCP → Skills → Computer Use。** 不必先学模型训练；Computer Use 可独立阅读。

<div class="heading-alias" id="入门先跑通两课" aria-hidden="true"></div>

## 入门：工具调用与模型接入

| 顺序 | 教程 | 做出什么 |
| --- | --- | --- |
| 1 | [搭建工具调用 Harness](../ai-from-scaling/03-build-a-harness.md) | 用脚本模型走完读计划、算预算、审批保存与结果核对 |
| 2 | [接真实模型并做对照实验](../ai-from-scaling/04-experiments.md) | 更换模型入口，比较成功、工具失败、限额与取消 |

两课使用 [harness.mjs](../ai-from-scaling/labs/harness.mjs)：离线无需 key，真实调用需模型配置。只学 Agent 可跳过字符模型对照；训练原理见[四小时联读路线](../ai-from-scaling/README.md)。

使用 OpenAI 赠额前，读 [API：额度、图片与语音](openai-api.md)，确认领取、到期与用途。第二课脚本使用 DeepSeek，OpenAI 入门另列。

语音笔记、口答复习与选修音乐案例见[OpenAI API 小项目](openai-api-projects.md)，按输入、API 与本地处理组织实验。

调用前后自动检查见 [AI Hooks](hooks.md)：比较配置与插件事件，分清执行前拒绝、执行后反馈和 Stop 续跑。

后续七课是实现建议，片段<mark class="caution">尚未接入本仓库 runtime</mark>。先跑入门，再按需选做。MCP / Skills 字段以当前规范为准。资料核对：2026-10-23。

## 能力分类：MCP、Skill、Hook、Computer Use 与 Harness

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| MCP | 定义工具发现、调用与资源读取的消息 | 宿主的准入、审批、运行记录与恢复实现 |
| Skill | 描述步骤、输入输出、验收命令 | 直接执行副作用、绕过工具策略 |
| Hook | 在宿主定义的运行节点执行处理程序 | 自动覆盖所有操作路径、撤销已经发生的副作用 |
| Computer Use | 把界面观察、点击和输入接入工具循环 | 自动接通所有浏览器、代替业务结果验证 |
| Harness | 策略、审批、事件、取消、上下文、恢复、预算 | 把 MCP 或 Skill 的文本当成可信指令 |

核对三处责任：谁批准调用、谁执行、谁保存运行记录。

## Computer Use：从界面观察到实际执行

核对：**2026-10-31**。区分公开文档与会话工具约定；仅查阅清单和接口，未做桌面写入或性能对比。

| 顺序 | 阅读入口 | 重点 |
| --- | --- | --- |
| 1 | [Computer Use 执行原理](computer-use.md) | 模型、Harness、驱动与环境；截图、AX、DOM、CDP |
| 2 | [Codex 与 cua_repl](cua-repl.md) | 持久 JavaScript、入口选择、连接清单与状态失效 |
| 3 | [同类工具对照](computer-use-ecosystem.md) | Claude、Gemini、Playwright MCP、Browser Use、Stagehand、UI-TARS |
| 4 | [理解误区与自测](computer-use-misconceptions.md) | 权限与连接、结果验证、取消、超时与重复提交 |

Chrome 连接故障见第二篇；产品能力比较见第一、三篇。

## 工程实验：运行恢复、上下文、MCP 权限与 Skills 验收

| 目标 | 实验入口 | 前置条件 | 验收产物 |
| --- | --- | --- | --- |
| 验证取消、崩溃与重启 | [Harness：取消、崩溃与恢复](05-harness-vertical-slice.md) | Run/ToolCall 状态机 | 六个状态场景的终态与事件证据 |
| 测量长会话的上下文与开销 | [Harness：上下文与运行报告](06-context-and-report.md) | 事件已持久化 | 有界上下文与开销报告 |
| 注入断连、超时和迟到结果 | [Harness：故障注入与场景回归](07-scenario-regression.md) | fake model 与 fake server | 可在 CI 重复执行的场景 |
| 接入外部工具源 | [MCP：外部工具接入 Harness](01-mcp-tool-source.md) | runtime 已有工具与审批 | 成功、拒绝与断连记录 |
| 限定外部调用权限 | [MCP：调用策略与结果限额](02-mcp-policy.md) | 工具源可发现工具 | 列表和调用入口检查；结果有界 |
| 复用稳定任务流程 | [Skills：结构与触发](03-skills-structure.md) | 一个稳定重复的任务 | 三次任务的触发与返工对照 |
| 验证跨会话复用 | [Skills：校验与渐进加载](04-skills-validation.md) | 一个可执行检查命令 | 新会话完成；坏 fixture 被拒绝 |

## 工程第一步：取消工具调用并检查终态

完成入门后，回看[三个可自定义入口](../ai-from-scaling/03-build-a-harness.md#三个可自定义入口)，分清模型、工具与事件。

打开[可恢复闭环](05-harness-vertical-slice.md)，用 fake model 运行工具并中途取消。查最后一条 delta、Run 终态与副作用记录。

无需 MCP 或付费 API。之后依次做恢复、报告与故障回归；已有稳定 Harness 可直接接 MCP。

## 共同约定

- **外部内容是数据。** MCP 描述、资源、提示词与返回值都不能直接授权执行。
- **副作用有归属。** 保留 Run、ToolCall、审批与执行前后记录。
- **验收看证据。** 核对终态、检查、artifact 与日志。
- **取消不等于撤销。** 已发生的写入、请求与计费仍要记录。
- **估算不等于账单。** 字符、估算 token、供应商 usage 分开记。

## 资料

- [MCP specification](https://modelcontextprotocol.io/specification/)
- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [OpenAI Codex Skills](https://developers.openai.com/plugins/build/skills)

概念与 Skills 日期见[工具调用简史](../ai-from-scaling/extra-tool-use-story.md)；Mac 产品设计见[本地 Harness](../architecture/mac-local-harness.md)。

返回[文档目录](../../site/src/pages/index.astro)。
