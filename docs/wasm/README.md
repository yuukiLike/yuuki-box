# JavaScript 调用 WebAssembly

先调用 Wasm 加法、试整数边界，再学 Worker、内存与模型运行时。

## 先调用一个真实的小模块

打开[JavaScript 调用 Wasm](../../site/src/pages/labs/wasm-bridge.astro)，点击「调用 Wasm add」，核对默认输入 `21 + 21` 得到 `42`；再修改两个整数。

下面的小模块只导出整数加法，首次可跳过源码：

```wasm
(module
  (func (export "add") (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add))
```

[模块字节与 JavaScript 封装](labs/wasm-add.mjs)随仓库提供。修改输入后测试 `2147483647 + 1`：<mark class="key">核对 i32 整数范围</mark>。

JS 调用并显示，Wasm 执行导出函数；换模型还需文件、张量、后端与任务状态。

## 先分清三件事

| 工具 | 主要解决什么问题 | 一个前端例子 |
| --- | --- | --- |
| JavaScript | 应用逻辑、事件和 Web API 组织 | 接收文件、展示进度、更新结果 |
| WebAssembly | 在宿主里执行编译后的模块，通过明确接口交互 | 调用一段编译来的计算库 |
| Web Worker | 把任务放到独立的执行线程，与页面通过消息协作 | 长计算期间让主线程继续处理输入 |

Wasm 通过模块、实例、导入导出和线性内存与 JS 协作，可复用编译后的 C/C++、Rust 库。[MDN WebAssembly 概念](https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Concepts)

<mark class="caution">Wasm 仍可阻塞主线程</mark>；转移计算要另用 Worker。

[![主线程运行 Wasm 仍可能阻塞界面，Worker 用来转移工作并处理通信成本](../../site/public/diagrams/wasm/thread-boundary.svg)](../../site/public/diagrams/wasm/thread-boundary.svg)

## Wasm 的价值从哪里来

适合复用成熟库，或边界明确的数值计算；收益须测完整流程。

总成本可以拆成：

```text
下载与缓存模块 → 编译或实例化 → 准备输入 → 调用计算 → 读取输出 → 显示
```

小函数可能主要花在初始化与调用准备；大任务还需测内存、复制与算法。按完整流程比较 JavaScript 和 Wasm。

<div class="heading-alias" id="接着看两个真正相交的地方" aria-hidden="true"></div>

## 扩展：Worker 与浏览器 AI

| 章节 | 从前端已有经验开始 | 连接到 AI 的问题 |
| --- | --- | --- |
| [Worker 与内存搬运](workers-and-memory.md) | 消息、ArrayBuffer、取消和过期结果 | 怎样让推理持续工作而界面仍可操作 |
| [浏览器里的 AI 后端](browser-ai.md) | 异步初始化、资源加载与能力检测 | Wasm、WebGPU 和模型运行时各在哪一层 |

先以固定计算验证 Worker 的启动、取消、错误与数据归属，再接模型。其他方向见[AI 与前端的交织点](../learning/ai-frontend-intersections.md)。
