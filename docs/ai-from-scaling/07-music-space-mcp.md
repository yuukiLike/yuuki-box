# 音乐 1：把一段音乐折成声部之结

本篇属于 [MCP 项目实战](../mcp-projects/README.md)的音乐选修。看懂[独立 MCP 演示](00-minimal-mcp.md)后即可开始，无需先完成模型训练、Harness 或其他实战项目。

如果一首曲子能成为一件可以从侧面观察、交给 Blender 继续编辑的雕塑，会是什么样？

这个案例叫 **声部之结 · Phrase Knot**。整段时间折成一个圆环，每条声部绕着时间环交织；旋律的音高弯折光带，力度决定宽度，休止留下断口。播放时，一个细环沿结移动，点亮正在发生的音符。

你可以暂停在一个小节，独听一条声部，再旋转整个结，观察它如何穿过其他声部。也可以导出 GLB，把这段音乐留成一个三维对象。

**今天只做一件事：打开示例，定位第八小节，独听第二声部。能指出画面与声音分别来自哪份数据，就可以停。**

这套音乐 MCP 独立于 music-eyes。实现使用 TypeScript、官方 MCP SDK、Zod、Three.js 和 [Tonejs/Midi](https://github.com/Tonejs/Midi)。它与[光之剧场](08-music-photo-mcp.md)共用场景配置、时间轴、播放与导出路径。

![真实渲染的三维声部空间](../../site/public/images/music-space-score.png)

## 打开第一场实验

需要 Node.js ≥ 22.22、pnpm、Chrome/Chromium 和 FFmpeg。依赖与环境配置见[示例 README](../../examples/music-space-mcp/README.md)。仓库根目录执行：

```bash
pnpm --dir examples/music-space-mcp install --frozen-lockfile
pnpm --dir examples/music-space-mcp demo
pnpm --dir examples/music-space-mcp preview
```

打开最后一条命令打印的本机网址，选择“声部之结 · Phrase Knot”。`demo` 一次准备两篇音乐教程的素材；今天只看声部场景即可。

1. 点击“播放”，听到一段三声部的合成试听。
2. 点击第 8 小节，时间停在对应位置。
3. 点击 `Counterline` 的“独听”，再播放；其他声部的音符变暗，声音只保留这一轨。
4. 点击“听全部声部”，比较同一段音乐。

**停点：指出哪一轨正在听、时间停在哪里，以及声部如何在空间中分开。** 音色是便于检查的基础合成音，不是采样小提琴；本节关注结构与时间对应。

## 音乐怎样折成一个结

| 看见的东西 | 数据或设计依据 |
| --- | --- |
| 圆环上的角度 | 音符时间 / 整段时长 |
| 不同颜色与绕环相位 | 所属声部 |
| 光段的位置、长度与粗细 | 音符起点、时值、力度 |
| 纤维的弯折高度 | 音高在声部路径上的偏移 |
| 光段之间的空隙 | 原 MIDI 的休止 |
| 发亮的端点 | 当前实际发声的音符 |
| 跨越时间的细弧 | 同轨精确重复的音高/节奏模式 |
| 同时发声点之间的细线 | 不同声部的同度/八度或纯五度音程类 |
| 结上的细截面环 | MIDI 自带的段落标记 |

圆环路径、绕环五圈和空间尺度是明确的视觉设计；将时间首尾放在附近不表示音乐必须循环。它们不表示乐器在录音中的真实位置；细线也只检查模 12 的音程，不承担完整和声分析。重复关系要求音高、相对起点和时值完全一致，没有自动把某段称为“副歌”。

示例 MIDI 专门写了延迟进入和休止：第二声部第三小节才进入，第一声部在第五、六小节暂时退出，第九、十小节第二声部让位。你能从画面和独听同时检查这些事实。细的暗线仅标示声部路线，厚的光段才是音符；相邻的短间隙用窄桥平滑连接，长休止保留断口。

拖动改变观察方向，滚轮靠近。按“回到默认视角”恢复构图。暂停后仍可围绕结观察，运镜参数会保存。

## 先取得可靠的音乐数据

这一篇直接输入多轨 MIDI，保留每个音符的音高、起点、时值、力度与所属轨道，同时保留速度和拍号事件。解析复用 Tonejs/Midi，而不是自行重写 MIDI 二进制协议。

`src/media.ts` 把它整理成 `music.json`，示例结构如下：

```ts
{
  kind: 'midi',
  tracks: [{ id: 'track-2', notes: [/* 时间、音高、时值 */] }],
  bars: [{ number: 8, time: 15.55554, /* 拍号与时长 */ }],
  tempos: [{ time: 0, bpm: 108 }]
}
```

文件中的速度可能改变，因此“第八小节”必须通过速度/拍号事件换算，不能直接假定每小节都是固定秒数。示例 108 BPM、4/4 拍时，第八小节约在 15.556 秒；这个数字只适用于当前示例。

示例 MIDI 的 Opening、Answer、Interweave、Return、Afterglow 标记来自 `src/fixtures.ts` 的创作安排，并非程序识别出的曲式。外部 MIDI 也可以携带自己的 marker/cuePoint。

普通 MP3/WAV 不能直接提供准确音符和声部。`create_score_scene` 会拒绝把普通音频当成这样的结构数据；音频可以用于下一篇的剧场。

## MCP 怎样控制它

连接方式见[客户端配置](../../examples/music-space-mcp/README.md#接入-ai-客户端)。连接后可以说：

> 导入这份 MIDI，创建声部空间。暂停在第八小节，只听第二声部；把层间距稍微拉开，给我一张预览。

一次调用链是：

```text
import_music → create_score_scene → set_transport
→ inspect_scene → update_scene → render_preview → export_model
```

`set_transport` 可以按秒或小节定位，`soloTrackIds: ['track-2']` 选择独听，空数组恢复全部声部。工具返回的 `playing` 是时间轴指令；真正发声仍要求打开预览、点击一次“播放”或“启用声音”。浏览器限制没有被伪装成成功播放。

`update_scene` 要求携带 `inspect_scene` 返回的当前版本；旧界面拿旧版本更新时会被拒绝，防止覆盖较新的配置。当前保护覆盖单个服务进程内的并发修改，同一数据目录由一个可写实例管理。

<details class="qa" id="为什么声音和画面能对齐">
<summary>声音和画面怎样对齐？</summary>

MIDI 声部 WAV 使用相同起点，浏览器从同一个 `AudioContext` 时钟播放并更新画面。暂停或定位后重建音源。

导出按 `start + frame / fps` 渲染，从相同起点截音频，因此不依赖录屏速度。未启用音频时仍可检查画面。

渲染用 [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)，优先 WebGPU，必要时回退 WebGL2；TSL 材质与 Bloom 处理颜色和辉光。

</details>

## 保存、重新打开与导出

每次操作立即保存 `scene.json`。服务关闭后，可用相同数据目录重新启动 `preview`；场景继续引用导入时保存的音乐副本。浏览器也能下载配置 JSON。跨机器恢复需要一起带上对应音乐与场景目录，单独的配置不包含音频。

`render_preview` 保存指定时刻的 PNG；`export_clip` 保存 H.264/AAC MP4。导出使用固定配置快照，独听选择同时作用于画面和混音。快照、混音与导出回执在 `exports/<exportId>/`，可以追溯这段短片具体用了什么。

## 从画面走向可编辑的对象

点击“保存三维模型 GLB”，或通过 MCP 调用 `export_model`，会保存声部曲面、顶点颜色与素材信息。标准 GLB 可以导入 Blender，继续调整材质、灯光和造型。这让音乐场景与前面的 Blender MCP 有了实际连接。

导出的模型不包含音频、辉光或界面环框；曲面还没有实体厚度，若想 3D 打印，需要在 Blender 中补厚度并检查可打印性。当前模型是一件可编辑的视觉对象。

## 一项可以亲手改的挑战

把 `score.layerSpacing` 从 `3.2` 改成 `5`，让声部绕时间环展开的半径变大，保持同一音乐、同一时刻、同一独听选择，再生成预览。

先预测：哪些信息会改变，哪些音乐事实应当保持相同？比较两张图，再核对 `music.json` 的音符与时间没有改变。

参考代码：[契约](../../examples/music-space-mcp/src/contracts.ts)、[MIDI 与音频处理](../../examples/music-space-mcp/src/media.ts)、[共享时间轴](../../examples/music-space-mcp/src/timeline.ts)、[声部之结几何](../../examples/music-space-mcp/web/weave.ts)、[浏览器播放与场景组装](../../examples/music-space-mcp/web/main.ts)。

2026-10-25 已验证实际 stdio 调用、浏览器小节定位与独听、音频输出、跨服务恢复、PNG/MP4 生成及 GLB 模型结构。音色与画面舒适度仍由使用者判断。做到本节停点后，可以休息；想继续再打开[音乐 2](08-music-photo-mcp.md)。
