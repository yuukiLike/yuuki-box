# AI 开发工作流：复现、验证与验收

交付修复前后对照，减少重复操作与验收。

**AI 先复现，<mark class="key">修复后按原步骤检查</mark>，再列人工体验项。** 沿用已有自动检查与反馈记录。

分析：2026-10-22，目标为减少验收与返工。依据项目约定、测试和历史记录；未重跑项目、无完整耗时统计，建议仍需实测。

<div class="heading-alias" id="我看到的工作方式" aria-hidden="true"></div>

## 现有工作流程

```text
维护者定义目标或体验问题 → AI 实现、自动检查与部分交互验收
                      → 维护者验收实际体验 → AI 根据反馈继续修正
```

| 已有证据 | 分析依据 |
| --- | --- |
| `for-job` 的 2026-10-15 QA 记录：307 项单测等基线检查通过，随后真实浏览器检查仍发现并修复了 5 处可见问题 | 标题、控件、定位与焦点仍须实际交互检查 |
| `web-translate` 已有“完成后仍显示省略号”、旧状态初始化、新旧任务竞争的回归测试 | 沿用“反馈 → 测试复现 → 修复” |
| `music-eyes/human-todo.md` 约定 AI 负责复现、核对与修复，人工负责听感、实体设备等体验 | 沿用分工，避免重复自动检查 |

返工分为**原问题未修好、关联流程损坏、体验未达预期**。前两类先复现、回归和审查；体验固定条件对照，新需求另记。

<details>
<summary>本地材料</summary>

- `for-job/tests/qa/chrome-10-rounds-2026-10-15/README.md` 与 `round-10/report.md`：历史验收、修复和实际导出记录。
- `web-translate/AGENTS.md` 与 `test/unit/background-status.test.mjs`：当前验证限制与回归用例；结合 2026-10-21 的修复记录核对过程。
- `music-eyes/AGENTS.md`、`todo.md`、`human-todo.md`：状态与布局要求、当前任务、人机验收分工。
- `algorithm-box/AGENTS.md` 与 `agent.md`：练习保留自主实现，以及浏览器验证边界。

路径相对各项目根目录，核对于 2026-10-22；约定与历史执行记录分别使用。

</details>

<div class="heading-alias" id="五项已落地实践怎样用在你这里" aria-hidden="true"></div>

## 五项实践与适用条件

证据标准见[实践目录](README.md)；以下用法尚未做对照评估。

| 顺序 | 实践 | 改进目标 | 开始条件 |
| --- | --- | --- | --- |
| **先试** | AI 先写能复现问题的测试，再修复 | “代码改了，原问题还在”导致的返工 | 下一次边界清楚的 bug |
| **按需配合** | AI 操作实际界面，保留步骤与结果 | 重新打开、定位、重复操作 | 项目允许，且改动涉及真实交互 |
| 后续 | 独立 AI 审查改动及关联影响 | 减少遗漏关联影响后依赖人工发现的问题 | 一份范围小的 PR 或本地 diff |
| 后续 | 用已知错误检验测试是否有效 | 避免通过测试仍遗漏同类错误 | 重要或反复出错的行为 |
| 随流程固定 | 用脚本执行固定检查，让 AI 处理失败 | 检查遗漏和无收益的重复运行 | 已经有稳定检查命令 |

<details>
<summary>1. AI 先写测试，再修复：Anthropic 的内部开发实践</summary>

