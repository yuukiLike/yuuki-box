# 天气 MCP：从 Codex 里的连接按钮，到 Apple WeatherKit

[本地工具案例](../../mcp-projects/README.md) · [回补通信基础](../README.md) · [开始：用户会经历什么](01-user-journey.md)

完整流程包含<mark class="key">连接、登录、授权与天气查询</mark>。

Supabase Auth、Postgres、Edge Functions 承载后端，Apple WeatherKit 提供天气；业务代码实现 Server，Codex 提供 Host 和 Client。

本专题为进阶工程。建议先完成[最简调用](../../ai-from-scaling/00-minimal-mcp.md)与[本地天气](../../ai-from-scaling/07-weatherkit-mcp.md)，再增加远程服务、OAuth 与多用户权限。需理解 `tools/call`、HTTP 和基础 TypeScript；无需模型训练。

[![Codex 风格的天气服务连接界面，右侧说明用户只需连接账号](../../../site/public/diagrams/weather-mcp/01-connect.svg)](../../../site/public/diagrams/weather-mcp/01-connect.svg)

原创 SVG 为界面与天气示意，不代表实际截图或特定版本按钮位置。

<div class="heading-alias" id="今天先做到哪里" aria-hidden="true"></div>

## 入门验收

阅读[第一课](01-user-journey.md)，区分凭证接收方：

> **用户 token 与 Apple token 分别由哪个服务接收？**

用户 token 发往天气服务，Apple token 发往 Apple WeatherKit；此步骤无需创建项目或配置密钥。

<div class="heading-alias" id="按这条路线跟做" aria-hidden="true"></div>

## 实现步骤

| 章节 | 实现内容 | 验收结果 |
| --- | --- | --- |
| [1 · 用户体验与参与者](01-user-journey.md) | 把连接、授权、查询串起来 | 能解释两套 token 和两次 API 调用 |
| [2 · Supabase 用户与授权](02-supabase-auth.md) | 准备账号、同意页、业务权限和 OAuth token | token 的接收方正确，用户不能给自己开权限 |
| [3 · Apple WeatherKit](03-apple-weatherkit.md) | 在后端签名并查询真实天气 | 得到带时间、单位和来源的结果 |
| [4 · 封装为 MCP 工具](04-mcp-server.md) | 把认证、额度与天气查询放进 Edge Function | 匿名请求被拒绝，允许的请求能调用工具 |
| [5 · 连接 Codex 与验收](05-connect-and-verify.md) | 完成浏览器授权和第一次真实查询 | 云端权限、工具调用、最终显示分别通过 |

按标注文件名写入独立天气工程；文档站不部署这些代码。

## 先固定一个小范围

首版 `get_current_weather` 仅查上海、北京、杭州当前天气；使用固定坐标，不采集定位或接受模型猜测坐标。

预报需增加日期与时区处理，城市搜索需接地理编码；留到当前天气跑通后。

独立练习项目用动态注册登记 Codex 回调，用户在浏览器登录同意；已有项目需按第二课限定客户端，不能照搬全局配置。

<div class="heading-alias" id="把前面的概念落在具体位置" aria-hidden="true"></div>

## 组件职责

| 名称 | 在这个例子中是什么 |
| --- | --- |
| Host | 整个 Codex 应用，负责对话、模型与任务安排 |
| MCP Client | Codex 内置的 MCP 通信组件 |
| MCP Server | `weather-mcp` Edge Function |
| 授权服务器 | Supabase Auth，处理 OAuth 授权码和令牌签发 |
| 业务权限 | Postgres 中由服务端管理的天气资格与额度 |
| 上游天气服务 | Apple WeatherKit；它不需要知道终端用户的 Supabase token |

Host 可内置 Client；天气 Server 调用 WeatherKit 时又是 Apple API 的客户端，角色随连接而变。[MCP 架构](https://modelcontextprotocol.io/docs/learn/architecture)

## 开始之前准备什么

- 一个用于练习的 Supabase 项目，以及一个能访问的 HTTPS 前端，用来承载 `/oauth/consent` 登录同意页。后端仍然全部使用 Supabase。
- Apple Developer Program 账号、WeatherKit 私钥、Key ID、Team ID 和 Services ID。
- 本机 Codex、Supabase CLI；代码使用 Deno/Edge Functions、MCP TypeScript SDK v2、Supabase JS v2 和 `jose`。

Supabase OAuth Server 当前为 beta；本课由 Supabase 向 Codex 发访问天气服务的 token，不是 Apple/Google 社交登录。[Supabase OAuth Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started)

## 这份教程的验证边界

整理于 **2026-10-26**，依据官方文档；示例独立于已有本地 MCP。

- 教程、导航、SVG 和代码片段的本地检查记录见[验收页](05-connect-and-verify.md#本次文档交付的验证记录)。
- <mark class="caution">尚未部署 Supabase、OAuth 或 Edge Function。</mark>
- 未调用真实 Apple API，未完成 Codex ↔ Supabase ↔ WeatherKit 联调。
- SVG 是预期体验，不证明刷新、天气或来源标识已验收。

先从[用户第一次点击“连接”](01-user-journey.md)开始。
