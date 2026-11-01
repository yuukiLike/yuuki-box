# 消息查找：扫描与索引

比较一万条消息中的顺序查找与索引查找，观察目标位置、查询次数和缓存成本。

<span id="先回答三个问题"></span>

<div class="heading-alias" id="先回答两个问题" aria-hidden="true"></div>

## 核心问题

| 问题 | 阅读入口 | 可以动手观察什么 |
| --- | --- | --- |
| 为什么需要 key 和 Map | [key 与索引](keys-and-maps.md) | 数组查找与预先建立索引的成本 |
| 已经缓存了，为什么仍然慢或占内存 | [缓存的成本](cache-cost.md) | 引用、保留的数据、命中率和失效范围 |

打开[数组与 Map 实验](../../site/src/pages/labs/lookup.astro)，预测查第一项、最后一项的工作量，再运行核对。

同时评估<mark class="key">索引构建时间与空间成本</mark>。

先学查找、引用与失效；模型数值缓存另选读 [KV Cache](../kv-cache/README.md)。

<div class="heading-alias" id="分清我们在优化什么" aria-hidden="true"></div>

## 优化目标与工具

减少查找、重复计算、搬运或主线程阻塞，需要不同工具。

| 想减少的工作 | 熟悉的前端工具 | 进一步通向哪里 |
| --- | --- | --- |
| 反复从头查找同一个对象 | Map、按 ID 建立索引 | 数据身份与缓存键 |
| 对相同输入重复计算 | useMemo、派生结果缓存 | 前缀复用与 KV Cache |
| 一直保存不再需要的数据 | 作用域、删除、容量限制 | 模型缓存的生命周期 |
| 阻塞界面事件处理 | 分批处理、Web Worker | Wasm 与推理任务调度 |
| 大块数值计算和运行既有库 | TypedArray、WebAssembly | 浏览器端模型运行时 |

先明确减少什么，再比较总耗时与空间；调用少了，准备工作可能更多。

接下来读：[key、Object、Map 与 WeakMap](keys-and-maps.md)。
