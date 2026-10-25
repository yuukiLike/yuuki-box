import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import {
  assetSummarySchema, exportInputSchema, exportOutputSchema, importInputSchema, inspectOutputSchema, modelOutputSchema,
  photoInputSchema, previewInputSchema, previewOutputSchema, referenceSchema, sceneOutputSchema,
  scoreInputSchema, transportInputSchema, updateInputSchema, type MusicScene,
} from './contracts.js';
import { exportClip, exportModel, renderPreview } from './render.js';
import { MusicStore } from './store.js';

async function result(action: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try { const data = await action(); return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
  catch (error) { return { isError: true, content: [{ type: 'text', text: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join('；') : error instanceof Error ? error.message.slice(0, 1600) : '操作未完成。' }] }; }
}

export function createMusicServer(store: MusicStore, origin: () => string, source: 'stdio' | 'workbench') {
  const run = async (name: string, args: Record<string, unknown>, action: () => Promise<Record<string, unknown>>) => {
    const response = await result(action);
    await store.recordCall({ id: randomUUID(), at: new Date().toISOString(), source, name, arguments: args,
      result: response.structuredContent ? z.record(z.string(), z.unknown()).parse(response.structuredContent) : { message: response.content.filter(item => item.type === 'text').map(item => item.text).join('\n') }, error: !!response.isError });
    return response;
  };
  const view = (scene: MusicScene) => ({ scene, previewUrl: `${origin()}/?scene=${scene.sceneId}`, configPath: join(store.root, 'scenes', scene.sceneId, 'scene.json') });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const server = new McpServer({ name: 'yuuki-music-space', version: '1.0.0' });
  server.registerTool('import_music', {
    description: '导入本地 MIDI 或 WAV/MP3/FLAC/OGG/M4A，最长 180 秒、最多 16 轨。MIDI 保留准确音符、小节、速度与精确重复；音频只提取音量包络，不声称得到音符或声部。导入后保留素材副本。MIDI 试听使用简易合成器。',
    inputSchema: importInputSchema, outputSchema: assetSummarySchema, annotations: write,
  }, (input, context) => run('import_music', input, async () => store.summary(await store.import(input.path, input.title, context.mcpReq.signal))));
  server.registerTool('create_score_scene', {
    description: '从 MIDI 创建 88 键钢琴排练台。音符按实际 MIDI 音高压下对应琴键，保留声部独听、小节定位和四秒练习提示。通过 update_scene 调整琴盖、提示和整体/近景/俯视机位，返回本机展示地址。',
    inputSchema: scoreInputSchema, outputSchema: sceneOutputSchema, annotations: write,
  }, input => run('create_score_scene', input, async () => view(await store.create(input.assetId, 'score', input.title === undefined ? {} : { title: input.title }))));
  server.registerTool('create_photo_scene', {
    description: '创建可编辑的三维舞台预演台，包含主屏、左右音箱、阶梯与灯架。图片和可选透明 layers/灰度 depthPath 用于主屏内容。通过 update_scene 调整音箱间距、屏幕高度与展示机位，使用音量和 cues 控制灯光。',
    inputSchema: photoInputSchema, outputSchema: sceneOutputSchema, annotations: write,
  }, input => run('create_photo_scene', input, async () => view(await store.create(input.assetId, 'photo', { imagePath: input.imagePath, ...(input.depthPath === undefined ? {} : { depthPath: input.depthPath }), ...(input.title === undefined ? {} : { title: input.title }), ...(input.layers === undefined ? {} : { layers: input.layers }) }))));
  server.registerTool('inspect_scene', {
    description: '读取场景版本、三维对象 ID 及可调参数路径、声部摘要和当前时间。先 inspect_scene 再携带最新 expectedRevision 修改，便于对照参数与画面。playing 是播放指令，浏览器仍需启用声音。',
    inputSchema: referenceSchema, outputSchema: inspectOutputSchema, annotations: readOnly,
  }, input => run('inspect_scene', input, async () => { const info = await store.inspect(input.sceneId); return { ...view(info.scene), ...info }; }));
  server.registerTool('update_scene', {
    description: '携带 expectedRevision 更新场景。presentation.view=overview/detail/plan 切换总览/近景/俯视，labels 控制部件标注；model.lidAngle 调琴盖、showGuide 控制练习提示，speakerSpread 调左右音箱间距、screenHeight 调主屏高度。支持 camera、colors 与灯光 cues。',
    inputSchema: updateInputSchema, outputSchema: sceneOutputSchema,
    annotations: { ...write, destructiveHint: true },
  }, input => run('update_scene', input, async () => view(await store.update(input))));
  server.registerTool('set_transport', {
    description: '按秒或 MIDI 小节定位、播放/暂停、设置独听声部。soloTrackIds=[] 恢复全部声部。声音在打开的本地预览内播放，需要使用者先点击一次播放/启用声音；MCP 不操作系统播放器。',
    inputSchema: transportInputSchema, outputSchema: sceneOutputSchema,
    annotations: { ...write, destructiveHint: true },
  }, input => run('set_transport', input, async () => view(await store.transport(input))));
  server.registerTool('render_preview', {
    description: '用真实浏览器渲染指定时刻的 1280×720 PNG，保留场景快照。导出使用 WebGL2 后端以便确定性捕获；交互预览优先 WebGPU、不可用时回落 WebGL2。',
    inputSchema: previewInputSchema, outputSchema: previewOutputSchema, annotations: write,
  }, async (input, context) => {
    const { sceneId, time } = input;
    const response = await run('render_preview', input, async () => renderPreview(store, sceneId, origin(), time ?? (await store.inspect(sceneId)).currentTime, context.mcpReq.signal));
    if (!response.isError) {
      const output = previewOutputSchema.parse(response.structuredContent);
      response.content.push({ type: 'image', mimeType: 'image/png', data: (await readFile(output.path)).toString('base64') });
    }
    return response;
  });
  server.registerTool('export_clip', {
    description: '逐帧渲染 0.5–20 秒片段，使用同一音乐时间轴合成 H.264/AAC MP4。独听选择作用于导出音频；保存场景快照和导出回执。需要本机 Chrome/Chromium 与 FFmpeg。',
    inputSchema: exportInputSchema, outputSchema: exportOutputSchema, annotations: write,
  }, (input, context) => run('export_clip', input, () => exportClip(store, input.sceneId, origin(), input, context.mcpReq.signal)));
  server.registerTool('export_model', {
    description: '把当前钢琴或舞台保存为标准 GLB 模型，保留独立部件名、几何、姿态与屏幕贴图，可在 Blender 中继续编辑。返回保存路径和本机下载地址；不含音频、字幕与辅助提示。模型为展示比例，不做制造或声学尺寸保证。',
    inputSchema: previewInputSchema, outputSchema: modelOutputSchema, annotations: write,
  }, (input, context) => run('export_model', input, async () => exportModel(store, input.sceneId, origin(), input.time ?? (await store.inspect(input.sceneId)).currentTime, context.mcpReq.signal)));
  return server;
}
