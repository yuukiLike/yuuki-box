# 🍀 GitHub Copilot 从 Issue 到 PR

**把一个描述清楚的小任务交给 Agent，收到一份可以审查的改动。** GitHub Copilot cloud agent 支持从 Issue 启动工作，并通过 PR 继续反馈与修改。核对时官方列出的条件包括付费 Copilot 计划，以及仓库未禁用该能力。[当前使用文档](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github)

资料核对：2026-10-22；下述工程案例发布于 2025-08-28，次日更新，当时产品称 coding agent。

## 为什么收录

**团队实际部署。** GitHub Secret Protection 团队把新增凭据校验器的背景、接口资料和示例组织成 Issue，再分配给 Copilot。生成的 PR 经过自动测试、人工审查，最终由工程师部署；团队报告在几周内增加了近 90 种 token 类型的支持。[工程团队原文](https://github.blog/ai-and-ml/github-copilot/how-we-accelerated-secret-protection-engineering-with-copilot/)

原文也记载 Agent 会漏读链接中的细节，团队通过补充说明和观察运行结果修正错误。案例支持的是有既有框架、相似任务与人工验收的委派流程，不能推成任意 Issue 都能自动完成。

## 一次流程

```text
人确认问题与验收条件 → Issue → Agent 修改、运行检查
                   → PR → 评论反馈与返修 → 人验收
```

它为[Issue 夜班](../issue-garden/README.md)提供了“单次任务交付”的落地依据。定时选择任务、避免重复领取与控制预算，仍是夜班调度需要另外处理的部分。

## 只试一个明确的问题

选择一个失效文档链接之类的小任务，在 Issue 里写清入口、实际结果、预期目标和验收路径。把关键条件直接写入正文，让 Agent 提交修复与检查记录。

验收时打开修复后的链接，再检查附近链接是否仍正常。保留 Issue、最终 diff 和实际访问结果。

**停止点：一份自己能解释并验证的 PR。** 如果 Agent 无法运行某项检查，让它明确留下缺口，再由你完成该项验收。

返回[实践目录](README.md)。
