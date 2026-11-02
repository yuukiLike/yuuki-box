# 3 · 定时 Issue 处理流程

定时领取一个 Issue，修改、检查，再交回可验收的草稿 PR。

**把人工判断变成交接规则。** 扫描、验证与发布仍需在目标仓库连接。

本篇用 Actions + 模型 API。已有 Dot 与产品额度时，走[用 Dot 接手 GitHub 开发任务](04-dot-shift.md)。

API 执行使用[Codex Action](05-codex-api.md)或 [Agentic Workflows](06-agentic-workflows.md)；本篇补充调度、去重与失败处理。并行对照须固定[共同基线](../codex-cloud/05-issue-to-pr.md)。

## 一次只领一个 Issue

每天扫描所有未关闭 Issue，然后按明确规则选一个：

```text
未关闭 + ai-ready + 已批准的任务内容
  → 检查是否已有进行中的任务或待验收 PR
  → 选择一个问题
  → 记录任务归属和本次默认分支的提交 SHA
  → 准备依赖，调用 AI，运行检查
  → 保存改动和检查结果
  → 创建草稿 PR，关联原 Issue
```

沿用[第一篇](01-first-scan.md)分页读取；<mark class="caution">选择、去重和时限由程序执行</mark>。

## 什么样的 Issue 可以接单

公开仓库开放 Issues 时，外部用户通常也能提交问题。先分别判断三件事：[GitHub 创建权限](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue)

1. **问题成立**：属于本项目；Bug 有复现线索、实际与预期结果；功能请求说明使用场景。缺信息时补充，重复问题关联原任务。
2. **适合自动处理**：范围清楚，有验收条件，没有其他任务或 PR 正在处理。产品取舍先讨论，大需求先拆分。
3. **获得执行授权**：指定维护者批准具体任务内容与代码基线。`ai-ready` 用于筛选，不能单独代表这些内容已被批准。

