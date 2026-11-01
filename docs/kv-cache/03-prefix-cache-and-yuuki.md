# 从前缀复用回到 Yuuki

[专题入口](README.md) · [上一篇 因果 Attention 与 KV Cache](02-attention-and-kv.md) · [下一篇 DeepSeek Harness](04-deepseek-harness.md)

生成时复用历史 K/V；Agent 还会跨请求重复发送 system、对话与工具结果。本篇研究这些前缀的复用。

<mark class="key">先找相同前缀，再看实际命中字段</mark>。

## 先用数组找到不变的部分

```js
const stable = ['整体规则', '固定资料'];
const requestA = [...stable, '问题 Q'];
const requestB = [...stable, '问题 R'];
```

数组省略了角色等字段。两次都发规则与资料，只换末尾问题；服务端尝试复用已算状态。

客户端发送正确内容，服务端按分词、模板与缓存规则判定复用；数组看似相同还不够。

## 两种复用发生在不同范围

| 机制 | 复用范围 | 主要减少的工作 |
| --- | --- | --- |
| 生成循环中的 KV Cache | 同一次生成过程的已有位置 | 每步重复处理历史位置 |
| 跨请求 Prefix Caching | 已处理请求与新请求的相同前缀 | 新请求中可复用前缀的 Prefill |

前缀缓存减少 Prefill，后续输出仍需计算，不直接给 Decode 同样的省算效果。[vLLM 说明](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)

分别测开始回答的等待与之后的生成速度。

## 复用条件包含此前的上下文

把两次请求简写成 token 序列：

```text
第一次  A B C D
第二次  A X C D
```

C/D 相同，前缀不同仍可能改变深层 K/V，见上一节实验。

