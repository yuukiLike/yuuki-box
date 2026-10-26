# 3 · 让 Supabase 后端向 Apple 查询天气

[上一课](02-supabase-auth.md) · [目录](README.md) · [下一课：MCP 工具](04-mcp-server.md)

**这一课的目标：用你自己的 Apple 开发者凭证，在服务器取得当前天气。**

这里选择 WeatherKit **REST API**。它可以从 Supabase Edge Function 发起 HTTPS 请求，不要求你的后端运行在 Apple 设备上。[WeatherKit 概览](https://developer.apple.com/weatherkit/)

## 1. 准备四个值

在 Apple Developer 的 **Certificates, Identifiers & Profiles** 中创建启用了 WeatherKit 的 Key，下载 `.p8` 私钥；再创建一个 Services ID。REST API 的 `sub` 使用这个 Services ID，不要把 Supabase 项目 ID 填进去。

| 后端配置 | 从哪里取得 | 是否能交给 Codex / 浏览器 |
| --- | --- | --- |
| `APPLE_TEAM_ID` | Apple 开发者团队 ID | 标识本身不是密码，但没必要传给工具 |
| `APPLE_KEY_ID` | 下载的 WeatherKit Key 对应的 ID | 同上 |
| `APPLE_SERVICE_ID` | 你注册的 Services ID，如 `com.example.weather` | 同上 |
| `APPLE_PRIVATE_KEY_BASE64` | `.p8` 文件内容的 Base64 | **不能**；编码不等于加密 |

私钥保存在 Supabase Edge Function Secrets。教程只出现配置名称，不要求把实际私钥粘贴到聊天或代码仓库。[Apple 的创建与认证步骤](https://developer.apple.com/documentation/weatherkitrestapi/request-authentication-for-weatherkit-rest-api)

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

时间只是格式示例，运行时重新计算。这证明的是**你的开发者团队与服务身份**，不是终端用户身份。Apple token 不放用户邮箱、Supabase token，也不复制前一课的 MCP `aud`。

这份教程给 Apple token 设定十分钟有效期，这是示例的选择，不是声称 Apple 规定必须十分钟。[JWT 字段与 ES256 签名要求](https://developer.apple.com/documentation/weatherkitrestapi/request-authentication-for-weatherkit-rest-api)

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

下面的文件只做四件事：选城市、生成 Apple token、请求 Apple、校验并整理结果。用户资格和额度留给下一课。

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

`weatherkit.ts` 的 import 映射在下一课 `deno.json` 中给出。这里先看懂数据经过哪里，不用现在就运行整段代码。

## 4. 为什么不直接把 Apple JSON 原样交给模型

我们只保留当前天气需要的字段，并把单位写进字段名：温度为摄氏度，湿度由 `0..1` 转为百分比，风速为 `km/h`。`conditionCode` 保留上游代码，避免把未知天气代码武断翻译为“晴”。`asOf` 是数据时间，不能替换成“本次请求的电脑时间”。[当前天气字段](https://developer.apple.com/documentation/weatherkitrestapi/currentweather/currentweatherdata)

请求只取 `currentWeather`，带明确时区，不添加未在当前接口文档列出的 `units=si` 等参数。这里验证 `metadata.units === 'm'` 才使用公制单位；字段缺失、数据过期、上游不可用都作为失败处理，不返回假天气。[天气查询接口](https://developer.apple.com/documentation/weatherkitrestapi/get-api-v1-weather-_language_-_latitude_-_longitude_)、[响应元数据](https://developer.apple.com/documentation/weatherkitrestapi/metadata)

教学版每次工具调用会请求**天气与标识两个 Apple 端点**。第二课的“20 次”是用户工具调用额度，不是精确的 Apple 请求计费数。优化前先看 Apple 开发者后台的实际用量；不要把一次工具调用等同于一次上游请求。

## 5. 来源标识属于结果的一部分

Apple 要求显示天气数据时呈现 Apple Weather 标识，并提供其他数据来源的法律链接。`/attribution/{language}` 提供标识资源地址；`currentWeather.metadata.attributionURL` 提供来源链接。标识返回值可能是相对路径，因此示例补全 Apple 域名。[标识资源](https://developer.apple.com/documentation/weatherkitrestapi/attribution)、[Apple 展示要求](https://developer.apple.com/weatherkit/)

MCP 工具可以返回这些地址，但**返回地址不等于 Codex 已经显示了合规标识**。模型可能只输出文字，Host 也未必渲染远程图片。第五课会把“最终用户看见标识与可点击来源”列成独立验收项；没有通过时，先保留为开发联调，不把它作为已完成的公开产品。

这里的 `enabled` 和限额是访问控制练习。Apple 的条款对原始天气数据收费、批量分发、派生数据库和缓存都有约束，不能直接把它包装成“买套餐转售原始天气 API”。本例不存原始天气，也不做批量下载；后续如需商业化，应按实际产品核对条款。[Developer Program 协议，Attachment 8](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)

## 到这里就停

能指出 `.p8` 只在后端、Apple token 只发给 Apple、结果必须保留时间与来源，就完成本课。下一课把它接到 [MCP 工具](04-mcp-server.md)，再一起部署验证。
