# AI 开发案例

先完成一个小 Issue，再加入审查与回归；故障诊断、安全修复和迁移按需进阶。每篇含案例与练习。

验收与返工见[开发工作流](your-workflow.md)，自动流程见[Issue 自动化](../issue-garden/README.md)，Agent 实现见[工程实验](../agent-engineering/README.md)。

需要真实代码练习，打开[GitHub 实验员](../ai-from-scaling/06-github-lab-mcp.md)，复现已修复 bug，再对照候选与官方补丁。

“已落地”指<mark class="caution">公开 PR、团队记录或部署论文</mark>；本仓库仅提供材料，未配置对应自动化。

资料核对：2026-10-22。案例不限于近期发布，具体时间在各篇标明。

## 从复现与修复开始，或核实一次 PR 审查

首次按[Issue 到 PR](02-issue-to-pr.md)定义一个小问题；已有 PR 可先核实一条 [CodeRabbit 审查意见](01-coderabbit-review.md)，无需安装服务。

再用[已知错误回归](05-test-generation.md)确认测试有效；需要完整操作流程时查[单任务验证](your-workflow.md#下一次只试一件事)。故障诊断、安全修复和版本迁移按需进阶。

实跑时记录任务、版本、检查与判断，再观察误报、返工和验收耗时。

## 接任务、追故障、做迁移

小 Issue 为起步；根因不明的线上故障与版本迁移按需进阶。

| 场景 | 案例与入口 | 已有公开记录 |
| --- | --- | --- |
| 复现与预期明确的小问题 | [Issue 到 PR](02-issue-to-pr.md) | GitHub 团队：测试、审查后部署 |
| 反复发生但根因未明的错误 | [故障诊断与修复](03-error-to-fix.md) | 开发者：Seer 与 Cursor 生成并合并 PR |
| 目标版本明确的迁移 | [限定范围的代码迁移](06-code-migration.md) | AWS 报告了生产 Java 应用的批量迁移 |

## 审 PR、补测试、修漏洞

把审查意见落到具体代码与运行结果。

| 场景 | 案例与入口 | 已有公开记录 |
| --- | --- | --- |
| 待独立审查的 PR | [CodeRabbit 审查](01-coderabbit-review.md) | Nuxt PR 与 Cresta 团队记录 |
| 需要验证有效性的测试 | [生成与验证测试](05-test-generation.md) | Meta 论文：部署与工程师采纳 |
| 待修复的安全告警 | [CodeQL × Autofix](04-security-autofix.md) | GitHub：PR 告警修复数据 |

各篇保留原始来源与证据类型。

## 把 Issue、修复、测试与审查串成工作流

[Issue 自动化完整方案](../issue-garden/README.md#workflow)集中说明组合流程，本专题保留公开案例。

可以把几项实践接成一条流程：

```text
Issue 或错误记录 → AI 提出改动 → 测试与扫描 → AI 审查 → 人验收
```

组合流程仍待本项目验证，单环节案例不能替代整体验收。
