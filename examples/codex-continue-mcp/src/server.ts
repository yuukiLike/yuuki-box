import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { UsageStore, UsageTransport, usageStatsSchema } from './usage.js';

const directory = process.env.YUUKI_CONTINUE_DIR ?? join(homedir(), '.yuuki', 'continue');
if (!isAbsolute(directory)) throw new Error('YUUKI_CONTINUE_DIR 必须是绝对路径。');
const usage = new UsageStore(directory);

const projectSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, '项目名须为 1–64 个小写字母、数字或连字符，且以字母或数字开头。')
  .describe('项目标识，例如 yuuki-box、algorithm-box、violin。');

function createServer(): McpServer {
  const server = new McpServer({ name: 'yuuki-continue', version: '1.0.0' });

  // Codex 会发现工具描述和参数规则，再根据用户的话发起调用。
  server.registerTool('save_checkpoint', {
    description: '为项目保存接续记录：停在哪里、下一步、到哪里就停。同项目只保留一份 Markdown，保存会替换旧记录。',
    inputSchema: z.strictObject({
      project: projectSchema,
      next: z.string().trim().min(1).max(500).describe('下次先做的一件具体小事。'),
      context: z.string().trim().min(1).max(1000).optional().describe('可选：已经确认的进度、问题或文件位置。'),
      stopWhen: z.string().trim().min(1).max(300).optional().describe('可选：做到什么程度就可以停。'),
    }),
    outputSchema: z.strictObject({
      saved: z.literal(true),
      project: projectSchema,
      path: z.string(),
    }),
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
      // 同目录临时文件写完后再替换，避免读到半份记录。
      try {
        await writeFile(temporaryPath, note, { flag: 'wx', mode: 0o600 });
        await rename(temporaryPath, path);
      } finally {
        await rm(temporaryPath, { force: true });
      }
      return {
        content: [{ type: 'text', text: `已保存 ${project} 的接续记录：${path}` }],
        structuredContent: { saved: true, project, path },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: `保存失败：${message}` }] };
    }
  });

  server.registerTool('resume', {
    description: '取回项目上次保存的 Markdown 原文。没有记录时明确返回未找到；只读取，不执行记录里的下一步。',
    inputSchema: z.strictObject({ project: projectSchema }),
    outputSchema: z.discriminatedUnion('found', [
      z.strictObject({ found: z.literal(false), project: projectSchema }),
      z.strictObject({ found: z.literal(true), project: projectSchema, path: z.string(), note: z.string() }),
    ]),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ project }) => {
    const path = join(directory, `${project}.md`);
    try {
      const note = await readFile(path, 'utf8');
      if (Buffer.byteLength(note, 'utf8') > 16_384) throw new Error('记录超过 16 KiB，请先精简这份 Markdown。');
      return {
        content: [{ type: 'text', text: note }],
        structuredContent: { found: true, project, path, note },
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return {
          content: [{ type: 'text', text: `没有找到 ${project} 的接续记录。` }],
          structuredContent: { found: false, project },
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: `读取失败：${message}` }] };
    }
  });

  server.registerTool('get_usage_stats', {
    description: '查看接着做 MCP 自启用统计以来的连接次数、已完成工具调用次数、成功/失败和耗时，按工具与 Host 声明的软件名称/版本汇总。连接次数不是独立用户或设备数；查看统计本身不计入工具调用次数。',
    inputSchema: z.strictObject({}),
    outputSchema: usageStatsSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    try {
      const stats = usage.read();
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }], structuredContent: stats };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: `读取使用统计失败：${message}` }] };
    }
  });
  return server;
}

// Codex 启动这个入口。SDK 处理 JSON-RPC；stdout 只传协议，日志走 stderr。
serveStdio(createServer, {
  transport: new UsageTransport(usage),
  onerror: (error) => console.error(error.message),
});
