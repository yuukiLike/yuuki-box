import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { createSseServer } from './03-sse-http.ts';
import { readEvents } from './sse.ts';

async function startServer(t) {
  const server = createSseServer({ intervalMs: 15 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('真实 HTTP：响应类型、按游标补发与非法请求', { timeout: 5000 }, async (t) => {
  const { url } = await startServer(t);
  const page = await fetch(url);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.match(await page.text(), /模拟断流重连/);

  const response = await fetch(`${url}/events`, { headers: { 'Last-Event-ID': '2' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/event-stream/);
  const events = [];
  for await (const event of readEvents(response.body)) events.push(event);
  assert.deepEqual(events.map((event) => event.event), ['delta', 'delta', 'completed']);
  assert.equal(events.filter((event) => event.event === 'delta').map((event) => JSON.parse(event.data).text).join(''), 'SSE。');

  for (const cursor of ['-1', '6', 'abc', '01']) {
    const invalid = await fetch(`${url}/events`, { headers: { 'Last-Event-ID': cursor } });
    assert.equal(invalid.status, 400);
    await invalid.text();
  }
  assert.equal((await fetch(`${url}/events`, { headers: { 'Last-Event-ID': '5' } })).status, 204);
  const missing = await fetch(`${url}/missing`);
  assert.equal(missing.status, 404);
  await missing.text();
  const post = await fetch(`${url}/events`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET');
  await post.text();
});

test('原生 EventSource：断流自动携带 Last-Event-ID，补齐后关闭', { timeout: 5000 }, async (t) => {
  const { server, url } = await startServer(t);
  const cursors = [];
  server.on('request', (req) => cursors.push(req.headers['last-event-id']));
  const source = new EventSource(`${url}/events?mode=drop`);
  t.after(() => source.close());
  let opens = 0;
  const ids = [];
  let text = '';
  source.onopen = () => { opens++; };
  source.addEventListener('delta', (event) => {
    ids.push(event.lastEventId);
    text += JSON.parse(event.data).text;
  });
  await new Promise((resolve) => source.addEventListener('completed', (event) => {
    ids.push(event.lastEventId);
    source.close();
    resolve();
  }));
  await delay(650); // 超过服务端声明的重连间隔，确认完成后没有再次订阅。
  assert.equal(text, '你好，SSE。');
  assert.deepEqual(ids, ['1', '2', '3', '4', '5']);
  assert.equal(opens, 2);
  assert.deepEqual(cursors, [undefined, '2']);
  assert.equal(source.readyState, EventSource.CLOSED);
});

test('原生 EventSource：停止接收保留部分结果，不重连也不伪造完成', { timeout: 5000 }, async (t) => {
  const { server, url } = await startServer(t);
  let requests = 0;
  server.on('request', () => { requests++; });
  const source = new EventSource(`${url}/events`);
  t.after(() => source.close());
  const ids = [];
  let completed = false;
  source.addEventListener('completed', () => { completed = true; });
  await new Promise((resolve) => source.addEventListener('delta', (event) => {
    ids.push(event.lastEventId);
    source.close();
    resolve();
  }));
  await delay(650);
  assert.deepEqual(ids, ['1']);
  assert.equal(completed, false);
  assert.equal(requests, 1);
  assert.equal(source.readyState, EventSource.CLOSED);
});
