# 5 · 连接 Codex，完成第一次真实查询

[上一课](04-mcp-server.md) · [目录](README.md)

分别验证<mark class="key">后端、OAuth、工具调用和最终展示</mark>。

[![Codex 风格对话中显示上海当前天气、数据时间和来源，所有天气值均为示例](../../../site/public/diagrams/weather-mcp/04-result.svg)](../../../site/public/diagrams/weather-mcp/04-result.svg)

<div class="heading-alias" id="1-把代码放进自己的练习工程" aria-hidden="true"></div>

## 1. 准备独立天气工程

需 Supabase CLI 和用于类型检查的 Deno；以下命令在独立天气工程执行，教程未执行云端操作。

```bash
mkdir weather-service
cd weather-service
supabase init
supabase functions new weather-mcp
```

按[第二课](02-supabase-auth.md)、[第三课](03-apple-weatherkit.md)、[第四课](04-mcp-server.md)放置文件和两份 migration；配置追加到生成的 `config.toml`，不覆盖整文件。

检查函数类型：

```bash
deno check --config supabase/functions/weather-mcp/deno.json supabase/functions/weather-mcp/index.ts
```

前端安装 `@supabase/supabase-js@2.118.0`，在 `/oauth/consent` 实际加载 HTML 和 `consent.ts`；Supabase 不会自动发现磁盘文件。

## 2. 应用数据库与 Auth 配置

先在 Dashboard 创建**独立练习项目**。将 Hook SQL 中的 `YOUR_PROJECT_REF` 换成真实项目引用，再连接 CLI：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run
```

确认项目正确、待执行的只有本教程两份 migration，再运行：

```bash
supabase db push
```

再按第二课配置 OAuth、动态注册、签名、Hook 与同意页地址；管理员为测试用户开通 `weather_access`。[Supabase CLI](https://supabase.com/docs/reference/cli/supabase-db-push)、[OAuth Server 设置](https://supabase.com/docs/guides/auth/oauth-server/getting-started)

不要在已有项目里为了练习执行 `db reset`，也不要把未知的既有 migration 一起推上去。

## 3. 配置服务器 Secrets

在 Supabase Dashboard 的 Edge Functions Secrets 中设置：

| 名称 | 内容 |
| --- | --- |
| `WEATHER_MCP_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp` |
| `CONSENT_ORIGIN` | 同意页的 origin，例如 `https://weather.example.com`，不含路径 |
| `APPLE_TEAM_ID` | Apple Team ID |
| `APPLE_KEY_ID` | WeatherKit Key ID |
| `APPLE_SERVICE_ID` | 注册的 Services ID |
| `APPLE_PRIVATE_KEY_BASE64` | `.p8` 完整内容的 Base64 |

托管环境默认提供 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`；后者绕过 RLS，只能用于验身份后的固定后端查询，不进前端或 Codex。[Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)

macOS 替换为实际私钥路径，编码后复制到剪贴板，再粘到 Dashboard Secret：

```bash
base64 -i /absolute/path/AuthKey_KEYID.p8 | tr -d '\n' | pbcopy
```

Base64 仍是私钥；保存后清空剪贴板，文件留在私密目录。

部署函数：

```bash
supabase functions deploy weather-mcp
```

本课先验托管环境的公开 URL；本地容器需另核对 issuer、JWKS 与网关地址。

## 4. 先验证没有 token 时的行为

下面两个请求不需要任何密钥：

```bash
curl -i -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp' \
  -H 'Content-Type: application/json' \
  -d '{}'

