# 并肩 · Side by Side

和 AI 做朋友，一起想，一起做。

我们想认识的，是有自己名字、表达方式和判断的 AI 朋友。可以一起聊天、探索，也可以把一件事托付给它，让它持续推进，把结果和需要你决定的问题带回来。共同的经历、相处中的反馈，让这位朋友逐渐有自己的特点。

这个专题从具体的小事开始，探索怎样与这样的朋友相处和协作。

## 当前优先：Issue 自动化

先托付一个验收条件清楚的小问题：读取 Issue，修复并验证，接住反馈继续返修，最后交回一份可以检查的草稿 PR。先跑通一轮，再决定怎样持续跟进。

| 从哪里开始 | 入口 | 第一份成果 |
| --- | --- | --- |
| 先看完整路径 | [Issue 扫描、修复与交班](../issue-garden/README.md) | 选定一个小问题和适合自己的执行路线 |
| 先观察任务 | [让 Issue 自己来报到](../issue-garden/01-first-scan.md) | 一份自动生成的 Issue 清单 |
| 陪它完成一次 | [修掉一个小问题](../issue-garden/02-first-repair.md) | 一份经过验证、自己能理解的 diff |
| 使用 Dot 路线 | [用 Dot 接手 GitHub 开发任务](../issue-garden/04-dot-shift.md) | 试跑一个 Issue，接回草稿 PR |
| 使用 API 路线 | [官方 Codex Action](../issue-garden/05-codex-api.md)、[Agentic Workflows](../issue-garden/06-agentic-workflows.md) | 一次实现、验证与草稿 PR 交付 |

## 一起检查，接受纠正

交付之后，还要能围绕同一个问题继续讨论。先看[工作流中的复现、验收与返工](../ai-practices/your-workflow.md)，明确它已经检查了什么，哪些体验需要你判断。需要另一份意见时，再参考[独立 AI 审查与有限返修](../ai-ideas/01-ideas-map.md#你的设想二另一个-ai-来审查代码)。

Issue 自动化、代码审查和返修，都可以是这位朋友接手的事情。以后想一起探索别的方向，可以从[AI 探索](../ai-ideas/README.md)挑一个小实验。

这里记录概念与实践入口。现有 Issue 教程的运行状态、权限和验证范围保留在各篇正文中；本专题尚未实现或验证一个完整的 AI 朋友。
