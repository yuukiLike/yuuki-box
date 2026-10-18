# Worker 内存与数据搬运

[Wasm 入口](README.md) · [下一篇 浏览器 AI](browser-ai.md)

计算移到 Worker 后，主线程与后台任务需要交换数据。新的问题随之出现：数据是复制、转移还是共享，谁还能继续使用它，旧任务的结果是否仍然有效？

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

这里两个视图指向同一个 buffer。接 Wasm 或模型运行时之前，应弄清接口给的是副本还是视图，以及运行时何时可能替换或扩展底层存储。读取向量之后立即复制，和长期持有一份视图，会有不同的成本与生命周期。

## 取消也需要安排执行机会

看仓库已有的 [lab-worker.js](../../examples/react-webview/src/lab-worker.js)：它把搜索分为每批最多 300 行，在批次之间用 `setTimeout` 让出执行机会，让取消消息和新任务能被处理。

如果一个同步函数一直运行，Worker 自己也无法在中间处理新消息。应用可以选择协作式分批、运行时提供的取消能力，或直接终止 Worker；它们对状态和资源的影响不同。

同时保留 `jobId` 或版本号。用户输入新问题后，即使旧任务完成，页面也应先判断它是否仍是当前需要的结果。这连接到前端熟悉的异步竞态管理。

## 给一个 AI 任务明确五个状态

可以从 `loading`、`ready`、`running`、`completed`、`failed` 开始，再按实际能力添加取消中与已取消。模型下载、初始化和一次执行是不同阶段，进度应分别有含义。

下一步进入[浏览器 AI 后端](browser-ai.md)，看看同样的任务协议如何包住 Wasm 或 WebGPU 计算。
