# 番外：工具调用怎样长成 Agent

[MCP 入门](00-codex-mcp.md) · [Agent 工程](../agent-engineering/README.md) · [Harness 入门](03-build-a-harness.md)

**这一篇是故事，不是跟做。** 它是 MCP 与 Agent 两个专题共用的选读，不讲 API，也不要求你改代码。它只回答一个问题：工具循环、function calling、MCP、Harness、Skills——分别是从哪里来的？

这里用“零件怎样接起来”组织历史：研究提出做法，产品把接口交给开发者，运行时再补齐执行与控制。日期来自发布记录；“留下的零件”是帮助理解的归纳，不表示后来的实现一定直接源于前面的项目。

## 先记住五个零件

绕开产品名，先看五件事：

| 零件 | 解决的问题 | 后来的代表 |
| --- | --- | --- |
| 循环 | 模型怎样连续行动，而不是答一句就停 | ReAct、agent loop |
| 动作接口 | 模型怎样把“我想做什么”说成程序能执行的东西 | function calling |
| 执行机构 | 谁真正动手，以及怎样保证它不闯祸 | Code Interpreter、Harness |
| 发现协议 | 工具怎样被找到、被调用，而不必一家家写适配器 | MCP |
| 流程复用 | 同类任务怎样复用步骤、脚本与参考资料 | Skills |

后面出现的产品，基本都在补其中一块。有时补上了，有时只留下一个教训。

## 前史：各自为战的实验

### WebGPT 与 SayCan：先让动作落地

