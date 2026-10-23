# 交出一张 Issue，接回一份 PR

有个链接每次都把你送错地方。问题不大，来回跳转却很烦。把入口、复现和目标页写进 Issue，试着把这件小事完整交给 AI，再接回一份你看得懂的修复。

**把一个描述清楚的小任务交给 AI，收到一份可以审查的改动。** GitHub Copilot cloud agent 支持从 Issue 启动工作，并通过 PR 继续反馈与修改。使用条件包括付费 Copilot 计划，以及仓库未禁用该能力。[当前使用文档](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github)

资料核对：2026-10-22；下述工程案例发布于 2025-08-28，次日更新，当时产品称 coding agent。

## GitHub 团队交过什么任务

**团队实际部署。** GitHub Secret Protection 团队把新增凭据校验器的背景、接口资料和示例写进 Issue，再分配给 Copilot。生成的 PR 经过自动测试、人工审查，最终由工程师部署；团队报告在几周内增加了近 90 种访问令牌（token）类型的支持。[工程团队原文](https://github.blog/ai-and-ml/github-copilot/how-we-accelerated-secret-protection-engineering-with-copilot/)

原文也记载 Agent 会漏读链接中的细节，团队通过补充说明和检查运行结果修正错误。这项实践依赖现有框架、相似任务与人工验收，不能据此认为任意 Issue 都能自动完成。

## 从任务单到交付物

```text
人确认问题与验收条件 → Issue → Agent 修改、运行检查
                   → PR → 评论反馈与返修 → 人验收
```

它为[Issue 夜班](../issue-garden/README.md)提供了“单次任务交付”的落地依据。定时选择任务、避免重复领取与控制预算，仍是夜班调度需要另外处理的部分。

## 小挑战：让一个失效链接走完开发流程

选一个失效文档链接之类的小任务。在 Issue 里写清入口、实际结果、预期目标和验收路径，把关键条件直接写入正文。交给 Agent 后，观察它是否找到真正的引用位置，以及是否给出对应的检查记录。

验收时打开修复后的链接，再检查附近链接是否仍正常。保留 Issue、最终 diff 和实际访问结果。

可以再试一轮：如果第一份 PR 理解错了目标，用一条具体评论纠正它，看看下一轮是否沿着同一验收条件修正。这个反馈过程也是实践的一部分。

**这一局的成果：一份自己能解释并验证的 PR。** Agent 无法运行某项检查时，应写明原因和影响，并继续完成能独立完成的验证。确实需要你参与的部分，再给出具体操作和判断标准。

返回[实践目录](README.md)。
