import assert from 'node:assert/strict';
import { connectNotes } from './rpc-client.ts';

const client = connectNotes();
try {
  const arrival: string[] = [];
  const slow = client.request('readNote', { name: 'welcome', delayMs: 120 }).then((result) => {
    arrival.push('先发的慢请求');
    console.log('慢请求拿到自己的结果：', result);
  });
  const fast = client.request('readNote', { name: 'next' }).then((result) => {
    arrival.push('后发的快请求');
    console.log('快请求拿到自己的结果：', result);
  });
  await Promise.all([slow, fast]);
  assert.deepEqual(arrival, ['后发的快请求', '先发的慢请求']);
  console.log('确认：结果按 id 配对，接收顺序可以不同。');

  await assert.rejects(client.request('unknownMethod'), { code: -32601 });
  console.log('未知方法返回 error.code = -32601。');
  client.notify('noteViewed', { name: 'welcome' });
  console.log('发送一条无 id 的通知；客户端不为它登记等待项。');
} finally {
  await client.close();
}
