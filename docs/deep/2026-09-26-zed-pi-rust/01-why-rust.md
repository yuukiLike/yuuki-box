# 为什么这些项目选择 Rust

调查日期：2026-09-26。先读[调查入口与版本边界](README.md)，具体实现见 [Zed](02-zed-architecture.md) 和 [PI-Desktop](03-pi-desktop.md)。

## 1. 先把“推荐 Rust”还原成具体选择

Zed 的数百 crate 属于同一产品，不是数百次独立推荐；PI、Raycast 则局部采用 Rust。应比较<mark class="key">想控制的成本与愿承担的工作</mark>。

| 项目与证据范围 | Rust 承担的职责 | 明确动机 | 与其他技术的搭配 |
|---|---|---|---|
| Zed，本地源码 + 创始团队工程访谈 | UI 框架、编辑器模型、项目状态、Agent、远程和协作等大量核心逻辑 | 可控的内存布局、后台并行、减少跨语言核心边界、掌握渲染路径 | GPUI、平台 API、Tree-sitter、LSP、Wasm，以及部分外部 Node 程序 |
| PI-Desktop，本地 ADR + 工作树源码 | host-core：权威宿主状态、持久化、文件与进程等系统能力 | 系统编程能力、进程隔离、清楚的数据和权限归属 | Electron/React/TypeScript UI，Node 执行 pi Agent |
| Raycast v2，2026-05 官方工程文 | 数据层、同步、文件索引等 | 性能与可移植性；部分数据能力可与 iOS 共用 | Swift/AppKit 或 C# 宿主，WebView/React UI，Node 业务层 |
| Warp，2021 年官方基础架构回顾 | 当时的终端客户端与自绘 UI | 大量输出下的响应、平台覆盖、Rust 生态与包管理 | 自研元素树、GPU 后端、PTY 与 Shell 集成 |

