# 联读指南：前端与 AI 实验

从前端经验进入 AI：流式更新、缓存、Worker 和乱序结果。<mark class="key">一次只改一个因素</mark>，比较输出、工作量和成本；各专题可独立学习。

入门先做数组查找或 Wasm 加法，再进入通信与 Worker；模型缓存和跨框架测量按需进阶。

<span id="实验分类应用通信查找缓存kv浏览器计算与界面响应"></span>

## 先选一个实验

<div class="learning-map-table" role="region" aria-label="实验分类与学习入口" tabindex="0">

| 所属专题 | 实验对象 | 起步操作 | 入口 |
| --- | --- | --- | --- |
| 前端性能 | 查找与缓存 | 把目标从第一项换到最后一项，比较工作量与额外空间 | [前端缓存](../frontend-foundations/README.md)、[数组与 Map 实验](../../site/src/pages/labs/lookup.astro) |
| 前端性能 | 浏览器计算 | 调一次 Wasm，再把固定计算安排到 Worker | [Wasm](../wasm/README.md)、[Wasm 实验](../../site/src/pages/labs/wasm-bridge.astro)、[已有 Worker](../../examples/react-webview/src/lab-worker.js) |
| 应用通信 | 请求与响应 | 请另一个程序读笔记，追踪结果怎样回来 | [RPC、SSE 与 Agent 小课](../ai-communication/README.md) |
| 前端性能 | 界面响应 | 用相同文本和负载切换更新方式，观察解析、输入与滚动 | [渲染与流式输出](rendering-performance.md)、[十五个场景](harness-scenario-lab.md) |
| 模型推理 | KV Cache | 修改中间输入，再把上下文长度翻倍，观察复用与容量 | [KV 专题](../kv-cache/README.md)、[KV 内存计算器](../../site/src/pages/labs/kv-memory.astro) |

</div>

<div class="heading-alias" id="想从一个小模块起步就选-wasm" aria-hidden="true"></div>

## Wasm 入门路线

打开 [Wasm 实验](../../site/src/pages/labs/wasm-bridge.astro)，追踪一次 JavaScript → 模块 → 页面；再读 Worker，走通固定计算、状态和取消。

这条路线先固定输入输出，再组合流式渲染与 KV Cache：分别观察客户端批处理和服务端复用。

## 实验记录：输入、输出、工作量与资源成本

一个实验先只改一个因素：

- 查找实验改数据量或目标位置，分别记录索引准备和查找工作。
- 缓存实验改内容、版本或容量，观察命中、失效与淘汰。
- Worker 实验改批次大小，观察吞吐、响应和取消机会。
- 浏览器 AI 实验区分首次初始化与同一实例的重复执行。

记录正确输出、实际工作和资源生命周期；性能数字附设备、输入、构建方式、测量位置。

最短三行：`改了什么 / 输出是否一致 / 工作与成本如何变化`。保留预测失误。

<div class="heading-alias" id="想把实验接回真正的功能" aria-hidden="true"></div>

## 接入实际功能

选做：[语音工具](../tts/README.md)检测人声并转写；[浏览器 AI](../wasm/browser-ai.md)比较关键字与语义查询；[Agent 工程实验](../agent-engineering/README.md)追踪启动、取消和恢复。

<div class="heading-alias" id="现有资料怎样放回学习地图" aria-hidden="true"></div>

## 关联资料

| 资料 | 在这张地图里的用途 |
| --- | --- |
| [十五个 Harness 场景](harness-scenario-lab.md) | 看更新范围、解析、桥接与后台任务的具体路径 |
| [模型与语音基础](../architecture/ai-and-speech-foundation.md) | 看一项能力如何接进已有运行时 |
| [简单与组合研究](../deep/2026-09-26-simplicity-composition-complexity/README.md) | 理解能力之间的接口、状态和时间关系 |
| [Zed Rust 与 PI 研究](../deep/2026-09-26-zed-pi-rust/README.md) | 阅读更完整应用的状态归属与跨进程协作 |

研究结论受各自日期与范围限制；复用代码后仍需独立验证。
