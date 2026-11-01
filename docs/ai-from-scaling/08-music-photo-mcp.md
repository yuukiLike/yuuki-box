# 音乐 2：让音乐指挥一座光之剧场

本篇属于 [MCP 项目实战](../mcp-projects/README.md)的音乐选修，建议先读[声部之结](07-music-space-mcp.md)，熟悉共用服务与时间轴。

镜头经过暗红丝绸、黄铜拱门与远处剧场；随音乐推进，灯光转暖、光环展开、远近景交错。

**光之剧场 · Light Theatre** 用三张图与少量三维几何组成 2.5D 舞台；换音乐、灯光与运镜，再通过 MCP 导出有声短片。

今天<mark class="key">固定第 5 秒，对比间距 0 与 1.5</mark>，再导出 4 秒。

它与[声部之结](07-music-space-mcp.md)共用 TypeScript MCP、音乐时间轴、持久化、播放与逐帧导出；独立于 music-eyes。

![浏览器真实渲染的分层剧场](../../site/public/images/music-space-photo.png)

## 打开剧场

完成[示例 README](../../examples/music-space-mcp/README.md)中的安装后，在仓库根目录执行：

```bash
pnpm demo:music-space-mcp
pnpm demo:music-space-mcp:preview
```

打开打印的本机地址，选择“光之剧场 · Light Theatre”。

1. 点击“播放”，观察前景与远景之间的相对移动。
2. 暂停到第 5 秒，把“图层间距”设为 0，再设为 1.5。
3. 点击不同场次，比较镜头方向与灯光；再调节“运镜幅度”。
4. 点击“导出当前位置 4 秒”，打开页面显示的本机 MP4 文件。

demo 另生成各 6 秒有声短片和第 5/18 秒等 PNG，路径在 `.artifacts/demo.json`。

**停点：** 找到最近图层，区分音频与关键帧驱动的变化，打开短片。

## 这次真正分开了什么

| 元素 | 构成与位置 |
| --- | --- |
| 剧场建筑、台阶与椭圆光口 | 完整背景，放在深处 |
| 黄铜与玻璃拱门 | 带透明通道的 PNG，中景深度 2.4 |
| 暗红丝绸 | 带透明通道的 PNG，前景深度 5 |
| 灯束、悬浮环、尘埃 | Three.js 几何，按时间与音乐包络更新 |

透明处露出背景，镜头横移使不同深度的图层产生视差与遮挡；`depthStrength` 控制间距，`cameraTravel` 控制运镜。

图层按距离与画幅缩放，留运镜余量；<mark class="caution">不能任意绕到建筑背面</mark>。

## MCP 接收怎样的素材

`create_photo_scene` 在背景之外，可以接收透明图层：

```ts
{
  assetId: '导入音乐后取得的 UUID',
  imagePath: '/absolute/path/theatre.png',
  layers: [
    { path: '/absolute/path/proscenium.png', depth: 2.4 },
    { path: '/absolute/path/silk.png', depth: 5 }
  ]
}
```

图层需 alpha、与背景同宽高比，最多四层，导入后复制到场景目录；示例三图分别由 imagegen 生成，提示词见 [assets/README.md](../../examples/music-space-mcp/assets/README.md)。

也支持灰度 `depthPath`：白近黑远；与 `layers` 互斥。都未提供时用手工纵向深度。本剧场用独立透明图层，未运行深度模型。

## 把音乐和导演意图分开

FFmpeg 输出 48kHz 立体声 PCM 供播放，另用 22.05kHz 单声道每 50ms 提取包络，控制曝光、灯束和光环；不提供准确音符、乐器或副歌。

场次关键帧保存显式的导演选择：

```ts
[
  { time: 0, label: 'Opening', zoom: 1, pan: -0.3, light: 0.2 },
  { time: 12, label: 'Interweave', zoom: 1.14, pan: 0.5, light: 1 },
  { time: 24, label: 'Afterglow', zoom: 1, pan: -0.2, light: 0.3 }
]
```

`pan` 控制水平运镜、`zoom` 控制构图、`light` 控制灯束和冷暖；时间须唯一且在音乐内，帧间平滑插值，示例时间需按音频调整。

音乐来自前篇 MIDI 混音，场次沿用人工标记，不是自动识别；也可让 AI 提议关键帧，再用 `update_scene` 对照。

TSL 组合颜色、alpha、曝光与色调，Bloom 添加辉光。交互优先 WebGPU、回退 WebGL2；离线用 WebGL2，仅验证了后者，未测 WebGPU 性能。

## 对 MCP 说什么

连接方式见[客户端配置](../../examples/music-space-mcp/README.md#接入-ai-客户端)。可以说：

> 用这份音乐、剧场背景和两张透明图层创建场景。暂停第 5 秒，分别用图层间距 0 和 1.5 渲染预览。让第 12 秒的灯光更暖、镜头朝右，再导出 4 秒。

调用路径：

```text
import_music → create_photo_scene → inspect_scene
→ update_scene → render_preview → export_clip
```

宿主选参数，MCP 传调用，Three.js 渲染，FFmpeg 合成；`update_scene` 须带最新版本号。

<details class="qa" id="为什么导出不用录屏">
<summary>为什么逐帧导出？</summary>

按快照的 `start + frame / fps` 渲染并截音频，计算慢不改变成片时长。

输出 H.264/AAC MP4，回执记录时长、帧数、版本与独听选择。限制 0.5–20 秒、24/30fps，不能超出音乐范围。跨机器恢复还需复制音乐与图片。[目录说明](../../examples/music-space-mcp/README.md#保存分享与恢复)

</details>

## 亲手验证

固定第 5 秒和运镜幅度，比间距 0/1.5；再固定间距、运镜设 0，区分遮挡与灯光变化。

代码入口：[分层剧场](../../examples/music-space-mcp/web/theatre.ts)、[场景导入与保存](../../examples/music-space-mcp/src/store.ts)、[共享时间轴](../../examples/music-space-mcp/src/timeline.ts)、[逐帧导出](../../examples/music-space-mcp/src/render.ts)。

2026-10-25 的自动检查覆盖透明图层导入与拒绝、浏览器视差变化、真实音频播放、JSON 下载与 H.264/AAC 导出。画面、运镜与听感由你最终判断。

返回[音乐 1](07-music-space-mcp.md)或[MCP 项目实战](../mcp-projects/README.md)。
