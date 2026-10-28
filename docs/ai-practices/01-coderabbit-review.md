# 请 CodeRabbit 来挑一次刺

PR 写完了，自己看第三遍已经开始自动忽略熟悉的代码。这时请一个搭档来挑刺：它指出的到底是个真 bug，还是一条看起来很专业的误报？这一篇就追清楚一条意见。

**在 PR 创建或更新时，自动补充一轮 AI 代码审查。** CodeRabbit 可以总结改动、留下逐行建议，并在后续提交后审查新增改动；也支持围绕审查意见讨论。[GitHub App 说明](https://github.com/apps/coderabbitai)

你在仓库里看到的 `coderabbitai[bot]` 是机器人账号。`.coderabbit.yaml` 是仓库配置文件，可以写入不同路径的审查要求。[配置说明](https://kb.coderabbit.ai/articles/1134523355-configure-path-instructions)

资料核对：2026-10-22。

## 先看一场真实审查

**公开操作记录。** Nuxt 的 [PR #36124](https://github.com/nuxt/nuxt/pull/36124)在 2026-08-19 留有 CodeRabbit 的摘要和代码审查，针对 hydration 时如何判断缓存命中提出具体意见；该 PR 已合并。这证明它参与了真实开发流程，不能单凭合并状态判断每条意见是否被采纳。

**团队使用案例。** CodeRabbit 发布的 Cresta 案例记载：团队从 2026 年 1 月开始试用，首月覆盖 1,871 份 PR，开发者采纳了 51% 的建议；技术负责人还举例说明，CodeRabbit 发现过递归渲染导致界面无响应的问题。这是供应商发布的客户案例，建议采纳率不代表检出了多少缺陷。[Cresta 案例](https://www.coderabbit.ai/case-studies/how-cresta-brings-consistent-review-to-ai-generated-code-with-coderabbit)

## 它怎样加入你的 PR

```text
创建或更新 PR → CodeRabbit 读取改动与相关上下文
             → 摘要与审查意见 → 作者核实、修正 → 检查与人工验收
```

它对应[构想地图中的独立 AI 审查](../ai-ideas/01-ideas-map.md)：可以先体验现成服务，观察自己最需要什么审查能力，再决定是否自建。

[![先提取审查意见的触发条件，再复现或反证，最后决定是否采纳](../../site/public/diagrams/ai-practices/review-triage.svg)](../../site/public/diagrams/ai-practices/review-triage.svg)

## 小挑战：给审查意见做一次审查

先打开上面的 Nuxt PR，挑一条能找到对应代码的意见，自己写下判断，再看作者如何处理。以后决定接入时，在自己的一份小 PR 上继续观察：

1. 每条意见能否指出触发条件与对应代码。
2. 建议是否修复问题，是否改变了原本的产品行为。
3. 记录有用意见、误报，以及自己核实它们花的时间。

给这一轮留三行记录：`它说哪里有问题 / 我怎样核实 / 最终采纳还是放弃`。读完会发现，你也在练习怎样提出一条有用的审查意见。

**这一局的成果：能判断一条意见是否成立。** 没有意见的 PR 仍要运行原有检查；两个 AI 都同意也不能替代运行证据。

返回[实践目录](README.md)或[构想地图](../ai-ideas/01-ideas-map.md)。
