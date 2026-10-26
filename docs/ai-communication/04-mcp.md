# 第四章：看清 MCP 的发现与调用

[上一课](03-sse.md) · [目录](README.md) · [下一课](05-failure.md)

**这一课的目的：把“先问有哪些工具，再按约定调用”对应到代码和协议消息。**

复用[第一个 MCP 演示](../ai-from-scaling/00-minimal-mcp.md)。这次重点看两个方法：`tools/list` 返回工具名称和输入规则，`tools/call` 发送具体工具名与参数。前者发现的是已连接服务提供的工具，不是扫描电脑或搜索互联网来寻找 MCP 服务；服务启动命令在 `client.ts` 中已经指定。[工具规范](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

**你来做：看输出 → 顺时序找代码 → 对照一次调用的名称、参数和结果。**

## 1. 运行：观察两种不同的请求

已经跑过第一个演示，可以直接看下一步。首次使用先按[开场教程](../ai-from-scaling/00-minimal-mcp.md)安装依赖，再运行：

```bash
pnpm --dir examples/minimal-mcp demo
```

看到 `[MCP] tools/list → save_checkpoint, resume`，说明客户端拿到了清单；随后两次 `tools/call` 分别调用保存和读取工具，`[结果]` 显示各自的执行结果。重启后仍能取回原文，是工具读写同一份 Markdown 文件的效果；MCP 负责调用，不自动保存记录。演示由代码填写参数，安装依赖后离线运行，不需要模型。

**完成标志：** 你能从输出中分出“发现工具”和“执行工具”两个阶段。

## 2. 看图：文件操作发生在服务端

[![2026-07-28 版极简 MCP 时序：SDK 查询服务信息，客户端发现和调用工具；重建连接后再查服务信息，调用取回并读取同一磁盘文件](../../site/public/diagrams/ai-communication/04-mcp-sequence.svg)](../../site/public/diagrams/ai-communication/04-mcp-sequence.svg)

图按本例实际协商的 **2026-07-28** 版本画出逻辑交互，省略请求 ID、`_meta` 和 SDK 用于版本探测的短暂服务进程。`client.ts` 的 `versionNegotiation: { mode: 'auto' }` 让 SDK 先发送 `server/discover`，查询服务身份、支持的版本和能力；这与随后查询具体工具的 `tools/list` 是两件事。[服务发现规范](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)

**你来做：** 在源码中沿三条线找位置：

1. [demo.ts](../../examples/minimal-mcp/src/demo.ts) 的 `listTools()` 对应图中的查询清单。
2. [client.ts](../../examples/minimal-mcp/src/client.ts) 的 `client.callTool({ name, arguments: args })` 对应发送调用。
3. [server.ts](../../examples/minimal-mcp/src/server.ts) 的 `writeFile()` / `readFile()` 对应真正的文件操作。

`demo.ts` 两次使用同一个目录，因此新服务能读回文件；整个演示结束后才清理临时目录。第二次连接仍由 SDK 查询服务信息，但调用方代码已经知道 `resume` 的名称与参数，所以直接调用它，没有再次执行 `listTools()`。

**完成标志：** 你能指出哪条箭头跨过进程，以及哪条箭头真正改变了文件。

## 3. 对照：方法名和工具名各指什么

在 [demo.ts](../../examples/minimal-mcp/src/demo.ts) 找到调用 `resume` 的一行，对照下面的协议示意。为突出工具调用，这里省略 `_meta` 中的版本、客户端身份和能力字段；本例实际发送时由 SDK 补上这些元数据：

```json
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"resume","arguments":{"project":"yuuki-box"}}}
```

- `tools/call`：协议方法，表示“调用一个工具”。
- `resume`：具体工具名，决定服务端执行哪个回调。
- `project`：工具参数，决定读取哪份记录。
- `id`：把请求与响应配对；这里的 `7` 是示意值。

`resume`、`project`、`found` 和 `note` 都是本例定义的工具名或业务字段。换成 Blender 工具，会传 `modelId`，返回几何信息；协议方法仍是 `tools/call`。客户端检查 `structuredContent` 中的真实数据后，才把原文交给演示打印。终端的 `[MCP]`、`[结果]` 是日志标签，不是报文字段。

**完成标志：** 你能把工具名、参数、执行函数和返回原文连起来。

## 到这里完成

用代码解释：客户端怎样知道服务端有什么工具，以及一个 `tools/call` 最终怎样读到文件。想观察调用没有正常结束的情况，继续[下一课](05-failure.md)。

## 选读与参考

<details>
<summary>接上模型后，谁提出、谁安排、谁执行</summary>

[![接上模型后的分工：模型提出调用，应用检查并发出 MCP 请求，工具程序执行后返回结果](../../site/public/diagrams/ai-communication/04-mcp.svg)](../../site/public/diagrams/ai-communication/04-mcp.svg)

模型可以提出工具调用；应用安排连接、检查参数和权限，再把执行结果交回模型。本课的演示由固定代码完成调用，可以先独立观察这条通信链。

</details>

<details>
<summary>当前版本、旧版初始化与两类错误</summary>

本例使用 SDK 的 `auto` 模式。与当前示例服务连接时，协商到 2026-07-28，首次发现并调用工具的顺序为：

```text
server/discover             查询服务身份、支持的版本与能力
tools/list                  看有哪些工具
tools/call                  调用工具
```

2026-07-28 的请求各自携带版本与能力元数据，不靠旧连接记住它们。SDK 会处理这些字段；协议无会话状态，也不妨碍工具把业务数据保存在文件或数据库里。[架构说明](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture#statelessness-and-discovery)

旧的 2025-11-25 教程则从 `initialize → notifications/initialized` 开始，再进入发现与调用。SDK 的 `auto` 模式也能在符合回退条件时连接旧版服务。先看日志中的实际协议版本，再对照对应规范，不能把旧版初始化顺序当成本次运行记录。[旧版生命周期](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)

连接代码在 [client.ts](../../examples/minimal-mcp/src/client.ts)，输入和输出检查在 [contracts.ts](../../examples/minimal-mcp/src/contracts.ts)。

工具结果里的 `isError` 表示工具执行错误；JSON-RPC 的 `error` 表示协议层面的调用错误。另一个层次是业务结论：GitHub 实验的 `run_check` 可以成功返回“断言失败”的检查回执；调用完成不等于被测代码通过。[错误约定](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling)

应用还要保存运行编号、模型工具调用编号和 RPC 请求编号的对应关系。工具结果经过检查，再交回模型，让它继续回答。

</details>

<details>
<summary>选读：MCP 与 SSE 的关系</summary>

这里引用的规范提供 stdio 和 Streamable HTTP 两种标准传输。前者按行发送 JSON-RPC；后者可以返回 JSON，也可以使用 SSE。[传输规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

Streamable HTTP 替代了早期 HTTP+SSE 的传输布局。看旧教程时，要确认版本。

现有 Swift runtime 还在调用内建工具。把 MCP 接进去是[下一步练习](../agent-engineering/01-mcp-tool-source.md)。

</details>
