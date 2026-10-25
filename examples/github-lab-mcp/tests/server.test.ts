import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { callTool, withClient } from '../src/client.js';
import { feedbackSchema, preparedOutputSchema, testOutputSchema } from '../src/contracts.js';

test('真实 stdio 协议发现九个工具；输入拒绝无文件副作用；反馈跨进程保存', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'yuuki-github-lab-protocol-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const directory = join(temporary, 'lab');
  await withClient(directory, async client => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), [
      'discover_projects', 'find_experiments', 'prepare_experiment', 'read_source',
      'set_regression_test', 'run_check', 'reveal_solution', 'get_experiment', 'save_feedback',
    ]);
    assert.equal(tools.find(tool => tool.name === 'run_check')?.annotations?.readOnlyHint, false);
    assert.equal(tools.find(tool => tool.name === 'discover_projects')?.annotations?.readOnlyHint, true);
    for (const args of [
      { repository: '../outside', pullNumber: 1, goal: 'test' },
      { repository: 'test/tiny', pullNumber: 0, goal: 'test' },
      { repository: 'test/tiny', pullNumber: 1, goal: '' },
      { repository: 'test/tiny', pullNumber: 1, goal: 'test', remote: '/tmp/escape' },
    ]) await assert.rejects(() => callTool(client, 'prepare_experiment', args, preparedOutputSchema));
    await assert.rejects(() => callTool(client, 'set_regression_test', { experimentId: '../outside', source: 'test' }, testOutputSchema));
    assert.equal(existsSync(directory), false);
    const saved = await callTool(client, 'save_feedback', {
      repository: 'test/tiny', verdict: 'interested', topics: ['mcp'], note: '下一次找相近项目。',
    }, feedbackSchema);
    assert.equal(saved.verdict, 'interested');
  });
  await withClient(directory, async client => {
    const updated = await callTool(client, 'save_feedback', { repository: 'test/tiny', verdict: 'done' }, feedbackSchema);
    assert.equal(updated.verdict, 'done');
    assert.deepEqual(updated.topics, []);
  });
});
