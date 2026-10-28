# 为什么 KV Cache 会这么大

[前端基础](../frontend-foundations/README.md) · [KV 专题](README.md) · [浏览器容量实验](../../site/src/pages/labs/kv-memory.astro)

**位置数 × 层数 × K/V 头数，让小向量累积成大缓存。** 不熟悉 K/V 时先读[Attention 图解](02-attention-and-kv.md)。

## 先想一份前端的派生数据

原文很短，解析树、布局或解码像素仍可能很大；中间结果有自己的表示。

模型同样把 token 转成数值表示，再逐层处理。K/V 缓存保存了供后续 Attention 使用的中间向量。它通过保留这些状态，避免每次从历史输入重新计算。[Hugging Face 缓存原理](https://huggingface.co/docs/transformers/en/cache_explanation)

## 从一个位置算到整段上下文

取一个假设的常规 GQA 配置：32 层，每层 8 个 K/V 头，每头 128 个数，每个数 2 字节，保存完整历史。

每个头是一组 Attention 计算。图中每步只多乘一个因素。

[![假设配置中，一组 K/V 为 512 B，乘 8 个头为 4 KiB，乘 32 层为每位置 128 KiB，再乘 4096 个位置为 512 MiB](../../site/public/diagrams/kv-cache/09-memory-stack.svg)](../../site/public/diagrams/kv-cache/09-memory-stack.svg)

图里使用二进制单位：`1 KiB = 1024 B`，`1 MiB = 1024 KiB`。B 是字节。「每个数 2 字节」是这个假设配置的精度选择，不能直接套到 JavaScript 普通数组上。

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

这是对假设张量形状的元素计数，排除了共享、分配预留、模型权重与其他工作内存。常规 K/V 可按每层 `[序列数, K/V 头数, 已缓存长度, 每头维度]` 理解。[Hugging Face 缓存存储结构](https://huggingface.co/docs/transformers/en/cache_explanation#cache-storage-implementation)

</details>

打开[KV 内存计算器](../../site/src/pages/labs/kv-memory.astro)，每次只改一个参数。先把 token 数翻倍，再把 K/V 头数减半，观察两个变化是否抵消。

<details class="qa" id="为什么要在每层保存">
<summary>为什么每层都要保存？</summary>

每层使用自己的计算规则，深层向量还包含前面层的处理结果。第一层 K/V 不能替代其他层；类似原文、解析树和布局属于不同阶段。[Transformer 论文](https://arxiv.org/html/1706.03762v7#S3.SS2)

</details>

<details class="qa" id="为什么重复出现同一个词还可能需要新的-kv">
<summary>同一个词，为什么还要新算 KV？</summary>

token 相同，位置和前缀也可能不同，深层表示因此改变。运行[两层实验](labs/attention-cache.mjs)：把 `A B` 改成 `A X`，C 的第二层 K 也会变化。

</details>

<details class="qa" id="为什么不只保留原文">
<summary>为什么不只保留原文？</summary>

只留原文也能重算，但每步都要重复历史计算。KV 用空间换计算；新 Query 仍需读取历史 K/V。[计算过程](02-attention-and-kv.md)

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

先指出方案改变了哪个乘数，再评估收益。

</details>
