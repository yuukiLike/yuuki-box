# AI 协作（Side by Side）

Side by Side · 任务协作与持续交付。

围绕明确任务协同实现、审查与返修，持续记录结果和待决事项。

首轮处理一个可验收任务。

## 当前优先：Issue 自动化

选择一个<mark class="key">验收清楚的问题</mark>，完成读取、修复、验证与返修，交付草稿 PR 后再扩展持续流程。

| 阶段 | 入口 | 交付物 |
| --- | --- | --- |
| 流程总览 | [Issue 扫描、修复与交付](../issue-garden/README.md) | 明确问题与执行路线 |
| 扫描任务 | [汇总 Issue](../issue-garden/01-first-scan.md) | 自动生成的 Issue 清单 |
| 单次修复 | [修复与验证](../issue-garden/02-first-repair.md) | 可解释、可验证的 diff |
| 使用 Dot 路线 | [用 Dot 接手 GitHub 开发任务](../issue-garden/04-dot-shift.md) | 试跑一个 Issue，接回草稿 PR |
| 使用 API 路线 | [官方 Codex Action](../issue-garden/05-codex-api.md)、[Agentic Workflows](../issue-garden/06-agentic-workflows.md) | 一次实现、验证与草稿 PR 交付 |
| 事件接入 | [GitHub 工作流与自制转发器](../issue-garden/07-automation-options.md) | 路线与单任务结果 |
| 多 AI 协作 | [EventBus 与持久任务总线](../issue-garden/09-multi-agent-event-bus.md) | 并发、反馈与恢复设计 |

<div class="heading-alias" id="一起检查接受纠正" aria-hidden="true"></div>

## 审查与反馈

交付后按[复现、验收与返工](../ai-practices/your-workflow.md)核对证据；需要第二份意见时，用[独立审查与有限返修](../ai-ideas/01-ideas-map.md#你的设想二另一个-ai-来审查代码)。

其他实验方向见[AI 探索](../ai-ideas/README.md)。

本专题提供方案与实践入口，尚未实现完整持续协作系统；运行边界见各教程。
