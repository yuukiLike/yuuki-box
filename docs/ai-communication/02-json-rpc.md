# 第二章：亲手拆开 JSON-RPC

[上一课](01-rpc.md) · [目录](README.md) · [下一课](03-sse.md)

同时发两个请求，<mark class="key">按 id 找回答</mark>。

## 先运行

```bash
node docs/ai-communication/labs/02-json-rpc.ts
```

慢请求先发、快请求先回，结果仍正确配对。

## 看图

[![先发的 id 1 后回来，后发的 id 2 先回来；每个结果仍按 id 配对](../../site/public/diagrams/ai-communication/02-id.svg)](../../site/public/diagrams/ai-communication/02-id.svg)

JSON-RPC 的基本字段：

| 字段 | 意思 |
| --- | --- |
| `method` | 做什么 |
| `params` | 需要什么参数 |
| `id` | 这次请求的编号 |
| `result` | 成功时的结果 |
| `error` | 失败时的原因 |

等待表按 id 保存请求；`id: 2` 的结果只交给编号 2。

## 到这里就停

知道回答可以乱序、配对仍靠 id 即可。

<details>
<summary>错误、通知和清理</summary>

实验还会做两件事：

- 调用不存在的方法，检查错误码 `-32601`。
- 发一条没有 id 的通知。通知不需要回答。

响应包含 `result` 或 `error` 中的一种。通知没有 id，发送方拿不到对应的结果确认。[JSON-RPC 规范](https://www.jsonrpc.org/specification)

这张等待表就是代码里的 `Map`。[rpc-client.ts](labs/rpc-client.ts) 中先找 `pending.set()`，再找 `take(response.id)`。

`take()` 清理等待项、定时器和取消监听。外部 JSON 仍需运行时检查，TypeScript 类型不能验证消息。

| 错误码 | 本实验中的意思 |
| --- | --- |
| `-32700` | JSON 写坏了 |
| `-32600` | 请求格式不对 |
| `-32601` | 方法不存在 |
| `-32602` | 参数不对 |
| `-32001` | 笔记不存在 |

断连时等待项收到“结果未知”，不同于服务端明确返回错误。

</details>

<details class="qa">
<summary>JSON-RPC 与 JSONL 有什么区别？</summary>

JSON-RPC 定义消息含义，JSONL 定义一行一个 JSON；本课将两者组合用于管道，也可换传输方式。[规范](https://www.jsonrpc.org/specification)

实验仅支持对象参数、单条消息；服务端接受字符串、数字或 null id，客户端生成数字 id。

</details>
