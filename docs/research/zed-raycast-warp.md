# Zed、Raycast、Warp：Agent 工作台架构调研

核实：2026-09-26。用途：为 Apple 平台 Agent 工作台的首轮 Mac 闭环提供架构依据。

相关文档：[文档入口](../README.md) · [Mac 本地 Harness 架构](../architecture/mac-local-harness.md) · [渲染与性能](../learning/rendering-performance.md) · [第一个 Mac 闭环](../plan/first-mac-loop.md)。

动手入口：[五路线 MVP](../../examples/README.md) 已实现并完成本机构建，含 Rust/GPUI；优劣见[实现对照](../../examples/COMPARISON.md)。界面与性能未测，不代表复刻或排名。

深入阅读：[简单、组合、复杂性](../deep/2026-09-26-simplicity-composition-complexity/README.md)比较操作单位与组合契约，加入 Grok Build、固定 Warp 源码及 Yuuki 变化链。

按主题选择研究入口：Zed 的文本更新、Raycast 的命令交互、Warp 的结果与历史。候选方案记录来源与不适用条件。

## 1. 结论与当前决策边界

借鉴 Zed 的状态与事件、Raycast 的交互契约、Warp 的<mark class="key">结构化执行记录</mark>；不能把各自的语言、渲染器和运行时直接拼成本项目技术栈。

本轮已经确认的项目方向：

- 先完成 Mac 本地闭环，跨设备不纳入首轮验收。
- 自建 model/tool loop，掌控请求、工具、回传和停止条件。
- 长期设备目标包含 Mac Mini、MacBook Air、iPad 和 iPhone。
- 优先追求性能、简单和能够继续演进的边界。

Swift、Rust、UI 框架、模型供应商与存储均未定。Swift 只是建议；首轮不复制编辑器、终端、插件市场或分布式系统。

## 2. 证据如何使用

陈述分三类：

| 标记 | 含义 | 应如何使用 |
| --- | --- | --- |
| 公开事实 | 官方工程文章、文档或源码直接支持 | 作为核实日期下的依据；注意产品版本与文章年代 |
| 设计推断 | 根据已确认目标提出的本项目建议 | 可以通过原型和使用反馈推翻，不能冒充产品内部实现 |
| 未知边界 | 公开材料不足，或没有进行实际测量 | 不补写实现，不把未知解释成不存在 |

本调研<mark class="caution">未做同机、同数据、同场景性能基准</mark>，引用数字仅保留其原有范围，不作绝对排名。`main/master` 会变化，阅读结论不等于固定提交的逐行审计。

[![固定版本的研究证据提供候选方法，本项目方案仍需独立实验验证](../../site/public/diagrams/architecture/evidence-proposal.svg)](../../site/public/diagrams/architecture/evidence-proposal.svg)

## 3. 三种产品目标，三种工程压力

| 产品 | 主要交互压力 | 本项目优先借鉴 | 不能直接照搬 |
| --- | --- | --- | --- |
| Zed | 高频编辑、长文档、低输入延迟、并发文本协作 | 增量更新、类型化事件、工具与 UI 的边界 | 自研渲染器、完整编辑器模型、全局 CRDT 化 |
| Raycast | 快速唤起、键盘操作、统一扩展体验、系统集成 | 命令与动作模型、受控组件、宿主掌握交互 | 完整扩展市场、多个运行时及桥接基础设施 |
| Warp | 终端输出、命令生命周期、执行上下文、Agent 结果呈现 | 结构化执行单元、状态与日志分离、冷热数据区别对待 | 终端模拟器、Shell 深度集成、云编排产品 |

表格是本项目的分析框架。流畅度与 Agent 耗时分开看：模型、工具 I/O、上下文和历史加载也影响体验。

## 4. Zed：控制更新成本，而不是只选择 Rust

### 4.1 GPUI 的渲染分工

