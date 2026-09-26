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
