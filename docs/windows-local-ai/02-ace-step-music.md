# ACE-Step 1.5 Turbo：在 Windows 生成第一段配乐

**这一课选 ACE-Step 1.5 Turbo：给上一课的竹林画面，生成一段 30 秒的钢琴配乐。** 你已经在探索音乐与视觉项目，本地音乐生成能直接变成可听、可比较、可继续剪辑的素材。

继续使用你的 **RTX 5060 Ti 16GB、i5-10400F、16GB 系统内存**和上一课的 ComfyUI Windows 便携版。完成后保存一份音频和一份工作流 JSON。

[返回专题总览](README.md) · [上一课：Qwen Image 首次出图](01-qwen-image.md)

## 1 · 为什么推荐它

ACE-Step 1.5 可以把风格描述和可选歌词生成音乐；ComfyUI 已原生支持它。本课使用普通 **1.5 Turbo 的 AIO 整合文件**，把生成模型、文本组件和音频 VAE 放在一个文件中，下载和管理都比较直接。[ComfyUI 官方教程](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)

我选它的理由是：你可以马上听到结果，改一项乐器或节奏再比较，还能把喜欢的片段拿去做音乐可视化。这里先做纯音乐，成功后再试自己的中文歌词。

你的 16GB 显存适合从短音频、小批量尝试这条路线。**这是按模型体积和运行方式作出的选择，不是这张显卡的实测结论。** 官方的低显存宣传、其他显卡的生成时间，都不能直接当作你的速度和内存保证；16GB 系统内存仍要留给 Windows、模型加载和卸载。

<details class="qa">
<summary>它会生成 MIDI、乐谱或分轨吗？</summary>

本课输出的是已经混合好的音频，默认保存为 FLAC。音频波形不包含可直接编辑的 MIDI 音符；也不会自动交付独立钢琴、鼓和人声轨道。可以把它当作配乐草稿或音频素材，再决定是否继续转写、拆轨或重做。

</details>

## 2 · 复用 ComfyUI，下载一个模型

