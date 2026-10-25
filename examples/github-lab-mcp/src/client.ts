import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export async function withClient<T>(directory: string, run: (client: Client) => Promise<T>, environment: Record<string, string> = {}): Promise<T> {
  const client = new Client({ name: 'yuuki-github-lab-client', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('./stdio.js', import.meta.url))],
    env: { YUUKI_GITHUB_LAB_DIR: directory, ...environment },
  });
  try { await client.connect(transport); return await run(client); }
  finally { await client.close(); }
}

export async function callTool<Schema extends z.ZodType>(client: Client, name: string, args: Record<string, unknown>, schema: Schema): Promise<z.output<Schema>> {
  const result = await client.callTool({ name, arguments: args }, { timeout: 180_000 });
  if (result.isError) throw new Error(result.content.filter(item => item.type === 'text').map(item => item.text).join('\n'));
  return schema.parse(result.structuredContent);
}
