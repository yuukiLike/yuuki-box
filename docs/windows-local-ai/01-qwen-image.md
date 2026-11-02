# Windows 第一次运行 Qwen Image：安装、出图与保存

用 RTX 5060 Ti 16GB、Qwen-Image-2.1-Turbo 和 ComfyUI 便携版生成图片，<mark class="key">找到实际 PNG</mark>；下载时间另计。

[返回专题总览](README.md)。按 i5-10400F、16GB 内存编写；Windows 版本未记录，以下使用 64 位系统和 PowerShell。

## 1 · 准备空间和显卡驱动

1. 在 Windows「任务管理器 → 性能」确认显卡是 **RTX 5060 Ti**，专用 GPU 内存为 **16GB**。共享 GPU 内存不计入这 16GB。
2. 通过 [NVIDIA 官方驱动入口](https://www.nvidia.com/en-us/drivers/)或 NVIDIA App 更新对应显卡的驱动，按安装提示重启。
3. 选 `C:\AI` 等目录，换盘时统一替换路径；留至少 **60GB**，容纳安装、约 14.25GB 模型和输出。
4. 关闭游戏、其他模型与多余标签页，为模型加载保留 **16GB 系统内存**余量。

保留系统管理分页文件：`Win + R` → `sysdm.cpl` →「高级 → 性能／设置 → 高级 → 虚拟内存／更改」确认自动管理，按提示重启并留磁盘余量；换页不能替代物理内存速度。[Microsoft 分页文件说明](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/introduction-to-the-page-file)

## 2 · 安装 ComfyUI 并确认 GPU 可用

在 **ComfyUI v0.43.0** [官方发布页](https://github.com/Comfy-Org/ComfyUI/releases/tag/v0.43.0)的 **Assets** 下载 `ComfyUI_windows_portable_nvidia.7z`；不选 `arm64/amd/intel/cu126`。

用 [7-Zip](https://www.7-zip.org/)完整解压到 `C:\AI`；自带 Python 与 CUDA，无需另装 Toolkit。[Windows 便携版安装说明](https://docs.comfy.org/installation/comfyui_portable_windows)

解压后，确认能看到：

```text
C:\AI\ComfyUI_windows_portable\
├── ComfyUI\
├── python_embeded\
├── update\
└── run_nvidia_gpu.bat
```

双击 `run_nvidia_gpu.bat`，保留弹出的终端窗口。出现 `http://127.0.0.1:8188` 后，在浏览器打开这个地址；自动打开也正常。**终端窗口关闭后，本机服务就会停止。**

在 PowerShell 中执行下面两行，检查便携版使用的 PyTorch，而不是系统里其他 Python 环境：

```powershell
Set-Location 'C:\AI\ComfyUI_windows_portable'
.\python_embeded\python.exe -s -c "import torch; print('CUDA:', torch.version.cuda); print('GPU available:', torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'GPU unavailable')"
```

须看到 `GPU available: True` 和 `RTX 5060 Ti`；否则先查驱动、安装包与终端错误，再下载模型。

## 3 · 下载三份模型，放进对应目录

固定用 **2.1 Turbo**：文本编码器编码提示，图像模型生成，VAE 解码。三文件配套，勿混用旧 Qwen-Image、2512 或 Edit。

点击文件名打开官方文件页，再点击下载按钮。路径均相对于 `C:\AI\ComfyUI_windows_portable\ComfyUI\models\`：

| 文件 | 约下载大小 | 放到哪个子目录 |
| --- | --- | --- |
| [qwen_image_2.1_turbo_int8_convrot.safetensors](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/blob/main/diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors) | 7.26GB | `diffusion_models` |
| [qwen3vl_8b_w4a8.safetensors](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/blob/main/text_encoders/qwen3vl_8b_w4a8.safetensors) | 6.31GB | `text_encoders` |
| [qwen_image_2.1_vae_bf16.safetensors](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/blob/main/vae/qwen_image_2.1_vae_bf16.safetensors) | 0.68GB | `vae` |

合计十进制约 **14.25GB**，Windows 显示可能不同；仅下载这三份，不下载其他精度、基础版或增强模型。[官方模型目录](https://huggingface.co/Comfy-Org/Qwen-Image-2.1)

放好后应是：

```text
ComfyUI\models\
├── diffusion_models\
│   └── qwen_image_2.1_turbo_int8_convrot.safetensors
├── text_encoders\
│   └── qwen3vl_8b_w4a8.safetensors
└── vae\
    └── qwen_image_2.1_vae_bf16.safetensors
```

新建缺失子目录，核对下载完成、扩展名与目录，避免存成几 KB 网页；关终端后重跑 `run_nvidia_gpu.bat`。

<details class="qa">
<summary>为什么图像模型和文本编码器选不同精度？</summary>

独立组件可用不同量化：图像 INT8 ConvRot、编码器 W4A8，以减少下载和加载压力；效果不保证等同完整精度，先固定配置。

</details>

## 4 · 导入本课工作流

下载[本课的 Qwen Image 2.1 Turbo 工作流](../../site/public/workflows/windows-local-ai/qwen-image-2.1-turbo-first-run.json)，保存为 `.json`。如果浏览器直接显示 JSON，按 `Ctrl + S` 保存；在 GitHub 阅读时使用 Raw／Download raw file。

拖入 JSON 或点 **Open／打开**，应看到连接好的节点；节点是步骤，连线传递结果，先不改线。

工作流基于[官方 Turbo 模板](https://github.com/Comfy-Org/workflow_templates/blob/0cf483d1dcb548b8b8d3f38ddf0ff41c89896cdb/templates/image_qwen_image_2_1_turbo_t2i.json)：普通内置节点，移除提示增强，换 W4A8，设 512×512 单张。

在画布中核对下面几处；下拉框里如果是空值，就重新选择表中的文件：

| 节点 | 第一次使用的值 |
| --- | --- |
| `UNETLoader`／Load Diffusion Model | `qwen_image_2.1_turbo_int8_convrot.safetensors`，`weight_dtype = default` |
| `CLIPLoader`／Load CLIP | `qwen3vl_8b_w4a8.safetensors`，`type = qwen_image`，`device = default` |
| `VAELoader`／Load VAE | `qwen_image_2.1_vae_bf16.safetensors` |

其余参数沿用本课工作流，直接进入首次出图。

<details>
<summary>选读：模板参数与采样时间表</summary>

| 节点 | 模板默认值 |
| --- | --- |
| `EmptyLatentImage`／Empty Latent Image | `width = 512`，`height = 512`，`batch_size = 1` |
| `RandomNoise` | `noise_seed = 42`，生成后保持 `fixed` |
| `CFGGuider` | `cfg = 1` |
| `KSamplerSelect` | `euler` |
| `QwenImage21Cache` | `device = auto`，`dtype = default` |

<mark class="caution">保留完整 ManualSigmas 数列</mark>；九个水平（含末尾 0）定义 Turbo 八步，不能只用普通 KSampler 填“8 步”：

```text
1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0
```

官方 Turbo 模型采用 8 步、CFG 1；本课保留其模板的采样设置。[Turbo 模型与采样说明](https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo#sampling)

</details>

## 5 · 生成第一张图片

在 `TextEncodeQwenImage21`／Text Encode Qwen Image 2.1 节点的 **prompt** 中填入：

```text
一张方形插画。清晨的竹林里有一间小木屋，门前放着一张木桌，桌上是一杯热茶。
温暖的阳光从左侧穿过竹叶，绿色与米白色为主，画面安静，构图简洁，没有文字。
```

负面提示词 `negative_prompt` 留空。该节点的 `resolution` 用于参考图片缩放，本课没有输入参考图片；**生成图片的宽高改在 `EmptyLatentImage` 节点里**。[节点定义](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy_extras/nodes_qwen.py)

点 **Run／运行** 或 `Ctrl + Enter` 一次；看终端加载/采样进度和任务管理器内存，等待完成，不连续提交。

生成结束后，保存节点会显示图片。在文件资源管理器打开：

```text
C:\AI\ComfyUI_windows_portable\ComfyUI\output\
```

找到以 `yuuki_qwen_first` 开头的 PNG，双击确认能打开。**看到实际 PNG，才完成这一课的首次出图。**

接着做两次小实验，每次只改一项：

1. 保持 512×512 和 seed 42，只把「清晨」改成「傍晚」，观察光线与颜色。
2. 成功后把宽高改为 **1024×1024**，仍然一次一张。512 是排查环境用的小图，1024 更适合继续观察画面细节；显存不足就退回 512。

**Export／导出** 保存普通 JSON，`Export (API)` 供程序调用，`Save／Save As` 留在 ComfyUI 内。下次启动同一 `.bat` 后加载 JSON，无需重下模型。[保存与导出命令](https://github.com/Comfy-Org/ComfyUI_frontend/blob/v1.57.4/src/composables/useCoreCommands.ts)

## 6 · 出错时按现象处理

| 现象 | 先检查什么 | 下一步 |
| --- | --- | --- |
| 浏览器无法打开 `127.0.0.1:8188` | 启动终端是否还开着，是否打印了地址 | 重新启动 `run_nvidia_gpu.bat`；有报错先读终端最后一段 |
| 模型下拉框没有文件，或 `Value not in list` | 三个目录、完整文件名、下载是否结束 | 放回正确目录后重启；重新选下拉框中的文件 |
| 节点标红或 `Unknown node` | 是否仍在用较旧的 ComfyUI | 本课没有额外节点包；先通过 `update\update_comfyui_stable.bat` 更新并重启，保留启动时的导入错误 |
| CUDA 不可用，或 `no kernel image is available` | 驱动、NVIDIA 便携包，以及上面的 GPU 检查 | 更新驱动，确认没有使用旧 `cu126` 包或其他 Python 环境 |
| `CUDA out of memory` | 是否已改成 1024／更高分辨率，是否有其他 GPU 程序 | 退回 512、batch 1，关闭其他 GPU 程序并重启 ComfyUI |
| 内存不足、`WinError 1455`、系统长时间大量读盘 | 系统内存「已提交」、分页文件和磁盘空间 | 关闭大型程序，检查分页文件与剩余空间；持续换页时暂停运行，记录占用再决定是否增加内存 |
| 只有噪点、黑图或异常画面 | 是否混用了基础版／Turbo，是否改了采样数列或 VAE | 重新导入本课 JSON，核对三份文件，恢复官方 Turbo 时间表 |

仍缺显存时，**先关原服务**，再预留显存、关闭缓存重试；可能增加重算或 CPU 卸载，不保证提速或解决：

```powershell
Set-Location 'C:\AI\ComfyUI_windows_portable'
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --reserve-vram 2 --cache-none
```

要恢复默认方式，停止该终端中的服务，再双击原来的 `run_nvidia_gpu.bat`。参数含义见 [ComfyUI 启动参数](https://github.com/Comfy-Org/ComfyUI/blob/v0.43.0/comfy/cli_args.py)。

<div class="heading-alias" id="7--留下这次实验的结果" aria-hidden="true"></div>

## 7 · 保存实验结果

保存 PNG 和工作流后，记下实际观察到的数值：

```text
ComfyUI 版本：
分辨率：512×512 / 1024×1024
首次完成耗时：
只修改提示词后的完成耗时：
任务管理器观察到的专用 GPU 内存 / 系统内存占用：
图片保存位置：
是否发生换页、报错或重试：
```

**不要把未改变任何输入时的缓存命中当作生成速度。** 比较耗时时，改提示词或 seed，并保持分辨率一致；首次加载和后续生成分开记录。

已核对模型、节点、采样与 JSON 静态连接；**未在 Windows 目标环境实测，不保证耗时或峰值内存**。失败时保留报错、工作流和记录。

选修：[用 ACE-Step 1.5 Turbo 生成配乐 →](02-ace-step-music.md)

[返回 Windows 本地 AI 专题](README.md)。