没做过上一课时，先完成 [ComfyUI 安装和 GPU 检查](01-qwen-image.md#2--安装-comfyui-并确认-gpu-可用)。本课同样以 **ComfyUI v0.43.0** 为核对版本，使用内置节点。

如果刚刚运行过 Qwen Image，先关闭 ComfyUI 的启动终端，释放上一课占用的资源。模型文件可以继续保留在硬盘。

下载 [ace_step_1.5_turbo_aio.safetensors](https://huggingface.co/Comfy-Org/ACE-Step-1.5/blob/main/checkpoints/ace_step_1.5_turbo_aio.safetensors)，约 **10.03GB**（十进制文件大小），放到：

```text
C:\AI\ComfyUI_windows_portable\ComfyUI\models\checkpoints\
└── ace_step_1.5_turbo_aio.safetensors
```

沿用你上一课实际选择的盘符。文件页的下载按钮会下载模型本体；确认下载完成后再启动。建议这次额外留出至少 **20GB 可用硬盘空间**，并保留系统管理的分页文件及其磁盘余量。10.03GB 是文件大小，运行还需要中间数据和缓存。[官方模型文件目录](https://huggingface.co/Comfy-Org/ACE-Step-1.5/tree/main/checkpoints)

这份工作流只需要上面的 AIO 文件。仓库里的 XL、分拆权重和额外 4B 语言模型，是其他配置使用的文件。[模型文件与目录对应关系](https://huggingface.co/Comfy-Org/ACE-Step-1.5)

双击已有的 `run_nvidia_gpu.bat`，打开终端打印的本地地址，通常是 `http://127.0.0.1:8188`。

## 3 · 导入 30 秒配乐工作流

下载[本课的 ACE-Step 1.5 Turbo 工作流](../../site/public/workflows/windows-local-ai/ace-step-1.5-turbo-first-music.json)，保存为 `.json` 后拖进 ComfyUI 画布。如果浏览器直接显示 JSON，按 `Ctrl + S` 保存；在 GitHub 阅读时使用 Raw／Download raw file。

它基于[官方 AIO 模板](https://github.com/Comfy-Org/workflow_templates/blob/e7cd011d4ded3411c2f481200544f0be6fdc962e/templates/audio_ace_step_1_5_checkpoint.json)，保留采样连接和默认采样设置，改成了 30 秒、一次一首、固定 seed 42，以及本课的纯音乐提示词。

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

时长与 seed 都由左侧的独立节点统一传入。**以后改长度只改 `Duration (seconds)`，不要拆开连线分别改两处。** BPM 和调性是输入条件，生成后仍要通过听感或分析核对是否符合预期。

`generate_audio_codes` 位于文本节点的高级选项中。它会启用语言模型生成音频代码，可能增加等待时间；该节点的 `cfg_scale = 2` 保持默认，它与 KSampler 的 `cfg = 1` 属于不同阶段。[ComfyUI ACE-Step 节点定义](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_ace.py)

## 4 · 为竹林画面生成第一段音乐

在文本节点的 **tags** 中使用这段描述，工作流里已经填好：

```text
Instrumental ambient piano, gentle felt piano melody, soft bamboo flute accents,
warm airy pads, a quiet bamboo forest at dawn, spacious and peaceful,
80 BPM, D major, 4/4, no vocals, no drums, a gentle ending.
```

意思是：清晨竹林中的安静氛围钢琴，少量竹笛点缀、柔和铺底，没有人声和鼓，结尾轻轻收住。这里写英语只是为了固定一组便于对照的风格词。

在 **lyrics** 中只保留：

```text
[Instrumental]
```

这是纯音乐标记；风格描述放在 tags，歌词框不放「请帮我生成一段音乐」这样的指令。[ACE-Step 提示与歌词指南](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Tutorial.md)

点击 **Run／运行**，或按 `Ctrl + Enter` 提交一次。先看启动终端里的模型加载与文本处理，之后才进入音频采样。第一次加载可能比后续运行慢，先等这一条任务结束。

保存节点出现播放器后，调低一点系统音量再播放。接着打开：

```text
C:\AI\ComfyUI_windows_portable\ComfyUI\output\audio\
```

找到以 `yuuki_bamboo` 开头的 `.flac` 文件，复制到自己的作品文件夹，再用播放器打开。能听到音频且文件确实保存，才算完成首次生成。

最后用工作流菜单的 **Export／导出** 下载普通工作流 JSON。模型文件、音频文件与 JSON 分开保存；JSON 记录设置，不包含模型和成品音频。

<details class="qa">
<summary>剪辑软件不支持 FLAC 怎么办？</summary>

可以在保存节点把格式改为 `mp3`、质量选 `320k`，再运行一次导出。MP3 是有损格式，保留原始 FLAC 便于以后继续处理。当前保存节点支持 FLAC、MP3 和 Opus。[音频保存节点](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_audio.py)

</details>

## 5 · 听出变化，再尝试自己的歌词

先保持 30 秒和 seed 42，只改一项：把 tags 中的 `soft bamboo flute accents` 改成 `soft acoustic guitar accents`。保存第二份音频，比较主旋律、伴奏和空间感。相同 seed 有助于控制实验条件，但更改提示后仍可能让整个编曲发生变化。

挑出喜欢的方向后，再把时长改到 **60 秒**，继续保持 batch 1。听三个地方：开头是否很突兀，中段是否有发展，结尾是否像被截断。输出时长符合要求，不代表已经形成完整乐段；需要试听选择。

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

先试 30～60 秒，逐句听吐字和歌词对齐。如果提前唱完、重复句子或出现含混人声，记录下来，再调整时长、歌词密度或 seed。模型支持带歌词生成，但每次输出仍需人工试听。[ACE-Step 官方模型说明](https://huggingface.co/ACE-Step/Ace-Step1.5)

## 6 · 这台机器上优先排查什么

| 现象 | 处理顺序 |
| --- | --- |
| 模型下拉框为空 | 检查 `models\checkpoints`、完整文件名和下载是否完成，重启后重新选择 |
| ACE-Step 节点标红或缺失 | 检查是否使用上一课的 ComfyUI 版本；先更新稳定版并重启，保留节点导入错误 |
| 等待很久还没进入 8 步采样 | 查看终端是否仍在加载或生成音频代码；后者发生在采样之前 |
| `CUDA out of memory` | 停止排队，关闭其他 GPU 程序，重启服务；回到 30 秒、batch 1，必要时降到 10～15 秒 |
| 内存不足、`WinError 1455`、长时间大量读盘 | 检查任务管理器里的系统内存、已提交内存、分页文件和磁盘余量；按上一课的内存排查步骤处理 |
| 纯音乐里仍混进人声 | 检查 `[Instrumental]` 与 `no vocals`，换 seed 再听，不能只凭设置认定输出无歌声 |
| 长度与预期不符 | 检查独立时长节点是否仍连接到文本节点和音频 latent；重新导入本课工作流恢复连接 |

如果卡在音频代码规划阶段，或需要进一步减轻计算，可以展开文本节点高级选项，将 `generate_audio_codes` 改为 `false` 再试短片段。这样会跳过语言模型规划，结果可能不同；**AIO 文件不会因此变小，也不保证所有加载阶段都减少同样的内存。** 先按现象处理，不把关闭规划当作所有错误的通用修复。[节点参数说明](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_ace.py)

## 7 · 把这次实验接到你的项目

留下两份音频、两份工作流，以及一句听感判断，例如「竹笛版更空旷，吉他版更像日常片头」。首次加载耗时与修改提示后的生成耗时分开记；未改输入时直接命中缓存，不算新一轮生成速度。

接下来可以把喜欢的音频当作[光之剧场](../ai-from-scaling/08-music-photo-mcp.md)的素材候选，给画面安排灯光和镜头。普通音频能驱动音量与时间轴效果；[声部之结](../ai-from-scaling/07-music-space-mcp.md)需要 MIDI 的逐音符信息，不能直接把这份混合音频当作多轨乐谱。

模型文件、ComfyUI 节点和模板核对于 **2026-10-29**。配套工作流做静态连接检查；**尚未在你的 Windows 机器上实测生成、听感或峰值内存**，也没有把官方其他显卡的测速写成你的性能预期。

[返回 Windows 本地 AI 专题](README.md)。