**公开事实。** Zed 使用 Rust/GPUI，分别优化矩形、阴影、文字、图标和图片：CPU 准备图元，GPU 批量绘制，不先造通用二维系统。[GPUI 渲染设计](https://zed.dev/blog/videogame)

文字 shaping、字形栅格化仍由系统 API 完成，再以缓存和 GPU 字形纹理复用。[文字渲染分工](https://zed.dev/blog/videogame)

以下是职责概念图，不是逐函数调用图：

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

**设计推断。** 先缩小 token 更新范围：已完成消息不重解析，历史输出不全量重排。用数据粒度、缓存和可见范围控制成本，再决定渲染方案。

### 4.2 快速绘制并不保证稳定呈现

**公开事实。** 120 FPS 工程文仍需排查 ProMotion、Metal 提交与同步卡顿；GPU 渲染后仍要测帧调度和显示路径。[120 FPS 调试](https://zed.dev/blog/120fps)

**未知边界。** 文章不能证明 Zed 总是更快或 GPUI 最适合本项目。首轮分别测输入、流式更新、长历史、空闲 CPU 与内存，见[渲染与性能](../learning/rendering-performance.md)。

### 4.3 GPUI 同时组织状态与事件

**公开事实。** GPUI 还管理实体、状态、事件和订阅。所有权文章注明 2025-12-12 更新 API，使用时仍核对源码版本。[所有权与数据流](https://zed.dev/blog/gpui-ownership)
Zed Agent 仍依赖 GPUI，抽取功能不等于获得 UI 无关内核。[Agent 源码](https://github.com/zed-industries/zed/blob/main/crates/agent/src/agent.rs)

2026-09-26 的[本地源码调查](../deep/2026-09-26-zed-pi-rust/README.md)固定了 checkout，补充 crate、平台后端、文件/输入/解析链及 PI-Desktop 对照。

**设计推断。** 按可变状态的所有者划分：

- 会话拥有 model/tool loop 状态。
- 执行器拥有进程、文件句柄与取消操作。
- UI 从事件形成视图，不从文字反推运行状态。
- 持久化保存事实，不替代活动资源句柄。

先在同一进程内分层，按需再拆服务。

### 4.4 CRDT 服务于并发文本编辑

**公开事实。** Zed CRDT 处理文本副本的稳定位置、并发插入/删除/撤销，使多方编辑收敛。[CRDT 设计](https://zed.dev/blog/crdts)

**需要纠正的概括。** 文本协作设计不能推出所有应用状态、Agent 任务都需 CRDT。

**设计推断。** 单 Mac 先顺序存事件，明确取消、完成与恢复状态；只有多设备离线并发修改同一内容时，再评估 CRDT。

### 4.5 Wasm 扩展与外部程序是不同边界

**公开事实。** Zed 扩展可仅含声明式资源，程序逻辑可用 Rust→Wasm 交宿主执行，并非所有主题、语法都运行 Wasm。[扩展开发](https://zed.dev/docs/extensions/developing-extensions)、[Wasm 宿主](https://github.com/zed-industries/zed/blob/main/crates/extension_host/src/wasm_host.rs)

capability 可限制 `process:exec`、`download_file`、`npm:install` 的命令、来源或包名；Wasm 限制不会自动覆盖它启动的外部程序。[扩展能力](https://zed.dev/docs/extensions/capabilities)

Agent 审批决定能否开始，沙箱限制执行能力，其范围不等于全部扩展和 LSP。[Agent 沙箱](https://zed.dev/docs/ai/sandboxing)

**设计推断。** 记录工具名、输入、目录、结果和取消状态。Wasm 按第三方插件与宿主能力需求引入，不替代权限或进程管理。

### 4.6 LSP、工具接口与 Agent 事件

**公开事实。** 语言扩展经 LSP 接语言服务器，另有语法资源与配置；LSP 不等于编辑器或 Agent runtime。[语言扩展](https://zed.dev/docs/extensions/languages)

`Thread` 保存消息、模型、工具和活动轮次，组织模型/工具往返；`ThreadEvent` 表达文本、工具、授权、重试、压缩与停止，工具输入输出也结构化。[Agent thread](https://github.com/zed-industries/zed/blob/main/crates/agent/src/thread.rs)

**设计推断。** UI 区分请求模型、运行工具、等待用户、完成、失败和取消；文本流式显示，工具错误作为带 ID 的结果回传，不混成一串文字。

**未知边界。** 内部类型不是稳定 SDK；参考职责，自建小型事件协议与生命周期。

## 5. Raycast：保持交互契约，底层架构可以变化

### 5.1 必须区分 v1 和 v2

**公开事实。** v2 重写工程文发布于 2026-05-14；v2.0 于 08-25 结束 beta，09-25 发布 v2.5。当前不能仍称其纯 Swift/AppKit 或公测版。[v2 工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)、[v2.0 发布](https://www.raycast.com/changelog/macos/2-0)、[v2.5 发布](https://www.raycast.com/changelog/macos/2-5)

| 范围 | 官方披露的主要职责 |
| --- | --- |
| v1 主应用 | Swift/AppKit，自定义原生组件承担主要交互 |
| v1 扩展 | React/TypeScript 声明界面，外部 Node 运行扩展逻辑，宿主渲染 |
| v2 macOS host | Swift/AppKit，窗口、全局快捷键及系统集成 |
| v2 前端 | WKWebView 中的 React/TypeScript UI |
| v2 后端与核心 | 长驻 Node 负责业务与扩展；Rust 用于数据层、同步和索引等 |

v1/v2 是不同代实现，分别依据旧扩展与重写工程文。[v1 架构](https://www.raycast.com/blog/how-raycast-api-extensions-work)、[v2 架构](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

### 5.2 v1 如何把 React 映射成原生界面

**公开事实。** v1 用自定义 reconciler 生成 JSON render tree/JSON Patch，通过文件描述符上的 JSON-RPC 传给 Swift view model，更新 AppKit，不经 `react-dom`。[v1 渲染与通信](https://www.raycast.com/blog/how-raycast-api-extensions-work)

```text
扩展 React/TypeScript
        ↓ 状态变化
自定义 reconciler → render tree → JSON Patch
        ↓
扩展 worker → Node 子进程 → JSON-RPC
        ↓
Swift view model → AppKit 组件更新
```

v1 Node 是 Raycast 下载、验证和管理的外部子进程，扩展各用 worker/V8 isolate；不宜称“嵌入式 Node”。[v1 运行时](https://www.raycast.com/blog/how-raycast-api-extensions-work)

**设计推断。** 扩展提交受控内容与动作，宿主统一布局、快捷键和错误呈现。首版可用原生数据结构，无需重建 reconciler 或跨语言 UI 桥。

### 5.3 v2 的混合架构和代价

**公开事实。** v2 共用更多 Web/Node UI 与业务，Node 随包分发；平台 host 保留系统行为，跨运行时接口统一声明并生成类型客户端。[v2 分层与通信](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

公测工程文自述相似场景下 v1 约 200–300 MB、v2 约 350–450 MB；仅为当时官方观察，非本调研实测或 v2.5 基准。[官方内存讨论](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)

**未知边界。** v2 兼容旧 reconciler 的细节未完整公开；旧 FAQ 的 AppKit 描述不能推翻较新的主应用工程文。[旧渲染 FAQ](https://developers.raycast.com/misc/faq)

**设计推断。** Apple-only 工具未必需要同样的多运行时结构，先用交互与性能预算判断桥接、发布和调试成本。

### 5.4 受控 UI 与安全边界不要混淆

**公开事实。** API 提供 `List/Grid/Detail/Form/ActionPanel` 等受控组件与动作，不是通用 DOM/CSS。交互契约比某代渲染实现更稳定。[UI API](https://developers.raycast.com/api-reference/user-interface)

Security 页面称文件、网络与 Node 能力未进一步沙箱化，敏感资源依赖 macOS 给父应用的权限；worker/堆限制不是独立文件权限边界。[扩展安全](https://developers.raycast.com/information/security)

该页仍含自动下载 Node 等旧描述，不能据此掌握全部 v2 安全实现，也无证据支持严格的每扩展文件/网络沙箱。AI 工具审批是调用策略，不是 OS 沙箱。[AI Extensions 与权限](https://manual.raycast.com/ai/ai-extensions)

**设计推断。** 聊天、快捷键和按钮共用执行边界；组件权限、模型工具可见性与执行资源权限分别说明。

### 5.5 iOS 不等于桌面扩展环境的完整复制

**公开事实。** iOS 含 AI、语音、Notes、Snippets、Quicklinks 与系统入口；可连 MCP，但不能装社区 AI Extensions。内容同步不代表桌面 Node 扩展在手机执行。[iOS 范围](https://manual.raycast.com/ios)、[扩展边界](https://manual.raycast.com/ai/ai-extensions)

`raycast/extensions` 不含完整主应用；Swift 互操作工具向 React/TypeScript 扩展提供部分原生能力。[扩展仓库](https://github.com/raycast/extensions)、[Swift 互操作](https://github.com/raycast/extensions-swift-tools)

**设计推断。** 多设备共享任务语义和数据，按能力选择入口与执行位置；先做好 Mac 生命周期，再接移动控制。

## 6. Warp：把执行过程变成可操作的数据

### 6.1 WarpUI 与 GPUI 是不同项目

**公开事实。** Warp 自研 WarpUI，含 `warpui_core/warpui`，macOS 依赖 AppKit/CoreText/Metal，其他平台另有 wgpu、winit、cosmic-text 路径，不是 Zed GPUI。[WarpUI 平台配置](https://github.com/warpdotdev/warp/blob/master/crates/warpui/Cargo.toml)

**未知边界。** 依赖清单不证明实际后端或帧率，仍需结合构建特性、平台实现与运行测量。

**设计推断。** 先做好消息列表、工具状态与输入，尚无证据表明需自研图形管线。

### 6.2 Block 是命令与结果的结构化单元

**公开事实。** Warp 用有类型的有序 Block 组织命令、输出和富 UI；借助 `preexec/precmd` hooks、转义序列与 JSON 获取命令边界、目录和退出状态。[Block 模型](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)

```text
命令与上下文
      ↓ 开始执行
执行单元：身份 + 运行状态 + 输出
      ↓ 结束 / 失败 / 取消
可查看、可引用、可操作的历史记录
```

图示不是所有内部 Block 的字段定义；要点是从结构获取执行归属、结束和成功状态，不猜屏幕文字。

**设计推断。** 工具调用保存 ID、名称、输入、输出和终态；文件、搜索、进程可有不同结果结构。重试新建记录或 attempt，不覆盖历史。

### 6.3 活跃输出与历史输出分开优化

**公开事实。** 活跃终端用可变 `GridStorage`，历史用紧凑 `FlatStorage`（文字缓冲、行索引、稀疏样式）；alternate screen 单独处理。[Block 存储](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)

**设计推断。** 借鉴成本分层，不复制终端格式：

- 活跃输出增量修改、批量通知 UI。
- 完成结果进入稳定历史，不随更新重解析。
- 大输出限容量保存，UI 按需加载；达硬上限停止收集并标记不完整。
- 模型工具结果预算与用户日志分开管理。

磁盘存储、内存加载、屏幕渲染分别设限，三者不会互相代替。

### 6.4 开源边界已变化，但并非全部服务开源

**公开事实。** Warp 于 2026-04-28 宣布客户端开源，不能再称完全闭源。[开源公告](https://www.warp.dev/blog/warp-is-now-open-source)

应用和多数 crates 用 AGPLv3，WarpUI 相关 crates 用 MIT。服务端、Drive、托管认证、云编排仍有专有部分，内置服务端 harness 不在客户端仓库。[FAQ 与开源范围](https://github.com/warpdotdev/warp/blob/master/FAQ.md)

**未知边界。** 客户端可见不等于已审计全部模型路由、执行循环和云恢复。复用前查具体文件、许可证与依赖；本调研仅用于理解设计。

**设计推断。** 自建 model/tool loop 优先借鉴执行记录与展示，不依赖未公开的远端 Harness。

## 7. 对自建 Harness 的共同启发

以下是本项目的设计推断，不代表三款产品共用同一实现。

| 需要清楚的边界 | 第一轮应该回答的问题 | 可借鉴的方向 |
| --- | --- | --- |
| 模型与循环 | 何时发请求，何时运行工具，何时停止？ | Zed 的运行状态与类型化事件 |
| 工具与展示 | 输入输出如何验证，错误如何回传？ | Zed 的工具结构、Warp 的执行单元 |
| 操作与入口 | 按钮、命令、模型调用是否执行同一动作？ | Raycast 的命令与动作契约 |
| 活跃与历史 | 哪些内容会变，哪些结果已经稳定？ | GPUI 的复用意识、Warp 的冷热存储区别 |
| 审批与执行 | 谁决定开始，运行后能访问什么？ | 各产品公开权限范围的差异 |
| UI 与持续任务 | 关闭视图是否等于取消任务？ | 由本项目明确选择，不能从界面框架推导 |

首轮跑通<mark class="key">任务 → 模型 → 工具 → 结果</mark>，做到可观察、可停止，再决定优化 UI、上下文、工具或恢复。边界与验收见 [Harness 架构](../architecture/mac-local-harness.md)和[首个 Mac 闭环](../plan/first-mac-loop.md)。

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

先让模型、工具、记录与 UI 分别演进，按需再扩展设备和协议。

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

后续进入[第一个 Mac 闭环](../plan/first-mac-loop.md)，以运行结果补充决策。
