# Yuuki Box：把好奇心变成一次动手

让 AI 接走一个小 bug，拆开一段越聊越大的模型缓存，或者听 Yuuki 说出第一句话。挑一个让你好奇的问题，做出一个能看见、听见或运行的结果，再顺着它往下挖。

这些实验通向同一个目标：在 Mac 上做出自己的 Agent 工作台，掌握模型调用与工具执行循环，让输入、滚动、切换和取消都及时响应，再把任务能力带到 Mac mini、MacBook Air、iPad 和 iPhone。

## 阅读入口

现在可以通过 [Astro 文档目录](../site/src/pages/index.astro)一起浏览这些资料。首次在仓库根目录执行 `pnpm i`，之后用 `pnpm docs:dev` 启动，打开终端打印的本地地址。全文搜索在生产构建与 preview 中可用。

目录按“想做成什么”分成六条路线。工具名留在对应章节里，浏览器实验紧跟它解释的概念。

| 现在想做什么 | 从哪里出发 | 第一份成果 |
| --- | --- | --- |
| **让 AI 接手开发** | [挑一件真活](ai-practices/README.md) | 一条核实过的审查意见，或一份能验收的修复 diff |
| **亲手搭 Agent** | [从会聊天，到能把活干完](agent-engineering/README.md) | 一次能取消、能解释终态的工具运行 |
| **前端 × AI 实验室** | [挑个问题开实验](learning/ai-frontend-intersections.md) | 一组正确输出和工作量对照，解释哪里少做了功 |
| **让 Yuuki 听见和开口** | [给它装上耳朵和嘴巴](tts/README.md) | 一句能播放的中文，再接转写与人声检测 |
| **试试下一种 AI 玩法** | [给点子找块试验田](ai-ideas/README.md) | 一个输入、输出与判定标准都清楚的小实验 |
| **读架构，选路线** | [五路线选择与推荐架构](../README.md) | 说清一次技术取舍，以及什么证据会改变它 |

### 让 AI 接手开发

先按任务选择：[交 Issue、接 PR](ai-practices/02-issue-to-pr.md)、[带错误现场去破案](ai-practices/03-error-to-fix.md)、[限定范围做迁移](ai-practices/06-code-migration.md)。想给改动补一道检查，选 [CodeRabbit 审查](ai-practices/01-coderabbit-review.md)、[有效测试](ai-practices/05-test-generation.md)或[安全告警修复](ai-practices/04-security-autofix.md)。

想串成自己的流程，就跟做 [Issue 夜班](issue-garden/README.md)。想先少盯几轮，读[你的工作流](ai-practices/your-workflow.md)。六项案例有公开使用记录；夜班是跟做教程，尚未在本仓库启用。

### 亲手搭 Agent

按实际建设顺序走：先用 [Harness 管稳运行](agent-engineering/05-harness-vertical-slice.md)，再用 [MCP 接工具](agent-engineering/01-mcp-tool-source.md)，用 [Skills 复用流程](agent-engineering/03-skills-structure.md)。需要完整设计时回查 [Mac 本地 Harness](architecture/mac-local-harness.md)。这一组是实现实验建议，验收目标写在各篇里。

### 前端 × AI 实验室

从[数据结构与缓存](frontend-foundations/README.md)走到 [KV Cache](kv-cache/README.md)，从 [Wasm 与 Worker](wasm/README.md)走到浏览器计算，再用[渲染学习路线](learning/rendering-performance.md)和[十五个场景](learning/harness-scenario-lab.md)追踪界面卡在哪里。

三个浏览器实验就在对应专题旁：[数组与 Map](../site/src/pages/labs/lookup.astro)、[KV 内存计算器](../site/src/pages/labs/kv-memory.astro)、[JavaScript 调用 Wasm](../site/src/pages/labs/wasm-bridge.astro)。先玩一个，再回来找解释。

### 让 Yuuki 听见和开口

从[第一句话](tts/让-Yuuki-开口说第一句话.md)开始，用[语音工具](tts/README.md)补上转写和人声检测。准备接进工作台时读[模型与语音基础](architecture/ai-and-speech-foundation.md)。教程保留各自的环境记录与未验证项。

### 试试下一种 AI 玩法

[构想地图](ai-ideas/01-ideas-map.md)摆出已有设想，[五个新方向](ai-ideas/02-five-new-directions.md)提供实验起点。这里保存脑暴与迁移建议；代表方案的公开记录和本项目的验证状态在正文分别说明。

### 读架构，选路线

带着问题读 [Zed、Raycast、Warp](research/zed-raycast-warp.md)，再深入 [Zed、Rust 与 PI-Desktop](deep/2026-09-26-zed-pi-rust/README.md)，或研究[简单、组合与复杂性](deep/2026-09-26-simplicity-composition-complexity/README.md)。想改代码，直接进[五条路线的示例](../examples/README.md)，对照[实现中的收益与代价](../examples/COMPARISON.md)形成判断。

准备收敛实现时看[第一轮 Mac 闭环计划](plan/first-mac-loop.md)；准备系统比较时看[统一评估工具提案](architecture/technology-assessment.md)。可以从最想学的 GPUI、Swift 或 Web 路线开始。

## 已确认的产品方向

架构与示例状态记录于 2026-09-26：五条技术路线的 MVP，以及 DeepSeek Agent、持久会话、Whisper 扩展和十五个 Harness 场景实验，已完成实现、构建和打包；当时尚未执行真实 API、语音运行与性能实验。

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
