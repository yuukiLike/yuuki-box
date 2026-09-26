# Zed、Raycast、Warp：Agent 工作台架构调研

核实日期：**2026-09-26**。
用途：为个人 Apple 生态 Agent 盒子提供可复查的架构依据，帮助完成第一轮 Mac 本地闭环。

相关文档：[文档入口](../README.md) · [Mac 本地 Harness 架构](../architecture/mac-local-harness.md) · [渲染与性能](../learning/rendering-performance.md) · [第一个 Mac 闭环](../plan/first-mac-loop.md)。

动手入口：[五条路线 MVP](../../examples/README.md) 已实现并完成本机构建，包含 Rust/GPUI；[实现对照](../../examples/COMPARISON.md) 记录具体优点与代价。示例没有完成界面或性能测量，不构成三款产品的复刻或性能排名。

后续深入：[简单、组合、复杂性](../deep/2026-09-26-simplicity-composition-complexity/README.md)进一步比较四个产品的操作单位与组合契约，新增 Grok Build，记录 Warp 固定源码，并把研究接回 Yuuki 的实际变化链。

## 1. 结论与当前决策边界

这三个产品最值得借鉴的部分，分别是 Zed 的状态与事件组织、Raycast 的受控交互契约、Warp 的结构化执行记录。
它们采用的语言、渲染器和扩展运行时服务于各自的产品目标，不能直接组成一份适用于本项目的技术栈清单。

本轮已经确认的项目方向：

- 先完成 **Mac 本地闭环**，暂时不把跨设备运行作为第一轮验收条件。
- **自己实现 model/tool loop**，让模型请求、工具调用、结果回传和停止条件掌握在自己的代码中。
- 长期设备目标包含 Mac Mini、MacBook Air、iPad 和 iPhone。
- 优先追求性能、简单和能够继续演进的边界。

尚未确认的选择包括 Swift、Rust、SwiftUI、AppKit、具体模型供应商和存储方案。
Swift 是面向 Apple 生态的一项建议，**不是用户已经确认的技术栈**。
本调研也没有要求第一轮复制编辑器、终端模拟器、插件市场或分布式协作系统。

## 2. 证据如何使用

文中的陈述分为三类：

| 标记 | 含义 | 应如何使用 |
| --- | --- | --- |
| 公开事实 | 官方工程文章、文档或源码直接支持 | 作为核实日期下的依据；注意产品版本与文章年代 |
| 设计推断 | 根据已确认目标提出的本项目建议 | 可以通过原型和使用反馈推翻，不能冒充产品内部实现 |
| 未知边界 | 公开材料不足，或没有进行实际测量 | 不补写实现，不把未知解释成不存在 |

这是文献与源码调研，**没有对三款应用进行同机、同数据、同场景性能基准测试**。
文中引用的性能数字保留其来源和适用范围，不用于给产品作绝对性能排名。
GitHub 的 `main`、`master` 链接会继续变化；这里记录的是核实日期下的阅读结论，不是锁定某次提交的逐行审计。

## 3. 三种产品目标，三种工程压力

| 产品 | 主要交互压力 | 本项目优先借鉴 | 不能直接照搬 |
| --- | --- | --- | --- |
| Zed | 高频编辑、长文档、低输入延迟、并发文本协作 | 增量更新、类型化事件、工具与 UI 的边界 | 自研渲染器、完整编辑器模型、全局 CRDT 化 |
| Raycast | 快速唤起、键盘操作、统一扩展体验、系统集成 | 命令与动作模型、受控组件、宿主掌握交互 | 完整扩展市场、多个运行时及桥接基础设施 |
| Warp | 终端输出、命令生命周期、执行上下文、Agent 结果呈现 | 结构化执行单元、状态与日志分离、冷热数据区别对待 | 终端模拟器、Shell 深度集成、云编排产品 |

