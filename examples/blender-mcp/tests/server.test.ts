import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { promisify } from 'node:util';
import { callTool, withClient } from '../src/client.js';
import { createdModelSchema, exportedModelSchema, inspectedModelSchema } from '../src/contracts.js';

const executeFile = promisify(execFile);
const tray = {
  name: 'practice-tray',
  parts: [
    { shape: 'box', size: [80, 50, 12], position: [0, 0, 6] },
    { shape: 'box', size: [74, 44, 12], position: [0, 0, 9], operation: 'subtract' },
  ],
};

async function fixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'yuuki-blender-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return join(root, 'models');
}

type Vector3 = [number, number, number];

// 直接解析导出文件，独立检查实际 STL 的尺寸、体积和每条边是否恰好共享两次。
function inspectStl(bytes: Buffer): { dimensions: Vector3; volume: number } {
  assert.ok(bytes.length >= 84);
  const count = bytes.readUInt32LE(80);
  assert.ok(count > 0);
  assert.equal(bytes.length, 84 + count * 50);
  const lower: Vector3 = [Infinity, Infinity, Infinity];
  const upper: Vector3 = [-Infinity, -Infinity, -Infinity];
  const edges = new Map<string, number>();
  const vertex = (offset: number): Vector3 => [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
  let volume = 0;
  for (let index = 0; index < count; index++) {
    const start = 84 + index * 50 + 12;
    const a = vertex(start), b = vertex(start + 12), c = vertex(start + 24);
    for (const point of [a, b, c]) {
      for (const axis of [0, 1, 2] as const) {
        assert.ok(Number.isFinite(point[axis]));
        lower[axis] = Math.min(lower[axis], point[axis]);
        upper[axis] = Math.max(upper[axis], point[axis]);
      }
    }
    for (const [from, to] of [[a, b], [b, c], [c, a]] as const) {
      const key = [from.map(value => value.toFixed(5)).join(','), to.map(value => value.toFixed(5)).join(',')].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  assert.ok([...edges.values()].every(count => count === 2), 'STL 应为闭合三角网格');
  return { dimensions: [upper[0] - lower[0], upper[1] - lower[1], upper[2] - lower[2]], volume: Math.abs(volume) };
}

test('真实 MCP 发现工具，拒绝错误尺寸、路径穿越和先减后加；不创建模型目录', async t => {
  const directory = await fixture(t);
  await withClient(directory, async client => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), ['create_model', 'inspect_model', 'export_stl']);
    for (const args of [
      { name: '../outside', parts: tray.parts },
      { name: 'empty', parts: [] },
      { name: 'negative', parts: [{ shape: 'box', size: [-1, 10, 10] }] },
      { name: 'subtract-first', parts: [{ shape: 'sphere', size: [10, 10, 10], operation: 'subtract' }] },
      { ...tray, python: 'print("no")' },
    ]) await assert.rejects(() => callTool(client, 'create_model', args, createdModelSchema));
    await assert.rejects(() => callTool(client, 'export_stl', { modelId: '../outside' }, exportedModelSchema));
  });
  assert.equal(existsSync(directory), false);
});