本组 API 示例由有写权限的维护者手动启动，以工作流输入中的任务摘要绑定批准内容。改成标签或评论触发前，需要程序核对实际授权者；仅检查 Issue 作者、`author_association` 或标签存在都不充分。GitHub 的 triage 权限也能加标签，模板与初筛机器人不得自动授予执行授权。[手动运行权限](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[标签权限](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)

## 批准固定的任务内容

先把 `OWNER/REPO` 和编号换成目标值，读取并检查同一份快照：

```bash
ISSUE_REVIEW=$(mktemp)
export ISSUE_REVIEW
gh api repos/OWNER/REPO/issues/123 > "$ISSUE_REVIEW"
python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
issue = json.loads(Path(os.environ['ISSUE_REVIEW']).read_text())
task = {key: issue.get(key) or '' for key in ('title', 'body')}
encoded = json.dumps(task, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
print(json.dumps(task, ensure_ascii=False, indent=2))
print('approved_issue_sha256=' + hashlib.sha256(encoded).hexdigest())
PY
```

核对输出的标题、完整正文和隐藏注释，再将摘要填入手动运行的 `approved_issue_sha256`。摘要只证明内容一致，维护者的手动启动才表达本次授权；不要让自动化从实时 Issue 自行生成“批准摘要”。

示例只批准标题与正文，不把后续评论、链接页面作为新增指令。执行前重新检查状态、路线标签和摘要；内容不符就停止。正在运行时撤销任务，需取消对应 Actions run；取消不会撤销已发布的 PR。持续自动化还应把批准者、仓库、Issue 编号、摘要、代码基线与运行记录保存在受信任的状态中。

## 安全检查分三层

**配置审阅**：追踪外部输入到模型、shell、测试和发布的路径，核对触发者、每个 job 的令牌权限、网络与输出范围。Action 固定到可核对的提交，CLI 和编译器也记录版本；审阅实际 `.lock.yml` 和依赖锁。提示词属于行为要求，权限与发布条件需要程序执行。

**本地反例**：在临时仓库运行教程中的实际检查脚本，验证缺少标签、已关闭、误传 PR、批准后改写正文、越界文件和符号链接会被拒绝。再让允许修改的测试在运行时改写 `package.json`，检查它能否污染其他验证。

2026-11-02 的本地审查复现了两个缺口：旧脚本接受已改写的正文；旧串行验证会被测试改写后续命令，原本失败的 lint、类型检查与构建全部返回成功。本次修订增加任务摘要，并让 API 路线的每项检查从同一产物开始、各用一个新 runner。测试文件仍可能删减断言，单项检查也可能被代码欺骗，因此最终 PR 仍需独立审阅。

运行本地回归：

```bash
python3 docs/issue-garden/labs/check-workflows.py
```

**隔离运行验收**：在无生产权限的临时仓库使用假密钥标记，逐项观察凭据是否可读、数据能否出网、产物被替换或删除是否停止、验证失败是否阻止发布、重复触发与取消是否符合预期。检查日志和 artifact，记录运行链接、产物 ID、补丁摘要、base/head SHA。`issues`、`issue_comment` 不能套用 fork PR 的默认凭据隔离假设。[GitHub runner 风险](https://docs.github.com/en/actions/concepts/security/compromised-runners)

当前证据只覆盖本地反例与配置审阅；没有用真实 API key 启动远端修复，也没有完成网络、凭据和发布的隔离运行验收。完成这些验证前，示例保持手动实验用途。

## 把手动修复接到 Actions

使用官方 `openai/codex-action@v1`；先配置 Actions secret `OPENAI_API_KEY`、依赖与任务输入。 [OpenAI Docs：Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)

下面是 **AI 执行步骤的片段**，用于已经检出仓库、准备好依赖的 job；`CODEX_VERSION` 按[完整示例](05-codex-api.md#配置-api-与仓库)配置为固定版本：

```yaml
- name: 修复当前选择的 Issue
  uses: openai/codex-action@bdf19a4a223ec2549a3e2274a0cf61556bc07675 # v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    codex-version: ${{ vars.CODEX_VERSION }}
    sandbox: workspace-write
    prompt-file: .github/codex/fix-issue.md
```

`.github/codex/fix-issue.md` 可以从[第二篇的任务指令](02-first-repair.md)开始：说明只处理当前选中的一个问题、必须运行哪些检查，以及缺少条件时怎样报告。

将 Issue 保存为 JSON，让指令引用；不直接拼进 shell。凭据仅传给需要的步骤。 [GitHub：防止脚本注入](https://docs.github.com/en/actions/reference/security/secure-use#use-an-intermediate-environment-variable)

片段只执行 AI；筛选、补丁、独立验证与 PR 发布按官方模式另接。 [OpenAI Docs：自动修复示例](https://learn.chatgpt.com/docs/non-interactive-mode#example-autofix-ci-failures-in-github-actions)

## 把修改与发布分开

| 阶段 | 做什么 | 需要的权限与输入 |
| --- | --- | --- |
| 扫描与选择 | 读取 Issue、检查已有 PR，确定本次任务 | Issue / PR 只读，固定的选择规则 |
| 生成修改 | 检出记录的提交、准备依赖、调用 Codex | 仓库只读令牌、AI 凭据、本地工作区写权限 |
| 验证 | 对修改后的代码运行相关检查 | 同一基线与补丁、项目规定的验证环境 |
| 发布 | 在干净 checkout 应用补丁，推送分支，创建草稿 PR | 仓库与 PR 写权限、检查结果 |

发布任务不执行补丁脚本；PR 保留 Issue、基线 SHA、检查与待验项。

仓库还需要允许 Actions 创建 PR；组织策略也可能限制这项能力。[GitHub Actions 仓库设置](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

[![计划启动时间可能延迟，全流程截止时间需要根据实际开始时间另行检查](../../site/public/diagrams/issue-garden/time-budget.svg)](../../site/public/diagrams/issue-garden/time-budget.svg)

## 时间段需要两道判断

假设只允许北京时间 **02:15—04:00** 工作：

1. 用 `schedule` 请求每天 02:15 启动；这一步可能延迟。
2. 任务实际启动时检查当前时间，过了 04:00 就跳过；仍在窗口内时，把剩余时间作为整个执行流程的截止限制。

`timeout-minutes: 30` 只限单个 job 的运行时长；固定收工时间与多 job 总时长另算。 [定时调度](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[任务超时](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)

<div class="heading-alias" id="首版规则可以很少" aria-hidden="true"></div>

## 首版执行规则

| 情况 | 建议行为 |
| --- | --- |
| 没有可处理的 Issue | 写一条运行摘要，正常结束 |
| 上一次还没结束 | 用仓库内固定的 concurrency group 避免重叠执行 |
| 已经有待验收 PR | 跳过同一个 Issue，等待人工验收 |
| 复现不了、测试失败、超过截止时间 | 留下运行记录，Issue 保持未解决，等待补充条件 |
| AI 凭据无效或额度不足 | 停止并记录原因 |
| 检查通过且确实有修改 | 创建一个关联 Issue 的草稿 PR |

concurrency 只限当前运行；跨天去重仍需查状态和关联 PR。 [GitHub 并发控制](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

首版每晚最多尝试一个 Issue；运行时限与费用控制分别设置。

<div class="heading-alias" id="正式上夜班前排练一次交接" aria-hidden="true"></div>

## 启用定时前的验证

手动跑一个可复现问题，核对唯一草稿 PR 与检查证据；重跑应跳过已有任务。再验无任务、检查失败、超时，最后启用定时。

只读 PR 与摘要，应能找出任务、改动、检查和下一步；缺项回到对应阶段补齐。

**交付须列明实际完成项。** 上述连接仍待目标仓库实现；本仓库未部署自动修复。
