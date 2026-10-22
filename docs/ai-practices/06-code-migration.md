# 🍀 Amazon Q 执行有界版本迁移

**先确定升级目标，再让 AI 在构建和测试反馈中处理关联改动。** Amazon Q Developer 的 Java 转换会生成迁移计划，修改代码、反复构建并运行已有测试，最后提供摘要和 diff 供审查。[当前转换流程](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/how-CT-works.html)

资料核对：2026-10-22；以下生产迁移记录发布于 2024-08-01。

## 为什么收录

**生产迁移案例。** AWS 报告 Amazon 已在 Q Developer 协助下，将数万份生产应用从 Java 8 或 11 迁移到 Java 17。这是企业对自身部署的公开记录，说明受限目标下的批量迁移已有实际应用。[AWS 工程文章](https://aws.amazon.com/blogs/devops/amazon-q-developer-just-reached-a-260-million-dollar-milestone/)

该案例中的工时与成本节省是企业估算；这里采用的是迁移已发生这一证据，不用估算值预测个人项目的收益。

## 一次流程

```text
固定目标版本 → 记录现有构建与测试基线 → 迁移计划
            → 修改代码与依赖 → 构建、测试、修正 → 人审查 diff
```

直接使用该工具需要符合支持条件的 Java/Maven 项目。[支持范围与前置条件](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/code-transformation.html)

对于 Yuuki Box，更适合借鉴“限定目标、保留基线、按错误反馈收敛”的流程。把它用于 Astro 或其他前端依赖升级，是本项目的实验建议，不能沿用 Java 案例的成功率。

## 只迁移一个依赖或模块

等项目确实需要一次升级时，再选一个依赖或模块，在独立分支记录当前版本与检查结果。给 AI 明确的目标版本、官方迁移说明，以及必须保持的行为，让它处理这一次迁移。

验收时对比升级前后同一组检查，保留原本失败的项目和新增失败的区别；再执行一条受影响的真实操作。需要删除断言、关闭检查或扩大升级范围才能通过时，先说明原因并重新判断范围。

**停止点：一个范围清楚、能解释关联改动的迁移 diff。**

返回[实践目录](README.md)。
