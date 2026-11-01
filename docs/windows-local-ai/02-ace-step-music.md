# 选修 · ACE-Step 1.5 Turbo：Windows 配乐生成

用 ACE-Step 1.5 Turbo 为竹林画面<mark class="key">生成 30 秒钢琴配乐</mark>，保存可剪辑素材。

参考配置为 **RTX 5060 Ti 16GB、i5-10400F、16GB 系统内存**和上一课的 ComfyUI Windows 便携版。完成后保存一份音频和一份工作流 JSON。

[返回专题总览](README.md) · [上一课：Qwen Image 首次出图](01-qwen-image.md)

<div class="heading-alias" id="1--为什么推荐它" aria-hidden="true"></div>

## 1 · 模型与输出范围

ComfyUI 原生支持 ACE-Step 1.5，按风格和可选歌词生成音乐；本课 **1.5 Turbo AIO** 将模型、文本组件和 VAE 整合一份。[ComfyUI 官方教程](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)

先纯音乐，改乐器或节奏对照，再试中文歌词；满意的片段可做可视化。

16GB 显存先试短音频、小批量；<mark class="caution">尚无本机性能实测</mark>，其他显卡测速不能套用，16GB 系统内存还须留给 Windows 与加载。

<details class="qa">
<summary>它会生成 MIDI、乐谱或分轨吗？</summary>

默认输出混合音频 FLAC，不含 MIDI、乐谱或独立声部；可作配乐草稿，再按需转写、拆轨。

</details>

## 2 · 复用 ComfyUI，下载一个模型

