# 🍀 让 Issue 慢慢长成 PR

你白天把遇到的问题记成 GitHub Issue，AI 在夜间挑一个小问题，读代码、尝试修复、运行检查，然后交给你一个 PR。

**今天只需要读懂这条路线，或者跑通第一篇的只读实验。** 后面的内容随时可以回来接着看。

## 先记住三个角色

| 角色 | 负责什么 | 像前端里的什么 |
| --- | --- | --- |
| GitHub Issue | 保存问题、复现步骤和期望结果 | 一条待处理的数据 |
| GitHub Actions | 到时间启动任务，准备执行环境 | 一个由事件触发的异步任务 |
| Codex | 阅读仓库、修改代码、运行检查 | 能使用工具完成任务的 Agent |

PR（Pull Request）保存准备合并的改动，方便你检查和讨论。GitHub Actions 支持按时间触发；Codex 也有供 Actions 调用的官方接入方式。[GitHub 定时触发](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[OpenAI Docs：Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)

## 一次夜班会发生什么

```text
到时间 → 读取未关闭的 Issue → 挑选一个可处理的问题
      → 独立分支 → AI 修改 → 运行检查 → 草稿 PR → 你验收
```

“扫描所有 Issue”与“执行哪些 Issue”分别决定。可以每天扫描指定仓库的全部未关闭问题，再只修复你标了 `ai-ready` 的小问题；已经有待验收 PR 的任务跳过。

这是一种建议的首版规则。扫描和筛选可以按规则执行，修复是否正确则需要检查与验收来判断。

## 选一个小入口

| 什么时候看 | 入口 | 做到什么就可以停 |
| --- | --- | --- |
| 今天 | [先替我看一眼 Issue](01-first-scan.md) | 在 Actions 里看到一份 Issue 清单 |
| 想亲手体验时 | [陪 AI 修一个小问题](02-first-repair.md) | 看见一份自己能理解、能验证的 diff |
| 前面跑顺了 | [把流程交给夜班](03-night-shift.md) | 能说明时间、权限、去重与失败分别由谁处理 |
| 想看看还有什么可能 | [人机协作的构想地图](04-ideas-map.md) | 看懂两项已有设想与五个新方向的关系 |
| 想找个新实验 | [五个新方向，挑一个玩](05-five-new-directions.md) | 挑一个感兴趣的方向，读完它的小实验 |

第一篇不需要 AI Key。接入云端 Codex 时再配置模型凭据与用量预算；GitHub Actions 的运行费用也要按自己的账户情况确认。

## 写 Issue 可以很短

```text
现象：点击文档目录中的某个链接，打开了错误的页面。
复现：进入目录 → 点击「第一次发声」。
期望：打开第一次发声的教程。
验收：链接能打开目标页，其他目录链接继续可用。
```

先记录清楚问题，再由你决定是否加上 `ai-ready`。学习材料是一组可以挑选的入口，不是需要全部清空的任务列表。

资料核对：2026-10-21。本组包含教学示例与首版设计建议；尚未在这个仓库启用定时工作流，也没有调用付费 AI、自动修改远端代码或创建 PR。
