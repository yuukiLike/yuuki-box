import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { runBlender } from './blender.js';
import {
  createdModelSchema, exportedModelSchema, inspectedModelSchema,
  modelInputSchema, modelReferenceSchema,
} from './contracts.js';

function toolResult(result: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
}

function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text', text: message.slice(0, 2000) }] };
}

export function createServer(): McpServer {
  const root = process.env.YUUKI_BLENDER_DIR ?? join(homedir(), '.yuuki', 'blender');
  if (!isAbsolute(root)) throw new Error('YUUKI_BLENDER_DIR 必须是绝对路径。');
  const server = new McpServer({ name: 'yuuki-blender', version: '1.0.0' });

  server.registerTool('create_model', {
    description: '用毫米尺寸的长方体、圆柱和球体，依次合并或挖空，创建一个独立 Blender 模型与预览图。结果自动放到 Z=0，每次生成新 modelId。',
    inputSchema: modelInputSchema,
    outputSchema: createdModelSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (design, context) => {
    const modelId = `${design.name}-${randomUUID()}`;
    const directory = join(root, modelId);
    let created = false;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      await mkdir(directory, { mode: 0o700 });
      created = true;
      await writeFile(join(directory, 'design.json'), JSON.stringify(design, null, 2) + '\n', { mode: 0o600 });
      const info = await runBlender({ action: 'create', directory, design }, context.mcpReq.signal);
      const result = toolResult({ modelId, blendPath: join(directory, 'model.blend'), previewPath: join(directory, 'preview.png'), info });
      const preview = await readFile(join(directory, 'preview.png'));
      result.content.push({ type: 'image', mimeType: 'image/png', data: preview.toString('base64') });
      return result;
    } catch (error) {
      if (created) await rm(directory, { recursive: true, force: true });
      return toolError(error);
    }
  });

  server.registerTool('inspect_model', {
    description: '重新读取已保存的 model.blend，报告毫米尺寸、体积、三角形数量和闭合检查。检查只覆盖网格几何，不代表已完成切片或实物打印。',
    inputSchema: modelReferenceSchema,
    outputSchema: inspectedModelSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ modelId }, context) => {
    try {
      const info = await runBlender({ action: 'inspect', directory: join(root, modelId) }, context.mcpReq.signal);
      return toolResult({ modelId, info });
    } catch (error) {
      return toolError(error);
    }
  });

  server.registerTool('export_stl', {
    description: '通过闭合网格检查后导出二进制 STL；数值以毫米解释。重复导出替换该模型目录中的 model.stl。文件交给切片软件后再检查壁厚、支撑和打印参数。',
    inputSchema: modelReferenceSchema,
    outputSchema: exportedModelSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ modelId }, context) => {
    try {
      const directory = join(root, modelId);
      const info = await runBlender({ action: 'export', directory }, context.mcpReq.signal);
      const stlPath = join(directory, 'model.stl');
      return toolResult({ modelId, stlPath, bytes: (await stat(stlPath)).size, info });
    } catch (error) {
      return toolError(error);
    }
  });
  return server;
}
