# AI 自动化：GitHub 工作流与自制转发器

**先用 Actions 跑通一个 Issue；需要接聊天、告警或多个仓库时，再做转发器。**

调研范围：2025–2026，资料读取于 2026-11-01。以下是文档调研与设计建议，尚未在本仓库启用。

## 五条路线怎么选

| 路线 | 能做什么 | 适合现在试什么 |
| --- | --- | --- |
| [Codex Action](https://github.com/openai/codex-action) | 在 GitHub runner 运行 Codex，使用 API key | 一个 Issue → 修复 → 测试 → 草稿 PR |
| [Claude Code Action](https://github.com/anthropics/claude-code-action) | 用 `@claude` 等事件触发编码或审查 | 评论驱动，比较不同 Agent |
| [Agentic Workflows](https://github.com/github/gh-aw) | Markdown 编译为 Actions，受限写入经 safe outputs 发布 | Issue 分类、CI 调查、文档维护 |
| [n8n](https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/trigger-nodes/n8n-nodes-base.githubtrigger.md) | 可视化接收 GitHub 事件 | 先连通事件，再接模型与通知；本次仅核对触发节点 |
| 自制转发器 | 统一收事件、排队、选 Agent、保存任务状态 | 跨平台接单与有限返修 |

Actions、Webhook 是已有基础设施；近两年的探索重点是把 Agent 接进流程。[gh-aw 版本记录](https://github.com/github/gh-aw/blob/main/CHANGELOG.md)可核对 2025-12、2026-01 的迭代。

## GitHub 已经能负责什么

| 入口 | 用法 |
| --- | --- |
| `workflow_dispatch` | 手动试跑一次 |
| `issues: labeled` | 给 Issue 加 `ai-ready` 后领取 |
| `issue_comment` | 授权人的命令评论触发返修 |
| `repository_dispatch` | 从聊天、监控等外部系统触发 Actions |

先用手动入口，再加事件。工作流需满足各事件的默认分支规则；具体见[官方触发说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)。

## 如果自制一个转发器

```text
GitHub / 聊天 / 告警 → 接收器 → 持久队列 → Agent → 测试 → 草稿 PR
```

首版可以是一个 HTTP 服务、一个队列、一张任务表。接收器也可以只转成 `repository_dispatch`，继续让 Actions 执行。

- **接收：** GitHub 原始请求体验签，只接授权仓库、事件和触发人；入队后快速回 2XX。
- **去重：** `X-GitHub-Delivery` 防重复投递，任务表另外保证同一 Issue 同时只跑一个任务。
- **执行：** GitHub App 授予必要权限，Agent 在隔离环境运行；失败重试原任务，最多返修两轮。
- **交付：** 保存 Issue、分支、PR 与 head SHA；新提交重新检查，首版人工合并。

实现依据：[Webhook 最佳实践](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)、[验签说明](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)。去重、返修次数和状态转换由程序保存，不能只写在提示词里。

## 我们下一次只试什么

1. **先试分析：** 手动选择一个 Issue，普通 Responses API 返回复现与验收清单。
2. **再试修复：** 用 [Codex Action](05-codex-api.md) 交付草稿 PR；示例面向 `for-job`，用于本站时换成 `site` 的范围和检查命令。
3. **最后接事件：** 加 `ai-ready` 自动领取，重放同一事件应复用原任务、原 PR。

模型凭据与费用按所选执行器计算；转发器不会把 API 用量变成订阅额度。订阅赠额能否使用，见[极简费用注意事项](../codex-cloud/05-issue-to-pr.md#openai-api-先确认费用来源)。
