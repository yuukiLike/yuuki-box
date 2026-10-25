import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callTool, withClient } from './client.js';
import {
  discoverOutputSchema, findOutputSchema, preparedOutputSchema, readSourceOutputSchema,
  reportOutputSchema, revealOutputSchema, runOutputSchema, testOutputSchema,
} from './contracts.js';

const directory = fileURLToPath(new URL('../../.artifacts', import.meta.url));
const environment = process.env.GITHUB_TOKEN ? { GITHUB_TOKEN: process.env.GITHUB_TOKEN } : {};

// 这是可重复的协议与回归演示；不调用付费模型，不声称脚本自行做了源码推理。
const source = `import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export default async function(target: string) {
  const { default: mitt } = await import(pathToFileURL(join(target, 'src/index.ts')).href);
  const emitter = mitt();
  let removedCalls = 0;
  let otherCalls = 0;
  let wildcardCalls = 0;
  emitter.on('save', () => { removedCalls++; });
  emitter.on('save', () => { removedCalls++; });
  emitter.on('other', () => { otherCalls++; });
  emitter.on('*', () => { wildcardCalls++; });
  emitter.off('save');
  emitter.emit('save');
  assert.equal(removedCalls, 0, 'off(type) 应移除该事件的全部监听器');
  emitter.emit('other');
  assert.equal(otherCalls, 1, '其他事件继续工作');
  assert.equal(wildcardCalls, 2, '清理普通事件不会清理通配监听器');
  const specific = () => { removedCalls++; };
  emitter.on('single', specific);
  emitter.off('single', () => {});
  emitter.emit('single');
  assert.equal(removedCalls, 1, '不存在的回调不会误删已注册回调');
  emitter.off('single', specific);
  emitter.emit('single');
  assert.equal(removedCalls, 1, '按回调移除仍然有效');
}
`;

await withClient(directory, async client => {
  const inventory = await client.listTools();
  console.log(`发现 ${inventory.tools.length} 个 MCP 工具。`);
  const discovery = await callTool(client, 'discover_projects', { query: 'mitt in:name user:developit', includeSeen: true, limit: 1 }, discoverOutputSchema);
  assert.equal(discovery.projects[0]?.repository, 'developit/mitt');
  console.log('真实 GitHub 项目发现：developit/mitt。');
  const candidates = await callTool(client, 'find_experiments', { repository: 'developit/mitt', keywords: 'off', includeSeen: true }, findOutputSchema);
  console.log(`搜索到 ${candidates.candidates.length} 个已合并候选。演示固定使用 #124，避免搜索排序变化。`);
  const experiment = await callTool(client, 'prepare_experiment', {
    repository: 'developit/mitt', pullNumber: 124,
    goal: '理解 off(type) 为何没有移除监听器；验证清理指定事件时其他事件及通配监听器仍正常。',
  }, preparedOutputSchema);
  const reference = { experimentId: experiment.experimentId };
  const oldSource = await callTool(client, 'read_source', { ...reference, path: 'src/index.ts' }, readSourceOutputSchema);
  assert.ok(oldSource.content.includes('handlers.splice'));
  await callTool(client, 'set_regression_test', { ...reference, source }, testOutputSchema);
  const baseline = await callTool(client, 'run_check', { ...reference, target: 'baseline' }, runOutputSchema);
  assert.equal(baseline.receipt.outcome, 'assertion_failed', baseline.receipt.stderr + baseline.receipt.detail);

  const path = join(experiment.workspacePath, 'src/index.ts');
  const candidate = await readFile(path, 'utf8');
  if (!candidate.includes('if (handler === undefined)')) {
    const fixed = candidate.replace('off<Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>)', 'off<Key extends keyof Events>(type: Key, handler?: Handler<Events[Key]>)')
      .replace("off(type: '*', handler: WildcardHandler<Events>)", "off(type: '*', handler?: WildcardHandler<Events>)")
      .replace('off<Key extends keyof Events>(type: Key, handler: GenericEventHandler)', 'off<Key extends keyof Events>(type: Key, handler?: GenericEventHandler)')
      .replace('handlers.splice(handlers.indexOf(handler) >>> 0, 1);',
        "if (handler === undefined) {\n\t\t\t\t\tall!.delete(type);\n\t\t\t\t} else {\n\t\t\t\t\thandlers.splice(handlers.indexOf(handler) >>> 0, 1);\n\t\t\t\t}");
    if (fixed === candidate) throw new Error('旧源码与演示预期不符，没有应用候选修改。');
    await writeFile(path, fixed);
  }
  const attempted = await callTool(client, 'run_check', { ...reference, target: 'candidate' }, runOutputSchema);
  assert.equal(attempted.receipt.outcome, 'passed', attempted.receipt.stderr + attempted.receipt.detail);
  await callTool(client, 'reveal_solution', reference, revealOutputSchema);
  const official = await callTool(client, 'run_check', { ...reference, target: 'reference' }, runOutputSchema);
  assert.equal(official.receipt.outcome, 'passed', official.receipt.stderr + official.receipt.detail);
  const report = await callTool(client, 'get_experiment', reference, reportOutputSchema);
  assert.equal(report.assessment, 'reference_checked');
  console.log('同一份断言：旧版 assertion_failed → 候选 passed → 官方修复 passed。');
  console.log(`实验目录：${experiment.workspacePath}\n报告：${report.reportPath}`);
  // 演示不替使用者评价项目；反馈由使用者通过 save_feedback 主动给出。
}, environment);