**团队自述：** Anthropic 安全团队先用伪代码，再用测试驱动实现。 [官方报告，第 7 页](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf#page=7)

**用法：** 提取条件、操作、预期，先复现再修复；如翻译扩展分别查完成角标、延后提示和残留旧状态。

**边界：** 缺复现条件先定位；听感、审美与新交互先固定示例，主观部分人工判断。

</details>

<details>
<summary>2. AI 跑实际界面并留下演示：Faire 的开发与设计协作</summary>

**供应商案例：** Cursor 2026-05-26 的 Faire 案例记录 Agent 跑 Playground、生成组件、录视频交设计师审阅。 [Faire 案例](https://cursor.com/blog/faire)

**用法：** 简历编辑交新增、编辑、删除与焦点证据；音乐布局用同一视口、内容、操作对照。截图／视频附版本与步骤。

**边界：** 状态切换须操作，截图不够；iPad 手感、云盘和音色人工验。项目允许时再用 Computer Use。 [功能文档](https://learn.chatgpt.com/docs/browser)

</details>

<details>
<summary>3. 独立审查关联影响：CodeRabbit 与 Cresta</summary>

**供应商案例：** Cresta 使用 AI review，曾发现递归渲染无响应。 [Cresta 案例](https://www.coderabbit.ai/case-studies/how-cresta-brings-consistent-review-to-ai-generated-code-with-coderabbit)

**用法：** 沿状态、调用方、存储和恢复查 diff；意见须给触发条件、代码与验证方法，实现 AI 先核实，产品取舍再交人。

**边界：** 独立审查仍可能遗漏；误报成本高就收窄或停止。入门见 [CodeRabbit](01-coderabbit-review.md)。

</details>

<details>
<summary>4. 检查测试能否发现错误：Meta 的 ACH 实践</summary>

**部署记录：** Meta 2025-09-30 介绍 ACH，用错误变体检验生成测试；2024-10—12 曾用于旗下隐私测试。 [Meta 工程文章](https://engineering.fb.com/2025/09/30/security/llms-are-the-key-to-mutation-testing-and-better-compliance/)

**用法：** 对重要或反复出错行为，先测试通过，再临时恢复已知错误确认失败，最后还原。

**边界：** 特定语言、隐私场景结论需另验，低风险文字／样式无需此步。参见 [TestGen-LLM](05-test-generation.md)。

</details>

<details>
<summary>5. 固定检查步骤和反馈范围：Stripe 的 Minions</summary>

**团队记录：** Stripe 2026-02-19 介绍 Minions：模型实现、程序执行固定检查，CI 返修有上限，再交人审阅。 [Stripe 工程文章](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)

**用法：** 复用命令、按影响选检查；通过且无新疑点就停止重复。保存具体失败，稳定重复流程再脚本化。

**边界：** 资源限制沿用各仓库规则，界面、音频与设备另验；不照搬 Stripe 的两轮 CI 上限。

</details>

## 各项目怎样落地

| 项目 | AI 检查范围 | 人工验收范围 |
| --- | --- | --- |
| `web-translate` | 状态、初始化与竞争条件的专项测试；明确本次版本和必要的扩展重载步骤 | 自动检查没有覆盖的实际使用反馈；沿用默认禁止浏览器验证的规则 |
| `for-job` | 受影响操作、焦点、布局与相关导出文件；保存能对应当前版本的证据 | 内容和版式是否符合用途，以及记录中尚未覆盖的真实环境。按改动选用例，历史十轮不作为默认要求 |
| `music-eyes` | 状态与布局检查、可测量的音频行为、固定条件的试听对照材料 | 音色、演奏体验、实体设备与云盘实际使用；沿用暂缓安排，用户参与时再验收 |
| `algorithm-box` | 工具、示例和已授权改动的验证；保留学习练习的失败基线 | 练习者自主实现与理解，不能以代做练习换取测试通过 |

证据放回已有测试、任务或产物目录，如 `.artifacts/screenshots/`、QA 目录；不重复维护报告。

<div class="heading-alias" id="下一次只试一件事" aria-hidden="true"></div>

## 单任务验证

选下一个**能稳定复现的小 bug**，交付以下五项；无需安装新服务。

```text
原问题：触发条件、操作、实际结果、预期结果。
复现：修复前哪条用例失败；若未复现，缺口是什么。
修复后：代码版本与本次改动、环境、同一用例的结果及证据位置。
关联影响：本次改动可能碰到什么，实际检查了哪些。
需要你判断：只列自动检查尚不能回答的具体体验问题；没有就写无。
```

AI 先用上下文补齐；只追问会改变复现或预期的缺失条件，不让用户代写测试报告。

**同条件下原问题消失、相关检查完成、人工体验项列明即可。** 先观察一次，再记录三次相近任务的验收、返工和维护成本；新需求另记。

先做好复现和交付证据，后续按需接 CodeRabbit、[Issue 到 PR](02-issue-to-pr.md)或[故障诊断](03-error-to-fix.md)。

返回[已有实践目录](README.md)或[Issue 完整方案](../issue-garden/README.md#review)。
