import { z } from 'zod';
import type { Location } from './config.js';

const time = z.iso.datetime({ offset: true });
const ratio = z.number().min(0).max(1);
const metadata = z.object({
  attributionURL: z.url(), readTime: time, expireTime: time,
  units: z.literal('m').or(z.literal('metric')).optional(),
  temporarilyUnavailable: z.boolean().optional(),
});
const conditions = {
  conditionCode: z.string(), temperature: z.number(), temperatureApparent: z.number(),
  humidity: ratio, windSpeed: z.number().nonnegative(), uvIndex: z.number().int().nonnegative(),
};
export const weatherSchema = z.object({
  currentWeather: z.object({ metadata, asOf: time, ...conditions }),
  forecastHourly: z.object({
    metadata,
    hours: z.array(z.object({
      forecastStart: time, ...conditions, precipitationChance: ratio, daylight: z.boolean().optional(),
    })).min(1).max(400),
  }),
  forecastDaily: z.object({
    metadata,
    days: z.array(z.object({
      forecastStart: time, forecastEnd: time, conditionCode: z.string(),
      temperatureMin: z.number(), temperatureMax: z.number(), precipitationChance: ratio,
      maxUvIndex: z.number().int().nonnegative(), sunrise: time.optional(), sunset: time.optional(),
    })).min(1).max(20),
  }),
});
export type Weather = z.infer<typeof weatherSchema>;

const attributionSchema = z.object({
  serviceName: z.string().min(1), 'logoLight@2x': z.string().min(1), 'logoDark@2x': z.string().min(1),
});
export const sourceSchema = z.object({
  mode: z.enum(['live', 'fixture']), provider: z.literal('Apple Weather'),
  fetchedAt: time, expiresAt: time, cacheHit: z.boolean(),
  attribution: z.object({ serviceName: z.string(), legalUrls: z.array(z.url()), logoLight: z.url(), logoDark: z.url() }),
});
export type Snapshot = { weather: Weather; source: z.infer<typeof sourceSchema> };

type Options = {
  getToken: (now: number) => Promise<string>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  mode?: 'live' | 'fixture';
  timeoutMs?: number;
};

export class WeatherKit {
  private readonly cache = new Map<string, Snapshot>();
  private attribution: z.infer<typeof attributionSchema> | undefined;
  private readonly request: typeof globalThis.fetch;
  readonly now: () => number;

  constructor(private readonly options: Options) {
    this.request = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  private async getJson(path: string, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    const token = await this.options.getToken(this.now());
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.request(new URL(path, 'https://weatherkit.apple.com'), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: combined, redirect: 'error',
      });
    } catch {
      if (signal?.aborted) throw new Error('天气查询已取消。');
      if (timeout.aborted) throw new Error('WeatherKit 请求超时，请稍后重试。');
      throw new Error('无法连接 WeatherKit，请检查网络；没有使用旧天气或模拟数据替代。');
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) {
        throw new Error(`WeatherKit 认证失败（${response.status}）：检查会员、WeatherKit 密钥、Team ID、Service ID 和系统时间。`);
      }
      if (response.status === 429) throw new Error('WeatherKit 请求限流或额度不足（429），请稍后重试并查看开发者后台用量。');
      throw new Error(`WeatherKit 请求失败（HTTP ${response.status}），没有可用的新天气数据。`);
    }
    try { return await response.json(); }
    catch {
      if (signal?.aborted) throw new Error('天气查询已取消。');
      if (timeout.aborted) throw new Error('WeatherKit 响应读取超时。');
      throw new Error('WeatherKit 返回的内容不是有效 JSON。');
    }
  }

  async get(location: Location, refresh = false, signal?: AbortSignal): Promise<Snapshot> {
    signal?.throwIfAborted();
    const key = `${location.latitude},${location.longitude},${location.timezone}`;
    const cached = this.cache.get(key);
    if (!refresh && cached && this.now() < Date.parse(cached.source.expiresAt)) {
      return { ...cached, source: { ...cached.source, cacheHit: true } };
    }
    // 失效的缓存不参与网络失败后的返回，防止旧数据被当成新预报。
    this.cache.delete(key);
    const startedAt = this.now();
    const url = new URL(`/api/v1/weather/zh-Hans/${location.latitude}/${location.longitude}`, 'https://weatherkit.apple.com');
    url.searchParams.set('dataSets', 'currentWeather,forecastHourly,forecastDaily');
    url.searchParams.set('timezone', location.timezone);
    url.searchParams.set('hourlyEnd', new Date(startedAt + 73 * 3_600_000).toISOString());
    const parsed = weatherSchema.safeParse(await this.getJson(url.pathname + url.search, signal));
    if (!parsed.success) throw new Error('WeatherKit 数据缺少所需字段或单位无效，无法可靠整理天气。');
    const weather = parsed.data;
    const metas = [weather.currentWeather.metadata, weather.forecastHourly.metadata, weather.forecastDaily.metadata];
    if (metas.some(meta => meta.temporarilyUnavailable)) throw new Error('WeatherKit 标记天气数据暂时不可用。');
    const expiresAt = Math.min(startedAt + 5 * 60_000, ...metas.map(meta => Date.parse(meta.expireTime)));
    if (expiresAt <= this.now()) throw new Error('WeatherKit 返回的数据已经过期，请稍后重试。');
    if (!this.attribution) {
      const attribution = attributionSchema.safeParse(await this.getJson('/attribution/zh-Hans', signal));
      if (!attribution.success) throw new Error('WeatherKit 署名信息不完整，无法提供完整的数据来源。');
      this.attribution = attribution.data;
    }
    const source: Snapshot['source'] = {
      mode: this.options.mode ?? 'live', provider: 'Apple Weather',
      fetchedAt: new Date(this.now()).toISOString(), expiresAt: new Date(expiresAt).toISOString(), cacheHit: false,
      attribution: {
        serviceName: this.attribution.serviceName,
        legalUrls: [...new Set(metas.map(meta => meta.attributionURL))],
        logoLight: new URL(this.attribution['logoLight@2x'], 'https://weatherkit.apple.com').href,
        logoDark: new URL(this.attribution['logoDark@2x'], 'https://weatherkit.apple.com').href,
      },
    };
    signal?.throwIfAborted();
    if (expiresAt <= this.now()) throw new Error('天气数据在读取期间过期，请重新查询。');
    const snapshot = { weather, source };
    // 常用地点数量有上限；该服务不把天气数据持久保存到磁盘。
    if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, snapshot);
    return snapshot;
  }
}
