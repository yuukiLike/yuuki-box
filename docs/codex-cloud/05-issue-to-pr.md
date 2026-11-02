# 选读：Issue 到 PR 的三路线并行实验

完整流程、审查与通知见[Issue 自动化完整方案](../issue-garden/README.md)。本篇只比较同一基线上的三条执行路线。

**同一任务比较三条路线的交付、返修与费用。** 首轮各交草稿 PR，比较后只整合一份。

| 路线 | 谁协调与执行 | 使用哪种额度 | 配置入口 |
| --- | --- | --- | --- |
| A · Dot 与 Cloud | Dot 跟进 Issue，委派到已发布的 Codex Cloud 环境 | Dot / Codex 产品权限与用量 | [Dot 配置与任务指令](../issue-garden/04-dot-shift.md) |
| B · Codex Action 与 API | GitHub Actions 执行固定步骤，官方 Action 运行 Codex | OpenAI API 配额，另计 Actions 用量 | [一次 Issue 到草稿 PR](../issue-garden/05-codex-api.md) |
| C · Agentic Workflows 与 API | Markdown 工作流编译成 Actions，Codex 提议修改，safe outputs 发布 PR | OpenAI API 配额，另计 Actions 用量 | [编译并运行工作流](../issue-garden/06-agentic-workflows.md) |

