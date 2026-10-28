# 音乐空间 MCP

本例属于 [MCP 项目实战](../../docs/mcp-projects/README.md)的音乐选修。看懂[独立 MCP 演示](../../docs/ai-from-scaling/00-minimal-mcp.md)后即可按兴趣学习。

同一个 TypeScript MCP 提供两种完整场景：

1. **声部之结**：导入多轨 MIDI，把整段时间折成圆环，用时值、音高与力度塑造交织光带，观察声部的进入、休止和重复，并导出可交给 Blender 的 GLB；按小节定位、独听、查看同轨精确重复。
2. **光之剧场**：导入已有音乐、剧场背景、独立透明中景与前景，用分层遮挡、视差、灯束与场次关键帧构成 2.5D 舞台，导出带声音的 MP4。

数据与场景保存在本机。两种场景共用时间轴、持久化、浏览器播放与离线渲染路径，独立于 music-eyes。

## 直接运行

需要 Node.js ≥ 22.22、pnpm 11.14、Chrome 或 Playwright Chromium、FFmpeg。`check` 会实际启动本地 HTTP 服务、浏览器和 FFmpeg，没有用跳过来替代这些验证。

```bash
pnpm --dir examples/music-space-mcp install --frozen-lockfile
pnpm --dir examples/music-space-mcp check
pnpm --dir examples/music-space-mcp demo
pnpm --dir examples/music-space-mcp preview
```

打开 `preview` 打印的 `http://127.0.0.1:<port>`，从右上角选择“声部之结 · Phrase Knot”或“光之剧场 · Light Theatre”。点击播放启用声音；声部场景可以拖动旋转、滚轮靠近、按小节定位及独听。剧场可以调整图层间距与运镜幅度、点击场次定位，并保存配置、导出短片。

`demo` 经真实 stdio MCP 调用，生成三声部练习、声部之结与同一练习完整混音的剧场，各保存两个段落的 1280×720 PNG 与六秒 H.264/AAC MP4。另导出声部之结的 GLB。文件路径汇总在 `.artifacts/demo.json`。演示使用固定动作，不调用付费模型；AI 自主配置由接入 MCP 的宿主承担。

默认使用安装的 macOS Chrome；其他环境可以执行 `pnpm --dir examples/music-space-mcp exec playwright install chromium`。也可设置绝对路径 `YUUKI_MUSIC_CHROME_BIN`。FFmpeg 从 `PATH` 查找，或通过 `FFMPEG_BIN` 指定；测试探测 MP4 使用 `ffprobe`，可用 `FFPROBE_BIN` 指定。

## 教程

- [音乐 1：声部之结](../../docs/ai-from-scaling/07-music-space-mcp.md)
- [音乐 2：光之剧场](../../docs/ai-from-scaling/08-music-photo-mcp.md)

## 接入 AI 客户端

```bash
pnpm --dir examples/music-space-mcp build
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/music-space-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-music-space -- "$MCP_NODE" "$MCP_SERVER"
```

