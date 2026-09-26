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

## 三个 Harness 场景实验

进入「场景实验」，选择 W1/W2/W3 与朴素/优化路径。每项都有运行、停止、重置，以及工作期间可继续编辑的输入探针。数据由本地确定性代码生成，不读取工作区，不调用模型、麦克风或网络。最终内容/结果可对照，指标全部来自实际代码路径，未预填“优化倍数”。

| 场景 | 预设与上限 | 朴素路径 | 优化路径 | 观察项 |
|---|---|---|---|---|
| W1 长日志 | 16,000 条历史 + 120 次追加，每 16ms 一次；固定 36px 行高 | 为全部记录创建 DOM 卡片 | 只创建可见区域及缓冲，最多约 30 张卡片，保留完整滚动高度 | 数据量、通过 DOM 查询取得的实际挂载卡片数、相同最终记录 |
| W2 流式解析 | 100 条完成消息 + 160 个相同增量，每 16ms 一次 | 每次重新运行块解析器处理整段会话 | 完成消息解析一次并缓存；活动文本先直接显示，完成/取消时解析一次 | 真正的 parse 调用数、累计解析字符、解析函数耗时、相同结束内容与格式 |
| W3 搜索与输出准备 | 24,000 条 JSON 日志；每次查询处理同一数据；展示前 60 条，统计完整匹配 | 在 Web 内容主线程同步 JSON 解析、过滤、构建结果 | 同一函数在本地 WebWorker 处理；每 300 行让出一次调度以接收取消/新 generation | 实际扫描/匹配、匹配 ID 和、请求/取消/丢弃旧结果数、计算耗时与返回耗时 |

W1/W2 的计时器仅规定双方相同的事件到达节奏。没有插入忙等或人为重复空循环。首次全量 DOM 提交、主线程同步搜索等同步工作无法在中间响应取消；停止只能取消后续工作，这个限制是朴素路径本身的一部分。

W2 使用真正的小型块解析器，支持标题、列表项、代码块与普通段落，产物经 React 文本节点渲染；没有 innerHTML，也不宣称完整 Markdown。优化路径的活动内容在流式期间是纯文本，结束后才格式化，缓存有内存与失效责任。

W3 运行后修改搜索词会创建新 generation。Worker 在处理块之间接收新查询和取消；旧结果不覆盖当前结果。明确取消可保留已经扫描部分的结果，并标为 `cancelled (partial)`；如果完成结果已先发出但用户随后取消，该旧结果会被拒绝。切换场景/模式会 terminate worker、清理定时器并释放 Blob URL。它不把主线程同步计算冒充可中途取消。

### Worker 来源与源码入口

Worker 源码由本机 esbuild 构建成 `lab-worker.js`，也以字符串包含进应用 bundle。UI 从该**固定打包源码**创建 Blob Worker；这样不依赖 WKWebView 的 file URL Worker 加载行为。CSP 只增加 `worker-src blob:`，仍禁止网络连接、远程脚本和外部导航。没有接受用户提供的 Worker 代码或 URL。

| 文件 / 函数 | 维护职责 |
|---|---|
| [`src/scenes.jsx`](src/scenes.jsx)：`DOMLogs` | 全量卡片与固定窗口、实际 DOM 计数、滚动与取消 |
| 同文件：`StreamingParse` | 完成块缓存、活动消息、解析指标与终态 |
| 同文件：`WorkerSearch` | Worker 生命周期、generation、结果/取消消息、错误与清理 |
| [`src/lab-workload.mjs`](src/lab-workload.mjs) | 相同数据生成器、实际块解析器、main/worker 共用搜索函数 |
| [`src/lab-worker.js`](src/lab-worker.js) | 分块计算、让出调度、取消和带 generation 的响应 |
| [`../shared/web/build.mjs`](../shared/web/build.mjs) | Worker 单独编译、源码字符串打包、CSP；最终 app 带相同本地资源 |

虚拟列表需要固定行高与滚动定位；消息缓存需要内容变化时失效；Worker 增加数据克隆、线程调度、消息协议和取消一致性成本。它们各自解决不同工作，不能只加一个“优化”标签或据此给整个技术栈打分。

挂载数量与 parse 次数是代理指标，**不是 FPS**。W3 的计算时间不含所有传输和等待，端到端返回时间也不包含屏幕实际呈现。不同显示、输入、缓存与设备条件会改变结果；探针只是供你亲自输入观察，不伪造输入延迟。

本次仅编译，没有运行场景、测试、GUI、computer-use 或性能采样。最终打包由总构建顺序完成。真正 Agent 任务仍走共享 runtime；这些局部实验不代表网络、工具或完整 Harness 的端到端性能。
