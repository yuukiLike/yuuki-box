# 音乐 2：让音乐指挥一座光之剧场

本篇属于 [MCP 项目实战](../mcp-projects/README.md)的音乐选修，建议先读[声部之结](07-music-space-mcp.md)，熟悉共用服务与时间轴。

镜头先经过近处的暗红丝绸，再穿过黄铜拱门，远处是一座通向发光椭圆的剧场。音乐推进，灯束由冷转暖，悬浮光环展开；前景与舞台以不同速度滑过视线。

这个案例叫 **光之剧场 · Light Theatre**。它用三张独立图像和少量三维几何构成 2.5D 舞台。你可以换音乐、改段落灯光与运镜，再由 MCP 生成有声音的短片。

**今天只做一件事：暂停在第 5 秒，把图层间距从 0 调到 1.5，比较同一时刻的遮挡，再导出 4 秒。**

它与[声部之结](07-music-space-mcp.md)共用 TypeScript MCP、音乐时间轴、持久化、播放与逐帧导出；独立于 music-eyes。

![浏览器真实渲染的分层剧场](../../site/public/images/music-space-photo.png)

## 打开剧场

完成[示例 README](../../examples/music-space-mcp/README.md)中的安装后，在仓库根目录执行：

```bash
pnpm --dir examples/music-space-mcp demo
pnpm --dir examples/music-space-mcp preview
```

打开打印的本机地址，选择“光之剧场 · Light Theatre”。

1. 点击“播放”，观察前景与远景之间的相对移动。
2. 暂停到第 5 秒，把“图层间距”设为 0，再设为 1.5。
3. 点击不同场次，比较镜头方向与灯光；再调节“运镜幅度”。
4. 点击“导出当前位置 4 秒”，打开页面显示的本机 MP4 文件。

`demo` 还会生成两种场景各 6 秒的带声音短片，以及第 5/18 秒等不同段落的 PNG，路径记录在 `.artifacts/demo.json`。

**停点：指出哪一层离镜头最近，哪些变化来自音频，哪些来自关键帧，并能打开导出的短片。**

## 这次真正分开了什么

| 元素 | 构成与位置 |
| --- | --- |
| 剧场建筑、台阶与椭圆光口 | 完整背景，放在深处 |
| 黄铜与玻璃拱门 | 带透明通道的 PNG，中景深度 2.4 |
| 暗红丝绸 | 带透明通道的 PNG，前景深度 5 |
| 灯束、悬浮环、尘埃 | Three.js 几何，按时间与音乐包络更新 |

透明图层让中心真实露出背景。相机横向移动时，各层因深度不同产生相对位移；近处丝绸与中景拱门会遮住远处舞台的不同区域。`depthStrength` 控制前景、中景离背景的距离，`cameraTravel` 控制镜头运动。

每层会根据自身距离与画面宽高比缩放，留出运镜余量。它仍是有限视角的舞台布景，不能任意绕到建筑背面。

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

每个图层须有 alpha 通道，与背景保持相同宽高比；最多四层，素材会复制到本地场景目录。示例三张图由内置 imagegen 分别生成，完整提示词、透明背景设置见 [assets/README.md](../../examples/music-space-mcp/assets/README.md)。

也保留了另一条输入路径：背景加灰度 `depthPath`，白近黑远，细分网格按深度变形。没有图层或深度图时使用明确标注的纵向手工深度。`layers` 与 `depthPath` 不同时使用；这个剧场实际使用独立透明图层，没有运行自动深度模型。

## 把音乐和导演意图分开

普通音频经过 FFmpeg 处理：播放与导出使用 48kHz 立体声 PCM，音量分析另用 22.05kHz 单声道，每 50ms 提取包络。包络控制曝光、灯束强度和光环尺度；它没有准确音符、乐器或副歌信息。

场次关键帧保存显式的导演选择：

```ts
[
  { time: 0, label: 'Opening', zoom: 1, pan: -0.3, light: 0.2 },
  { time: 12, label: 'Interweave', zoom: 1.14, pan: 0.5, light: 1 },
  { time: 24, label: 'Afterglow', zoom: 1, pan: -0.2, light: 0.3 }
]
```

`pan` 决定水平运镜，`zoom` 决定构图，`light` 同时改变灯束强度与冷暖倾向。关键帧之间平滑插值，时间须唯一且处于音乐范围内。上述时间只是格式示例，先核对自己的音频时长。

本例音乐来自上一篇 MIDI 的完整混音，场次沿用源 MIDI 的人工段落标记。程序并没有从混音里自动识别这些段落。你也可以让宿主 AI 提议关键帧，再通过 `update_scene` 修改、渲染和比较。

TSL 节点材质把图片颜色、alpha、曝光与色调组合起来；Bloom 为亮部提供辉光。交互页面优先 WebGPU，必要时回退 WebGL2；离线捕获固定使用 WebGL2。本机验证覆盖 WebGL2，未测目标设备的 WebGPU 性能。

## 对 MCP 说什么

连接方式见[客户端配置](../../examples/music-space-mcp/README.md#接入-ai-客户端)。可以说：

> 用这份音乐、剧场背景和两张透明图层创建场景。暂停第 5 秒，分别用图层间距 0 和 1.5 渲染预览。让第 12 秒的灯光更暖、镜头朝右，再导出 4 秒。

调用路径：

```text
import_music → create_photo_scene → inspect_scene
→ update_scene → render_preview → export_clip
```

MCP 提供工具契约；宿主负责选择参数，Three.js 负责渲染，FFmpeg 合成视频。`update_scene` 携带最新版本号，避免旧配置覆盖新调整。

<details class="qa" id="为什么导出不用录屏">
<summary>为什么逐帧导出？</summary>

保存配置快照后，按 `start + frame / fps` 渲染，并从同一时间截音频。计算某帧较慢不会改变成片时间。

输出 H.264/AAC MP4，回执记录时长、帧数、版本与独听选择。限制 0.5–20 秒、24/30fps，不能超出音乐范围。跨机器恢复还需复制音乐与图片。[目录说明](../../examples/music-space-mcp/README.md#保存分享与恢复)

</details>

## 亲手验证

固定第 5 秒与运镜幅度，对比图层间距 0 和 1.5；再固定间距，把运镜幅度设为 0。观察遮挡发生在哪里，以及没有相机位移时还保留哪些灯光变化。

代码入口：[分层剧场](../../examples/music-space-mcp/web/theatre.ts)、[场景导入与保存](../../examples/music-space-mcp/src/store.ts)、[共享时间轴](../../examples/music-space-mcp/src/timeline.ts)、[逐帧导出](../../examples/music-space-mcp/src/render.ts)。

2026-10-25 的自动检查覆盖透明图层导入与拒绝、浏览器视差变化、真实音频播放、JSON 下载与 H.264/AAC 导出。画面、运镜与听感由你最终判断。

返回[音乐 1](07-music-space-mcp.md)或[MCP 项目实战](../mcp-projects/README.md)。
