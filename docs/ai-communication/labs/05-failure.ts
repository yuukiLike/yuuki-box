import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { connectNotes } from './rpc-client.ts';

const client = connectNotes();
try {
  // 先让服务进程启动完成，避免把启动等待混进本次超时演示。
  assert.equal(await client.request('readCount'), 0);
  await assert.rejects(client.request('readNote', { name: 'welcome', delayMs: 120 }, { timeoutMs: 20 }), /超时/);
  console.log('客户端：等待超时；没有自动重试。');

  await delay(200);
  assert.equal(await client.request('readCount'), 1);
  assert.equal(client.lateResponses, 1);
  console.log('服务端：实际上读了 1 次；迟到的响应没有让已超时的调用重新成功。');

  const controller = new AbortController();
  const cancelled = client.request('readNote', { name: 'next', delayMs: 120 }, { signal: controller.signal });
  const observed = assert.rejects(cancelled, /客户端取消/);
  controller.abort();
  await observed;
  await delay(200);
  assert.equal(await client.request('readCount'), 2);
  assert.equal(client.lateResponses, 2);
  console.log('客户端停止等待后，服务端仍读了第二次：本地取消需要另外向执行方传播。');
} finally {
  await client.close();
}