命令依据 [Claude Code stdio MCP 配置](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。本次没有修改你的客户端配置。

默认数据目录 `~/.yuuki/music-space`；可以用绝对路径 `YUUKI_MUSIC_DIR` 改写。演示与独立 `preview` 默认使用本例 `.artifacts/`，因此与普通客户端数据分开。预览地址属于启动它的服务进程；关闭客户端后可用同一 `YUUKI_MUSIC_DIR` 启动 `preview` 重新打开场景。只开一个可写预览/MCP 实例管理同一目录；版本冲突保护覆盖该服务进程内的并发修改。

| 工具 | 功能 |
| --- | --- |
| `import_music` | 导入 MIDI 或音频，保存源文件副本、规范化音频与可视化数据 |
| `create_score_scene` | 从 MIDI 创建三维声部场景 |
| `create_photo_scene` | 从背景及透明 layers 或灰度深度图创建 2.5D 舞台 |
| `inspect_scene` | 查看配置版本、声部摘要与当前定位 |
| `update_scene` | 更新镜头、比例、配色、深度和关键帧，拒绝过期版本 |
| `set_transport` | 秒/小节定位、播放/暂停、独听或恢复全部声部 |
| `render_preview` | 用浏览器真实渲染 PNG，保存配置快照 |
| `export_model` | 导出标准材质与顶点颜色的声部之结 GLB，可继续在 Blender 编辑 |
| `export_clip` | 逐帧渲染片段，合成与当前独听选择一致的音频并保存 MP4 |

例如：“定位到第八小节，暂停，只听第二声部；镜头靠近一点，给我一张预览。”再把 `inspect_scene` 返回的版本用于 `update_scene.expectedRevision`。

## 数据与图像的含义

- 圆环表示整段音乐时间；绕环五圈是视觉设计，声部颜色、光带位置/宽度与缺口来自 MIDI。短间隙平滑连接，长休止保留断口。MIDI 音符、拍号、速度直接来自输入文件；小节定位支持速度与拍号变化。重复关系仅表示同轨中音高、相对起点和时值完全相同的模式，不自动判断副歌或曲式。
- 踏板、弯音等 MIDI 控制器信息尚未参与基础合成试听；原始 MIDI 副本仍保留，供后续扩展。
- 普通音频只有原曲与 50ms 音量包络，不冒充精确音符或声部。多轨 MIDI 试听是基础谐波合成，不是采样小提琴、真实乐器仿真或专业混音。
- 普通音乐的播放与导出使用 48kHz 立体声 PCM，音量分析单独使用 22.05kHz 单声道副本；输入的立体声信息会保留。MIDI 基础合成试听使用 22.05kHz 单声道声部。
- 剧场使用背景和两个独立 PNG alpha 图层，分别设置中景、前景的深度。也接受白近黑远的灰度深度图；没有图层或深度图时使用标注的纵向手工深度。两种输入互斥。
- 示例的三张独立舞台图层使用内置 imagegen 生成；提示词和来源见 [assets/README.md](assets/README.md)。它不是实拍重建。2.5D 只做有限运镜，没有恢复遮挡后面的完整空间。
- 交互预览使用 Three.js `WebGPURenderer` 与 TSL；优先 WebGPU，不可用时回落 WebGL2。确定性图片/视频捕获固定走 WebGL2。性能与音色体验仍需要在目标设备上观察。

## 保存、分享与恢复

```text
<root>/
  assets/<assetId>/
    source.mid 或 source.wav/其他原音频
    music.json
    track-1.wav、track-2.wav …
  scenes/<sceneId>/
    scene.json
    photo.png、depth.json、layer-N.png  # 2.5D 舞台
    exports/<exportId>/
      scene.json                     # 本次渲染使用的固定配置
      preview.png、clip.mp4 或 phrase-knot.glb
      audio.wav、receipt.json        # 视频对应的混音与回执
```

配置更新立即以原子替换保存，服务重启后按 ID 读取；浏览器的“保存场景配置”下载同一 JSON。配置引用素材 ID，**单独的 JSON 不包含音频和图片**；跨机器恢复时须一起复制对应 `assets/` 和 `scenes/` 目录。它保留的是确定的素材、映射和时间，方便解释与重做。

## 范围与验证

输入是本地普通文件，单文件 ≤ 64 MiB，音频/MIDI ≤ 180 秒，MIDI ≤ 16 个有音符轨道、25,000 音符。图片 ≤ 16MP，宽高比 0.4–3；深度图须与背景方向及宽高比匹配。透明图层最多四张、须有实际透明像素并保持与背景一致的宽高比，深度为 0.5–6。导出 0.5–20 秒，640/960/1280 宽，24/30fps；片段时长按帧量化，超过素材范围会拒绝。

HTTP 只绑定 127.0.0.1，校验 Host 与写请求 Origin，只公开规范化素材白名单；不提供任意路径文件服务。代码没有媒体上传或外部 CDN 依赖，预览在本机处理；宿主模型仍会收到它调用 MCP 所返回的摘要或预览。

检查覆盖 MIDI 时间换算、WAV 元数据、路径限制、失败清理、状态恢复、过期配置、真实浏览器播放/暂停与独听、透明图层导入与分层视差变化、JSON 下载、MP4 H.264/AAC 流、导出混音与 GLB 模型结构。技术验证不替代你对听感、画面舒适度的判断。

本次自动化实际验证了 WebGL2 渲染与默认后端的回退路径，没有测量目标设备的 WebGPU 性能。

GLB 保留曲面与颜色，不包含音频或浏览器辉光。曲面没有实体厚度，3D 打印须在 Blender 中补厚度并检查几何。
