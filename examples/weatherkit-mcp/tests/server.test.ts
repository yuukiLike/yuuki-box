import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import { fixtureFetch, fixtureLocation, fixtureNow } from '../fixtures/weather.js';
import { loadConfig, locationsSchema } from '../src/config.js';
import { reportSchema, windowsSchema } from '../src/forecast.js';
import { createServer } from '../src/server.js';
import { WeatherKit } from '../src/weatherkit.js';

async function configuration(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'weatherkit-course-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const keyPath = join(directory, 'test.p8');
  const locationsPath = join(directory, 'locations.json');
  await writeFile(keyPath, await exportPKCS8(privateKey), { mode: 0o600 });
  await writeFile(locationsPath, JSON.stringify([fixtureLocation]));
  return { publicKey, env: {
    APPLE_TEAM_ID: 'ABCDEFGHIJ', APPLE_KEY_ID: 'KLMNOPQRST', APPLE_SERVICE_ID: 'com.example.weather',
    APPLE_PRIVATE_KEY_PATH: keyPath, WEATHERKIT_LOCATIONS_FILE: locationsPath,
  } };
}

test('生成可验签的 ES256 JWT，字段与 Apple 规范一致；到期前续签', async t => {
  const { publicKey, env } = await configuration(t);
  const config = await loadConfig(env);
  const token = await config.getToken(fixtureNow);
  const { payload, protectedHeader } = await jwtVerify(token, publicKey, { currentDate: new Date(fixtureNow), algorithms: ['ES256'] });
  assert.deepEqual(protectedHeader, { alg: 'ES256', kid: env.APPLE_KEY_ID, id: `${env.APPLE_TEAM_ID}.${env.APPLE_SERVICE_ID}` });
  assert.deepEqual(payload, { iss: env.APPLE_TEAM_ID, sub: env.APPLE_SERVICE_ID, iat: fixtureNow / 1000, exp: fixtureNow / 1000 + 1800 });
  assert.equal(await config.getToken(fixtureNow + 60_000), token);
  assert.notEqual(await config.getToken(fixtureNow + 1740_000), token);
});

test('配置缺失、无效密钥、重复地点和非法坐标有明确失败', async t => {
  await assert.rejects(loadConfig({}), /缺少 APPLE_TEAM_ID/);
  const { env } = await configuration(t);
  await assert.rejects(loadConfig({ ...env, APPLE_PRIVATE_KEY_PATH: './test.p8' }), /绝对路径/);
  await writeFile(env.APPLE_PRIVATE_KEY_PATH, 'secret-invalid-key');
  await assert.rejects(loadConfig(env), error => {
    assert.match(String(error), /私钥/);
    assert.doesNotMatch(String(error), /secret-invalid-key/);
    return true;
  });
  for (const locations of [[fixtureLocation, fixtureLocation], [{ ...fixtureLocation, latitude: 91 }], [{ ...fixtureLocation, timezone: 'not-a-timezone' }]]) {
    assert.equal(locationsSchema.safeParse(locations).success, false);
  }
});

test('MCP 发现、参数拒绝、天气与时段结果都经过协议；无效调用不联网', async () => {
  let calls = 0;
  const weather = new WeatherKit({ now: () => fixtureNow, mode: 'fixture', getToken: async () => 'test', fetch: async (input, options) => {
    calls++;
    return fixtureFetch(input, options);
  } });
  const server = createServer(weather, [fixtureLocation]);
  const client = new Client({ name: 'weather-tests', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), ['list_locations', 'get_weather', 'find_outdoor_windows']);
    assert.ok(tools.every(tool => tool.annotations?.readOnlyHint));
    for (const [name, args] of [
      ['get_weather', { location: '未知地点' }],
      ['get_weather', { location: '上海', hours: 1000 }],
      ['get_weather', { location: '上海', surprise: true }],
      ['find_outdoor_windows', { location: '上海', startHour: 22, endHour: 7 }],
      ['find_outdoor_windows', { location: '上海', minFeelsLikeC: 30, maxFeelsLikeC: 10 }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true);
    }
    assert.equal(calls, 0);
    const report = await client.callTool({ name: 'get_weather', arguments: { location: '上海' } });
    assert.ok(!report.isError);
    assert.equal(reportSchema.parse(report.structuredContent).source.mode, 'fixture');
    const windows = await client.callTool({ name: 'find_outdoor_windows', arguments: { location: '上海', date: '2026-10-26', durationHours: 2 } });
    assert.ok(!windows.isError);
    const parsed = windowsSchema.parse(windows.structuredContent);
    assert.equal(parsed.source.cacheHit, true);
    assert.equal(parsed.windows.length, 3);
    assert.equal(calls, 2);
  } finally { await client.close(); await server.close(); }
});

test('真实 stdio 入口可发现工具和列出地点；只使用临时测试密钥，不访问 Apple', async t => {
  const { env } = await configuration(t);
  const client = new Client({ name: 'weather-stdio-test', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/stdio.js', import.meta.url))], env });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 3);
    const result = await client.callTool({ name: 'list_locations', arguments: {} });
    assert.deepEqual(result.structuredContent, { locations: [fixtureLocation] });
  } finally { await client.close(); }
});

test('客户端取消 MCP 调用会中止正在等待的天气 HTTP 请求', { timeout: 2000 }, async () => {
  let started!: () => void;
  let aborted!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const stopped = new Promise<void>(resolve => { aborted = resolve; });
  const server = createServer(new WeatherKit({ getToken: async () => 'test', fetch: async (_, options) => new Promise((_, reject) => {
    options!.signal!.addEventListener('abort', () => { aborted(); reject(new Error('cancelled')); }, { once: true });
    started();
  }) }), [fixtureLocation]);
  const client = new Client({ name: 'cancel-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const controller = new AbortController();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const rejected = assert.rejects(client.callTool({ name: 'get_weather', arguments: { location: '上海' } }, { signal: controller.signal }));
    await ready;
    controller.abort();
    await rejected;
    await stopped;
  } finally { await client.close(); await server.close(); }
});
