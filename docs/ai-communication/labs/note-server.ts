import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

// 固定的内存笔记，便于只观察通信；本实验不访问用户文件。
const notes = new Map([
  ['welcome', '今天只追踪一次跨进程调用。'],
  ['next', '下一步：用 id 配对并发请求。'],
]);
let readCount = 0;
type Id = string | number | null;

function reply(id: Id, payload: object) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...payload }) + '\n');
}

async function handleLine(line: string) {
  let request: unknown;
  try {
    request = JSON.parse(line);
  } catch {
    reply(null, { error: { code: -32700, message: 'Parse error' } });
    return;
  }
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    reply(null, { error: { code: -32600, message: 'Invalid Request' } });
    return;
  }
  const message = request as Record<string, unknown>;
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string'
    || ('id' in message && typeof message.id !== 'string' && typeof message.id !== 'number' && message.id !== null)) {
    reply(null, { error: { code: -32600, message: 'Invalid Request' } });
    return;
  }

  const notification = !('id' in message);
  const id = notification ? null : message.id as Id;
  function fail(code: number, error: string) {
    if (!notification) reply(id, { error: { code, message: error } });
  }
  if (message.params !== undefined
    && (!message.params || typeof message.params !== 'object' || Array.isArray(message.params))) {
    fail(-32602, '本实验只接受对象参数');
    return;
  }
  const params = (message.params ?? {}) as Record<string, unknown>;

  if (message.method === 'noteViewed') {
    console.error('server 收到 noteViewed；通知不产生响应。');
    if (!notification) reply(id, { result: null });
    return;
  }
  if (message.method === 'readCount') {
    if (!notification) reply(id, { result: readCount });
    return;
  }
  if (message.method !== 'readNote') {
    fail(-32601, 'Method not found');
    return;
  }
  const waitMs = params.delayMs ?? 0;
  if (typeof params.name !== 'string' || typeof waitMs !== 'number'
    || !Number.isInteger(waitMs) || waitMs < 0 || waitMs > 1000) {
    fail(-32602, '需要 name 字符串；delayMs 为 0–1000 的整数');
    return;
  }
  const text = notes.get(params.name);
  if (text === undefined) {
    fail(-32001, '笔记不存在');
    return;
  }
  await delay(waitMs);
  readCount += 1;
  if (!notification) reply(id, { result: { text, serverPid: process.pid } });
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const running = new Set<Promise<void>>();
for await (const line of input) {
  // 不在这里 await：第二章会让后发出的请求先完成。
  const task = handleLine(line).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
  running.add(task);
  void task.finally(() => running.delete(task));
}
await Promise.all(running);
