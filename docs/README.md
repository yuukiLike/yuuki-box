# Yuuki Box：把好奇心变成一次动手

选一个好奇的问题：交 AI 修 bug、拆模型缓存，或让 Yuuki 开口；做出可见、可听、可运行的结果。

目标是在 Mac 自建 Agent 工作台，掌握模型与工具循环，保持交互及时，再扩展到 Apple 多设备。

先记主线：**训练提供能力，<mark class="key">上下文提供依据</mark>，工具执行动作。**

反复追问：

> **需要知道什么？信息可靠吗、过时了吗？执行后反馈什么？**

据此学习 Prompt、上下文与 MCP：追踪信息、执行与反馈。

## 阅读入口

用 [Astro 目录](../site/src/pages/index.astro)浏览。根目录 `pnpm i` 后运行 `pnpm docs:dev`；`pnpm run` 查演示脚本。[安装说明](../site/README.md#本地运行)。全文搜索需生产构建或 preview。

首页提供目录与继续阅读；文章的“本章目标”默认收起。点“开始”才选择任务，查资料不替换；完成后可停。

**最快云端体验选 for-safe 只读小结。** MCP 按入门、实战、授权学习。

| 需要时查阅的专题 | 从哪里出发 | 第一份成果 |
| --- | --- | --- |
| **MCP 入门** | [Codex MCP](ai-from-scaling/00-codex-mcp.md) | Server 保存与取回记录 |
| **MCP 项目实战** | [天气、Blender、GitHub 与音乐项目](mcp-projects/README.md) | 一个兴趣项目及工具产物 |
| **远程 MCP 与授权** | [Supabase × WeatherKit](ai-communication/weather-mcp/README.md) | 凭证、登录、权限与天气查询 |
| **AI 搭子（同行者）** | [Side by Side · 和 AI 做朋友](side-by-side/README.md) | Issue 自动化与已验证草稿 PR |
| **模型基础** | [参数、概率与训练](ai-from-scaling/01-understand-models.md) | 字符模型、预测与参数更新 |
| **模型推理与 KV Cache** | [从请求到缓存](kv-cache/README.md) | KV 容量与前缀复用 |
| **Agent 工程** | [工具循环、运行控制与 Computer Use](agent-engineering/README.md) | Harness、工具与界面自动化 |
| **AI 开发实践** | [修复、审查、测试与迁移](ai-practices/README.md) | 有效审查意见或可验修复 diff |
| **应用通信** | [RPC、JSON-RPC、SSE 与 MCP](ai-communication/README.md) | 追踪一次请求、响应与取消 |
| **前端性能** | [查找与缓存](frontend-foundations/README.md)、[浏览器计算](wasm/README.md)、[渲染](learning/rendering-performance.md) | 正确输出与工作量对照 |
| **语音交互** | [edge-tts、Whisper 与 Silero VAD](tts/README.md) | 一句能播放的中文，再接转写与人声检测 |
| **AI 探索（选读）** | [故障驱动、自动实验与知识整理](ai-ideas/README.md) | 输入、输出、标准明确的实验 |
| **架构研究** | [产品研究](research/zed-raycast-warp.md)、[五路线实现对照](../examples/COMPARISON.md) | 技术取舍与重评证据 |
| **项目设计与计划** | [本地 Harness 提案](architecture/mac-local-harness.md)、[实施计划](plan/first-mac-loop.md) | 明确一个切片的范围、状态和验收条件 |
| **云端 Codex** | [环境与三个项目练习](codex-cloud/README.md) | 三个项目的任务、检查与本地验收 |
| **Windows 本地 AI** | [图片与音乐生成](windows-local-ai/README.md) | RTX 5060 Ti 16GB 上的图片与配乐 |
| **阅读同步** | [最后一课：Apple 登录与阅读同步](learning/apple-reading-sync.md) | 开发与跨设备同步的两张图 |
| **附录** | [OpenAI API 模型分类与选型](appendix/openai-api-models.md) | 按用途查阅模型、价格、适用场景与停用计划 |

### MCP 入门

先做 [Codex 接入](ai-from-scaling/00-codex-mcp.md)，写 Server 保存与取回记录，再选 [MCP 实战](mcp-projects/README.md)。

写客户端、查通信时，再做约 30 分钟的[选修实验](ai-from-scaling/00-minimal-mcp.md)；只写 Server 可跳过。[TypeScript](ai-from-scaling/00-minimal-mcp.md#typescript-stack)按需补齐。

[工具调用简史](ai-from-scaling/extra-tool-use-story.md)串联 ReAct、Plugins、Code Interpreter、函数调用、MCP、Skills，仅选读。

### MCP 项目实战

从[实战总览](mcp-projects/README.md)按兴趣选天气、Blender、GitHub 或音乐，逐项核对前置与验证边界。

天气先用离线样本；音乐从[声部之结](ai-from-scaling/07-music-space-mcp.md)到[光之剧场](ai-from-scaling/08-music-photo-mcp.md)，不以模型／Harness 为前置。

### 远程 MCP 与授权

[Supabase × WeatherKit](ai-communication/weather-mcp/README.md)含体验、OAuth、天气 API、MCP 与验收；需账号、数据库、部署，先分清用户与 Apple token。

### AI 搭子（同行者）

[AI 搭子](side-by-side/README.md)以 Side by Side 为标语：一起思考、托付任务、持续推进并接受纠正。

<span id="issue-工作流"></span>

**优先 Issue 自动化。** [Issue 夜班](issue-garden/README.md)依次做清单、手动修复，再连接选择、去重、验证与 PR；本仓库未启用。

已有产品额度，按 [Dot 路线](issue-garden/04-dot-shift.md)连接 GitHub、准备 Cloud 环境，试一个 Issue。

API 选 [Codex Action](issue-garden/05-codex-api.md)或 [Agentic Workflows](issue-garden/06-agentic-workflows.md)；按[并行实验](codex-cloud/05-issue-to-pr.md)隔离任务、比较证据和用量，再接持续流程。

<span id="模型基础与推理缓存"></span>

### 模型基础

先读[参数与概率](ai-from-scaling/01-understand-models.md)，再[训练字符模型](ai-from-scaling/02-train-a-model.md)；训练不是 MCP／Agent 前置。

### 模型推理与 KV Cache

从[请求](kv-cache/00-first-request.md)学 Attention、容量和前缀，再看 [Harness](kv-cache/04-deepseek-harness.md)、[Pi](kv-cache/05-pi.md)与[计算器](../site/src/pages/labs/kv-memory.astro)；概率、向量按需回补。

### Agent 工程

先做[Harness](ai-from-scaling/03-build-a-harness.md)、[接模型](ai-from-scaling/04-experiments.md)的可运行实验，再按需选[运行控制](agent-engineering/05-harness-vertical-slice.md)、[MCP](agent-engineering/01-mcp-tool-source.md)、[Skills](agent-engineering/03-skills-structure.md)。后续七项为未接入 runtime 的建议。

[API 指南](agent-engineering/openai-api.md)列领取、到期、模型入口；[社区实验](agent-engineering/openai-api.md#community-ideas)提供截图记忆、口答卡、漫画与语音冒险。

[多模态小项目](agent-engineering/openai-api-projects.md)从语音灵感卡走向配乐、本地试听、封面与短片。

[Hooks](agent-engineering/hooks.md)先记录工具调用，再试无害命令拒绝。

[Computer Use](agent-engineering/computer-use.md)解释截图、AX、DOM 与执行器，再看 [cua_repl](agent-engineering/cua-repl.md)、[工具比较](agent-engineering/computer-use-ecosystem.md)与[误区自测](agent-engineering/computer-use-misconceptions.md)。

需要 Mac 产品的完整方案时，回查项目设计与计划中的[本地 Harness 设计](architecture/mac-local-harness.md)。

### AI 开发实践

按需选[Issue 修复](ai-practices/02-issue-to-pr.md)、[故障诊断](ai-practices/03-error-to-fix.md)、[迁移](ai-practices/06-code-migration.md)、[审查](ai-practices/01-coderabbit-review.md)、[测试](ai-practices/05-test-generation.md)、[安全修复](ai-practices/04-security-autofix.md)。

减少验收看[工作流](ai-practices/your-workflow.md)；六项案例各自标明证据边界，无需逐个安装。

### 应用通信

[应用通信](ai-communication/README.md)每课一图一动作，先让程序读笔记。

六课追请求、响应、事件、发现与失败；[HTTP 实战](ai-communication/03-sse-http.md)补断线、游标与完成状态，再按需接远程授权。

### 前端性能

按问题选[缓存](frontend-foundations/README.md)、[Wasm／Worker](wasm/README.md)、[渲染](learning/rendering-performance.md)，用[十五场景](learning/harness-scenario-lab.md)追更新与响应。

[Map](../site/src/pages/labs/lookup.astro)、[Wasm](../site/src/pages/labs/wasm-bridge.astro)实验随课；跨模型与通信的联系看[联读指南](learning/ai-frontend-intersections.md)。

### 语音交互

从[第一句话](tts/让-Yuuki-开口说第一句话.md)到[转写、人声检测](tts/README.md)，接工作台前看[基础设计](architecture/ai-and-speech-foundation.md)；各篇保留未验项。

### AI 探索（选读）

[协作构想](ai-ideas/01-ideas-map.md)与[五个实验方向](ai-ideas/02-five-new-directions.md)保留脑暴、迁移建议，公开记录与本项目验证分列。

Memory 仅选读，不列课程或前置。

### 架构研究

按需读[产品研究](research/zed-raycast-warp.md)、[Zed／Rust](deep/2026-09-26-zed-pi-rust/README.md)、[简单与组合](deep/2026-09-26-simplicity-composition-complexity/README.md)；动手看[示例](../examples/README.md)与[取舍对照](../examples/COMPARISON.md)。

[统一评估提案](architecture/technology-assessment.md)供系统比较，可从 GPUI、Swift 或 Web 开始。

### 项目设计与计划

[Harness 提案](architecture/mac-local-harness.md)说明进程、状态与恢复，[首轮计划](plan/first-mac-loop.md)拆阶段；历史状态按日期区分实现与待验。

### 云端 Codex

先选 [`for-safe` 只读任务](codex-cloud/01-for-safe.md)，核对三项小结即可；其他项目与[社区案例](codex-cloud/02-community.md)按需续读，入口见[云端专题](codex-cloud/README.md)。

### Windows 本地 AI

按 RTX 5060 Ti 16GB、i5-10400F、16GB 内存，从[本地基础](windows-local-ai/README.md)到 [Qwen Image](windows-local-ai/01-qwen-image.md)安装 ComfyUI、量化出图，再用 [ACE-Step](windows-local-ai/02-ace-step-music.md)做 30 秒配乐；小图短曲后再观察资源关系。

### 阅读同步

[Apple 阅读同步](learning/apple-reading-sync.md)用两图分开发者与使用者：实现、部署，以及登录、跨设备、离线恢复；登录可选，代码、线上与真账号验证分列。

## 已确认的产品方向

状态记录：2026-09-26。五路线 MVP、DeepSeek Agent、持久会话、Whisper 扩展及十五场景已实现、构建、打包；真实 API、语音与性能未验。

以下为 **2026-09-26** 的方向与原型验证范围；“跳过测试和 computer-use”仅限当轮：

- 面向自己的 Apple 生态，最终覆盖 Mac mini、MacBook Air、iPad 和 iPhone。
- 重视性能、简单，以及可以长期演进的结构。
- 自建模型调用与工具执行循环，掌控 Agent 运行时。
- 第一阶段只做 Mac 本地闭环，之后逐步增加远程设备。
- 同时开展自己的学习，重点理解 Zed、Raycast 等产品的流畅体验。
- 并行实现五个 Mac MVP，亲手接触 Rust/GPUI 等路线，通过任务列表、流式输出、语音与更新检查比较开发体验。
- 本轮允许跳过测试验证和 computer-use；实际保留编译、打包，不进行 GUI、录音与性能测量。

**Harness** 管上下文、工具、权限、运行状态、取消、用量与恢复；模型输出工具调用不代表机制已存在。

## 当前推荐，尚待原型验证

| 问题 | 当前建议 | 验证或重评条件 |
|---|---|---|
| Mac 界面 | 五条路线均已进入实验，暂不指定胜者 | 亲手修改与使用，再按需要做相同负载的性能对照 |
| 运行时语言 | Swift 与 Rust 都是候选；保持 model/tool loop 不依赖具体 UI | 依据库、状态模型、平台集成与维护体验决定；可直接学习 Rust |
| 生命周期 | UI 与 Runner 分离，明确各阶段退出语义 | 需要关闭应用后继续运行时，验证独立 helper 管理 |
| 数据 | SQLite 保存状态和事件，普通文件保存大型产物 | 依据实际查询、写入、归档负载调整 |
| 工具扩展 | 先内建少量工具，保留清楚的输入输出契约 | 出现具体第三方接入需求时添加 MCP 等适配 |
| 多设备 | 一次运行属于一台执行主机，其他设备发送操作、订阅结果 | 完成本地恢复后再做认证、连接与事件补发 |

这些是待验证建议。示例已用 Swift 子进程、DeepSeek、有限工具循环、写入审批和原子 JSON 会话；无常驻服务或 SQLite，五 UI 与后续 Rust 对照仍开放。

## 三项需要记住的调研结论

1. **Raycast 的架构有版本边界。** v1 的 React 扩展映射到 AppKit 控件；v2 已采用 Swift/AppKit 宿主、WKWebView/React UI、Node 与 Rust 的混合结构。相关官方 API 文档仍有旧描述，引用时必须标明上下文。[v1 工程文](https://www.raycast.com/blog/how-raycast-api-extensions-work)、[v2 工程文](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)
2. **Zed 的实现可以分开学习。** GPUI 解决绘制与交互，CRDT 解决并发文本编辑，Wasm 扩展与工具权限各有自己的边界。这些能力不必一起引入你的首版。[GPUI](https://zed.dev/blog/videogame)、[CRDT](https://zed.dev/blog/crdts)、[扩展能力](https://zed.dev/docs/extensions/capabilities)
3. **Warp 的结构化输出值得借鉴，公开范围也要看清。** 其 Block 模型把命令、输出和丰富内容组织起来；客户端已开源，但官方说明内置服务端 Harness 尚未开源。[Block 模型](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)、[仓库 FAQ](https://github.com/warpdotdev/warp/blob/master/FAQ.md)

流畅须测量输入工作量、长会话更新、主线程阻塞、输出积压与空闲能耗，不能从框架名推断。

## 现在可以直接开始的工作

**沿点击、事件追加与语音请求读一份示例。** Rust 可从 [GPUI](../examples/rust-gpui/README.md) 的 `Render`、`uniform_list`、`Context`、`notify()` 开始。

五应用含固定事件、任务、流式回答、审批、会话、导出及共享语音 helper；权限、识别、DeepSeek 未实际操作，更新仅查清单。 [examples 入口](../examples/README.md)

可填 DeepSeek key、练习目录，准备 whisper.cpp CLI／small 模型，沿模型流、审批、取消与转写学习；恢复、性能、分发仍属[开发计划](plan/first-mac-loop.md)。

## 事实与证据约定

- **用户确认**：用户在会话中明确表达的目标与范围。
- **公开事实**：官方文章、文档或源码支持的陈述，紧邻来源链接。
- **本地观察**：本轮实际执行命令得到的环境信息，记录在开发计划中。
- **设计建议**：针对 Yuuki Box 的推断和取舍，需要通过实现与实验验证。
- **待验证**：未运行的性能测试、未确定的产品选择，以及公开资料无法确认的内部机制。

`main`／`master` 是变化的阅读入口；做实现决策或复用前记录提交、接口与许可证。

本项目无启动、FPS、内存、耗电或吞吐实测；性能数值须标为目标或来源测量。

## 文档如何继续维护

里程碑完成后更新计划与实测链接；取舍获接受才成决定，<mark class="caution">用例实际运行才记通过</mark>。

后续确认模型商、首批任务、最低系统和退出语义；不阻塞模拟事件与 UI 实验。

## 附录

[模型附录](appendix/openai-api-models.md)按用途列价格、用法、来源，旧型、弃用和停用分列；核对于 2026-11-01。