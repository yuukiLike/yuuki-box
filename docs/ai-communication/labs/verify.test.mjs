import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { connectNotes } from './rpc-client.ts';
import { readEvents, splitBytes } from './sse.ts';

const serverFile = fileURLToPath(new URL('./note-server.ts', import.meta.url));

test('first lesson crosses a real process boundary and checks the correlated result', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./01-rpc.ts', import.meta.url))], {
    encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /两个 PID 不同，请求与响应的 id 相同/);
});

test('JSON-RPC validates bad input, suppresses notification responses, and keeps framing intact', () => {
  const messages = [
    '{',
    '{}',
    JSON.stringify({ jsonrpc: '2.0', method: 'noteViewed' }),
    JSON.stringify({ jsonrpc: '2.0', id: 'missing', method: 'unknown' }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'readNote', params: { name: 42 } }),
    JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'readNote', params: { name: 'missing' } }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'readNote', params: { name: 'welcome' } }),
  ];
  const run = spawnSync(process.execPath, [serverFile], {
    input: messages.join('\n') + '\n', encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stderr);
  const responses = run.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(responses.length, 6);
  assert.deepEqual(responses.slice(0, 5).map((value) => value.error.code), [-32700, -32600, -32601, -32602, -32001]);
  assert.equal(responses[2].id, 'missing');
  assert.equal(responses[5].id, 4);
  assert.equal(responses[5].result.text, '今天只追踪一次跨进程调用。');
});

test('concurrent responses reach the correct Promise even when they arrive out of order', async () => {
  const client = connectNotes();
  try {
    const order = [];
    const slow = client.request('readNote', { name: 'welcome', delayMs: 120 }).then((result) => {
      order.push('slow'); return result;
    });
    const fast = client.request('readNote', { name: 'next' }).then((result) => {
      order.push('fast'); return result;
    });
    const [first, second] = await Promise.all([slow, fast]);
    assert.deepEqual(order, ['fast', 'slow']);
    assert.equal(first.text, '今天只追踪一次跨进程调用。');
    assert.equal(second.text, '下一步：用 id 配对并发请求。');
    await assert.rejects(client.request('unknown'), { code: -32601 });
  } finally {
    await client.close();
  }
});

test('closing the transport settles every pending call and rejects new work', async () => {
  const client = connectNotes();
  const pending = client.request('readNote', { name: 'welcome', delayMs: 120 });
  await client.close();
  assert.equal((await pending).text, '今天只追踪一次跨进程调用。');
  await assert.rejects(client.request('readNote', { name: 'welcome' }), /关闭/);
});

test('abrupt disconnect rejects all pending calls as unknown instead of hanging or succeeding', async () => {
  const client = connectNotes();
  try {
    await client.request('readCount');
    const first = assert.rejects(client.request('readNote', { name: 'welcome', delayMs: 1000 }), /结果未知/);
    const second = assert.rejects(client.request('readNote', { name: 'next', delayMs: 1000 }), /结果未知/);
    client.disconnect();
    await Promise.all([first, second]);
    await assert.rejects(client.request('readCount'), /关闭/);
  } finally {
    await assert.rejects(client.close(), /退出异常/);
  }
});

test('timeout and local abort do not stop server work or revive the rejected Promise', async () => {
  const client = connectNotes();
  try {
    assert.equal(await client.request('readCount'), 0);
    await assert.rejects(client.request('readNote', { name: 'welcome', delayMs: 120 }, { timeoutMs: 20 }), /超时/);
    await delay(200);
    assert.equal(await client.request('readCount'), 1);
    assert.equal(client.lateResponses, 1);

    const controller = new AbortController();
    const request = client.request('readNote', { name: 'next', delayMs: 120 }, { signal: controller.signal });
    const rejected = assert.rejects(request, /客户端取消/);
    controller.abort();
    await rejected;
    await delay(200);
    assert.equal(await client.request('readCount'), 2);
    assert.equal(client.lateResponses, 2);
  } finally {
    await client.close();
  }
});

test('invalid request options and pre-aborted signals send no operation', async () => {
  const client = connectNotes();
  try {
    await assert.rejects(client.request('readNote', { name: 'welcome' }, { timeoutMs: 0 }), /timeoutMs/);
    await assert.rejects(client.request('readNote', { name: 'welcome' }, { signal: AbortSignal.abort() }), /取消/);
    assert.equal(await client.request('readCount'), 0);
  } finally {
    await client.close();
  }
});

test('SSE preserves Chinese, multiline data, and event boundaries under every fixed chunk size', async () => {
  const source = ': heartbeat\r\n\r\nevent: delta\r\ndata: 你好\r\ndata: RPC\r\n\r\ndata:\r\n\r\n';
  const expected = [{ event: 'delta', data: '你好\nRPC' }, { event: 'message', data: '' }];
  for (let size = 1; size <= new TextEncoder().encode(source).length; size++) {
    assert.deepEqual(await Array.fromAsync(readEvents(splitBytes(source, size))), expected);
  }
});

test('SSE discards unterminated events and rejects truncated UTF-8', async () => {
  assert.deepEqual(await Array.fromAsync(readEvents(splitBytes('data: unfinished\n', 1))), []);
  assert.deepEqual(await Array.fromAsync(readEvents(splitBytes(': comment\n\n', 1))), []);
  async function* invalidBytes() { yield new Uint8Array([0xe4, 0xbd]); }
  await assert.rejects(Array.fromAsync(readEvents(invalidBytes())), /encoded data/);
  await assert.rejects(Array.fromAsync(splitBytes('data: x\n\n', 0)), /正整数/);
});
