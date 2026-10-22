# Yuuki Box：Apple 生态 Agent 工作台调研与起步

架构与示例状态记录日期：2026-09-26。当前阶段：架构调研与五条技术路线的 MVP 已落地，DeepSeek Agent、持久会话与 Whisper 扩展，以及新增的十五个 Harness 场景实验，已完成五路线构建和打包；真实 API/语音运行与性能实验尚未执行。

这组文档服务于一个具体目标：先在 Mac 上做出自己的 Agent 工作台，掌握模型调用与工具执行循环，并让输入、滚动、切换和取消保持及时响应。随后再把同一套任务能力带到 Mac mini、MacBook Air、iPad 和 iPhone。

## 阅读入口

现在可以通过 [Astro 文档目录](../site/src/pages/index.astro)一起浏览这些资料。首次在仓库根目录执行 `pnpm i`，之后用 `pnpm docs:dev` 启动，打开终端打印的本地地址。全文搜索在生产构建与 preview 中可用。

想先看当前选型结论，读[根 README：五路线选择与推荐架构](../README.md)。它给出 SwiftUI/AppKit 默认主线、GPUI 与 Web 路线的适用条件，并用 2026-09-26 核实的一手资料说明哪些证据会改变推荐。

| 文档 | 内容 | 什么时候读 |
|---|---|---|
| [前端的数据结构与缓存](frontend-foundations/README.md) | key、Map、WeakMap、缓存身份、容量与数据保留 | 从熟悉的前端问题开始时 |
| [Wasm 与浏览器 AI](wasm/README.md) | JavaScript 调用边界、Worker、数据搬运与推理后端 | 想新开一条 AI 与前端交织的学习线时 |
| [AI 与前端的交织点](learning/ai-frontend-intersections.md) | 缓存、Wasm、流式渲染、语音、检索与任务生命周期 | 想一起比较下一步探索方向时 |
| [🍀 让 Issue 慢慢长成 PR](issue-garden/README.md) | 只读扫描、定时修复、独立 review，以及五个人机协作新方向与思维导图 | 想让 AI 参与开发，再选择自己的小实验时 |
| [🍀 已有落地的 AI 开发实践](ai-practices/README.md) | CodeRabbit，以及 Issue 委派、故障诊断、安全修复、测试增强、版本迁移的真实案例 | 想从已有证据选择一项可尝试的实践时 |
| [🍀 你的工作流：减少验收与返工](ai-practices/your-workflow.md) | 当前工作方式、五项业界实践与按项目适配的一个小实验 | 想减少重复操作和同一问题的多轮修正时 |
| [Zed、Raycast、Warp 架构调研](research/zed-raycast-warp.md) | 已公开实现、版本变化、源码入口、性能与扩展边界 | 先理解三款产品各自解决的问题 |
| [Deep：Zed、Rust 与 PI-Desktop](deep/2026-09-26-zed-pi-rust/README.md) | Rust 动机、crate 分工、真实调用链、混合架构与可复查清单 | 深入理解 Rust 如何与 UI、Agent、平台能力搭配 |
| [Deep：简单、组合、复杂性](deep/2026-09-26-simplicity-composition-complexity/README.md) | Raycast、Warp、Zed、Grok Build 的组合单位、契约与成本；Yuuki 的实际变化链 | 想理解优秀产品如何保持简单，以及抽象在哪里失效时 |
| [Mac 本地 Harness 架构提案](architecture/mac-local-harness.md) | 模型循环、工具、事件、权限、进程、持久化与恢复 | 准备确定实现边界时 |
| [从前端增量计算理解 KV Cache](kv-cache/README.md) | useMemo、前缀依赖、JavaScript 实验、Attention、内存与 DeepSeek 缓存观测 | 从前端经验开始学习大模型缓存时 |
| [渲染性能学习与实验](learning/rendering-performance.md) | 一帧的工作、增量更新、长列表、流式文本、测量方法 | 想理解“跟手”从何而来时 |
| [十五个 Harness 场景实验](learning/harness-scenario-lab.md) | 五条路线各三个真实对照，朴素/优化路径、操作方法与维护代价 | 想亲手感受负载和优化的差异时 |
| [第一轮 Mac 闭环开发计划](plan/first-mac-loop.md) | 环境现状、第一项任务、里程碑、验收与停止调研条件 | 准备直接开始开发时 |
| [五条路线的可运行示例](../examples/README.md) | Swift、GPUI、React 原生桥、WKWebView、Electron 的源码和应用包 | 想马上接触技术、修改代码时 |
| [实现中的优点与代价](../examples/COMPARISON.md) | 渲染、桥接、语音、更新与构建的具体成本 | 对照亲手体验，形成自己的判断时 |
| [五条路线的统一评估工具提案](architecture/technology-assessment.md) | 性能采集、架构边界、开发成本与统一报告 | 想系统比较这五种实现时 |
| [AI 与语音基础](architecture/ai-and-speech-foundation.md) | DeepSeek、工具循环、Keychain、Whisper 模型接入与相关框架 | 准备给 MVP 配置真实 AI 与语音时 |
| [给 Yuuki 装上耳朵和嘴巴](tts/README.md) | 三个免费语音工具的下载方式，每个两个基础用法 | 想先听见自己的 AI 开口说话时 |

可以直接从最感兴趣的一份示例开始，再随实现回查调研和架构文档。不要求读完所有外部来源，也不要求先完成 Swift 路线才接触 GPUI。

## 已确认的产品方向

以下来自用户在本轮讨论中的明确选择：

