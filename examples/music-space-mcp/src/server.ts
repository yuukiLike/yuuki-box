import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  assetSummarySchema, exportInputSchema, exportOutputSchema, importInputSchema, inspectOutputSchema, modelOutputSchema,
  photoInputSchema, previewInputSchema, previewOutputSchema, referenceSchema, sceneOutputSchema,
  scoreInputSchema, transportInputSchema, updateInputSchema, type MusicScene,
} from './contracts.js';
import { startPreview } from './http.js';
import { exportClip, exportModel, renderPreview } from './render.js';
import { MusicStore } from './store.js';

async function result(action: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try { const data = await action(); return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
  catch (error) { return { isError: true, content: [{ type: 'text', text: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join('；') : error instanceof Error ? error.message.slice(0, 1600) : '操作未完成。' }] }; }
}

export async function createServer(): Promise<McpServer> {
  const store = new MusicStore(process.env.YUUKI_MUSIC_DIR ?? join(homedir(), '.yuuki', 'music-space'));
  const preview = await startPreview(store, true);
  const view = (scene: MusicScene) => ({ scene, previewUrl: `${preview.origin}/?scene=${scene.sceneId}`, configPath: join(store.root, 'scenes', scene.sceneId, 'scene.json') });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const server = new McpServer({ name: 'yuuki-music-space', version: '1.0.0' });
  server.registerTool('import_music', {
    description: '导入本地 MIDI 或 WAV/MP3/FLAC/OGG/M4A，最长 180 秒、最多 16 轨。MIDI 保留准确音符、小节、速度与精确重复；音频只提取音量包络，不声称得到音符或声部。导入后保留素材副本。MIDI 试听使用简易合成器。',
    inputSchema: importInputSchema, outputSchema: assetSummarySchema, annotations: write,
  }, ({ path, title }, context) => result(async () => store.summary(await store.import(path, title, context.mcpReq.signal))));
  server.registerTool('create_score_scene', {
    description: '把 MIDI 折成三维声部之结：时间沿圆环前进，每条声部绕环交织，音高弯折路径、时值决定光段长度、力度决定宽度。保留休止、独听、精确重复与 MIDI 段落标记，保存 scene.json 并返回预览地址。',
    inputSchema: scoreInputSchema, outputSchema: sceneOutputSchema, annotations: write,
  }, ({ assetId, title }) => result(async () => view(await store.create(assetId, 'score', title === undefined ? {} : { title }))));
  server.registerTool('create_photo_scene', {
    description: '给音乐配置背景与最多四张独立透明图层，创建有真实分层视差的 2.5D 剧场。也可使用白近黑远的灰度深度图；layers 与 depthPath 二选一。支持时间、缩放、水平运镜和灯光关键帧；音量包络驱动灯束与曝光。',
    inputSchema: photoInputSchema, outputSchema: sceneOutputSchema, annotations: write,
  }, ({ assetId, imagePath, depthPath, title, layers }) => result(async () => view(await store.create(assetId, 'photo', {
    imagePath, ...(depthPath === undefined ? {} : { depthPath }), ...(title === undefined ? {} : { title }),
    ...(layers === undefined ? {} : { layers }),
  }))));
  server.registerTool('inspect_scene', {
    description: '读取场景配置、数据来源、轨道摘要及当前时间和发声音符数量。时间轴 playing 代表预览指令，浏览器仍需先允许声音，不能据此宣称人已听到。',
    inputSchema: referenceSchema, outputSchema: inspectOutputSchema, annotations: readOnly,
  }, ({ sceneId }) => result(async () => { const info = await store.inspect(sceneId); return { ...view(info.scene), ...info }; }));
  server.registerTool('update_scene', {
    description: '调整视角、织体半径、音符比例、配色、图层间距、运镜幅度及含 light 的场次关键帧。提交 inspect_scene 返回的 expectedRevision，避免旧界面覆盖新配置。保存后预览自动更新。',
    inputSchema: updateInputSchema, outputSchema: sceneOutputSchema,
    annotations: { ...write, destructiveHint: true },
  }, input => result(async () => view(await store.update(input))));
  server.registerTool('set_transport', {
    description: '按秒或 MIDI 小节定位、播放/暂停、设置独听声部。soloTrackIds=[] 恢复全部声部。声音在打开的本地预览内播放，需要使用者先点击一次播放/启用声音；MCP 不操作系统播放器。',
    inputSchema: transportInputSchema, outputSchema: sceneOutputSchema,
    annotations: { ...write, destructiveHint: true },
  }, input => result(async () => view(await store.transport(input))));
  server.registerTool('render_preview', {
    description: '用真实浏览器渲染指定时刻的 1280×720 PNG，保留场景快照。导出使用 WebGL2 后端以便确定性捕获；交互预览优先 WebGPU、不可用时回落 WebGL2。',
    inputSchema: previewInputSchema, outputSchema: previewOutputSchema, annotations: write,
  }, async ({ sceneId, time }, context) => {
    const response = await result(async () => renderPreview(store, sceneId, preview.origin, time ?? (await store.inspect(sceneId)).currentTime, context.mcpReq.signal));
    if (!response.isError) {
      const output = previewOutputSchema.parse(response.structuredContent);
      response.content.push({ type: 'image', mimeType: 'image/png', data: (await readFile(output.path)).toString('base64') });
    }
    return response;
  });
  server.registerTool('export_clip', {
    description: '逐帧渲染 0.5–20 秒片段，使用同一音乐时间轴合成 H.264/AAC MP4。独听选择作用于导出音频；保存场景快照和导出回执。需要本机 Chrome/Chromium 与 FFmpeg。',
    inputSchema: exportInputSchema, outputSchema: exportOutputSchema, annotations: write,
  }, (input, context) => result(() => exportClip(store, input.sceneId, preview.origin, input, context.mcpReq.signal)));
  server.registerTool('export_model', {
    description: '把指定时刻的声部之结保存为标准材质的 GLB 三维模型，可在 Blender 中继续编辑。只导出声部光带与顶点颜色，保留固定配置快照；不包含辉光、灯束与音频。曲面用于视觉设计，不承诺可直接打印。',
    inputSchema: previewInputSchema, outputSchema: modelOutputSchema, annotations: write,
  }, ({ sceneId, time }, context) => result(async () => exportModel(store, sceneId, preview.origin, time ?? (await store.inspect(sceneId)).currentTime, context.mcpReq.signal)));
  return server;
}
