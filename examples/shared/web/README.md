# React 工作台共同实现

此目录为 React→AppKit、React+WKWebView、Electron 提供相同的 Agent 状态模型。WKWebView 与 Electron 还复用同一份 ReactDOM 工作台界面。三条路线仍保留各自的渲染、进程和能力桥实现；Electron 的回放计时仍发生在主进程并经过 IPC。

## 从设置到一次任务

1. 打开对应 `.app`，进入「设置」，填写 API Base、模型、API Key 和允许工具操作的工作目录。输出 token 和最大工具轮数用于限制一次运行。点击保存。
2. 进入「Agent 工作台」，新建或选择会话，输入任务并发送。助手文字增量、工具调用结果、运行状态和用量显示在会话中；取消按钮中断当前运行。
3. runtime 发出授权请求时，界面显示工具、路径与预览，必须由你点击允许或拒绝。界面不会自动批准。
4. 「导出 Markdown」由 runtime 写出文件，界面显示真实返回路径。重开应用时，会话由 runtime 读取；此前中断的状态由 runtime 负责恢复为可解释状态。
5. 「回放与更新」保留原来的 1k/10k 固定负载和本地更新清单。它不调用模型，也不下载安装更新。

程序本身会在你发送 Agent 任务后访问所配置的模型服务。本轮实现过程没有发送任何真实 API 请求。完整运行语义、工具范围、存储及 Keychain 行为以 [`../runtime/PROTOCOL.md`](../runtime/PROTOCOL.md) 和 runtime 源码为准；UI 不实现第二套 Agent 循环。

## 凭据与边界

- React→AppKit 的 API Key 留在 `NSSecureTextField`。Swift 在保存时直接附加到 runtime 命令并清空控件，密钥不经过 Node/React 的 view tree。
- WKWebView/Electron 使用未受控 `type=password` 字段。值仅在保存回调中提交并立即清空；不写 React state、localStorage、会话或日志。字段在页面存在期间仍是 UI 进程内的敏感内存，不能宣称从未进入 Web 内容进程。
- runtime 负责 macOS Keychain，UI 只接收 `hasAPIKey`。不回显已保存的 key。清除凭据为独立按钮。
- Swift `AgentRuntimeClient` 与 Electron `runtime-client.cjs` 均固定启动打包的 runtime，校验操作名、字段集合、类型和大小；没有通用 shell 通道。API key 不在 argv，runtime stderr 不转发到界面日志。
- 设置中的 workspace、API Base、Whisper CLI/模型路径由用户明确配置。工具执行限制、路径授权与发布安全仍由 runtime/helper 实现，UI allowlist 本身不是完整沙箱。

## Apple Speech 与 Whisper

在设置中选 `apple` 或 `whisper` 并保存。Whisper 需要填写你已有的 whisper-cli 与模型绝对路径，应用不自动安装或下载。语音区域可填写已有音频文件路径；留空则点击开始后使用麦克风。

Whisper 麦克风模式点击「停止录音并转写」后继续进行本地推理，宿主不会套用旧版两秒硬杀期限。「取消识别」发送 `cancel`，关闭应用也取消语音。Apple 和 Whisper 都通过共享 helper 的 JSONL 协议回传结果。请在完成后点击「用作任务草稿」，检查文字，再自行发送；识别结果绝不自动提交模型。

语音参数取自 runtime 确认的已保存设置，尚未保存的表单值不生效。TCC 归属、签名、设备端语言能力和实际 Whisper CLI 兼容性仍需要在用户设备上操作验证。详见 [`../native/README.md`](../native/README.md)。

## 文件归属

| 文件 | 职责 |
|---|---|
| `src/agent-model.mjs` | runtime state/delta、任务草稿、设置草稿、审批、语音结果；不持久保存 key |
| `src/workbench-view.jsx` | WKWebView/Electron 共用 Agent、设置与语音界面 |
| `src/model.mjs` | 原本的固定负载回放和更新清单校验 |
| `AgentRuntimeClient.swift` | 两个 Swift 宿主的受限 JSONL 客户端 |
| `NativeHostSupport.swift` | Swift 宿主更新清单及语音 helper 管理 |
| `build.mjs` | Node reconciler 与 WebKit ReactDOM bundle |
| `package-app.sh` | 构建/复制 runtime 与语音 helper，编译宿主并签名 |

React / ReactDOM 18.3.1、react-reconciler 0.29.2 是配对的 renderer API；esbuild 0.28.2。Electron 打包时明确把 React/ReactDOM 指向它自己的单一安装，避免跨目录共享组件意外打入两套 React。

构建脚本共用 assets 和 helper 目录，应按顺序运行。本轮只编译源码；最终 `.app` 由总构建统一打包。没有运行测试、computer-use、GUI、模型 API 请求、模型下载、真实语音或权限弹窗。源码与编译结果不能替代实际会话、TCC、网络兼容性和性能验证。

## 路线专属场景插槽

`mountWorkbench({ Scenes: Component, ... })` 可选择提供独立场景组件；提供时出现「场景实验」导航，mode 为 `scenes`。未提供时原有 Agent/设置/回放入口不变。WKWebView 和 Electron 可以分别传入自己的实验，不把不同 transport 或线程模型揉成同一实现；原生桥则由自己的 reconciler UI 实现场景。

WK 的 Worker 源码由本目录 build.mjs 预先编译，再作为固定源码字符串打入 Web bundle，并保留本地 `lab-worker.js` 资源。只为该路线的本地 Blob Worker 增加 CSP `worker-src blob:`；不开放网页网络连接或任意代码入口。实验具体预设、实现函数和未测量边界见各路线 README。
