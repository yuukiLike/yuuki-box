import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export async function withClient<T>(directory: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: 'yuuki-blender-client', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('./stdio.js', import.meta.url))],
    env: {
      YUUKI_BLENDER_DIR: directory,
      ...(process.env.BLENDER_BIN ? { BLENDER_BIN: process.env.BLENDER_BIN } : {}),
    },
  });
  try {
    await client.connect(transport);
    return await run(client);
  } finally {
    await client.close();
  }
}

export async function callTool<Schema extends z.ZodType>(
  client: Client, name: string, args: Record<string, unknown>, outputSchema: Schema,
): Promise<z.output<Schema>> {
  // 建模与渲染的允许时间比一次文本存取长，服务端另设 90 秒进程上限。
  const result = await client.callTool({ name, arguments: args }, { timeout: 100_000 });
  if (result.isError) {
    throw new Error(result.content.filter(item => item.type === 'text').map(item => item.text).join('\n'));
  }
  return outputSchema.parse(result.structuredContent);
}
