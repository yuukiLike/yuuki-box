import { fileURLToPath } from 'node:url';
import { callTool, withClient } from './client.js';
import { createdModelSchema, exportedModelSchema, inspectedModelSchema } from './contracts.js';

async function main(): Promise<void> {
  const directory = fileURLToPath(new URL('../../.artifacts/', import.meta.url));
  await withClient(directory, async client => {
    const { tools } = await client.listTools();
    console.log('发现工具：', tools.map(tool => tool.name).join(', '));
    const model = await callTool(client, 'create_model', {
      name: 'practice-tray',
      parts: [
        { shape: 'box', size: [80, 50, 12], position: [0, 0, 6] },
        { shape: 'box', size: [74, 44, 12], position: [0, 0, 9], operation: 'subtract' },
      ],
    }, createdModelSchema);
    console.log('Blender 文件：', model.blendPath);
    console.log('预览图：', model.previewPath);

    const inspected = await callTool(client, 'inspect_model', { modelId: model.modelId }, inspectedModelSchema);
    console.log('尺寸（mm）：', inspected.info.dimensionsMm.join(' × '));
    console.log('网格闭合：', inspected.info.closed);

    const exported = await callTool(client, 'export_stl', { modelId: model.modelId }, exportedModelSchema);
    console.log('STL 文件：', exported.stlPath);
    console.log('下一步：在切片软件中按毫米检查尺寸、壁厚、支撑与打印参数。');
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
