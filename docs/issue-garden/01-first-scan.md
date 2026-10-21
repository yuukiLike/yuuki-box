# 🍀 先替我看一眼 Issue

**今天只做一件事：让 GitHub Actions 读取 Issue，在运行摘要里显示出来。**

这一步用来理解“到时间就启动一个任务”。先拿到看得见的结果，再连接 AI。

## 1. 在练习仓库放一份工作流

选一个你有管理权限、已经启用 Issues 与 Actions 的练习仓库，先写一个小 Issue。

在该仓库创建 `.github/workflows/issue-scan.yml`，复制下面的内容，提交到默认分支：

```yaml
name: 🍀 看一眼 Issue

on:
  workflow_dispatch:
  schedule:
    - cron: '15 18 * * *'

permissions:
  issues: read

jobs:
  scan:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    env:
      GH_TOKEN: ${{ github.token }}
      GH_REPO: ${{ github.repository }}
    steps:
      - name: 读取全部未关闭的 Issue
        shell: bash
        run: |
          gh api --paginate "repos/$GH_REPO/issues?state=open&per_page=100" \
            --jq '.[] | select(has("pull_request") | not) | {number, title, url: .html_url}' \
            > issues.jsonl

          {
            echo '## 🍀 今天的 Issue'
            echo
            echo "共 $(jq -s 'length' issues.jsonl) 个未关闭的 Issue。"
            echo
            echo '```json'
            cat issues.jsonl
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"
```

这里的文件内容是教学示例，需要你放入练习仓库后才会生效。

## 2. 先手动运行一次

进入 GitHub 仓库的 **Actions → 🍀 看一眼 Issue → Run workflow**，选择默认分支并运行。结束后打开这次运行的摘要，能看见 Issue 的编号、标题和链接就完成了。

如果没有 Issue，会显示 `0`；这是正常结果。[手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

## 3. 再看懂几行关键配置

| 配置 | 在这个实验里的含义 |
| --- | --- |
| `workflow_dispatch` | 允许你先手动点击运行 |
| `schedule` | 之后按时间自动运行 |
| `runs-on: ubuntu-latest` | 使用 GitHub 提供的 Linux 执行环境 |
| `issues: read` | 本次任务只需要读取 Issue |
| `--paginate` | 继续读取下一页，避免只拿到第一页 |
| `GITHUB_STEP_SUMMARY` | 把结果放进这次运行的摘要 |

仓库的 Issues API 也会返回 PR，所以示例过滤掉带 `pull_request` 字段的记录。`github.token` 是 GitHub 为工作流提供的令牌，传给 `GH_TOKEN` 后，GitHub CLI 才能以这次任务的权限访问仓库。[Issues API](https://docs.github.com/en/rest/issues/issues#list-repository-issues)、[GitHub CLI 分页](https://cli.github.com/manual/gh_api)、[工作流令牌](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

`15 18 * * *` 使用默认 UTC 时间，对应北京时间每天 **02:15**。自动触发需要工作流存在于默认分支；GitHub 的调度可能延迟，不能把它当作精确到分钟的闹钟。[定时触发规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## 遇到问题时只看这里

- **找不到 Run workflow**：确认文件已在默认分支，且包含 `workflow_dispatch`。
- **读取被拒绝**：确认目标是同一仓库、Issues 已开启、组织允许 Actions，且工作流声明了 `issues: read`。
- **没有按时出现记录**：先手动运行；再检查 Actions 是否启用以及默认分支上的定时配置。公开仓库长期没有活动时，计划任务可能自动停用。

**摘要里出现清单就可以收工。** 下一次再看[陪 AI 修一个小问题](02-first-repair.md)。

示例状态：已在本地检查 YAML、Shell 语法与固定数据的过滤逻辑；尚未提交到远端运行。
