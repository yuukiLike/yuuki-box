# Yuuki Box

面向 Mac mini、MacBook Air、iPad 与 iPhone 的个人 Agent 工作台。先完成 Mac 本地闭环，自己掌握模型调用、工具执行、审批、取消与运行记录，再扩展到其他设备。

**调研与选型建议更新于 2026-09-26。** 本文结合最新一手资料和仓库里的五条实际实现给出建议；它还不是用户已经确认的最终技术决策。五个 Mac 应用与十五个场景已完成构建，但尚未进行界面、真实 Agent、语音或性能实测。

**我的当前推荐：日用产品以 SwiftUI 为主，macOS 的复杂文本和窗口按需使用 AppKit；Harness 与 UI 分离，第一版继续使用已有 Swift runtime。Rust + GPUI 保留为能接管 Mac 客户端的正式候选，可以现在就深入，而不必等另一条路线失败。**

这个推荐依据的是你的组合目标：Apple 设备、个人维护、性能与简单并重、尽快形成可用的工具。它不包含“Swift 已经跑赢 Rust/Web”的结论，也不要求 UI、运行时和语音引擎采用同一种语言。

## 五条路线，我会怎样选

下表是针对本项目的工程判断。性能一栏描述控制能力和成本来源；没有用未经测量的 FPS、内存或星级为框架排名。

| 路线 | 在 Yuuki 中的选择 | 性能上真正得到什么 | 主要架构与编码成本 | iPad / iPhone 的后续路径 |
|---|---|---|---|---|
| **SwiftUI + 按需 AppKit** | **默认日用主线**。适合任务、审批、设置、语音和产物浏览组成的 Apple 工作台。 | 无需随包交付 Web UI 引擎或 Node；可直接使用系统文本与列表能力。仍需治理主线程计算、历史解析和状态失效。 | Apple 侧多数交互可直接使用系统 API；复杂文本可能要写 AppKit 适配，Swift 并发、缓存与生命周期也要维护。 | 共享 Swift 模型及部分 SwiftUI 视图；macOS 用 AppKit，移动端按需 UIKit。工具能力与后台行为分别设计。 |
| **Rust + GPUI** | **认真投入的 Mac 候选**。若工作台逐渐以长日志、diff、多面板和定制文本交互为核心，我会提高它的优先级。 | 直接控制 Entity 更新、元素构建、布局与 GPU 绘制，更容易表达专门的数据和渲染策略；没有自动消除 CPU 重复工作的保证。 | 除产品逻辑，还要理解框架版本、文本输入、选区、焦点、可访问性和原生桥。本仓库已有自定义输入与子进程适配实例。 | Rust 核心可复用；移动 UI 默认另做 SwiftUI。GPUI 社区移动适配值得探索，但目前不把它视为成熟的全 Apple UI 承诺。 |
| **React + WKWebView** | **内容型工作台的正式备选**。若主体变成长 Markdown、表格、可编辑文档与频繁变化的富 UI，值得优先重评。 | 使用系统 WebKit；React/CSS 的表达力和生态可复用。DOM、JS、布局与 WebKit 进程仍有成本。 | Swift 宿主与 Web UI 两侧维护；桥、内容进程重载、输入交互、系统 WebKit 版本差异需要处理。当前示例无需运行时 Node。 | WKWebView 本身覆盖 Apple 移动平台，可复用 Web 内容；宿主、手势、键盘、权限与执行端仍要适配。 |
| **React → 原生控件桥** | **保留为高价值架构实验**。只有受控第三方 UI 扩展成为核心产品需求时，才考虑承担完整平台责任。 | 系统控件的交互能力 + React 的声明方式；真实 patch 与对象复用能减少跨桥工作。 | 你同时维护 reconciler、UI 词汇、JSON 协议、原生映射和反向事件。增加一个控件可能穿过整个链路。 | AppKit 映射不能直接成为 UIKit 映射；当前 Node 子进程宿主也不能原样搬到手机。 |
| **Electron + React** | **保留为完整基线**。若 Windows/Linux 桌面交付或 Node 工具生态成为硬需求，再提高优先级。 | 随包固定 Chromium/Node 版本，成熟的 Web 工具链与多进程能力；仍必须保护 main 和 renderer 的响应。 | 同时维护引擎升级、main/preload/renderer、IPC 与分发。很多现成功能也能节省业务开发量，不能只数进程或依赖判输赢。 | 官方应用目标是 macOS/Windows/Linux；移动端需另一套宿主或客户端，不能直接把 Electron 应用当 iOS 应用。 |

