# 第五章：取消、超时与重试

[上一课](04-mcp.md) · [目录](README.md) · [下一课](06-yuuki.md)

**这一课：你停止等待以后，对方可能还在做。**

## 先运行

```bash
node docs/ai-communication/labs/05-failure.ts
```

发请求的一方叫客户端，只等 20 毫秒（ms）。

读笔记的一方叫服务端，要过 120 ms 才读完。

## 看图

[![客户端在 20 毫秒时停止等待，服务端在 120 毫秒时才完成读取](../../site/public/diagrams/ai-communication/05-timeout.svg)](../../site/public/diagrams/ai-communication/05-timeout.svg)

实验会确认：

- 客户端已经超时，服务端仍读了一次。
- 客户端取消等待，服务端仍完成了第二次读取。

计数保存在内存里，没有修改用户文件。

## 再试一次之前

**先确认上一次有没有执行。** 重试可能让同一件事执行两次。

请求的 id 用来配对回答，本身不保证重复操作只执行一次。[JSON-RPC 规范](https://www.jsonrpc.org/specification)

## 到这里就停

能解释 **“停止等待以后，还要通知真正做事的一方停止”**，就完成了。

<details>
<summary>想看代码与迟到的结果</summary>

源码：[05-failure.ts](labs/05-failure.ts) · [rpc-client.ts](labs/rpc-client.ts) · [note-server.ts](labs/note-server.ts)。

实验里的 `AbortController` 只取消客户端等待，没有把取消消息发给服务端。

超时或取消时，客户端删除等待项。迟到的结果找不到原来的等待项，就会被忽略。原来的调用也不会重新变成成功。

| 看到什么 | 能确定什么 |
| --- | --- |
| 成功响应 | 对方明确返回了结果 |
| 错误响应 | 对方明确返回了错误 |
| 超时或断线 | 最终结果没有可靠到达，执行情况可能未知 |
| 点击取消 | 用户要求停止，还要继续传给执行方 |

实验不自动重试。实际应用需要根据操作约定去重、查询结果或人工核对。

</details>

<details>
<summary>选读：怎样把取消传下去</summary>

MCP 普通请求可用 `notifications/cancelled` 告知对方取消哪个请求。取消可能来晚，仍要处理迟到结果；任务增强请求另用 `tasks/cancel`。[取消规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)

Yuuki 的 [run.cancel](../../examples/shared/runtime/Sources/main.swift:236) 会取消 Swift 任务、终止网络请求、唤醒待确认操作。已经完成的工具操作仍保留记录。[运行时说明](../../examples/shared/runtime/README.md)

想继续学恢复，读[把一次运行管到底](../agent-engineering/05-harness-vertical-slice.md)。

</details>
