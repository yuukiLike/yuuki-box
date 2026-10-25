import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { runProcess } from '../src/process.js';

test('POSIX 取消同时停止辅助进程，避免下载任务在后台继续', { skip: process.platform === 'win32' }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'yuuki-github-lab-process-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = join(directory, 'unexpected.txt');
  const helper = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'still alive'), 1200)`;
  const script = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(helper)}], { stdio: 'ignore' }); console.log('helper started'); setInterval(() => {}, 1000);`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 400);
  try {
    const result = await runProcess(process.execPath, ['-e', script], { cwd: directory, signal: controller.signal });
    assert.equal(result.termination, 'cancelled');
    assert.ok(result.stdout.includes('helper started'));
    await delay(1100);
    assert.equal(existsSync(marker), false);
  } finally { clearTimeout(timer); }
});