test('实际生成 Blender 模型和图片；STL 保留毫米尺寸与挖空体积；破损模型拒绝导出', { timeout: 180_000 }, async t => {
  const directory = await fixture(t);
  await withClient(directory, async client => {
    const raw = await client.callTool({ name: 'create_model', arguments: tray }, { timeout: 100_000 });
    assert.ok(!raw.isError, JSON.stringify(raw.content));
    const model = createdModelSchema.parse(raw.structuredContent);
    assert.deepEqual(model.info.dimensionsMm, [80, 50, 12]);
    assert.equal(model.info.minimumZMm, 0);
    assert.equal(model.info.closed, true);
    const blend = await readFile(model.blendPath);
    // Blender 5.2 默认使用 Zstandard 压缩；后面还会用 Blender 真正重新打开文件。
    assert.ok(blend.subarray(0, 4).toString('hex') === '28b52ffd' || blend.subarray(0, 7).toString() === 'BLENDER');
    const image = raw.content.find(item => item.type === 'image');
    assert.ok(image?.type === 'image');
    assert.equal(image.mimeType, 'image/png');
    assert.equal(Buffer.from(image.data, 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

    const inspected = await callTool(client, 'inspect_model', { modelId: model.modelId }, inspectedModelSchema);
    assert.deepEqual(inspected.info, model.info);
    const exported = await callTool(client, 'export_stl', { modelId: model.modelId }, exportedModelSchema);
    const stl = await readFile(exported.stlPath);
    assert.equal(exported.bytes, stl.length);
    const measured = inspectStl(stl);
    assert.deepEqual(measured.dimensions, [80, 50, 12]);
    assert.ok(Math.abs(measured.volume - (80 * 50 * 12 - 74 * 44 * 9)) < 0.01);

    // 模拟人在 Blender 里编辑后留下一个破洞；下一次导出必须重新检查文件。
    const script = join(directory, 'remove-face.py');
    await writeFile(script, [
      'import bpy, bmesh, sys',
      'bpy.ops.wm.open_mainfile(filepath=sys.argv[-1], load_ui=False, use_scripts=False)',
      'model = bpy.data.objects["MCP_Model"]',
      'mesh = bmesh.new()',
      'mesh.from_mesh(model.data)',
      'mesh.faces.ensure_lookup_table()',
      'bmesh.ops.delete(mesh, geom=[mesh.faces[0]], context="FACES")',
      'mesh.to_mesh(model.data)',
      'mesh.free()',
      'bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1], check_existing=False)',
    ].join('\n'));
    const macBlender = '/Applications/Blender.app/Contents/MacOS/Blender';
    const binary = process.env.BLENDER_BIN ?? (existsSync(macBlender) ? macBlender : 'blender');
    await executeFile(binary, ['--background', '--factory-startup', '--disable-autoexec', '--threads', '2', '--python-exit-code', '1', '--python', script, '--', model.blendPath], { timeout: 90_000 });
    const broken = await callTool(client, 'inspect_model', { modelId: model.modelId }, inspectedModelSchema);
    assert.equal(broken.info.closed, false);
    await assert.rejects(() => callTool(client, 'export_stl', { modelId: model.modelId }, exportedModelSchema), /闭合检查/);
    assert.deepEqual(await readFile(exported.stlPath), stl);
  });
});

test('圆柱与球体支持旋转和合并，完整尺寸按局部轴解释', { timeout: 100_000 }, async t => {
  const directory = await fixture(t);
  await withClient(directory, async client => {
    const model = await callTool(client, 'create_model', {
      name: 'round-knob',
      parts: [
        { shape: 'cylinder', size: [20, 10, 6], rotation: [90, 0, 0] },
        { shape: 'sphere', size: [8, 8, 8], position: [0, 0, 5] },
      ],
    }, createdModelSchema);
    assert.deepEqual(model.info.dimensionsMm, [20, 8, 14]);
    assert.equal(model.info.minimumZMm, 0);
    assert.equal(model.info.closed, true);
  });
});

test('不存在的模型报告错误；无几何的创建失败后清理新目录', { timeout: 100_000 }, async t => {
  const directory = await fixture(t);
  await withClient(directory, async client => {
    await assert.rejects(() => callTool(client, 'inspect_model', { modelId: 'missing-00000000-0000-0000-0000-000000000000' }, inspectedModelSchema), /没有找到/);
    await assert.rejects(() => callTool(client, 'create_model', {
      name: 'removed',
      parts: [
        { shape: 'box', size: [10, 10, 10] },
        { shape: 'box', size: [20, 20, 20], operation: 'subtract' },
      ],
    }, createdModelSchema));
  });
  assert.deepEqual(await readdir(directory), []);
});
