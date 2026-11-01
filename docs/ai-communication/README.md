# AI 应用通信：从 RPC、SSE 到 Agent 工具调用

以笔记读取为例，追踪请求、响应、流式事件与失败状态。

每课包含<mark class="key">一张流程图、一项实验</mark>。

<div class="heading-alias" id="今天只学第一课" aria-hidden="true"></div>

## 入门实验

打开[第一课](01-rpc.md)，运行：

```bash
node docs/ai-communication/labs/01-rpc.ts
```

[![一个程序发出读笔记请求，另一个程序返回结果，两条消息带着相同的 id](../../site/public/diagrams/ai-communication/01-rpc.svg)](../../site/public/diagrams/ai-communication/01-rpc.svg)

验收：按相同 `id` 关联请求与响应。

<details>
<summary>六课与 SSE 实战目录</summary>

| 课 | 学什么 |
| --- | --- |
| [1 · RPC](01-rpc.md) | 请另一个程序做事 |
| [2 · JSON-RPC](02-json-rpc.md) | 用编号找到对应结果 |
| [3 · SSE](03-sse.md) | 一边接收，一边显示 |
| [SSE 实战](03-sse-http.md) | 用真实 HTTP 观察断流、续接与完成 |
| [4 · MCP](04-mcp.md) | 让应用调用外部工具 |
| [5 · 取消与超时](05-failure.md) | 区分停止等待与停止执行 |
| [6 · Yuuki 运行时](06-yuuki.md) | 定位请求、流式接收与工具执行 |

</details>

<div class="heading-alias" id="学完后选做让-codex-查询-apple-天气" aria-hidden="true"></div>

## 远程天气 MCP

[远程 MCP 与授权](weather-mcp/README.md)使用 Supabase 登录并调用 Apple WeatherKit，可独立开展。

<details>
<summary>运行环境与检查</summary>

需 Node.js ≥22.22。新增实验只用标准库，无需安装依赖或模型 Key；直接运行 TypeScript 不会检查类型。[Node 文档](https://nodejs.org/docs/latest-v24.x/api/typescript.html)

第四课使用已有 MCP 示例，首次运行要按原教程安装依赖。

检查新增实验：

```bash
node --test docs/ai-communication/labs/verify.test.mjs
node --experimental-eventsource --test docs/ai-communication/labs/sse-http.test.mjs
```

整理于 2026-10-25，SSE 实战补于 2026-10-30。本地实验已运行：入门模拟分片，实战验证真实 HTTP、重连与提前关闭；真实模型、界面性能未测。第六课为源码阅读。

</details>

返回[文档目录](../../site/src/pages/index.astro) · 跨专题联读[前端与 AI 实验](../learning/ai-frontend-intersections.md)。
