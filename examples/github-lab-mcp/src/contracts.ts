import { z } from 'zod';

export const repositorySchema = z.string().regex(
  /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/,
  '使用 owner/repository，例如 developit/mitt。',
);
export const experimentIdSchema = z.uuid();
export const shaSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const relativePathSchema = z.string().min(1).max(240).refine(value =>
  !value.startsWith('/') && !value.includes('\\') && !value.includes('\0') &&
  !value.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part)),
'只允许实验内的相对文件路径，不能访问 .git 或 node_modules。');

export const discoverInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(140).describe('搜索兴趣，例如 mcp、agent harness；使用 GitHub 搜索语法。'),
  language: z.string().regex(/^[a-zA-Z0-9+#.-]{1,30}$/).default('TypeScript'),
  limit: z.number().int().min(1).max(10).default(5),
  includeSeen: z.boolean().default(false),
});
export const feedbackSchema = z.strictObject({
  repository: repositorySchema,
  verdict: z.enum(['interested', 'skip', 'done']),
  topics: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(8).default([]),
  note: z.string().trim().max(500).default(''),
  updatedAt: z.iso.datetime(),
});
export const feedbackInputSchema = feedbackSchema.omit({ updatedAt: true });
export const projectSchema = z.strictObject({
  repository: repositorySchema, url: z.url(), description: z.string(),
  language: z.string().nullable(), topics: z.array(z.string()), stars: z.number(),
  pushedAt: z.string().nullable(), seen: z.boolean(),
  feedback: z.enum(['interested', 'skip', 'done']).nullable(),
  matchedTopics: z.array(z.string()),
});
export const discoverOutputSchema = z.strictObject({
  query: z.string(), incomplete: z.boolean(), examined: z.number(), projects: z.array(projectSchema),
});
export const findInputSchema = z.strictObject({
  repository: repositorySchema,
  keywords: z.string().trim().min(1).max(100).default('fix'),
  limit: z.number().int().min(1).max(10).default(5),
  includeSeen: z.boolean().default(false),
});
export const findOutputSchema = z.strictObject({
  incomplete: z.boolean(),
  candidates: z.array(z.strictObject({
    repository: repositorySchema, number: z.number().int(), title: z.string(), url: z.url(),
    seen: z.boolean(),
  })),
});
export const prepareInputSchema = z.strictObject({
  repository: repositorySchema,
  pullNumber: z.number().int().positive(),
  goal: z.string().trim().min(1).max(700).describe('这次要理解或验证什么，以及预期行为。'),
});
export const experimentReferenceSchema = z.strictObject({ experimentId: experimentIdSchema });
export const preparedOutputSchema = z.strictObject({
  experimentId: experimentIdSchema, repository: repositorySchema,
  baselineSha: shaSchema, workspacePath: z.string(), briefingPath: z.string(),
  alreadyPrepared: z.boolean(),
});

// 只有内部清单保存参考版本；prepare/read_source 的默认结果不会返回官方补丁。
export const manifestSchema = z.strictObject({
  experimentId: experimentIdSchema, repository: repositorySchema,
  pullNumber: z.number().int().positive(), title: z.string(), goal: z.string(),
  baselineSha: shaSchema, referenceSha: shaSchema, url: z.url(), createdAt: z.iso.datetime(),
  issues: z.array(z.strictObject({ number: z.number().int(), title: z.string(), body: z.string(), url: z.url() })),
});
export const readSourceInputSchema = experimentReferenceSchema.extend({
  path: relativePathSchema,
  startLine: z.number().int().min(1).default(1),
  lineCount: z.number().int().min(1).max(200).default(120),
});
export const readSourceOutputSchema = z.strictObject({
  experimentId: experimentIdSchema, path: relativePathSchema, sha256: digestSchema,
  startLine: z.number(), totalLines: z.number(), content: z.string(), truncated: z.boolean(),
});
export const testInputSchema = experimentReferenceSchema.extend({
  source: z.string().trim().min(1).max(32_000).describe(
    'TypeScript ESM，默认导出 async function(target: string)。用 node:assert/strict 断言，从 target 目录动态导入待测源码。只使用 Node 内置模块和实验源码。',
  ),
});
export const testOutputSchema = z.strictObject({ path: z.string(), sha256: digestSchema });
export const targetSchema = z.enum(['baseline', 'candidate', 'reference']);
export const runInputSchema = experimentReferenceSchema.extend({ target: targetSchema });
export const checkOutcomeSchema = z.enum(['passed', 'assertion_failed', 'error', 'timed_out', 'cancelled']);
export const receiptSchema = z.strictObject({
  runId: z.uuid(), target: targetSchema, outcome: checkOutcomeSchema,
  testSha256: digestSchema, treeSha256: digestSchema, revision: shaSchema,
  exitCode: z.number().int().nullable(), durationMs: z.number(),
  stdout: z.string(), stderr: z.string(), detail: z.string(), createdAt: z.iso.datetime(),
});
export const runOutputSchema = z.strictObject({
  receipt: receiptSchema, receiptPath: z.string(), reportPath: z.string(),
});
export const revealOutputSchema = z.strictObject({
  experimentId: experimentIdSchema, referenceSha: shaSchema,
  referencePath: z.string(), patchPath: z.string(), patch: z.string(), truncated: z.boolean(),
});
export const reportOutputSchema = z.strictObject({
  experimentId: experimentIdSchema,
  assessment: z.enum(['prepared', 'inconclusive', 'baseline_reproduced', 'candidate_verified', 'reference_checked']),
  currentTestSha256: digestSchema.nullable(), baselineMatchesRun: z.boolean(),
  candidateMatchesRun: z.boolean(), referenceMatchesRun: z.boolean(),
  runs: z.array(receiptSchema), reportPath: z.string(), markdown: z.string(),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Assessment = z.infer<typeof reportOutputSchema>['assessment'];
