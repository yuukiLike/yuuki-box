# React → AppKit Agent 工作台

真实 React custom reconciler 运行在 Node 子进程中，生成结构化 UI 树，经 JSONL 交给 Swift/AppKit。按钮、文本框、密码框、选择器、可编辑多行文本、对话输出和列表最终都是 AppKit 控件；没有 WebView、HTML 或 DOM。

现在包含可以接入真实模型的工作台：会话创建/选择、任务与取消、流式助手输出和工具结果、授权允许/拒绝、设置与 Keychain 凭据提交、Markdown 导出、Apple/Whisper 语音及“用作草稿”。独立的「回放与更新」页面保留原来的性能学习负载。

## 构建与打开

Apple Silicon、macOS 14+、Command Line Tools、Node 22+、pnpm 11：

```bash
bash examples/react-native-bridge/build.sh
open examples/react-native-bridge/build/YuukiReactNative.app
```

脚本编译并打包 `AgentRuntime.app`、`NativeCapabilities.app`、Node 可执行文件和宿主，完成本机 ad-hoc 签名。Node 从 Finder 启动不依赖 PATH；使用其他 Node 发行包时，仍需检查其外部动态库。此包没有 Developer ID、公证、安装器或正式分发验证。

请按[共同工作台说明](../shared/web/README.md)配置模型、工作目录和语音。凭据输入只驻留原生 `NSSecureTextField`；Swift 在保存时直接发送到 runtime，随即清空，不进入 Node/React 树。Node 和语音 helper 不继承 `DEEPSEEK_API_KEY`；runtime 保留其自身支持的环境凭据入口。

## 实际路径

```text
AppKit 操作 → Swift → Node stdin action
  → React callback / state / reconciler
  → JSONL 完整 UI 树 → Swift 控件更新

Agent 操作 → Node → Swift allowlist → 独立 AgentRuntime
  → state / delta / error / export → Swift → Node → AppKit

语音 → Swift → NativeCapabilities → Apple Speech / Whisper CLI
  → 识别结果 → 用户点击“用作任务草稿”
```

会话及运行循环在 runtime 中持久化与管理；原有性能回放状态仍仅在内存中。runtime 与 Node 是两个独立常驻进程，语音 helper 按需启动。它们不应被合并成“一个原生进程”的性能统计。

## 需要亲自感受的优点和代价

| 收益 | 对应成本 |
|---|---|
| 真正的 AppKit 输入、选择、按钮与列表 | 自维护 host vocabulary、props、消息协议、控件映射和反向事件 |
| React 组件与共同 Agent 模型 | Node/Swift/runtime 多条生命周期和错误路径 |
| 稳定 ID 保留控件、NSTableView 复用可见行 | 每次提交仍发送完整 UI 树；对话增长后有字符串复制与 JSON 成本 |
| UI 树与能力调用边界清楚 | 增加复杂控件仍需要跨 React/Swift 两侧修改 |
| 原生密码框不把 key 传进 Node | 其余任务和对话内容仍会跨 Node/Swift 通道 |

桥接背压时仅保留最新待发送渲染快照，避免无限堆积。这个优化不会省去 React 提交和完整序列化。非回放模式不再传输那 10k 条历史列表。底部 JSON 大小和解码/更新耗时不是 FPS，也不包括屏幕实际绘制。

当前 renderer 面向固定结构和稳定 ID，支持显隐与已有控件更新；不是通用 UI 框架，不提供任意插件、完整动态重排、复杂富文本、Markdown 编辑器或扩展沙箱。对话使用可滚动的原生纯文本框，避免把未经处理的模型输出当 HTML。

阅读入口：[React renderer 与 UI](src/main.jsx)、[AppKit 宿主](src/Host.swift)、[共同 runtime 客户端](../shared/web/AgentRuntimeClient.swift)。

## 保留的回放与更新

1,000/10,000 条历史，每 50 ms 追加一条、最多 200 条，上限 10,200。支持全部/工具与搜索。更新仅校验包内清单，不下载、不安装。退出应用后可选择异常案例：

```bash
YUUKI_UPDATE_FIXTURE=current examples/react-native-bridge/build/YuukiReactNative.app/Contents/MacOS/YuukiReactNative
YUUKI_UPDATE_FIXTURE=invalid examples/react-native-bridge/build/YuukiReactNative.app/Contents/MacOS/YuukiReactNative
```

