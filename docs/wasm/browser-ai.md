# Wasm WebGPU 与浏览器 AI 运行时

[Wasm 入口](README.md) · [Worker 与内存](workers-and-memory.md) · [其他交织点](../learning/ai-frontend-intersections.md)

`await model.run(input)` 可能运行在浏览器 CPU/GPU、本机 helper 或远端 API；<mark class="key">先确认执行位置</mark>。

## 把应用的几层分开看

| 层 | 负责什么 | 前端需要掌握什么 |
| --- | --- | --- |
| 页面与交互 | 文件选择、进度、结果与取消 | 可解释的状态、输入响应和错误展示 |
| 任务调度 | 初始化、队列、Worker 与任务身份 | 并发范围、过期结果、生命周期 |
| 模型运行时 | 载入模型、准备张量、执行算子 | 模型格式、支持的算子与输入输出 |
| 执行后端 | 用 CPU 或 GPU 完成计算 | 能力检测、资源占用与数据搬运 |

ONNX Runtime Web 提供 WebAssembly CPU 和 WebGPU 等执行路径，支持范围需要按具体模型与后端核对。[ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)

Transformers.js 提供浏览器中使用模型的高层接口，可以执行多种推理任务；底层执行仍涉及运行时与后端选择。[Transformers.js 官方文档](https://huggingface.co/docs/transformers.js/en/index)

## Wasm 和 WebGPU 分别在哪

Wasm 通常走 CPU，WebGPU 使用浏览器 GPU；模型运行时组织计算，页面加载、准备输入并显示结果。

<mark class="caution">支持 API 不等于能跑模型</mark>；还须验证算子、后端、数值与内存。[ONNX Runtime Web 性能诊断](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html)

[![冷启动包括下载与初始化，热运行复用会话但持续占用资源](../../site/public/diagrams/wasm/runtime-cold-warm.svg)](../../site/public/diagrams/wasm/runtime-cold-warm.svg)

## 冷启动和热执行分别测量

```text
第一次使用
  获取模型资源 → 初始化运行时 → 编译或准备执行 → 处理输入 → 得到结果

同一实例再次使用
  处理输入 → 得到结果
```

下载、初始化、推理分别计时；复用减少等待，也持续占资源。

如[缓存成本](../frontend-foundations/cache-cost.md)：保留结果、资源或实例节省等待，也需安排释放。

<div class="heading-alias" id="可以从一个小任务开始" aria-hidden="true"></div>

## 最小验证任务

| 任务 | 为什么适合连接前端经验 | 第一次观察什么 |
| --- | --- | --- |
| 本地资料的语义检索 | 文件列表、索引与向量查找可以放在同一条链上 | 文本切块、向量生成与查询的独立成本 |
| 短音频处理 | 已有录音、TypedArray 和任务状态的自然入口 | 数据格式、缓冲区传递与初始化 |
| 小型文本分类 | 输入输出明确，易于观察 Worker 协作 | 首次加载、重复执行与过期结果 |

先选输入输出明确的模型，核对体积、运行时和目标设备。

当前文档站的 Wasm 实验只运行随页面提供的小模块。接入实际模型时，再把下载进度、资源缓存、失败和释放机制一起落地。

## 连接回 KV Cache

自回归模型仍需处理历史、缓存和上下文；Wasm/GPU 改变执行方式，保留哪些状态取决于模型与推理实现。

先用[KV 容量实验](../../site/src/pages/labs/kv-memory.astro)看量级，再检查 Worker 与运行时的资源归属。
