# 2 · Supabase 登录与天气访问授权

[上一课](01-user-journey.md) · [目录](README.md) · [下一课：Apple WeatherKit](03-apple-weatherkit.md)

让 Codex 取得<mark class="key">专用于天气服务的 access token</mark>。

先用独立项目；迁入已有项目时保留现有 RLS、OAuth 客户端和 Token Hook。

[![用户 token 只发天气服务，Apple token 只发 WeatherKit，私钥留在服务端](../../../site/public/diagrams/weather-mcp/token-boundaries.svg)](../../../site/public/diagrams/weather-mcp/token-boundaries.svg)

本课只做用户授权；Apple 签名留到下一课，两套 Bearer 不能互换。

## 1. 记下三个地址

占位符换成实际项目，首次可直接用 Supabase 默认域名。

| 名称 | 示例 |
| --- | --- |
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `WEATHER_MCP_URL` | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp` |
| 登录同意页 | `https://weather.example.com/oauth/consent` |

token `aud`、资源元数据、Codex 的 `WEATHER_MCP_URL` 必须完全一致；issuer 为 `SUPABASE_URL + /auth/v1`。

## 2. 开启 OAuth Server

在 Supabase Dashboard 中：

1. 打开 **Authentication → OAuth Server**，启用 OAuth Server。
2. 启用 **Dynamic Client Registration**，用于 Codex 接入。
3. 在 **URL Configuration** 中设置前端 Site URL。
4. 把 Authorization Path 设为 `/oauth/consent`。
5. 检查 JWT Signing Keys，使用 **ES256 或 RS256 非对称签名**。本教程后端用 JWKS 验证签名，不接受旧 HS256 项目密钥。

动态注册只登记客户端与回调，不批准用户访问。仍需登录、同意、撤销入口和客户端检查；固定接入方可预注册。[Supabase MCP 认证](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)

先访问公开的发现文档：

```text
https://YOUR_PROJECT_REF.supabase.co/.well-known/oauth-authorization-server/auth/v1
```

