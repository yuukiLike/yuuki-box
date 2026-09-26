# 为什么这些项目选择 Rust

调查日期：2026-09-26。先读[调查入口与版本边界](README.md)，具体实现见 [Zed](02-zed-architecture.md) 和 [PI-Desktop](03-pi-desktop.md)。

## 1. 先把“推荐 Rust”还原成具体选择

Zed 的数百个 crate 是同一个产品采用 Rust 后形成的模块体系，不能把它们看成数百个项目各自作出的语言推荐。PI-Desktop、Raycast 则把 Rust 放在部分职责上。真正值得比较的是：**它们希望控制什么成本，愿意为这种控制承担什么开发工作。**

| 项目与证据范围 | Rust 承担的职责 | 明确动机 | 与其他技术的搭配 |
|---|---|---|---|
| Zed，本地源码 + 创始团队工程访谈 | UI 框架、编辑器模型、项目状态、Agent、远程和协作等大量核心逻辑 | 可控的内存布局、后台并行、减少跨语言核心边界、掌握渲染路径 | GPUI、平台 API、Tree-sitter、LSP、Wasm，以及部分外部 Node 程序 |
| PI-Desktop，本地 ADR + 工作树源码 | host-core：权威宿主状态、持久化、文件与进程等系统能力 | 系统编程能力、进程隔离、清楚的数据和权限归属 | Electron/React/TypeScript UI，Node 执行 pi Agent |
| Raycast v2，2026-05 官方工程文 | 数据层、同步、文件索引等 | 性能与可移植性；部分数据能力可与 iOS 共用 | Swift/AppKit 或 C# 宿主，WebView/React UI，Node 业务层 |
| Warp，2021 年官方基础架构回顾 | 当时的终端客户端与自绘 UI | 大量输出下的响应、平台覆盖、Rust 生态与包管理 | 自研元素树、GPU 后端、PTY 与 Shell 集成 |

