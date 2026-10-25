import { z } from 'zod';

const projectSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, '项目名须为 1–64 个小写字母、数字或连字符，且以字母或数字开头。')
  .describe('项目标识，例如 yuuki-box、algorithm-box、violin。');

export const saveCheckpointInputSchema = z.strictObject({
  project: projectSchema,
  next: z.string().trim().min(1).max(500).describe('下次只做的一件具体小事。'),
  context: z.string().trim().min(1).max(1000).optional().describe('可选：已经确认的进度、问题或文件位置。'),
  stopWhen: z.string().trim().min(1).max(300).optional().describe('可选：做到什么程度就可以停。'),
});

export const saveCheckpointOutputSchema = z.strictObject({
  saved: z.literal(true),
  project: projectSchema,
  path: z.string(),
});

export const resumeInputSchema = z.strictObject({ project: projectSchema });

export const resumeOutputSchema = z.discriminatedUnion('found', [
  z.strictObject({ found: z.literal(false), project: projectSchema }),
  z.strictObject({ found: z.literal(true), project: projectSchema, path: z.string(), note: z.string() }),
]);

// 从运行时契约推导类型，避免再手写一份容易不同步的 interface。
export type CheckpointInput = z.infer<typeof saveCheckpointInputSchema>;
export type ResumeOutput = z.infer<typeof resumeOutputSchema>;