应有授权、token、注册端点与 PKCE 支持，不应泄露 token 或私钥。[OAuth Server 设置](https://supabase.com/docs/guides/auth/oauth-server/getting-started)

## 3. 明确一个 Supabase 的限制

整理时支持 `openid`、`email`、`profile`、`phone`，<mark class="caution">尚不支持自定义 OAuth scopes</mark>。

`weather:read` 只是概念；本课申请 `openid`，天气资格另存数据库。

OAuth token 带 `client_id`，RLS 却不会自动限制为天气。业务表不对 `anon` / `authenticated` 开放，只允许验证后的 Edge Function 固定查询/RPC。[Scopes 与数据访问边界](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows#available-scopes)、[OAuth 与 RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)

## 4. 建立使用资格与原子额度检查

在天气工程创建 migration；两表只存资格和日调用次数，不存原始天气。

`supabase/migrations/202610260001_weather_access.sql`：

<!-- file: supabase/migrations/202610260001_weather_access.sql -->
```sql
create table public.weather_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  daily_limit integer not null default 20 check (daily_limit between 1 and 1000)
);

create table public.weather_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  calls integer not null check (calls >= 0),
  primary key (user_id, usage_day)
);

alter table public.weather_access enable row level security;
alter table public.weather_usage enable row level security;
revoke all on public.weather_access, public.weather_usage from anon, authenticated;
grant select on public.weather_access to service_role;

-- 只有已经验证过用户身份的 Edge Function 能调用。
-- 一次事务完成资格检查和计数，避免并发请求穿透限额。
create function public.reserve_weather_call(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_calls integer;
  reserved integer;
  today_utc date := (current_timestamp at time zone 'UTC')::date;
begin
  select daily_limit into max_calls
    from public.weather_access
    where user_id = p_user_id and enabled
    for share;
  if max_calls is null then
    return 'denied';
  end if;

  insert into public.weather_usage as usage (user_id, usage_day, calls)
    values (p_user_id, today_utc, 1)
    on conflict (user_id, usage_day) do update
      set calls = usage.calls + 1
      where usage.calls < max_calls
    returning calls into reserved;

  if reserved is null then
    return 'quota_exceeded';
  end if;
  return 'allowed';
end;
$$;

revoke all on function public.reserve_weather_call(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_weather_call(uuid) to service_role;
```

在 Dashboard 创建或登录一个真实测试用户，复制其 Auth 用户 ID，然后由管理员开通：

```sql
insert into public.weather_access(user_id, enabled, daily_limit)
values ('替换为真实用户UUID', true, 20)
on conflict (user_id) do update set enabled = true, daily_limit = 20;
```

UUID 由管理员配置；调用方不能传 `user_id`，身份只取验证后的 token `sub`。

按 UTC 日期计查询尝试，Apple 失败也扣次数；这是用户额度，不等于 Apple 月额度或网关限流。

## 5. 把 token 限定给天气 MCP

签名正确仍需检查 audience，不能接受项目内所有登录 token。

Hook 仅用于独立天气项目：有 `client_id` 的 token 改为天气 audience，普通登录 token 不变。

`supabase/migrations/202610260002_weather_token_hook.sql`：

<!-- file: supabase/migrations/202610260002_weather_token_hook.sql -->
```sql
create function public.weather_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := event->'claims';
begin
  if nullif(claims->>'client_id', '') is not null then
    claims := jsonb_set(
      claims,
      '{aud}',
      to_jsonb('https://YOUR_PROJECT_REF.supabase.co/functions/v1/weather-mcp'::text)
    );
  end if;
  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.weather_access_token_hook(jsonb)
  to supabase_auth_admin;
revoke execute on function public.weather_access_token_hook(jsonb)
  from public, anon, authenticated;
```

替换地址、执行 migration，在 **Authentication → Hooks → Custom Access Token Hook** 选该函数；保留 `sub`、`role`、`exp` 等必需 claims。[Access Token Hook 输入输出](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

已有项目只为白名单天气客户端改 audience，并合入现有 Hook；新注册但未入白名单的客户端应失败，不能放宽检查。[按客户端定制 token](https://supabase.com/docs/guides/auth/oauth-server/token-security)

后端用服务器凭证访问专用表，不转发用户 OAuth token 当数据库会话；`service_role` 绕过 RLS，必须保留身份校验与固定查询。

<div class="heading-alias" id="6-做一个真正的登录同意页" aria-hidden="true"></div>

## 6. 实现登录同意页

Supabase 提供协议端点；前端在 `/oauth/consent` 提供登录同意页：

```html
<main>
  <h1>连接天气服务</h1>
  <p id="status" role="status"></p>
  <form id="login" hidden>
    <label>邮箱 <input id="email" type="email" required autocomplete="email"></label>
    <button>发送登录邮件</button>
  </form>
  <section id="consent" hidden>
    <p id="client"></p>
    <p id="scopes"></p>
    <p>客户端将代表你查询天气。可用城市和调用额度由天气服务管理。</p>
    <button id="allow">允许连接</button>
    <button id="deny">拒绝</button>
  </section>
</main>
```

浏览器代码需构建工具和含 OAuth Server API 的 Supabase JS v2；前端只能放 publishable key，不能放 `service_role` 或 Apple 私钥。

`web/consent.ts`：

<!-- file: web/consent.ts -->
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://YOUR_PROJECT_REF.supabase.co',
  'YOUR_SUPABASE_PUBLISHABLE_KEY',
);
const element = (id: string) => document.getElementById(id)!;
const status = element('status');
const authorizationId = new URL(location.href).searchParams.get('authorization_id');

async function loadConsent() {
  if (!authorizationId) {
    status.textContent = '缺少授权请求，请回到 Codex 重新连接。';
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  // 这里只决定显示登录还是同意页；权限由 Supabase 与后端重新验证。
  if (!sessionData.session) {
    element('login').hidden = false;
    return;
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    status.textContent = '授权请求已失效，请回到 Codex 重新连接。';
    return;
  }
  if (!('authorization_id' in data)) {
    // 已同意的请求，由 Supabase 返回下一步地址。
    location.assign(data.redirect_url);
    return;
  }
  element('login').hidden = true;
  element('client').textContent = `请求连接的应用：${data.client.name}`;
  element('scopes').textContent = `账号信息范围：${data.scope || '未指定'}`;
  element('consent').hidden = false;
}

element('login').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!authorizationId) return;
  const returnTo = new URL('/oauth/consent', location.origin);
  returnTo.searchParams.set('authorization_id', authorizationId);
  const { error } = await supabase.auth.signInWithOtp({
    email: (element('email') as HTMLInputElement).value,
    options: { emailRedirectTo: returnTo.href },
  });
  status.textContent = error ? '发送失败，请稍后再试。' : '请在邮件中完成登录，再回到授权页面。';
});

async function decide(allow: boolean) {
  if (!authorizationId) return;
  const buttons = ['allow', 'deny'].map((id) => element(id) as HTMLButtonElement);
  buttons.forEach((button) => { button.disabled = true; });
  const { data, error } = allow
    ? await supabase.auth.oauth.approveAuthorization(authorizationId)
    : await supabase.auth.oauth.denyAuthorization(authorizationId);
  if (error || !data) {
    status.textContent = '没有完成连接，请重试或回到 Codex 重新发起。';
    buttons.forEach((button) => { button.disabled = false; });
    return;
  }
  location.assign(data.redirect_url);
}

element('allow').addEventListener('click', () => { void decide(true); });
element('deny').addEventListener('click', () => { void decide(false); });
await loadConsent();
```

Auth Redirect URLs 允许 `/oauth/consent` 及授权参数。首轮同浏览器完成邮件登录；生产环境另验现有回调、跨设备邮件、限流与错误。[Supabase 邮件登录](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[同意页 API](https://supabase.com/docs/guides/auth/oauth-server/getting-started#build-your-authorization-ui)

仅跳转 Supabase 验证后返回的 `redirect_url`，不用任意 URL 参数；名称和 scope 用 `textContent` 显示。

<div class="heading-alias" id="到这里就停" aria-hidden="true"></div>

## 验收标准

核对发现文档、测试用户资格和 Hook 范围；[第五课](05-connect-and-verify.md) 验证登录与 audience，下一步准备 [Apple 凭证](03-apple-weatherkit.md)。
