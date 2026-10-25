import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { writeDemoMidi } from '../src/fixtures.js';
import { MusicStore } from '../src/store.js';

export async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'yuuki-music-space-'));
  const cleanup: (() => Promise<unknown>)[] = [() => rm(directory, { recursive: true, force: true })];
  t.after(async () => {
    const errors: unknown[] = [];
    for (const close of cleanup.toReversed()) { try { await close(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, '测试资源清理失败。');
  });
  const input = await writeDemoMidi(join(directory, 'inputs'));
  const store = new MusicStore(join(directory, 'library'));
  const music = await store.import(input);
  return { directory, input, store, music, onCleanup: (close: () => Promise<unknown>) => { cleanup.push(close); } };
}
