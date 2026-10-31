# 云端 Codex 与 Issue 到 PR 的并行实验

**把三个项目的云端练习接到 Issue 工作流：领取一个明确任务，完成实现与检查，再交回带证据的 PR。** 可以同时试三条路线，比较实际交付、返修和费用；第一轮各自产出草稿 PR，比较结束后再选一份整合。

| 路线 | 谁协调与执行 | 使用哪种额度 | 跟做入口 |
| --- | --- | --- | --- |
| A · Dot 与 Cloud | Dot 跟进 Issue，委派到已发布的 Codex Cloud 环境 | Dot / Codex 产品权限与用量 | [Dot 配置与任务指令](../issue-garden/04-dot-shift.md) |
| B · Codex Action 与 API | GitHub Actions 执行固定步骤，官方 Action 运行 Codex | OpenAI API 配额，另计 Actions 用量 | [一次 Issue 到草稿 PR](../issue-garden/05-codex-api.md) |
| C · Agentic Workflows 与 API | Markdown 工作流编译成 Actions，Codex 提议修改，safe outputs 发布 PR | OpenAI API 配额，另计 Actions 用量 | [编译并运行工作流](../issue-garden/06-agentic-workflows.md) |

A 使用你创建的 Cloud 环境；B / C 在 GitHub runner 中运行，不复用那个已发布环境。Dot 能创建云端编码任务并发送后续指令；官方 Codex Action 和 Agentic Workflows 则提供另一套执行入口。[OpenAI Docs 的 Dot 委派](https://learn.chatgpt.com/docs/dots/tasks-and-memory#assigned-work)、[Codex Action](https://learn.chatgpt.com/docs/github-action)、[Agentic Workflows 的 Codex 接入](https://github.github.com/gh-aw/engines/codex/)

资料核对于 **2026-10-31**。这是一组待实跑的教程；本仓库没有因此启用收费任务、定时工作流或自动合并。首次运行请分别记录实际成功与缺口。

## 先准备一份共同任务

第一轮建议用 `for-job` 的文档格式或备份校验小问题。它有可移植的单测，容易观察修复是否成立。先完成[项目基线](03-for-job.md)，再选择能在当前提交稳定复现、预期清楚的问题。已有用例已经覆盖且通过时，换一个真实任务，避免为产生 PR 而修改代码。

三条路线采用相同的任务正文、允许修改范围和验收条件。B / C 的首轮示例只允许修改：

```text
features/resume-editor/application/resume-document-codec.ts
tests/unit/resume-document-codec.test.ts
```

若问题位于其他文件，先在受信任的工作流配置中调整范围，再开始实验。界面、账户、数据库迁移和设备权限问题留到后续切片。

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

先将实验配置放进目标仓库并推送，准备共同的 `experiment/base` 分支，记录完整 SHA。三个任务都从这个代码版本开始；分支名相同不等于代码版本相同，实际 checkout 的 SHA 才是比较依据。

| 路线 | 独立 Issue 标记 | 分支与执行位置 | 首轮停止点 |
| --- | --- | --- | --- |
| A | `ai-ready`、`ai-route-dot` | Cloud 中的独立任务与分支 | 草稿 PR 和任务链接 |
| B | `ai-ready`、`ai-route-api` | `experiment/api-issue-<编号>`，GitHub runner | 独立验证成功后创建草稿 PR |
| C | `ai-ready`、`ai-route-aw` | 由本工作流生成的独立分支，GitHub runner | safe output 创建草稿 PR，核对后续 CI |

为三条路线各建一份相同正文的 Issue，分别标记路线，三份 Issue 都记录同一个基线 SHA。协调者只领取自己的标记；不要让三个执行者同时维护同一个 Issue、PR 或分支。并行期间保持共同基线不变，记录各自产物；结果比较后只整合选中的补丁，关闭其他实验任务，避免重复合并。

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

Cloud 的新任务与已有任务各有自己的文件状态；不要靠对话记忆传递另一条路线的未提交代码。[OpenAI Docs 的环境状态规则](https://learn.chatgpt.com/docs/environments/cloud-environments#reuse-and-update-saved-state)

## OpenAI API 先确认费用来源

为 B / C 准备项目 API key，在目标仓库的 Actions secrets 中保存为 `OPENAI_API_KEY`，再配置模型变量 `CODEX_MODEL`。模型需要在该 API 项目中实际可用；按[当前 Codex 模型说明](https://learn.chatgpt.com/docs/models)与账号权限选择，不用聊天套餐中的模型名称替代 API 可用性检查。

**若你持有的是订阅赠送的 API credits，不能据此假定它能抵扣 B / C。** 官方福利覆盖普通 Responses、Agents、图片等 API 用量，但排除了通过 API key 使用 Codex。先在所选组织的 Billing / Usage 确认可用于 Codex 的普通 API 配额，再启动编码实验。[官方额度适用范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits#what-the-credits-cover)

也可以先用普通 **Responses API** 做一个辅助实验：将脱敏后的 Issue 发到 [Responses Playground](https://platform.openai.com/chat/)，让模型整理复现条件、未知项和验收清单，再把你确认的结果交给 A / B / C。这个实验不执行 Codex、不改代码、不创建 PR；它与完整编码路线分别记录，也不绕过 Codex 的计费规则。[API 额度与其他小实验](../agent-engineering/openai-api.md)

预算先按“每条路线一次任务、一次明确启动、限定运行时间”控制。两条 API 路线并行时，费用会叠加。项目预算告警、job 超时和 API 花费上限是不同机制；没有实现总费用控制器时，不把告警或超时称为硬性消费封顶。运行后记录 Usage 中能归属的实际用量；无法准确拆分到单次任务时保留该缺口，不编造金额。

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

先看是否修对，再比较运行和验收成本。人工澄清时间、环境准备时间和返修都要计入；只比较 Agent 最后一次输出耗时会漏掉这些成本。一次样本用于选择下一步，不作为三条路线的普遍优劣结论。

## 从一次交付走到持续自动化

单次 Issue 到 PR 跑通后，再逐项增加控制。B 的示例负责一次领取、修改、独立验证和发布；C 的示例负责一次受范围限制的修改与 PR 提议。它们都没有替你建立完整的持续返修与自动合并系统。

| 增加的环节 | 怎样实现和验收 |
| --- | --- |
| 自动领任务 | 定时或事件触发后分页读取本路线 Issue；记录归属、基线、任务和 PR。重复触发同一个任务，不能重复创建交付 |
| 独立审查 | 给审查者 Issue、最终 base/head SHA、diff 与检查结果；它只报告可核实的问题，不直接修改代码 |
| 有限返修 | 确认的问题交回原编码任务或同一 PR 分支；最多两轮，修改后对新 head 重新检查和审查，超限保存缺口 |
| 等待真机 | 转入明确的待验状态；收到与当前提交对应的 Mac 验收结果再继续。等待不等于失败，也不算验收通过 |
| 自动合并 | 为限定任务启用 GitHub auto-merge，满足必需检查、审查与分支规则后才合并；任何新提交都使旧证据需要重新核对 |

调度、领取去重、重试计数和合并条件应由保存状态的工作流或程序执行。写在提示词中的“不要重复”“最多两轮”只是 Agent 指令，不能替代这些控制。GitHub auto-merge 也不会跳过仓库的必需审批；要求人工批准时仍会等待。[GitHub 自动合并规则](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)

## 三个项目接在哪一段

| 项目 | 先放入自动流程 | 单独等待的证据 |
| --- | --- | --- |
| [for-job](03-for-job.md) | 文档格式、MCP 文件往返、备份恢复与相关导出回归 | 字体与视觉判断、iPhone / iCloud 真机链路 |
| [agent-symphony](04-agent-symphony.md) | 事件关联、去重、存储、HTTP 与浏览器回归 | 本机宿主接入、真实声音与听感 |
| [for-safe](01-for-safe.md) | 规格拆分、离线状态处理与样本回归 | Mac 权限、无线设备和休眠恢复 |

`agent-symphony` 目前是本地观察工作台。以后可以增加适配器，显示路线、Issue、任务、检查和 PR 的关联状态；本机 command hooks 不能直接当作云端完整事件源。先保留各平台实际提供的状态和链接，不补造看不到的内部执行。

GitHub PR 评论里的 `@codex` 非 review 任务目前启动 Legacy Cloud；它可以作为另外的入口实验，但不是 B / C 调用新版已发布环境的方式。[OpenAI Docs 的 GitHub 集成边界](https://learn.chatgpt.com/docs/third-party/github#give-codex-other-tasks)

**开始 API 路线：[用官方 Codex Action 交回第一份草稿 PR →](../issue-garden/05-codex-api.md)**，或直接试 [Agentic Workflows](../issue-garden/06-agentic-workflows.md)。
