import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { GitHub, githubError } from '../src/github.js';
import { hash, Lab } from '../src/lab.js';
import { git } from '../src/process.js';

const oldCode = "export default function answer() { return 'old'; }\n";
const fixedCode = "export default function answer() { return 'fixed'; }\n";
const assertion = `import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
export default async function(target: string) {
  const { default: answer } = await import(pathToFileURL(join(target, 'src/index.ts')).href);
  assert.equal(answer(), 'fixed', '公开问题要求返回 fixed');
}`;

async function fixture(t: TestContext, checkTimeoutMs = 3000) {
  const directory = await mkdtemp(join(tmpdir(), 'yuuki-github-lab-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const remote = join(directory, 'remote');
  await mkdir(join(remote, 'src'), { recursive: true });
  await git(remote, ['init', '--quiet']);
  await writeFile(join(remote, 'package.json'), '{"type":"module"}\n');
  await writeFile(join(remote, 'src/index.ts'), oldCode);
  await git(remote, ['add', '.']);
  await git(remote, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost', 'commit', '--quiet', '-m', 'baseline']);
  const base = (await git(remote, ['rev-parse', 'HEAD'])).trim();
  await writeFile(join(remote, 'src/index.ts'), fixedCode);
  await git(remote, ['add', '.']);
  await git(remote, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost', 'commit', '--quiet', '-m', 'fix']);
  const head = (await git(remote, ['rev-parse', 'HEAD'])).trim();
  const requested: URL[] = [];
  let status = 200;
  let merged = true;
  const fakeFetch: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requested.push(url);
    const response = (data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (status !== 200) return response({ message: 'API rate limit exceeded' });
    if (url.pathname === '/repos/test/tiny') return response({ private: false, archived: false, size: 1 });
    if (url.pathname === '/repos/test/tiny/pulls/1') return response({
      merged, head: { sha: head, repo: {} }, base: { sha: base }, changed_files: 1, commits: 1,
      title: 'fix: incorrect answer', html_url: 'https://github.com/test/tiny/pull/1', body: 'Fixes #2. Official solution is secret.',
    });
    if (url.pathname.startsWith('/repos/test/tiny/compare/')) return response({ merge_base_commit: { sha: base } });
    if (url.pathname === '/repos/test/tiny/issues/2') return response({ number: 2, title: 'wrong answer', body: 'Expected fixed; actual old.', html_url: 'https://github.com/test/tiny/issues/2' });
    if (url.pathname === '/search/issues') return response({ incomplete_results: false, items: [
      { number: 1, title: 'fix: incorrect answer', html_url: 'https://github.com/test/tiny/pull/1', repository_url: 'https://api.github.com/repos/test/tiny', pull_request: { merged_at: '2026-01-01' }, body: 'Official solution is secret.' },
      { number: 3, title: 'still open', html_url: 'https://github.com/test/tiny/pull/3', repository_url: 'https://api.github.com/repos/test/tiny', pull_request: { merged_at: null } },
    ] });
    if (url.pathname === '/search/repositories') return response({ incomplete_results: false, items: [
      { full_name: 'test/tiny', html_url: 'https://github.com/test/tiny', description: 'MCP experiment', language: 'TypeScript', topics: ['mcp'], stargazers_count: 1, private: false },
      { full_name: 'test/next', html_url: 'https://github.com/test/next', description: 'Harness', language: 'TypeScript', topics: ['harness'], stargazers_count: 100, private: false },
    ] });
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  };
  const api = new GitHub({ fetch: fakeFetch });
  const root = join(directory, 'lab');
  const lab = new Lab(root, api, () => remote, checkTimeoutMs);
  const prepare = () => lab.prepare({ repository: 'test/tiny', pullNumber: 1, goal: '验证真实复现与修复的对照。' });
  return { directory, remote, root, lab, api, base, head, requested, prepare,
    setStatus(value: number) { status = value; }, setMerged(value: boolean) { merged = value; } };
}

test('准备真实 Git 工作树，默认隐藏补丁，跨服务恢复并判重', async t => {
  const f = await fixture(t);
  const input = { repository: 'test/tiny', keywords: 'fix', includeSeen: false, limit: 5 };
  const found = await f.lab.find(input);
  assert.equal(found.candidates.length, 1);
  assert.equal(JSON.stringify(found).includes('Official solution'), false);
  const prepared = await f.prepare();
  assert.equal(prepared.baselineSha, f.base);
  assert.equal('referenceSha' in prepared, false);
  assert.equal(existsSync(join(f.root, prepared.experimentId, 'official.patch')), false);
  assert.equal(existsSync(join(f.root, prepared.experimentId, 'reference')), false);
  assert.equal(await readFile(join(prepared.workspacePath, 'src/index.ts'), 'utf8'), oldCode);
  assert.equal((await f.lab.find(input)).candidates.length, 0);
  assert.equal((await f.lab.find({ ...input, includeSeen: true })).candidates[0]?.seen, true);
  await writeFile(join(prepared.workspacePath, 'my-note.md'), '保留我的实验记录');
  const restarted = new Lab(f.root, f.api, () => f.remote);
  const restored = await restarted.prepare({ repository: 'TEST/TINY', pullNumber: 1, goal: '不覆盖原实验。' });
  assert.equal(restored.experimentId, prepared.experimentId);
  assert.equal(restored.alreadyPrepared, true);
  assert.equal(await readFile(join(restored.workspacePath, 'my-note.md'), 'utf8'), '保留我的实验记录');
});

test('同一断言：旧版失败、候选通过、官方修复通过；保存真实日志和源码指纹', async t => {
  const f = await fixture(t);
  const prepared = await f.prepare();
  const id = prepared.experimentId;
  await assert.rejects(() => f.lab.reveal(id), /各检查|分别检查/);
  const saved = await f.lab.setTest(id, assertion);
  const baseline = await f.lab.run(id, 'baseline');
  assert.equal(baseline.receipt.outcome, 'assertion_failed', baseline.receipt.stderr);
  assert.equal(baseline.receipt.testSha256, saved.sha256);
  assert.equal((await f.lab.report(id)).assessment, 'baseline_reproduced');
  await writeFile(join(prepared.workspacePath, 'src/index.ts'), fixedCode);
  const candidate = await f.lab.run(id, 'candidate');
  assert.equal(candidate.receipt.outcome, 'passed', candidate.receipt.stderr);
  assert.equal((await f.lab.report(id)).assessment, 'candidate_verified');
  const revealed = await f.lab.reveal(id);
  assert.equal(revealed.referenceSha, f.head);
  assert.ok(revealed.patch.includes("return 'fixed'"));
  assert.equal((await f.lab.run(id, 'reference')).receipt.outcome, 'passed');
  const report = await f.lab.report(id);
  assert.equal(report.assessment, 'reference_checked');
  assert.equal(report.candidateMatchesRun, true);
  assert.equal(report.runs.length, 3);
  assert.equal(await readFile(report.reportPath, 'utf8'), report.markdown);
  assert.ok(report.markdown.includes('| --- | --- | --- | --- | --- |\n| baseline |'));
  assert.equal(await readFile(join(f.root, id, 'baseline/src/index.ts'), 'utf8'), oldCode);
  assert.ok((await readdir(join(f.root, id, 'runs'))).some(name => name.endsWith('.patch')));
  await writeFile(join(revealed.referencePath, 'src/index.ts'), oldCode);
  const staleReference = await f.lab.report(id);
  assert.equal(staleReference.referenceMatchesRun, false);
  assert.equal(staleReference.assessment, 'candidate_verified');
  await writeFile(join(f.root, id, 'baseline/src/index.ts'), fixedCode);
  const staleBaseline = await f.lab.report(id);
  assert.equal(staleBaseline.baselineMatchesRun, false);
  assert.equal(staleBaseline.assessment, 'inconclusive');
});

test('改测试或改源码后旧成功失效；导入/语法错误不能算复现', async t => {
  const f = await fixture(t);
  const prepared = await f.prepare();
  const id = prepared.experimentId;
  await f.lab.setTest(id, assertion);
  await f.lab.run(id, 'baseline');
  await writeFile(join(prepared.workspacePath, 'src/index.ts'), fixedCode);
  await f.lab.run(id, 'candidate');
  assert.equal((await f.lab.report(id)).assessment, 'candidate_verified');
  await writeFile(join(prepared.workspacePath, 'src/index.ts'), oldCode);
  const stale = await f.lab.report(id);
  assert.equal(stale.candidateMatchesRun, false);
  assert.equal(stale.assessment, 'baseline_reproduced');
  await f.lab.setTest(id, "export default async function() { throw new Error('环境没有准备好'); }");
  assert.equal((await f.lab.run(id, 'baseline')).receipt.outcome, 'error');
  assert.equal((await f.lab.report(id)).assessment, 'inconclusive');
  await f.lab.setTest(id, 'export default async function( {');
  assert.equal((await f.lab.run(id, 'baseline')).receipt.outcome, 'error');
});

test('拒绝改过的基线、越界路径与目录符号链接', async t => {
  const f = await fixture(t);
  const prepared = await f.prepare();
  const id = prepared.experimentId;
  for (const path of ['../experiment.json', '.git/config', '/etc/passwd', 'a\\b']) {
    await assert.rejects(() => f.lab.readSource(id, path, 1, 20));
  }
  const outside = join(f.directory, 'outside.txt');
  await writeFile(outside, '只留在外面');
  await symlink(outside, join(prepared.workspacePath, 'escape.txt'));
  await assert.rejects(() => f.lab.readSource(id, 'escape.txt', 1, 20), /必须留在/);
  await f.lab.setTest(id, assertion);
  await assert.rejects(() => f.lab.run(id, 'candidate'), /符号链接/);
  await writeFile(join(f.root, id, 'baseline/src/index.ts'), fixedCode);
  await assert.rejects(() => f.lab.run(id, 'baseline'), /基线或参考版本被修改/);
  assert.equal(await readFile(outside, 'utf8'), '只留在外面');
});

test('超时和取消终止子进程并保留未完成结果', async t => {
  const f = await fixture(t, 350);
  const id = (await f.prepare()).experimentId;
  await f.lab.setTest(id, 'export default async function() { await new Promise(resolve => setTimeout(resolve, 20000)); }');
  assert.equal((await f.lab.run(id, 'baseline')).receipt.outcome, 'timed_out');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120);
  try {
    assert.equal((await f.lab.run(id, 'candidate', controller.signal)).receipt.outcome, 'cancelled');
  } finally { clearTimeout(timer); }
  assert.equal((await f.lab.report(id)).assessment, 'inconclusive');
});

test('检查子进程不继承凭据，未授权写文件失败；超量输出不会算成功', async t => {
  const f = await fixture(t);
  const id = (await f.prepare()).experimentId;
  const key = 'YUUKI_GITHUB_LAB_TEST_SECRET';
  process.env[key] = 'fixture-private-value';
  try {
    await f.lab.setTest(id, `import assert from 'node:assert/strict';
export default function() { assert.equal(process.env.${key}, undefined); }`);
    assert.equal((await f.lab.run(id, 'baseline')).receipt.outcome, 'passed');
  } finally { delete process.env[key]; }
  await f.lab.setTest(id, `import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export default async function(target: string) { await writeFile(join(target, 'forbidden.txt'), 'no'); }`);
  const denied = await f.lab.run(id, 'candidate');
  assert.equal(denied.receipt.outcome, 'error');
  assert.equal(existsSync(join(f.root, id, 'candidate/forbidden.txt')), false);
  await f.lab.setTest(id, "export default function() { console.log('x'.repeat(100000)); }");
  const overflowing = await f.lab.run(id, 'baseline');
  assert.equal(overflowing.receipt.outcome, 'error');
  assert.ok(Buffer.byteLength(overflowing.receipt.stdout) <= 65_536);
});

test('反馈跨实例生效，排序匹配兴趣 topic，done/skip 默认隐藏', async t => {
  const f = await fixture(t);
  await f.lab.saveFeedback({ repository: 'test/next', verdict: 'interested', topics: ['harness'], note: '想读工具循环。' });
  const restarted = new Lab(f.root, f.api);
  const query = { query: 'agent', language: 'TypeScript', limit: 5, includeSeen: false };
  const found = await restarted.discover(query);
  assert.equal(found.projects[0]?.repository, 'test/next');
  assert.deepEqual(found.projects[0]?.matchedTopics, ['harness']);
  assert.ok(f.requested.some(url => url.searchParams.get('q')?.includes('language:TypeScript')));
  await restarted.saveFeedback({ repository: 'test/next', verdict: 'done', topics: [], note: '' });
  assert.deepEqual((await restarted.discover(query)).projects.map(item => item.repository), ['test/tiny']);
  await restarted.saveFeedback({ repository: 'test/tiny', verdict: 'skip', topics: [], note: '' });
  assert.equal((await restarted.discover(query)).projects.length, 0);
  assert.equal((await restarted.discover({ ...query, includeSeen: true })).projects.length, 2);
});

test('API 限额、未合并任务与 Git 失败明确拒绝，准备失败清理新目录', async t => {
  const f = await fixture(t);
  f.setStatus(403);
  await assert.rejects(() => f.prepare(), error => githubError(error).includes('限额'));
  assert.equal(existsSync(f.root), false);
  f.setStatus(200);
  f.setMerged(false);
  await assert.rejects(() => f.prepare(), /已合并/);
  f.setMerged(true);
  const broken = new Lab(f.root, f.api, () => join(f.directory, 'missing-remote'));
  await assert.rejects(() => broken.prepare({ repository: 'test/tiny', pullNumber: 1, goal: '失败不能留下半个实验。' }), /Git/);
  assert.deepEqual(await readdir(f.root), []);
  assert.throws(() => new GitHub({ baseUrl: 'https://example.com' }), /仅支持/);
  assert.throws(() => new GitHub({ baseUrl: 'http://127.0.0.1:1234', token: 'fixture-token' }), /不能接收/);
  assert.equal(hash('abc').length, 64);
});
