# 从因果 Attention 到 KV Cache

[专题入口](README.md) · [上一篇 前端增量计算](01-from-frontend.md) · [下一篇 前缀缓存与 Yuuki](03-prefix-cache-and-yuuki.md)

上一节把“哪些派生结果可以继续使用”归结为依赖关系。现在把这个问题放进模型：在固定模型、相同位置和因果可见范围下，为什么追加一个 token 后，历史位置的 K/V 仍然有效？

## 先把模型里的数据看成数组

先把分词后的 token 看成整数 ID，模型把 ID 转成数值向量，再逐层处理。本节用 `A B C D` 表示给定的 token；实验直接提供这些符号的向量，方便用 JavaScript 数组观察。

| 名称 | 可以怎样理解它的数据形态 | 作用 |
| --- | --- | --- |
| token ID | 一个整数 | 指向词表中的一项 |
| 隐藏向量 `h` | 一个数值数组 | 当前层对这个位置的表示 |
| 模型权重 `W` | 固定的数值矩阵 | 把输入向量变换到不同表示空间 |
| K/V 缓存 | 按层、位置保存的向量集合 | 复用已经处理过的位置状态 |

权重是计算规则，KV 是这次输入产生的中间结果。换一段输入，沿用相同权重仍会得到不同的状态。

## Q K V 各自参与哪一步