2021 年底，[WebGPT](https://arxiv.org/abs/2112.09332) 研究让模型搜索网页、打开结果、引用来源，再用人类反馈训练。它把“找材料”和“回答问题”放进同一条流程；有引用方便核查，但不自动保证来源可靠或结论正确。

2022 年，[SayCan](https://arxiv.org/abs/2204.01691) 让语言模型给机器人提动作建议，再由一个“可行性模型”过滤。你说“去拿苹果”，机器人得先判断自己够不够得着。

留下的零件：**可行性校验**。“模型想做的”和“实际能做的”需要分开。可以借这个区别理解今天的执行边界，但 schema 校验、权限审批和沙箱各自检查不同条件，不能当作同一种机制或直接传承关系。

### ReAct：把思考变成循环

2022 年 10 月的 [ReAct](https://arxiv.org/abs/2210.03629) 贡献极其朴素：让模型交替输出“思考”和“动作”，再把动作结果作为“观察”塞回上下文。

```text
Thought: 我需要先看目录
Action: ls
Observation: ...
Thought: 看到了 server.ts
```

它证明了**冻结的模型、不微调，只靠提示词也能行动**。但动作靠解析文本，换模型、换措辞、加一句解释，解析就可能失败。

留下的零件：**动作与观察交替的循环**。这是理解许多 Agent 的有用入口，不要求今天的模型公开内部推理文本，也不代表所有 Agent 都照搬 ReAct 格式。

### MRKL 与 LangChain：路由和工具抽象

2022 年 5 月的 [MRKL](https://arxiv.org/abs/2205.00445) 提出“路由器加专家模块”：模型判断该问计算器、知识库还是数据库。[LangChain](https://github.com/langchain-ai/langchain) 则把 tool、agent、memory 做成开发者 API，让“给模型接工具”从论文变成几行代码。

留下的零件：**工具描述、路由与开发者 API**。“Agent”一词早已存在；这里讨论的是 LLM 工具编排怎样进入开发者工具链。

### Toolformer：工具使用可以被训练

2023 年 2 月，Meta 的 [Toolformer](https://arxiv.org/abs/2302.04761) 用自监督方法让模型学会在文本里插入 API 调用，只保留那些能降低后续预测损失的调用。它说明：**“什么时候该调工具”不一定要靠提示词，也可以训练进模型。**

留下的零件：**学习何时调用工具的研究路线**。同年 6 月的 OpenAI function calling 则提供开发者可用的结构化接口；两者目标相关，但不能据此断言产品采用了 Toolformer 的训练方法。

同一时期还有几个容易被忽略的实验：[HuggingGPT](https://arxiv.org/abs/2303.17580) 让 LLM 当调度器，把任务分给不同的模型；[Gorilla](https://arxiv.org/abs/2305.15334) 练习从大量 API 里检索出正确的那一个；[Voyager](https://arxiv.org/abs/2305.16291) 在 Minecraft 里把代码当动作，还攒下可复用的技能库。它们分别预演了后来的多工具路由、工具发现和 Skills。

### AutoGPT：产品幻觉与失败清单

2023 年，[AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) 和 [BabyAGI](https://github.com/yoheinakajima/babyagi) 让自主任务循环受到关注：围绕一个目标组织任务、调用能力并继续处理结果。不同项目的实现与权限范围有区别，不能把一张能力清单套给所有版本。

这些自主循环实验也让一些工程问题更容易被看见：

- 死循环、目标漂移
- token 成本爆炸
- 错误层层累积
- 没有审批，敢删文件
- 上下文越滚越大，最后爆掉

留下的零件：**可以带回自己项目的故障清单**。步数上限、预算、checkpoint、权限与上下文管理可以分别处理这些问题；本篇不把它们的起源都归于 AutoGPT。

## 2023 年 3 月：两条岔路

2023 年 3 月 23 日，OpenAI 宣布 ChatGPT Plugins，并把 Code Interpreter 作为自家托管插件之一介绍。这是逐步开放的早期发布，不等于当天向所有用户提供。两者都让模型连接外部执行能力，重点不同。[当时的发布公告](https://openai.com/index/chatgpt-plugins/)

### Plugins：把工具做成平台

[Plugins](https://openai.com/index/chatgpt-plugins/) 把第三方服务接入 ChatGPT。平台把已启用插件的描述交给模型，再组织调用；第三方服务负责实际业务处理。订餐、旅行查询与知识检索是公告中的应用方向。

从工程上看，这条路线需要同时处理工具描述、身份、服务接口、调用结果与用户确认。模型不应承担秘密凭据管理，平台也不能替第三方保证业务逻辑正确。

留下的零件：**描述工具、连接服务、展示调用结果的产品接口**。本篇借此分析集成边界；没有足够证据把某一项设计问题写成插件产品变化的唯一原因。

### Code Interpreter：把代码变成万能工具

Code Interpreter 给模型一个受限的 Python 执行环境：处理上传文件、运行代码、查看报错和生成图表。模型可以根据执行反馈继续修改。[发布时的介绍](https://openai.com/index/chatgpt-plugins/)

它展示了**代码作为工具输入**的价值：计算、解析与画图可以复用同一个执行器。代价也很具体：要限制可访问资源、运行时间和输出，并检查结果是否回答了原问题。程序成功退出不等于分析正确。

留下的零件：**写代码、执行、观察反馈、再修改的循环**。通用执行器与窄工具各有用途；固定业务工具通常更容易限定参数与权限，不存在一个必然胜过另一个的结论。

两者的差别可以压缩成一张表：

| 维度 | Plugins | Code Interpreter |
| --- | --- | --- |
| 工具来源 | 第三方应用 | 内置 |
| 契约 | 服务描述与接口约定 | 代码执行工具及其输入、输出约定 |
| 模型做什么 | 选择能力并提出调用 | 写 Python、看结果、再改 |
| 谁执行 | 平台组织调用，第三方服务处理业务 | 平台提供的受限执行环境 |
| 扩展方式 | 开发者接入 | 模型自己写 |
| 主要失败点 | 发现、选择、鉴权、延迟 | 沙箱限制、无网络、状态短暂 |
| 留下的遗产 | 工具生态、描述即发现 | 代码即动作、沙箱、迭代 |

### 分水岭：谁执行

把这两条路线和后来的 function calling 放在一起，会发现真正的分水岭不是“模型会不会用工具”，而是**执行权在谁手里**：

```text
Plugins:          平台组织调用，服务端执行业务
Code Interpreter: 模型生成代码，托管环境执行
Function calling: 模型生成调用参数，应用执行或委托工具执行
```

从这个角度看，function calling 把**提出动作与执行动作**的分工清楚地交给应用开发者。应用可以调用自己的函数、远端 API 或 MCP 客户端，也要自己安排校验、权限、错误与结果回传。

## 2023 年 6 月：把执行权还给开发者

2023 年 6 月 13 日，OpenAI 发布 [function calling](https://openai.com/index/function-calling-and-other-api-updates/)：开发者用 JSON Schema 定义函数，模型返回 `{name, arguments}`，**执行由开发者的代码完成**。

这个接口描述调用，不要求函数一定通过 HTTP 实现。接口此后仍在演进；普通 function calling 的结构化输出也不应被当成参数必然有效或已经获准执行的保证。

这里还有一个容易被忽略的事实：**模型不执行函数，它只生成调用意图。** 真正读写文件、发请求、跑命令的，永远是模型外面的程序。

这也解释了 MCP 后来的位置：

```text
function calling：模型 API 表达调用意图 → Host 处理
MCP：             Host 内的 Client ↔ 工具 Server
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

MCP 解决的是重复集成问题。把每个 Host 与每个工具分别连接，可用 **N×M** 作示意；共享协议后，可用 **N+M** 表达两边各实现一次协议接口。这个比喻忽略版本、授权与能力差异，实际工程成本不会自动严格降到这个数量。

它的设计明显借了 [LSP](https://microsoft.github.io/language-server-protocol/)（Language Server Protocol）的思路：编辑器不需要理解每种语言，语言服务器也不需要理解每个编辑器；双方按协议说话。MCP 把“编辑器与语言服务器”换成了“Host 与工具服务器”。

2024 年 11 月 25 日，Anthropic [发布 MCP](https://www.anthropic.com/news/model-context-protocol)并开放相关实现与[规范](https://modelcontextprotocol.io/)。理解它时先看：

- 发现：`tools/list`
- 调用：`tools/call`
- 传输：stdio、HTTP
- 其他原语：resources、prompts、sampling

具体传输、生命周期与授权约定要按协议版本阅读；今天的规则不能全部倒推为首发时已有。协议不会自动赋予业务权限或执行安全，这些仍需要 Host 与 Server 的策略落实。

**MCP 不以模型或原生 function calling 为运行前提。** 本仓库 `pnpm demo` 的固定脚本就是 MCP Client，也能发现和调用工具。接入 Agent 后，模型可以参与选择工具；模型接口与 MCP 是可以组合的两层。

留下的零件：**工具发现与调用的公共协议**，以及“工具生态”终于有了不绑厂商的接口。

## 2025：Harness 成为主角

[Computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) 把 GUI 也变成通用工具：看截图、点鼠标、敲键盘。[Operator](https://openai.com/index/introducing-operator/) 把这条路线带进浏览器。Coding agent 则把 bash、文件编辑、搜索、计划、权限、上下文压缩、子代理组合成一个长循环。

到这一步，竞争点已经从“模型会不会调工具”变成“**系统能不能管住一个长循环**”。模型能力仍然重要，但 Harness 决定了它能不能安全地跑十分钟、一小时、一整天。

## 2025 年 10 月：把做事方法封装成 Skills

工具接好了，还有一件事要反复交代：**这类任务应该怎样做？** 比如每次整理 docs，都要说明先看目录、怎样拆章节、修改后检查哪些链接。这些做事方法也需要保存和复用。

**2025 年 10 月 16 日，Anthropic 正式推出 Agent Skills。** Skills 把任务说明、脚本和资源组织成目录，供 Agent 按需使用；同一天发布的工程文章解释了以 `SKILL.md` 为入口的结构。[发布公告](https://claude.com/resources/articles/skills)、[设计介绍](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills)

它的关键是**渐进加载**：先提供名称和描述，匹配任务时再读取 `SKILL.md` 正文，之后按需读取参考资料或执行脚本。这样可以准备许多任务流程，而不必在每次请求里塞入全部内容。[加载机制](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills)

把它放回前面的故事：MCP 负责接通工具，Skills 可以说明怎样用这些工具完成某类任务，Harness 负责实际运行与控制。比如 MCP 提供读取 Issue、查看 diff 的能力，Skill 保存一套复现、修改、验证的步骤。Skill 也可以只使用本地文件和脚本。

**2025 年 12 月 18 日，Anthropic 将 Agent Skills 发布为开放标准**，让这种格式可以被不同平台采用。首次推出与开放标准发布是两个节点；更早的 Voyager 等研究已经探索过技能复用，不能把这种思想的起点也算到 2025 年。[官方更新说明](https://claude.com/resources/articles/skills)

留下的零件：**可复用的任务流程、按需加载的知识与可分享的技能目录。** 想动手时，再读 [Skills：结构与触发](../agent-engineering/03-skills-structure.md)。

## 一张零件表

| 时间 | 事件 | 留下的零件 |
| --- | --- | --- |
| 2021.12 | WebGPT | 搜索加引用 |
| 2022.4 | SayCan | 可行性过滤 |
| 2022.5 | MRKL | 路由器 |
| 2022.10 | ReAct | agent loop |
| 2022.10 | LangChain | 工具抽象、开发者体验 |
| 2023.2 | Toolformer | 可训练的工具调用 |
| 2023 | AutoGPT、BabyAGI | 自主循环、失败模式 |
| 2023.3 | Plugins | 工具生态、描述即发现 |
| 2023.3 | Code Interpreter 早期介绍 | 代码即动作、沙箱 |
| 2023.6 | Function calling | 结构化动作接口 |
| 2023 起 | Dify、n8n | 可视化 Harness、分发 |
| 2024.10 | Computer use | GUI 作为通用工具 |
| 2024.11.25 | MCP | 工具发现与调用协议 |
| 2025 | Coding agents | Harness 工程 |
| 2025.10.16 | Agent Skills 正式推出 | 任务流程封装、渐进加载 |
| 2025.12.18 | Agent Skills 发布为开放标准 | 跨平台复用技能格式 |

## 回到你的项目

回到 [`server.ts`](../../examples/codex-continue-mcp/src/server.ts)，可以用前面的分工理解这些字段。下表是教学对照，不是声称每个字段来自某个历史产品：

| 你的设计 | 现在实际负责什么 |
| --- | --- |
| `stopWhen` | 保存“做到哪里就停”的文字；不会主动停止 Agent 循环 |
| `readOnlyHint` 与 `destructiveHint` | 提供行为提示；不能替代真正的权限检查 |
| `outputSchema` 与 `structuredContent` | 描述、返回可校验的结果 |
| `save_checkpoint` 与 `resume` | 显式保存、取回 Markdown 记录；不会自动管理全部会话记忆 |
| `get_usage_stats` | 返回本服务的调用统计；不是模型 token 账单 |
| stdio server | 通过进程标准输入、输出交换协议消息 |
| `.describe()` | 为字段补充用途说明，帮助调用方填写参数 |
| `z.strictObject` | 拒绝不符合 schema 的输入；不能证明动作可行或已获授权 |

## 为什么像故事

因为这里选择了一条便于学习的叙事线，把不同项目放回它们处理的问题：

- ReAct 想证明“提示词也能行动”
- Plugins 探索让 ChatGPT 连接第三方服务
- Code Interpreter 想让人在聊天框里做数据分析
- AutoGPT 想做一个全自动 Agent
- MCP 想少写几遍适配器
- Skills 想把做事方法保存下来，供同类任务复用

最后一个提醒：这条线是**事后叙事**。真实历史里它们并行、反复、充满偶然——Plugins 和 function calling 只隔三个月，Code Interpreter 先是插件后变内置，MCP 之前也有过别的协议尝试。把它看成一条必然的演化线，会高估设计者的远见；把它看成一堆零件的重组，反而更接近真相。

下次看到一个新的 Agent 产品，可以先问：**它发明了新零件，还是重新组装了旧零件？**
