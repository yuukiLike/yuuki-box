# Blender MCP：让参数变成模型

用 MCP 把尺寸参数变成可编辑、可检查、可导出的 Blender 模型。

实验做 **80 × 50 × 12 mm** 托盘，底和四周各 3 mm：创建 → 检查 → 导出，再改尺寸、找建模代码。

<mark class="key">MCP 传调用，Blender 创建几何</mark>。客户端把 `modelId` 传给后续工具，定位同一文件；`demo.ts` 固定参数和顺序，不调用 AI 设计。

按「运行 → 看剖面 → 改尺寸 → 对照」完成；初次接入看[Codex MCP 入门](00-codex-mcp.md)。需 Blender、Node.js ≥22.22、pnpm 11.14；已有记录用 Blender 5.2.3 LTS，其他版本与打印另验。

<div class="heading-alias" id="先看三个工具怎样接力" aria-hidden="true"></div>

## 三个工具的调用流程

[![Blender 建模流程：输入形状，create_model 生成文件与 modelId，inspect_model 重新检查文件，export_stl 检查后导出；学习者运行、改尺寸并核对产物](../../site/public/diagrams/ai-from-scaling/05-blender-pipeline.svg)](../../site/public/diagrams/ai-from-scaling/05-blender-pipeline.svg)

## 1. 运行：找到真正生成的文件

在仓库根目录执行：

```bash
pnpm install:blender-mcp
pnpm demo:blender-mcp
```

预期输出省略连接日志，以 `<modelId>` 和 `<模型目录>` 代替本次生成的值：

```text
[MCP] tools/list → create_model, inspect_model, export_stl
[MCP] tools/call → create_model | name=practice-tray
[结果] create_model 完成 | modelId=<modelId>
[文件] Blender：<模型目录>/model.blend
[文件] 预览：<模型目录>/preview.png
[MCP] tools/call → inspect_model | modelId=<modelId>
[结果] inspect_model 完成 | dimensionsMm=80 × 50 × 12 | closed=true
[MCP] tools/call → export_stl | modelId=<modelId>
[结果] export_stl 完成 | bytes=<文件字节数>
[文件] STL：<模型目录>/model.stl
```

`tools/list` 只列工具，`tools/call` 才执行；`closed=true` 是网格检查结果，<mark class="caution">不能代替切片或打印验收</mark>。

打开本次 `preview.png` 和 `model.blend`；产物在 `examples/blender-mcp/.artifacts/`，每次目录与 `modelId` 不同。

下图为此前预览；本次以终端文件为准。

![此前生成的 80 × 50 × 12 mm 托盘](../../site/public/images/blender-mcp-practice-tray.png)

**验收：** 找到本次 `.blend`、PNG、STL，核对终端尺寸。

## 2. 看图：3 mm 的底和侧壁从哪里来

打开 [demo.ts](../../examples/blender-mcp/src/demo.ts)，找到 `parts` 中的两个长方体。`size` 是 XYZ 尺寸，`position` 是中心位置，单位都是毫米。

```ts
parts: [
  { shape: 'box', size: [80, 50, 12], position: [0, 0, 6] },
  { shape: 'box', size: [74, 44, 12], position: [0, 0, 9], operation: 'subtract' },
],
```

[![托盘的俯视与剖面：侧壁厚度是外尺寸与挖空尺寸之差的一半；实体从 Z=0 到 12，挖空盒子从 Z=3 到 15，因此留下 3 mm 底](../../site/public/diagrams/ai-from-scaling/05-blender-geometry.svg)](../../site/public/diagrams/ai-from-scaling/05-blender-geometry.svg)

几何计算：

- 左右侧壁：`(80 - 74) / 2 = 3 mm`。
- 前后侧壁：`(50 - 44) / 2 = 3 mm`。
- 底厚：大盒子底部在 `6 - 12 / 2 = 0`，挖空盒子底部在 `9 - 12 / 2 = 3`，所以留下 3 mm。

挖空顶部 Z=15 超过实体 Z=12，形成开口；材料表面仍围成闭合实体。

**验收：** 说明两个 `position` 的 Z 值为何分别为 6 和 9。

## 3. 修改：把托盘加宽，保留 3 mm 侧壁

在 `demo.ts` 中把外盒宽度从 80 改成 100，同时把挖空宽度从 74 改成 94：

```ts
parts: [
  { shape: 'box', size: [100, 50, 12], position: [0, 0, 6] },
  { shape: 'box', size: [94, 44, 12], position: [0, 0, 9], operation: 'subtract' },
],
```

重跑 `pnpm demo:blender-mcp`；预期 `100 × 50 × 12`、闭合 `true`，打开新路径与前次对照。

**先预测：** 只改外盒，侧壁为 `(100 - 74) / 2 = 13 mm`；两处一起改才保持 3 mm。

