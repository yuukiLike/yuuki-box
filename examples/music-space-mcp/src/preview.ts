import { fileURLToPath } from 'node:url';
import { MusicStore } from './store.js';
import { startPreview } from './http.js';

const root = process.env.YUUKI_MUSIC_DIR ?? fileURLToPath(new URL('../../.artifacts/practical', import.meta.url));
const preview = await startPreview(new MusicStore(root));
console.log(`音乐空间：${preview.origin}\n素材与场景：${root}`);
process.once('SIGINT', () => { void preview.close(); });
process.once('SIGTERM', () => { void preview.close(); });
