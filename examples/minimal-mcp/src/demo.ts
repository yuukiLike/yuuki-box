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
      console.log(`[MCP] 连接已建立 | 协议版本：${client.getNegotiatedProtocolVersion()}`);
      const { tools } = await client.listTools();
      console.log(`[MCP] tools/list → ${tools.map((tool) => tool.name).join(', ')}`);
      const checkpoint: CheckpointInput = {
        project: values.invalid ? '../outside' : 'yuuki-box',
        context: '本次实验：发现工具、保存记录，并在服务进程重启后读取。',
        next: '我随便写一个',
        stopWhen: '能区分 MCP 的发现与调用，以及工具实现的文件持久化。',
      };
      console.log(`[MCP] tools/call → save_checkpoint | project=${checkpoint.project}`);
      const result = await callTool(client, 'save_checkpoint', checkpoint, saveCheckpointOutputSchema);
      console.log(`[结果] 保存成功 | saved=${result.saved}`);
      console.log(`[文件] ${result.path}`);
    });

    // 重启验证工具的文件持久化；发现工具已由前面的 tools/list 完成。
    console.log('[演示] 原服务进程已关闭；使用同一存储目录启动新进程。');
    await withClient(directory, async (client) => {
      console.log('[MCP] tools/call → resume | project=yuuki-box');
      const result = await callTool(client, 'resume', { project: 'yuuki-box' }, resumeOutputSchema);
      if (!result.found) throw new Error('重启后没有找到刚保存的记录。');
      // 检查 found 后，TS 知道这里必定有 note。
      console.log(`[结果] 读取成功 | found=${result.found}`);
      console.log(`[文件] ${result.path}`);
      console.log('\n--- resume 返回的 Markdown ---\n' + result.note + '--- Markdown 结束 ---');
      console.log('[验证] 新进程已从同一文件读回记录。');
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    console.log('[清理] 演示临时目录已删除。');
  }
}

main().catch((error: unknown) => {
  console.error('[失败]', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