在一个 Attention 头里，当前隐藏向量经过三组线性投影，得到 Query、Key 和 Value。新位置用 Q 与可见位置的 K 做点积并缩放，再经 softmax 得到权重，对 V 加权求和。[Attention Is All You Need 第 3.2 节](https://arxiv.org/html/1706.03762v7#S3.SS2)

可以先按下面这段伪代码读公式：

```js
query = project(hidden, queryWeights);
scores = visibleKeys.map(key => dot(query, key) / Math.sqrt(headDimension));
weights = softmax(scores);
attentionOutput = weightedSum(weights, visibleValues);
```

Q 表达当前如何读取上下文，K 参与决定读取权重，V 提供被加权组合的数值内容。它们都是由模型计算出的向量；“读取”是理解运算角色的说法。

对应的单头公式是：

```text
Attention(q, K, V) = softmax(q Kᵀ / √d) V
```

这里 `d` 是 Q/K 的向量维度。因果约束通过只保留允许读取的 K/V，或在 softmax 前屏蔽不可见位置来实现。

## 因果约束让旧位置保持有效

因果 Attention 的可见范围如下：

| 正在计算的位置 | 可以读取的位置 |
| --- | --- |
| A | A |
| B | A B |
| C | A B C |
| D | A B C D |

追加 D 后，A/B/C 在每一层仍然只能读取原来的前缀。因此在模型、位置和计算配置保持一致的推理中，它们的表示与 K/V 可以继续使用。这个性质逐层成立，是缓存的依据。[Hugging Face 缓存原理](https://huggingface.co/docs/transformers/en/cache_explanation)

若把 B 改成 X，C 的 token 和位置虽然相同，但它能读到的前缀改变了，深层表示也可能改变。这与上一节累计和的失效方向一致；模型里的每层状态依赖其可见上下文。

## Prefill 和 Decode 怎么衔接

Prefill 处理已有输入并填充缓存，Decode 消费新产生的 token 继续计算。实际推理实现会为这两个阶段采用不同的计算路径。[TensorRT-LLM 的上下文与生成阶段](https://nvidia.github.io/TensorRT-LLM/advanced/gpt-attention.html#context-and-generation-phases)

下面假设没有命中的跨请求前缀，使用普通的一次预测一个 token 的生成循环：

| 阶段 | 这次送入模型的 token | 计算完成后的 KV | 根据输出选出下一个 token |
| --- | --- | --- | --- |
| Prefill | A B C | A B C 的 K/V | D |
| 第一次 Decode | D | A B C D 的 K/V | E |
| 第二次 Decode | E | A B C D E 的 K/V | F |

**选出了 D，和已经计算了 D 的 K/V，是两个时刻。** D 在下一次作为模型输入被处理时，才加入缓存。理解这个顺序，有助于阅读生成循环中的输入长度和缓存长度。

新位置 D 需要自己的 Q/K/V。历史 K/V 被复用，D 的 Q 仍需与当前可见的全部 K 计算注意力，再组合 V。历史 Q 属于此前位置的查询，下一位置读取上下文时使用的是它自己的 Q，因此常规 KV 缓存保留的是 K/V。[Hugging Face 缓存更新过程](https://huggingface.co/docs/transformers/en/cache_explanation#attention-matrices)

## 用 JavaScript 比较两条计算路径

运行[两层因果 Attention 实验](labs/attention-cache.mjs)：

```bash
node docs/kv-cache/labs/attention-cache.mjs
```

实验采用固定的二维向量、两层单头 Attention、残差和简单位置输入。它对给定的 token 流计算隐藏向量；完整模型中的分词、训练、归一化、MLP 和词表采样不在这个小模型里。

读代码时沿这三个函数走：

1. `fullForward` 在每层重新处理整个序列，作为数值基线。
2. `appendToken` 只处理新 token，并在每层追加 K/V。
3. `checkResult` 对照最后位置输出，以及每一层、每个位置的 K/V。

脚本中的“一组 K/V”指一个位置在一层中的 K 与 V；QK 点积按查询与键的配对次数计数。

| 场景 | 从头算 K/V 组 | 缓存路径新算 K/V 组 | 从头算 QK 点积 | 缓存路径 QK 点积 |
| --- | --- | --- | --- | --- |
| 首次输入 A B C | 6 | 6 | 12 | 12 |
| 追加 D | 8 | 2 | 20 | 8 |
| 将 B 改为 X 后重算后缀 | 8 | 6 | 20 | 18 |

脚本逐步断言两条路径误差小于 `1e-12`。首次输入为了便于观察而按 token 执行，真实 Prefill 可以利用并行计算；这里的计数用于说明工作量，不能换算成真实模型的加速倍数。

第二行值得停下来推一次：两层各产生一组新的 K/V，所以是 2 组；D 的 Q 在每层各读取 4 个 K，所以仍有 8 次点积。缓存省去了历史位置的重复处理，读取已有上下文仍然需要工作。

第三行先把每层缓存截到共同前缀 A，再处理 X/C/D。实验还确认，同一位置的 C 在前缀改变后，第二层 K 确实改变了。只按当前 token ID 保存和查找深层 K/V，会丢失这种上下文依赖。

## 估算常规 KV 缓存的内存

对于每层都有完整 K/V、K/V 头维度相同的常规 MHA/GQA，可从张量元素数量估算有效数据大小：

```text
字节数 = 2 × B × L × T × H_kv × D × s

2     K 和 V 两份
B     相同长度的序列数量
L     层数
T     每条序列已缓存的 token 数
H_kv  每层 K/V 头数
D     每个头的向量维度
s     每个元素的字节数
```

这是对常规按层 K/V 张量形状的元素计数；张量通常可按 `[B, H_kv, T, D]` 理解。[Hugging Face 缓存存储结构](https://huggingface.co/docs/transformers/en/cache_explanation#cache-storage-implementation)

取一个假设配置：`B=1`、`L=32`、`T=4096`、`H_kv=8`、`D=128`，每个元素 2 字节，得到 `536,870,912` 字节，即 **512 MiB**。相同结构下，长度翻倍或序列数量翻倍，有效 KV 数据也翻倍。

这个数值只统计 KV 元素。模型权重、临时张量、内存分配和预留容量需要另外计算；JavaScript 实验的对象与 `Number` 也不采用这里的内存布局。

GQA 让一组 Query 头共享 K/V 头，因此估算时使用 `H_kv`，不能直接拿 Query 头数代入。[GQA 原始论文](https://arxiv.org/abs/2305.13245)

采用滑动窗口的层可以限制历史缓存长度；静态预分配和量化缓存也有各自的容量与速度取舍。遇到这些结构时，应按实际缓存布局重算。[Hugging Face 缓存策略](https://huggingface.co/docs/transformers/en/kv_cache)

## 用三个问题检查理解

1. 追加 D 后为什么能复用 C 的 K/V，而修改 B 后却可能需要重新计算 C？关键是 C 的可见前缀是否改变。
2. 为什么保留了历史 K/V，D 仍要做 QK 点积？权重由当前 Q 与可见 K 共同决定。
3. 更长的历史为什么仍然昂贵？缓存数据变多，当前查询需要读取和组合的历史状态也更多。

接下来把一次生成内部的复用扩展到不同请求：[前缀缓存与 Yuuki](03-prefix-cache-and-yuuki.md)。
