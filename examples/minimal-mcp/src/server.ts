import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import {
  resumeInputSchema,
  resumeOutputSchema,
  saveCheckpointInputSchema,
  saveCheckpointOutputSchema,
} from './contracts.js';

function toolResult(result: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
  };
}

export function createServer(): McpServer {
  const directory = process.env.YUUKI_CONTINUE_DIR ?? join(homedir(), '.yuuki', 'continue');
  if (!isAbsolute(directory)) throw new Error('YUUKI_CONTINUE_DIR 必须是绝对路径。');

  const server = new McpServer({ name: 'yuuki-continue', version: '1.0.0' });

  server.registerTool('save_checkpoint', {
    description: '为一个项目留下接续记录：停在哪里、下一步、到哪里就停。同项目只保留一份 Markdown，新记录会覆盖旧记录。',
    inputSchema: saveCheckpointInputSchema,
    outputSchema: saveCheckpointOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async ({ project, next, context, stopWhen }) => {
    const path = join(directory, `${project}.md`);
    const temporaryPath = join(directory, `.${project}-${randomUUID()}.tmp`);
    const note = [
      `# ${project}`,
      `记录于：${new Date().toISOString()}`,
      context && `## 停在哪里\n${context}`,
      `## 下一步\n${next}`,
      stopWhen && `## 到这里就停\n${stopWhen}`,
    ].filter(Boolean).join('\n\n') + '\n';

    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      // 同目录写临时文件后替换，避免读到只写了一半的记录。
      try {
        await writeFile(temporaryPath, note, { flag: 'wx', mode: 0o600 });
        await rename(temporaryPath, path);
      } finally {
        await rm(temporaryPath, { force: true });
      }
      return toolResult({ saved: true, project, path });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: `保存失败：${message}` }] };
    }
  });

  server.registerTool('resume', {
    description: '取回一个项目上次留下的 Markdown 原文。没有记录时明确返回 found: false；只读取，不修改项目或执行下一步。',
    inputSchema: resumeInputSchema,
    outputSchema: resumeOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ project }) => {
    const path = join(directory, `${project}.md`);
    try {
      const note = await readFile(path, 'utf8');
      if (Buffer.byteLength(note, 'utf8') > 16_384) throw new Error('记录超过 16 KiB，请先精简这份 Markdown。');
      return toolResult({ found: true, project, path, note });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return toolResult({ found: false, project });
      }
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: `读取失败：${message}` }] };
    }
  });
  return server;
}
