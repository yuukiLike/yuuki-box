import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { callTool, withClient } from './client.js';
import { assetSummarySchema, exportOutputSchema, inspectOutputSchema, modelOutputSchema, previewOutputSchema, sceneOutputSchema } from './contracts.js';
import { writeDemoMidi } from './fixtures.js';

const root = fileURLToPath(new URL('../../.artifacts', import.meta.url));
const midiPath = await writeDemoMidi(join(root, 'inputs'));
await withClient(root, async client => {
  const { tools } = await client.listTools(); assert.equal(tools.length, 9);
  const asset = await callTool(client, 'import_music', { path: midiPath, title: '三条声部 · 相遇与回归' }, assetSummarySchema);
  const score = await callTool(client, 'create_score_scene', { assetId: asset.assetId, title: '声部之结 · Phrase Knot' }, sceneOutputSchema);
  await callTool(client, 'set_transport', { sceneId: score.scene.sceneId, bar: 8, playing: false, soloTrackIds: ['track-2'] }, sceneOutputSchema);
  const scoreInfo = await callTool(client, 'inspect_scene', { sceneId: score.scene.sceneId }, inspectOutputSchema);
  assert.deepEqual(scoreInfo.audibleTrackIds, ['track-2']);
  await callTool(client, 'set_transport', { sceneId: score.scene.sceneId, soloTrackIds: [] }, sceneOutputSchema);
  const scoreImage = await callTool(client, 'render_preview', { sceneId: score.scene.sceneId, time: 6.8 }, previewOutputSchema);
  const scoreReturn = await callTool(client, 'render_preview', { sceneId: score.scene.sceneId, time: 18 }, previewOutputSchema);
  const scoreModel = await callTool(client, 'export_model', { sceneId: score.scene.sceneId, time: 6.8 }, modelOutputSchema);
  const scoreClip = await callTool(client, 'export_clip', { sceneId: score.scene.sceneId, start: 8, duration: 6, width: 960 }, exportOutputSchema);
  await callTool(client, 'set_transport', { sceneId: score.scene.sceneId, time: 0, playing: false }, sceneOutputSchema);
  // 第二个案例实际走音频导入路径：同一练习的完整混音，而不是从混音虚构音符。
  const audio = await callTool(client, 'import_music', { path: join(scoreClip.path, '..', 'audio.wav'), title: '三声部完整混音' }, assetSummarySchema);
  const photo = await callTool(client, 'create_photo_scene', { assetId: audio.assetId,
    imagePath: fileURLToPath(new URL('../../assets/theatre.png', import.meta.url)), title: '光之剧场 · Light Theatre',
    layers: [{ path: fileURLToPath(new URL('../../assets/proscenium.png', import.meta.url)), depth: 2.4 },
      { path: fileURLToPath(new URL('../../assets/silk.png', import.meta.url)), depth: 5 }] }, sceneOutputSchema);
  // The audio has no inferred sections: deliberately reuse the source MIDI's authored markers.
  await callTool(client, 'update_scene', { sceneId: photo.scene.sceneId, expectedRevision: photo.scene.revision, cues: score.scene.cues }, sceneOutputSchema);
  const photoImage = await callTool(client, 'render_preview', { sceneId: photo.scene.sceneId, time: 5 }, previewOutputSchema);
  const photoReturn = await callTool(client, 'render_preview', { sceneId: photo.scene.sceneId, time: 18 }, previewOutputSchema);
  const photoClip = await callTool(client, 'export_clip', { sceneId: photo.scene.sceneId, start: 10, duration: 6, width: 960 }, exportOutputSchema);
  const manifest = { score: score.scene.sceneId, photo: photo.scene.sceneId, scoreImage, scoreReturn, scoreModel, scoreClip, photoImage, photoReturn, photoClip };
  await writeFile(join(root, 'demo.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
  console.log('两种场景均已通过真实 MCP 调用生成 PNG 与带声音的 MP4。');
  console.log('交互预览：pnpm --dir examples/music-space-mcp preview');
});
