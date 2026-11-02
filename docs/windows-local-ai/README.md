# Windows 本地 AI：图片与音乐生成

先用本机 ComfyUI 和 Qwen Image <mark class="key">保存首张 PNG 与工作流</mark>；ACE-Step 配乐为选修。

参考硬件：**RTX 5060 Ti 16GB、i5-10400F、16GB DDR4-3200、1TB 硬盘、500W 电源**。

## 从这里开始

| 阅读顺序 | 完成后得到什么 |
| --- | --- |
| 本页 · 认识本地运行 | 分清应用、模型文件与工作流，以及显存、内存和硬盘 |
| [1 · 用 Qwen Image 生成第一张图](01-qwen-image.md) | 安装 Windows 便携版、放好三份模型、导入工作流并保存图片 |
| [选修 · 用 ACE-Step 生成配乐](02-ace-step-music.md) | 复用 ComfyUI，下载一个整合模型，生成并试听 30 秒音乐 |

第一课用 **ComfyUI Windows Portable + Qwen-Image-2.1-Turbo**，保留官方 8 步方案，选量化权重降低加载压力。[Qwen 官方模型说明](https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo)

第二课用 **ACE-Step 1.5 Turbo** 原生 AIO 整合文件，先纯音乐，再试中文短歌词。[ACE-Step 官方教程](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)

## 以第一课认识应用、模型和工作流

| 名称 | 职责 | 保存位置 |
| --- | --- | --- |
| 应用 | ComfyUI，负责加载模型、组织计算和显示结果 | `ComfyUI_windows_portable` 文件夹 |
| 模型 | 图像生成模型、文本编码器、VAE 三份权重 | `ComfyUI\models` 下的对应子目录 |
| 工作流 | 一份 JSON，记录节点连接、模型文件名、提示词和采样设置 | 下载或导出的 `.json` 文件 |

可以把一次生成读成：

```text
提示词 → 文本编码器 → 图像模型逐步生成 → VAE 解码 → 保存 PNG
```

工作流 JSON 不含模型；跨机需相同模型与兼容 ComfyUI。计算在本机，浏览器仅提供界面，依赖与权重下载后无需 API key。[ComfyUI 模型与工作流](https://docs.comfy.org/basic-concepts/models)

<div class="heading-alias" id="你的三个容量要分开看" aria-hidden="true"></div>

## 显存、系统内存与磁盘容量

| 硬件 | 用途 | 第一次怎么安排 |
| --- | --- | --- |
| 16GB 显存 | 存放 GPU 当前计算需要的权重、缓存与中间结果 | 第一课先生成一张 512×512 图片；第二课先生成一段 30 秒音乐 |
| 16GB 系统内存 | Windows、ComfyUI、模型加载与卸载时共用 | 关闭其他大型程序，保留系统管理的分页文件 |
| 1TB 硬盘 | 保存应用、模型、图片、音频与分页文件 | 检查剩余空间；第一课建议预留至少 60GB，第二课另留至少 20GB |

<mark class="caution">内存与显存不能合算</mark>；搬运有开销，文件大小也不等于运行峰值，须本机观察。

按 **2026-10-29** 官方文件编写，附入门工作流，尚未本机实测；一次一模型，从小图和短音乐开始。

**下一课：[用 Qwen Image 生成第一张图 →](01-qwen-image.md)**
