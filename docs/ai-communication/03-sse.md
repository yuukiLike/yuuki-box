# 第三章：从完整响应走到 SSE

[上一课](02-json-rpc.md) · [目录](README.md) · [下一课：MCP](04-mcp.md)

<mark class="key">边接收事件，边显示文字。</mark>

SSE 通过 HTTP 持续发送事件，OpenAI 的 HTTP 流式回复也使用它。[官方文档](https://developers.openai.com/api/docs/guides/streaming-responses)

## 先运行

```bash
node docs/ai-communication/labs/03-sse.ts
```

同一数据分别按 1、7、1024 字节分片，均应拼出：

```text
3 个事件 → 你好，RPC → completed
```

数据在本地模拟，没有调用模型或网络。

## 看图

[![先接收字节，再拼成完整事件，最后更新页面](../../site/public/diagrams/ai-communication/03-sse.svg)](../../site/public/diagrams/ai-communication/03-sse.svg)

一条事件可以这样写：

```text
event: delta
data: {"text":"你好"}

```

`event` 是名字，`data` 是内容。**空行表示这一条事件结束。**

一次读取可能不足或超过一条事件，先拼完整再处理。[SSE 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)

<div class="heading-alias" id="到这里就停" aria-hidden="true"></div>

## 验收标准

先拼事件、再更新文字；<mark class="caution">断流不等于完成</mark>。

缺少完成标记时，即使保留文字也不标记完成。

完成主线后，选读 [SSE 实战：真实 HTTP、断线重连与结束状态](03-sse-http.md)。

<details>
<summary>代码与分片细节</summary>

源码：[03-sse.ts](labs/03-sse.ts) · [sse.ts](labs/sse.ts)。

`decoder.decode(chunk, { stream: true })` 保留跨分片的 UTF-8 解码状态，再按空行组装事件。

网络分片、SSE 事件、模型 token 是不同单位；一个事件可装多个 token 的文字。

SSE 用 UTF-8，多行 `data` 以换行拼接。教学解析器支持 LF/CRLF、注释、`event`、`data`；未实现单独 CR、`id`/`retry`、重连或 HTTP 检查。[标准](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)

`completed` 是本实验约定；Swift runtime 使用接口约定的 `[DONE]`，都不是 SSE 通用完成标记。[源码](../../examples/shared/runtime/Sources/main.swift:351)

</details>

<details>
<summary>EventSource、fetch、WebSocket、WebRTC</summary>

| 接口 | 用途 |
| --- | --- |
| `EventSource` | 浏览器订阅 SSE 事件 |
| `fetch` | 发请求，由应用解析响应流 |
| WebSocket | 双方保持连接，持续发消息 |
| WebRTC | 实时音视频通信 |

`EventSource` 接收 URL 和凭据选项，没有任意请求头、请求体或方法参数。需要 POST 时，可以用 `fetch` 接收 SSE。[接口](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)

真实 HTTP 还需检查状态码、内容类型、响应体并传入取消信号；本课未测代理缓冲、延迟或真实断网。

OpenAI 也提供适合持续工具调用的 [WebSocket 模式](https://developers.openai.com/api/docs/guides/websocket-mode)，实时语音另有 [WebRTC 与 WebSocket 连接](https://developers.openai.com/api/docs/guides/realtime)。

重连续接依赖服务端保留历史，以及应用处理游标和重复事件。

</details>
