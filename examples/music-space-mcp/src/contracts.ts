import { z } from 'zod';

export const idSchema = z.uuid();
const pathSchema = z.string().min(1).max(2000);
const colorSchema = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const referenceSchema = z.strictObject({ sceneId: idSchema });
export const depthSchema = z.strictObject({
  width: z.number().int().min(2).max(512), height: z.number().int().min(2).max(512),
  values: z.array(z.number().finite().min(0).max(1)).max(262144),
}).refine(depth => depth.values.length === depth.width * depth.height, '深度像素数量不匹配。');
export const noteSchema = z.strictObject({
  midi: z.number().int().min(0).max(127), time: z.number().finite().min(0),
  duration: z.number().finite().positive(), velocity: z.number().min(0).max(1),
  ticks: z.number().int().min(0), durationTicks: z.number().int().positive(),
});
export const trackSchema = z.strictObject({
  id: z.string().regex(/^track-\d+$/), name: z.string(), instrument: z.string(), percussion: z.boolean(),
  notes: z.array(noteSchema).max(25_000), stem: z.string().regex(/^track-\d+\.wav$/),
  envelope: z.array(z.number().finite().min(0).max(1)).max(4000),
});
export const barSchema = z.strictObject({
  number: z.number().int().positive(), time: z.number().finite().min(0),
  duration: z.number().finite().positive(), ticks: z.number().finite().min(0),
  numerator: z.number().int().positive(), denominator: z.number().int().positive(),
});
export const musicSchema = z.strictObject({
  assetId: idSchema, title: z.string(), kind: z.enum(['midi', 'audio']),
  sourceName: z.string(), sourceSha256: z.string(), duration: z.number().positive().max(180),
  sampleRate: z.union([z.literal(22050), z.literal(48000)]), envelopeStep: z.literal(0.05),
  tracks: z.array(trackSchema).min(1).max(16), bars: z.array(barSchema).max(2000),
  tempos: z.array(z.strictObject({ time: z.number(), bpm: z.number().positive().max(1000) })),
  repeats: z.array(z.strictObject({ trackId: z.string(), bars: z.array(z.number().int().positive()), fingerprint: z.string() })),
  markers: z.array(z.strictObject({ time: z.number().min(0).max(180), label: z.string().max(80) })).max(32).default([]),
});
export const cameraSchema = z.strictObject({
  azimuth: z.number().min(-170).max(170), elevation: z.number().min(10).max(85), distance: z.number().min(8).max(70),
});
export const scoreSettingsSchema = z.strictObject({
  timeScale: z.number().min(0.3).max(2), pitchScale: z.number().min(0.1).max(1),
  layerSpacing: z.number().min(1).max(8), showRepeats: z.boolean(),
});
export const photoSettingsSchema = z.strictObject({
  depthStrength: z.number().min(0).max(2), cameraTravel: z.number().min(0).max(0.8),
  zoom: z.number().min(1).max(1.4), pulse: z.number().min(0).max(0.25),
});
export const cueSchema = z.strictObject({
  time: z.number().min(0).max(180), label: z.string().max(80),
  zoom: z.number().min(1).max(1.4), pan: z.number().min(-1).max(1),
  light: z.number().min(0).max(1).default(0.5),
});
export const transportSchema = z.strictObject({
  position: z.number().min(0), playing: z.boolean(), updatedAt: z.number(),
  soloTrackIds: z.array(z.string()).max(16),
});
export const sceneSchema = z.strictObject({
  schemaVersion: z.literal(1), sceneId: idSchema, assetId: idSchema,
  title: z.string().min(1).max(120), mode: z.enum(['score', 'photo']), revision: z.number().int().positive(),
  camera: cameraSchema, score: scoreSettingsSchema, photo: photoSettingsSchema,
  colors: z.array(colorSchema).min(1).max(16), cues: z.array(cueSchema).min(1).max(32),
  depthSource: z.enum(['none', 'provided', 'layered', 'layers']),
  photoLayers: z.array(z.strictObject({ file: z.string().regex(/^layer-[1-4]\.png$/), depth: z.number().min(0.5).max(6) })).max(4).default([]),
  transport: transportSchema,
});
export const importInputSchema = z.strictObject({ path: pathSchema, title: z.string().trim().min(1).max(120).optional() });
export const assetSummarySchema = musicSchema.omit({ tracks: true, bars: true, repeats: true }).extend({
  tracks: z.array(z.strictObject({ id: z.string(), name: z.string(), noteCount: z.number().int(), instrument: z.string() })),
  barCount: z.number().int(), repeatedPatterns: z.number().int(),
});
export const scoreInputSchema = z.strictObject({ assetId: idSchema, title: z.string().trim().min(1).max(120).optional() });
export const photoInputSchema = scoreInputSchema.extend({
  imagePath: pathSchema, depthPath: pathSchema.optional(),
  layers: z.array(z.strictObject({ path: pathSchema, depth: z.number().min(0.5).max(6) })).max(4).optional(),
}).refine(input => !input.depthPath || !input.layers?.length, '深度图和分层素材请选择一种方式。');
export const sceneOutputSchema = z.strictObject({ scene: sceneSchema, previewUrl: z.url(), configPath: z.string() });
export const inspectOutputSchema = sceneOutputSchema.extend({ music: assetSummarySchema, currentTime: z.number(), activeNotes: z.number().int(), audibleTrackIds: z.array(z.string()) });
export const updateInputSchema = referenceSchema.extend({
  expectedRevision: z.number().int().positive(),
  title: z.string().trim().min(1).max(120).optional(),
  camera: cameraSchema.partial().optional(), score: scoreSettingsSchema.partial().optional(),
  photo: photoSettingsSchema.partial().optional(), colors: z.array(colorSchema).min(1).max(16).optional(),
  cues: z.array(cueSchema).min(1).max(32).optional(),
});
export const transportInputSchema = referenceSchema.extend({
  time: z.number().min(0).optional(), bar: z.number().int().positive().optional(),
  playing: z.boolean().optional(), soloTrackIds: z.array(z.string()).max(16).optional(),
}).refine(input => input.time === undefined || input.bar === undefined, 'time 和 bar 只能指定一个。');
export const previewInputSchema = referenceSchema.extend({ time: z.number().min(0).optional() });
export const previewOutputSchema = z.strictObject({ path: z.string(), time: z.number(), backend: z.enum(['webgpu', 'webgl']), width: z.number(), height: z.number() });
export const modelOutputSchema = z.strictObject({ path: z.string(), bytes: z.number().positive(), time: z.number(), revision: z.number().int().positive() });
export const exportInputSchema = referenceSchema.extend({
  start: z.number().min(0).default(0), duration: z.number().min(0.5).max(20).default(4),
  fps: z.union([z.literal(24), z.literal(30)]).default(24),
  width: z.union([z.literal(640), z.literal(960), z.literal(1280)]).default(960),
});
export const exportOutputSchema = z.strictObject({ path: z.string(), bytes: z.number().positive(), frames: z.number().int(), duration: z.number(), backend: z.enum(['webgpu', 'webgl']) });
export type Music = z.infer<typeof musicSchema>;
export type Track = z.infer<typeof trackSchema>;
export type MusicScene = z.infer<typeof sceneSchema>;
export type SceneUpdate = z.input<typeof updateInputSchema>;
export type TransportInput = z.infer<typeof transportInputSchema>;
export interface FrameInfo { time: number; activeNotes: number; audibleTrackIds: string[]; energy: number; backend: 'webgpu' | 'webgl' }
export interface ViewerApi {
  frame(time: number): Promise<FrameInfo>;
  model(): Promise<string>;
  snapshot(): FrameInfo & { audioState: string; meter: number };
}
declare global { interface Window { musicSpace: ViewerApi } }
