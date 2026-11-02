# 音乐 MCP 工作台

[MCP 案例](../../docs/mcp-projects/README.md)的音乐选修；[客户端实验](../../docs/ai-from-scaling/00-minimal-mcp.md)按需阅读。两个案例都围绕<mark class="key">可核对的工具调用</mark>：

1. **MIDI 钢琴排练台**：定位小节、独听声部、核对 88 键与音名，调整琴盖、练习提示和机位。
2. **演出舞台预演台**：读取对象，调整音箱、主屏和灯光，切换整体／近景／俯视，交付 PNG／MP4／GLB。

展示页对照真实参数、结构化结果与模型变化。素材、场景与导出保存在本机，独立于 music-eyes。

## 直接运行

需 Node.js ≥22.22、pnpm 11.14、Chrome/Chromium、FFmpeg。`check` 会启动 HTTP、浏览器与 FFmpeg。仓库根目录执行：

```bash
pnpm install:music-space-mcp
pnpm check:music-space-mcp
pnpm demo:music-space-mcp
pnpm demo:music-space-mcp:preview
```

打开 `preview` 地址、选场景、点“运行这一步”；固定参数不调用付费模型，“播放”启用声音。demo 截图保留任务完成态，交互场景恢复初始参数供比较。

`demo` 经真实 stdio MCP 创建三声部 MIDI、钢琴与舞台，保存实际调用截图、三机位 PNG、两个 GLB 和两段六秒 H.264/AAC 短片；清单在 `.artifacts/practical/demo.json`。演示和独立 preview 默认使用 `.artifacts/practical/`，普通客户端数据另存。

默认用 macOS Chrome；其他环境执行 `pnpm --dir examples/music-space-mcp exec playwright install chromium`，或以绝对路径 `YUUKI_MUSIC_CHROME_BIN` 指定浏览器。FFmpeg/ffprobe 从 PATH 查找，也可设 `FFMPEG_BIN`、`FFPROBE_BIN`。

## 教程

- [音乐 1：钢琴排练台](../../docs/ai-from-scaling/07-music-space-mcp.md)：`inspect_scene → set_transport → update_scene → render_preview`。
- [音乐 2：舞台预演台](../../docs/ai-from-scaling/08-music-photo-mcp.md)：`inspect_scene → update_scene → render_preview → export_model`。

页面的 HTTP 操作经官方 `Client`、`InMemoryTransport` 调用真实 MCP；外部宿主经 stdio，两者共用单个 `MusicStore`。页面执行真正的 `tools/list`，记录 `tools/call`、来源和结构化结果。最近 40 次调用写入 `tool-calls.json`，不存图片 base64；自然语言选工具由 AI 宿主承担。

## 接入 AI 客户端

```bash
pnpm build:music-space-mcp
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/music-space-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-music-space -- "$MCP_NODE" "$MCP_SERVER"
```

依据 [Claude Code stdio 配置](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。默认数据目录 `~/.yuuki/music-space`，可用绝对路径 `YUUKI_MUSIC_DIR` 改写。下载地址属于当前服务，退出后以同目录启动 preview 可恢复访问。<mark class="caution">同一目录只开一个可写服务</mark>，服务内可连多个客户端。

| 工具 | 输入与用途 |
| --- | --- |
| `import_music` | 导入本地 MIDI/音频，保存源副本、音符或包络 |
| `create_score_scene` | MIDI → 88 键钢琴 |
| `create_photo_scene` | 音乐、图片、可选透明图层/深度图 → 舞台 |
| `inspect_scene` | 版本、对象 ID、控制路径、声部、定位 |
| `update_scene` | 带 `expectedRevision` 修改部件、机位、配色、灯光 |
| `set_transport` | 秒/小节定位、播放、暂停、独听/恢复全部 |
| `render_preview` | 真实 PNG、下载地址、固定快照 |
| `export_clip` | 逐帧 MP4，音轨遵循独听选择 |
| `export_model` | 部件、材质、屏幕贴图的 GLB，可在 Blender 编辑 |

## 模型参数与展示

| 参数 | 作用 |
| --- | --- |
| `presentation.view` | `overview / detail / plan`：整体／近景／俯视 |
| `presentation.labels` | 部件标注 |
| `model.lidAngle` | 琴盖 0–65 度 |
| `model.showGuide` | 接下来四秒的音符提示 |
| `model.speakerSpread` | 音箱间距 3–9 |
| `model.screenHeight` | 主屏中心高度 2–5 |
| `cues` | 时间、标签、缩放、偏向、灯光关键帧 |

先用 `inspect_scene.objects` 找部件与控制路径；更新后页面读新版本。旧版本、越界值、错误小节或导出范围应拒绝，不覆盖新配置。

## 数据与图像的含义

- MIDI 保留音高、起点、时值、力度、速度与拍号；小节支持变速变拍号。精确重复只表示同轨音高、相对起点、时值完全一致，不自动识别曲式。
- 钢琴对应 MIDI 21–108；范围外音符仍播放但无琴键，不提供自动指法。试听为 22.05kHz 单声道基础谐波，不含采样、踏板、弯音或专业乐器仿真。
- 普通音频按 48kHz 立体声 PCM 播放/导出，另以 22.05kHz 单声道提取 50ms 包络，不虚构精确音符或声部。
- 实体部件由 Three.js 创建；屏幕素材与提示词见 [assets/README.md](assets/README.md)。最多四个有实际 alpha、与背景同宽高比的图层，深度 0.5–6；或使用方向、宽高比匹配的灰度深度图，两者互斥。缺省为明确标注的手工纵向深度。
- 布局为展示比例，未做制造尺寸、场地测量或声学仿真。GLB 含实体、名称、材质与贴图，不含音频、部件标注或辅助音符；制造/打印还需独立检查几何。

## 保存、分享与恢复

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
      scene.json                 # 导出固定配置
      preview.png、clip.mp4 或 scene-model.glb
      audio.wav、receipt.json    # 视频混音与回执
```

场景原子替换保存，浏览器可下载配置 JSON；JSON 不内嵌音乐、图像，跨机需一起复制素材和场景目录。导出按 `start + frame / fps` 渲染，同起点截音频，渲染速度不改变音乐时间。

## 范围与验证

单文件 ≤64 MiB，音乐 ≤180 秒，MIDI ≤16 轨、25,000 音符。图片 ≤16MP、宽高比 0.4–3。导出 0.5–20 秒、24/30fps、640/960/1280 宽；时长按帧量化，越界拒绝。

HTTP 只绑定 `127.0.0.1`，校验 Host 和写请求 Origin，只公开规范化素材/导出白名单，不提供任意文件服务或外部 CDN。宿主模型仍会收到 MCP 返回的摘要或预览。

测试覆盖类型与 Zod、时间/路径/透明层、恢复/版本冲突、stdio/内存 MCP 调用、琴键/机位/部件、真实浏览器声音、JSON 下载、内嵌贴图 GLB 和 H.264/AAC。具体通过结果以本次运行记录为准，不能用听感或截图代替。

交互优先 WebGPU、必要时回退 WebGL2；确定性捕获固定 WebGL2。已有本机检查覆盖 WebGL2，目标设备 WebGPU 性能与人的听感、画面舒适度另验。
