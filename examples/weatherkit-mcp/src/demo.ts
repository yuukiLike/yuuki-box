import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { fixtureFetch, fixtureLocation, fixtureNow } from '../fixtures/weather.js';
import { reportSchema, windowsSchema } from './forecast.js';
import { createServer } from './server.js';
import { WeatherKit } from './weatherkit.js';

console.log('[离线演示] 人工样本：上海 2026-10-26 08:30；不访问 Apple，不代表真实天气。');
const server = createServer(new WeatherKit({ getToken: async () => 'fixture', fetch: fixtureFetch, now: () => fixtureNow, mode: 'fixture' }), [fixtureLocation]);
const client = new Client({ name: 'weatherkit-demo', version: '1.0.0' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  console.log('[MCP] tools/list → ' + (await client.listTools()).tools.map(tool => tool.name).join(', '));
  const weatherResult = await client.callTool({ name: 'get_weather', arguments: { location: '上海', hours: 6 } });
  assert.ok(!weatherResult.isError);
  const report = reportSchema.parse(weatherResult.structuredContent);
  console.log(`[天气] mode=${report.source.mode} | cacheHit=${report.source.cacheHit} | ${report.current.temperatureC}°C`);
  const windowResult = await client.callTool({ name: 'find_outdoor_windows', arguments: { location: '上海', date: '2026-10-26', durationHours: 2 } });
  assert.ok(!windowResult.isError);
  const result = windowsSchema.parse(windowResult.structuredContent);
  console.log(`[时段] cacheHit=${result.source.cacheHit} | 时区=${result.location.timezone}`);
  for (const window of result.windows) console.log(`${window.localStart} 起 ${window.hours.length} 小时 | 最大降雨概率 ${Math.max(...window.hours.map(hour => hour.rainChancePercent))}%`);
  console.log('[解释] ' + result.explanation);
} finally {
  await client.close();
  await server.close();
}
