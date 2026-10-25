import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { callTool, withClient } from './client.js';
import { resumeOutputSchema, saveCheckpointOutputSchema, type CheckpointInput } from './contracts.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { invalid: { type: 'boolean', default: false } } });
  // 演示只写临时目录，不覆盖日常使用时留下的记录。
  const directory = await mkdtemp(join(tmpdir(), 'yuuki-continue-demo-'));
  try {
    await withClient(directory, async (client) => {
      console.log('协议版本：', client.getNegotiatedProtocolVersion());
      const { tools } = await client.listTools();
      console.log('发现工具：', tools.map((tool) => tool.name).join(', '));
      const checkpoint: CheckpointInput = {
        project: values.invalid ? '../outside' : 'yuuki-box',
        context: '已读完 MCP 开场，知道客户端会发现和调用工具。',
        next: '打开 src/server.ts，找到 save_checkpoint 真正写入文件的位置。',
        stopWhen: '能解释记录为什么在服务进程重启后仍然存在。',
      };
      const result = await callTool(client, 'save_checkpoint', checkpoint, saveCheckpointOutputSchema);
      console.log('留下记录：', result.saved);
    });

    console.log('关闭连接，再启动一个服务进程。');
    await withClient(directory, async (client) => {
      const result = await callTool(client, 'resume', { project: 'yuuki-box' }, resumeOutputSchema);
      if (!result.found) throw new Error('重启后没有找到刚保存的记录。');
      // 检查 found 后，TS 知道这里必定有 note。
      console.log('重启后取回：\n' + result.note);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
