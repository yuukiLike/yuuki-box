import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { assetSummarySchema, idSchema, musicSchema, sceneSchema, toolCallSchema, type Music, type MusicScene, type SceneUpdate, type ToolCall, type TransportInput } from './contracts.js';
import { sceneObjects, viewCamera } from './presentation.js';
import { importMusic, localFile } from './media.js';
import { frameAt, positionAt } from './timeline.js';

export async function json<Schema extends z.ZodType>(path: string, schema: Schema): Promise<z.output<Schema>> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16_777_216) throw new Error('数据文件格式或大小不合法。');
  const input: unknown = JSON.parse(await readFile(path, 'utf8'));
  return schema.parse(input);
}
export async function atomicJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
export class MusicStore {
  private readonly pending = new Map<string, Promise<unknown>>();
  constructor(readonly root: string) { if (!isAbsolute(root)) throw new Error('YUUKI_MUSIC_DIR 必须是绝对路径。'); }
  async safeDirectory(kind: 'assets' | 'scenes', id: string): Promise<string> {
    idSchema.parse(id);
    const path = join(this.root, kind, id);
    const actual = await realpath(path);
    if (actual !== join(await realpath(this.root), kind, id)) throw new Error('数据目录不能是符号链接。');
    return actual;
  }
  async music(assetId: string): Promise<Music> { return await json(join(await this.safeDirectory('assets', assetId), 'music.json'), musicSchema); }
  async scene(sceneId: string): Promise<MusicScene> { return await json(join(await this.safeDirectory('scenes', sceneId), 'scene.json'), sceneSchema); }
  async list(): Promise<MusicScene[]> {
    const directory = join(this.root, 'scenes');
    let names: string[];
    try { names = await readdir(directory); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
    const result = [];
    for (const name of names) if (idSchema.safeParse(name).success) {
      try { result.push(await this.scene(name)); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    }
    return result;
  }
  async import(path: string, title?: string, signal?: AbortSignal) { return await importMusic(this.root, path, title, signal); }
  summary(music: Music) {
    const { tracks, bars, repeats, ...metadata } = music;
    return assetSummarySchema.parse({ ...metadata, tracks: tracks.map(track => ({ id: track.id, name: track.name,
      noteCount: track.notes.length, instrument: track.instrument })), barCount: bars.length, repeatedPatterns: repeats.length });
  }
  private async serial<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(action);
    this.pending.set(id, operation);
    try { return await operation; }
    finally { if (this.pending.get(id) === operation) this.pending.delete(id); }
  }
  async create(assetId: string, mode: 'score' | 'photo', options: { title?: string; imagePath?: string; depthPath?: string; layers?: { path: string; depth: number }[] }) {
    const music = await this.music(assetId);
    if (mode === 'score' && music.kind !== 'midi') throw new Error('声部空间需要多轨 MIDI；整曲音频不能当成精确音符或声部。');
    const sceneId = randomUUID();
    const directory = join(this.root, 'scenes', sceneId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      const scene = sceneSchema.parse({
        schemaVersion: 1, sceneId, assetId, mode, revision: 1, title: options.title ?? music.title,
        camera: viewCamera(mode, 'overview'),
        score: { timeScale: 0.9, pitchScale: 0.3, layerSpacing: 3.2, showRepeats: true },
        photo: { depthStrength: 1, cameraTravel: 0.6, zoom: 1.07, pulse: 0.16 },
        colors: ['#ffbd69', '#6ce5d4', '#b9a4ff', '#ef8095'],
        cues: music.markers.length > 1 ? music.markers.map((marker, i) => ({ ...marker, zoom: 1 + (i % 3) * 0.07, pan: Math.sin(i * 1.8) * 0.6, light: [0.2, 0.55, 0.85, 1, 0.35][i % 5] ?? 0.5 }))
          : [{ time: 0, label: 'Opening', zoom: 1, pan: -0.4, light: 0.2 }, { time: music.duration / 2, label: 'Interweave', zoom: 1.14, pan: 0.5, light: 1 }, { time: music.duration, label: 'Afterglow', zoom: 1, pan: -0.2, light: 0.3 }],
        depthSource: mode === 'photo' ? options.layers?.length ? 'layers' : options.depthPath ? 'provided' : 'layered' : 'none',
        photoLayers: (options.layers ?? []).map((layer, i) => ({ file: `layer-${i + 1}.png`, depth: layer.depth })),
        transport: { position: 0, playing: false, updatedAt: Date.now(), soloTrackIds: [] },
      });
      if (mode === 'photo') {
        if (options.layers?.length && options.depthPath) throw new Error('深度图和分层素材请选择一种方式。');
        if (!options.imagePath) throw new Error('图片场景需要 imagePath。');
        const image = await localFile(options.imagePath, ['.png', '.jpg', '.jpeg', '.webp']);
        const decoded = sharp(image, { limitInputPixels: 16_777_216 });
        const metadata = await decoded.metadata();
        if (!metadata.width || !metadata.height) throw new Error('无法读取图片尺寸。');
        const normalized = await decoded.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true }).png().toFile(join(directory, 'photo.png'));
        if (normalized.width / normalized.height < 0.4 || normalized.width / normalized.height > 3) throw new Error('图片宽高比须在 0.4–3 之间。');
        const width = 161;
        const height = Math.round((width - 1) * normalized.height / normalized.width) + 1;
        const values: number[] = [];
        if (options.depthPath) {
          const depth = await localFile(options.depthPath, ['.png', '.jpg', '.jpeg', '.webp']);
          const model = sharp(depth, { limitInputPixels: 16_777_216 });
          const depthInfo = await model.metadata();
          if (!depthInfo.width || !depthInfo.height || Math.abs((depthInfo.width / depthInfo.height) / (normalized.width / normalized.height) - 1) > 0.03) throw new Error('深度图与照片的宽高比不匹配。');
          const raw = await model.removeAlpha().greyscale().resize(width, height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
          for (let i = 0; i < width * height; i++) values.push((raw.data[i * raw.info.channels] ?? 0) / 255);
        } else {
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const v = y / (height - 1);
            values.push(options.layers?.length ? 0.1 : Math.min(1, 0.06 + 0.25 * v + 0.65 * Math.max(0, (v - 0.56) / 0.44) ** 1.5));
          }
        }
        await atomicJson(join(directory, 'depth.json'), { width, height, values });
        for (const [index, layer] of (options.layers ?? []).entries()) {
          const buffer = await localFile(layer.path, ['.png', '.webp']);
          const input = sharp(buffer, { limitInputPixels: 16_777_216 });
          const info = await input.metadata();
          if (!info.hasAlpha || !info.width || !info.height || Math.abs((info.width / info.height) / (normalized.width / normalized.height) - 1) > 0.03) {
            throw new Error('分层素材必须有透明通道，且宽高比与背景一致。');
          }
          const alpha = (await input.stats()).channels.at(-1);
          if (!alpha || alpha.min === 255 || alpha.max === 0) throw new Error('分层素材须包含可见内容与实际透明像素。');
          await input.resize({ width: normalized.width, height: normalized.height, fit: 'fill' }).png().toFile(join(directory, `layer-${index + 1}.png`));
        }
      }
      await atomicJson(join(directory, 'scene.json'), scene);
      return scene;
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  }
  async update(input: SceneUpdate) {
    return await this.serial(input.sceneId, async () => {
      const scene = await this.scene(input.sceneId);
      if (input.expectedRevision !== scene.revision) throw new Error('场景已更新，请重新 inspect_scene 后再修改。');
      const music = await this.music(scene.assetId);
      const next = sceneSchema.parse({ ...scene,
        title: input.title ?? scene.title, revision: scene.revision + 1,
        camera: { ...scene.camera, ...(input.presentation?.view && input.presentation.view !== scene.presentation.view ? viewCamera(scene.mode, input.presentation.view) : {}), ...input.camera }, score: { ...scene.score, ...input.score },
        photo: { ...scene.photo, ...input.photo }, colors: input.colors ?? scene.colors,
        presentation: { ...scene.presentation, ...input.presentation }, model: { ...scene.model, ...input.model },
        cues: (input.cues ?? scene.cues).toSorted((a, b) => a.time - b.time),
      });
      if (next.cues.some((cue, index) => cue.time > music.duration || (index > 0 && cue.time === next.cues[index - 1]?.time))) throw new Error('镜头关键帧时间须唯一且位于音乐时长内。');
      await atomicJson(join(await this.safeDirectory('scenes', scene.sceneId), 'scene.json'), next);
      return next;
    });
  }
  async transport(input: TransportInput) {
    return await this.serial(input.sceneId, async () => {
      const scene = await this.scene(input.sceneId);
      const music = await this.music(scene.assetId);
      const bar = input.bar === undefined ? undefined : music.bars.find(bar => bar.number === input.bar);
      if (input.bar !== undefined && !bar) throw new Error('该小节不存在；音频素材没有 MIDI 小节编号。');
      const position = input.time ?? bar?.time ?? positionAt(scene, music.duration);
      if (position > music.duration) throw new Error('定位超过音乐时长。');
      const soloTrackIds = input.soloTrackIds ?? scene.transport.soloTrackIds;
      if (soloTrackIds.some(id => !music.tracks.some(track => track.id === id))) throw new Error('独听声部不存在。');
      const next = sceneSchema.parse({ ...scene, revision: scene.revision + 1,
        transport: { position, playing: input.playing ?? scene.transport.playing, updatedAt: Date.now(), soloTrackIds } });
      await atomicJson(join(await this.safeDirectory('scenes', scene.sceneId), 'scene.json'), next);
      return next;
    });
  }
  async inspect(sceneId: string) {
    const scene = await this.scene(sceneId);
    const music = await this.music(scene.assetId);
    const currentTime = positionAt(scene, music.duration);
    const frame = frameAt(scene, music, currentTime);
    return { scene, music: this.summary(music), currentTime, activeNotes: frame.activeNotes, audibleTrackIds: frame.audibleTrackIds, objects: sceneObjects(scene) };
  }
  async calls(): Promise<ToolCall[]> {
    try { return await json(join(this.root, 'tool-calls.json'), z.array(toolCallSchema).max(40)); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
  }
  async recordCall(call: ToolCall): Promise<void> {
    await this.serial('tool-calls', async () => {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      await atomicJson(join(this.root, 'tool-calls.json'), [...await this.calls(), toolCallSchema.parse(call)].slice(-40));
    });
  }
}
