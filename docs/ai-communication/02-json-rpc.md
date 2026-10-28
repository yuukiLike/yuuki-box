# 第二章：亲手拆开 JSON-RPC

[上一课](01-rpc.md) · [目录](README.md) · [下一课](03-sse.md)

**这一课：同时发出两个请求，怎样找到各自的回答。**

## 先运行

```bash
node docs/ai-communication/labs/02-json-rpc.ts
```

先发一个慢请求，再发一个快请求。快的先回来，各自的结果仍然配对正确。

## 看图

[![先发的 id 1 后回来，后发的 id 2 先回来；每个结果仍按 id 配对](../../site/public/diagrams/ai-communication/02-id.svg)](../../site/public/diagrams/ai-communication/02-id.svg)

JSON-RPC 约定了消息的写法。先记住这几个字段：

| 字段 | 意思 |
| --- | --- |
| `method` | 做什么 |
| `params` | 需要什么参数 |
| `id` | 这次请求的编号 |
| `result` | 成功时的结果 |
| `error` | 失败时的原因 |

客户端有一张“等待表”，记录还在等回答的请求。收到 `id: 2`，就把结果交给编号 2。

## 到这里就停

能解释 **“靠 id 配对，回答可以换个顺序回来”**，就完成了。

<details>
<summary>错误、通知和清理</summary>

实验还会做两件事：

- 调用不存在的方法，检查错误码 `-32601`。
- 发一条没有 id 的通知。通知不需要回答。

响应包含 `result` 或 `error` 中的一种。通知没有 id，发送方拿不到对应的结果确认。[JSON-RPC 规范](https://www.jsonrpc.org/specification)

这张等待表就是代码里的 `Map`。[rpc-client.ts](labs/rpc-client.ts) 中先找 `pending.set()`，再找 `take(response.id)`。

调用结束时，`take()` 会删除等待项、清除定时器、移除取消监听。另一个进程发来的 JSON 也会经过实际检查；TypeScript 类型不能保证对方真的发了什么。

| 错误码 | 本实验中的意思 |
| --- | --- |
| `-32700` | JSON 写坏了 |
| `-32600` | 请求格式不对 |
| `-32601` | 方法不存在 |
| `-32602` | 参数不对 |
| `-32001` | 笔记不存在 |

连接断开时，仍在等待的调用会收到“结果未知”。这和服务端明确回答一个错误，提供的信息不同。

</details>

<details class="qa">
<summary>JSON-RPC 与 JSONL 有什么区别？</summary>

JSON-RPC 约定消息的含义。JSONL 约定一行放一个 JSON。

这里把 JSON-RPC 消息按行放进进程管道。也可以约定其他传输方式。[规范](https://www.jsonrpc.org/specification)

实验只支持对象参数和单条消息，不处理批量调用。服务端支持字符串、数字或 null id；客户端自己生成数字 id。

</details>
