import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../dist/server.js', import.meta.url));

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'yuuki-usage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function connect(t, directory, { client = { name: 'test-host', version: '1.0' }, modern = false, initialize = true } = {}) {
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, YUUKI_CONTINUE_DIR: directory },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  const pending = new Map();
  let stderr = '';
  let id = 0;
  child.stderr.on('data', chunk => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    const message = JSON.parse(line); // stdout 出现日志或其他非协议输出时，让验证明确失败。
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timeout);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  child.once('exit', () => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(`服务提前退出：${stderr}`));
    }
    pending.clear();
    lines.close();
  });
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    try {
      const [code, signal] = await exited;
      assert.equal(signal, null, stderr);
      assert.equal(code, 0, stderr);
    } finally {
      clearTimeout(timer);
    }
  };
  t.after(close);
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`${method} 超时：${stderr}`));
    }, 5000);
    pending.set(requestId, { resolve, reject, timeout });
    const envelope = modern ? {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
      ...(client && { 'io.modelcontextprotocol/clientInfo': client }),
    } : undefined;
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: requestId, method,
      params: { ...params, ...(envelope && { _meta: envelope }) },
    }) + '\n');
  });
  if (initialize) {
    if (modern) await request('server/discover');
    else {
      await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: client });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    }
  }
  const call = (name, args = {}) => request('tools/call', { name, arguments: args });
  const stats = async () => {
    const result = await call('get_usage_stats');
    assert.notEqual(result.isError, true, JSON.stringify(result));
    return result.structuredContent;
  };
  return { child, close, request, call, stats };
}

test('只启动进程不算连接；stdin 关闭后依然会正常退出', async t => {
  const directory = await fixture(t);
  const host = await connect(t, directory, { initialize: false });
  await delay(150);
  assert.equal(host.child.exitCode, null);
  assert.equal(existsSync(join(directory, '.usage.sqlite')), false);
  await host.close();
});

test('统计真实调用、校验与业务失败；查看统计和发现工具不增加调用数，重启仍保留', async t => {
  const directory = await fixture(t);
  const host = await connect(t, directory);
  const listed = await host.request('tools/list');
  assert.deepEqual(listed.tools.map(tool => tool.name), ['save_checkpoint', 'resume', 'get_usage_stats']);
  assert.equal((await host.stats()).connections, 1);
  assert.equal((await host.stats()).calls, 0);

  const secret = '这是用于验证不会进入统计文件的私密进度';
  const saved = await host.call('save_checkpoint', { project: 'private-project', next: secret });
  assert.equal(saved.structuredContent.saved, true);
  const resumed = await host.call('resume', { project: 'private-project' });
  assert.ok(resumed.structuredContent.note.includes(secret));
  assert.equal((await host.call('resume', { project: 'missing' })).structuredContent.found, false);
  assert.equal((await host.call('save_checkpoint', { project: '../escape', next: 'test' })).isError, true);
  await writeFile(join(directory, 'oversized.md'), 'x'.repeat(16_385));
  assert.equal((await host.call('resume', { project: 'oversized' })).isError, true);
  await assert.rejects(host.call('unknown_tool'), /not found/);

  const stats = await host.stats();
  assert.equal(stats.connections, 1);
  assert.equal(stats.calls, 6);
  assert.equal(stats.succeeded, 3);
  assert.equal(stats.failed, 3);
  assert.ok(stats.averageDurationMs >= 0);
  assert.ok(stats.maxDurationMs >= stats.averageDurationMs);
  assert.ok(stats.lastCalledAt);
  assert.deepEqual(stats.tools.map(({ name, calls, failed }) => ({ name, calls, failed })), [
    { name: 'resume', calls: 3, failed: 1 },
    { name: 'save_checkpoint', calls: 2, failed: 1 },
    { name: 'unknown_tool', calls: 1, failed: 1 },
  ]);
  assert.deepEqual(stats.hosts.map(({ name, version, connections, calls }) => ({ name, version, connections, calls })), [
    { name: 'test-host', version: '1.0', connections: 1, calls: 6 },
  ]);
  const databaseBytes = await readFile(join(directory, '.usage.sqlite'));
  assert.equal(databaseBytes.includes(Buffer.from(secret)), false);
  assert.equal(databaseBytes.includes(Buffer.from('private-project')), false);

  await host.close();
  const restarted = await connect(t, directory);
  const persisted = await restarted.stats();
  assert.equal(persisted.connections, 2);
  assert.equal(persisted.calls, 6);
  assert.equal(persisted.hosts.length, 1);
  assert.equal(persisted.hosts[0].connections, 2);
  assert.ok((await restarted.call('resume', { project: 'private-project' })).structuredContent.note.includes(secret));
  assert.equal((await restarted.stats()).calls, 7);
});

