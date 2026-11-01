# Yuuki Box：把好奇心变成一次动手

让 AI 接走一个小 bug，拆开一段越聊越大的模型缓存，或者听 Yuuki 说出第一句话。挑一个让你好奇的问题，做出一个能看见、听见或运行的结果，再顺着它往下挖。

这些实验通向同一个目标：在 Mac 上做出自己的 Agent 工作台，掌握模型调用与工具执行循环，让输入、滚动、切换和取消都及时响应，再把任务能力带到 Mac mini、MacBook Air、iPad 和 iPhone。

学习 AI 应用时，先抓住一条主线：**模型的训练提供能力，context（上下文）提供本次判断的依据，外部工具负责执行动作。**

围绕这条主线，反复追问：

> **它此刻需要知道什么？哪些信息可靠？哪些已经过时？执行以后，又该把什么反馈给它？**

带着这组问题学习 Prompt、上下文组织和 MCP，观察信息如何进入上下文、工具如何执行，以及结果怎样影响下一次判断。

## 阅读入口

现在可以通过 [Astro 文档目录](../site/src/pages/index.astro)一起浏览这些资料。首次在仓库根目录执行 `pnpm i`，之后用 `pnpm docs:dev` 启动，打开终端打印的本地地址。常用命令见[仓库首页](../README.md#常用命令)，详细安装说明见[本地运行](../site/README.md#本地运行)。全文搜索在生产构建与 preview 中可用。

网站首页保留完整列表目录，顶栏的历史图标用于返回已选任务，悬停时显示章节名称；每章开头写清“先做”和“停在这里”。点“开始这一小步”才会把它设为当前任务，临时查资料不会替换它。完成一小步后可以休息，其他专题留到需要时再打开。

**按最快体验云端任务来选，先做 for-safe 的只读小结。** MCP 入门仍是目录里的第一个专题。

| 需要时查阅的专题 | 从哪里出发 | 第一份成果 |
| --- | --- | --- |
| **MCP 入门** | [Codex MCP](ai-from-scaling/00-codex-mcp.md)、[独立演示与 TS 技术栈](ai-from-scaling/00-minimal-mcp.md) | 工具发现、调用、参数校验与文件读写 |
| **AI 搭子（同行者）** | [Side by Side · 和 AI 做朋友](side-by-side/README.md) | 优先实践 Issue 自动化，接回一份经过验证的草稿 PR |
| **模型基础** | [参数、概率与训练](ai-from-scaling/01-understand-models.md) | 训练一个字符模型，解释预测与参数更新 |
| **模型推理与 KV Cache** | [从请求到缓存](kv-cache/README.md) | 算清 KV 容量，解释哪些前缀可以复用 |
| **Agent 工程** | [工具循环、运行控制与 Computer Use](agent-engineering/README.md) | 跑通 Harness，理解外部工具与界面自动化 |
| **MCP 项目实战** | [天气、Blender、GitHub 与音乐项目](mcp-projects/README.md) | 选一个兴趣项目，核对工具结果与最终产物 |
| **远程 MCP 与授权** | [Supabase × WeatherKit](ai-communication/weather-mcp/README.md) | 分清两套凭证，再验证登录、权限与天气查询 |
| **AI 开发实践** | [修复、审查、测试与迁移](ai-practices/README.md) | 一条核实过的审查意见，或一份能验收的修复 diff |
| **应用通信** | [RPC、JSON-RPC、SSE 与 MCP](ai-communication/README.md) | 追踪一次请求、响应与取消 |
| **前端性能** | [查找与缓存](frontend-foundations/README.md)、[浏览器计算](wasm/README.md)、[渲染](learning/rendering-performance.md) | 一组正确输出和工作量对照，解释哪里少做了功 |
| **语音交互** | [edge-tts、Whisper 与 Silero VAD](tts/README.md) | 一句能播放的中文，再接转写与人声检测 |
| **AI 探索（选读）** | [故障驱动、自动实验与知识整理](ai-ideas/README.md) | 一个输入、输出与判定标准都清楚的小实验 |
| **架构研究** | [产品研究](research/zed-raycast-warp.md)、[五路线实现对照](../examples/COMPARISON.md) | 说清一次技术取舍，以及什么证据会改变它 |
| **项目设计与计划** | [本地 Harness 提案](architecture/mac-local-harness.md)、[实施计划](plan/first-mac-loop.md) | 明确一个切片的范围、状态和验收条件 |
| **云端 Codex** | [环境与三个项目练习](codex-cloud/README.md) | 用 for-safe、for-job 与 agent-symphony 练习任务交接、自动检查与本地验收 |
| **Windows 本地 AI** | [图片与音乐生成](windows-local-ai/README.md) | 在 RTX 5060 Ti 16GB 上运行 Qwen Image 与 ACE-Step，保存图片和配乐 |
| **阅读同步** | [最后一课：Apple 登录与阅读同步](learning/apple-reading-sync.md) | 用两张 SVG 分别看开发者如何开发、使用者如何跨设备同步 |
| **附录** | [OpenAI API 模型分类与选型](appendix/openai-api-models.md) | 按用途查阅模型、价格、适用场景与停用计划 |

### MCP 入门

先做[Codex MCP 接入](ai-from-scaling/00-codex-mcp.md)：只写服务端，在真实会话里保存与取回记录。想单独观察协议调用，再做约 30 分钟的[独立 MCP 演示](ai-from-scaling/00-minimal-mcp.md)。需要补齐工程知识时，按需阅读其中的 [TypeScript 技术栈](ai-from-scaling/00-minimal-mcp.md#typescript-stack)。

想先看这些概念从哪来，读[番外：工具调用怎样长成 Agent](ai-from-scaling/extra-tool-use-story.md)——它把 ReAct、Plugins、Code Interpreter、function calling、MCP 与 Skills 串成一条故事线，不要求跟做。

### AI 搭子（同行者）

[AI 搭子（同行者）](side-by-side/README.md)以「Side by Side」为标语，探索怎样与一位有自己名字、表达方式和判断的 AI 朋友相处：一起聊天、思考，也能托付一件事，持续推进和接受纠正。

<span id="issue-工作流"></span>

**当前优先实践 Issue 自动化。** [Issue 夜班](issue-garden/README.md)按扫描、陪同修复、自动交班逐步推进。先让清单出现，再手动验证一个修复，最后连接选择、去重、验证与 PR 发布。它是独立跟做教程，尚未在本仓库启用。

已有 Dot、希望使用现有产品额度，直接看[用 Dot 接手 GitHub 开发任务](issue-garden/04-dot-shift.md)，准备 GitHub 连接和 Codex 云端环境，再试跑一个 Issue。

已有 OpenAI API，选[官方 Codex Action](issue-garden/05-codex-api.md)或 [Agentic Workflows](issue-garden/06-agentic-workflows.md)。可以按[三条路线的并行实验](codex-cloud/05-issue-to-pr.md)使用同一基线、独立 Issue 和分支，对照检查证据、返修与实际用量，再逐步接入持续跟进和自动合并。

<span id="模型基础与推理缓存"></span>

### 模型基础

先读[参数、概率与缩放定律](ai-from-scaling/01-understand-models.md)，再[训练一个字符模型](ai-from-scaling/02-train-a-model.md)。两课到这里即可形成完整成果；训练模型不是学习 MCP 或 Agent 的前置要求。

### 模型推理与 KV Cache

从[一次请求](kv-cache/00-first-request.md)走到 Attention、容量与前缀复用，再对照 [DeepSeek Harness](kv-cache/04-deepseek-harness.md) 和 [Pi](kv-cache/05-pi.md) 的请求装配与用量。浏览器里的 [KV 内存计算器](../site/src/pages/labs/kv-memory.astro)也归在这一专题。无需先运行训练实验；概率与向量陌生时，按正文链接回补。

### Agent 工程

从[搭建 Harness](ai-from-scaling/03-build-a-harness.md)和[接真实模型](ai-from-scaling/04-experiments.md)两课开始。这两课提供可运行代码；后续依次选做[运行控制](agent-engineering/05-harness-vertical-slice.md)、[MCP 接入](agent-engineering/01-mcp-tool-source.md)和 [Skills 复用](agent-engineering/03-skills-structure.md)。后续七个工程练习属于实现建议，尚未接入本仓库 runtime。

准备使用 OpenAI API 额度，打开[额度、图片与语音指南](agent-engineering/openai-api.md)，查看官方入口、到期与续发规则，以及生图、TTS、转写和实时语音的模型选择。想找具体玩法，从[六个社区小实验](agent-engineering/openai-api.md#community-ideas)挑截图记忆库、口答复习卡、学习漫画或语音冒险。

想把语音、音乐与图片做成自己的小作品，读[额度怎么用：语音、音乐与多模态小项目](agent-engineering/openai-api-projects.md)。从三张语音灵感卡开始，或沿配乐草案、本地试听、封面与音乐短片完成一条创作路径。

想让检查随着 Agent 运行自动触发，读 [AI Hooks：Claude Code、DeepSeek Harness 与 Codex](agent-engineering/hooks.md)，从记录工具调用开始，再做一次无害命令的拒绝实验。

想理解 AI 怎样操作电脑，读 [Computer Use 四篇](agent-engineering/computer-use.md)：从截图、AX、DOM 与执行器走到 [Codex 的 cua_repl](agent-engineering/cua-repl.md)，再比较 [Claude、Gemini 与浏览器自动化工具](agent-engineering/computer-use-ecosystem.md)，用[误区自测](agent-engineering/computer-use-misconceptions.md)分清连接、权限与完成证据。

需要 Mac 产品的完整方案时，回查项目设计与计划中的[本地 Harness 设计](architecture/mac-local-harness.md)。

### MCP 项目实战

在[实战总览](mcp-projects/README.md)选择天气、Blender、GitHub 或音乐项目。它们按兴趣选做，分别说明环境、前置知识与验证边界。

本地天气工具可从离线样本开始。音乐两篇从[声部之结](ai-from-scaling/07-music-space-mcp.md)走到[光之剧场](ai-from-scaling/08-music-photo-mcp.md)，不要求先学完模型与 Harness。

### 远程 MCP 与授权

[Supabase × WeatherKit 工程教程](ai-communication/weather-mcp/README.md)独立成篇：用户体验、登录与 OAuth、上游天气 API、MCP 封装、端到端验收。它比本地工具多出账号、数据库和部署条件；先分清用户 token 与 Apple token 的接收方，再决定是否跟做完整工程。

### AI 开发实践

先按任务选择：[交 Issue、接 PR](ai-practices/02-issue-to-pr.md)、[带错误现场去破案](ai-practices/03-error-to-fix.md)、[限定范围做迁移](ai-practices/06-code-migration.md)。想给改动补一道检查，选 [CodeRabbit 审查](ai-practices/01-coderabbit-review.md)、[有效测试](ai-practices/05-test-generation.md)或[安全告警修复](ai-practices/04-security-autofix.md)。

想先少盯几轮，读[你的工作流](ai-practices/your-workflow.md)。六项案例保留公开使用记录及其统计边界，可以独立挑选，不要求逐个安装服务。

### 应用通信

想补 RPC 和 SSE，打开[AI 应用通信：从 RPC、SSE 到 Agent 工具调用](ai-communication/README.md)。每课一张图、一个动作，先请另一个程序读笔记。

六课追踪请求、响应、流式事件、工具发现与失败处理；SSE 入门后增加了[真实 HTTP 实战](ai-communication/03-sse-http.md)，观察断流重连、游标补发与完成状态。学完后可选做独立的远程 MCP 与授权专题。

### 前端性能

按三类问题学习：[数据结构与缓存](frontend-foundations/README.md)、[Wasm 与 Worker](wasm/README.md)、[界面渲染](learning/rendering-performance.md)。再用[十五个场景](learning/harness-scenario-lab.md)追踪更新范围与输入响应。

[数组与 Map](../site/src/pages/labs/lookup.astro)和 [JavaScript 调用 Wasm](../site/src/pages/labs/wasm-bridge.astro)实验紧跟对应知识。想把这些经验与模型缓存、通信问题联系起来，再看[前端与 AI 联读指南](learning/ai-frontend-intersections.md)。

### 语音交互

从[第一句话](tts/让-Yuuki-开口说第一句话.md)开始，用[语音工具](tts/README.md)补上转写和人声检测。准备接进工作台时读[模型与语音基础](architecture/ai-and-speech-foundation.md)。教程保留各自的环境记录与未验证项。

### AI 探索（选读）

[Issue 夜班与独立审查构想](ai-ideas/01-ideas-map.md)摆出协作流程；[故障驱动、自动实验、模拟验收、规格驱动与知识整理](ai-ideas/02-five-new-directions.md)分别提供实验起点。这里保存脑暴与迁移建议；代表方案的公开记录和本项目的验证状态在正文分别说明。

Memory 暂不纳入当前课程计划，相关材料保留为选读，也不作为其他课程的前置条件。

### 架构研究

带着问题读 [Zed、Raycast、Warp](research/zed-raycast-warp.md)，再深入 [Zed、Rust 与 PI-Desktop](deep/2026-09-26-zed-pi-rust/README.md)，或研究[简单、组合与复杂性](deep/2026-09-26-simplicity-composition-complexity/README.md)。想改代码，直接进[五条路线的示例](../examples/README.md)，对照[实现中的收益与代价](../examples/COMPARISON.md)形成判断。

准备系统比较时看[统一评估工具提案](architecture/technology-assessment.md)。可以从最想学的 GPUI、Swift 或 Web 路线开始。

### 项目设计与计划

[本地 Harness 提案](architecture/mac-local-harness.md)说明模块、进程、状态与恢复边界；[第一轮 Mac 闭环计划](plan/first-mac-loop.md)把它拆成可实施的阶段。本页下半部分保留产品方向与历史状态，阅读时按记录日期区分“已有实现”和“待验证方案”。

### 云端 Codex

最快开始选 [`for-safe` 的只读任务](codex-cloud/01-for-safe.md)：创建或选择环境，发送一条指令，核对带文件依据的三项小结就停。其他两个项目、并行实验与[社区案例](codex-cloud/02-community.md)先作为后续材料，完整入口见[云端专题](codex-cloud/README.md)。

### Windows 本地 AI

这个专题从[本地运行基础](windows-local-ai/README.md)开始，按你的 RTX 5060 Ti 16GB、i5-10400F、16GB 内存配置，用 [Qwen Image 首次出图教程](windows-local-ai/01-qwen-image.md)安装 ComfyUI、下载量化模型并保存 PNG；第二课用 [ACE-Step 1.5 Turbo](windows-local-ai/02-ace-step-music.md)生成 30 秒配乐。先完成单张小图和短音乐，再观察生成设置、显存和系统内存的关系。

### 阅读同步

[最后一课：Apple 登录与阅读同步](learning/apple-reading-sync.md)从两个视角说明本站的阅读同步：开发者怎样实现本地进度、登录与云端接口，再配置部署；使用者怎样登录、在手机和电脑之间同步，以及断网后恢复。两个视角各有一张 SVG，登录保持可选；课程明确区分代码与模拟测试、线上接口状态，以及真实账号验证。

## 已确认的产品方向

架构与示例状态记录于 2026-09-26：五条技术路线的 MVP，以及 DeepSeek Agent、持久会话、Whisper 扩展和十五个 Harness 场景实验，已完成实现、构建和打包；当时尚未执行真实 API、语音运行与性能实验。

以下是 **2026-09-26 讨论时**确认的方向与当轮验证范围；其中“跳过测试和 computer-use”只描述那次原型工作，不是后续课程或改动的通用规则：

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

## 附录

[OpenAI API 模型分类与选型](appendix/openai-api-models.md)按通用推理与编程、图片、语音对话、转写、翻译、检索、专业领域和开放权重分类，保留价格、适合本项目的用法与官方来源。较早型号、已弃用模型和停用记录单独列出，资料核对于 2026-11-01。
