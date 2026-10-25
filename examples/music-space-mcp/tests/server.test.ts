import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { assetSummarySchema, inspectOutputSchema, modelOutputSchema, sceneOutputSchema } from '../src/contracts.js';
import { callTool, withClient } from '../src/client.js';
import { fixture } from './helpers.js';

test('真实 stdio MCP：发现九个工具，拒绝坏输入，场景跨服务进程恢复', async t => {
  const f = await fixture(t); const root = join(f.directory, 'mcp-library'); let sceneId = '';
  await withClient(root, async client => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), ['import_music', 'create_score_scene', 'create_photo_scene', 'inspect_scene', 'update_scene', 'set_transport', 'render_preview', 'export_clip', 'export_model']);
    await assert.rejects(() => callTool(client, 'create_score_scene', { assetId: '../outside' }, sceneOutputSchema));
    assert.equal(existsSync(root), false);
    const music = await callTool(client, 'import_music', { path: f.input }, assetSummarySchema);
    const created = await callTool(client, 'create_score_scene', { assetId: music.assetId }, sceneOutputSchema);
    sceneId = created.scene.sceneId;
    await assert.rejects(() => callTool(client, 'set_transport', { sceneId, time: 0, bar: 1 }, sceneOutputSchema));
    await callTool(client, 'set_transport', { sceneId, bar: 8, playing: false, soloTrackIds: ['track-2'] }, sceneOutputSchema);
    const model = await callTool(client, 'export_model', { sceneId, time: 6.8 }, modelOutputSchema);
    const glb = await readFile(model.path);
    assert.equal(glb.toString('ascii', 0, 4), 'glTF'); assert.equal(glb.readUInt32LE(4), 2); assert.equal(glb.readUInt32LE(8), glb.length);
    const document = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))) as { meshes: unknown[]; nodes: { name?: string }[] };
    const keyNames = document.nodes.map(node => node.name).filter(name => name?.startsWith('Key_'));
    assert.equal(keyNames.length, 88);
    assert.ok(keyNames.includes('Key_C4_60')); assert.ok(keyNames.includes('Key_A0_21')); assert.ok(keyNames.includes('Key_C8_108'));
    assert.ok(document.nodes.some(node => node.name === 'piano.lid'));
    const downloaded = await fetch(model.downloadUrl); assert.equal(downloaded.status, 200); assert.equal((await downloaded.arrayBuffer()).byteLength, glb.length);
    assert.equal((await fetch(`${new URL(created.previewUrl).origin}/api/scenes`)).status, 200);
  });
  await withClient(root, async client => {
    const restored = await callTool(client, 'inspect_scene', { sceneId }, inspectOutputSchema);
    assert.deepEqual(restored.audibleTrackIds, ['track-2']);
    assert.ok(restored.currentTime > 10); assert.equal(restored.scene.transport.playing, false);
  });
});
