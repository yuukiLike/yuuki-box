# SSE 实战：真实 HTTP、断线重连与结束状态

[上一课：SSE 入门](03-sse.md) · [目录](README.md) · [下一课：MCP](04-mcp.md)

**这一课：让连接在半路断开，再接着收；文字补齐后，才把状态改成完成。**

上一课用本地字节练习解析。本课启动真正的 HTTP 服务，在浏览器里观察 `EventSource`。数据仍是写好的五条事件，不调用模型，也不需要 API Key。

## 先运行，再断一次

在项目根目录运行，使用 Node.js 22.22 或更高版本：

```bash
node docs/ai-communication/labs/03-sse-http.ts
```

打开终端打印的 `http://127.0.0.1:端口`，点击 **「模拟断流重连」**。端口每次可能不同。

你会看到：

1. 第一次连接收到 `id=1`、`id=2`，页面显示「你好，」。
2. 服务端提前结束响应。页面保留文字，显示「等待自动重连；尚未完成」。
3. 浏览器重新连接，服务端补发 `id=3`、`id=4`、`id=5`。
4. 页面显示「你好，SSE。」；收到 `completed` 后显示完成，并主动关闭订阅。

浏览器开发者工具的 **Network → 第二次 `/events?mode=drop` 请求 → Request Headers** 中，应能找到 `Last-Event-ID: 2`。它告诉服务端上次读到了哪里。

再点「正常接收」，收到一段文字后点「停止接收」。已收到的文字会保留，状态应是「已停止接收；尚未确认完成」。终端按 `Ctrl+C` 退出服务。

## 看图

[![浏览器收到事件 1 和 2 后连接中断，重连带上 Last-Event-ID 2，服务端补发 3 到 5，客户端收到 completed 后关闭订阅](../../site/public/diagrams/ai-communication/03-sse-http.svg)](../../site/public/diagrams/ai-communication/03-sse-http.svg)

**连接结束，只说明这条连接结束了。业务完成，要看双方约定的完成事件。**

这里的 `completed` 是实验自定义的事件名。SSE 没有统一的“模型生成完毕”事件；接入具体接口时，要按那个接口的约定处理。

## 到这里就停

只记住这三个状态：

| 你观察到什么 | 本实验怎样显示 |
| --- | --- |
| 收到 `delta` | 追加文字，继续等待 |
| 响应中途结束，正在重连 | 保留文字，尚未完成 |
| 收到 `completed` | 标记完成，调用 `close()` |

源码只有一个文件：[03-sse-http.ts](labs/03-sse-http.ts)。先看 `history`，再看服务端怎样读 `last-event-id`，最后看浏览器怎样处理事件和连接状态。

<details>
<summary>响应里有什么？id、retry 和注释分别做什么？</summary>

实验的响应头包含：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no
```

响应体开头和第一条事件如下，块与块之间留一个空行：

```text
retry: 500

: connected

id: 1
event: delta
data: {"text":"你好"}