vLLM 的一种分块实现用父块哈希、当前 token 与额外配置标识缓存；同后缀、不同前缀会得到不同身份，类似构建缓存检查依赖。[设计说明](https://docs.vllm.ai/en/latest/design/prefix_caching/)

本地复用还需兼容模型、配置、位置与可见范围；托管 API 由供应商管理这些状态，应用提供正确上下文。

## 从前端请求组织开始改善复用机会

考虑一组对同一份资料提问的请求，先固定资料和规则，再追加问题：

```js
const messages = [
  { role: 'system', content: stableInstructions },
  { role: 'user', content: stableDocument },
  { role: 'user', content: currentQuestion },
];
```

修改前部说明会改变后续资料的前缀；实际命中长度仍受模板、分词与缓存单元影响。

保持语义与对话关系正确，再查三处：

- 固定说明是否混入了每次变化的时间、随机 ID 等内容。
- 历史消息是否持续保留内容与顺序，工具调用和结果是否仍然配对。
- 必要的动态上下文能否放在较晚位置，同时让模型清楚理解它的作用。

实际命中按供应商规则观测。

## DeepSeek 的规则要看已持久化的前缀单元

**持久化**是保存可复用前缀状态；**命中**是本次实际复用。相同前缀只是条件之一。

[![假设只持久化了 P+Q，P+R 不能直接套用它；系统可以把共同的 P 单独持久化，之后 P+S 才可能命中 P](../../site/public/diagrams/kv-cache/10-prefix-persistence.svg)](../../site/public/diagrams/kv-cache/10-prefix-persistence.svg)

资料 P 相同，也需当前可用的 P 缓存单元；图不承诺第几次命中。

截至 2026-10-24，DeepSeek 缓存默认启用；须完整匹配已持久化前缀单元。单元可在请求边界、公共前缀发现后或长序列固定间隔形成。[官方规则](https://api-docs.deepseek.com/guides/kv_cache/)

只有 `P + Q` 单元时，`P + R` 不能直接复用它；系统发现公共前缀并保存 P 后，后续才可能命中 P。

用响应中的这两个字段看实际结果：

| 字段 | 含义 |
| --- | --- |
| `usage.prompt_cache_hit_tokens` | 输入中命中缓存的 token 数 |
| `usage.prompt_cache_miss_tokens` | 输入中未命中缓存的 token 数 |

缓存尽力提供，持久化与清理均影响命中；输出仍重新推理。[统计与补充说明](https://api-docs.deepseek.com/guides/kv_cache/)

## 先核对用量口径，再算命中率

**usage** 是用量统计，先看全部输入与命中数。

[![假设全部输入 10000，其中缓存命中 8000、未命中 2000；Pi 分为 cacheRead 8000 和 input 2000，再加输出 100，总量为 10100](../../site/public/diagrams/kv-cache/11-usage-buckets.svg)](../../site/public/diagrams/kv-cache/11-usage-buckets.svg)

命中与未命中相加才是全部输入；缓存减工作量，不删除上下文。

下面是一份**用于算账的假设响应**，不是本仓库的实测结果：

```json
{
  "prompt_tokens": 10000,
  "prompt_cache_hit_tokens": 8000,
  "prompt_cache_miss_tokens": 2000,
  "completion_tokens": 100,
  "total_tokens": 10100
}
```

DeepSeek 的 `prompt_tokens = hit + miss`：例中输入 10,000、命中率 80%，不能再加 8,000。`prompt_tokens_details.cached_tokens` 也可能报告同批命中，<mark class="caution">不能重复相加</mark>。[响应字段](https://api-docs.deepseek.com/api/create-chat-completion/)

输入费用为 `(hit × 命中输入单价 + miss × 未命中输入单价) / 1,000,000`，单价按每百万 token、实验当天的[官方价格](https://api-docs.deepseek.com/quick_start/pricing)，输出另计。上下文不会因此缩为 2,000。

Pi / Harness 分桶计数，`input` / `inputTokens` 是未缓存输入，缓存读取另列；此例为 `input=2000`、`cacheRead=8000`，见[Pi 转换](05-pi.md)。`miss` 不等于 `cacheWrite`，是否写入及报告写入另判。

能读出 10,000 输入中 8,000 命中即可停下，下次看 [Harness 请求组织](04-deepseek-harness.md)。细节按需展开。

<details>
<summary>SSE 流式响应在哪里取 usage</summary>

### 流式响应在哪里取 usage

**SSE** 持续发送服务端事件；chunk 是流片段，不保证对应一个 token。

DeepSeek 在 `[DONE]` 前的最后完成 chunk 报告整次 usage，仍有一个 `choices`，不另发空数组用量包。`include_usage: true` 还使此前 chunk 带 `usage: null`；解析有效对象，不能只认 `choices: []`。[流式选项](https://api-docs.deepseek.com/api/create-chat-completion/)

最终 usage 前中断时保留未知；thinking 模式分别记首次 reasoning 与回答文本时刻。

</details>

<details>
<summary>回到 Yuuki 源码，找到请求与观测入口</summary>

## 在 Yuuki 源码里读一次请求

从共享运行时 [Sources/main.swift](../../examples/shared/runtime/Sources/main.swift) 开始，按符号定位：

| 入口 | 当前实现 | 与本专题的联系 |
| --- | --- | --- |
| `history` | 保存供应商对话上下文 | 是后续请求携带的消息数据 |
| `completion` 中的 `system` 和 `payload` | 把 `system + history` 放入 `messages`，按工作区提供工具定义 | 可以检查哪些内容构成稳定前缀 |
| `run` | 追加 assistant 消息和 tool 结果，再进入下一轮调用 | 对话前缀逐轮增长 |
| `completion` 中的 `usageRecorded` | 累加输入、输出、总 token，记录未报告用量的请求 | 可在这里继续理解缓存观测要增加什么 |

`system` 含工作区路径，换工作区会改变前缀；用量处理尚未读取 hit / miss 字段。

`history` 是消息，K/V 是推理状态。当前仍发完整 `system + history`，供应商缓存不补齐遗漏对话。

## 下一次接入观测时记录什么

先按单次请求理解数据，避免把多轮 Agent 总耗时和一次模型请求混在一起：

| 观测值 | 建议定义 | 阅读结果时需要考虑什么 |
| --- | --- | --- |
| 命中与未命中 token | 保存供应商实际报告的两个字段 | 未返回字段的请求记录为未知 |
| 命中比例 | 两个字段有效且总和大于 0 时，`hit / (hit + miss)` | 比较相近输入长度，保留原始数量 |
| 客户端首段文本等待时间 | 从发起请求到收到首个非空 `delta.content` | 包含网络、排队和服务端处理等时间；纯工具响应可能没有文本 |
| 请求总耗时 | 从发起请求到完整结束或失败 | 输出长度、工具请求和中断情况都会影响解释 |
| UI 首次显示时间 | 从发起请求到界面实际展示文本 | 还包含运行时批量发布与 UI 更新开销 |

运行时合并增量再发 UI；网络接收、发布、显示是不同时间点，SSE 文本也可能含多个 token。对照 `publish`、`delta` 与[流式渲染](../learning/rendering-performance.md)阅读。

</details>

<details>
<summary>一次只改一个因素的 API 实验</summary>

## 准备一次有对照的 API 实验

以下尚未付费实测。固定模型、端点、账号和配置，准备资料 P 与问题 Q/R/S。

| 请求 | 只改变什么 | 想检验什么 |
| --- | --- | --- |
| `P + Q` | 首次提交 | 建立基线；不要假定服务端一定是冷缓存 |
| `P + Q` | 输入保持相同 | 已持久化的完整前缀是否被复用 |
| `P + R`，随后 `P + S` | 只改末尾问题 | 发现共同前缀 P，与之后真正命中 P 的区别 |
| `P′ + S` | 修改 P 开头一处内容 | 前部变化怎样影响后面的复用 |

等请求完成并留出数秒构建时间；紧接着未命中不证明 Harness 出错。多组短请求重复，保留全部结果。[缓存生命周期](https://api-docs.deepseek.com/guides/kv_cache/)

记录模型 ID、顺序、间隔、输入/输出长度、原始 usage、首段等待与终态。首轮固定工具，不同时改摘要、模型或清单；随后再加完整 `assistant tool_call → tool result`。

先看缓存字段，再看延迟分布；单次快慢或未命中都不足以下结论，输出变化也不证明失效。

## 后续深入的方向

| 继续追问的问题 | 对应内容 | 阅读入口 |
| --- | --- | --- |
| 能否减少每个 token 保存的向量数量 | GQA 共享 K/V 头 | [GQA 原始论文](https://arxiv.org/abs/2305.13245) |
| 长度增长时如何管理缓存容量 | 动态、静态、滑动窗口、量化与卸载 | [Transformers 缓存策略](https://huggingface.co/docs/transformers/en/kv_cache) |
| 多个请求怎样标识和复用共同前缀 | 分块、父前缀身份和缓存生命周期 | [vLLM 前缀缓存设计](https://docs.vllm.ai/en/latest/design/prefix_caching/) |

第一轮解释依赖、旧 K/V 有效条件，再定位 Yuuki 的请求组织、推理状态与命中报告者。

下一篇[DeepSeek Harness](04-deepseek-harness.md)继续追踪动态提示、工具顺序与缓存统计。

</details>
