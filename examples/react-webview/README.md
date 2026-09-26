# React + WKWebView Agent 工作台

Swift/AppKit 管理窗口，ReactDOM 在系统 WKWebView 中绘制。Agent 循环运行在独立 `AgentRuntime.app`；原生语音交给共享 `NativeCapabilities.app`。运行时不携带 Node 或 Chromium，但 WebKit 仍有系统内容/GPU 等进程。

工作台包含会话创建/选择、任务发送/取消、流式对话与工具记录、设置、审批、导出、Apple/Whisper 语音和“用作草稿”。「回放与更新」单独保留原始性能负载与清单检查。

## 构建与打开

Apple Silicon、macOS 14+、Command Line Tools，Node 22+ 和 pnpm 11 仅用于构建：

```bash
bash examples/react-webview/build.sh
open examples/react-webview/build/YuukiReactWebView.app
```

脚本构建 runtime/helper、编译 Swift 并手工打包、ad-hoc 签名；无需完整 Xcode。没有 Developer ID、公证、安装器和正式分发验证。使用步骤见[共同工作台说明](../shared/web/README.md)。

API Key 使用未受控 password 字段，提交后立即清空，不进入 React state/localStorage。它作为一次消息经过 Swift，交给 runtime 保存 Keychain；runtime 只返回 `hasAPIKey`。当前密码在输入期间仍位于 Web 内容进程的 DOM 内，不能宣称完全不接触 Web 进程。

## 实际路径与边界

```text
Swift NSWindow → 系统 WKWebView / ReactDOM
  → fixed script-message bridge
  → AgentRuntime JSONL / NativeCapabilities JSONL
  → state/delta 或语音结果 → ReactDOM
```

日常 React UI 更新与回放 timer 留在 Web 内容进程，不像 React→AppKit 路线那样传输整棵 UI 树；Agent 文本则来自独立 runtime。WKWebView 与 Electron 共用工作台组件，但保留不同宿主与 IPC 路径。

- 只加载包内 `Resources/web/index.html`；读取目录限定为 `Resources/web`。
- navigation delegate 只允许本地主页面，取消其他导航和新窗口。
- CSP 禁止网络连接、远程脚本、frame 和表单提交。模型网络访问由 runtime 执行，不由网页 fetch。
- 原生消息校验主 frame、入口 URL、JSON 类型和长度；仅允许 ready、受限 Agent 命令、语音开始/停止/取消与更新检查。Agent 客户端进一步校验 op、字段、类型与大小。
- 结果以 `callAsyncJavaScript` 参数传入，不把转录或模型内容拼进 JavaScript 源码。聊天内容以纯文本显示。
- 没有直接 shell 或任意文件读取桥。用户保存的工作目录和 Whisper 可执行路径由 runtime/helper 实施相应规则；这不等于第三方插件沙箱。宿主未启用 App Sandbox。

## 可以亲自观察的取舍

| 收益 | 对应代价 |
|---|---|
| 复用 ReactDOM/CSS 与 Web 工具 | 输入、焦点、选择和滚动仍是网页行为，需要协调原生窗口 |
| 复用系统 WebKit，包中不携带浏览器 | WebKit 多进程和布局成本仍存在，且系统版本会改变行为 |
| React 状态更新不需要完整树跨 Swift | Agent/原生能力仍需桥 schema、错误及生命周期管理 |
| 回放只挂载约 35 个固定高度行 | 可变高度 Markdown、完整无障碍列表等尚未实现 |
| 复用独立 runtime 的会话与恢复 | Web 内容进程重载仍会丢失未发送草稿；重新 bootstrap 可恢复已持久化会话 |

对话区目前展示完整纯文本消息，没有把长期聊天做成分页虚拟化；会话很长时，DOM、文本布局和 runtime 状态体积仍有成本。这与原有固定高度回放列表是两个不同负载，不能拿一个的性能代表另一个。

源文件：[WKWebView 宿主](src/Host.swift)、[启动适配](src/main.jsx)、[共同 React UI](../shared/web/src/workbench-view.jsx)、[共同 runtime 客户端](../shared/web/AgentRuntimeClient.swift)。`isInspectable` 为本地学习开启，发布时应重新决定。

## 语音与更新边界

Whisper CLI/模型使用设置中的已有绝对路径；应用不会下载。可填写音频文件，留空则主动点击后请求麦克风。Whisper stop 继续本地推理，不套用两秒硬杀；cancel/退出会取消。结果需要显式“用作任务草稿”，不会自动发送模型。权限、设备端语言、CLI 兼容性未实测。

更新只读取清单，支持 `YUUKI_UPDATE_FIXTURE=available|current|invalid` 固定映射，例如：

```bash
YUUKI_UPDATE_FIXTURE=invalid examples/react-webview/build/YuukiReactWebView.app/Contents/MacOS/YuukiReactWebView
```

没有下载安装、签名校验或回滚。本轮没有运行测试、GUI、computer-use、模型请求、模型下载或真实语音。编译和总构建记录见[总入口](../README.md)，不代表完整交互和性能实测。
