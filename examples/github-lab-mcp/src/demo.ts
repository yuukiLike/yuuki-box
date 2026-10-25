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

// 这是可重复的协议与回归演示；不调用语言模型，断言与候选修改均由脚本预设。
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
  console.log('[演示] 固定案例：developit/mitt #124；断言与候选补丁来自 demo.ts，不调用语言模型。');
  console.log(`[MCP] 连接已建立 | 协议版本：${client.getNegotiatedProtocolVersion()}`);
  const inventory = await client.listTools();
  console.log(`[MCP] tools/list → ${inventory.tools.length} 个工具：${inventory.tools.map(tool => tool.name).join(', ')}`);
  console.log('[MCP] tools/call → discover_projects | query=mitt in:name user:developit');
  const discovery = await callTool(client, 'discover_projects', { query: 'mitt in:name user:developit', includeSeen: true, limit: 1 }, discoverOutputSchema);
  assert.equal(discovery.projects[0]?.repository, 'developit/mitt');
  console.log(`[结果] discover_projects | repository=${discovery.projects[0]?.repository}`);
  console.log('[MCP] tools/call → find_experiments | repository=developit/mitt');
  const candidates = await callTool(client, 'find_experiments', { repository: 'developit/mitt', keywords: 'off', includeSeen: true }, findOutputSchema);
  console.log(`[结果] find_experiments | candidates=${candidates.candidates.length}；本次仍使用预设的 #124。`);
  console.log('[MCP] tools/call → prepare_experiment | repository=developit/mitt | pullNumber=124');
  const experiment = await callTool(client, 'prepare_experiment', {
    repository: 'developit/mitt', pullNumber: 124,
    goal: '理解 off(type) 为何没有移除监听器；验证清理指定事件时其他事件及通配监听器仍正常。',
  }, preparedOutputSchema);
  console.log(`[结果] prepare_experiment | experimentId=${experiment.experimentId} | alreadyPrepared=${experiment.alreadyPrepared}`);
  const reference = { experimentId: experiment.experimentId };
  console.log('[MCP] tools/call → read_source | path=src/index.ts');
  const oldSource = await callTool(client, 'read_source', { ...reference, path: 'src/index.ts' }, readSourceOutputSchema);
  assert.ok(oldSource.content.includes('handlers.splice'));
  console.log('[MCP] tools/call → set_regression_test');
  const regression = await callTool(client, 'set_regression_test', { ...reference, source }, testOutputSchema);
  console.log(`[结果] 回归断言已保存 | sha256=${regression.sha256}`);
  console.log('[MCP] tools/call → run_check | target=baseline');
  const baseline = await callTool(client, 'run_check', { ...reference, target: 'baseline' }, runOutputSchema);
  console.log(`[结果] run_check | target=baseline | outcome=${baseline.receipt.outcome}`);
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
    console.log('[演示] 已通过本地文件读写应用预设候选补丁。');
  } else {
    console.log('[演示] 候选已有演示补丁标记；继续检查现有代码。');
  }
  console.log('[MCP] tools/call → run_check | target=candidate');
  const attempted = await callTool(client, 'run_check', { ...reference, target: 'candidate' }, runOutputSchema);
  console.log(`[结果] run_check | target=candidate | outcome=${attempted.receipt.outcome}`);
  assert.equal(attempted.receipt.outcome, 'passed', attempted.receipt.stderr + attempted.receipt.detail);
  console.log('[MCP] tools/call → reveal_solution');
  await callTool(client, 'reveal_solution', reference, revealOutputSchema);
  console.log('[MCP] tools/call → run_check | target=reference');
  const official = await callTool(client, 'run_check', { ...reference, target: 'reference' }, runOutputSchema);
  console.log(`[结果] run_check | target=reference | outcome=${official.receipt.outcome}`);
  assert.equal(official.receipt.outcome, 'passed', official.receipt.stderr + official.receipt.detail);
  console.log('[MCP] tools/call → get_experiment');
  const report = await callTool(client, 'get_experiment', reference, reportOutputSchema);
  assert.equal(report.assessment, 'reference_checked');
  console.log(`[判定] ${report.assessment} | 仅针对当前断言与源码`);
  console.log(`[目录] candidate：${experiment.workspacePath}\n[报告] ${report.reportPath}`);
  // 演示不替使用者评价项目；反馈由使用者通过 save_feedback 主动给出。
}, environment).catch((error: unknown) => {
  console.error('[失败]', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
