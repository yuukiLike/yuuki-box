# 音乐 MCP 工作台

本例属于[课程末章的选修实践](../../docs/ai-from-scaling/README.md#末章选修音乐-mcp)。两个案例都以可核对的 MCP 任务为目标：

1. **MIDI 钢琴排练台**：定位小节、独听声部，核对 88 键模型与音名；调整琴盖和机位，保存练习预览。
2. **演出舞台预演台**：读取对象清单，调整音箱间距、屏幕高度和灯光，切换总览、近景、俯视，交付 PNG、MP4 或 GLB。

展示页有真实工具调用记录，可对照请求参数、结构化结果和三维变化。独立于 music-eyes，数据与素材保存在本机。

## 运行

需要 Node.js ≥ 22.22、pnpm 11.14、Chrome/Chromium 和 FFmpeg。

```bash
pnpm --dir examples/music-space-mcp install --frozen-lockfile
pnpm --dir examples/music-space-mcp check
pnpm --dir examples/music-space-mcp demo
pnpm --dir examples/music-space-mcp preview
```

打开 `preview` 打印的本机地址，从右上角选择场景，先点击“运行这一步”。按钮使用固定参数完成练习，不调用付费模型；“播放”启用浏览器声音。展示截图记录任务完成态，交互场景最终恢复初始参数，方便亲手比较改动。

`demo` 通过真实 stdio MCP 创建三声部 MIDI、钢琴和舞台，保存带实际调用记录的展示页截图，生成近景/总览/俯视 PNG、两个 GLB 和两段六秒 H.264/AAC 短片。路径记录在 `.artifacts/practical/demo.json`。演示与独立 `preview` 默认使用 `.artifacts/practical/`，与普通客户端的数据目录分开。

默认使用安装的 macOS Chrome；其他环境可执行 `pnpm --dir examples/music-space-mcp exec playwright install chromium`，或通过绝对路径 `YUUKI_MUSIC_CHROME_BIN` 选择浏览器。FFmpeg 从 `PATH` 查找，可用 `FFMPEG_BIN` 指定；检查视频使用 `ffprobe`，可用 `FFPROBE_BIN` 指定。

## 学哪一次调用

- [音乐 1：用 MCP 控制钢琴排练台](../../docs/ai-from-scaling/07-music-space-mcp.md)：`inspect_scene → set_transport → update_scene → render_preview`。
- [音乐 2：用 MCP 调整舞台布局与机位](../../docs/ai-from-scaling/08-music-photo-mcp.md)：`inspect_scene → update_scene → render_preview → export_model`。

展示页把 HTTP 操作交给 Node 中的官方 `Client`，通过 `InMemoryTransport` 连接同一套 MCP 工具；外部宿主通过 stdio 接入。两条路径共用单个 `MusicStore` 的状态与版本检查。工具发现使用真正的 `tools/list`，页面下方显示实际 `tools/call` 的参数和结构化结果，并标明调用来源。

最近 40 次工具调用保存在 `tool-calls.json`，不保存图片 base64。自动任务使用固定参数；自然语言理解与自主选工具由接入的 AI 宿主承担。

## 接入 AI 客户端

```bash
pnpm --dir examples/music-space-mcp build
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/music-space-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-music-space -- "$MCP_NODE" "$MCP_SERVER"
```

命令依据 [Claude Code stdio MCP 配置](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。默认数据目录 `~/.yuuki/music-space`，可用绝对路径 `YUUKI_MUSIC_DIR` 改写。预览与下载地址属于当前服务；结束后用同一数据目录启动 `preview`，可以继续访问已有素材和导出。

| 工具 | 输入与用途 |
| --- | --- |
| `import_music` | 本地 MIDI/音频，保存源副本、音符或音量包络 |
| `create_score_scene` | 从 MIDI 创建 88 键钢琴排练台 |
| `create_photo_scene` | 从音乐、图片与可选透明图层/深度图创建舞台预演台 |
| `inspect_scene` | 返回版本、对象 ID、控制路径、轨道摘要与当前位置 |
| `update_scene` | 携带 `expectedRevision` 更新部件、机位、配色或灯光关键帧 |
| `set_transport` | 秒/小节定位、播放/暂停、独听或恢复全部声部 |
| `render_preview` | 返回真实渲染 PNG 的路径、下载地址及固定配置快照 |
| `export_clip` | 逐帧渲染 MP4，音轨跟随当前独听选择 |
| `export_model` | 导出独立部件和屏幕贴图的标准 GLB，供 Blender 继续编辑 |

## 模型参数与展示

| 参数 | 作用 |
| --- | --- |
| `presentation.view` | `overview` 整体、`detail` 操作近景、`plan` 俯视布局 |
| `presentation.labels` | 显示模型对象标注 |
| `model.lidAngle` | 琴盖角度，0–65 度 |
| `model.showGuide` | 显示接下来四秒的音符提示 |
| `model.speakerSpread` | 音箱间距，3–9 |
| `model.screenHeight` | 主屏中心高度，2–5 |
| `cues` | 时间、标签、缩放、水平偏向、灯光强度的关键帧 |

`inspect_scene.objects` 列出各部件 ID 和对应控制路径。更新保存后，打开的展示页会读取新版本。过期版本、越界参数、错误小节与导出范围明确拒绝，不覆盖已保存配置。一个数据目录由一个可写 MCP/预览服务管理；可连接多个客户端。

## 数据的含义

MIDI 保留音高、起点、时值、力度、拍号和速度。小节换算支持变速、变拍号；精确重复只表示同轨音高、相对起点和时值完全一致。钢琴模型对应 MIDI 21–108；范围外音符仍会播放，但没有对应琴键。画面提供音高参照，不自动给出演奏指法。

MIDI 试听是 22.05kHz 单声道基础谐波合成，没有使用乐器采样、踏板或弯音。普通音频保留 48kHz 立体声 PCM 播放/导出，另以 22.05kHz 单声道提取 50ms 音量包络；不从混音虚构精确音符或声部。

钢琴、舞台、音箱和灯架使用 Three.js 几何；屏幕素材来源与完整提示词见 [assets/README.md](assets/README.md)。可接收最多四个有实际 alpha 的透明图层，或与背景宽高比匹配的灰度深度图；两者互斥。未提供时使用明确标注的手工纵向深度。图片纵深作用于屏幕内容，实体部件由模型参数控制。

布局使用展示比例，适合检查位置、构图与工具操作，没有做制造尺寸、场地测量或声学仿真。GLB 保留实体几何、名称、材质与贴图，不包含音频、部件标注或辅助音符。

## 保存与导出

```text
<root>/
  tool-calls.json                 # 最近 40 次工具调用
  assets/<assetId>/
    source.mid 或原音频
    music.json、track-1.wav …
  scenes/<sceneId>/
    scene.json
    photo.png、depth.json、layer-N.png
    exports/<exportId>/
      scene.json                 # 导出的固定配置
      preview.png、clip.mp4 或 scene-model.glb
      audio.wav、receipt.json    # 视频混音与回执
```

场景以原子替换保存。浏览器下载的配置 JSON 不内嵌音乐或图像，跨机器恢复需要一起带上对应素材与场景目录。导出按 `start + frame / fps` 渲染，音频从同一起点截取；渲染速度不改变片段里的音乐时间。

## 范围与检查

单文件 ≤ 64 MiB，音乐 ≤ 180 秒，MIDI ≤ 16 轨、25,000 音符。图片 ≤ 16MP，宽高比 0.4–3。导出 0.5–20 秒、24/30fps、640/960/1280 宽。HTTP 绑定 127.0.0.1，校验 Host 与写请求 Origin，只公开规范化素材和导出文件白名单。

严格 TypeScript、Zod 与测试覆盖时间换算、路径和透明图层、状态恢复、版本冲突、真实 stdio 与内存 MCP 调用、对应琴键、机位和部件参数、浏览器声音、配置下载、内嵌贴图 GLB 与 H.264/AAC 导出。

交互渲染优先 WebGPU，必要时回退 WebGL2；确定性捕获固定使用 WebGL2。本机检查覆盖 WebGL2，没有测量目标设备的 WebGPU 性能；技术通过与人的听感、画面验收分别判断。
