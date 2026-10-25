import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export async function withClient<T>(directory: string, action: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: 'yuuki-music-space-client', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./stdio.js', import.meta.url))],
    env: { YUUKI_MUSIC_DIR: directory,
      ...(process.env.FFMPEG_BIN ? { FFMPEG_BIN: process.env.FFMPEG_BIN } : {}),
      ...(process.env.YUUKI_MUSIC_CHROME_BIN ? { YUUKI_MUSIC_CHROME_BIN: process.env.YUUKI_MUSIC_CHROME_BIN } : {}) } });
  try { await client.connect(transport); return await action(client); }
  finally { await client.close(); }
}
export async function callTool<Schema extends z.ZodType>(client: Client, name: string, args: Record<string, unknown>, schema: Schema): Promise<z.output<Schema>> {
  const result = await client.callTool({ name, arguments: args }, { timeout: 240_000 });
  if (result.isError) throw new Error(result.content.filter(item => item.type === 'text').map(item => item.text).join('\n'));
  return schema.parse(result.structuredContent);
}
