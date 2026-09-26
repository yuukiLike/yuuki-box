# 共同 Agent、语音与实验输入

五条 UI 路线共用一个 Swift Agent runtime、一份 Apple/Whisper helper 和固定 Lab 数据。业务能力一致，渲染、消息桥与进程分工仍各自实现。

## Agent runtime

[runtime/README.md](runtime/README.md) 说明模型/工具循环、设置、Keychain、会话、审批、用量、取消、持久化与导出；[PROTOCOL.md](runtime/PROTOCOL.md) 是宿主使用的 JSONL 契约。

默认模型为 DeepSeek `deepseek-flash`，关闭 thinking。API Base、模型、输出/轮数限制和工作目录可在 UI 配置。设置与 Keychain 凭据五路线共享，会话按 `swift/gpui/react-native/webview/electron` 隔离。runtime 不依赖任何 UI 框架，每条路线启动自己的固定 runtime 子进程。

工作目录为空时可聊天；配置已有绝对目录后可列目录、读文本和请求新建笔记。写入必须通过界面允许/拒绝，不覆盖已有文件。读取的文本会作为工具结果发给配置的模型服务。工具边界是应用层策略，没有实现通用 shell 或完整 OS 沙箱。

API Key 由 runtime 保存 Keychain，不进设置 JSON、会话或事件回显。模型网络请求由 runtime 执行；UI 渲染路径不直接承担供应商协议。更多背景见 [AI 与语音基础](../../docs/architecture/ai-and-speech-foundation.md)。

## Apple / Whisper helper

[native/README.md](native/README.md) 记录两种真实后端、JSONL、停止/取消、音频文件与退出清理。

- Apple：Speech / AVFoundation，默认 `zh-CN` 且要求设备端识别，可返回部分文本。
- Whisper：用户配置已有 whisper-cli 与模型绝对路径；麦克风模式先录音、stop 后转写，文件模式跳过录音。宿主不会在 stop 后用旧两秒期限杀死推理；明确 cancel、EOF 或退出负责取消。
- 两种后端的结果都先作为转写文本。用户明确采用后进入任务草稿，再点击发送才调用模型。

App 打包 helper 并声明用途；不会在启动时自动录音或下载模型。授权归属、系统语言能力、CLI/模型兼容性仍需设备上的实际操作。本轮没有执行这些识别与权限流程。

## Lab 事件 fixture

`fixtures/events.json` 是 100 条固定记录：整数 `id`、`kind` 为 `message` 或 `tool`、UTF-8 `text`，包含中英文和 emoji。各路线循环生成 1,000 / 10,000 条具有独立 ID 的历史；回放每 50 ms 追加一条、最多 200 条，总历史上限 10,200。

**只有这份 Lab 回放是确定性的模拟负载。** 它与实际 Agent 任务、会话、工具和存储分开，不应再把整个应用描述成“没有模型调用”的展示样例。

## 更新 fixture

| 场景 | 文件 | 语义 |
|---|---|---|
| available | `fixtures/update.json` | 清单 0.2.0 高于应用 0.1.0 |
| current | `fixtures/update-current.json` | 与应用版本相同 |
| invalid | `fixtures/update-invalid.json` | 非法版本与 URL，应拒绝 |

共同字段是 `schemaVersion/version/notes/url`。示例以三段数字版本作共同输入；跨实现的所有异常语义尚未测试。`example.com` 是占位链接，清单不含可执行包，也不提供实际安装机制。

## React 共享范围

[web/README.md](web/README.md) 说明三条 React 路线共用的 `agent-model.mjs`。WKWebView 与 Electron 还共用 `workbench-view.jsx`，但 transport 不同：WK 使用 script message → Swift，Electron 使用 preload IPC → Node main。React→AppKit 仍以 custom reconciler 生成原生控件树。

WKWebView 运行包没有 Node；Electron 携带 Node/Chromium。Lab 回放也保留差异：WK timer 在 Web 内容进程，Electron timer 在主进程并逐条 IPC，原生桥则经 Node → JSON UI 树。共用界面并不意味着进程和数据成本相同。

多个构建脚本会写共享 helper、runtime 和 React 中间文件，应顺序执行。当前源码已编译，最新全套 `.app` 的统一打包仍待完成；本轮没有运行测试、GUI、真实 API、音频或模型下载。
