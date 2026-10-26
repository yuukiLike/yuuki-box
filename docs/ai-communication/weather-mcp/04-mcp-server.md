# 4 · 把天气查询封装成远程 MCP 工具

[上一课](03-apple-weatherkit.md) · [目录](README.md) · [下一课：连接与验收](05-connect-and-verify.md)

**这一课的目标：让 Codex 能发现并调用 `get_current_weather`，同时保持权限检查在服务端。**

[![Codex 对话区旁的教程观察栏，展示用户 token 到 Supabase、开发者 token 到 Apple 的两段请求](../../../site/public/diagrams/weather-mcp/03-request.svg)](../../../site/public/diagrams/weather-mcp/03-request.svg)

## 1. 先看完整目录

这是你另建的天气服务工程。前两课的文件与本课文件放在一起：

```text
weather-service/
├── web/
│   └── consent.ts                 # 配套 HTML 见第二课，接入你的前端路由
└── supabase/
    ├── config.toml
    ├── migrations/
    │   ├── 202610260001_weather_access.sql
    │   └── 202610260002_weather_token_hook.sql
    └── functions/weather-mcp/
        ├── deno.json
        ├── env.ts
        ├── auth.ts
        ├── weatherkit.ts
        └── index.ts
```

教程按当前 Supabase 官方 MCP 示例使用 TypeScript SDK v2 的 `createMcpHandler`，每个请求创建独立服务实例。它处理 JSON-RPC、工具发现、参数验证和 Streamable HTTP；我们负责身份与业务逻辑，不手写一套 MCP 协议。[Supabase 自建 MCP 指南](https://supabase.com/docs/guides/ai-tools/byo-mcp)

`supabase/functions/weather-mcp/deno.json`：

<!-- file: supabase/functions/weather-mcp/deno.json -->
```json
{
  "imports": {
    "@modelcontextprotocol/server": "npm:@modelcontextprotocol/server@2.4.0",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2.118.0",
    "jose": "npm:jose@6.2.13",
    "zod": "npm:zod@4.3.6"
  },
  "compilerOptions": { "strict": true }
}
```

版本固定是为了复现本教程，不代表以后永远不升级。不要把这里的 v2 import 与旧课程的 SDK v1 import 混用。

## 2. 给 OAuth 发现留一个公开入口

在 `supabase/config.toml` 加入：

`supabase/config.toml`：

<!-- file: supabase/config.toml -->
```toml
[functions.weather-mcp]
verify_jwt = false
```

这个配置只关掉 Supabase 网关的默认 JWT 检查，让客户端能在登录前读取资源元数据。**天气工具仍须经过下面的函数内验证。** 如果既关闭网关检查，又删掉函数内验证，就变成任何人都能消耗 Apple 额度的接口。[Edge Functions 与 MCP 认证](https://supabase.com/docs/guides/ai-tools/byo-mcp)

## 3. 验证 Supabase 签发的用户 token

我们不用 `decodeJwt` 的结果做授权。解码只是在读 JSON，不能证明签名正确。

`supabase/functions/weather-mcp/auth.ts`：

<!-- file: supabase/functions/weather-mcp/auth.ts -->
```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { requireEnv } from './env.ts';

const issuer = `${requireEnv('SUPABASE_URL')}/auth/v1`;
const audience = requireEnv('WEATHER_MCP_URL');
const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
const invalidTokenCodes = new Set([
  'ERR_JWT_EXPIRED', 'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED', 'ERR_JWS_INVALID',
  'ERR_JWT_INVALID', 'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWKS_NO_MATCHING_KEY',
]);

export class Unauthorized extends Error {}

export async function verifyWeatherUser(token: string): Promise<string> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
      algorithms: ['ES256', 'RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'client_id'],
      clockTolerance: 5,
    }));
  } catch (error) {
    if (error instanceof Error && 'code' in error &&
        invalidTokenCodes.has(String(error.code))) {
      throw new Unauthorized();
    }
    throw error; // JWKS 网络故障等由上层返回 503，不误导用户反复登录。
  }

  if (payload.role !== 'authenticated' || payload.is_anonymous !== false ||
      typeof payload.client_id !== 'string' || !payload.client_id ||
      !z.uuid().safeParse(payload.sub).success) {
    throw new Unauthorized();
  }
  return payload.sub!;
}
```

这里同时验证签名、签发方、接收方、有效期和用户身份。`client_id` 要求它来自 OAuth 流程；普通网站登录 token 不应被当作 Codex 授权。业务资格依然要查数据库。[MCP token 校验要求](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)、[Supabase OAuth token 安全](https://supabase.com/docs/guides/auth/oauth-server/token-security)

离线 JWT 验证不等于实时查询“用户刚刚是否退出登录”。本例每次请求查询 `weather_access.enabled`，可立即停用天气权限；若要按客户端即时撤销某个授权，还需增加客户端授权状态检查。不要承诺一个已签发的 JWT 在点击退出后瞬间失效。

## 4. 注册工具并连接两套权限

入口中只有资源元数据是公开的。真正的 MCP 请求先验证用户，再查资格；真正的天气调用还要原子预占额度。

`supabase/functions/weather-mcp/index.ts`：

<!-- file: supabase/functions/weather-mcp/index.ts -->
```ts
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Unauthorized, verifyWeatherUser } from './auth.ts';
import { requireEnv } from './env.ts';
import { getCurrentWeather, WeatherKitError } from './weatherkit.ts';

const resource = requireEnv('WEATHER_MCP_URL');
const resourcePath = new URL(resource).pathname;
const metadataUrl = `${resource}/oauth-protected-resource`;
// Supabase 网关转发后的路由以函数名开头；也接受未剥离的公开路径。
const mcpPaths = new Set([resourcePath, '/weather-mcp']);
const metadataPaths = new Set([...mcpPaths].map((path) => `${path}/oauth-protected-resource`));
const consentOrigin = new URL(requireEnv('CONSENT_ORIGIN')).origin;
const supabaseUrl = requireEnv('SUPABASE_URL');
const admin = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function authenticationRequired(invalid = false) {
  return json({ error: 'authentication_required' }, 401, {
    'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}", scope="openid"` +
      (invalid ? ', error="invalid_token"' : ''),
  });
}

