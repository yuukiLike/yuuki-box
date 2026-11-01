# AI 开发实践：Issue 修复、故障定位、PR 审查、测试、安全与迁移

按任务选：修 Issue、追故障、审 PR、补测试、修漏洞或迁移；每篇含案例与练习。

验收与返工见[开发工作流](your-workflow.md)，自动流程见[Issue 自动化](../issue-garden/README.md)，Agent 实现见[工程实验](../agent-engineering/README.md)。

需要真实代码练习，打开[GitHub 实验员](../ai-from-scaling/06-github-lab-mcp.md)，复现已修复 bug，再对照候选与官方补丁。

“已落地”指<mark class="caution">公开 PR、团队记录或部署论文</mark>；本仓库仅提供材料，未配置对应自动化。

资料核对：2026-10-22。案例不限于近期发布，具体时间在各篇标明。

## 接任务、追故障、做迁移

选一项范围明确、能验收结果的任务。

| 场景 | 实践与入口 | 已有公开记录 |
| --- | --- | --- |
| 复现与预期明确的小问题 | [Issue 到 PR](02-issue-to-pr.md) | GitHub 团队：测试、审查后部署 |
| 反复发生但根因未明的错误 | [故障诊断与修复](03-error-to-fix.md) | 开发者：Seer 与 Cursor 生成并合并 PR |
| 目标版本明确的迁移 | [限定范围的代码迁移](06-code-migration.md) | AWS 报告了生产 Java 应用的批量迁移 |

## 审 PR、补测试、修漏洞

把审查意见落到具体代码与运行结果。

| 场景 | 实践与入口 | 已有公开记录 |
| --- | --- | --- |
| 待独立审查的 PR | [CodeRabbit 审查](01-coderabbit-review.md) | Nuxt PR 与 Cresta 团队记录 |
| 需要验证有效性的测试 | [生成与验证测试](05-test-generation.md) | Meta 论文：部署与工程师采纳 |
| 待修复的安全告警 | [CodeQL × Autofix](04-security-autofix.md) | GitHub：PR 告警修复数据 |

各篇保留原始来源与证据类型。

## 把 Issue、修复、测试与审查串成工作流

[构想地图](../ai-ideas/01-ideas-map.md)记录组合方式，本专题补充已有案例。

可以把几项实践接成一条流程：

```text
Issue 或错误记录 → AI 提出改动 → 测试与扫描 → AI 审查 → 人验收
```

组合流程仍待本项目验证，单环节案例不能替代整体验收。

## 从复现与修复开始，或核实一次 PR 审查

有 bug，按[小实验](your-workflow.md#下一次只试一件事)对照修复前后；无任务，读 [CodeRabbit](01-coderabbit-review.md)并核实一条意见，无需安装服务。

实跑时记录任务、版本、检查与判断，再观察误报、返工和验收耗时。
