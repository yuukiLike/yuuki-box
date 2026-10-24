# DeepSeek Harness：怎样保住可复用的请求前缀

[专题入口](README.md) · [上一篇 DeepSeek 缓存规则](03-prefix-cache-and-yuuki.md) · [下一篇 Pi](05-pi.md)

模型服务管理 KV，Harness 决定每次提交什么。研究 DeepSeek Harness（`dsh`）时，先追踪一件具体的事：**一次工具调用之后，下一次请求的前部还保留了多少原样内容？**


## 先从你写过的请求函数理解 Harness

前端调用接口时，会准备请求数据、等待响应、处理错误，再把新结果写回状态。模型如果还要求读取文件，就需要有人执行工具，把结果放进历史，再发下一次请求。

**Harness 可以先理解为把这些运行步骤串起来的外层程序。** 模型输出了 `read_file` 参数，只代表它提出了请求，文件读取仍由程序执行。

[![用户输入后，Harness 装配规则、历史和工具定义；模型提出 read_file；Harness 执行并把结果加入历史，再进行模型请求](../../site/public/diagrams/kv-cache/12-harness-loop.svg)](../../site/public/diagrams/kv-cache/12-harness-loop.svg)

这里先认一个词：**装配上下文**就是决定这次发哪些消息、规则和工具定义。读图时，只追踪每一步新增了什么内容。

**第一停点：模型提议，Harness 执行并接着组织请求，服务端判断缓存命中。** 分清三者之后，再看下面三个小选择。

<details>
<summary>想读源码时：先看一个判断，再沿五个入口追踪</summary>

## 第一眼，先看“不需要更新”的分支

