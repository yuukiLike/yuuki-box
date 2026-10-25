import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { Client } from '@modelcontextprotocol/client';
import { callTool, withClient } from '../src/client.js';
import { resumeOutputSchema, saveCheckpointOutputSchema } from '../src/contracts.js';

async function fixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'yuuki-continue-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return join(root, 'notes');
}

const save = (client: Client, args: Record<string, unknown>) =>
  callTool(client, 'save_checkpoint', args, saveCheckpointOutputSchema);
const resume = (client: Client, args: Record<string, unknown>) =>
  callTool(client, 'resume', args, resumeOutputSchema);

test('发现两个工具；读取空项目不创建目录或编造记录', async (t) => {
  const directory = await fixture(t);
  await withClient(directory, async (client) => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(({ name }) => name), ['save_checkpoint', 'resume']);
    const saveTool = tools.find(tool => tool.name === 'save_checkpoint');
    const resumeTool = tools.find(tool => tool.name === 'resume');
    assert.ok(saveTool?.annotations);
    assert.ok(resumeTool?.annotations);
    assert.equal(saveTool.annotations.readOnlyHint, false);
    assert.equal(saveTool.annotations.destructiveHint, true);
    assert.equal(resumeTool.annotations.readOnlyHint, true);
    assert.deepEqual(await resume(client, { project: 'yuuki-box' }), { found: false, project: 'yuuki-box' });
  });
  assert.equal(existsSync(directory), false);
});

test('跨服务进程保留记录，支持手改 Markdown，替换时不影响其他项目', async (t) => {
  const directory = await fixture(t);
  const checkpoint = {
    project: 'algorithm-box',
    context: '括号练习的答案仍由我自己完成。',
    next: '只给现有答案跑一次测试，记录第一个失败输入。',
    stopWhen: '能解释这个输入为什么失败。',
  };
  await withClient(directory, async (client) => {
    const saved = await save(client, checkpoint);
    assert.equal(saved.saved, true);
    assert.equal(saved.path, join(directory, 'algorithm-box.md'));
    await save(client, { project: 'violin', next: '慢练昨天标出的两小节。' });
  });

  const path = join(directory, 'algorithm-box.md');
  const original = await readFile(path, 'utf8');
  const violin = await readFile(join(directory, 'violin.md'), 'utf8');
  await withClient(directory, async (client) => {
    const restored = await resume(client, { project: checkpoint.project });
    assert.ok(restored.found);
    assert.equal(restored.note, original);
    for (const text of [checkpoint.context, checkpoint.next, checkpoint.stopWhen]) assert.ok(restored.note.includes(text));

    const edited = original + '\n我手动补充：今天只检查空字符串。\n';
    await writeFile(path, edited);
    const manuallyEdited = await resume(client, { project: checkpoint.project });
    assert.ok(manuallyEdited.found);
    assert.equal(manuallyEdited.note, edited);

    await save(client, { project: checkpoint.project, next: '检查下一组输入。' });
    const updated = await resume(client, { project: checkpoint.project });
    assert.ok(updated.found);
    assert.ok(updated.note.includes('检查下一组输入。'));
    assert.ok(!updated.note.includes(checkpoint.next));
    const otherProject = await resume(client, { project: 'violin' });
    assert.ok(otherProject.found);
    assert.equal(otherProject.note, violin);
  });
  assert.deepEqual((await readdir(directory)).sort(), ['algorithm-box.md', 'violin.md']);
});

test('拒绝路径穿越、空下一步、超长文本和多余字段，且没有文件副作用', async (t) => {
  const directory = await fixture(t);
  await withClient(directory, async (client) => {
    for (const args of [
      { project: '../outside', next: 'test' },
      { project: 'a/b', next: 'test' },
      { project: 'a'.repeat(65), next: 'test' },
      { project: 'yuuki-box', next: ' \n\t' },
      { project: 'yuuki-box', next: 'x'.repeat(501) },
      { project: 'yuuki-box', next: 'test', context: '' },
      { project: 'yuuki-box', next: 'test', surprise: true },
    ]) await assert.rejects(() => save(client, args));
    await assert.rejects(() => resume(client, { project: '../outside' }));
  });
  assert.equal(existsSync(directory), false);
});

test('文件系统失败报告错误，不伪装成保存成功或没有记录', async (t) => {
  const directory = await fixture(t);
  await writeFile(directory, '保留这个文件');
  await withClient(directory, async (client) => {
    await assert.rejects(() => save(client, { project: 'yuuki-box', next: 'test' }), /保存失败/);
    await assert.rejects(() => resume(client, { project: 'yuuki-box' }), /读取失败/);
  });
  assert.equal(await readFile(directory, 'utf8'), '保留这个文件');
});

test('手改后的超大记录不会原样进入上下文；重新保存可以恢复', async (t) => {
  const directory = await fixture(t);
  await withClient(directory, async (client) => {
    await save(client, { project: 'yuuki-box', next: '继续 MCP 学习。' });
    await writeFile(join(directory, 'yuuki-box.md'), 'x'.repeat(16_385));
    await assert.rejects(() => resume(client, { project: 'yuuki-box' }), /16 KiB/);
    await save(client, { project: 'yuuki-box', next: '只取回这一条。' });
    const restored = await resume(client, { project: 'yuuki-box' });
    assert.ok(restored.found);
    assert.ok(restored.note.includes('只取回这一条。'));
  });
});