**验收：** 新模型宽度符合修改值，侧壁与底厚仍可由参数解释。

## 4. 定位：哪个程序真正创建了几何

按一次创建请求的方向，找三个位置：

1. [server.ts](../../examples/blender-mcp/src/server.ts)：`registerTool('create_model', ...)` 接收并处理工具调用。
2. [blender.ts](../../examples/blender-mcp/src/blender.ts)：`runBlender()` 用 `execFile()` 启动后台 Blender，通过 JSON 文件交付参数。
3. [worker.py](../../examples/blender-mcp/worker.py)：`create_model()` 用 `bpy` 创建实体，并用 `DIFFERENCE` 做减法。

`inspect_model` 和 `export_stl` 会重新打开 `model.blend`；在 `demo.ts` 找 `{ modelId: model.modelId }`：客户端传回编号，服务端用 `join(root, modelId)` 找目录，Blender 读文件。

`modelId` 是业务编号，不是 JSON-RPC 请求 `id`；跨进程处理依赖编号和文件，文件删除就失败。MCP 不保存场景或自动选择上一个模型。

**验收：** 定位 TS 调用、Python 建模及 `modelId` 关联代码。

<div class="heading-alias" id="到这里完成" aria-hidden="true"></div>

## 验收标准

用新模型说明 MCP 调用、尺寸计算和 `modelId` 定位；`.blend` 用于编辑、PNG 预览、STL 切片。

## 选读与参考

<details>
<summary>支持的形状、输出文件与导出失败</summary>

支持 `box`、`cylinder`、`sphere`，含 XYZ 尺寸、中心、旋转和 `add` / `subtract`；毫米制、角度制，最多 16 项，首项须 `add`，整体移到 Z=0。

`create_model` 保存 `design.json`、`model.blend`、`preview.png`；`export_stl` 增加或替换同目录的 `model.stl`。`inspect_model` 返回尺寸、体积、面数和闭合检查结果。

手动编辑须保留 `MCP_Model`，仅导出该对象；检查失败保留旧 STL，因此应看本次错误与 `.blend`，不能拿旧文件证明成功。

</details>

<details>
<summary>输入校验、进程限制与自动检查</summary>

[contracts.ts](../../examples/blender-mcp/src/contracts.ts) 用 Zod 声明输入、输出并推导 TS 类型。[client.ts](../../examples/blender-mcp/src/client.ts) 检查工具错误与返回值。[stdio.ts](../../examples/blender-mcp/src/stdio.ts) 是协议启动入口。严格 TS 配置沿用第一个示例。

调用只提交形状数据；Blender 后台限时 90 秒，客户端等待 100 秒，取消传给子进程；创建失败清理新目录并报错。

```bash
pnpm check:blender-mcp
```

需本机 Blender；检查含类型、编译和真实建模测试，核对 STL 尺寸、闭合边、挖空体积，并破坏一个面验证拒绝导出。

</details>

<details>
<summary>接入日常客户端</summary>

日常生成的模型默认保存到 `~/.yuuki/blender/`。设置 `YUUKI_BLENDER_DIR` 为其他绝对路径，可以改变输出位置。`BLENDER_BIN` 可以指定可执行文件；未指定时优先使用 macOS 的 `/Applications/Blender.app/Contents/MacOS/Blender`，该路径不存在时使用 PATH 中的 `blender`。

如果已安装 Claude Code，在仓库根目录执行：

```bash
pnpm build:blender-mcp
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/blender-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-blender -- "$MCP_NODE" "$MCP_SERVER"
claude mcp get yuuki-blender
```

保留完整示例目录和 `worker.py`；连接后在 `/mcp` 查工具，再说：

```text
用 yuuki-blender 做一个 80×50×12 毫米的桌面托盘，底和四周各留 3 毫米。
先创建并展示预览，再检查网格；闭合检查通过后导出 STL。
```

注册方式见 [Claude Code 官方文档](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)；仓库仅验证示例客户端，实际接入另查。

</details>

<details>
<summary>从 STL 到实物：切片与打印另行验证</summary>

STL 无单位，本例按毫米解释；闭合检查仅查非流形边、零面积面和非零体积。切片时核对外尺寸、壁厚、悬空、支撑与材料，再做实际打印验收。

示例只生成文件，实际打印需要另行操作与验证。

接口资料：[Blender Python API](https://docs.blender.org/api/5.2/info_overview.html) · [布尔运算](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/booleans.html) · [STL 导出源码中的单位处理](https://github.com/blender/blender/blob/main/source/blender/io/stl/exporter/stl_export.cc)。

</details>

返回[MCP 案例](../mcp-projects/README.md) · [最简 demo 与客户端选读](00-minimal-mcp.md) · 选做[GitHub 修复实验](06-github-lab-mcp.md)。
