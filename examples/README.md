# 五条桌面技术路线：小型 Agent 工作台

日期：2026-09-26。目标平台：当前 Apple Silicon Mac。这里用五种真实 UI 路线接入同一个自建 Swift Agent runtime，让你亲手接触 Swift、Rust/GPUI、React 原生桥、系统 WebKit 和 Electron，再决定自己的工作台如何实现。

五个应用现在都有模型调用、任务与取消、会话、流式输出、工作区工具、写入审批、设置、语音草稿和 Markdown 导出的实际调用路径。模型默认接 DeepSeek `deepseek-flash`，关闭 thinking，可在设置中更改。**Rust/GPUI 是正式实现的路线；这次共用 Swift Harness，比较的是 UI 与集成方式，还不是 Rust Harness 与 Swift Harness 的对照。**

原来的固定事件回放保留在独立 Lab/回放区域，便于观察界面负载；它与真实 Agent 任务分开。详细基础见 [AI 与语音架构](../docs/architecture/ai-and-speech-foundation.md) 和 [Agent runtime](shared/runtime/README.md)。

独立的 TypeScript MCP 实验：[项目接续记录](../docs/ai-from-scaling/00-minimal-mcp.md)、[Blender 建模](blender-mcp/README.md)、[GitHub 实验员](github-lab-mcp/README.md)。GitHub 实验把公开修复拆成复现、候选修改与官方对照，并保存运行证据。

[音乐空间 MCP](music-space-mcp/README.md) 对应课程末章的两个选修案例：可环绕观察并导出 GLB 的 MIDI 声部之结与分层光之剧场，可交互、保存配置并导出带声音的 MP4。

新增「场景实验」：**每条路线三个 Harness 场景，共十五个，每个都能切换朴素 / 优化实际实现。** 覆盖历史重复解析、长列表、主线程计算、桥接流量、原生控件身份、取消和控制响应。它们使用有界的本地数据，不需要 key 或模型；指标在你主动运行后产生。操作与源码阅读见[完整场景手册](../docs/learning/harness-scenario-lab.md)，具体负载和计量边界见各路线 README。场景实现针对不同架构边界，不能直接用跨路线的毫秒排框架名次。

## 选一条开始

| 路线与说明 | 实际界面路径 | 构建命令（仓库根目录） |
|---|---|---|
| [Swift 原生](swift-native/README.md) | SwiftUI + AppKit | `bash examples/swift-native/build.sh` |
| [Rust + GPUI](rust-gpui/README.md) | Rust 元素树 + GPUI / Metal | `bash examples/rust-gpui/build.sh` |
| [React → AppKit](react-native-bridge/README.md) | Node React custom renderer → JSONL → AppKit 控件 | `bash examples/react-native-bridge/build.sh` |
| [React + WKWebView](react-webview/README.md) | Swift 窗口 + 系统 WebKit / ReactDOM | `bash examples/react-webview/build.sh` |
| [Electron + React](electron/README.md) | 随包 Chromium / ReactDOM + preload / Node main | `bash examples/electron/build.sh` |

构建脚本会处理共享 `AgentRuntime.app` 和语音 `NativeCapabilities.app`。按顺序构建全部：

```bash
bash examples/build-all.sh
```

脚本安装声明的依赖并生成本地应用，不启动窗口、不运行任务、不录音、不运行测试。多个路线共享构建目录，应顺序执行。GPUI 默认 dev/debug；后续做性能比较应使用 `bash examples/rust-gpui/build.sh --release` 或 `PROFILE=release bash examples/build-all.sh`。debug 产物不能直接与 Swift 优化构建排名。

## 先完成一次 Agent 任务

1. 构建后从 Finder 打开对应 `.app`，进入设置，填写 API Key 并保存。runtime 将其写入 macOS Keychain，UI 不回显已保存的明文。默认 API Base 为 `https://api.deepseek.com`，模型为 `deepseek-flash`，非 thinking 模式。
2. 不填工作目录也可聊天。要体验工具，填写一个已经存在的绝对目录，先放入普通 `.txt` / `.md` 文件。工具读取的内容会作为结果发给你配置的模型服务。
3. 新建或选择会话，输入例如“列出目录中的文件，读取 README.md 并概括”。观察助手增量、工具结果、用量和结束状态；需要时取消。
4. 如果模型提出新建笔记，检查界面展示的目标路径与内容，选择允许或拒绝。`write_note` 只新建文件，不覆盖已有文件；没有通用 shell 或任意文件修改能力。
5. 会话由 runtime 自动保存。导出功能生成 Markdown 并显示实际路径。重开应用后可以选择已保存会话；中断任务不会被自动重放。

