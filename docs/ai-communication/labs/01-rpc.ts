import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const request = { jsonrpc: '2.0', id: 1, method: 'readNote', params: { name: 'welcome' } };
console.log('客户端 PID：', process.pid);
console.log('发送：', JSON.stringify(request));

// 第一章用一次性同步调用，把序列化和进程边界单独看清。
// 第二章再换成持续连接、异步接收和多个等待中的请求。
const child = spawnSync(process.execPath, [fileURLToPath(new URL('./note-server.ts', import.meta.url))], {
  input: JSON.stringify(request) + '\n',
  encoding: 'utf8',
  timeout: 3000,
  maxBuffer: 64 * 1024,
});
if (child.error) throw child.error;
if (child.stderr) process.stderr.write(child.stderr);
assert.equal(child.status, 0, `服务进程没有正常退出：${child.signal ?? child.status}`);

console.log('收到：', child.stdout.trim());
const response = JSON.parse(child.stdout);
assert.equal(response.jsonrpc, '2.0');
assert.equal(response.id, request.id);
assert.equal(response.error, undefined);
assert.equal(response.result.text, '今天只追踪一次跨进程调用。');
assert.equal(typeof response.result.serverPid, 'number');
assert.notEqual(response.result.serverPid, process.pid);
console.log('结果：', response.result.text);
console.log('确认：两个 PID 不同，请求与响应的 id 相同。');
