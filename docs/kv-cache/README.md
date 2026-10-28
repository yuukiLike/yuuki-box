# KV Cache 专题：从前端数组走到 DeepSeek、Harness 与 Pi

从消息数组走到模型缓存。每篇先看图和一个例子，公式、数据与源码按需展开；图片可放大。

更新日期：2026-10-24。阅读入口：[文档导航](../README.md) · [已有的渲染性能学习](../learning/rendering-performance.md)。应用篇核对官方文档与固定 commit 的源码；真实 API 命中、费用与延迟仍待实验。

## 今天只从这一页开始

**[第一站：你发出一条消息，模型收到了什么？](00-first-request.md)**

先分清客户端消息与服务端计算结果。

[![从消息数组、前缀依赖和 Q/K/V，逐步走到 DeepSeek、Harness 与 Pi；共五站](../../site/public/diagrams/kv-cache/01-study-path.svg)](../../site/public/diagrams/kv-cache/01-study-path.svg)

图中的顺序就是正文顺序。容量计算留到理解 K/V 之后再看。

## 走丢了，就回来看这一句

**KV Cache 保存模型已经算过的中间结果，让后续计算能接着做。**

依次看：保存什么、何时有效、怎样观察命中。

<details>
<summary>完整目录</summary>

如果想回补 key、Map 和内存，再打开[前端基础](../frontend-foundations/README.md)。

| 章节 | 从前端的哪个问题开始 | 读完能解释什么 |
| --- | --- | --- |
| [从一条消息开始](00-first-request.md) | messages 数组怎样到达模型 | 消息、上下文、token 与服务端 KV 的位置 |
| [从 useMemo 到前缀复用](01-from-frontend.md) | 消息列表追加一项，为什么还会重算整份派生数据 | 缓存结果、缓存依赖与增量计算的区别 |
| [从因果 Attention 到 KV Cache](02-attention-and-kv.md) | 已经算好的历史状态，什么时候可以继续使用 | Q/K/V、Prefill、Decode、失效范围与内存成本 |
| [DeepSeek 前缀缓存与 Yuuki](03-prefix-cache-and-yuuki.md) | 每轮请求都发送历史消息，服务端能复用什么 | 持久化单元、usage 口径、SSE 与请求对照实验 |
| [DeepSeek Harness 怎样保住请求前缀](04-deepseek-harness.md) | 插件、动态上下文和压缩怎样影响命中 | system 投影、工具排序、Pi 适配层与上游测试入口 |
| [Pi 怎样使用和观测缓存](05-pi.md) | 统一模型 API 怎样解释不同供应商的缓存 | 用量归一化、保留偏好、失效诊断和预热成本 |
| [关联知识与研究路线](06-study-map.md) | 学到哪里该继续，哪里可以先停 | 原理、工程与实验之间的关系，以及分阶段成果 |

容量单独在[为什么 KV 会这么大](00-why-so-large.md)解释。需要动手时，再打开[浏览器容量实验](../../site/src/pages/labs/kv-memory.astro)。

</details>

<details>
<summary>各层职责</summary>

## 先认清这几层各自做什么

| 对象 | 在本专题中的职责 | 研究入口 |
| --- | --- | --- |
| 模型推理引擎 | 计算、保存与复用 Attention 状态 | [Q/K/V 与生成循环](02-attention-and-kv.md) |
| DeepSeek API | 提供服务端上下文缓存，报告命中用量 | [规则与观测](03-prefix-cache-and-yuuki.md) |
| DeepSeek Harness（`dsh`） | 从会话与插件构造请求，通过模型适配层发出请求 | [固定源码快照](04-deepseek-harness.md) |
| Pi / `pi-ai` | 提供 Agent 循环、供应商适配与缓存用量处理 | [固定源码快照](05-pi.md) |
| Yuuki runtime | 当前发送完整的 `system + history`，尚未读取缓存字段 | [本地源码定位](03-prefix-cache-and-yuuki.md#在-yuuki-源码里读一次请求) |

DeepSeek Harness 既有专用模型适配器，也有 `pi-ai` 适配器。阅读时分别追踪两条路径；应用没有直接持有托管模型的 KV 张量。

</details>

<details>
<summary>两个本地实验</summary>

## 第一局：改一个输入，看缓存从哪里失效

在仓库根目录执行，使用 Node.js 18 或更高版本：

```bash
node docs/kv-cache/labs/prefix-cache.mjs
```

输入 `[3, 5, 2]`，我们为每一项计算到当前位置为止的累计值 `[3, 8, 10]`。随后追加、修改、截短输入，观察哪些累计值能复用。脚本会把每次结果与从头计算对照。

这一步先掌握一个依赖关系：**每个位置的结果取决于它之前的输入；追加到末尾不会改变旧位置，修改中间位置则可能影响整个后缀。** [第一篇](01-from-frontend.md)解释这个关系如何通向 KV Cache。

## 第二局：让两层小模型给出对照

第二个实验真正计算因果 Attention，使用固定权重的两层小模型：

```bash
node docs/kv-cache/labs/attention-cache.mjs
```

它比较从头计算与 KV 缓存两条路径，输出新算的 K/V 组数、QK 点积次数和数值误差。先找出哪项计数减少了，再看哪项仍然存在，最后检查输出误差。把“快一点”拆成这些具体工作，KV Cache 就开始变得可解释。

两份实验均在本地运行，无需安装依赖、下载模型或提供 API key。

</details>

<details>
<summary>每轮研究要留下什么</summary>

## 学习时持续追问的四件事

1. **保存了什么结果。** 前端可能保存过滤列表或解析树，模型缓存保存各层的 K/V 向量。
2. **结果依赖什么。** 把输入内容、位置、计算配置和可见范围放进考虑范围。
3. **变化从哪里传播。** 能复用多少，应由计算的依赖关系决定。
4. **复用之后还做什么。** 匹配缓存、读取历史状态和计算新输出都有成本。

第一轮完成的标准是：能说明为什么旧 K/V 可以复用、为什么新 Q 仍需与历史 K 做计算；应用研究完成后，再指出 DeepSeek Harness 和 Pi 在哪里保留前缀、转换用量，以及 Yuuki 还缺哪项观测。

</details>

下一步：[从一条消息开始](00-first-request.md)。
