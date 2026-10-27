# 番外：工具调用怎样长成 Agent

[课程目录](README.md) · [Harness 那一篇](03-build-a-harness.md)

**这一篇是故事，不是跟做。** 它不讲 API，也不要求你改代码。它只回答一个问题：主线里那些看起来理所当然的东西——工具循环、function calling、MCP、Harness——分别是从哪里来的？

先把结论放在前面：**今天的 Agent 行业不是被设计出来的，是被拼出来的。** 几乎每个关键零件，都来自一个当时没成、或者没想那么远的东西。

## 先记住四个零件

绕开产品名，先看四件事：

| 零件 | 解决的问题 | 后来的代表 |
| --- | --- | --- |
| 循环 | 模型怎样连续行动，而不是答一句就停 | ReAct、agent loop |
| 动作接口 | 模型怎样把“我想做什么”说成程序能执行的东西 | function calling |
| 执行机构 | 谁真正动手，以及怎样保证它不闯祸 | Code Interpreter、Harness |
| 发现协议 | 工具怎样被找到、被调用，而不必一家家写适配器 | MCP |

后面出现的产品，基本都在补其中一块。有时补上了，有时只留下一个教训。

## 前史：各自为战的实验

### WebGPT 与 SayCan：先让动作落地

2021 年底，[WebGPT](https://arxiv.org/abs/2112.09332) 让模型自己搜索网页、点链接、引用来源，再用人类反馈微调。它证明了一件后来被反复验证的事：**模型加检索加引用，比纯模型更可信。**

2022 年，[SayCan](https://arxiv.org/abs/2204.01691) 让语言模型给机器人提动作建议，再由一个“可行性模型”过滤。你说“去拿苹果”，机器人得先判断自己够不够得着。

留下的零件：**可行性校验**。“模型想做的”和“实际能做的”必须分开。今天的 schema 校验、权限审批、沙箱，都是这个思想的远亲。

### ReAct：把思考变成循环

2022 年 10 月的 [ReAct](https://arxiv.org/abs/2210.03629) 贡献极其朴素：让模型交替输出“思考”和“动作”，再把动作结果作为“观察”塞回上下文。

```text
Thought: 我需要先看目录
Action: ls
Observation: ...
Thought: 看到了 server.ts
```

它证明了**冻结的模型、不微调，只靠提示词也能行动**。但动作靠解析文本，换模型、换措辞、加一句解释，解析就可能失败。

留下的零件：**agent loop**，今天所有 Agent 的心跳。

### MRKL 与 LangChain：路由和工具抽象

2022 年 5 月的 [MRKL](https://arxiv.org/abs/2205.00445) 提出“路由器加专家模块”：模型判断该问计算器、知识库还是数据库。[LangChain](https://github.com/langchain-ai/langchain) 则把 tool、agent、memory 做成开发者 API，让“给模型接工具”从论文变成几行代码。

留下的零件：**工具描述加路由**，以及“agent”这个开发者词汇。LangChain 后来被批评抽象过重，但它确实教会了一代开发者 Agent 长什么样。

### Toolformer：工具使用可以被训练

2023 年 2 月，Meta 的 [Toolformer](https://arxiv.org/abs/2302.04761) 用自监督方法让模型学会在文本里插入 API 调用，只保留那些能降低后续预测损失的调用。它说明：**“什么时候该调工具”不一定要靠提示词，也可以训练进模型。**

留下的零件：**native tool calling 的研究合法性**。半年后 OpenAI 的 function calling，产品形态不同，底层信念一致。

同一时期还有几个容易被忽略的实验：[HuggingGPT](https://arxiv.org/abs/2303.17580) 让 LLM 当调度器，把任务分给不同的模型；[Gorilla](https://arxiv.org/abs/2305.15334) 练习从大量 API 里检索出正确的那一个；[Voyager](https://arxiv.org/abs/2305.16291) 在 Minecraft 里把代码当动作，还攒下可复用的技能库。它们分别预演了后来的多工具路由、工具发现和 Skills。

### AutoGPT：产品幻觉与失败清单

2023 年 3 月，[AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) 和 [BabyAGI](https://github.com/yoheinakajima/babyagi) 病毒式传播：给一个目标，它自己拆任务、搜索、写文件、跑 shell、反思、继续。第一次让大众看到“AI 自己干活”。

但它也第一次把 Agent 的失败模式全部暴露出来：

- 死循环、目标漂移
- token 成本爆炸
- 错误层层累积
- 没有审批，敢删文件
- 上下文越滚越大，最后爆掉

留下的零件：**一份失败模式清单**。今天 Harness 的每一项——步数上限、预算、checkpoint、权限、上下文压缩——都是在还这笔债。

## 2023 年 3 月：两条岔路

2023 年 3 月 23 日，OpenAI 同时放出了 ChatGPT Plugins 和 Code Interpreter。它们都在回答“怎样让模型不止会聊天”，但给出的答案几乎相反。

### Plugins：把工具做成平台

[Plugins](https://openai.com/index/chatgpt-plugins/) 的设想是“AI 的应用商店”：第三方写一个 `ai-plugin.json` 清单和一份 OpenAPI 规范，ChatGPT 就能调用你的服务。订餐厅、查航班、买股票，全靠模型自己选。

它为什么让人兴奋：第一次有“模型即操作系统，插件即 App”的叙事。

它为什么没成：

- **发现难**：插件一多，模型根本选不准；平台还得先检索候选，再让模型挑。
- **契约太重**：OpenAPI 是写给人类开发者看的，不是给模型填参数的。模型要自己拼 URL、header、body、鉴权，任何一步错就失败。
- **执行在平台**：网络、鉴权、超时、安全全归 OpenAI 管；第三方开发者既背锅又没法控制运行时。
- **质量参差**：demo 很多，真正稳定有用的很少。

留下的零件：

- **工具需要“描述”才能被发现**——description 就是发现接口。
- **工具生态需要统一契约**——但 OpenAPI 不是那个契约。
- **“工具市场”的想法**——产品死了，想法被 GPTs 和 Actions 吸收后活了下来。

### Code Interpreter：把代码变成万能工具

Code Interpreter 最初也是 2023 年 3 月的一个插件，7 月变成内置功能。它给模型一个沙箱 Python：上传文件、写代码、跑代码、看 stdout、画图、再改。

它为什么成：

- **一个工具覆盖无限任务**。不需要为“算均值”“画柱状图”“解析 CSV”分别设计 schema。
- **代码是模型最擅长的动作语言**。模型写 Python 的能力，远强于它拼 OpenAPI 请求的能力。
- **结果可验证**。stdout、报错、图片都是明确反馈，模型可以自己迭代。
- **没有发现问题**。只有一个工具，不存在“选错插件”。

留下的零件：

- **代码即动作**：动作空间不必是有限枚举，可以是图灵完备的。
- **沙箱加迭代循环**：写、跑、看、改。
- **通用执行器胜过一千个窄工具**：这是今天 bash 工具和 coding agent 的直接祖先。

两者的差别可以压缩成一张表：

| 维度 | Plugins | Code Interpreter |
| --- | --- | --- |
| 工具来源 | 第三方应用 | 内置 |
| 契约 | manifest 加 OpenAPI | 无显式 schema，模型写代码 |
| 模型做什么 | 选插件、拼 HTTP 请求 | 写 Python、看结果、再改 |
| 谁执行 | OpenAI 平台 | OpenAI 沙箱 |
| 扩展方式 | 开发者接入 | 模型自己写 |
| 主要失败点 | 发现、选择、鉴权、延迟 | 沙箱限制、无网络、状态短暂 |
| 留下的遗产 | 工具生态、描述即发现 | 代码即动作、沙箱、迭代 |

### 分水岭：谁执行

把这两条路线和后来的 function calling 放在一起，会发现真正的分水岭不是“模型会不会用工具”，而是**执行权在谁手里**：

```text
Plugins:          平台执行，平台背所有集成的锅
Code Interpreter: 平台执行，但工具通用，平台只背沙箱的锅
Function calling: 开发者执行，平台只提供接口
```

Function calling 的胜利，本质上是**架构上的“收权”**：模型只负责“提出动作”，执行权还给应用。平台不再需要理解每个第三方服务的鉴权、延迟和错误，只需要定义“模型如何描述一个动作”。

## 2023 年 6 月：把执行权还给开发者

2023 年 6 月 13 日，OpenAI 发布 [function calling](https://openai.com/index/function-calling-and-other-api-updates/)：开发者用 JSON Schema 定义函数，模型返回 `{name, arguments}`，**执行由开发者的代码完成**。

它比 Plugins 窄得多——不绑 HTTP、不绑平台、不绑语言——但正因为窄，它通用了。2023 年 11 月 DevDay 又补上 `tools`、并行调用、`tool_choice` 和 JSON mode，接口基本定型。

为什么它赢：**最小契约**。模型只承诺“我按这个 schema 给你参数”，其余全归你。平台不背执行的锅，开发者拿到控制权，双方都满意。

这里还有一个容易被忽略的事实：**模型不执行函数，它只生成调用意图。** 真正读写文件、发请求、跑命令的，永远是模型外面的程序。

这也解释了 MCP 后来的位置：

```text
function calling 标准化了「模型 → Host」
MCP              标准化了「Host → 工具」
```

## 2023 到 2024：先分发，再标准化

### Dify 与 n8n：把能力画成图

[Dify](https://github.com/langgenius/dify) 2023 年出现，定位是 LLMOps：prompt、知识库、可视化 workflow、Agent 节点、一键发布。[n8n](https://github.com/n8n-io/n8n) 更早，2019 年就是确定性自动化引擎，2023 年加上 AI Agent 节点。

它们做的事不是发明新能力，而是**分发**：把 function calling 和 agent loop 包装成非程序员也能用的画布。

这里有一个很重要的张力：

- **确定性图**：人画好“先查天气，再判断，再发邮件”，可审计、可复现。
- **概率性路由**：模型运行时决定走哪条边，灵活但不可预测。

今天所有 workflow 产品都在两者之间找平衡。n8n 的 AI Agent 节点、Dify 的 Agent 节点，本质上是“在确定性的图里开一个概率性的洞”。

留下的零件：**可视化 Harness** 和**分发渠道**。很多公司第一次用上工具调用，不是通过 API，而是通过这两家的画布。

### MCP：工具侧的 USB-C

MCP 解决的是一个很朴素的问题：**N 个 Host × M 个工具，等于 N×M 次集成**。每个 AI 应用都要为每个工具写一遍适配器。MCP 把它变成 N+M。

它的设计明显借了 [LSP](https://microsoft.github.io/language-server-protocol/)（Language Server Protocol）的思路：编辑器不需要理解每种语言，语言服务器也不需要理解每个编辑器；双方按协议说话。MCP 把“编辑器与语言服务器”换成了“Host 与工具服务器”。

2024 年 11 月，Anthropic [发布 MCP](https://www.anthropic.com/news/model-context-protocol)，随后公开了[规范](https://modelcontextprotocol.io/)。它标准化了：

- 发现：`tools/list`
- 调用：`tools/call`
- 传输：stdio、HTTP
- 其他原语：resources、prompts、sampling

它**没有**标准化：模型能力、权限语义、执行安全。这些仍然归 Host。

为什么 2024 年才出现？因为顺序不能反：**先得让 Host 有能力消费任意工具（function calling），协议才有意义**。没有 function calling 的 MCP，就像有了 USB-C 接口却没有能读设备的操作系统。

留下的零件：**工具发现与调用的公共协议**，以及“工具生态”终于有了不绑厂商的接口。

## 2025：Harness 成为主角

[Computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) 把 GUI 也变成通用工具：看截图、点鼠标、敲键盘。[Operator](https://openai.com/index/introducing-operator/) 把这条路线带进浏览器。Coding agent 则把 bash、文件编辑、搜索、计划、权限、上下文压缩、子代理组合成一个长循环。

到这一步，竞争点已经从“模型会不会调工具”变成“**系统能不能管住一个长循环**”。模型能力仍然重要，但 Harness 决定了它能不能安全地跑十分钟、一小时、一整天。

## 一张零件表

| 时间 | 事件 | 留下的零件 |
| --- | --- | --- |
| 2021.12 | WebGPT | 搜索加引用 |
| 2022.4 | SayCan | 可行性过滤 |
| 2022.5 | MRKL | 路由器 |
| 2022.10 | ReAct | agent loop |
| 2022.10 | LangChain | 工具抽象、开发者体验 |
| 2023.2 | Toolformer | 可训练的工具调用 |
| 2023.3 | AutoGPT、BabyAGI | 自主循环、失败模式 |
| 2023.3 | Plugins | 工具生态、描述即发现 |
| 2023.3 与 7 | Code Interpreter | 代码即动作、沙箱 |
| 2023.6 | Function calling | 结构化动作接口 |
| 2023.11 | Tools、并行调用 | 并行、强制选择 |
| 2023 起 | Dify、n8n | 可视化 Harness、分发 |
| 2024.10 | Computer use | GUI 作为通用工具 |
| 2024.11 | MCP | 工具发现与调用协议 |
| 2025 | Coding agents | Harness 工程 |

## 回到你的项目

你写 [`server.ts`](../../examples/codex-continue-mcp/src/server.ts) 时，可能觉得 `stopWhen`、`readOnlyHint`、`outputSchema` 只是几个字段。它们其实都是历史留下的补丁：

| 你的设计 | 来自哪段历史 |
| --- | --- |
| `stopWhen` | AutoGPT 的死循环与目标漂移 |
| `readOnlyHint` 与 `destructiveHint` | 权限审批与“敢删文件” |
| `outputSchema` 与 `structuredContent` | 结果可校验、可回传 |
| `save_checkpoint` 与 `resume` | 上下文压缩与跨会话记忆 |
| `get_usage_stats` | 可观测性与成本控制 |
| stdio server | 工具与 Host 解耦 |
| `.describe()` | Plugins 的“描述即发现” |
| `z.strictObject` | SayCan 的可行性过滤与后端校验 |

## 为什么像故事

因为**行业不是被设计出来的，是被拼出来的**。每个 demo 都只在解决自己的小问题：

- ReAct 想证明“提示词也能行动”
- Plugins 想卖应用商店
- Code Interpreter 想让人在聊天框里做数据分析
- AutoGPT 想做一个全自动 Agent
- MCP 想少写几遍适配器

没有人是在造“Agent 行业”。但探索期会产生大量局部最优，标准期会把可复用的接口固化，生态期再在标准上长产品。失败的产品贡献失败模式，成功的产品贡献交互范式。

同样的剧本在别的领域也演过：容器、Web、LSP、USB。先是各自为战的适配器，然后一个足够窄的公共契约胜出，最后所有人都在契约上盖房子。

最后一个提醒：这条线是**事后叙事**。真实历史里它们并行、反复、充满偶然——Plugins 和 function calling 只隔三个月，Code Interpreter 先是插件后变内置，MCP 之前也有过别的协议尝试。把它看成一条必然的演化线，会高估设计者的远见；把它看成一堆零件的重组，反而更接近真相。

下次看到一个新的 Agent 产品，可以先问：**它发明了新零件，还是重新组装了旧零件？**
