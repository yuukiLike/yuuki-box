import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { type MusicScene } from './contracts.js';
import { decodeOwnWav, ffmpeg, wav } from './media.js';
import { atomicJson, MusicStore } from './store.js';
import { audibleTracks } from './timeline.js';

export async function launchBrowser(): Promise<Browser> {
  const executable = process.env.YUUKI_MUSIC_CHROME_BIN;
  return await chromium.launch({
    ...(executable ? { executablePath: executable } : existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? { channel: 'chrome' } : {}),
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
}

async function openCapture(store: MusicStore, scene: MusicScene, origin: string, width: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const directory = join(await store.safeDirectory('scenes', scene.sceneId), 'exports', randomUUID());
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await atomicJson(join(directory, 'scene.json'), scene);
  const snapshot = directory.split('/').at(-1) ?? '';
  const browser = await launchBrowser();
  const closeOnAbort = () => { void browser.close().catch(() => undefined); };
  signal?.addEventListener('abort', closeOnAbort, { once: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: Math.round(width * 9 / 16) }, deviceScaleFactor: 1 });
    await page.goto(`${origin}/?scene=${scene.sceneId}&capture=1&backend=webgl&snapshot=${snapshot}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForFunction(() => !!window.musicSpace, { timeout: 30_000 });
    return { directory, page, close: async () => { signal?.removeEventListener('abort', closeOnAbort); await browser.close(); } };
  } catch (error) { signal?.removeEventListener('abort', closeOnAbort); await browser.close(); await rm(directory, { recursive: true, force: true }); throw error; }
}

export async function renderPreview(store: MusicStore, sceneId: string, origin: string, time: number, signal?: AbortSignal) {
  const scene = await store.scene(sceneId);
  const music = await store.music(scene.assetId);
  if (time > music.duration) throw new Error('预览时间超过音乐时长。');
  const capture = await openCapture(store, scene, origin, 1280, signal);
  try {
    const frame = await capture.page.evaluate(time => window.musicSpace.frame(time), time);
    const path = join(capture.directory, 'preview.png');
    await capture.page.screenshot({ path, type: 'png' });
    return { path, time, backend: frame.backend, width: 1280, height: 720 };
  } finally { await capture.close(); }
}

export async function exportModel(store: MusicStore, sceneId: string, origin: string, time: number, signal?: AbortSignal) {
  const scene = await store.scene(sceneId); const music = await store.music(scene.assetId);
  if (scene.mode !== 'score') throw new Error('GLB 导出只适用于声部之结。');
  if (time > music.duration) throw new Error('模型时间超过音乐时长。');
  const capture = await openCapture(store, scene, origin, 640, signal);
  try {
    await capture.page.evaluate(time => window.musicSpace.frame(time), time);
    const data = Buffer.from(await capture.page.evaluate(() => window.musicSpace.model()), 'base64');
    const path = join(capture.directory, 'phrase-knot.glb'); await writeFile(path, data);
    return { path, bytes: data.length, time, revision: scene.revision };
  } finally { await capture.close(); }
}

export async function exportClip(store: MusicStore, sceneId: string, origin: string,
  options: { start: number; duration: number; fps: 24 | 30; width: 640 | 960 | 1280 }, signal?: AbortSignal) {
  const scene = await store.scene(sceneId);
  const music = await store.music(scene.assetId);
  const frames = Math.round(options.duration * options.fps);
  const duration = frames / options.fps;
  if (options.start + duration > music.duration + 0.000001) throw new Error('导出范围超过音乐时长。');
  const capture = await openCapture(store, scene, origin, options.width, signal);
  const frameDirectory = join(capture.directory, 'frames');
  await mkdir(frameDirectory);
  try {
    let backend: 'webgpu' | 'webgl' = 'webgl';
    for (let index = 0; index < frames; index++) {
      signal?.throwIfAborted();
      const frame = await capture.page.evaluate(time => window.musicSpace.frame(time), options.start + index / options.fps);
      backend = frame.backend;
      await capture.page.screenshot({ path: join(frameDirectory, `${String(index).padStart(5, '0')}.png`), type: 'png' });
    }
    const audioPath = join(capture.directory, 'audio.wav');
    const path = join(capture.directory, 'clip.mp4');
    if (music.kind === 'audio') {
      const track = music.tracks[0]; if (!track) throw new Error('音轨缺失。');
      await writeFile(audioPath, await readFile(join(await store.safeDirectory('assets', music.assetId), track.stem)));
    } else {
      const mixed = new Float32Array(Math.ceil(music.duration * music.sampleRate));
      const audible = audibleTracks(scene, music);
      for (const track of music.tracks.filter(track => audible.includes(track.id))) {
        const samples = decodeOwnWav(await readFile(join(await store.safeDirectory('assets', music.assetId), track.stem)));
        for (let index = 0; index < samples.length; index++) mixed[index] = (mixed[index] ?? 0) + (samples[index] ?? 0) * 0.7;
      }
      await writeFile(audioPath, wav(mixed));
    }
    await ffmpeg(['-framerate', String(options.fps), '-i', join(frameDirectory, '%05d.png'),
      '-ss', String(options.start), '-i', audioPath,
      '-frames:v', String(frames), '-t', String(duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '19',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path], signal);
    const result = { path, bytes: (await stat(path)).size, frames, duration, backend };
    await atomicJson(join(capture.directory, 'receipt.json'), { sceneId, revision: scene.revision, ...options, ...result,
      soloTrackIds: scene.transport.soloTrackIds, createdAt: new Date().toISOString() });
    return result;
  } catch (error) { await rm(join(capture.directory, 'clip.mp4'), { force: true }); throw error; }
  finally { await capture.close(); await rm(frameDirectory, { recursive: true, force: true }); }
}

export async function frameInfo(page: Page, time: number) { return await page.evaluate(time => window.musicSpace.frame(time), time); }