平台依据：[SwiftUI](https://developer.apple.com/documentation/swiftui)、[WWDC26 SwiftUI 与 AppKit/UIKit 混用](https://developer.apple.com/videos/play/wwdc2026/272/)、[GPUI 官方 README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md)、[WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)、[Electron 官方介绍](https://www.electronjs.org/docs/latest)。表中的维护判断来自这些平台边界与[本仓库五份实现](examples/README.md)，不是上述厂商给出的比较排名。

目前还不知道你在 Swift、Rust 和 React 上分别有多少经验。因此默认判断侧重长期需要维护的东西，不把“首次写得快”当成已知事实。如果你已经非常熟悉 React，WKWebView 的首版交付成本可能明显更有利；如果掌握 Rust 和定制桌面交互本身就是核心目标，GPUI 的学习投入也应计入收益。

## 最新资料怎样改变这个判断

**1. 当前 Raycast 已经不是旧的 React → AppKit 主界面路线。** 2026-05-14 的官方工程文描述了 v2 的 Swift/AppKit 宿主、WKWebView 中的 React/TypeScript、长驻 Node 与 Rust 核心；2026-08-25 的发布记录确认 v2 结束 Beta、替代 v1。旧版原生桥仍值得研究，但需要标注为 v1。[v2 工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)、[v2.0 发布](https://www.raycast.com/changelog/macos/2-0)、[v1 扩展架构](https://www.raycast.com/blog/how-raycast-api-extensions-work)

这次重写考虑了 Windows、富 UI 和迭代效率。五月文章也承认资源代价：相似使用情境下，自报内存从 v1 约 200–300 MB 变为 v2 约 350–450 MB。**这是当时产品自己的观察，不能作为九月版本、本项目或任意 WebView 应用的预测。** 对 Yuuki 的启发是 Web UI 可以成为严肃选择；是否值得采用，要看你是否需要它带来的能力。[动机与代价的原文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

**2. SwiftUI 与 AppKit 混用仍是 Apple 在推进的方向。** WWDC26 展示了两者在视图、窗口与交互上的互操作，也说明 Xcode Coding Assistant 从一开始就采用 SwiftUI。它为“常规界面用 SwiftUI，复杂局部使用 AppKit”提供了直接依据；它不能证明 SwiftUI 在你的数据上比 GPUI 更快。[Use SwiftUI with AppKit and UIKit](https://developer.apple.com/videos/play/wwdc2026/272/)

原生也不会自动避免卡顿。Swift 的 `async` / `Task` 不能单凭名字保证 CPU 工作离开 UI 执行上下文；隔离设置与实际执行位置必须明确。这个问题正是本仓库 Swift 搜索与历史解析场景的观察对象。[Swift 6.2 的并发变化](https://www.swift.org/blog/swift-6.2-released/)

**3. GPUI 的潜力应当保留，成熟度也要按范围描述。** 官方仍将 GPUI 标为 pre-1.0，并明确提示 breaking changes。当前主干的平台选择已包含桌面与 Web/WASM 路径，但不能据此推断本仓库锁定的 0.2.2 示例已具备这些新版能力。[官方 README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md)、[主干平台选择](https://github.com/zed-industries/zed/blob/main/crates/gpui_platform/src/gpui_platform.rs)

官方平台选择中尚无原生 iOS 分支；社区 `gpui-toolkit` 已有 `gpui-ios` 与 Swift host，并自述相关组件处于 source beta / pre-1.0。我的结论是“移动适配需要额外验证与维护”，而不是“GPUI 永远不能上 iPhone”。这些社区能力本项目没有实际构建或运行。[社区项目的一手说明](https://github.com/pierreaubert/gpui-toolkit)

Zed 对 120 FPS 的工程记录还展示了 Metal 提交、同步和缓冲区上的持续调整。**采用 GPUI 得到更直接的性能控制权；Zed 的全部优化成果不会自动成为我们的产品成果。**[Zed 的 Metal 优化记录](https://zed.dev/blog/120fps)

**4. Warp 已经可以读客户端源码。** 2026-04-28，Warp 宣布客户端开源。它使用自己的 WarpUI，不能写成 GPUI；开源范围也不能外推为所有托管服务和内置服务端 Harness 都公开。对本项目最值得借鉴的是结构化执行记录、输出组织与前端/运行状态的职责，而不是因为 Rust 客户端成功就复制整套框架。[开源公告](https://www.warp.dev/blog/warp-is-now-open-source)、[官方架构说明](https://github.com/warpdotdev/warp/blob/master/AGENTS.md#architecture-overview)、[开源范围 FAQ](https://github.com/warpdotdev/warp/blob/master/FAQ.md)

以上产品证明的是不同目标下存在可行路线；它们没有共同证明某一种语言或 UI 框架总是最优。

## 我会给 Yuuki 采用的架构

把 **UI、Harness 语言、执行位置**分别决定。这样选择 SwiftUI 不会把核心永远锁在 Swift，选择 GPUI 也不要求未来手机端复制整个桌面渲染体系。

| 部分 | 当前建议 | 为什么，以及当前边界 |
|---|---|---|
| Mac 客户端 | SwiftUI 为主；复杂控制台、文本或窗口按需 AppKit | 先复用系统交互，再针对真实热点收紧更新范围。保留 GPUI 客户端作为同一执行协议的竞争实现。 |
| Harness | 第一版继续已有 Swift runtime；不依赖 UI 视图对象 | 现有模型流、工具、审批、取消与存储已有调用路径，减少同时重写变量。**这是交付成本判断，不是 Swift 比 Rust 更适合 Agent 的断言。** |
| UI ↔ Runner | 先沿用已有受限 JSONL；按真实需要演进协议 | 当前能交换命令、状态和增量，但还没有完整远程恢复、事件游标或多客户端能力，不能直接暴露给网络当远程服务。 |
| 记录与产物 | 当前原子 JSON 先继续使用；查询、恢复或规模需要时引入 SQLite | 长历史应分页、大产物按引用读取。数据库升级服务于明确问题，不作为选 UI 的前提。 |
| 模型 | 先接你的 DeepSeek API，保留清楚的供应商适配边界 | 模型网络、上下文和工具往返可能占据大部分任务时间；换 UI 语言不会直接消除这些等待。 |
| 语音 | Mac 保留 Apple / Whisper 适配；以后按设备决定进程内推理或远程请求 | 当前 Whisper 是录音/文件 → CLI → 转写，尚不是常驻模型与连续识别。语音引擎不必由 UI 框架决定。 |
| 多设备 | Mac mini 可逐步成为主要执行主机；Air 可本地运行或连接；移动端先做任务、审批与结果客户端 | 一次运行有明确的执行主机。连接、身份验证、断线补发和取消确认是后续工作；Mac 的睡眠与退出也必须处理。 |

表中“当前已有”的具体语义以[运行时说明](examples/shared/runtime/README.md)和[现行协议](examples/shared/runtime/PROTOCOL.md)为准；架构演进见[Mac 本地 Harness 提案](docs/architecture/mac-local-harness.md)。目前没有常驻后台 Runner 或移动客户端。

**如果你现在就想把 Rust 作为长期核心语言，我会采用另一条完整路线：Rust Harness + GPUI Mac 客户端 + 未来 SwiftUI 移动客户端。** 它成立的前提是你愿意承担 Rust 核心实现和两种 UI 的长期维护，并确实重视桌面定制能力。它不需要先把 Swift 产品全部做完，也不要求今天把所有核心代码塞进 GPUI Entity。

Rust 具有官方 iOS/iPadOS 编译目标；需要移动端共享核心时，也有 UniFFI 的 Swift 绑定支持。因此“Rust 适合 Apple 核心逻辑”与“GPUI 是否适合所有 Apple UI”是两个独立问题。FFI 同时带来构建、类型映射、取消和对象寿命的边界；当前 Mac 进程协议足够时，无需为了共享而立即再加一层。[Rust iOS 平台支持](https://doc.rust-lang.org/rustc/platform-support/apple-ios.html)、[UniFFI 官方说明](https://mozilla.github.io/uniffi-rs/latest/)

**移动端的限制也需要用新资料描述。** iOS/iPadOS 26 已加入 `BGContinuedProcessingTask`，可继续用户在前台发起的长任务，包括计算和网络工作，部分设备/配置还可使用 GPU。它仍受系统资源、进度、到期与用户取消约束，不能作为无条件后台常驻的承诺。我建议 Mac 主机，依据的是长任务连续性和桌面工具能力，而不是手机完全不能执行本地 AI。[Apple 长任务文档](https://developer.apple.com/documentation/backgroundtasks/performing-long-running-tasks-on-ios-and-ipados)、[WWDC25 后台任务说明](https://developer.apple.com/videos/play/wwdc2025/227/)

当前 Mac helper 的子进程方式同样不是可原样搬到 iPhone 的能力：Foundation `Process` 没有 iOS/iPadOS API 平台支持。Whisper 本身则有 iOS 库接入路径；将来可以替换 CLI 适配，不必连同 UI 一起推倒重写。[Process](https://developer.apple.com/documentation/foundation/process)、[whisper.cpp 官方平台与 C API](https://github.com/ggml-org/whisper.cpp)

## 性能、复杂度与编码成本，怎样落到判断上

**我会先比较用户能否持续操作，再比较完成总耗时。** Agent 工作台里，回复等待与界面卡顿需要分开：模型仍在生成时，输入、查看旧结果、审批与取消应该可用。取消也要等实际停止或收到执行方确认，不能只把按钮换成“已取消”。

十五个场景已把更新范围、重复解析、桥接、控件身份和后台计算变成实际代码路径。各路线输入和布局并不相同；它们适合发现本路线的问题，尚不是统一跑分。GPUI 当前默认 dev/debug，不能直接与 Swift 优化产物排性能名次。[场景手册与计量边界](docs/learning/harness-scenario-lab.md)

| 判断维度 | 现在已有的依据 | 还不能给出的结论 |
|---|---|---|
| 架构复杂度 | 实际语言/运行时、协议、状态所有者、对象与任务生命周期；可沿源码追踪 | 不能把进程多或文件多直接等同于设计差；隔离与现成功能也有收益 |
| 编码成本 | 新增能力会经过哪些职责；哪些控件、桥和交互由本项目维护 | 没有你的实际修改时间、熟练度和返工记录，不能准确报价或预测工时 |
| 运行性能 | 已写入可运行的场景计数和局部计时；执行后可取得结果 | 尚无启动、内存、能耗、帧率和按键到屏幕延迟的测量排名 |
| 学习收益 | GPUI、TextKit、reconciler/patch、Worker/IPC 都有直接代码入口 | 不能将更少代码或更快生成代码视为你理解得更深 |

维护成本最容易通过同一项改动显现。下面这张表是本仓库的变化路径判断，**不是按源码行数推算工时**：

| 同一类改动 | Swift 原生 | Rust / GPUI | React 原生桥 | WKWebView | Electron |
|---|---|---|---|---|---|
| 增加一种可编辑审批字段 | 状态与 SwiftUI/AppKit 控件 | Entity、绘制/布局、输入控件与事件 | React props、wire/patch、Swift 控件、反向事件 | React 表单；仅新增宿主能力时改桥 | React 表单；仅新增宿主能力时改 preload/main |
| 工具卡片支持展开和长文本 | 原生布局、文本与滚动锚点 | 自绘列表高度、测量、锚点与文本交互 | 若超出已有控件词汇，需要贯穿两侧扩展 | DOM/CSS 与虚拟列表测量 | 同类 DOM 工作，另关注 renderer 负载 |
| 新增一类本地系统工具 | 执行端工具与 Swift 能力 | Rust 执行端或现有原生适配 | 仍应落到共享执行端，不应穿过 UI 树执行 | 仍由宿主/执行端提供受限能力 | main/执行端能力，保持 renderer 隔离 |

AI 辅助编码可能降低第一次实现的时间，但不会消除这些边界的运行语义和后续维护。对你而言，“极简”可以具体解释为：少一些需要同时保持一致的状态、少一些每次功能变化都要穿过的协议、少一些没人负责清理的任务。

[统一评估工具文档](docs/architecture/technology-assessment.md)仍是工具提案；目前完成的是应用内局部计量，没有全自动的五路线系统性能采集与开发成本推算器。

## 什么证据会让我改变推荐

| 新事实或产品变化 | 我会怎样调整 |
|---|---|
| 主要操作变成高密度 diff、长输出、多面板和深度定制文本；GPUI 在相同负载与正确输出下呈现持续的响应优势 | 将 GPUI 提升为 Mac 主线，同时明确输入法、可访问性与框架升级的维护责任 |
| 主要价值变成长 Markdown、复杂表格、可编辑内容和快速变化的富 UI；原生实现持续消耗大量控件工作 | 提高 WKWebView 的优先级；Swift 保留窗口与系统能力，不自动引入 Node |
| Windows/Linux 与 Mac 必须同时交付，且大量能力依赖成熟 Node/Web 工具 | 重新比较 Electron 与 GPUI；不再以 Apple-only 的目标函数直接沿用当前结论 |
| 必须让第三方用 React 声明受控 UI，而且扩展契约成为核心资产 | 原生控件桥从学习实验升级为平台投资；补齐协议兼容、控件语义和生命周期 |
| 想把核心长期做成 Rust 库，或已有可复用 Rust 模块/明确 CPU 热点 | 单独调整 Harness 或计算模块的语言；UI 可以继续 SwiftUI、GPUI 或 Web |
| 手机成为主要执行设备，需要更多离线本地任务 | 针对移动后台、文件访问、进程内推理和触摸交互重做能力分工，不把桌面 helper 直接迁移 |

这些是重评条件，不是规定必须先证明某个框架失败才可以学习另一条路线。现在就从 GPUI 开始阅读和修改完全合理；是否把它变成唯一日用客户端，再由体验、维护意愿和工作负载共同决定。

## 现在可以直接开始

五份 Mac 示例都包含基础 Agent 调用路径、会话、流式输出、审批、取消、设置、Apple/Whisper 接口和更新清单检查；每份另有三个朴素/优化场景。真实更新的下载安装、后台常驻服务、移动客户端与跨设备同步尚未实现。

在仓库根目录选择一个应用打开，例如：

```bash
bash examples/open.sh gpui
```

其他参数是 `swift`、`react-native`、`webview`、`electron`。场景实验不需要模型 Key；真实任务与语音另按应用说明配置。需要重新构建时执行 `bash examples/build-all.sh`；脚本会处理依赖、编译和本地打包。

**我的下一步建议是只收敛一个日用切片：查看长任务历史，同时编辑下一条指令，并能可靠取消当前任务。** 先把这个切片在你最想投入的 Swift 或 GPUI 客户端做好；给另一份实现保留相同协议和输入。亲手完成一次“工具卡片展开且保留阅读位置”的改动，再决定是否收敛唯一 UI 主线。十五个实验已足够提供学习入口，下一阶段无需继续让五份应用同步增长全部产品功能。

| 阅读入口 | 内容 |
|---|---|
| [examples](examples/README.md) | 五条路线、构建命令、应用位置、模型和语音配置 |
| [十五个 Harness 场景](docs/learning/harness-scenario-lab.md) | 具体负载、操作方法、计量边界与维护练习 |
| [五路线实现对照](examples/COMPARISON.md) | 共享能力与各路线当前代价 |
| [Zed / Raycast / Warp 调研](docs/research/zed-raycast-warp.md) | 实现事实、源码入口与扩展边界 |
| [Zed / Rust 深入研究](docs/deep/2026-09-26-zed-pi-rust/README.md) | crate、调用链、平台后端与混合架构 |
| [简单、组合与复杂性](docs/deep/2026-09-26-simplicity-composition-complexity/README.md) | 产品中的组合单位、契约与实际变化链 |
| [全部文档](docs/README.md) | Harness、语音、评估工具与开发计划 |

**证据边界：**2026-09-26 五路线构建与打包已成功；本次 README 更新只读取源码/文档并检索一手资料，没有重新运行应用、测试、性能负载、付费 API 或语音。滚动文档与主干源码以核实日为准，不代表固定版本承诺。本文给出了可执行的推荐与改变推荐的条件；实际性能和你的维护体验仍待记录。
