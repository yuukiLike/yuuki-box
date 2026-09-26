# Yuuki Box：怎样搭配，下一步验证什么

本章是基于源码调查的**研究建议**，不把新技术选择写成已接受的架构决定。本次只增加调查文档与证据清单，没有修改应用代码。

相关：[调查入口](README.md) · [Rust 动机](01-why-rust.md) · [Zed 架构](02-zed-architecture.md) · [PI 实例](03-pi-desktop.md)。

## 1. 接着已有实现学习

本项目已经有[五条技术路线的 MVP](../../../examples/README.md)，包括 Rust + GPUI、Swift 原生、React 原生桥、WKWebView 和 Electron。GPUI 与 Rust 是现有实验中的正式路线。早期 docs 中的“Swift 起步”属于当时建议，不应被理解成排除 Rust 的已定决策。

当前 [GPUI 示例](../../../examples/rust-gpui/README.md) 使用发布版 `gpui = "=0.2.2"`、`runtime_shaders`、固定高度虚拟列表和 Swift 语音 helper。已有构建记录与未运行项写在示例 README；本轮没有重复构建或运行它。

最直接的后续行动是：**沿 GPUI 示例追清一次状态变化、一次后台工作和一次跨进程取消，再决定哪些职责抽成独立 Rust core。** 这既能学习 Rust，也能接上已经存在的代码。

## 2. 三种搭配，各自优化不同问题

| 路线 | 结构 | 适合验证什么 | 必须承担的成本 |
|---|---|---|---|
| Rust + GPUI 主体 | GPUI UI + Rust model/runtime；Apple 能力通过本地适配 | 共享类型和状态、细粒度刷新、后台快照与绘制路径 | GPUI 控件行为、输入法/可访问性、Rust UI 生命周期、平台能力接入 |
| React/Electron + Rust host | Web UI + Electron Main + Rust host；需要时接 Node Agent | 接近 PI 的分工，复用 Web 与供应商生态，独立宿主可用于 headless | 双语言、进程发布、RPC、取消/重启/事件顺序、浏览器运行时成本 |
| Swift UI + Rust core | SwiftUI/AppKit + Rust 领域能力；根据粒度选 FFI 或进程接口 | Apple 交互和系统能力，同时学习可移植核心 | 双语言模型、边界编码、构建/符号/线程规则、错误和资源所有权 |

这是选项比较，无法直接推导性能排名。Zed 的高频路径支持第一种思路；PI 的宿主职责支持第二种思路；本项目 Apple 设备目标使第三种也值得保留。

Rust core 的可移植性取决于具体依赖。纯类型和状态转换容易隔离；一旦依赖 GPUI Context、Electron IPC、macOS helper 或特定进程管理，就需要平台适配。当前示例没有 iPhone/iPad 版本，因此不承诺移动端 UI 或后台执行可以直接复用。

## 3. 从两个项目分别带走什么

| 需要解决的事 | Zed 可学的方式 | PI 可学的方式 | Yuuki 的最小落点 |
|---|---|---|---|
| UI 更新 | Entity、notify、typed event、增量映射 | React/store 接收结构化事件 | 活动消息更新不反复处理所有历史 |
| 后台工作 | snapshot + background executor + 前台应用结果 | 独立 Agent/host 进程，事件返回 | 结果携带 session/turn 身份，回写前检查是否仍适用 |
| 停止 | Task 所有权、取消信号、弱实体 | turnId、工具 abort、进程清理 | 停止显示、停止工具、结束 turn 各有明确含义 |
| 数据权威 | Project/BufferStore 等持有实体与版本 | Rust 管宿主状态，JSONL 正文 + SQLite 索引 | 每类持久数据指定一个写入者 |
| 故障恢复 | snapshot/operation 与应用服务边界 | outbox、幂等消息 ID、重启与恢复 | 区分已接收、已写盘、已完成 |
| 扩展/模型生态 | provider、Agent、扩展宿主各有接口 | pi-ai/Node 保留供应商支持 | 先用少量模型与工具，再按真实需求增加适配 |

上表不要求 Yuuki 首版复制完整 CRDT、远端配对、插件 SDK 或恢复系统。每项机制都应对应一个具体问题。特别是用户此前要求自建 model/tool loop；PI 对成熟 pi 的复用是参考选项，不代表已经获准替换这个产品方向。

## 4. 对“极简”的具体定义

极简 Agent 工作台可以有清楚的四个角色：

```text
UI：输入、展示、发取消意图
  ↓ 命令；↑ 结构化事件
会话控制：sessionId / turnId / 状态转换
  ├─ Agent loop：模型请求 → 工具请求 → 结果回填 → 停止判断
  └─ Host：工具执行、权限判定、持久化、进程资源
```

