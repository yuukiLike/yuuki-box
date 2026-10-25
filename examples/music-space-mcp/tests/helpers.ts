import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { writeDemoMidi } from '../src/fixtures.js';
import { MusicStore } from '../src/store.js';

export async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'yuuki-music-space-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = await writeDemoMidi(join(directory, 'inputs'));
  const store = new MusicStore(join(directory, 'library'));
  const music = await store.import(input);
  return { directory, input, store, music };
}
