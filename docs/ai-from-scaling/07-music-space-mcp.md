# 音乐 1：用 MCP 控制钢琴排练台

本篇属于课程末章的选修实践。目标是完成一次可核对的工具调用：**定位第八小节，只听第二声部，在三维键盘上找到正在发声的音。**

展示模型是一架带 88 个独立琴键的钢琴。整体视图看琴盖与键盘，操作近景看按键和音名，俯视图看布局。琴盖角度、练习提示与机位都可以通过 MCP 修改。

![钢琴排练台与实际 MCP 调用](../../site/public/images/music-space-score.png)

## 先跑一个任务

在仓库根目录执行；环境要求与安装说明见[示例 README](../../examples/music-space-mcp/README.md)。

```bash
pnpm --dir examples/music-space-mcp install --frozen-lockfile
pnpm --dir examples/music-space-mcp demo
pnpm --dir examples/music-space-mcp preview
```

打开最后一条命令打印的地址，选择“MIDI 钢琴排练台”。

1. 点击“运行这一步”。它先调用 `inspect_scene`，再调用 `set_transport`，定位第八小节、暂停、独听 `Counterline`。
2. 点击“操作近景”，再点击“播放”，核对亮起并压下的琴键和画面下方的音名。
3. 在下方“实际 MCP 调用”选择 `set_transport`，点击“展开详情”，对照请求和结构化结果。

**停点：能指出请求里的小节与声部，返回结果里的定位和独听状态，并把一个音名对应到琴键。**

任务按钮使用固定参数，不要求调用语言模型。接入 AI 宿主后，也可以说：“暂停在第八小节，只听第二声部，切到键盘近景，再给我一张预览。”

## 这次调用做了什么

`sceneId` 使用当前场景返回的 UUID。定位请求的核心是：

```json
{
  "name": "set_transport",
  "arguments": {
    "sceneId": "当前场景的 UUID",
    "bar": 8,
    "playing": false,
    "soloTrackIds": ["track-2"]
  }
}
```

工具返回 `scene.transport.position`、`soloTrackIds` 和新的 `revision`。第八小节的秒数来自 MIDI 的速度与拍号，不能把所有曲子都按同一个 BPM 换算。示例为 108 BPM、4/4 拍，第八小节约在 15.556 秒。

真正发声需要使用者先点击一次播放，启用浏览器声音。声音与画面共享音频时钟；重新定位或独听会从同一偏移重建播放。

## 再改一个可见参数

点击 `inspect_scene`，返回的 `objects` 会列出对象和可调参数：

| 对象 | 可以操作什么 |
| --- | --- |
| `piano.keyboard` | 小节、独听声部、展示机位 |
| `piano.lid` | `model.lidAngle`，范围 0–65 度 |
| `piano.guide` | `model.showGuide`，显示接下来四秒的音符提示 |

![钢琴模型整体机位](../../site/public/images/music-space-piano-model.png)

把琴盖角度调到 45 度，下方应出现一次真实的 `update_scene`。它的输入包含当前 `expectedRevision` 和 `model.lidAngle: 45`；返回版本增加，模型的琴盖也改变角度。

`presentation.view` 可取 `overview`、`detail`、`plan`，分别是整体、近景、俯视；`presentation.labels` 控制部件标注。拖动模型可以环绕观察，姿态同样通过工具保存。

可以故意用旧版本再提交一次修改，观察拒绝结果：过期请求不会覆盖新配置。这比单看一张三维截图更能说明工具的输入、校验、状态和结果之间的关系。

## 展示页为什么也能用于学习 MCP

按钮先把请求交给本地 Node 桥接层；桥接层使用官方 `Client`，经 `InMemoryTransport` 连接 MCP 服务端，执行相同的工具注册。外部 AI 宿主则通过 stdio 接入。两种调用共用同一个场景存储。

下方记录真实的 `tools/call` 参数和结构化结果，并标记来源；图片的 base64 不写入记录。右上角“查看 MCP 工具”执行真正的 `tools/list`，可以看到工具说明和输入 JSON Schema。

这里可以分别找到：

- 输入契约：[contracts.ts](../../examples/music-space-mcp/src/contracts.ts)。
- 工具注册与调用记录：[tools.ts](../../examples/music-space-mcp/src/tools.ts)。
- 展示页的 MCP 客户端桥接：[http.ts](../../examples/music-space-mcp/src/http.ts)。
- MIDI 到琴键的映射：[piano.ts](../../examples/music-space-mcp/web/piano.ts)。

## 导出一份能交付的结果

“渲染当前预览”调用 `render_preview`，返回 PNG 路径与本机打开地址；“导出当前位置 4 秒”调用 `export_clip`，输出 H.264/AAC MP4；“导出模型 GLB”调用 `export_model`，保留钢琴的独立琴键、琴盖、材质与当前姿态，供 Blender 继续编辑。

导出先保存固定配置快照。短片逐帧使用确定的音乐时间，画面和音频使用相同起点；独听选择也进入导出。配置、素材与导出文件保存在本地，可重启后继续打开。

键盘显示 MIDI 21–108，即 A0–C8；范围外的 MIDI 音符仍参与音频与时间分析，但没有对应的 88 键模型。画面音名是对应琴键的参照，不提供自动指法。合成试听保留基础谐波，不承担专业钢琴音色或演奏效果验证。

下一篇：[用 MCP 检查舞台布局](08-music-photo-mcp.md) · 返回[课程总览](README.md)。