五条路线共享设置与 Keychain 凭据，会话按路线隔离。另一个已经打开的应用需要重新 bootstrap 或重新打开才能读取其他窗口保存的新设置。任务轮数、上下文、工具范围、存储与恢复边界见 [runtime 说明](shared/runtime/README.md)。

## 配置 Apple Speech 或 Whisper

设置中的语音后端选择 `apple` 或 `whisper` 并保存。Apple 默认 `zh-CN` 且要求设备端识别；Whisper 需要你已有的 **whisper-cli 可执行文件**与**兼容的模型文件**，分别填写绝对路径。应用不会自动下载模型或安装 CLI。

在语音区填写音频文件路径可识别已有文件；留空时点击开始才采集麦克风。Whisper 先录音，点击停止后再本地转写，推理期间仍可以明确取消。它目前不是边说边出字的常驻推理引擎。Apple 可提供部分文本，两种后端都有最终结果和明确错误。

识别文字先进入转写区域。点击「用作任务」或采用草稿后，检查文字，再主动发送；音频不会直接作为聊天请求上传，转写结果也不会自动发送模型。宿主退出会取消识别并清理受控资源。CLI/模型格式、限制与 TCC 说明见 [语音 helper](shared/native/README.md) 和 [AI 与语音基础](../docs/architecture/ai-and-speech-foundation.md)。

## 独立的回放与更新实验

Lab/回放区域保留同一份固定 fixture：1,000 / 10,000 条历史、全部/工具筛选、每 50 ms 一条、单次最多 200 条、历史上限 10,200。这个负载不调用模型，方便将 UI 成本与网络等待分开观察。各界面的行高、布局和缓冲数量仍有差异，尚不是严格框架基准。

更新只实现清单解析、字段校验、版本比较和状态展示，包含可更新、当前版本与无效清单。Swift、GPUI 和两个 React 宿主使用 `YUUKI_UPDATE_FIXTURE=available|current|invalid`，Electron 有界面选择。占位链接是 `example.com`，不是真实分发源。下载、签名校验、安装替换、重启与回滚没有实现。

## 构建后的应用位置

| 路线 | 应用包 |
|---|---|
| Swift | [YuukiSwiftNative.app](swift-native/build/YuukiSwiftNative.app) |
| GPUI | [Yuuki GPUI.app](<rust-gpui/build/Yuuki GPUI.app>) |
| React 原生桥 | [YuukiReactNative.app](react-native-bridge/build/YuukiReactNative.app) |
| React WebView | [YuukiReactWebView.app](react-webview/build/YuukiReactWebView.app) |
| Electron | [latest-path.txt](electron/build/latest-path.txt) 记录最新时间戳 `.app` 路径 |

`build/` 产物不属于可移植源码。包使用本机架构和 ad-hoc 签名；Developer ID、公证、正式升级和跨系统分发没有完成。构建后可使用 `bash examples/open.sh swift`，参数也可为 `gpui`、`react-native`、`webview`、`electron`。本轮没有代为执行打开操作。

## 当前证据范围

**2026-09-26，包含十五个 Harness 场景的五路线顺序构建、打包与 ad-hoc 签名已经完成，`bash examples/build-all.sh` 退出码为 0。** Electron 最后收紧 Worker 退出/取消生命周期后，另执行 `node build.mjs` 成功重新打包。上表四个固定路径均已更新；Electron 最新包是 `YuukiElectron-20260926T033130241Z.app`，`latest-path.txt` 已指向它。更早的 Electron 时间戳包仍保留，可能包含旧功能。

按用户要求，本轮没有运行测试、computer-use、GUI、真实 API 请求、工作区任务、模型下载、录音或系统授权；也没有测 FPS、内存、启动或 Whisper 推理。早期 helper 的无权限检查不代表本次 Agent/Whisper 路径已通过验证。编译成功与完整交互通过是不同证据。

下一步阅读：[五路线收益与代价](COMPARISON.md) · [共同输入与能力](shared/README.md) · [AI 与语音基础](../docs/architecture/ai-and-speech-foundation.md) · [原调研](../docs/README.md)。