function toolError(code: string, message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `${code}: ${message}` }],
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  // 原生客户端通常没有 Origin；带 Origin 的请求必须来自允许的站点。
  // 此处不是通用浏览器 MCP 客户端的 CORS 实现。
  if (origin && origin !== consentOrigin) return json({ error: 'origin_denied' }, 403);

  const path = new URL(request.url).pathname;
  if (metadataPaths.has(path) && request.method === 'GET') {
    return json({
      resource,
      authorization_servers: [`${supabaseUrl}/auth/v1`],
      scopes_supported: ['openid'],
      bearer_methods_supported: ['header'],
    });
  }
  if (!mcpPaths.has(path)) return json({ error: 'not_found' }, 404);

  const match = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return authenticationRequired();

  let userId: string;
  try {
    userId = await verifyWeatherUser(match[1]);
  } catch (error) {
    if (error instanceof Unauthorized) return authenticationRequired(true);
    return json({ error: 'authentication_service_unavailable' }, 503);
  }

  const { data: access, error: accessError } = await admin
    .from('weather_access').select('enabled').eq('user_id', userId).maybeSingle();
  if (accessError) return json({ error: 'access_check_unavailable' }, 503);
  if (!access?.enabled) return json({ error: 'weather_access_denied' }, 403);

  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'yuuki-weather', version: '0.1.0' });
    server.registerTool('get_current_weather', {
      title: '查询当前天气',
      description: '查询上海、北京、杭州的当前天气，返回数据时间、单位和 Apple 来源。' +
        '不支持未来预报；回答时保留时间、来源链接与标识资源。',
      inputSchema: z.object({ city: z.enum(['上海', '北京', '杭州']) }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    }, async ({ city }) => {
      const { data: reservation, error } = await admin.rpc('reserve_weather_call', {
        p_user_id: userId, // 来自验证后的 token，绝不来自模型参数。
      });
      if (error) return toolError('ACCESS_UNAVAILABLE', '暂时无法检查额度，请稍后重试。');
      if (reservation === 'denied') return toolError('ACCESS_DENIED', '天气权限已停用。');
      if (reservation === 'quota_exceeded') {
        return toolError('QUOTA_EXCEEDED', '今日查询次数已用完，额度按 UTC 日期重置。');
      }
      if (reservation !== 'allowed') return toolError('ACCESS_UNAVAILABLE', '额度检查未完成。');

      try {
        const weather = await getCurrentWeather(city);
        return {
          structuredContent: weather,
          content: [{ type: 'text' as const, text: JSON.stringify(weather) }],
        };
      } catch (error) {
        // 仅记错误分类和上游状态，不记录 JWT、私钥或完整请求头。
        console.error('weather_fetch_failed', {
          code: error instanceof WeatherKitError ? error.code : 'UPSTREAM_OR_CONFIG_ERROR',
          status: error instanceof WeatherKitError ? error.upstreamStatus : undefined,
        });
        return toolError('WEATHER_UNAVAILABLE', '天气来源暂时不可用，请稍后再试。');
      }
    });
    return server;
  });

  return handler.fetch(request);
});
```

`readOnlyHint` 描述用户业务操作是查询。服务器仍会记录额度；它不是授权凭证，也不能替代权限校验。工具参数只接受三个城市，因此模型不能借此请求任意 URL 或冒充另一个用户。

## 5. 走一遍实际消息

客户端第一次访问天气 MCP，没有 token，会收到：

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp/oauth-protected-resource", scope="openid"
```

客户端读取这个公开地址，找到 Supabase 授权服务器，完成浏览器授权与 PKCE，带 token 重试。它会按协商的 MCP 版本完成连接、发现工具，再发送类似的调用：

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "get_current_weather",
    "arguments": { "city": "上海" }
  }
}
```

在同一个 HTTP 请求里：`Authorization` 负责用户身份；JSON-RPC body 说明要调用什么。`tools/list` 让 Codex 知道工具名、说明和参数格式。HTTPS 仍然承担网络传输；MCP 提供的是大家一致理解的工具协议。

这里通过 `WWW-Authenticate` 明确给出元数据地址，避免要求你修改 Supabase 项目域名根目录的路由。不要把这个 Edge Function 地址误写成 Supabase 管理平台的 MCP 地址。[MCP 资源发现](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

公开地址含 `/functions/v1`，函数内的路由则以 `/weather-mcp` 开头。示例同时识别这两个固定路径，但始终用公开的 `WEATHER_MCP_URL` 作为 audience 和资源标识。[Supabase 函数路由](https://supabase.com/docs/guides/functions/routing)

## 到这里就停

沿代码找到三道门：`verifyWeatherUser`、`weather_access`、`reserve_weather_call`。能分别解释身份、资格、额度后，就去[部署、连接并验收](05-connect-and-verify.md)。