来源：[Zed 访谈](https://zed.dev/blog/we-have-to-start-over)、PI ADR 0010[^pi-1]、[Raycast v2](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)、[Warp 工程文](https://www.warp.dev/blog/how-warp-works)。Raycast/Warp 仅对照动机；Warp 2021 Metal 设计不代表当前全平台。

## 2. Zed：Rust 让高频路径可以共享一套数据和类型

### 2.1 团队自己说了什么

2024 年访谈将 Atom 难点归于内存/文本布局、GC 和 JS/C++ 边界。Rust 提供底层控制、共享快照、跨线程与 Cargo；团队也承认 C/C++ 可实现类似结果，且有编译/培训成本。这是团队经验，非跑分。[原访谈](https://zed.dev/blog/we-have-to-start-over)

早期 Zed 尝试 Electron+Rust 子进程、Node/V8 嵌入 Rust，留下 JSON 状态与所有权问题。全 Rust UI 来自持续演进。[2024 GPUI 重写回顾](https://zed.dev/blog/why-the-big-rewrite)

### 2.2 源码如何支持这个动机

**事实：**SumTree 用 `Arc<Node<T>>`、`Arc::make_mut`；Buffer snapshot 便宜克隆，后台读固定版本，前台继续输入。未变化节点共享，避免全文深拷贝。[SumTree](https://github.com/zed-industries/zed/blob/7ea077c78b865d17854cee812bb775dbe64a925a/crates/sum_tree/src/sum_tree.rs)、[Buffer](https://github.com/zed-industries/zed/blob/7ea077c78b865d17854cee812bb775dbe64a925a/crates/language/src/buffer.rs)

**推断：**Rust 用类型/API 表达共享、可变性和线程要求，但每次复制、解析和布局全文仍会慢；工作量由增量算法与更新范围决定。

**事实：**GPUI 分前台状态与后台执行，后台 Future 受 `Send` 约束；Context、Entity、WeakEntity 和订阅管理生命周期。见 [Zed](02-zed-architecture.md)。

**推断：**高频文本/计算/UI 往返可从同语言、共享快照中减少序列化与适配；普通设置页未必受益。

## 3. Rust 的六种收益，哪些成立到什么程度

| 能力 | 能解决的问题 | 本次可见证据 | 仍需自己保证的事情 |
|---|---|---|---|
| 所有权、借用和 RAII | 减少悬空引用，给资源指定生命周期 | GPUI Entity、Task、Subscription；Rust host 资源类型 | 引用环、忘记取消、业务层资源归属、操作系统进程清理 |
| `Send` / `Sync` 等线程约束 | 阻止不符合线程安全要求的对象跨线程使用 | 后台 executor 与 snapshot | 逻辑竞态、过期结果、死锁、公平调度 |
| 无需 tracing GC 的原生核心 | 控制分配、布局和回收时机 | Zed Rust 数据路径；PI Rust host | 反复分配、引用计数和析构成本、锁竞争、系统调度停顿 |
| 泛型、trait、enum | 把状态和操作契约写成可检查的程序结构 | `SumTree<T>`、`LanguageModel`、typed events | 合理算法、错误处理、编译时间、动态分派与装箱成本 |
| 平台与系统库接入 | 接近文件系统、进程、GPU、数据库 | GPUI 平台 crate；PI host-core | FFI 的 `unsafe` 边界、平台差异、打包和权限行为 |
| Cargo workspace | 在一个代码库中表达依赖、features、测试与模块边界 | Zed 显式成员清单和 path 依赖 | crate 粒度、可维护接口、循环依赖约束、依赖更新 |

本表解释机制，不含本轮未测的 FPS、启动、内存或能耗收益。

<mark class="caution">安全 Rust 不等于权限隔离</mark>。Wasm 授权、Shell 策略和文件检查仍需设计，sidecar 也只提供进程边界。

## 4. PI：Rust 用于稳定宿主，TypeScript 用于快速变化的生态

ADR 0010 为文件、进程、插件隔离、存储与长驻服务选择 Rust host，不迁移 UI/pi loop。0011 已确定 stdio NDJSON RPC、Rust 独占 SQLite，早期“RPC 或 FFI”不再是当前实现。ADR 0010[^pi-2]、0011[^pi-3]

ADR 0012 复用 pi-ai，拒绝重写全部供应商 SDK。可归纳为：稳定宿主用 Rust，快速变化的 Agent/provider 留 TypeScript；不是通用规则。ADR 0012[^pi-4]

一个 host-core crate 仍含大量模块，Rust 不自动证明 RPC、迁移或权限正确。请求 ID、错误、超时、退出、事件顺序和恢复均须维护验收。

## 5. Raycast 和 Warp 说明“采用 Rust”的范围可以不同

Raycast v2 保留 React/TypeScript、Node 业务，Rust 管数据、同步和索引；独立索引进程强调可预测内存与无 GC 暂停，不代表要替换 UI/业务层。[工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

Warp 2021 工程文分别讨论 PTY、ANSI、滚动和绘制：Rust/GPU 外，还需块模型、Shell、字形缓存与自研 UI。历史性能数字不是本轮实测，也不用于当前产品排名。[工程文](https://www.warp.dev/blog/how-warp-works)

## 6. 源码里也有成本证据

1. **编译/接口。** `MultiBuffer::edit` 提取非泛型实现控制 LLVM IR；发布 GPUI 0.2.2 与本地同名版 API 已不同。[MultiBuffer](https://github.com/zed-industries/zed/blob/7ea077c78b865d17854cee812bb775dbe64a925a/crates/multi_buffer/src/multi_buffer.rs#L1497)、[版本说明](../../../examples/rust-gpui/README.md)
2. **UI 所有权。** GPUI 从 `Rc` 困难演进到 Entity/App；文章 2024 首发、2025-12-12 更新 API，仍须核对当前源码。[所有权](https://zed.dev/blog/gpui-ownership)
3. **内存预算。** `worktree::load_file` 拒绝 ≥6 GiB 文件；这是加载路径限制，不是全应用输入上限。[load_file](https://github.com/zed-industries/zed/blob/7ea077c78b865d17854cee812bb775dbe64a925a/crates/worktree/src/worktree.rs#L1713)
4. **混合发布。** PI 维护 Rust 二进制、Agent bundle、Electron 和两条 sidecar 故障协议，以保留成熟生态。[调用链](03-pi-desktop.md)。

## 7. 对 Yuuki Box 的研究判断

可直接沿 GPUI MVP 学 Rust，无需先证明 Swift/Web 失败。分别验证 GPUI 的状态/渲染/后台协作，以及 Rust 宿主的生命周期/持久化。

证据支持实验 Rust，不足以决定 UI、loop 和 Apple 接入全用 Rust。[搭配与验证](04-yuuki-box.md)。

## 本地源码引用说明

PI 引用定位 2026-09-26 本地工作树，无公开链接；含未归入 HEAD 的暂存改动，不能只凭提交号重建。本次整理未重验运行行为。

[^pi-1]: `PI-Desktop/docs/adr/0010-rust-backend-host-core.md:1`，来自上述本地调查记录。
[^pi-2]: `PI-Desktop/docs/adr/0010-rust-backend-host-core.md:7`，来自上述本地调查记录。
[^pi-3]: `PI-Desktop/docs/adr/0011-host-rpc-and-storage-defaults.md:20`，来自上述本地调查记录。
[^pi-4]: `PI-Desktop/docs/adr/0012-universal-provider-model-coverage.md:1`，来自上述本地调查记录。