打开 [`SystemPromptProjection.project`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/agent-loop/src/runtime-context.ts#L88)。找到“最新有效 system 文本与当前渲染一致，就返回空更新”的判断，再往上看它处理新请求序列的条件。

这一小步要解释：system 文字相同，为什么把它从历史后部移到第一条消息，也可能损失缓存？前缀身份包含此前的内容、位置与序列关系；最终有效指令相同，并不代表提交给模型的序列相同。

## 沿五个入口读一次请求

| 源码入口 | 追踪什么 | 与缓存的关系 |
| --- | --- | --- |
| [`system-prompt/src/index.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/system-prompt/src/index.ts#L211) | section、动态 context 和工具装配 | 固定规则与易变内容如何进入请求；工具怎样确定顺序 |
| [`agent-loop/src/agent.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/agent-loop/src/agent.ts#L439) | 每一步装配、投影与提交 | 工具往返和新序列边界何时改变历史 |
| [`runtime-context.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/agent-loop/src/runtime-context.ts#L59) | `SystemPromptProjection`、`RuntimeContextProjection` | 未变化的提示保留原位；动态快照只在内容变化时产生候选消息 |
| [`llm-pi-ai/src/adapter.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/llm/llm-pi-ai/src/adapter.ts#L126) | `profileOptions` | 把 `cacheRetention` 等选项传入 Pi 的模型层 |
| [`llm-pi-ai/src/stream.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/llm/llm-pi-ai/src/stream.ts#L19) | `mapUsage` | 把 Pi 的用量转成 Harness 的流式统计 |

可把这条路径记成：`会话与插件贡献 → 装配请求 → 供应商适配 → 模型服务 → 用量回写`。其中直接保存和匹配推理 KV 的工作发生在模型服务端。

</details>

## 三处值得拆开的工程选择

### 1. 给工具一个确定的顺序

`orderTools` 在未指定顺序时按名称排序；配置 `toolOrder` 时，显式列出的工具按配置排列，其余工具有确定顺序。上游还测试了相反的插件注册顺序能产生相同的工具列表。[排序源码](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/system-prompt/src/index.ts#L225)、[工具顺序测试](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/system-prompt/tests/tool-order.spec.ts#L26)

这能减少插件加载顺序带来的请求差异。实际命中仍取决于供应商如何编码工具和消息；一个稳定的 JavaScript 数组本身不能证明服务端命中。

### 2. 动态上下文变化时，再留下新快照

**快照**就是某个时刻的一份内容。在这里，程序比较前后两份动态说明，内容相同就不必再追加一份。**投影**则是从已有记录生成本次需要的表示；可以借用前端从 state 得到视图数据的经验理解。

`RuntimeContextProjection.project` 比较当前内容与保留的快照，一致时不产生更新。系统提示的注册表也把进程相关路径、端点等列入 runtime context 的职责。[动态投影](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/agent-loop/src/runtime-context.ts#L151)、[context 分区](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/system-prompt/src/index.ts#L178)

这里可以借鉴的原则是：先判断内容是否真的变化，再决定如何进入上下文。时间、工作区和环境变化仍需正确告知模型；为了缓存省略必要信息，会破坏任务语义。

### 3. 支持历史内 system 更新的路由，才保留这种布局

**路由**在这里包含所选模型接口及其能力。先看简化的消息顺序图：S0 是旧规则版本，S1 是后来的规则版本。

[![支持历史内 system 更新时，有效规则 S1 不变可以保留消息原位；把 S1 搬到开头会改变原有前缀](../../site/public/diagrams/kv-cache/13-prompt-move.svg)](../../site/public/diagrams/kv-cache/13-prompt-move.svg)

图里文字的最终含义可以相同，输入顺序却变了。就像前端缓存的依赖变了，不能仅凭最后显示的一行文字相同，断言所有中间结果还有效。

`SystemPromptProjection` 根据路由的 `inHistory` 能力、当前提示与请求序列边界，选择追加、保持原位或重建头部。不能把“system 一律往后追加”作为所有接口通用的优化。

上游有一份很适合研究的[已实现修复记录](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/.agents/notes/implemented/bug-fix/2026-10-22-series-start-unchanged-prompt-prefix.md)：局部历史替换开始新序列时，未变化的 system 文本曾被搬回头部，导致前部差异扩大。修复让最新有效文本相同时保持原位。它是上游记录的故障与修复，本仓库没有复现其运行数据。

**这一站完成了：工具顺序、动态快照和规则位置，都可能改变请求前缀。** 下次从 [Pi 怎样翻译接口用量](05-pi.md)继续。

<details>
<summary>选读：dsh 与 Pi 的关系，以及两个适配层的字段</summary>

## 与 Pi 的关系：模型适配层可以复用

**适配器**可以先理解成一段「翻译接口」的代码：把应用的数据变成供应商需要的请求，再把响应变回应用使用的格式。

`@deepseek-ai/dsh-llm-pi-ai` 是 dsh 的模型适配包，声明依赖 `@earendil-works/pi-ai`；同仓也保留 `llm-deepseek` 专用实现。[适配包声明](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/llm/llm-pi-ai/package.json)

这一关系允许我们沿接口继续读 Pi，但不能据此把整个 DeepSeek Harness 当作 Pi 的 Agent 循环。也不能认为这份 dsh 快照实际安装的 Pi 依赖，必然等于下一篇单独选取的 Pi 主干快照。

`mapUsage` 的对应关系很直接：

| Pi 用量 | dsh 用量 | 当前转换行为 |
| --- | --- | --- |
| `input` | `inputTokens` | 未缓存输入 |
| `output` | `outputTokens` | 输出 |
| `cacheRead` | `cacheReadTokens` | 大于 0 时写入 |
| `cacheWrite` | `cacheWriteTokens` | 大于 0 时写入 |
| `totalTokens` | `totalTokens` | 保留 Pi 的总量 |

dsh 的 [`TokenUsage` 契约](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/llm/llm/src/types.ts#L169)把输入与缓存桶定义为互斥计数。Pi 适配层会省略值为 0 的缓存字段，所以看到字段缺失时，还要回查适配器，不能只凭缺失判断供应商没有提供缓存能力。

另一个协议差异也值得保留：同快照 `llm-deepseek` 的 [`translate.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/llm/llm-deepseek/src/translate.ts#L34)处理 Messages 风格的 `cache_read_input_tokens` 等字段；本仓库 Yuuki 使用 Chat Completions。研究某个响应时，先确定走的是哪个适配器和协议。

</details>

<details>
<summary>选读：上游测试、证据边界与带回 Yuuki 的小研究</summary>

## 上游怎样验证，本文验证到了哪一步

[`request-cache.e2e.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/agent-loop/tests/request-cache.e2e.ts#L76)包含需要 `DEEPSEEK_API_KEY` 的真实服务测试：制造一次工具往返和后续用户轮次，从 `assistant/message` 事件读取 usage，断言首个请求之后出现 `cacheReadTokens > 0`。

| 证据 | 能说明什么 | 还不能说明什么 |
| --- | --- | --- |
| 排序与投影源码、对应测试断言 | 上游如何设计和检查请求稳定性 | 该版本在本机已经通过测试 |
| 真实 API 测试代码 | 上游准备从哪里观察真实缓存命中 | 本次已经发请求并观测到命中 |
| 单次服务端命中字段 | 该请求报告命中了多少输入 | 所有请求必然命中，或端到端延迟必然降低 |

测试中的旧缓存粒度注释不能代替[当前 DeepSeek 持久化规则](https://api-docs.deepseek.com/guides/kv_cache/)。即使请求构造稳定，也要保留缓存构建、淘汰和尽力命中的条件。

## 带回 Yuuki 的下一项小研究

先只做一次源码对照：在 Yuuki 的 [`completion`](../../examples/shared/runtime/Sources/main.swift:351) 中指出 system、tools、history 和 usage 的入口，再标出缺少的缓存字段。下一步实现可从**单次请求的原始缓存用量**开始，验收后再研究前缀布局与摘要策略。

继续阅读[Pi 怎样使用和观测缓存](05-pi.md)，比较同一组 token 数怎样跨过两个项目的接口。

</details>

<details>
<summary>来源与核对范围</summary>

核对日期：2026-10-24。本文静态阅读官方仓库的 [`22ddee379240`](https://github.com/deepseek-ai/deepseek-harness/tree/22ddee3792402c3e70ec5f86a63c3e3e895a2f60) 快照，未安装运行，也未执行上游测试或真实 API 实验。项目在该快照仍标为 developer preview。[项目说明](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/README.md)

</details>
