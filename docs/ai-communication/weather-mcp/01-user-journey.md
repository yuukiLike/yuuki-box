# 1 · 用户点击连接以后，发生了什么

[目录](README.md) · [下一课：Supabase 授权](02-supabase-auth.md)

**这一课只分清三件事：用户登录、用户授权、服务端执行天气查询。**

## 用户看到的四步

1. 在 Codex 添加你的天气服务；发布后可以通过插件提供名称、介绍和连接配置。
2. 点击连接，浏览器进入你的登录同意页。已登录的用户可以复用会话。
3. 查看请求方与权限说明，选择允许或拒绝。
4. 回到 Codex，发送“用天气服务查一下上海现在的天气”。

客户端负责交换和携带 token；用户只需连接与授权。开发者联调见[第五课](05-connect-and-verify.md)。[Codex MCP 支持](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[插件连接配置](https://developers.openai.com/plugins/build/plugins)

[![浏览器中的天气服务授权页覆盖在 Codex 风格窗口前方，用户可允许或拒绝](../../../site/public/diagrams/weather-mcp/02-consent.svg)](../../../site/public/diagrams/weather-mcp/02-consent.svg)

同意页属于你的网站，客户端名称应读取真实授权请求；用户密码不进入 Codex 对话。

## 登录与授权分别证明什么

| 动作 | 证明或决定什么 | 由谁处理 |
| --- | --- | --- |
| 登录 | 当前是哪个用户 | 你的登录页面 + Supabase Auth |
| 同意 OAuth 请求 | 是否允许该客户端代表自己访问服务 | 用户确认，Supabase Auth 记录授权 |
| 检查天气资格 | 这个用户现在是否能调用天气工具 | 你的 Edge Function + 数据库 |

**同意 OAuth 请求不会自动把用户变成付费用户，也不会自动给他天气额度。** 本教程先给指定测试用户开通服务，再验证完整连接。

## 第一次连接的后台过程

下面是流程示意，省略了注册、PKCE 参数和令牌格式；实际协议由 Codex、Supabase 和 MCP SDK 实现。

```text
Codex → 天气 MCP：尝试连接
天气 MCP → Codex：401，并指出 OAuth 元数据地址
Codex → 元数据地址：找到 Supabase 的授权服务器
Codex → 浏览器：打开 OAuth 授权请求
Supabase → 你的 /oauth/consent：携带 authorization_id
你的网站 → 用户：登录，显示请求详情，允许 / 拒绝
Supabase → Codex 回调：返回一次性授权码
Codex → Supabase token endpoint：用授权码和 PKCE 校验材料换 token
Codex → 天气 MCP：带上 access token 再请求
```

授权码是一次性兑换材料，access token 才放进后续 HTTP 的 `Authorization` 请求头。密码不会交给天气工具或模型。[MCP HTTP 授权规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

## 一次天气查询有两套凭证

[![Codex 风格的对话窗口与教程观察栏，区分用户 token 到天气 MCP 和 Apple token 到 WeatherKit](../../../site/public/diagrams/weather-mcp/03-request.svg)](../../../site/public/diagrams/weather-mcp/03-request.svg)

| 凭证 | 谁签发 | 谁持有和使用 | 谁验证 |
| --- | --- | --- | --- |
| Supabase OAuth access token | Supabase Auth | Codex 一侧的 MCP Client | 你的天气 MCP |
| Apple developer token | 你的后端用 Apple 私钥签名 | 你的 Edge Function | Apple WeatherKit |
| Apple `.p8` 私钥 | Apple 开发者后台创建并下载 | 仅服务端密钥存储 | 用于生成上面第二种 token |

两个 HTTP 请求都可以出现 `Authorization: Bearer ...`，但其中装的是不同凭证。**用户 token 不转发给 Apple；Apple token 和私钥不返回给 Codex。**[Apple 请求认证](https://developer.apple.com/documentation/weatherkitrestapi/request-authentication-for-weatherkit-rest-api)

<details class="qa" id="为什么这里还有-host">
<summary>为什么还需要 Host？</summary>

Codex 组织对话、模型与展示，内置 Client 处理 MCP 通信。你只开发远程 Server。

联调可先用 Inspector 或脚本，不必接模型；接口通过后再验收 Codex 体验。

</details>

## 用户拒绝、令牌过期与额度用完

| 情况 | 应有的体验 |
| --- | --- |
| 用户拒绝授权 | 连接保持未完成，可以稍后再连，不自动批准 |
| access token 到期 | 在授权服务器支持且授予刷新凭证时自动续期 |
| 授权撤销或刷新失败 | 提示重新连接账号 |
| 账号没有天气资格 | 明确显示未开通，不循环弹登录窗口 |
| 当日额度用完 | 说明限额与恢复时间，不伪造天气结果 |
| Apple 暂时不可用 | 告知上游暂不可用，不误导用户重新登录 Supabase |

刷新凭证也有生命周期；“授权一次”不等于永久不用再授权。[Supabase 令牌刷新](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows#refresh-token-flow)

## 到这里就停

在第三张图中指出两条带凭证的箭头，并说出各自的接收方。然后进入[Supabase 用户与授权](02-supabase-auth.md)。
