# 🍀 Agent 工程实践：MCP、Skills 与 Harness

**这一组把三件事分开落地：MCP 接外部能力，Skill 收重复流程，Harness 管权限、审计与恢复。** 七章各自带一个可独立验收的小实验，不要求按顺序全部完成。

状态：实现建议，不是已经有公开落地记录的案例。代码片段用于说明接口与边界，尚未接入本仓库的 runtime。MCP 与 Agent Skills 的规范仍在演进，具体字段和行为以当前官方文档为准。资料核对：2026-10-23。

## 先分清三层

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| MCP | 发现和调用外部工具、资源 | 权限、审批、事件、恢复 |
| Skill | 描述步骤、输入输出、验收命令 | 直接执行副作用、绕过工具策略 |
| Harness | 策略、审批、事件、取消、上下文、恢复、预算 | 把 MCP 或 Skill 的文本当成可信指令 |

一句话：**MCP 是手，Skill 是操作手册，Harness 是权限与审计。** 三者混在一起，最先丢失的通常是“谁批准了这次副作用”和“失败后到底发生了什么”。

## 七章与交付证据

| 章节 | 解决什么问题 | 先决条件 | 交付证据 |
| --- | --- | --- | --- |
| [MCP：接成工具源](01-mcp-tool-source.md) | 外部工具进入现有循环，但不绕过策略 | runtime 已有工具与审批 | 一次成功调用、一次拒绝、一次断连恢复 |
| [MCP：清单与默认拒绝](02-mcp-policy.md) | 工具太多、返回值不可信 | 工具源可发现工具 | 未授权工具被拒；超大结果被截断 |
| [Skills：结构与触发](03-skills-structure.md) | 重复流程不要继续加长提示 | 一个稳定重复的任务 | 3 次任务触发正确、返工不增加 |
| [Skills：校验与渐进加载](04-skills-validation.md) | 模型自述不能当验收 | 一个可执行检查命令 | 新会话跑通；坏 fixture 失败 |
| [Harness：可恢复闭环](05-harness-vertical-slice.md) | 取消、崩溃、重启后状态可信 | 现有 Run/ToolCall 状态机 | 6 个状态场景通过 |
| [Harness：上下文与运行报告](06-context-and-report.md) | 上下文无界、成本无法解释 | 事件已持久化 | 100 轮会话不超预算；报告能回答慢在哪 |
| [Harness：场景回归](07-scenario-regression.md) | 控制面故障难以复现 | fake model 与 fake server | CI 确定性通过 |

## 建议顺序

1. **先做 [Harness：可恢复闭环](05-harness-vertical-slice.md)。** 它不依赖 MCP、真实模型或付费 API，先把取消、崩溃与恢复钉住。
2. **再做 [MCP：接成工具源](01-mcp-tool-source.md) 和 [MCP：清单与默认拒绝](02-mcp-policy.md)。** 只接只读工具，先证明拒绝和断连路径。
3. **并行做 [Skills：结构与触发](03-skills-structure.md) 和 [校验](04-skills-validation.md)。** 选一个你每天都会重复的任务，不要为演示造一个 skill。
4. **最后补 [上下文与运行报告](06-context-and-report.md) 和 [场景回归](07-scenario-regression.md)。** 有了运行数据，调优才有依据。

如果今天只做一件事，选第 1 步。它最容易暴露“看起来能跑、其实无法恢复”的问题。

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
