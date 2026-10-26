import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const client = new Client({ name: 'weatherkit-live-check', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('./stdio.js', import.meta.url))],
  env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
});
try {
  await client.connect(transport);
  console.log('[MCP] tools/list → ' + (await client.listTools()).tools.map(tool => tool.name).join(', '));
  const name = process.argv[2];
  const result = await client.callTool(name
    ? { name: 'get_weather', arguments: { location: name, hours: 6, days: 3 } }
    : { name: 'list_locations', arguments: {} });
  if (result.isError) throw new Error(result.content.filter(item => item.type === 'text').map(item => item.text).join('\n'));
  console.log(JSON.stringify(result.structuredContent, null, 2));
  if (!name) console.log('[下一步] pnpm live 上海（替换成上面已配置的名称）。本次只列出地点，尚未访问 Apple。');
} catch (error) {
  console.error(error instanceof Error ? error.message : '真实接入检查失败。');
  process.exitCode = 1;
} finally {
  await client.close();
}