上表是面向本项目的分析框架，不是三家公司对各自架构的完整定义。
尤其要区分两件事：**用户看到的流畅度**与**Agent 执行本身的耗时**。
即使渲染器很快，模型响应、工具 I/O、上下文构建和历史加载仍可能决定整体体验。

## 4. Zed：控制更新成本，而不是只选择 Rust

### 4.1 GPUI 的渲染分工

**公开事实。** Zed 使用 Rust 与自研 GPUI；官方早期渲染文章描述了针对矩形、阴影、文字、图标和图片分别优化的绘制路径。
其思路是 CPU 准备图元数据，再让 GPU 批量绘制，避免先实现一个覆盖任意二维图形的通用系统。[GPUI 渲染设计](https://zed.dev/blog/videogame)

“GPU 渲染”不等于文字处理完全放到 GPU。
该设计仍使用操作系统 API 完成文字 shaping 和字形栅格化，并通过缓存与 GPU 字形纹理复用结果。[文字渲染分工](https://zed.dev/blog/videogame)

可以把这条路径理解为以下概念图；它用于解释职责，不是当前源码每个函数的调用图：

```text
用户输入 / 应用状态变化
          ↓
需要更新的元素与布局
          ↓
CPU 准备绘制数据、复用文字缓存
          ↓
GPU 批量绘制图元与字形
          ↓
提交画面并由系统显示
```

**设计推断。** 对 Agent 工作台，更直接的收益是减少每次 token 到达后重复处理的范围。
已完成消息不应随每个新 token 重新解析，历史工具输出不应随着当前状态更新而全部重新布局。
先通过数据粒度、缓存和列表可见范围控制成本，再判断是否需要特殊渲染方案。

### 4.2 快速绘制并不保证稳定呈现

**公开事实。** Zed 后续的 120 FPS 工程文章仍需处理 ProMotion、Metal 提交及同步造成的卡顿。
这说明拥有 GPU 渲染器以后，帧调度与系统显示路径依然需要测量和优化。[Zed 的 120 FPS 调试](https://zed.dev/blog/120fps)

**未知边界。** 这些文章不能证明 Zed 在所有机器、项目和插件组合上都比其他编辑器更快，也不能证明 GPUI 是本项目的最优解。
第一轮应分别观察输入响应、流式更新、长记录滚动、空闲 CPU 和内存增长，具体方法见[渲染与性能](../learning/rendering-performance.md)。

### 4.3 GPUI 同时组织状态与事件

**公开事实。** GPUI 不只是绘图库；官方所有权文章介绍了实体所有权、状态更新以及事件和订阅关系。
该文章最初针对旧版 GPUI，页面现注明已于 2025-12-12 更新 API；具体接口仍需与使用的源码版本核对。[GPUI 所有权与数据流](https://zed.dev/blog/gpui-ownership)
当前 Zed Agent 源码也仍依赖 GPUI，因此把某个功能从仓库中拿出来，不代表自然获得完全独立于 UI 框架的可嵌入内核。[Agent 源码](https://github.com/zed-industries/zed/blob/main/crates/agent/src/agent.rs)

2026-09-26 的后续[本地源码深度调查](../deep/2026-09-26-zed-pi-rust/README.md)已固定 checkout，补充 crate 关系、平台后端、文件/输入/解析调用链及 PI-Desktop 对照。

**设计推断。** 本项目可以学习“明确谁拥有可变状态”，同时采用更小的边界：

- 运行会话拥有当前 model/tool loop 的状态。
- 工具执行器拥有进程、文件句柄和取消操作。
- UI 读取事件形成视图状态，不从显示文字反推运行状态。
- 持久化记录哪些事情已经发生，不替代正在执行的资源句柄。

这些边界可以先在一个进程内成立，不必为证明分层而立刻拆成多个服务。

### 4.4 CRDT 服务于并发文本编辑

**公开事实。** Zed 的 CRDT 设计围绕文本副本的并发编辑展开，处理稳定位置引用、并发插入、删除及撤销等问题。
它让文本在多方编辑后收敛，并保留可解释的位置与编辑关系。[Zed 的 CRDT 设计](https://zed.dev/blog/crdts)

**需要纠正的概括。** “Zed 的核心围绕 CRDT”不能扩展成“它所有应用状态、所有 Agent 任务都必须用 CRDT 同步”。
已公开的文本协作设计，不足以支持如此宽泛的结论。

**设计推断。** 当前只有一个 Mac 上的一个运行主体时，按顺序保存会话事件即可满足许多需求。
任务取消、工具完成和恢复执行首先需要明确的状态转换，不是文本合并算法。
只有出现多个设备同时修改同一内容、且需要离线合并的真实需求时，才重新评估相应数据是否适合 CRDT。

### 4.5 Wasm 扩展与外部程序是不同边界

**公开事实。** Zed 的扩展可以包含声明式资源；需要程序逻辑的部分可用 Rust 编写并编译到 Wasm，由扩展宿主执行。
不能把主题、语法资源等全部描述成“每个扩展都运行一段 Rust/Wasm 程序”。[扩展开发文档](https://zed.dev/docs/extensions/developing-extensions)、[Wasm 宿主源码](https://github.com/zed-industries/zed/blob/main/crates/extension_host/src/wasm_host.rs)

其 capability 系统包括 `process:exec`、`download_file`、`npm:install` 等能力，可以对命令、下载来源或包名施加限制。
Wasm 模块受到宿主约束，不意味着它获准启动的外部语言服务器或程序也自动获得同样的隔离。[扩展能力说明](https://zed.dev/docs/extensions/capabilities)

Zed 另外区分 Agent 的工具审批与运行时沙箱：前者决定调用能否开始，后者约束执行时允许做什么；Agent 沙箱的适用范围也不等于全部扩展和 LSP。[Agent 沙箱说明](https://zed.dev/docs/ai/sandboxing)

**设计推断。** 自建工具循环时应明确记录工具名称、输入、工作目录、执行结果与取消状态。
是否引入 Wasm，要由是否运行第三方插件以及所需宿主能力决定；它不能替代工具权限与外部进程管理。

### 4.6 LSP、工具接口与 Agent 事件

**公开事实。** Zed 的语言扩展通过 LSP 接入语言服务器；语法与语言功能还包括其他资源和配置。
LSP 是语言服务的协议边界，不等于整个编辑器或 Agent 运行时。[语言扩展文档](https://zed.dev/docs/extensions/languages)

当前 Agent 源码中的 `Thread` 保存消息、模型、工具和运行中的轮次，并组织模型与工具之间的往返。
`ThreadEvent` 将文本、工具调用及更新、授权、重试、上下文压缩与停止等变化表达成类型化事件；工具接口也有结构化输入输出。[Agent thread 源码](https://github.com/zed-industries/zed/blob/main/crates/agent/src/thread.rs)

**设计推断。** 这是比复制 GPUI 更贴近第一轮需求的参考：UI 应区分“正在请求模型”“正在运行工具”“等待用户”“已完成”“失败”“已取消”。
模型文本可以流式显示，工具错误则作为带身份的结果返回循环；二者无需混成一条不断追加的字符串。

**未知边界。** 这些源码类型是内部实现，不是对外稳定的 SDK 承诺。
本项目可以参考职责划分，但应拥有自己的小型事件协议和生命周期，不依赖 Zed 的内部枚举名称。

## 5. Raycast：保持交互契约，底层架构可以变化

### 5.1 必须区分 v1 和 v2

**公开事实。** 2026-05-14 的官方工程文章讲述了 v2 公测时的重写；2026-08-25，v2.0 已结束 beta；2026-09-25 发布 v2.5。
因此，不能把“Raycast 当前仍是纯 Swift/AppKit UI”或“v2 当前仍在 beta”写成调研结论。[v2 工程文章](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)、[v2.0 正式发布](https://www.raycast.com/changelog/macos/2-0)、[v2.5 发布](https://www.raycast.com/changelog/macos/2-5)

| 范围 | 官方披露的主要职责 |
| --- | --- |
| v1 主应用 | Swift/AppKit，自定义原生组件承担主要交互 |
| v1 扩展 | React/TypeScript 声明界面，外部 Node 运行扩展逻辑，宿主渲染 |
| v2 macOS host | Swift/AppKit，窗口、全局快捷键及系统集成 |
| v2 前端 | WKWebView 中的 React/TypeScript UI |
| v2 后端与核心 | 长驻 Node 负责业务与扩展；Rust 用于数据层、同步和索引等 |

表中 v1 路径依据旧版扩展工程文，v2 分层依据重写工程文；它们属于不同代实现。[v1 架构](https://www.raycast.com/blog/how-raycast-api-extensions-work)、[v2 架构](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

### 5.2 v1 如何把 React 映射成原生界面

**公开事实。** v1 的 React 不通过 `react-dom` 操作网页。
自定义 reconciler 生成 JSON render tree，再计算 JSON Patch，经标准文件描述符上的 JSON-RPC 传到 Swift view model，最终更新自定义 AppKit 组件。[v1 渲染与通信流程](https://www.raycast.com/blog/how-raycast-api-extensions-work)

```text
扩展 React/TypeScript
        ↓ 状态变化
自定义 reconciler → render tree → JSON Patch
        ↓
扩展 worker → Node 子进程 → JSON-RPC
        ↓
Swift view model → AppKit 组件更新
```

该版本的 Node 由 Raycast 下载、验证并管理，是外部子进程；扩展各自使用 worker/V8 isolate。
因此，“嵌入式 Node”容易让人误以为它直接嵌在主应用进程内。[v1 运行时说明](https://www.raycast.com/blog/how-raycast-api-extensions-work)

**设计推断。** 这里可复用的原则是让扩展提交受控的内容与动作描述，而由宿主保持布局、快捷键和错误呈现的一致性。
一个自用 Harness 最初可以只用原生数据结构实现这种契约，不需要先重建 React reconciler 和跨语言 UI 桥。

### 5.3 v2 的混合架构和代价

**公开事实。** v2 将 UI 与业务更多放到共享 Web/Node 代码，保留平台 host；Node 随应用打包。
其跨运行时接口统一声明并生成类型化客户端；原生层仍负责需要精细控制的系统行为。[v2 分层与通信](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

官方在公测工程文中自述：类似使用场景下，v1 约占 200–300 MB，v2 约 350–450 MB。
这是**该文章时点的官方观察**，不是本调研测量结果，也不是 v2.5 的现行基准。[官方内存讨论](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

**未知边界。** 该文章没有完整公开 v2 对旧扩展 reconciler 的兼容细节。
旧 API FAQ 仍写 AppKit 原生渲染，不能用这段未同步的说明推翻较新的主应用架构文章。[仍保留旧渲染描述的 FAQ](https://developers.raycast.com/misc/faq)

**设计推断。** Raycast 为产品和跨平台开发作出的权衡，不意味着 Apple-only 的个人工具需要同样的多运行时结构。
应先用实际交互和性能预算判断必要性，避免为了借鉴而承担桥接、运行时发布和调试成本。

### 5.4 受控 UI 与安全边界不要混淆

**公开事实。** 扩展 API 提供 `List`、`Grid`、`Detail`、`Form`、`ActionPanel` 等组件与动作，而非通用 DOM/CSS 接口。
这套稳定的交互契约比某一代底层渲染实现更适合用来理解 Raycast。[UI API](https://developers.raycast.com/api-reference/user-interface)

官方 Security 页面明确：文件 I/O、网络及其他 Node 能力没有进一步的扩展沙箱限制；敏感系统资源依赖 macOS 授予父应用的权限。
worker 隔离和堆限制帮助控制部分运行问题，不能视为每个扩展独立的文件系统权限边界。[扩展安全说明](https://developers.raycast.com/information/security)

该安全页仍保留自动下载 Node 等旧描述，因此本调研不声称掌握全部 v2 安全实现。
可确认的是：公开资料不足以支持“Raycast 有严格的每扩展文件/网络沙箱”这一说法。
当前 AI 工具审批设置属于调用策略，也不等于 OS 沙箱。[AI Extensions 与权限](https://manual.raycast.com/ai/ai-extensions)

**设计推断。** 本项目可把相同工具动作暴露给聊天、快捷键和按钮，但这些入口应共同经过同一执行边界。
UI 组件权限、模型能看到哪些工具、工具运行时能访问哪些资源，应分别说明。

### 5.5 iOS 不等于桌面扩展环境的完整复制

**公开事实。** 当前 iOS 手册包含 AI、语音输入、Notes、Snippets、Quicklinks 及系统入口。
iOS 不能安装社区 AI Extensions，但可以连接 MCP servers；不要把内容同步理解成桌面 Node 扩展也在手机上执行。[iOS 产品范围](https://manual.raycast.com/ios)、[iOS 扩展边界](https://manual.raycast.com/ai/ai-extensions)

公开的 `raycast/extensions` 是扩展、示例和文档仓库，不能当成完整主应用源码。
官方另有 Swift 互操作工具，把部分原生能力提供给 React/TypeScript 扩展。[扩展仓库](https://github.com/raycast/extensions)、[Swift 互操作工具](https://github.com/raycast/extensions-swift-tools)

**设计推断。** 长期多设备方案可以共享任务语义和数据，按设备能力选择交互入口与执行位置。
当前先把 Mac 的任务与工具生命周期做清楚，未来才有可靠的移动端控制对象。

## 6. Warp：把执行过程变成可操作的数据

### 6.1 WarpUI 与 GPUI 是不同项目

**公开事实。** Warp 使用自研 WarpUI，当前源码具有 `warpui_core`、`warpui` 等模块。
其平台依赖包含 macOS 的 AppKit/CoreText/Metal，以及其他平台的 wgpu、winit、cosmic-text 等路径；不能把它描述为使用 Zed 的 GPUI。[WarpUI 依赖与平台配置](https://github.com/warpdotdev/warp/blob/master/crates/warpui/Cargo.toml)

**未知边界。** 依赖清单不能独立证明每个发行版本在每台机器上实际选择的后端，也不能给出帧率保证。
完整渲染性能判断仍需结合构建特性、平台实现和运行时测量。

**设计推断。** 对本项目而言，自研 UI 框架是一个需要证据支持的长期投入。
首先需要流畅的消息列表、清楚的工具状态和可靠输入，尚没有证据证明必须实现自己的图形管线。

### 6.2 Block 是命令与结果的结构化单元

**公开事实。** Warp 的 Block 模型以有类型的有序列表组织终端命令及输出，也容纳富 UI 内容。
它借助 Shell 的 `preexec`、`precmd` 等 hooks，通过转义序列和 JSON 获取命令边界、工作目录与退出状态等信息。[Warp Block 模型](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)

```text
命令与上下文
      ↓ 开始执行
执行单元：身份 + 运行状态 + 输出
      ↓ 结束 / 失败 / 取消
可查看、可引用、可操作的历史记录
```

上图表达可借鉴的模型，不意味着 Warp 的每种内部 block 都包含完全相同字段。
它的重要性在于：输出属于哪次执行、何时结束、是否成功，能够由结构得到，而不是依赖解析屏幕文字猜测。

**设计推断。** 自建 Harness 可以将每次工具调用作为相应单元，保存调用 ID、工具名、输入、输出与终态。
对于文件改动、搜索结果和进程执行，可以采用不同的结果表示；不必把所有结果都压成终端文本。
重试应建立新的调用记录或明确的尝试序号，避免覆盖导致执行历史难以解释。

### 6.3 活跃输出与历史输出分开优化

**公开事实。** Warp 的文章区分活跃终端的可变 `GridStorage` 和滚屏历史的紧凑 `FlatStorage`。
后者使用文字缓冲、行索引和稀疏样式数据；alternate screen 又有独立处理路径。[Block 与存储设计](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)

**设计推断。** 本项目可以采用相同的成本意识，而不复制终端存储格式：

- 正在流式输出的数据允许增量修改和批量发布到 UI。
- 完成的结果进入稳定历史，避免每次更新重新解析。
- 大输出保留可读取的完整结果，UI 只加载需要显示的部分。
- 传给模型的工具结果预算和用户可查看的完整日志分开管理。

这也提醒我们区分三个量：磁盘上存了多少、内存里加载了多少、当前屏幕渲染了多少。
限制第三个量不自动限制前两个量，反之亦然。

### 6.4 开源边界已变化，但并非全部服务开源

**公开事实。** Warp 于 **2026-04-28 宣布客户端开源**，继续概括为“Warp 完全闭源”已经过时。[客户端开源公告](https://www.warp.dev/blog/warp-is-now-open-source)

官方仓库 FAQ 区分应用与大多数 crates 的 AGPLv3，以及 WarpUI 相关 crates 的 MIT 许可。
服务端、Drive 后端、托管认证和云编排等仍有专有部分；内置的服务端 harness 不包含在客户端仓库内。[仓库 FAQ 与开源范围](https://github.com/warpdotdev/warp/blob/master/FAQ.md)

**未知边界。** 不能因为客户端代码可见，就声称已经审计了内置 Agent 的全部模型路由、执行循环或云恢复实现。
如果后续准备复用代码，应读取实际文件和许可证，并确认依赖范围；本调研当前只用于理解设计。

**设计推断。** 本项目选择自建 model/tool loop 后，Warp 最直接的参考对象是执行记录与展示，而不是依赖未公开的远端 Harness 细节。

## 7. 对自建 Harness 的共同启发

以下均为本项目的**设计推断**，不是三款产品已经共同采用同一实现的断言。

| 需要清楚的边界 | 第一轮应该回答的问题 | 可借鉴的方向 |
| --- | --- | --- |
| 模型与循环 | 何时发请求，何时运行工具，何时停止？ | Zed 的运行状态与类型化事件 |
| 工具与展示 | 输入输出如何验证，错误如何回传？ | Zed 的工具结构、Warp 的执行单元 |
| 操作与入口 | 按钮、命令、模型调用是否执行同一动作？ | Raycast 的命令与动作契约 |
| 活跃与历史 | 哪些内容会变，哪些结果已经稳定？ | GPUI 的复用意识、Warp 的冷热存储区别 |
| 审批与执行 | 谁决定开始，运行后能访问什么？ | 各产品公开权限范围的差异 |
| UI 与持续任务 | 关闭视图是否等于取消任务？ | 由本项目明确选择，不能从界面框架推导 |

第一轮的成功条件应是用户提出一个小任务后，模型调用本地工具、读取结果并给出结束状态，而且整个过程可观察、可停止。
先验证这个链条，才有依据判断下一项投入应是 UI、上下文管理、工具范围还是执行恢复。
具体边界与验收见 [Mac 本地 Harness 架构](../architecture/mac-local-harness.md)和[第一个 Mac 闭环](../plan/first-mac-loop.md)。

## 8. 可借鉴点、暂缓项与重评条件

| 方向 | 当前建议 | 触发重新评估的证据 |
| --- | --- | --- |
| 类型化运行事件 | 立即采用小范围协议 | 多模型和更多工具出现新的真实状态 |
| 结构化工具记录 | 立即保留身份、输入、结果与终态 | 长历史或大输出需要索引与分页 |
| 受控交互组件 | 先满足消息、工具、结果和操作 | 多类工具反复需要相同展示方式 |
| 原生 Apple UI | 作为候选路径做原型，尚未锁定栈 | 实机性能、开发成本或交互需求给出比较依据 |
| 自研 GPU 渲染 | 暂缓 | 常规组件经过合理优化仍不能满足可复现预算 |
| CRDT | 暂缓 | 多端同时、离线修改同一对象且确需自动合并 |
| Wasm 插件宿主 | 暂缓 | 出现第三方插件、分发和明确能力隔离需求 |
| 通用扩展市场 | 暂缓 | 有稳定 API、多位实际开发者及维护收益 |
| 终端模拟器 | 暂缓 | 普通工具进程输出无法满足明确的交互终端任务 |
| 移动端与远程执行 | 第一轮暂缓，保留清楚的数据边界 | Mac 本地闭环可靠且跨设备场景频繁发生 |
| 多运行时核心 | 暂缓无需求的拆分 | 性能热点、系统集成或独立部署有可测收益 |

“面向未来”在当前阶段意味着让模型、工具、运行记录和 UI 可以分别演进。
它不要求今天就实现所有未来设备、协议和扩展形态。

## 9. 按产品分组的阅读来源

### Zed

- [GPUI 渲染设计](https://zed.dev/blog/videogame)：理解图元、文字与缓存的职责。
- [120 FPS 调试](https://zed.dev/blog/120fps)：理解提交与显示时序为何也需要优化。
- [GPUI 所有权](https://zed.dev/blog/gpui-ownership)：理解实体、状态和事件关系。
- [CRDT 设计](https://zed.dev/blog/crdts)：理解并发文本问题的具体范围。
- [扩展开发](https://zed.dev/docs/extensions/developing-extensions)、[扩展 capabilities](https://zed.dev/docs/extensions/capabilities)、[语言扩展](https://zed.dev/docs/extensions/languages)：核对扩展的能力和协议边界。
- [Agent thread](https://github.com/zed-industries/zed/blob/main/crates/agent/src/thread.rs)、[Agent 沙箱](https://zed.dev/docs/ai/sandboxing)：阅读执行状态与权限分工。

### Raycast

- [v1 扩展工程文](https://www.raycast.com/blog/how-raycast-api-extensions-work)：阅读 React 到 AppKit 的映射流程。
- [v2 架构工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)：阅读重写后的分层与当时的内存观察。
- [v2.0 发布](https://www.raycast.com/changelog/macos/2-0)、[v2.5 发布](https://www.raycast.com/changelog/macos/2-5)：核对版本时间线。
- [UI API](https://developers.raycast.com/api-reference/user-interface)、[Security](https://developers.raycast.com/information/security)：理解公开接口，并注意旧版描述残留。
- [iOS 手册](https://manual.raycast.com/ios)、[AI Extensions](https://manual.raycast.com/ai/ai-extensions)：核对移动端范围和工具审批。
- [扩展仓库](https://github.com/raycast/extensions)、[Swift 互操作](https://github.com/raycast/extensions-swift-tools)：了解可直接查看的源码范围。

### Warp

- [Block 模型](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)：阅读执行结构与存储分工。
- [WarpUI 平台依赖](https://github.com/warpdotdev/warp/blob/master/crates/warpui/Cargo.toml)：确认自研框架及平台路径，不能单凭它推断性能。
- [客户端开源公告](https://www.warp.dev/blog/warp-is-now-open-source)、[仓库 FAQ](https://github.com/warpdotdev/warp/blob/master/FAQ.md)：确认公开与专有部分的边界。

下一步直接进入[第一个 Mac 闭环](../plan/first-mac-loop.md)，根据实际运行结果补充决策，不把继续调研作为开始实现的前置条件。
