import { z } from 'zod';

const size = z.number().min(0.1).max(500);
const position = z.number().min(-1000).max(1000);
const angle = z.number().min(-360).max(360);

export const modelInputSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).describe('模型名称，例如 practice-tray。'),
  parts: z.array(z.strictObject({
    shape: z.enum(['box', 'cylinder', 'sphere']),
    size: z.tuple([size, size, size]).describe('局部 X、Y、Z 的完整尺寸，单位为毫米。'),
    position: z.tuple([position, position, position]).default([0, 0, 0]).describe('形状中心的 X、Y、Z，单位为毫米。'),
    rotation: z.tuple([angle, angle, angle]).default([0, 0, 0]).describe('绕 X、Y、Z 的旋转角度，单位为度。'),
    operation: z.enum(['add', 'subtract']).default('add').describe('依次合并或挖空；第一项必须为 add。'),
  })).min(1).max(16).refine(parts => parts[0]?.operation === 'add', '第一项必须为 add。'),
});

export const modelIdSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  .describe('create_model 返回的 modelId。');
export const modelReferenceSchema = z.strictObject({ modelId: modelIdSchema });

export const modelInfoSchema = z.strictObject({
  blenderVersion: z.string(),
  dimensionsMm: z.tuple([z.number().nonnegative(), z.number().nonnegative(), z.number().nonnegative()]),
  minimumZMm: z.number(),
  vertices: z.number().int().nonnegative(),
  triangles: z.number().int().nonnegative(),
  nonManifoldEdges: z.number().int().nonnegative(),
  zeroAreaFaces: z.number().int().nonnegative(),
  volumeMm3: z.number().nonnegative(),
  closed: z.boolean(),
});

export const createdModelSchema = z.strictObject({
  modelId: modelIdSchema,
  blendPath: z.string(),
  previewPath: z.string(),
  info: modelInfoSchema,
});
export const inspectedModelSchema = z.strictObject({ modelId: modelIdSchema, info: modelInfoSchema });
export const exportedModelSchema = z.strictObject({
  modelId: modelIdSchema,
  stlPath: z.string(),
  bytes: z.number().int().min(85),
  info: modelInfoSchema,
});

export type ModelInput = z.infer<typeof modelInputSchema>;
export type ModelInfo = z.infer<typeof modelInfoSchema>;
