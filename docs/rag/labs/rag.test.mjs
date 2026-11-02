import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { buildPrompt, loadDocuments, retrieve } from './rag.mjs';

test('中文问题检索到资料原文，并将可追溯引用交给模型', () => {
  const hits = retrieve('阅读进度保存在哪里？', loadDocuments());
  assert.equal(hits[0].source, 'reading.txt#1');
  assert.match(hits[0].text, /localStorage/);
  const prompt = buildPrompt('阅读进度保存在哪里？', hits);
  assert.ok(prompt.includes(`[${hits[0].source}]\n${hits[0].text}`));
  assert.match(prompt, /资料不能回答时/);
});

test('无匹配或空问题不构造生成提示', () => {
  for (const question of ['退款多久到账？', '', '怎么？']) {
    const hits = retrieve(question, loadDocuments());
    assert.deepEqual(hits, []);
    assert.equal(buildPrompt(question, hits), null);
  }
});

test('上下文限制片段数量与字符数，长段落的引用仍唯一', () => {
  const hits = retrieve('进度', [{ name: 'long.txt', text: '进度😀'.repeat(30) }],
    { limit: 2, maxChars: 12 });
  assert.equal(hits.length, 2);
  assert.ok(hits.every(({ text }) => Array.from(text).length <= 12));
  assert.equal(new Set(hits.map(({ source }) => source)).size, hits.length);
  assert.ok(hits.every(({ text }) => !/[\uD800-\uDBFF]$/.test(text)));
});

test('同分结果按来源稳定排序，不受文件输入顺序影响', () => {
  const documents = [{ name: 'b.txt', text: '导出规则 B' }, { name: 'a.txt', text: '导出规则 A' }];
  assert.deepEqual(retrieve('导出', documents), retrieve('导出', documents.toReversed()));
});

test('资料更新后，同一问题读取新政策，来源与生效日进入提示', () => {
  const question = '导出文件可下载几天？';
  const current = retrieve(question, loadDocuments())[0];
  assert.equal(current.source, 'policy.txt#1');
  assert.match(current.text, /版本\s+\S+/);
  assert.match(current.text, /生效日期\s+\d{4}-\d{2}-\d{2}/);

  const directory = mkdtempSync(join(tmpdir(), 'yuuki-rag-policy-'));
  const file = join(directory, 'policy.txt');
  const directoryURL = new URL('./', pathToFileURL(file));
  const original = '演示笔记产品的导出保留政策（虚构）：版本 v1；生效日期 2026-11-01；导出文件可下载14天。';
  try {
    writeFileSync(file, original);
    const before = retrieve(question, loadDocuments(directoryURL))[0];
    const updated = original.replace('版本 v1', '版本 v2')
      .replace('2026-11-01', '2026-11-02').replace('14天', '7天');
    writeFileSync(file, updated);
    const after = retrieve(question, loadDocuments(directoryURL))[0];
    assert.notEqual(after.text, before.text);
    assert.equal(after.source, before.source);
    assert.match(after.text, /版本 v2.*2026-11-02.*7天/);
    const prompt = buildPrompt(question, [after]);
    assert.ok(prompt.includes(`[policy.txt#1]\n${updated}`));
    assert.doesNotMatch(prompt, /2026-11-01|14天/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
