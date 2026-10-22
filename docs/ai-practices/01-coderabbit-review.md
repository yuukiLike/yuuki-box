# 🍀 CodeRabbit 自动审查 PR

**把独立 AI review 变成每份 PR 都能触发的一步。** CodeRabbit 可以总结改动、留下逐行建议，并在继续提交代码后增量审查；也支持围绕审查意见讨论。[GitHub App 说明](https://github.com/apps/coderabbitai)

你在仓库里看到的 `coderabbitai[bot]` 是机器人账号。`.coderabbit.yaml` 是仓库配置文件，可以写入不同路径的审查要求。[配置说明](https://kb.coderabbit.ai/articles/1134523355-configure-path-instructions)

资料核对：2026-10-22。

## 为什么收录

**公开操作记录。** Nuxt 的 [PR #36124](https://github.com/nuxt/nuxt/pull/36124)在 2026-08-19 留有 CodeRabbit 的摘要和代码审查，针对 hydration 时如何判断缓存命中提出具体意见；该 PR 已合并。这证明它参与了真实开发流程，不能单凭合并状态判断每条意见是否被采纳。

**具名团队案例。** CodeRabbit 发布的 Cresta 案例记载：团队从 2026 年 1 月开始试用，首月覆盖 1,871 份 PR，开发者采纳了 51% 的建议；技术负责人还描述了一次递归渲染导致界面无响应的问题被发现。这是供应商发布、具名客户参与的案例，采纳率不等于缺陷检出率。[Cresta 案例](https://www.coderabbit.ai/case-studies/how-cresta-brings-consistent-review-to-ai-generated-code-with-coderabbit)

## 一次流程

```text
创建或更新 PR → CodeRabbit 读取改动与相关上下文
             → 摘要与审查意见 → 作者核实、修正 → 检查与人工验收
```

对应[构想地图中的独立 AI review](../issue-garden/04-ideas-map.md)：可以先使用现成服务，观察自己最需要什么审查能力，再决定是否自建。

## 只试一份 PR

先阅读上面的公开 PR，不需要安装。以后决定接入时，选择一个仓库，在一份范围小、需求清楚的 PR 上观察：

1. 每条意见能否指出触发条件与对应代码。
2. 建议是否修复问题，是否改变了原本的产品行为。
3. 记录有用意见、误报，以及自己核实它们花的时间。

**停止点：能判断一条意见是否成立。** 没有意见的 PR 仍要运行原有检查；两个 AI 都同意也不能替代运行证据。

返回[实践目录](README.md)或[构想地图](../issue-garden/04-ideas-map.md)。
