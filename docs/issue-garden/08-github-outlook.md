# GitHub → Outlook：Issue 与 PR 邮件提醒

**<mark class="key">先用 GitHub 原生邮件通知</mark>；严格只收三类事件时，再加 Actions。**

目标：`yuukiLike/yuuki-box` 有新 Issue、新 PR 或 PR 合并时，Outlook 收到邮件。

## 先开原生通知

1. [Settings → Emails](https://github.com/settings/emails)：添加并验证 Outlook 地址。
2. [Settings → Notifications](https://github.com/settings/notifications)：Watching／Participating 启用 **Email**，默认通知邮箱选 Outlook。
3. 仓库 **Watch → Custom**：勾选 **Issues、Pull requests**。
4. 自己的操作也要提醒：启用 **Your own updates**。

原生 PR 更新包含合并，也会有评论、评审；没有「仅合并」开关。[官方设置](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)

## 路线图

| 顺序 | 做什么 | 怎么验收 |
| --- | --- | --- |
| 1 | 开 GitHub 原生通知 | 新建 Issue、新建 PR、合并 PR，核对三类提醒及垃圾箱 |
| 2 | Outlook 建归档规则 | GitHub 邮件进入指定文件夹 |
| 3 · 按需 | Actions 精确筛选 | 只发下表三类事件；关闭未合并 PR 不发信 |

## 必须精确筛选时

切换时关闭对应的原生邮件通知，避免重复或额外邮件。

| 事件 | Actions 条件 |
| --- | --- |
| 新 Issue | `issues: opened` |
| 新 PR | `pull_request_target: opened` |
| PR 合并 | `pull_request_target: closed`，且 `github.event.pull_request.merged == true` |

只读事件，不运行 PR 代码；发信仍需 SMTP／邮件 API，`GITHUB_TOKEN` 不能通用发信。机器人 PR 另测触发链。 [官方事件说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)

多平台接入再考虑[转发器](07-automation-options.md#如果自制一个转发器)。只接收 GitHub 邮件，无需 AI key 或 Outlook API。

资料核对：2026-11-01。本页是配置路线，尚未修改通知设置或验证实际收信。