curl -i \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp/oauth-protected-resource'
```

首个请求应为 `401`，challenge 指向第二个地址；后者应为 `200`，含公开 `resource` 和 Auth issuer。

缺 challenge 查 `verify_jwt`，元数据 `404` 查函数名和内部路由；此时不查 Apple 私钥。

## 5. 用 Codex 完成 OAuth

开发者第一次联调可以通过 CLI 添加远程服务：

```bash
codex mcp add weather --url https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp
codex mcp login weather --scopes openid
```

按提示在浏览器登录、允许连接；回调地址由动态注册登记，不猜测写死，也不把 Apple token 当手工 bearer。[Codex MCP 官方说明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

回到同配置环境的 Codex，检查 MCP 设置，必要时重开会话。桌面、远程或不同 `CODEX_HOME` 可能使用不同配置。

发送：

> 用 weather 的 get_current_weather 查询上海当前天气。保留数据时间、摄氏度单位、Apple Weather 标识资源和来源链接，不要生成未来预报。

核对城市、时间、单位，再检查最终回答；工具成功与展示正确分别验收。

<div class="heading-alias" id="6-验证几种会真的遇到的失败" aria-hidden="true"></div>

## 6. 验证失败分支

在独立测试项目中逐项操作，测试结束后恢复测试用户配置。不要把生产 token 发到在线 JWT 解码网站。

| 测试 | 预期结果 | Apple 是否应被调用 |
| --- | --- | --- |
| 没有 token / token 签名错误 / 已过期 | HTTP `401`，可发现 OAuth 元数据 | 否 |
| 使用普通网站登录 token，或 `aud` 是别的服务 | HTTP `401` | 否 |
| 已登录，但 `weather_access` 没有记录或已停用 | HTTP `403`；不应反复要求登录 | 否 |
| 参数填“成都”或请求传入 `user_id` 冒充别人 | 不支持的城市被拒；用户身份始终取自 token | 否 / 不会变成别人 |
| 测试用户额度设为 1，连续请求两次 | 首次预占；第二次 `QUOTA_EXCEEDED` | 第二次不调用 |
| 两个请求并发争抢最后一次额度 | 只有一个成功预占 | 仅成功预占的调用 |
| Apple key 配错、上游 `401` / 超时 | 工具返回 `WEATHER_UNAVAILABLE`；用户不必重登 | 尝试调用，记录安全的错误分类 |
| 上游缺字段或返回已过期数据 | 工具失败，不编造替代值 | 已调用，但不展示为成功天气 |
| 用户拒绝同意 | OAuth 不完成 | 否 |
| 用户停用天气权限后再次请求 | 新请求立即被业务检查拒绝 | 否 |

额度按尝试计，重试也扣；未实现无限重试。上线前另加全服务预算、网关限流和监控。

<div class="heading-alias" id="7-让普通用户不用输入命令" aria-hidden="true"></div>

## 7. 打包插件连接入口

CLI 用于开发联调；服务通过后，将名称、说明、MCP URL、OAuth 配置打包为插件，后端不变。

`mcp.json` 声明服务与 OAuth；下面仅为相关字段，完整包按官方文档：

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "weather": {
      "type": "streamable-http",
      "url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp",
      "extensions": {
        "com.openai": {
          "auth": { "type": "oauth", "client": { "mode": "dcr" } }
        }
      }
    }
  }
}
```

插件仍需发布审核，不能代替用户授权或保存 Apple 私钥。[OpenAI 插件打包](https://developers.openai.com/plugins/build/plugins)、[OAuth 接入](https://developers.openai.com/plugins/build/auth)

## 8. 最终体验单独验收

- 第一次连接只有必要的登录与同意步骤，没有复制 token。
- 用户拒绝后仍保持未连接；允许后能回到 Codex 继续查询。
- 数据有明确时间、单位和城市，没有把当前天气说成明天预报。
- <mark class="caution">用户实际看见标识并能打开来源</mark>；JSON URL 或 SVG 占位不算通过。
- 令牌过期、刷新失败、资格停用和上游失败，各自显示正确反馈。
- 密钥没有出现在工具结果、前端 bundle、聊天内容和日志中。

Host 若不能稳定显示标识，需补展示界面并重验；工具 description 不能保证展示。[Apple 展示要求](https://developer.apple.com/weatherkit/)

<div class="heading-alias" id="本次文档交付的验证记录" aria-hidden="true"></div>

## 文档验证记录

以下为仓库教程的检查记录，不代表实际云端服务验收。整理日期：2026-10-26。

| 项目 | 状态 |
| --- | --- |
| 文档站检查、构建与导航链接 | Astro check：0 errors / warnings / hints；构建 88 页，检查新增 6 页的内部链接、锚点与资源 |
| SVG 解析、渲染与可读性 | 4 张 SVG 均可解析，含标题与描述；已渲染为图片检查排版 |
| 固定版本依赖下的 TypeScript 示例 | 从文档提取，使用 TypeScript 6.0.3 严格类型检查通过；Deno API 使用最小声明，未声称执行过真实 Deno 部署 |
| 实际 MCP SDK + 模拟云端请求 | 13 项检查通过，覆盖 token 校验、权限、工具发现、参数、额度拒绝、Apple JWT、上游错误与数据校验；未模拟证明 SQL 并发正确性 |
| Supabase migrations、Hook、邮件登录与 OAuth 回调 | 未使用真实项目执行 |
| Apple 密钥、真实天气与调用额度 | 未使用真实凭证执行 |
| Codex 中的最终标识显示、刷新与撤销 | 未真实联调；图为预期体验示意 |

检查在临时目录运行，未加天气依赖或读取账号凭据；缺 `site` 的既有警告仅跳过 sitemap。

<div class="heading-alias" id="到这里就停" aria-hidden="true"></div>

## 验收标准

先让获准用户经浏览器授权查到上海当前天气、时间和来源，再验失败分支，最后扩展预报与城市搜索。
