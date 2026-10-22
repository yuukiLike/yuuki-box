# 🍀 已落地的 AI 开发实践

**想减少验收与返工，先看[你的工作流分析](your-workflow.md)；想了解仓库里的 `coderabbitai`，从 [CodeRabbit](01-coderabbit-review.md) 开始。** 其余案例按需要选读。

这里收录六种有真实使用记录的开发流程：CodeRabbit 审查 PR、从 Issue 到 PR、故障诊断、安全修复、测试增强和版本迁移。每篇都有案例来源、工作流程和一个小实验。

“已落地”表示能找到公开 PR、具体团队或使用者的实践记录，或描述实际部署的论文。这说明有人在真实工作中用过，效果仍取决于任务、代码和验收条件。本仓库目前保存资料与实验建议，尚未配置这些自动化流程。

资料核对：2026-10-22。案例不限于近期发布，具体时间在各篇标明。

## 六种实践，按问题挑一个

| 想解决的问题 | 实践与入口 | 落地证据 |
| --- | --- | --- |
| 想在 PR 合并前多一轮检查 | [CodeRabbit 自动审查 PR](01-coderabbit-review.md) | Nuxt 的公开 PR 有机器人审查记录；Cresta 有团队使用案例 |
| 问题清楚了，希望 AI 先完成实现 | [GitHub Copilot 从 Issue 到 PR](02-issue-to-pr.md) | GitHub Secret Protection 团队报告了经测试、人工审查并部署的代码 |
| 用户遇到错误，却很难在本地复现 | [Sentry Seer 从错误现场到修复](03-error-to-fix.md) | 独立开发者公开记录了 Seer 与 Cursor 协作生成并合并 PR 的过程 |
| 扫描发现漏洞，修复积压 | [CodeQL 与 Copilot Autofix](04-security-autofix.md) | GitHub 公布了真实 PR 告警的修复使用数据 |
| 想补测试，但担心生成无效断言 | [Meta TestGen-LLM 筛选有用测试](05-test-generation.md) | 论文记录了 Facebook、Instagram 的实际部署与工程师采纳结果 |
| 升级版本，关联改动太多 | [Amazon Q 在限定范围内迁移版本](06-code-migration.md) | AWS 报告了生产 Java 应用的批量迁移 |

各篇“为什么收录”都附有原始来源，并说明它是公开操作记录、实践自述，还是论文中的部署报告。

## 和头脑风暴怎样搭配

[构想地图](../issue-garden/04-ideas-map.md)保存想法与组合方式，这里补充实际案例。例如“把 Issue 交给 AI”和“让错误记录发起修复”，都可以在上表找到对应流程。

可以把几项实践接成一条流程：

```text
Issue 或错误记录 → AI 提出改动 → 测试与扫描 → AI 审查 → 人验收
```

这条组合流程仍待本项目验证；各环节的实际案例不能代替整条流程的验收。

## 今天做到哪里就可以停

如果今天关注验收负担，读到[工作流分析中的下一次小实验](your-workflow.md#下一次只试一件事)就可以停。想先认识 CodeRabbit，则从 [CodeRabbit 篇](01-coderabbit-review.md)打开公开 PR，读懂一条审查意见与对应代码即可。

以后亲手试某个方案时，留下任务链接、代码版本、实际检查结果和自己的判断。再用后续任务观察误报、返工与验收耗时，不急着从一次成功下结论。