没做过上一课时，先完成 [ComfyUI 安装和 GPU 检查](01-qwen-image.md#2--安装-comfyui-并确认-gpu-可用)。本课同样以 **ComfyUI v0.43.0** 为核对版本，使用内置节点。

如果刚刚运行过 Qwen Image，先关闭 ComfyUI 的启动终端，释放上一课占用的资源。模型文件可以继续保留在硬盘。

下载 [ace_step_1.5_turbo_aio.safetensors](https://huggingface.co/Comfy-Org/ACE-Step-1.5/blob/main/checkpoints/ace_step_1.5_turbo_aio.safetensors)，约 **10.03GB**（十进制文件大小），放到：

```text
C:\AI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
└── ace_step_1.5_turbo_aio.safetensors
```

沿用上课盘符，下载完成再启动；另留至少 **20GB** 和系统分页文件余量。10.03GB 仅是文件大小，运行仍需中间数据与缓存。[官方模型文件目录](https://huggingface.co/Comfy-Org/ACE-Step-1.5/tree/main/checkpoints)

只需该 AIO；XL、分拆权重和额外 4B 模型用于其他配置。[模型文件与目录对应关系](https://huggingface.co/Comfy-Org/ACE-Step-1.5)

双击已有的 `run_nvidia_gpu.bat`，打开终端打印的本地地址，通常是 `http://127.0.0.1:8188`。

## 3 · 导入 30 秒配乐工作流

下载[本课的 ACE-Step 1.5 Turbo 工作流](../../site/public/workflows/windows-local-ai/ace-step-1.5-turbo-first-music.json)，保存为 `.json` 后拖进 ComfyUI 画布。如果浏览器直接显示 JSON，按 `Ctrl + S` 保存；在 GitHub 阅读时使用 Raw／Download raw file。

基于[官方 AIO 模板](https://github.com/Comfy-Org/workflow_templates/blob/e7cd011d4ded3411c2f481200544f0be6fdc962e/templates/audio_ace_step_1_5_checkpoint.json)，保留采样连接与设置，改为 30 秒、单首、seed 42 和纯音乐提示。

| 位置 | 初始值 | 用途 |
| --- | --- | --- |
| `CheckpointLoaderSimple`／Load Checkpoint | `ace_step_1.5_turbo_aio.safetensors` | 加载整合模型 |
| `Duration (seconds)` | `30` | 同时传给文本条件和音频长度两个节点 |
| `Seed` | `42`，`fixed` | 同时传给文本规划和采样节点 |
| `EmptyAceStep1.5LatentAudio` | `batch_size = 1` | 一次只生成一首 |
| `TextEncodeAceStepAudio1.5` | `bpm = 80`，`timesignature = 4`，`keyscale = D major` | 指定较舒缓的速度、拍号和调性 |
| 同一个文本节点 | `language = unknown`，`generate_audio_codes = true` | 纯音乐不指定演唱语言；保留语言模型规划 |
| `KSampler` | `steps = 8`，`cfg = 1`，`euler`，`simple`，`denoise = 1` | 官方 Turbo 模板的音频采样设置 |
| `ModelSamplingAuraFlow` | `shift = 3` | 保留模板的采样偏移 |
| `SaveAudioAdvanced`／Save Audio (Advanced) | 前缀 `audio/yuuki_bamboo`，格式 `flac` | 保存音频 |

时长与 seed 由左侧节点统一传入；**只改 `Duration (seconds)`，不要拆线**。BPM 和调性需试听或分析核对。

高级选项 `generate_audio_codes` 启用语言模型规划，可能增加等待；文本 `cfg_scale = 2` 与采样 `cfg = 1` 属不同阶段，保留默认。[ComfyUI ACE-Step 节点定义](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_ace.py)

## 4 · 为竹林画面生成第一段音乐

在文本节点的 **tags** 中使用这段描述，工作流里已经填好：

```text
Instrumental ambient piano, gentle felt piano melody, soft bamboo flute accents,
warm airy pads, a quiet bamboo forest at dawn, spacious and peaceful,
80 BPM, D major, 4/4, no vocals, no drums, a gentle ending.
```

描述清晨竹林钢琴、少量竹笛、柔和铺底，无人声和鼓；英语用于固定对照词。

在 **lyrics** 中只保留：

```text
[Instrumental]
```

这是纯音乐标记；风格描述放在 tags，歌词框不放「请帮我生成一段音乐」这样的指令。[ACE-Step 提示与歌词指南](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Tutorial.md)

点 **Run／运行** 或 `Ctrl + Enter` 一次；先加载/规划，再采样，等本次完成。

保存节点出现播放器后，调低一点系统音量再播放。接着打开：

```text
C:\AI\ComfyUI_windows_portable\ComfyUI\output\audio\
```

找到 `yuuki_bamboo*.flac`，复制到作品目录并播放；听到声音且文件保存才算完成。

最后用工作流菜单的 **Export／导出** 下载普通工作流 JSON。模型文件、音频文件与 JSON 分开保存；JSON 记录设置，不包含模型和成品音频。

<details class="qa">
<summary>剪辑软件不支持 FLAC 怎么办？</summary>

保存节点改 `mp3`、`320k` 后重新导出；MP3 有损，保留 FLAC。节点支持 FLAC、MP3、Opus。[音频保存节点](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_audio.py)

</details>

<div class="heading-alias" id="5--听出变化再尝试自己的歌词" aria-hidden="true"></div>

## 5 · 对比参数与歌词

固定 30 秒和 seed 42，将 `soft bamboo flute accents` 改为 `soft acoustic guitar accents`，保存第二份并比较；同 seed 不保证其他编曲不变。

再试 **60 秒**、batch 1，听开头、中段、结尾；时长正确不代表乐段完整。

想试中文演唱时，用下面这组自写短歌词做独立实验：把 tags 换成新的描述、`language` 改为 `zh`，删除歌词框中的 `[Instrumental]`。

```text
Mandarin acoustic pop, intimate gentle vocal, felt piano and acoustic guitar,
warm and hopeful, 80 BPM, D major, 4/4, sparse arrangement.
```

```text
[Verse]
风穿过竹叶的缝隙
晨光停在旧木椅

[Chorus]
让今天慢慢地开始
把心事写成一首诗
```

先试 30～60 秒，核对吐字与对齐；提前唱完、重复或含混时，记录并调整时长、歌词密度或 seed。[ACE-Step 官方模型说明](https://huggingface.co/ACE-Step/Ace-Step1.5)

<div class="heading-alias" id="6--这台机器上优先排查什么" aria-hidden="true"></div>

## 6 · 资源与运行问题排查

| 现象 | 处理顺序 |
| --- | --- |
| 模型下拉框为空 | 检查 `models\checkpoints`、完整文件名和下载是否完成，重启后重新选择 |
| ACE-Step 节点标红或缺失 | 检查是否使用上一课的 ComfyUI 版本；先更新稳定版并重启，保留节点导入错误 |
| 等待很久还没进入 8 步采样 | 查看终端是否仍在加载或生成音频代码；后者发生在采样之前 |
| `CUDA out of memory` | 停止排队，关闭其他 GPU 程序，重启服务；回到 30 秒、batch 1，必要时降到 10～15 秒 |
| 内存不足、`WinError 1455`、长时间大量读盘 | 检查任务管理器里的系统内存、已提交内存、分页文件和磁盘余量；按上一课的内存排查步骤处理 |
| 纯音乐里仍混进人声 | 检查 `[Instrumental]` 与 `no vocals`，换 seed 再听，不能只凭设置认定输出无歌声 |
| 长度与预期不符 | 检查独立时长节点是否仍连接到文本节点和音频 latent；重新导入本课工作流恢复连接 |

规划卡住时，可将 `generate_audio_codes` 设为 `false` 试短片段；跳过规划会改变结果，但 **AIO 不变小，也不保证加载内存减少**，并非通用修复。[节点参数说明](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_ace.py)

<div class="heading-alias" id="7--把这次实验接到你的项目" aria-hidden="true"></div>

## 7 · 保存产物与项目集成

保存两份音频/工作流和一句听感对照；首次加载与改提示后耗时分开记，未改输入的缓存命中不算生成测速。

音频可给[舞台预演台（选修）](../ai-from-scaling/08-music-photo-mcp.md)驱动灯光和镜头；[钢琴排练台（选修）](../ai-from-scaling/07-music-space-mcp.md)需 MIDI 逐音符数据，不能用混音代替。

模型、节点、模板核对日期 **2026-10-29**；仅做静态连接检查，**未在 Windows 目标环境实测生成、听感或峰值内存**。

[返回 Windows 本地 AI 专题](README.md)。
