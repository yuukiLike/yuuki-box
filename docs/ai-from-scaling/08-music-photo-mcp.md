# 音乐 2：用 MCP 调整舞台布局与机位

本篇属于课程末章的选修实践，排在[钢琴排练台](07-music-space-mcp.md)之后。

这次做一个明确的交付任务：**读取舞台对象，把左右音箱拉开，切到俯视图检查布局，再导出预演图与可编辑模型。**

主屏、音箱、阶梯、话筒和灯架均为三维部件。音乐与屏幕素材来自导入文件；灯光关键帧和机位是明确保存的设计参数。

![舞台预演台与实际 MCP 调用](../../site/public/images/music-space-photo.png)

## 先调整一次布局

完成[示例安装](../../examples/music-space-mcp/README.md)后，在仓库根目录执行：

```bash
pnpm --dir examples/music-space-mcp demo
pnpm --dir examples/music-space-mcp preview
```

打开打印的本机地址，选择“演出舞台预演台”。

1. 点击“运行这一步”，先用 `inspect_scene` 读取对象与版本，再用 `update_scene` 把音箱间距改成 8、机位改成 `plan`。
2. 对照俯视图里的左右音箱与间距线，检查下方调用记录的输入与结果。
3. 点击“整体展示”，看同一布局的三维形态，再点击“渲染当前预览”。

**停点：能把一个参数对应到实际部件的变化，并打开工具返回的 PNG。**

![舞台俯视与音箱间距线](../../site/public/images/music-space-stage-plan.png)

## 用对象清单找到参数

`inspect_scene` 的结果包括对象 ID 和控制路径：

| 对象 | 对应参数 |
| --- | --- |
| `stage.deck` | 舞台与阶梯；通过 `presentation.view` 选择机位 |
| `stage.screen` | `model.screenHeight`，主屏中心高度 |
| `stage.speakers` | `model.speakerSpread`，左右音箱间距 |
| `stage.lights` | `cues.light`、`photo.pulse`，段落与音量对灯光的影响 |

改动请求如下。先把 UUID 和版本替换为你刚读到的值：

```json
{
  "name": "update_scene",
  "arguments": {
    "sceneId": "当前场景的 UUID",
    "expectedRevision": 2,
    "model": { "speakerSpread": 8, "screenHeight": 4 },
    "presentation": { "view": "plan", "labels": true }
  }
}
```

比较三处信息：请求里的新值、返回的 `scene.model` 与 `revision`、模型里的设备位置。界面中的滑块也经过真正的 MCP 客户端调用，相同操作可以由外部 AI 宿主执行。

布局数值使用展示比例，适合检查相对位置与构图；没有做声学覆盖、结构承重或实际场地测量。

## 给主屏换内容，再给片段配灯光

`import_music` 接受 MIDI 或普通音频。`create_photo_scene` 是从图片建立舞台的入口：必需的 `imagePath` 成为主屏内容，可选 `layers` 是屏幕内的独立透明图层，也可改用灰度 `depthPath`；两种深度输入互斥。

示例保留三张有来源记录的屏幕素材，见 [assets/README.md](../../examples/music-space-mcp/assets/README.md)。舞台实体由代码创建，屏幕中的建筑图案来自图片。导出的 GLB 会内嵌屏幕贴图。

普通音频只提供音量包络，不自动生成精确音符或识别副歌。`cues` 保存显式关键帧：

```ts
[
  { time: 0, label: '开场', zoom: 1, pan: -0.3, light: 0.2 },
  { time: 12, label: '展开', zoom: 1.1, pan: 0.3, light: 1 },
  { time: 24, label: '收束', zoom: 1, pan: 0, light: 0.3 }
]
```

只有音频足够长时，这组时间才有效。关键帧时间须唯一且在素材时长内。灯光随 `light` 平滑改变冷暖与强度；音量包络参与灯光响应。示例音乐来自 MIDI 的完整混音，段落标记沿用源 MIDI 的人工安排。

## 交付预演图、短片与三维模型

- `render_preview`：保存当前机位和时刻的 PNG。
- `export_clip`：保存 0.5–20 秒 H.264/AAC 短片，使用同一音乐起点与逐帧时间。
- `export_model`：保存舞台 GLB，保留实体部件、当前布局与内嵌屏幕贴图，可交给 Blender 继续编辑。

返回值包含本机文件路径和当前服务的下载地址。场景状态用 `scene.json` 保存；重启后能继续读取，导出也有固定配置快照。服务进程结束后，可以用 `preview` 重新托管同一数据目录，本地文件继续保留。

## 沿一次调用读代码

```text
展示页 / AI 宿主 → MCP Client → tools/call
→ Zod 参数校验 → 场景版本与保存 → 模型更新 → 预览或导出
```

对照 [tools.ts](../../examples/music-space-mcp/src/tools.ts) 的 `update_scene`、[store.ts](../../examples/music-space-mcp/src/store.ts) 的更新与保存、[stage.ts](../../examples/music-space-mcp/web/stage.ts) 的部件位置，以及 [render.ts](../../examples/music-space-mcp/src/render.ts) 的导出。

回到同一任务再做一次：先读取版本，只改变屏幕高度，渲染并比较。能说明自己改了哪个输入、得到什么结果，就完成了这篇 MCP 练习。

返回[音乐 1](07-music-space-mcp.md)或[课程总览](README.md)。