只允许 `available/current/invalid` 固定文件映射，未知值显示错误。语音优先从 Finder 打开 `.app`，避免将终端 TCC 身份误认为最终分发行为。

本轮没有运行测试、GUI、computer-use、模型请求、Whisper 下载、语音或安装更新。完成的编译和总构建记录见[总入口](../README.md)，界面、网络、权限与性能仍未实测。

## 三个 Harness 场景实验

进入「场景实验」，选择场景与朴素/优化路径，再点击运行。每项均有停止、重置和可编辑探针；输入来自固定本地生成器，不调用模型、语音或工作区工具。它们是可阅读、可修改的局部实验，不能直接作为真实 Agent 总体性能结论。

| 场景 | 相同输入与上限 | 朴素路径 | 优化路径 | 实际显示的证据 |
|---|---|---|---|---|
| N1 文本流与桥协议 | 1,200 条静态历史 + 180 个文本增量；每 16ms 提供一个增量 | 每次 React commit 编码并发送完整 UI 树 | 稳定结构下按 ID 发送真正的属性 patch；Swift 只应用变化节点，结构变化回退完整树 | 实际 JSON 字节、React commits、发包次数、diff/编码时间、解码/应用时间、控件应用次数 |
| N2 工具进度风暴 | 24 个工具 × 20 次进度，共 480 事件；每 16ms 一批 12 个输入事件 | 每个事件都发布 React 状态并经桥更新 | 仍处理全部事件，按约 16ms 的显示批次发布；完成/取消立即刷新最后 canonical 状态 | 收到事件数、模型发布数、实际提交/发包、背压合并次数、终态与各工具最终进度 |
| N3 动态审批表单 | 60 次工具状态更新，每 80ms 一次；同一标题、决定字段 | 每次更新真实移除并重建三个表单控件 | 以稳定 ID 保留原生控件，并只在值变化时设置文本 | 真实创建/移除/应用次数、当前原生焦点 ID 和文本选区；模型保留的草稿与选择 |

计时器表示相同的模拟事件到达节奏，不是为了制造慢路径插入的 busy loop 或额外等待。N2 的 16ms 批次也不等于显示器帧同步。终态、取消、最后内容不会因为合批而丢失。传输出现 stdout 背压时，两路径都保留最新待发送状态；patch 必须相对**最后实际写入的树**计算，不能相对被合并丢弃的中间树。

N3 没有故意吞键、清空模型草稿或伪造焦点数据。朴素路径真实销毁 AppKit 对象，因此输入焦点、选区和菜单展开状态可能受到生命周期影响；优化路径保留这些对象。可以在工具更新期间修改标题、选择部分文本、切换决定，观察该差异。

### 对照源码与维护成本

| 入口 | 要理解和维护的内容 |
|---|---|
| [`src/scene-model.mjs`](src/scene-model.mjs) 的 `createNativeScenes` | 确定性事件源、canonical 状态、逐条/合批发布、停止与终态 flush |
| [`src/bridge-transport.mjs`](src/bridge-transport.mjs) 的 `commit` / `transmit` | 快照与 patch、稳定结构判断、基线、序号、背压与实际编码 |
| [`src/main.jsx`](src/main.jsx) 的 `commitTree` / `scene-pane` | 场景选择、真实 renderer 提交、组件 ID 与表单属性 |
| [`src/Host.swift`](src/Host.swift) 的 `receive` / `applyChildren` / `removeChildren` | Swift patch 解码、节点缓存、局部应用、控件映射、朴素销毁和计数 |

patch 减少传输与控件应用，却增加双方协议、节点缓存和基线的一致性责任；目前只处理稳定结构的属性变化，结构不一致就发送完整树。工具合批增加缓冲、取消和最后状态处理。保留控件改善生命周期连续性，但必须维护稳定身份、值同步和真正需要销毁的条件。增加控件时，React vocabulary、协议和 Swift 映射都要一起考虑。

页脚是**代理指标，不是 FPS**。编码时间包含 diff 与核心 JSON 序列化，不包含小型统计信封；字节数由 Swift 对收到的完整行实际计数。解码/应用时间包含宿主处理与布局请求，不等于屏幕呈现。创建/应用/移除分别计数，应用次数也不等于发生了像素重绘。探针不自动推算输入延迟。

本次仅完成源码与编译，没有运行这些场景、性能采样、测试或 computer-use。最终 `.app` 由总构建顺序生成，不能将未运行场景的默认数值当成测量结果。
