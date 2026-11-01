# Issue 自动化：扫描、修复与交付

记录 Issue，按计划处理，通过草稿 PR 交付改动、检查结果与待验项。

这是[AI 协作](../side-by-side/README.md)的基础流程：修复、检查并交付一个问题。

本组是教学与首版方案；构想看[AI 实践构想](../ai-ideas/README.md)，公开案例看[已有实践](../ai-practices/README.md)。

**先生成 Issue 清单，再修一个小问题，最后接持续流程。**

已有 Dot 与产品额度，选[Dot 路线](04-dot-shift.md)：Dot 协调，Codex 执行，GitHub 保存交付。

已有 API，选[Codex Action](05-codex-api.md)或 [Agentic Workflows](06-agentic-workflows.md)；并行时按[共同基线](../codex-cloud/05-issue-to-pr.md)隔离任务。

工具选型与事件接入见[GitHub 工作流与自制转发器](07-automation-options.md)。

邮件通知见[GitHub → Outlook 提醒](08-github-outlook.md)。

多 AI 事件协作见[从 EventBus 到任务总线](09-multi-agent-event-bus.md)。

<div class="heading-alias" id="先认识今晚的搭档" aria-hidden="true"></div>

## 角色与职责

| 角色 | 职责 | 前端类比 |
| --- | --- | --- |
| GitHub Issue | 问题、复现与预期 | 一条待处理的数据 |
| GitHub Actions | 到时间启动任务，准备执行环境 | 一个由事件触发的异步任务 |
| Dot | Dot 路线中跟进任务、安排开发与返修 | 跟踪任务进度的协调者 |
| Codex | 阅读仓库、修改代码、运行检查 | 能使用工具完成任务的 Agent |

PR 保存待审改动，Actions 定时启动任务，官方 Codex Action 执行编码。 [GitHub 定时触发](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[OpenAI Docs：Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)

[![Issue 工作流先选择去重，再修改验证，最后发布可验收的草稿 PR](../../site/public/diagrams/issue-garden/handoff.svg)](../../site/public/diagrams/issue-garden/handoff.svg)

<div class="heading-alias" id="一次夜班会发生什么" aria-hidden="true"></div>

## 处理流程

```text
到时间 → 读取未关闭的 Issue → 挑选一个可处理的问题
      → 独立分支 → AI 修改 → 运行检查 → 草稿 PR → 人工验收
```

扫描范围与修复范围分别设置：<mark class="key">只修 `ai-ready`</mark>，已有待验 PR 的 Issue 跳过。

这是首版建议，仍需检查修复与验收结果。

<div class="heading-alias" id="三班练习一班比一班多接一点活" aria-hidden="true"></div>

## 分阶段实践

| 阶段 | 入口 | 完成条件 |
| --- | --- | --- |
| 1 · 扫描 | [汇总 Issue](01-first-scan.md) | Actions 生成 Issue 清单 |
| 2 · 修复 | [修复与验证](02-first-repair.md) | 可解释、可验证的 diff |
| 3 · 持续处理 | [定时处理流程](03-night-shift.md) | 明确调度、权限、去重与失败处理 |
| Dot 路线 | [Dot 协调 GitHub 开发任务](04-dot-shift.md) | 配环境、处理 Issue、交草稿 PR |
| 已有 OpenAI API | [官方 Codex Action 的一次交付](05-codex-api.md) | 在独立 job 验证补丁，再发布草稿 PR |
| Markdown 工作流 | [Agentic Workflows 与 API](06-agentic-workflows.md) | 编译、执行并核对 safe output 与 CI |
| 路线对照 | [云端 Codex 与 Issue 到 PR](../codex-cloud/05-issue-to-pr.md) | 同基线比较正确性、返修与用量 |
| 扩展设计 | [AI 实践构想](../ai-ideas/README.md) | 场景与实现方向 |
| 公开案例 | [已落地的 AI 开发实践](../ai-practices/README.md) | 案例证据与验证方法 |

扫描无需 AI Key；Actions 编码需 API 凭据及预算，Dot 使用产品额度，Actions 用量另计。

<div class="heading-alias" id="写-issue-可以很短" aria-hidden="true"></div>

## Issue 最小描述

```text
现象：点击文档目录中的某个链接，打开了错误的页面。
复现：进入目录 → 点击「第一句话，就从这里开始」。
期望：打开第一次发声的教程。
验收：链接能打开目标页，其他目录链接继续可用。
```

记录问题后再加 `ai-ready`，按当前需要选入口。

核对：Actions 2026-10-21，Dot 10-27，API／并行实验 10-31。本组尚未启用定时、API 或 Dot 开发循环，未自动创建远端改动或 PR。
