# Worker 内存与数据搬运

[Wasm 入口](README.md) · [下一篇 浏览器 AI](browser-ai.md)

计算移到 Worker 后，还要管好数据归属与旧任务结果。

## Worker 给了什么边界

Worker 在不同于页面主线程的上下文执行，通过消息协作；它不能直接操作页面 DOM。页面仍负责交互和展示，Worker 可以负责持续计算。[MDN 使用 Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)

```js
const worker = new Worker(new URL('./compute-worker.js', import.meta.url), {
  type: 'module',
});
worker.postMessage({ type: 'run', jobId: 7, input: values });
```

这段是应用组织示意。真正接入前，先给每个任务稳定的身份，并明确何时停止接收结果。

## 复制 转移 共享分别意味着什么

| 方式 | 数据怎样到另一侧 | 调用方要考虑什么 |
| --- | --- | --- |
| 结构化克隆 | 消息携带可克隆数据的副本 | 大数据的复制和分配成本 |
| 转移 ArrayBuffer | 转移对应资源的所有权 | 原来的 buffer 会被分离，发送方不能按原方式继续使用 |
| 共享内存 | 双方访问同一块共享缓冲区 | 并发读写协议与可见性 |

Worker 消息支持结构化克隆与可转移对象。转移大缓冲区时，要把真正的 buffer 放进转移列表。[MDN Worker 数据传递](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#passing_data_by_transferring_ownership_transferable_objects)

```js
const samples = new Float32Array(16000);
worker.postMessage({ samples }, [samples.buffer]);
// 发送方随后需要按「已转移」处理 samples.buffer 的生命周期。
```

SharedArrayBuffer 的浏览器使用受安全上下文与跨源隔离等条件约束，需要检查部署和运行环境；它也要求应用明确并发访问方式。[MDN SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)

## TypedArray 可以只是同一块内存的视图

```js
const buffer = new ArrayBuffer(16);
const first = new Float32Array(buffer);
const second = new Float32Array(buffer);
first[0] = 3;
console.log(second[0]); // 3
```

两个视图共用 buffer。接运行时前，确认接口返回副本还是视图，以及底层存储何时会变；复制与长期持有的成本不同。

<details class="qa" id="取消也需要安排执行机会">
<summary>发了取消消息，Worker 为什么还在算？</summary>

同步计算占住线程时，Worker 也无法处理新消息。可分批让出执行、调用运行时取消接口，或直接终止 Worker。

本仓库 [lab-worker.js](../../examples/react-webview/src/lab-worker.js) 每批最多搜索 300 行，再用 `setTimeout` 让出执行。页面还要检查 `jobId`，拒绝过期结果。

</details>

## 给一个 AI 任务明确五个状态

可以从 `loading`、`ready`、`running`、`completed`、`failed` 开始，再按实际能力添加取消中与已取消。模型下载、初始化和一次执行是不同阶段，进度应分别有含义。

下一步进入[浏览器 AI 后端](browser-ai.md)，看看同样的任务协议如何包住 Wasm 或 WebGPU 计算。
