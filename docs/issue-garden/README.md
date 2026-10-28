# 白天记 Issue，夜里长出 PR

白天碰见一个恼人的小 bug，先记成 Issue。第二天打开仓库，已经有一份草稿 PR 等你看：改了哪里，跑过什么检查，哪里还需要你拿主意。这就是这组教程想陪你搭出来的夜班。

这一组是可跟做的教学与首版方案。还没有落地记录的构想放在[AI 实践构想](../ai-ideas/README.md)，有公开案例的做法放在[已落地的 AI 开发实践](../ai-practices/README.md)。

**第一班先让 Issue 自己来报到。** 拿到一份自动生成的清单，再陪 AI 修掉一个小问题，最后才把这套流程交给夜班。每一步都有单独的成果，今天做到哪一步都能接着往下走。

**已有 Dot、希望使用现有产品额度，可以直接从[用 Dot 接手 GitHub 开发任务](04-dot-shift.md)开始。** 这一条由 Dot 协调、Codex 执行，你在 Dot 对话里提目标和反馈，GitHub 保存任务与交付记录。

## 先认识今晚的搭档

| 角色 | 负责什么 | 像前端里的什么 |
| --- | --- | --- |
| GitHub Issue | 保存问题、复现步骤和期望结果 | 一条待处理的数据 |
| GitHub Actions | 到时间启动任务，准备执行环境 | 一个由事件触发的异步任务 |
| Dot | 采用 Dot 路线时，持续跟进任务、安排 Codex 开发和返修 | 跟踪任务进度的协调者 |
| Codex | 阅读仓库、修改代码、运行检查 | 能使用工具完成任务的 Agent |

PR（Pull Request）保存准备合并的改动，方便你检查和讨论。GitHub Actions 支持按时间触发；Codex 也有供 Actions 调用的官方接入方式。[GitHub 定时触发](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[OpenAI Docs：Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)

[![Issue 工作流先选择去重，再修改验证，最后发布可验收的草稿 PR](../../site/public/diagrams/issue-garden/handoff.svg)](../../site/public/diagrams/issue-garden/handoff.svg)

## 一次夜班会发生什么

```text
到时间 → 读取未关闭的 Issue → 挑选一个可处理的问题
      → 独立分支 → AI 修改 → 运行检查 → 草稿 PR → 你验收
```

“扫描所有 Issue”与“执行哪些 Issue”分别决定。可以每天扫描指定仓库的全部未关闭问题，再只修复你标了 `ai-ready` 的小问题；已经有待验收 PR 的任务跳过。

这是一种建议的首版规则。扫描和筛选可以按规则执行，修复是否正确则需要检查与验收来判断。

## 三班练习，一班比一班多接一点活

| 什么时候看 | 入口 | 做到什么就可以停 |
| --- | --- | --- |
| 第一班：让任务报到 | [让 Issue 自己来报到](01-first-scan.md) | 在 Actions 里看到一份 Issue 清单 |
| 第二班：搭手修一次 | [搭一次班，修掉一个小问题](02-first-repair.md) | 看见一份自己能理解、能验证的 diff |
| 第三班：试着交班 | [交班：让流程接着跑](03-night-shift.md) | 能说明时间、权限、去重与失败分别由谁处理 |
| 已有 Dot，想让它接班 | [用 Dot 接手 GitHub 开发任务](04-dot-shift.md) | 配好 GitHub 与编码环境，试跑一个 Issue 并接回草稿 PR |
| 想看看还有什么可能 | [AI 实践构想](../ai-ideas/README.md) | 看懂已有设想与五个新方向的关系 |
| 想先看别人已经怎么做 | [已落地的 AI 开发实践](../ai-practices/README.md) | 看懂六项实践中的一个案例 |

第一篇只扫描 Issue，不需要 AI Key。第三篇的 Actions 执行方式需要 API 凭据与预算；Dot 路线使用账号已有的产品权限和额度，具体配置与限制见第四篇。GitHub Actions 的运行费用按自己的账户情况确认。

## 写 Issue 可以很短

```text
现象：点击文档目录中的某个链接，打开了错误的页面。
复现：进入目录 → 点击「第一句话，就从这里开始」。
期望：打开第一次发声的教程。
验收：链接能打开目标页，其他目录链接继续可用。
```

先记录清楚问题，再由你决定是否加上 `ai-ready`。学习材料是一组可以挑选的入口，不是需要全部清空的任务列表。

Actions 教学资料核对：2026-10-21；Dot 路线补充：2026-10-27。本组包含教学示例与首版设计建议；尚未在这个仓库启用定时工作流或 Dot 开发循环，也没有由这些流程自动修改远端代码或创建 PR。
