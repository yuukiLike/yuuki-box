import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { documentId, docsRoot } from '../src/lib/docs-paths.mjs';
import { learningStep, learningSteps, learningUrl, learningFocusKey, parseLearningFocus, saveLearningFocus } from '../src/lib/learning-guide.mjs';

test('every chapter and interactive lab has a concrete first action and stopping point', () => {
  const files = [...globSync('**/*.md', { cwd: docsRoot })];
  assert.ok(files.length >= 100);
  const known = new Set(files.map(documentId));
  for (const file of files) {
    const step = learningStep(documentId(file));
    assert.ok(step?.first && step?.stop, file);
    if (!step.section) continue;
    const markdown = readFileSync(resolve(docsRoot, file), 'utf8').replace(/```[\s\S]*?```/g, '');
    assert.ok(markdown.split('\n').some(line => /^#{2,6} /.test(line) && line.replace(/^#+ /, '') === step.section), `${file}: ${step.section}`);
  }
  for (const id of Object.keys(learningSteps)) {
    assert.ok(known.has(id) || ['labs/kv-memory', 'labs/lookup', 'labs/wasm-bridge'].includes(id), id);
  }
});

test('a selected task survives detours and keeps its completed state and return section', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value) };
  const focus = { id: 'codex-cloud/01-for-safe', label: 'for-safe', done: false, anchor: '③-复制这条任务' };
  assert.ok(saveLearningFocus(storage, focus));
  assert.deepEqual(parseLearningFocus(values.get(learningFocusKey)), focus);
  assert.ok(saveLearningFocus(storage, { ...focus, done: true }));
  assert.equal(parseLearningFocus(values.get(learningFocusKey)).done, true);
  assert.equal(learningUrl(focus.id, focus.anchor), '/codex-cloud/01-for-safe/#%E2%91%A2-%E5%A4%8D%E5%88%B6%E8%BF%99%E6%9D%A1%E4%BB%BB%E5%8A%A1');
});

test('corrupt, foreign and invalid saved tasks cannot become resume links', () => {
  for (const raw of [null, '', '{', '[]', '{}', JSON.stringify({ id: 'https://example.com', label: 'x', done: false }),
    JSON.stringify({ id: 'constructor', label: 'x', done: false }),
    JSON.stringify({ id: 'codex-cloud', label: '', done: false }),
    JSON.stringify({ id: 'codex-cloud', label: 'x', done: 'true' }),
    JSON.stringify({ id: 'codex-cloud', label: 'x', done: false, anchor: '\u0000' })]) {
    assert.equal(parseLearningFocus(raw), null, String(raw));
  }
  assert.equal(learningUrl('//example.com'), '/');
  assert.equal(learningStep('__proto__'), undefined);
});

test('unavailable storage does not prevent starting or completing a task in the page', () => {
  const focus = { id: 'ai-from-scaling/00-codex-mcp', label: 'MCP', done: false };
  const blocked = { setItem() { throw new Error('Storage unavailable'); } };
  assert.equal(saveLearningFocus(null, focus), false);
  assert.equal(saveLearningFocus(blocked, focus), false);
  assert.equal(saveLearningFocus(blocked, { ...focus, done: true }), false);
  assert.equal(learningStep(focus.id).first.length > 0, true);
});
