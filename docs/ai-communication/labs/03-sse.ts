import assert from 'node:assert/strict';
import { readEvents, splitBytes } from './sse.ts';

// 本地生成响应体字节；事件名称是本课程自己的约定。
const body = ': heartbeat\n\n'
  + 'event: delta\ndata: {"text":"你好"}\n\n'
  + 'event: delta\ndata: {"text":"，RPC"}\n\n'
  + 'event: completed\ndata: {"ok":true}\n\n';

for (const size of [1, 7, 1024]) {
  let text = '';
  let completed = false;
  let events = 0;
  for await (const event of readEvents(splitBytes(body, size))) {
    events += 1;
    if (event.event === 'delta') text += JSON.parse(event.data).text;
    if (event.event === 'completed') completed = true;
  }
  assert.equal(text, '你好，RPC');
  assert.equal(events, 3);
  assert.equal(completed, true);
  console.log(`每片最多 ${size} 字节 → ${events} 个事件 → ${text} → completed`);
}

let completed = false;
for await (const event of readEvents(splitBytes('event: delta\ndata: {"text":"你好"}\n\n', 1))) {
  if (event.event === 'completed') completed = true;
}
assert.equal(completed, false);
console.log('只有部分文本就断流 → 未见 completed → 不能标为成功。');