test('现代协议按声明的 Host 名称/版本分组；没有 clientInfo 时明确归入未提供', async t => {
  const directory = await fixture(t);
  const first = await connect(t, directory, { modern: true, client: { name: 'host-a', version: '2.0' } });
  await first.call('resume', { project: 'missing' });
  await first.close();
  const second = await connect(t, directory, { modern: true, client: { name: 'host-b', version: '1.0' } });
  await second.call('resume', { project: 'missing' });
  const anonymous = await connect(t, directory, { modern: true, client: null });
  await anonymous.call('resume', { project: 'missing' });
  const stats = await anonymous.stats();
  assert.equal(stats.connections, 3);
  assert.equal(stats.calls, 3);
  assert.deepEqual(stats.hosts.map(({ name, version, calls }) => ({ name, version, calls })), [
    { name: null, version: null, calls: 1 },
    { name: 'host-a', version: '2.0', calls: 1 },
    { name: 'host-b', version: '1.0', calls: 1 },
  ]);
});

test('被拒绝的初始化不计为连接，也不污染后续成功连接的 Host 名称', async t => {
  const directory = await fixture(t);
  const host = await connect(t, directory, { initialize: false });
  await assert.rejects(host.request('initialize', {
    protocolVersion: '2025-11-25',
    clientInfo: { name: 'rejected-host', version: '0' },
  }));
  assert.equal(existsSync(join(directory, '.usage.sqlite')), false);
  await host.request('initialize', {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'accepted-host', version: '1' },
  });
  const stats = await host.stats();
  assert.equal(stats.connections, 1);
  assert.equal(stats.hosts.length, 1);
  assert.equal(stats.hosts[0].name, 'accepted-host');
});

test('多个 Host 进程同时调用不会覆盖计数或把同一种软件当作不同软件', async t => {
  const directory = await fixture(t);
  const hosts = await Promise.all(Array.from({ length: 4 }, () => connect(t, directory)));
  await Promise.all(hosts.flatMap(host => Array.from({ length: 10 }, async () => {
    const result = await host.call('resume', { project: 'missing' });
    assert.equal(result.structuredContent.found, false);
    assert.equal(result.content.some(item => item.text?.includes('统计未能写入')), false);
  })));
  const stats = await hosts[0].stats();
  assert.equal(stats.connections, 4);
  assert.equal(stats.calls, 40);
  assert.equal(stats.succeeded, 40);
  assert.equal(stats.failed, 0);
  assert.equal(stats.hosts.length, 1);
  assert.equal(stats.hosts[0].connections, 4);
  assert.equal(stats.hosts[0].calls, 40);
});

test('统计文件损坏时不重置数据；存取记录仍有效并告知统计写入失败', async t => {
  const directory = await fixture(t);
  const corrupt = '保留这个损坏文件，不能伪装成零次调用';
  await writeFile(join(directory, '.usage.sqlite'), corrupt);
  const host = await connect(t, directory);
  const saved = await host.call('save_checkpoint', { project: 'still-works', next: '继续学习。' });
  assert.equal(saved.structuredContent.saved, true);
  assert.ok(saved.content.some(item => item.text?.includes('使用统计未能写入')));
  const resumed = await host.call('resume', { project: 'still-works' });
  assert.equal(resumed.structuredContent.found, true);
  const stats = await host.call('get_usage_stats');
  assert.equal(stats.isError, true);
  assert.ok(stats.content[0].text.includes('读取使用统计失败'));
  assert.equal(await readFile(join(directory, '.usage.sqlite'), 'utf8'), corrupt);

  // 只有测试显式移走损坏文件后才允许重建，恢复后也能记录协议层的工具错误。
  await rm(join(directory, '.usage.sqlite'));
  await assert.rejects(host.call('unknown_tool'), /not found/);
  const recovered = await host.stats();
  assert.equal(recovered.connections, 1);
  assert.equal(recovered.calls, 1);
  assert.equal(recovered.failed, 1);
});
