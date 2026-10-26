import { fileURLToPath } from 'node:url';
import { callTool, withClient } from './client.js';
import { createdModelSchema, exportedModelSchema, inspectedModelSchema } from './contracts.js';

async function main(): Promise<void> {
  const directory = fileURLToPath(new URL('../../.artifacts/', import.meta.url));
  await withClient(directory, async client => {
    console.log('[演示] 参数与调用顺序来自 demo.ts；不调用语言模型。');
    console.log(`[MCP] 连接已建立 | 协议版本：${client.getNegotiatedProtocolVersion()}`);
    const { tools } = await client.listTools();
    console.log(`[MCP] tools/list → ${tools.map(tool => tool.name).join(', ')}`);
    console.log('[MCP] tools/call → create_model | name=practice-tray');
    const model = await callTool(client, 'create_model', {
      name: 'practice-tray',
      parts: [
        { shape: 'box', size: [80, 50, 12], position: [0, 0, 6] },
        { shape: 'box', size: [74, 44, 12], position: [0, 0, 9], operation: 'subtract' },
      ],
    }, createdModelSchema);
    console.log(`[结果] create_model 完成 | modelId=${model.modelId}`);
    console.log(`[文件] Blender：${model.blendPath}`);
    console.log(`[文件] 预览：${model.previewPath}`);

    console.log(`[MCP] tools/call → inspect_model | modelId=${model.modelId}`);
    const inspected = await callTool(client, 'inspect_model', { modelId: model.modelId }, inspectedModelSchema);
    console.log(`[结果] inspect_model 完成 | dimensionsMm=${inspected.info.dimensionsMm.join(' × ')} | closed=${inspected.info.closed}`);

    console.log(`[MCP] tools/call → export_stl | modelId=${model.modelId}`);
    const exported = await callTool(client, 'export_stl', { modelId: model.modelId }, exportedModelSchema);
    console.log(`[结果] export_stl 完成 | bytes=${exported.bytes}`);
    console.log(`[文件] STL：${exported.stlPath}`);
    console.log('[下一步] 在切片软件中按毫米检查尺寸、壁厚、支撑与打印参数。');
  });
}

main().catch((error: unknown) => {
  console.error('[失败]', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
