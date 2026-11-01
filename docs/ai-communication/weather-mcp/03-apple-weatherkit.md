# 3 · 从 Supabase 后端查询 Apple 天气

[上一课](02-supabase-auth.md) · [目录](README.md) · [下一课：MCP 工具](04-mcp-server.md)

用 Apple 开发者凭证，<mark class="key">在后端取得当前天气</mark>。

WeatherKit REST API 可由 Supabase Edge Function 调用，无需 Apple 设备。[WeatherKit 概览](https://developer.apple.com/weatherkit/)

## 1. 准备四个值

在 Apple Developer 的 **Certificates, Identifiers & Profiles** 创建 WeatherKit Key、下载 `.p8`，再建 Services ID；它用于 REST API 的 `sub`，不是 Supabase 项目 ID。

| 后端配置 | 从哪里取得 | 是否能交给 Codex / 浏览器 |
| --- | --- | --- |
| `APPLE_TEAM_ID` | Apple 开发者团队 ID | 标识本身不是密码，但没必要传给工具 |
| `APPLE_KEY_ID` | 下载的 WeatherKit Key 对应的 ID | 同上 |
| `APPLE_SERVICE_ID` | 注册的 Services ID，如 `com.example.weather` | 同上 |
| `APPLE_PRIVATE_KEY_BASE64` | `.p8` 文件内容的 Base64 | **不能**；编码不等于加密 |

私钥只放 Supabase Edge Function Secrets，不进聊天或仓库。[Apple 的创建与认证步骤](https://developer.apple.com/documentation/weatherkitrestapi/request-authentication-for-weatherkit-rest-api)

## 2. 看清 Apple token 代表谁

JWT 的 header：

```json
{
  "alg": "ES256",
  "kid": "APPLE_KEY_ID",
  "id": "APPLE_TEAM_ID.APPLE_SERVICE_ID"
}
```

payload 只放 Apple 文档要求的四个 claims：

```json
{
  "iss": "APPLE_TEAM_ID",
  "sub": "APPLE_SERVICE_ID",
  "iat": 1792972800,
  "exp": 1792973400
}
```

时间在运行时计算；Apple token 代表开发者团队与服务，不放用户邮箱、Supabase token 或 MCP `aud`。

示例选择十分钟有效期，并非 Apple 的强制时长。[JWT 字段与 ES256 签名要求](https://developer.apple.com/documentation/weatherkitrestapi/request-authentication-for-weatherkit-rest-api)

## 3. 写 WeatherKit 适配器

先准备一个读取服务器配置的小函数。

`supabase/functions/weather-mcp/env.ts`：

<!-- file: supabase/functions/weather-mcp/env.ts -->
```ts
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
```

适配器负责选城市、签名、请求、校验结果；用户资格与额度留到下一课。

`supabase/functions/weather-mcp/weatherkit.ts`：

<!-- file: supabase/functions/weather-mcp/weatherkit.ts -->
```ts
import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { requireEnv } from './env.ts';

export const cities = {
  上海: { latitude: 31.2304, longitude: 121.4737 },
  北京: { latitude: 39.9042, longitude: 116.4074 },
  杭州: { latitude: 30.2741, longitude: 120.1551 },
} as const;
export type City = keyof typeof cities;

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const appleResponse = z.object({
  currentWeather: z.object({
    asOf: timestamp,
    conditionCode: z.string().min(1),
    temperature: z.number(),
    temperatureApparent: z.number(),
    humidity: z.number().min(0).max(1),
    windSpeed: z.number().min(0),
    metadata: z.object({
      attributionURL: z.url(),
      expireTime: timestamp,
      units: z.literal('m'),
      temporarilyUnavailable: z.boolean().optional(),
    }),
  }),
});
const attributionResponse = z.object({
  'logoDark@2x': z.string().min(1),
  'logoLight@2x': z.string().min(1),
});

export class WeatherKitError extends Error {
  constructor(public readonly code: string, public readonly upstreamStatus?: number) {
    super(code);
  }
}

export async function createAppleToken(): Promise<string> {
  const team = requireEnv('APPLE_TEAM_ID');
  const service = requireEnv('APPLE_SERVICE_ID');
  const pem = atob(requireEnv('APPLE_PRIVATE_KEY_BASE64'));
  const key = await importPKCS8(pem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: requireEnv('APPLE_KEY_ID'),
      id: `${team}.${service}`,
    })
    .setIssuer(team)
    .setSubject(service)
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(key);
}

async function appleJson(url: URL, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  if (!response.ok) throw new WeatherKitError('APPLE_HTTP_ERROR', response.status);
  return response.json();
}

function logoUrl(path: string): string {
  const url = new URL(path, 'https://weatherkit.apple.com');
  if (url.origin !== 'https://weatherkit.apple.com') {
    throw new WeatherKitError('INVALID_ATTRIBUTION_URL');
  }
  return url.href;
}

export async function getCurrentWeather(city: City) {
  const { latitude, longitude } = cities[city];
  const url = new URL(
    `https://weatherkit.apple.com/api/v1/weather/zh-Hans/${latitude}/${longitude}`,
  );
  url.searchParams.set('dataSets', 'currentWeather');
  url.searchParams.set('timezone', 'Asia/Shanghai');

  const token = await createAppleToken();
  const [rawWeather, rawAttribution] = await Promise.all([
    appleJson(url, token),
    appleJson(new URL('https://weatherkit.apple.com/attribution/zh-Hans'), token),
  ]);
  const { currentWeather: weather } = appleResponse.parse(rawWeather);
  const attribution = attributionResponse.parse(rawAttribution);
  if (weather.metadata.temporarilyUnavailable) {
    throw new WeatherKitError('APPLE_TEMPORARILY_UNAVAILABLE');
  }
  if (Date.parse(weather.metadata.expireTime) <= Date.now()) {
    throw new WeatherKitError('APPLE_DATA_EXPIRED');
  }
  const legalUrl = new URL(weather.metadata.attributionURL);
  if (legalUrl.protocol !== 'https:') throw new WeatherKitError('INVALID_LEGAL_URL');

  return {
    city,
    asOf: weather.asOf,
    timezone: 'Asia/Shanghai',
    conditionCode: weather.conditionCode,
    temperatureC: weather.temperature,
    feelsLikeC: weather.temperatureApparent,
    humidityPercent: Math.round(weather.humidity * 100),
    windSpeedKmh: weather.windSpeed,
    expiresAt: weather.metadata.expireTime,
    attribution: {
      provider: 'Apple Weather',
      legalUrl: legalUrl.href,
      logoDarkUrl: logoUrl(attribution['logoDark@2x']),
      logoLightUrl: logoUrl(attribution['logoLight@2x']),
    },
  };
}
```

import 映射见下一课 `deno.json`；此处先阅读数据路径。

<details class="qa" id="4-为什么不直接把-apple-json-原样交给模型">
<summary>为什么要整理 Apple 返回的数据？</summary>

只取所需字段，标明摄氏度、百分比、`km/h`，保留 `conditionCode` 和真实 `asOf`。[字段说明](https://developer.apple.com/documentation/weatherkitrestapi/currentweather/currentweatherdata)

只请求 `currentWeather`，带明确时区并验证 `metadata.units === 'm'`。缺字段、过期或上游失败都报错。[天气接口](https://developer.apple.com/documentation/weatherkitrestapi/get-api-v1-weather-_language_-_latitude_-_longitude_)、[元数据](https://developer.apple.com/documentation/weatherkitrestapi/metadata)

每次工具调用会请求天气和标识两个端点；用户工具额度不等于 Apple 请求计数。

</details>

## 5. 来源标识属于结果的一部分

展示须有 Apple Weather 标识及法律来源链接。`/attribution/{language}` 返回标识地址，`metadata.attributionURL` 返回来源；相对标识路径需补 Apple 域名。[标识资源](https://developer.apple.com/documentation/weatherkitrestapi/attribution)、[Apple 展示要求](https://developer.apple.com/weatherkit/)

<mark class="caution">返回标识地址不等于用户看见标识。</mark>Host 可能不渲染图片；第五课独立验收实际标识与来源，未通过前仅作开发联调。

资格与额度仅为访问控制练习。本例不存原始天气或批量下载；商业化需另核对原始数据收费、分发、派生数据库与缓存条款。[Developer Program 协议，Attachment 8](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)

<div class="heading-alias" id="到这里就停" aria-hidden="true"></div>

## 验收标准

核对私钥留后端、token 只发 Apple、结果保留时间来源，再接 [MCP 工具](04-mcp-server.md)。