来源：[Zed 团队访谈](https://zed.dev/blog/we-have-to-start-over)、[PI ADR 0010](/Users/chp/codex/PI-Desktop/docs/adr/0010-rust-backend-host-core.md:1)、[Raycast v2](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)、[Warp 历史工程文](https://www.warp.dev/blog/how-warp-works)。Raycast/Warp 在本轮只作动机对照，未开展与 Zed 同深度的本地源码调查；Warp 2021 年的 Metal 设计不代表今天所有平台的实现。

## 2. Zed：Rust 让高频路径可以共享一套数据和类型

### 2.1 团队自己说了什么

2024 年 Zed 创始团队回顾 Atom 时，把困难归结到内存布局、GC、文本布局控制，以及 JavaScript/C++ 之间移动计算的成本。Rust 的吸引力包含低层控制、共享快照、跨线程工作和 Cargo 工具链。他们也明确承认 C/C++ 能实现类似结果，并抱怨编译时间和自研框架的培训成本。这是特定团队的经验，不是语言跑分结论。[原始访谈](https://zed.dev/blog/we-have-to-start-over)

早期 Zed 确实试过 Electron + Rust 子进程，也试过通过 Node/V8 嵌入 Rust。2024 年 GPUI 重写回顾指出，那套历史设计留下了 JSON 状态和所有权方向的问题。因此今天的全 Rust UI 是一系列演进的结果。[GPUI 重写回顾](https://zed.dev/blog/why-the-big-rewrite)

### 2.2 源码如何支持这个动机

**事实：** `SumTree<T>` 使用 `Arc<Node<T>>`，修改时使用 `Arc::make_mut`；`language::Buffer` 提供便宜克隆、可交给后台读取的 snapshot。主线程可以继续接受输入，后台解析读取它取得的版本。新旧视图共享未变化的树节点，而不是每次都深拷贝整篇文档。[SumTree](/Users/chp/explore/zed/crates/sum_tree/src/sum_tree.rs)、[Buffer](/Users/chp/explore/zed/crates/language/src/buffer.rs)

**推断：** Rust 在这里提供的价值是把共享、可变性和跨线程要求表达在类型与 API 中，让同一批编辑器数据结构贯穿多层。把它换成 Rust 字符串并在每次输入后复制、重新解析、重新布局全文，仍然会慢。决定工作量的是增量算法和更新范围。

**事实：** GPUI 把前台状态访问与后台执行分开。后台 Future 要满足相应 `Send` 约束；`Context`、`Entity`、`WeakEntity` 和订阅管理 UI 状态与生命周期。具体定义和平台调度见 [Zed 章节](02-zed-architecture.md)。

**推断：** 对编辑器这类频繁从 UI 获取文本、启动计算、再更新 UI 的产品，同进程、同语言、共享快照可以减少序列化和接口适配工作。这种收益依赖数据确实需要高频跨边界；普通设置页未必有同样需求。

## 3. Rust 的六种收益，哪些成立到什么程度

| 能力 | 能解决的问题 | 本次可见证据 | 仍需自己保证的事情 |
|---|---|---|---|
| 所有权、借用和 RAII | 减少悬空引用，给资源指定生命周期 | GPUI Entity、Task、Subscription；Rust host 资源类型 | 引用环、忘记取消、业务层资源归属、操作系统进程清理 |
| `Send` / `Sync` 等线程约束 | 阻止不符合线程安全要求的对象跨线程使用 | 后台 executor 与 snapshot | 逻辑竞态、过期结果、死锁、公平调度 |
| 无需 tracing GC 的原生核心 | 控制分配、布局和回收时机 | Zed Rust 数据路径；PI Rust host | 反复分配、引用计数和析构成本、锁竞争、系统调度停顿 |
| 泛型、trait、enum | 把状态和操作契约写成可检查的程序结构 | `SumTree<T>`、`LanguageModel`、typed events | 合理算法、错误处理、编译时间、动态分派与装箱成本 |
| 平台与系统库接入 | 接近文件系统、进程、GPU、数据库 | GPUI 平台 crate；PI host-core | FFI 的 `unsafe` 边界、平台差异、打包和权限行为 |
| Cargo workspace | 在一个代码库中表达依赖、features、测试与模块边界 | Zed 显式成员清单和 path 依赖 | crate 粒度、可维护接口、循环依赖约束、依赖更新 |

这张表解释的是工程机制。它不包含本轮未测量的 FPS、启动时间、内存节省百分比或能耗提升。

安全 Rust 的内存与线程约束也不意味着应用自动具备权限隔离。Wasm 宿主授权、Shell 执行策略、文件访问检查属于另一层设计。PI 的 sidecar 提供进程边界；具体授权规则由业务实现。

## 4. PI：Rust 用于稳定宿主，TypeScript 用于快速变化的生态

PI 的 ADR 0010 把文件系统、进程、插件隔离、存储适配和长驻服务列为 Rust host 的理由，同时明确不把 UI 或 pi Agent 循环迁移到 Rust。ADR 0011 随后确定 stdio NDJSON RPC 和 Rust 独占 SQLite；早期 0010 中“RPC 或 FFI”的候选不能继续当作当前实现。[ADR 0010](/Users/chp/codex/PI-Desktop/docs/adr/0010-rust-backend-host-core.md:7)、[ADR 0011](/Users/chp/codex/PI-Desktop/docs/adr/0011-host-rpc-and-storage-defaults.md:20)

ADR 0012 则明确拒绝自己重新实现所有供应商 SDK，其中包括用 Rust 重写；项目选择复用 pi-ai，再处理兼容端点和模型目录。这给出一条很实用的取舍：**稳定、需要掌控的宿主职责放 Rust，变化快且有成熟库的 Agent/provider 层留在 TypeScript。** 这是对项目决策的归纳，不是所有应用必须遵守的规则。[ADR 0012](/Users/chp/codex/PI-Desktop/docs/adr/0012-universal-provider-model-coverage.md:1)

也不能把设计目标自动当成安全或性能验收。当前 host-core 只有一个 crate，却承担大量模块；把它写成 Rust 不会自动证明 RPC 完整、迁移安全或所有权限路径正确。完整实现还要维护请求 ID、错误、超时、进程退出、事件顺序和恢复。

## 5. Raycast 和 Warp 说明“采用 Rust”的范围可以不同

Raycast v2 的官方分层中，大部分产品工作仍在 React/TypeScript 和 Node；Rust 用于数据、同步和索引。文件索引器是独立进程，团队特别强调扫描大量文件时的内存可预测性与无 GC 暂停。这支持“把系统密集部分放 Rust”的思路；无法据此得出“它推荐 Rust 取代 UI 和业务层”。[Raycast 工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

Warp 的 2021 年工程文把 PTY 读取、ANSI 解析、滚动和绘制拆开讨论；Rust 与 GPU 是组合的一部分，块模型、Shell 集成和字形缓存同样参与体验。文章同时记录了自研 UI 框架的投入。其历史性能数字不是本项目的实测，也不用于与当前 Zed/PI 排名。[Warp 工程文](https://www.warp.dev/blog/how-warp-works)

## 6. 源码里也有成本证据

1. **编译和接口演进成本。** Zed `MultiBuffer::edit` 附近专门提取非泛型实现以控制 LLVM IR；本项目发布版 GPUI 0.2.2 与本地 Zed 同名版本的 API 已有区别。[MultiBuffer](/Users/chp/explore/zed/crates/multi_buffer/src/multi_buffer.rs:1497)、[本项目版本说明](../../../examples/rust-gpui/README.md)
2. **UI 框架的所有权要重新设计。** GPUI 官方文章记述过直接使用 `Rc` 等方式遇到的困难，并说明统一 Entity/App 所有权模型。该文 2024 年首发，已在 2025-12-12 更新 API；仍需用当前源码核对。[GPUI 所有权](https://zed.dev/blog/gpui-ownership)
3. **Rust 不能替代内存预算。** Zed 的 `worktree::load_file` 留有超大文件曾耗费大量内存的说明，并对大于等于 6 GiB 的文件拒绝加载。这是文件加载路径的限制，不是整款应用的所有输入上限。[load_file](/Users/chp/explore/zed/crates/worktree/src/worktree.rs:1713)
4. **混合架构增加接口与发布工作。** PI 必须携带 Rust 二进制、Agent runtime bundle 与 Electron，并保证两条 sidecar 协议能处理故障。它接受这项成本以保留成熟 UI 与 Agent 生态，详见 [PI 实际调用链](03-pi-desktop.md)。

## 7. 对 Yuuki Box 的研究判断

你可以把 Rust 当成正式学习路线，直接沿已有 GPUI MVP 深入，不必先证明 Swift 或 Web 技术失败。最值得验证的是两种不同收益：一是 GPUI 的状态、渲染和后台工作协作；二是 Rust 作为独立宿主时的生命周期与持久化边界。

目前的证据支持认真实验 Rust，尚不足以确定 Yuuki Box 的全部 UI、模型循环、Apple 系统接入都使用 Rust。选型条件和最小实验见 [Yuuki Box 的搭配与验证](04-yuuki-box.md)。
