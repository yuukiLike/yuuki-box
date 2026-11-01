# 第六章：AI 工作台的请求与工具执行

[上一课](05-failure.md) · [目录](README.md)

只读代码，找到<mark class="key">请求、流式接收和工具执行</mark>；无需模型 Key。

## 看图

[![页面发送任务，运行程序联系模型并安排工具；外部 MCP 工具留作后续接入](../../site/public/diagrams/ai-communication/request-map.svg)](../../site/public/diagrams/ai-communication/request-map.svg)

runtime 安排模型和工具。当前仅执行内建工具；图中虚线 MCP 尚未接入。

<div class="heading-alias" id="只找三处" aria-hidden="true"></div>

## 三个代码入口

| 入口 | 职责 |
| --- | --- |
| [协议说明](../../examples/shared/runtime/PROTOCOL.md) | `run.start` 开始，`run.cancel` 取消 |
| [completion()](../../examples/shared/runtime/Sources/main.swift:351) | 发请求，接收 SSE，拼接文字和工具参数 |
| [run()](../../examples/shared/runtime/Sources/main.swift:280) | 调用工具，把结果交回模型，再继续回答 |

一次模型回复结束，任务仍可能继续调用工具。

<div class="heading-alias" id="到这里就停" aria-hidden="true"></div>

## 验收标准

定位请求、SSE 接收与工具循环三处调用。

<details>
<summary>页面怎样收到变化</summary>

页面与 runtime 按自有格式交换 JSONL，一行一条；文字事件类似：

```json
{"type":"delta","sessionId":"…","messageId":"…","text":"追加的文字"}
```

`sessionId` 找到会话，`messageId` 找到消息，`text` 追加文字。

`completion()` 积累文字，有后续文字且间隔约 50 ms 时发布，结束时补齐；实际流畅度未测。

取消入口在 [run.cancel](../../examples/shared/runtime/Sources/main.swift:236)。它会取消任务和网络请求；已经完成的工具结果仍保留。[运行时说明](../../examples/shared/runtime/README.md)

本课仅源码阅读，未测真实模型、界面或性能；运行见[客户端说明](../../examples/README.md)。

</details>

<details>
<summary>后续学习入口</summary>

- 工具循环：[搭建 Harness](../ai-from-scaling/03-build-a-harness.md)。
- 外部工具：[MCP 工具源](../agent-engineering/01-mcp-tool-source.md)。
- 远程服务：[Supabase × Apple WeatherKit 天气 MCP](weather-mcp/README.md)。
- 模型缓存：[KV Cache](../kv-cache/00-first-request.md)。
- 界面性能：[渲染实验](../learning/rendering-performance.md)。
- 语音交互：[语音工具](../tts/README.md)。

</details>
