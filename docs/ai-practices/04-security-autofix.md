# 🍀 CodeQL 与 Copilot Autofix 修复安全告警

**让静态分析定位问题，再让 AI 提出具体补丁。** CodeQL 产生告警，Copilot Autofix 利用相关代码和漏洞上下文给出解释与修复建议；开发者可以据此创建 PR。[GitHub 工作原理](https://github.blog/engineering/platform-security/fixing-security-vulnerabilities-with-ai/)

资料核对：2026-10-22；以下使用数据来自 2024-08-14 发布、2025-01-21 更新的官方文章。

## 为什么收录

**真实 PR 使用数据。** GitHub 在正式发布文章中报告：对于启用了 Advanced Security 的仓库中、PR 新增的 CodeQL 告警，使用 Autofix 提交修复的耗时中位数为 28 分钟，手动修复为约 1.5 小时。这是产品方对使用过程的观察，不能当作任何项目都能获得三倍提速的保证。[数据与统计范围](https://github.blog/news-insights/product-news/secure-code-more-than-three-times-faster-with-copilot-autofix/)

## 一次流程

```text
CodeQL 扫描 → 告警与相关代码 → AI 解释并建议补丁
           → 修复 PR → 重跑扫描与行为测试 → 人验收
```

相比普通 review，这条流程有一个明确的起点：扫描器已经报告了具体问题。告警被消除后，还要检查补丁是否保留合法输入和原有业务行为。官方也要求开发者审阅与验证 AI 建议。[当前能力与局限](https://docs.github.com/en/code-security/responsible-use/security-and-quality-ai-features)

## 只处理一条已有告警

在已经启用 CodeQL 的练习仓库中，选择一条自己能理解的告警，保存其规则、位置与触发路径，再请求修复建议。所用语言、规则与账户需要在服务支持范围内。

验收时同时查看扫描结果和对应行为测试。确认告警没有靠关闭规则、忽略文件或删除功能消失；对需要兼容的正常输入也做一次检查。

**停止点：能解释一条告警为何出现、补丁为何有效。** 这里检查的是 CodeQL 支持的代码问题；依赖版本告警有其他处理入口。

返回[实践目录](README.md)。