```

`event` 决定监听哪个事件，`data` 是内容；`id` 留下续接位置，`retry: 500` 给出 500 毫秒的重连等待值，实际重连可能更晚。以 `:` 开头的是注释，不会成为业务消息。本实验只发一次连接注释；长时间没有数据的服务可以定期发注释心跳，间隔要配合实际链路的超时设置。[MDN：事件流格式](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format)

本课让浏览器负责解析；上一课的教学解析器没有实现 `id`、`retry` 和重连，不能直接拿来替代完整的 `EventSource`。

</details>

<details>
<summary>自动重连，为什么不等于自动恢复任务？</summary>

同一个 `EventSource` 自动重连时，会携带已经记录的非空事件 ID。**服务端必须根据它查找并补发历史**，客户端才有内容可续接。[HTML 标准：Last-Event-ID](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)

本实验的历史只有五条，全部提前存在内存里。服务端收到 `2` 就发送 `3、4、5`；客户端也按本实验的递增整数 ID 跳过已经显示的文字。SSE 的 ID 本身可以是字符串，不要求递增整数。

放进真实任务时，还要明确：

- **事件属于哪个任务。** 重连应订阅原任务，不能顺手再创建一次生成任务。
- **历史保留多久。** 游标过期或服务重启丢失历史时，需要重新取快照或明确报错；不能悄悄漏掉中间内容。
- **如何处理重复。** 去重与保存进度属于应用逻辑。带了 ID，不代表下游副作用“恰好执行一次”。

刷新页面或点击按钮创建新的 `EventSource`，不会继承旧对象的游标。本实验因此从头开始；跨刷新恢复需要应用保存任务与进度，并设计服务端接受的恢复参数。

</details>

<details>
<summary>为什么要主动 close？204 又表示什么？</summary>

有效事件流结束后，原生 `EventSource` 通常会尝试重连。所以实验收到 `completed` 就调用 `close()`，停止订阅。若客户端带着末尾游标 `5` 再来，服务端返回 `204 No Content`，让它停止重连。[HTML 标准：处理模型](https://html.spec.whatwg.org/multipage/server-sent-events.html#processing-model)

**`204` 是停止重连的信号，不能单独证明业务成功。** 如果客户端没收到它所需的完成事件，界面仍应保留“尚未确认完成”，再按应用约定查询任务状态。

点击「停止接收」也会 `close()`。本实验随连接关闭清理发送定时等待；真实后台推理、队列任务或工具调用是否停止，取决于服务端有没有取消机制。这个问题接着看[第五课：取消与超时](05-failure.md)。

</details>

<details>
<summary>接模型接口时，选 EventSource 还是 fetch？</summary>

| 需要做什么 | 合适的入口 |
| --- | --- |
| 用一个 URL 订阅已有任务的事件 | 原生 `EventSource`，由它负责解析和重连 |
| 发送 POST、JSON 请求体或自定义 Authorization 头 | `fetch`，再读取响应流 |

原生 `EventSource` 的构造参数只有 URL 和凭据选项，没有任意方法、请求体或自定义请求头。[接口定义](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)

用 `fetch` 时，应先检查 HTTP 状态、`Content-Type` 和响应体，再解析 SSE；失败响应可能是 JSON 或 HTML。取消通过 `AbortController` 传入 `signal`。`fetch` 不替你实现 SSE 游标续接；重试 POST 还可能重复创建任务，要先定义任务 ID 与幂等规则。[MDN：使用 Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

本实验的 `/events` 只接受 GET；POST 会返回 `405`。这里只比较接入方式，没有提供模型代理或鉴权服务。

</details>

<details>
<summary>本地能逐字显示，上线后为什么变成一大块？</summary>

沿着“应用写入 → 代理转发 → 客户端读取 → 页面更新”逐段检查。本实验用 `flushHeaders()` 尽早发出响应头；`write()` 遇到背压时等待 `drain`，避免不断往发送队列里塞数据。这些操作不能保证远端已经收到或显示。[Node HTTP：响应写入](https://nodejs.org/docs/latest-v24.x/api/http.html#responsewritechunk-encoding-callback)

Nginx 的代理缓冲可能攒住响应。本实验发送 `X-Accel-Buffering: no`；它是否生效取决于代理配置，例如 `proxy_ignore_headers` 可以禁用这种控制。也要检查其他代理、压缩层与客户端更新节奏。[Nginx：proxy_buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering)

先在开发者工具确认事件是否按时到达，再判断是网络缓冲还是界面更新的问题。收到很密集的事件时，页面也可以合并渲染更新，继续看[流式渲染性能](../learning/rendering-performance.md)。

</details>

<details>
<summary>验证方法与实验边界</summary>

运行自动检查：

```bash
node --experimental-eventsource --test docs/ai-communication/labs/sse-http.test.mjs
```

这个开关用于 Node 测试进程的原生 `EventSource`，打开浏览器做实验不需要它。检查覆盖真实 HTTP、响应类型、游标补发、自动重连携带 `Last-Event-ID`、完成后关闭、提前关闭及错误请求。[测试源码](labs/sse-http.test.mjs)

2026-10-30 使用 Node.js 24.15.0 验证，并用无界面 Chrome 检查正常接收、自动重连、完成关闭和停止按钮。页面没有脚本错误，390 像素宽度下没有横向溢出。

本实验通过服务端提前结束响应模拟中途断流；不等同于真实断网测试。事件是固定数据，未测试真实模型、代理/CDN、鉴权、多用户并发或持久化恢复。

</details>