A 使用已发布 Cloud；B／C 使用 GitHub runner。三条路线的委派与执行入口不同。 [OpenAI Docs 的 Dot 委派](https://learn.chatgpt.com/docs/dots/tasks-and-memory#assigned-work)、[Codex Action](https://learn.chatgpt.com/docs/github-action)、[Agentic Workflows 的 Codex 接入](https://github.github.com/gh-aw/engines/codex/)

核对：**2026-10-31**。教程待实跑，未启用收费、定时或自动合并；逐项记录成功与缺口。

## 先准备一份共同任务

先做[for-job 基线](03-for-job.md)，选择能稳定复现的格式／备份问题；现有测试已通过时换真实任务。

三条路线采用相同的任务正文、允许修改范围和验收条件。B / C 的首轮示例只允许修改：

```text
features/resume-editor/application/resume-document-codec.ts
tests/unit/resume-document-codec.test.ts
```

范围变化先改受信任配置；界面、账户、迁移、设备问题留待后续。

```text
目标：修复一个可以稳定复现的简历备份或旧稿兼容问题。
复现：填写输入样本、操作或失败测试，以及当前实际结果。
预期：填写应保留的正文、版式或应拒绝的错误输入。
范围：列出允许修改的文件；说明需要保持的现有行为。
验收：同一输入修复前失败、修复后通过，相关回归仍通过。
基线：填写已推送的完整提交 SHA。
证据：虚构样本、检查命令和结果、最终 diff、未验证项。
```

## 并行运行时隔离任务与结果

推送配置，<mark class="key">固定 `experiment/base` 的完整 SHA</mark>；三任务核对同一实际提交。

| 路线 | 独立 Issue 标记 | 分支与执行位置 | 首轮停止点 |
| --- | --- | --- | --- |
| A | `ai-ready`、`ai-route-dot` | Cloud 中的独立任务与分支 | 草稿 PR 和任务链接 |
| B | `ai-ready`、`ai-route-api` | `experiment/api-issue-<编号>`，GitHub runner | 独立验证成功后创建草稿 PR |
| C | `ai-ready`、`ai-route-aw` | 由本工作流生成的独立分支，GitHub runner | safe output 创建草稿 PR，核对后续 CI |

各建同正文 Issue，标记路线和同一 SHA；各自维护分支与 PR，比较期间固定基线，最终只整合选中补丁。

交给 A 的补充指令：

```text
本次只处理 ai-route-dot 的指定 Issue。
使用指定的已发布环境，并核对仓库代码基线为我给出的完整 SHA。
若环境中的代码不同，先检出正确版本并验证，不假定发布环境一直最新。
与 API 路线使用相同的修改范围和验收条件。
保留自己的分支，只创建草稿 PR；不领取另两条路线的实验 Issue。
交付实际命令、结果、base/head SHA、任务与 PR 链接。
本轮不合并，不部署，不建立持续领取任务。
```

Cloud 各任务文件独立，不靠对话记忆传代码。 [OpenAI Docs 的环境状态规则](https://learn.chatgpt.com/docs/environments/cloud-environments#reuse-and-update-saved-state)

## OpenAI API 先确认费用来源

- Actions + Codex Action 按 API 项目计费，不扣 ChatGPT 订阅额度；Actions 用量另计。
- 订阅赠额排除通过 API key 使用 Codex；其他赠额看活动条款。[官方范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits#what-the-credits-cover)
- 在 GitHub Actions 配置 Secret `OPENAI_API_KEY`、Variable `CODEX_MODEL`；模型须在该 API 项目可用。
- 普通 Responses API 可用于 Issue 分析实验。[额度与实验](../agent-engineering/openai-api.md)
- 首轮只运行一次；预算告警、job 超时都不是硬性费用封顶。
- 详细操作：[配置 API 与仓库](../issue-garden/05-codex-api.md#配置-api-与仓库)。

## 用同一张表比较结果

| 记录项 | A · Dot / Cloud | B · Action / API | C · Agentic Workflows / API |
| --- | --- | --- | --- |
| 仓库与实际 base/head SHA | 待记录 | 待记录 | 待记录 |
| 模型、环境或工具版本 | 待记录 | 待记录 | 待记录 |
| Issue、执行记录与 PR 链接 | 待记录 | 待记录 | 待记录 |
| 首次交付与返修次数 | 待记录 | 待记录 | 待记录 |
| 原问题的修复前后证据 | 待记录 | 待记录 | 待记录 |
| 实际检查与最终提交对应关系 | 待记录 | 待记录 | 待记录 |
| API / 产品用量与 Actions 时间 | 待记录 | 待记录 | 待记录 |
| 人工介入、失败与待验项 | 待记录 | 待记录 | 待记录 |

先看正确性，再比较包含准备、澄清、返修的成本；单一样本不代表普遍优劣。

## 从一次交付走到持续自动化

先跑通单次交付，再加控制；B 有独立验证，C 提议受限 PR，两者均未建立持续返修与自动合并。

| 增加的环节 | 怎样实现和验收 |
| --- | --- |
| 自动领任务 | 分页领取本路线 Issue，记录归属、基线与 PR；重触发不重复交付 |
| 独立审查 | 交 Issue、base/head、diff、检查结果；审查者只报问题、不改代码 |
| 有限返修 | 原任务／PR 返修，最多两轮；新 head 重验重审，超限记缺口 |
| 等待真机 | 转待验状态；当前提交的 Mac 结果到达再继续，不记失败或通过 |
| 自动合并 | 限定任务启用 auto-merge，满足检查、审查与分支规则；新提交重核证据 |

去重、重试和合并由程序保存状态；提示词不能替代。auto-merge 仍遵守必需检查与审批。 [GitHub 自动合并规则](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)

## 三个项目接在哪一段

| 项目 | 先放入自动流程 | 单独等待的证据 |
| --- | --- | --- |
| [for-job](03-for-job.md) | 文档格式、MCP 文件往返、备份恢复与相关导出回归 | 字体与视觉判断、iPhone / iCloud 真机链路 |
| [agent-symphony](04-agent-symphony.md) | 事件关联、去重、存储、HTTP 与浏览器回归 | 本机宿主接入、真实声音与听感 |
| [for-safe](01-for-safe.md) | 规格拆分、离线状态处理与样本回归 | Mac 权限、无线设备和休眠恢复 |

`agent-symphony` 是本地观察工作台；可另做适配器关联任务与交付，但不把本机 hooks 当成云端完整事件源。

PR 中 `@codex` 非 review 任务当前启动 Legacy Cloud，不是 B／C 的新版环境入口。 [OpenAI Docs 的 GitHub 集成边界](https://learn.chatgpt.com/docs/third-party/github#give-codex-other-tasks)

**开始 API 路线：[用官方 Codex Action 交回第一份草稿 PR →](../issue-garden/05-codex-api.md)**，或直接试 [Agentic Workflows](../issue-garden/06-agentic-workflows.md)。
