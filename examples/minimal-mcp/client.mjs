import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

async function main() {
  const { values } = parseArgs({ options: { invalid: { type: 'boolean', default: false } } });
  const client = new Client(
    { name: 'yuuki-budget-client', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('./server.mjs', import.meta.url))],
  });

  try {
    await client.connect(transport);
    console.log('协议版本：', client.getNegotiatedProtocolVersion());
    const { tools } = await client.listTools();
    console.log('发现工具：', tools.map((tool) => tool.name).join(', '));
    const result = await client.callTool({
      name: 'calculate_total',
      arguments: { people: values.invalid ? -1 : 20, perPerson: 35, venue: 80, budget: 800 },
    });
    if (result.isError) {
      throw new Error(result.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n'));
    }
    console.log('计算结果：', JSON.stringify(result.structuredContent));
  } finally {
    await client.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
