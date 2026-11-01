# 第一班：让 Issue 自己来报到

**先手动运行，取得一份 <mark class="key">Actions 运行摘要</mark>；不需要 AI Key。**

跑通后再改为定时启动。

## 1. 在练习仓库放一份工作流

选择有管理权限、已启用 Issues 与 Actions 的练习仓库，先建一个 Issue。

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

示例提交到练习仓库后生效。

## 2. 先手动运行一次

在 **Actions → 🍀 看一眼 Issue → Run workflow** 运行默认分支；摘要应显示 Issue 编号、标题与链接。

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

Issues API 也返回 PR，需过滤 `pull_request`。`github.token` 通过 `GH_TOKEN` 提供本次工作流权限。 [Issues API](https://docs.github.com/en/rest/issues/issues#list-repository-issues)、[GitHub CLI 分页](https://cli.github.com/manual/gh_api)、[工作流令牌](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

`15 18 * * *` 是 UTC，对应北京时间每天 **02:15**；工作流须在默认分支，调度可能延迟。 [定时触发规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## 遇到问题

<details class="qa">
<summary>找不到 Run workflow？</summary>

确认文件在默认分支，且包含 `workflow_dispatch`。

</details>

<details class="qa">
<summary>读取 Issue 被拒绝？</summary>

确认目标是同一仓库、Issues 与 Actions 已启用，且组织允许运行、工作流声明了 `issues: read`。

</details>

<details class="qa">
<summary>定时任务没出现？</summary>

先手动运行，再查默认分支的定时配置。调度可能延迟；公开仓库长期不活跃时，计划任务可能停用。

</details>

新增练习 Issue 后重跑，核对清单变化；无 Issue 时应显示 `0`。

**摘要出现清单即可停止。** 下一次再来[搭手修一个小问题](02-first-repair.md)。

示例状态：已在本地检查 YAML、Shell 语法与固定数据的过滤逻辑；尚未提交到远端运行。
