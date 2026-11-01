# 番外：工具调用怎样长成 Agent

[MCP 入门](00-codex-mcp.md) · [Agent 工程](../agent-engineering/README.md) · [Harness 入门](03-build-a-harness.md)

MCP 与 Agent 共用选读：工具循环、function calling、MCP、Harness、Skills 从哪里来？无需改代码。

按「研究 → 产品接口 → 执行控制」串起历史；日期据发布记录，零件分类只是归纳，<mark class="caution">不代表直接传承</mark>。

## 先记住五个零件

绕开产品名，先看五件事：

| 零件 | 解决的问题 | 后来的代表 |
| --- | --- | --- |
| 循环 | 模型怎样连续行动，而不是答一句就停 | ReAct、agent loop |
| 动作接口 | 模型如何输出可执行的结构化动作 | function calling |
| 执行机构 | 动作执行方与权限边界 | Code Interpreter、Harness |
| 发现协议 | 工具怎样被找到、被调用，而不必一家家写适配器 | MCP |
| 流程复用 | 同类任务怎样复用步骤、脚本与参考资料 | Skills |

后文按这五类看产品与教训。

## 前史：各自为战的实验

### WebGPT 与 SayCan：先让动作落地

2021 年底，[WebGPT](https://arxiv.org/abs/2112.09332) 将网页搜索、引用、回答与人类反馈训练连起来；引用便于核查，不保证正确。

2022 年，[SayCan](https://arxiv.org/abs/2204.01691) 让模型提动作，再用可行性模型过滤，如先判断能否够到苹果。

留下**可行性校验**：意图不等于能做；schema、审批、沙箱仍各管不同条件，不能视为同一机制。

### ReAct：把思考变成循环

2022 年 10 月，[ReAct](https://arxiv.org/abs/2210.03629) 让思考、动作、结果观察交替进入上下文。

```text
Thought: 我需要先看目录
Action: ls
Observation: ...
Thought: 看到了 server.ts
```

它展示冻结模型仅靠提示也能行动；但解析文本容易受模型与措辞变化影响。

留下**动作—观察循环**；不要求公开模型内部推理，也不是所有 Agent 的统一格式。

### MRKL 与 LangChain：路由和工具抽象

2022 年 5 月，[MRKL](https://arxiv.org/abs/2205.00445) 以路由器选择计算器、知识库等模块；[LangChain](https://github.com/langchain-ai/langchain) 再把 tool、agent、memory 包成开发者 API。

留下**工具描述、路由与 API**；这里讲 LLM 编排进入工具链，不是 Agent 一词的起源。

### Toolformer：工具使用可以被训练

2023 年 2 月，[Toolformer](https://arxiv.org/abs/2302.04761) 自监督学习插入 API 调用，保留能降低后续损失的调用：何时用工具也能训练。

留下**工具使用训练**；同年 function calling 提供结构化接口，但不据此推断采用了同一训练方法。

同一时期还有几个容易被忽略的实验：[HuggingGPT](https://arxiv.org/abs/2303.17580) 让 LLM 当调度器，把任务分给不同的模型；[Gorilla](https://arxiv.org/abs/2305.15334) 练习从大量 API 里检索出正确的那一个；[Voyager](https://arxiv.org/abs/2305.16291) 在 Minecraft 里把代码当动作，并积累可复用的技能库。它们分别预演了后来的多工具路由、工具发现和 Skills。

### AutoGPT：产品幻觉与失败清单

2023 年，[AutoGPT](https://github.com/Significant-Gravitas/AutoGPT)、[BabyAGI](https://github.com/yoheinakajima/babyagi) 展示按目标组织任务、调用、处理结果的自主循环；各版本能力与权限不同。

这些自主循环实验也让一些工程问题更容易被看见：

- 死循环、目标漂移
- token 成本爆炸
- 错误层层累积
- 没有审批，敢删文件
- 上下文越滚越大，最后爆掉

留下**故障清单**，可用步数、预算、checkpoint、权限和上下文管理应对；不把这些机制都归源于 AutoGPT。

## 2023 年 3 月：两条岔路

2023 年 3 月 23 日，OpenAI 发布 Plugins 并介绍托管的 Code Interpreter，逐步开放；两者都连接外部执行，重点不同。[当时的发布公告](https://openai.com/index/chatgpt-plugins/)

### Plugins：把工具做成平台

[Plugins](https://openai.com/index/chatgpt-plugins/) 把第三方服务接入 ChatGPT。平台把已启用插件的描述交给模型，再组织调用；第三方服务负责实际业务处理。订餐、旅行查询与知识检索是公告中的应用方向。

工程上需处理描述、身份、接口、结果与用户确认；凭据交给程序管理，平台不保证第三方业务正确。

留下**描述、连接与结果展示接口**；不能把产品变化归结为某个单一设计问题。

### Code Interpreter：把代码变成万能工具

Code Interpreter 给模型一个受限的 Python 执行环境：处理上传文件、运行代码、查看报错和生成图表。模型可以根据执行反馈继续修改。[发布时的介绍](https://openai.com/index/chatgpt-plugins/)

代码让计算、解析、画图共用执行器；仍须限制资源、时间与输出，核对任务结果，退出成功不等于分析正确。

留下**写代码—执行—反馈—修改循环**；通用执行器更灵活，窄工具更易限定参数与权限，各有用途。

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

三条路线的关键区别是<mark class="key">谁真正执行动作</mark>：

```text
Plugins:          平台组织调用，服务端执行业务
Code Interpreter: 模型生成代码，托管环境执行
Function calling: 模型生成调用参数，应用执行或委托工具执行
```

function calling 将意图交给应用，应用执行函数、API 或 MCP，并管理校验、权限、错误与结果回传。

## 2023 年 6 月：把执行权还给开发者

2023 年 6 月 13 日，OpenAI 发布 [function calling](https://openai.com/index/function-calling-and-other-api-updates/)：开发者用 JSON Schema 定义函数，模型返回 `{name, arguments}`，**执行由开发者的代码完成**。

接口不要求 HTTP；结构化输出也不保证参数有效或已获授权。

**模型只生成调用意图**；文件、请求、命令由外部程序执行。

这也解释了 MCP 后来的位置：

```text
function calling：模型 API 表达调用意图 → Host 处理
MCP：             Host 内的 Client ↔ 工具 Server
```

## 2023 到 2024：先分发，再标准化

### Dify 与 n8n：把能力画成图

[Dify](https://github.com/langgenius/dify) 2023 年出现，定位是 LLMOps：prompt、知识库、可视化 workflow、Agent 节点、一键发布。[n8n](https://github.com/n8n-io/n8n) 更早，2019 年就是确定性自动化引擎，2023 年加上 AI Agent 节点。

它们把调用与循环包装成可视化画布，扩大使用者范围。

这里有一个很重要的张力：

- **确定性图**：人画好“先查天气，再判断，再发邮件”，可审计、可复现。
- **概率性路由**：模型运行时决定走哪条边，灵活但不可预测。

n8n、Dify 等工作流将模型决策接入预设流程，在确定性步骤与模型选择之间分配职责。

留下**可视化 Harness 与分发渠道**，降低 API 使用门槛。

### MCP：工具侧的 USB-C

MCP 减少重复集成：两两适配可示意为 **N×M**，共享协议为 **N+M**；版本、授权和能力差异仍有额外成本。

它借鉴 [LSP](https://microsoft.github.io/language-server-protocol/)：如编辑器与语言服务器各实现协议，Host 与工具服务器也如此。

2024 年 11 月 25 日，Anthropic [发布 MCP](https://www.anthropic.com/news/model-context-protocol)并开放相关实现与[规范](https://modelcontextprotocol.io/)。理解它时先看：

- 发现：`tools/list`
- 调用：`tools/call`
- 传输：stdio、HTTP
- 其他原语：resources、prompts、sampling

传输、生命周期与授权须看对应版本，不能倒推首发能力；权限与执行安全仍由 Host/Server 落实。

**MCP 无需模型**：`pnpm demo:mini-mcp` 的固定脚本就能发现、调用工具；模型接口与 MCP 可分层组合。

留下的零件：**工具发现与调用的公共协议**，以及“工具生态”终于有了不绑厂商的接口。

## 2025：Harness 成为主角

[Computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) 把 GUI 也变成通用工具：看截图、点鼠标、敲键盘。[Operator](https://openai.com/index/introducing-operator/) 把这条路线带进浏览器。Coding agent 则把 bash、文件编辑、搜索、计划、权限、上下文压缩、子代理组合成一个长循环。

竞争转向**能否管理长循环**：模型提供能力，Harness 控制长期执行。

GUI 路线见 [Computer Use：观察、执行与验证](../agent-engineering/computer-use.md)、[Codex 的 cua_repl](../agent-engineering/cua-repl.md)与[同类工具对照](../agent-engineering/computer-use-ecosystem.md)；2026-10-31 资料仅描述当时接口。

## 2025 年 10 月：把做事方法封装成 Skills

工具之外，还需复用做事方法，如整理 docs 的读目录、拆章节与链接检查步骤。

**2025 年 10 月 16 日，Anthropic 正式推出 Agent Skills。** Skills 把任务说明、脚本和资源组织成目录，供 Agent 按需使用；同一天发布的工程文章解释了以 `SKILL.md` 为入口的结构。[发布公告](https://claude.com/resources/articles/skills)、[设计介绍](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills)

关键是**渐进加载**：先名称/描述，匹配后读 `SKILL.md`，再按需读资料或运行脚本，避免每次塞入全部内容。[加载机制](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills)

MCP 接工具，Skills 保存复现/修改/验证步骤，Harness 执行与控制；Skill 也可只用本地文件和脚本。

**2025 年 12 月 18 日，Agent Skills 成为开放标准**。这与首次推出是两个节点；Voyager 等更早研究已探索技能复用。[官方更新说明](https://claude.com/resources/articles/skills)

留下的零件：**可复用的任务流程、按需加载的知识与可分享的技能目录。** 实现方式见 [Skills：结构与触发](../agent-engineering/03-skills-structure.md)。

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

<div class="heading-alias" id="回到你的项目" aria-hidden="true"></div>

## 对照示例实现

回到 [`server.ts`](../../examples/codex-continue-mcp/src/server.ts) 对应职责；下表是教学归纳，不是产品溯源：

| 设计项 | 实际职责 |
| --- | --- |
| `stopWhen` | 保存“做到哪里就停”的文字；不会主动停止 Agent 循环 |
| `readOnlyHint` 与 `destructiveHint` | 提供行为提示；不能替代真正的权限检查 |
| `outputSchema` 与 `structuredContent` | 描述、返回可校验的结果 |
| `save_checkpoint` 与 `resume` | 显式保存、取回 Markdown 记录；不会自动管理全部会话记忆 |
| `get_usage_stats` | 返回本服务的调用统计；不是模型 token 账单 |
| stdio server | 通过进程标准输入、输出交换协议消息 |
| `.describe()` | 为字段补充用途说明，帮助调用方填写参数 |
| `z.strictObject` | 拒绝不符合 schema 的输入；不能证明动作可行或已获授权 |

<div class="heading-alias" id="为什么像故事" aria-hidden="true"></div>

## 历史整理的边界

因为这里选择了一条便于学习的叙事线，把不同项目放回它们处理的问题：

- ReAct：交替进行推理与动作。
- Plugins：为 ChatGPT 连接第三方服务。
- Code Interpreter：在对话中执行代码与数据分析。
- AutoGPT：探索自主循环任务。
- MCP：统一外部能力的发现与调用。
- Skills：封装可复用的任务流程。

这条线是**事后叙事**：真实项目并行、反复；Plugins 与 function calling 只隔三个月，Code Interpreter 从插件变内置，MCP 前也有协议尝试。它更像零件重组，而非必然演化。

评估 Agent 产品时，先区分新机制与已有组件的组合。
