# 追着一条安全告警修到底：CodeQL × Autofix

扫描器亮起一条告警：指出了文件和行号，接下来该改什么？这一轮从触发路径追到补丁，再确认正常用户还能照常使用这个功能。

**让静态分析定位问题，再让 AI 提出具体补丁。** CodeQL 产生告警，Copilot Autofix 利用相关代码和漏洞上下文给出解释与修复建议；开发者可以据此创建 PR。[GitHub 工作原理](https://github.blog/engineering/platform-security/fixing-security-vulnerabilities-with-ai/)

资料核对：2026-10-22；以下使用数据来自 2024-08-14 发布、2025-01-21 更新的官方文章。

## 公开数据里的使用情况

**真实 PR 使用数据。** GitHub 根据 2024 年 5—7 月公测期间的客户使用数据报告：在启用 Advanced Security 的仓库中，针对 PR 新增的 CodeQL 告警，使用 Autofix 提交修复的耗时中位数为 28 分钟，手动修复约为 1.5 小时。这是产品方的观察数据，不能直接预测其他项目的提速幅度。[数据与统计范围](https://github.blog/news-insights/product-news/secure-code-more-than-three-times-faster-with-copilot-autofix/)

## 告警怎样走到补丁

```text
CodeQL 扫描 → 告警与相关代码 → AI 解释并建议补丁
           → 修复 PR → 重跑扫描与行为测试 → 人验收
```

这条流程从扫描器报告的具体问题开始。告警消失后，还要确认合法输入能正常处理，原有业务行为得到保留。官方也要求开发者审阅与验证 AI 建议。[当前能力与局限](https://docs.github.com/en/code-security/responsible-use/security-and-quality-ai-features)

[![安全修复既阻止危险输入，也保留正常输入对应的功能](../../site/public/diagrams/ai-practices/security-inputs.svg)](../../site/public/diagrams/ai-practices/security-inputs.svg)

## 小挑战：让危险路径失败，让正常路径通过

在已经启用 CodeQL 的练习仓库中，选择一条自己能理解的告警，保存其规则、位置与触发路径，再请求修复建议。所用语言、规则与账户需要在服务支持范围内。

给这条告警配一组对照：一份触发问题的输入，一份必须继续正常工作的输入。查看修复后的扫描结果，再跑这两个行为检查。确认告警没有靠关闭规则、忽略文件或删除功能消失。

**这一局的成果：能解释一条告警为何出现、补丁为何有效。** 这里检查的是 CodeQL 支持的代码问题；依赖版本告警有其他处理入口。

返回[实践目录](README.md)。