这是建议的责任图，不是当前 Yuuki 已实现的模块，也不要求四个进程。Rust + GPUI 路线可以先将这些角色作为同进程模块；采用 Node 生态时才增加必要的协议边界。当前 Apple Speech helper 已是一条真实跨进程接口，适合先学会管理这一条。

是否抽 crate，可以看是否需要被多个入口复用、是否需要独立测试、是否能明确列出不应依赖的 UI/平台类型。只为了模仿目录结构而拆几十个 crate，无法带来 Zed 的数据结构和生命周期设计。

## 5. 建议的源码阅读顺序

1. **自己的输入与 Render。** 看 [GPUI MVP main.rs](/Users/chp/explore/yuuki-box/examples/rust-gpui/src/main.rs:350) 和 `uniform_list`，确认状态、可见索引与 notify 的关系。
2. **自己的流任务。** 看 [start_ticker](/Users/chp/explore/yuuki-box/examples/rust-gpui/src/main.rs:145)，再对照 Zed [命令面板后台匹配](/Users/chp/explore/zed/crates/command_palette/src/command_palette.rs:580)。关注线程、Task 的持有者与取消。Zed main 与发布版 GPUI API 不能混用。
3. **自己的平台桥。** 看 [start_speech](/Users/chp/explore/yuuki-box/examples/rust-gpui/src/main.rs:246)、[stop_speech](/Users/chp/explore/yuuki-box/examples/rust-gpui/src/main.rs:285) 和 [Swift helper 协议](../../../examples/shared/native/README.md)。关注 stdout 分帧、EOF、停止和退出。
4. **PI 的持久化闭环。** 看 [HostProcess](/Users/chp/codex/PI-Desktop/packages/host-runtime/src/host-process.ts:94) → [RPC appendMessage](/Users/chp/codex/PI-Desktop/crates/host-core/src/rpc/mod.rs:2392) → [append_record](/Users/chp/codex/PI-Desktop/crates/host-core/src/sessions.rs:2099)。先理解请求、记录与索引，再读恢复。
5. **Zed 的数据结构。** 按 SumTree → Rope → text::Buffer → language::Buffer 阅读。大量可编辑文本需要这些设计；普通 Agent 日志列表可以先把它们作为算法学习素材。

## 6. 用同一负载验证

以下是后续实验设计，**本轮没有执行**。沿用现有共用事件 fixture，比较相同功能与构建模式；输入法、多行 Markdown、动态高度列表另建负载，避免用固定单行列表代表完整聊天工作台。

| 实验 | 记录什么 | 能回答什么 |
|---|---|---|
| 一万条历史 + 固定事件流 | 输入延迟 p50/p95/p99、主线程忙碌段、可见行创建数量 | 虚拟化是否限制更新范围 |
| 输出时切会话/取消 | 取消到停止的时间、旧事件是否写入新会话 | 生命周期与身份检查是否正确 |
| 多行文本逐块追加 | 解析时间、布局次数、滚动位置变化 | 数据处理和渲染是否保持增量 |
| 关闭窗口/子进程异常退出 | pending 请求终止、残留进程、恢复结果 | 隔离是否伴随清理与恢复 |
| 冷/热启动及空闲 | 首窗时间、RSS、CPU/能耗、shader 开关 | runtime_shaders 和打包结构的实际代价 |
| 同类改动增量构建 | 耗时、修改范围、依赖缓存状态 | 学习和迭代成本能否接受 |

记录机器、系统、commit/工作树状态、fixture、release/debug、冷/热条件、重复次数、工具与误差来源。GPUI 当前 dev 产物不能与 Swift 优化构建直接排名；功能范围、文本长度和布局也应对齐。[已有比较边界](../../../examples/COMPARISON.md)

已有代码还提供两项待验证假设：达到容量上限后的 `Vec::remove(0)` 和索引重建有 O(n) 成本；语音期间 50 ms timer 会持续轮询并通知 UI。测量后可以分别比较环形存储、事件驱动送达的效果。这是潜在优化点，不是已证实的体验故障。[移除事件](/Users/chp/explore/yuuki-box/examples/rust-gpui/src/main.rs:173)、[ticker](/Users/chp/explore/yuuki-box/examples/rust-gpui/src/main.rs:145)

## 7. 这次调查支持的范围

可以据此继续：把 Rust/GPUI 作为主学习线，用 PI 理解 UI 与系统核心的混合方式，优先掌握状态权威、异步结果、取消与持久化边界。

仍需实现或测量才能决定：最终 UI 是否选 GPUI、是否拆独立 Rust host、是否需要日志/索引双存储、怎样支持 iPhone/iPad。现有自建 loop 的方向继续保留；若之后考虑改用 pi，需要另行判断需求和控制范围。参考项目的整个架构不自动成为 Yuuki 的实现范围。
