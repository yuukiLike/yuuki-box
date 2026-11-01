# 为什么 KV Cache 会这么大

[前端基础](../frontend-foundations/README.md) · [KV 专题](README.md) · [浏览器容量实验](../../site/src/pages/labs/kv-memory.astro)

<mark class="key">位置数 × 层数 × K/V 头数</mark>，让小向量累积成大缓存。K/V 入门见[Attention 图解](02-attention-and-kv.md)。

<div class="heading-alias" id="先想一份前端的派生数据" aria-hidden="true"></div>

## 前端派生数据类比

原文短，解析树、布局或解码像素仍可能很大。

模型逐层处理 token 的数值表示，缓存 K/V 中间向量，避免每步重算历史。[缓存原理](https://huggingface.co/docs/transformers/en/cache_explanation)

## 从一个位置算到整段上下文

取一个假设的常规 GQA 配置：32 层，每层 8 个 K/V 头，每头 128 个数，每个数 2 字节，保存完整历史。

每个头是一组 Attention 计算。图中每步只多乘一个因素。

[![假设配置中，一组 K/V 为 512 B，乘 8 个头为 4 KiB，乘 32 层为每位置 128 KiB，再乘 4096 个位置为 512 MiB](../../site/public/diagrams/kv-cache/09-memory-stack.svg)](../../site/public/diagrams/kv-cache/09-memory-stack.svg)

单位为 `1 KiB = 1024 B`、`1 MiB = 1024 KiB`，B 是字节。每数 2 字节是假设精度，不能套到 JavaScript 普通数组。

**其他条件不变，保存的位置翻倍，KV 有效数据就翻倍。**

<details>
<summary>字节数对照</summary>

| 保存范围 | 如何计算 | 有效数据量 |
| --- | --- | --- |
| 一个位置、一个头的 K | `128 × 2` | 256 B |
| 加上对应的 V | `256 × 2` | 512 B |
| 这一层的 8 个 K/V 头 | `512 × 8` | 4 KiB |
| 32 层的这个位置 | `4 KiB × 32` | 128 KiB |
| 一条序列的 4096 个位置 | `128 KiB × 4096` | 512 MiB |
| 四条独立序列，各 4096 个位置 | `512 MiB × 4` | 2 GiB |

以上只数假设张量元素，不含共享、预留、权重及工作内存。常规 K/V 每层形状为 `[序列数, K/V 头数, 已缓存长度, 每头维度]`。[存储结构](https://huggingface.co/docs/transformers/en/cache_explanation#cache-storage-implementation)

</details>

打开[内存计算器](../../site/src/pages/labs/kv-memory.astro)，先将 token 翻倍，再将 K/V 头减半，观察能否抵消。

<details class="qa" id="为什么要在每层保存">
<summary>为什么每层都要保存？</summary>

各层计算不同，深层还包含前层结果；第一层 K/V 不能替代其他层。[Transformer 论文](https://arxiv.org/html/1706.03762v7#S3.SS2)

</details>

<details class="qa" id="为什么重复出现同一个词还可能需要新的-kv">
<summary>同一个词，为什么还要新算 KV？</summary>

token 相同，位置或前缀不同仍会改变深层表示。[两层实验](labs/attention-cache.mjs)把 `A B` 改为 `A X`，C 的第二层 K 也变。

</details>

<details class="qa" id="为什么不只保留原文">
<summary>为什么不只保留原文？</summary>

只留原文就要每步重算历史；KV 用空间换计算，<mark class="caution">新 Query 仍读取历史 K/V</mark>。[计算过程](02-attention-and-kv.md)

</details>

<details id="能从哪些乘数开始减少">
<summary>减少空间的方向</summary>

| 方向 | 改变哪一部分 | 需要理解的条件 |
| --- | --- | --- |
| 更短或经过组织的上下文 | 保存的位置数量 | 保留完成任务需要的信息 |
| GQA | K/V 头数 | 属于模型架构，取决于所用模型 |
| 更低精度的 KV | 每元素字节数 | 要考虑数值误差与额外转换 |
| 滑动窗口等结构 | 某些层的历史长度 | 按模型的实际可见范围计算 |
| 兼容的共享前缀 | 不同请求间的重复状态 | 按引擎的共享、持久化和引用管理规则处理 |

GQA 的 K/V 头共享机制见[原始论文](https://arxiv.org/abs/2305.13245)，缓存精度、窗口和卸载的取舍见[Transformers 缓存策略](https://huggingface.co/docs/transformers/en/kv_cache)，跨请求复用接着看[前缀缓存与 Yuuki](03-prefix-cache-and-yuuki.md)。

按方案改变的乘数评估空间收益。

</details>