- 面向自己的 Apple 生态，最终覆盖 Mac mini、MacBook Air、iPad 和 iPhone。
- 重视性能、简单，以及可以长期演进的结构。
- 自建模型调用与工具执行循环，掌控 Agent 运行时。
- 第一阶段只做 Mac 本地闭环，之后逐步增加远程设备。
- 同时开展自己的学习，重点理解 Zed、Raycast 等产品的流畅体验。
- 并行实现五个 Mac MVP，亲手接触 Rust/GPUI 等路线，通过任务列表、流式输出、语音与更新检查比较开发体验。
- 本轮允许跳过测试验证和 computer-use；实际保留编译、打包，不进行 GUI、录音与性能测量。

这里的 **Harness** 指包围模型的一组执行机制：上下文组织、工具调用、权限决策、运行状态、取消、用量和恢复。模型生成一个工具调用，并不意味着这些机制已经存在。

## 当前推荐，尚待原型验证

| 问题 | 当前建议 | 验证或重评条件 |
|---|---|---|
| Mac 界面 | 五条路线均已进入实验，暂不指定胜者 | 亲手修改与使用，再按需要做相同负载的性能对照 |
| 运行时语言 | Swift 与 Rust 都是候选；保持 model/tool loop 不依赖具体 UI | 依据库、状态模型、平台集成与维护体验决定；可直接学习 Rust |
| 生命周期 | UI 与 Runner 分离，明确各阶段退出语义 | 需要关闭应用后继续运行时，验证独立 helper 管理 |
| 数据 | SQLite 保存状态和事件，普通文件保存大型产物 | 依据实际查询、写入、归档负载调整 |
| 工具扩展 | 先内建少量工具，保留清楚的输入输出契约 | 出现具体第三方接入需求时添加 MCP 等适配 |
| 多设备 | 一次运行属于一台执行主机，其他设备发送操作、订阅结果 | 完成本地恢复后再做认证、连接与事件补发 |

这些是设计建议，不能作为用户已经确认的最终技术决策。最新示例已实现共享 Swift 子进程运行时、DeepSeek 接口、有限工具循环、写入审批与原子 JSON 会话存储；没有后台常驻服务或 SQLite。五条 UI 仍并行探索，Swift 运行时也不排除后续 Rust 对照。

## 三项需要记住的调研结论

1. **Raycast 的架构有版本边界。** v1 的 React 扩展映射到 AppKit 控件；v2 已采用 Swift/AppKit 宿主、WKWebView/React UI、Node 与 Rust 的混合结构。相关官方 API 文档仍有旧描述，引用时必须标明上下文。[v1 工程文](https://www.raycast.com/blog/how-raycast-api-extensions-work)、[v2 工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)
2. **Zed 的实现可以分开学习。** GPUI 解决绘制与交互，CRDT 解决并发文本编辑，Wasm 扩展与工具权限各有自己的边界。这些能力不必一起引入你的首版。[GPUI](https://zed.dev/blog/videogame)、[CRDT](https://zed.dev/blog/crdts)、[扩展能力](https://zed.dev/docs/extensions/capabilities)
3. **Warp 的结构化输出值得借鉴，公开范围也要看清。** 其 Block 模型把命令、输出和丰富内容组织起来；客户端已开源，但官方说明内置服务端 Harness 尚未开源。[Block 模型](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)、[仓库 FAQ](https://github.com/warpdotdev/warp/blob/master/FAQ.md)

流畅不能仅由语言或 UI 框架的名字推导。首轮需要测量的，是每次输入造成的工作量、长会话的更新范围、主线程阻塞、输出积压和空闲能耗。

## 现在可以直接开始的工作

**打开一份已构建的示例，沿着一次点击、一次事件追加和一次语音请求阅读代码。** 想学习 Rust 和绘制，可直接从 [GPUI 示例](../examples/rust-gpui/README.md) 的 `Render`、`uniform_list`、`Context` 与 `notify()` 开始。

五份应用保留共同固定事件实验，并增加任务、流式回答、工具审批、会话与导出。Apple Speech 和 Whisper 均通过共享 helper 接入；权限、真实识别和 DeepSeek 调用未实际操作，更新仍只做清单检查。具体边界见 [examples 入口](../examples/README.md)。

下一步可以在应用设置中填入 DeepSeek key 和练习目录，随后准备 whisper.cpp CLI 与 small 模型。沿模型流、工具审批、取消和转写到草稿的路径学习，再决定深入哪条路线。生产恢复、性能和正式分发仍属于[第一轮开发计划](plan/first-mac-loop.md)，不把源码实现等同于完整运行验收。

## 事实与证据约定

- **用户确认**：用户在会话中明确表达的目标与范围。
- **公开事实**：官方文章、文档或源码支持的陈述，紧邻来源链接。
- **本地观察**：本轮实际执行命令得到的环境信息，记录在开发计划中。
- **设计建议**：针对 Yuuki Box 的推断和取舍，需要通过实现与实验验证。
- **待验证**：未运行的性能测试、未确定的产品选择，以及公开资料无法确认的内部机制。

源码中的 `main` / `master` 链接是阅读入口，会继续变化；本文不声称绑定某个固定提交。做具体实现决策或代码复用前，应记录当时的提交、接口与许可证。

目前没有本项目的启动时间、FPS、内存、耗电或吞吐实测结果。文档里的性能数值只能是明确标注的初始目标或来源自己的历史测量。

## 文档如何继续维护

完成每个里程碑后，在开发计划中更新状态并链接实测记录。只有被接受的取舍才从“建议”升级为“决定”；只有实际跑过的用例才从“待验证”升级为“通过”。

后续最先需要确认的事项是模型提供方、首批工作任务、最低系统版本和关闭应用后的运行语义。这些不阻塞最早的模拟事件与界面实验。
