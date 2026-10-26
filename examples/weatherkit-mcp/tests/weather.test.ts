import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureAttribution, fixtureFetch, fixtureLocation, fixtureNow, fixtureWeather } from '../fixtures/weather.js';
import { findWindows, makeReport, windowInputSchema } from '../src/forecast.js';
import { WeatherKit, type Weather } from '../src/weatherkit.js';

test('请求使用 Apple 固定域名、认证和当地时区；缓存命中、过期和刷新可区分', async () => {
  let now = fixtureNow;
  const paths: string[] = [];
  const weather = new WeatherKit({
    now: () => now, getToken: async () => 'test-token',
    fetch: async (input, options) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://weatherkit.apple.com');
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-token');
      assert.equal(options?.redirect, 'error');
      paths.push(url.pathname);
      if (url.pathname.startsWith('/api/')) {
        assert.equal(url.searchParams.get('timezone'), 'Asia/Shanghai');
        assert.equal(url.searchParams.get('dataSets'), 'currentWeather,forecastHourly,forecastDaily');
        assert.equal(url.searchParams.has('units'), false);
      }
      return fixtureFetch(input, options);
    },
  });
  const first = await weather.get(fixtureLocation);
  assert.equal(first.source.cacheHit, false);
  assert.equal(first.source.mode, 'live');
  assert.equal(first.source.attribution.legalUrls[0], 'https://weatherkit.apple.com/legal-attribution.html');
  assert.equal(paths.length, 2);
  assert.equal((await weather.get(fixtureLocation)).source.cacheHit, true);
  assert.equal(paths.length, 2);
  now += 5 * 60_000;
  assert.equal((await weather.get(fixtureLocation)).source.cacheHit, false);
  assert.equal(paths.length, 3);
  await weather.get(fixtureLocation, true);
  assert.equal(paths.length, 4);
});

test('HTTP 失败不泄露响应或令牌，不重试，也不回退到缓存', async () => {
  for (const status of [401, 403, 429, 500]) {
    let fail = false;
    let calls = 0;
    const weather = new WeatherKit({ now: () => fixtureNow, getToken: async () => 'secret-token', fetch: async (input, options) => {
      calls++;
      return fail ? new Response('secret-body', { status }) : fixtureFetch(input, options);
    } });
    await weather.get(fixtureLocation);
    fail = true;
    await assert.rejects(weather.get(fixtureLocation, true), error => {
      assert.match(String(error), new RegExp(String(status)));
      assert.doesNotMatch(String(error), /secret/);
      return true;
    });
    assert.equal(calls, 3);
    await assert.rejects(weather.get(fixtureLocation));
    assert.equal(calls, 4);
  }
});

test('缺失字段、错误概率、临时不可用和过期数据不能伪装成好天气', async () => {
  const missing: Partial<ReturnType<typeof fixtureWeather>> = fixtureWeather();
  delete missing.forecastHourly;
  const invalid = fixtureWeather();
  invalid.forecastHourly.hours[0]!.precipitationChance = 80;
  const unavailable = fixtureWeather();
  Object.assign(unavailable.currentWeather.metadata, { temporarilyUnavailable: true });
  const expired = fixtureWeather();
  expired.forecastHourly.metadata.expireTime = '2026-10-25T00:00:00Z';
  for (const data of [missing, invalid, unavailable, expired]) {
    const weather = new WeatherKit({ now: () => fixtureNow, getToken: async () => 'test', fetch: async () => Response.json(data) });
    await assert.rejects(weather.get(fixtureLocation));
  }
});

test('非 JSON、网络失败、取消和超时都有真实失败结果', async () => {
  const token = async () => 'test';
  await assert.rejects(new WeatherKit({ getToken: token, fetch: async () => new Response('html') }).get(fixtureLocation), /JSON/);
  await assert.rejects(new WeatherKit({ getToken: token, fetch: async () => { throw new Error('secret'); } }).get(fixtureLocation), /无法连接/);
  let calls = 0;
  const cancelled = new WeatherKit({ getToken: token, fetch: async () => { calls++; return Response.json({}); } });
  await assert.rejects(cancelled.get(fixtureLocation, false, AbortSignal.abort()));
  assert.equal(calls, 0);
  const slowFetch: typeof fetch = async (_, options) => new Promise((_, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('too late')), 1000);
    options?.signal?.addEventListener('abort', () => { clearTimeout(keepAlive); reject(new Error('aborted')); }, { once: true });
  });
  await assert.rejects(new WeatherKit({ getToken: token, fetch: slowFetch, timeoutMs: 10 }).get(fixtureLocation), /超时/);
  const controller = new AbortController();
  const pending = new WeatherKit({ getToken: token, fetch: slowFetch }).get(fixtureLocation, false, controller.signal);
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, /取消/);
});

