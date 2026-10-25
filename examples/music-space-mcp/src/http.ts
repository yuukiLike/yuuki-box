import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportInputSchema, idSchema, sceneSchema, transportInputSchema, updateInputSchema } from './contracts.js';
import { exportClip } from './render.js';
import { MusicStore, json } from './store.js';

export async function startPreview(store: MusicStore, unref = false) {
  let origin = '';
  const server = createServer((request, response) => {
    const send = (status: number, data: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    void (async () => {
      if (request.headers.host !== new URL(origin).host) { send(403, { error: 'Host 不匹配。' }); return; }
      const url = new URL(request.url ?? '/', origin);
      const parts = url.pathname.split('/').filter(Boolean);
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/viewer.js' || url.pathname === '/style.css')) {
        const path = url.pathname === '/' ? fileURLToPath(new URL('../../web/index.html', import.meta.url))
          : url.pathname === '/style.css' ? fileURLToPath(new URL('../../web/style.css', import.meta.url))
          : fileURLToPath(new URL('../viewer.js', import.meta.url));
        response.writeHead(200, { 'content-type': url.pathname === '/' ? 'text/html; charset=utf-8' : url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', 'cache-control': 'no-store' });
        response.end(await readFile(path)); return;
      }
      if (request.method === 'GET' && url.pathname === '/api/scenes') {
        send(200, (await store.list()).map(scene => ({ sceneId: scene.sceneId, title: scene.title, mode: scene.mode }))); return;
      }
      if (request.method === 'GET' && parts[0] === 'api' && (parts[1] === 'scene' || parts[1] === 'state')) {
        const sceneId = idSchema.parse(parts[2]);
        let scene = await store.scene(sceneId);
        const snapshot = url.searchParams.get('snapshot');
        if (snapshot) scene = await json(join(await store.safeDirectory('scenes', sceneId), 'exports', idSchema.parse(snapshot), 'scene.json'), sceneSchema);
        if (parts[1] === 'state') send(200, scene);
        else send(200, { scene, music: await store.music(scene.assetId) });
        return;
      }
      if (request.method === 'GET' && parts[0] === 'media') {
        const kind = parts[1]; const id = idSchema.parse(parts[2]); const file = parts[3] ?? '';
        if (!(kind === 'assets' && /^track-\d+\.wav$/.test(file)) && !(kind === 'scenes' && (['photo.png', 'depth.json'].includes(file) || /^layer-[1-4]\.png$/.test(file)))) {
          send(404, { error: '素材不存在。' }); return;
        }
        const path = join(await store.safeDirectory(kind === 'assets' ? 'assets' : 'scenes', id), file);
        response.writeHead(200, { 'content-type': file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.png') ? 'image/png' : 'application/json', 'cache-control': 'private, max-age=3600' });
        response.end(await readFile(path)); return;
      }
      if (request.method === 'POST' && parts[0] === 'api') {
        if (request.headers.origin !== origin) { send(403, { error: 'Origin 不匹配。' }); return; }
        let bytes = 0; const chunks: Buffer[] = [];
        for await (const raw of request) {
          const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          bytes += chunk.length; if (bytes > 65_536) throw new Error('请求超过 64 KiB。'); chunks.push(chunk);
        }
        const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (parts[1] === 'transport') { send(200, await store.transport(transportInputSchema.parse(input))); return; }
        if (parts[1] === 'update') { send(200, await store.update(updateInputSchema.parse(input))); return; }
        if (parts[1] === 'export') {
          const options = exportInputSchema.parse(input);
          send(200, await exportClip(store, options.sceneId, origin, options)); return;
        }
      }
      send(404, { error: '页面不存在。' });
    })().catch(error => {
      if (!response.headersSent) send(400, { error: error instanceof Error ? error.message.slice(0, 1500) : '操作失败。' });
      else response.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法取得预览服务地址。');
  origin = `http://127.0.0.1:${address.port}`;
  if (unref) server.unref();
  return { origin, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
