# 🍀 把流程交给夜班

前两篇分别练习了“GitHub 能启动任务”和“AI 能修一个问题”。现在把它们连接起来。

**这一篇先读懂分工就够了。完整自动化需要在选定的仓库里接好扫描、验证与 PR 发布。**

## 一次只领一个 Issue

每天扫描所有未关闭 Issue，然后按明确规则选一个：

```text
未关闭 + 你添加了 ai-ready
  → 检查是否已有进行中的任务或待验收 PR
  → 选择一个问题
  → 记录任务归属和本次默认分支的提交 SHA
  → 准备依赖，调用 AI，运行检查
  → 保存改动和检查结果
  → 创建草稿 PR，关联原 Issue
```

扫描沿用[第一篇](01-first-scan.md)的分页读取方式。任务选择、去重和时间限制由工作流或脚本负责，别只把这些条件写进给 AI 的自然语言指令。

## 把手动修复接到 Actions

云端运行时，可以使用 OpenAI 官方的 `openai/codex-action@v1`。先在练习仓库的 Actions secrets 中配置 `OPENAI_API_KEY`，再准备项目依赖和任务输入。[OpenAI Docs：Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)

下面是 **AI 执行步骤的片段**，用于已经检出仓库、准备好依赖的 job：

```yaml
- name: 修复当前选择的 Issue
  uses: openai/codex-action@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    sandbox: workspace-write
    prompt-file: .github/codex/fix-issue.md
```

`.github/codex/fix-issue.md` 可以从[第二篇的任务指令](02-first-repair.md)开始：说明只处理当前选中的一个问题、必须运行哪些检查，以及缺少条件时怎样报告。

先由扫描步骤把选中的 Issue 保存成 JSON 文件，再让指令引用这个文件。Issue 正文作为资料读取；避免把它直接插进 shell 命令。凭据只在需要它的步骤提供。[GitHub：防止脚本注入](https://docs.github.com/en/actions/reference/security/secure-use#use-an-intermediate-environment-variable)

这个片段只负责执行 AI。自动筛选、保存补丁、独立验证和创建 PR 仍需要显式连接。可以从官方的“生成补丁 → 另一个 job 发布 PR”示例继续搭建。[OpenAI Docs：自动修复示例](https://learn.chatgpt.com/docs/non-interactive-mode#example-autofix-ci-failures-in-github-actions)

## 把修改与发布分开

| 阶段 | 做什么 | 需要的权限与输入 |
| --- | --- | --- |
| 扫描与选择 | 读取 Issue、检查已有 PR，确定本次任务 | Issue / PR 只读，固定的选择规则 |
| 生成修改 | 检出记录的提交、准备依赖、调用 Codex | 仓库只读令牌、AI 凭据、本地工作区写权限 |
| 验证 | 对修改后的代码运行相关检查 | 同一基线与补丁、项目规定的验证环境 |
| 发布 | 在干净 checkout 应用补丁，推送分支，创建草稿 PR | 仓库与 PR 写权限、检查结果 |

发布任务不执行补丁中的脚本。PR 里带上 Issue 编号、基线 SHA、验证结果和待验收项，让你第二天能判断实际完成了什么。

仓库还需要允许 Actions 创建 PR；组织策略也可能限制这项能力。[GitHub Actions 仓库设置](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

## 时间段需要两道判断

假设只允许北京时间 **02:15—04:00** 工作：

1. 用 `schedule` 请求每天 02:15 启动；这一步可能延迟。
2. 任务实际启动时检查当前时间，过了 04:00 就跳过；仍在窗口内时，把剩余时间作为整个执行流程的截止限制。

`timeout-minutes: 30` 只限制一个 job 从启动起最多运行 30 分钟。它不会自动知道“每天 04:00 收工”，多个 job 的时长也要共同考虑。[定时调度](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[任务超时](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)

## 首版规则可以很少

| 情况 | 建议行为 |
| --- | --- |
| 没有可处理的 Issue | 写一条运行摘要，正常结束 |
| 上一次还没结束 | 用仓库内固定的 concurrency group 避免重叠执行 |
| 已经有待验收 PR | 跳过同一个 Issue，等待你处理 |
| 复现不了、测试失败、超过截止时间 | 留下运行记录，Issue 保持未解决，等待补充条件 |
| AI 凭据无效或额度不足 | 停止并记录原因 |
| 检查通过且确实有修改 | 创建一个关联 Issue 的草稿 PR |

并发组只能约束正在执行的工作流，跨天去重还要查询任务状态与关联 PR。[GitHub 并发控制](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

建议第一版每晚最多尝试一个 Issue，设置运行时长，并在模型服务侧配置可用的预算限制或告警。超时限制与费用上限需要分别处理。

## 怎样判断夜班已经跑通

选一个可复现的小问题，手动触发完整工作流。确认它只产生一个相关草稿 PR，PR 中能看见检查结果；再触发一次，确认会跳过已有任务。随后检查无任务、验证失败和超出时间段这几条路径，最后才打开定时触发。

**你第二天能看懂它做了什么，就是这套流程最有用的交付。** 实际启用前仍需要为目标仓库实现并验证上述连接；本教程没有在当前仓库部署自动修复。