async function reportFor(data: Weather = fixtureWeather() as Weather) {
  const weather = new WeatherKit({ now: () => fixtureNow, mode: 'fixture', getToken: async () => 'test', fetch: async input => {
    return Response.json(String(input).includes('/attribution/') ? fixtureAttribution : data);
  } });
  return makeReport(await weather.get(fixtureLocation), fixtureLocation, fixtureNow, 73, 10);
}

test('单位转换与当地日历日期准确，连续时段避开下雨、过去和夜间', async () => {
  const report = await reportFor();
  assert.equal(report.current.humidityPercent, 65);
  assert.equal(report.current.windKph, 12);
  assert.equal(report.hourly[0]!.rainChancePercent, 10);
  assert.equal(report.daily[0]!.date, '2026-10-26');
  const criteria = windowInputSchema.parse({ location: '上海', date: '2026-10-26', durationHours: 2 });
  const result = findWindows(report, criteria);
  assert.deepEqual(result.windows.map(window => window.localStart), ['2026-10-26 11:00', '2026-10-26 14:00', '2026-10-26 16:00']);
  assert.deepEqual(findWindows(report, { ...criteria, maxRainChancePercent: 90 }).windows.map(window => window.localStart),
    ['2026-10-26 09:00', '2026-10-26 11:00', '2026-10-26 13:00', '2026-10-26 15:00']);
  for (const window of result.windows) {
    assert.equal(Date.parse(window.end) - Date.parse(window.start), 2 * 3_600_000);
    assert.ok(window.hours.every(hour => hour.rainChancePercent <= 30 && hour.daylight));
  }
});

test('概率阈值不被显示舍入放宽，非整点时区不会越过当地结束时间', async () => {
  const data = fixtureWeather();
  for (const hour of data.forecastHourly.hours) hour.precipitationChance = 0.3004;
  const report = await reportFor(data as Weather);
  assert.ok(report.hourly[0]!.rainChancePercent > 30);
  const criteria = windowInputSchema.parse({ location: '上海', maxRainChancePercent: 30 });
  assert.equal(findWindows(report, criteria).windows.length, 0);
  const offsetReport = await reportFor();
  offsetReport.location = { ...fixtureLocation, name: '测试半小时时区', timezone: 'Asia/Kolkata' };
  const offsetCriteria = windowInputSchema.parse({ location: '测试半小时时区', date: '2026-10-26', startHour: 9, endHour: 10, daylightOnly: false });
  // 09:30–10:30 不能被当成 09:00–10:00 内的一小时。
  assert.equal(findWindows(offsetReport, offsetCriteria).windows.length, 0);
});

test('预报缺口不能被拼接；缺少 daylight 不当作白天；空结果与无覆盖不同', async () => {
  const report = await reportFor();
  const criteria = windowInputSchema.parse({ location: '上海', date: '2026-10-26', durationHours: 2 });
  report.hourly = report.hourly.filter(hour => !hour.localStart.endsWith('12:00'));
  assert.ok(findWindows(report, criteria).windows.every(window => !window.localStart.endsWith('11:00')));
  for (const hour of report.hourly) hour.daylight = null;
  assert.equal(findWindows(report, criteria).windows.length, 0);
  assert.ok(findWindows(report, criteria).coverage.missingDaylightHours > 0);
  assert.ok(findWindows(report, { ...criteria, daylightOnly: false }).windows.length > 0);
  assert.throws(() => findWindows(report, { ...criteria, date: '2026-11-20' }), /没有可用/);
  assert.equal(findWindows(report, { ...criteria, maxWindKph: 0 }).windows.length, 0);
});
