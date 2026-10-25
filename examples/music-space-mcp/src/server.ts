import { homedir } from 'node:os';
import { join } from 'node:path';
import { MusicStore } from './store.js';
import { startPreview } from './http.js';
import { createMusicServer } from './tools.js';

export async function createServer() {
  const store = new MusicStore(process.env.YUUKI_MUSIC_DIR ?? join(homedir(), '.yuuki', 'music-space'));
  const preview = await startPreview(store, true);
  return createMusicServer(store, () => preview.origin, 'stdio');
}
