# 第四章：从 RPC 走到 MCP

[上一课](03-sse.md) · [目录](README.md) · [下一课](05-failure.md)

**这一课：模型提出要做什么，应用调用工具去执行。**

MCP 是应用与外部工具沟通的一套约定。它规定怎样连接、发现工具和发起调用。[工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

## 先运行

复用已有的[“接着做”示例](../ai-from-scaling/00-minimal-mcp.md)。首次使用，先按那篇教程安装依赖。

```bash
pnpm --dir examples/minimal-mcp demo
```

你会看到：发现工具、保存记录、重启后取回记录。

这个演示由代码直接调用工具，没有模型参与。记录写在临时目录，结束后清理。

## 看图

[![模型提出调用，应用检查并发出 MCP 请求，工具程序执行后返回结果](../../site/public/diagrams/ai-communication/04-mcp.svg)](../../site/public/diagrams/ai-communication/04-mcp.svg)

图说明接上模型后的分工。先记住：**模型提出调用，应用发出调用，工具真正执行。**

## 到这里就停

找到这两处代码：

- [demo.ts](../../examples/minimal-mcp/src/demo.ts)：`listTools()` 看有哪些工具，`callTool()` 调一个工具。
- [server.ts](../../examples/minimal-mcp/src/server.ts)：真正读写文件的地方。

能指出“调用在哪里发出，操作在哪里执行”，就完成了。

<details>
<summary>再看：MCP 在 JSON-RPC 上增加了什么</summary>

按 2025-11-25 规范，基本顺序是：

```text
initialize                  商量版本和能力
notifications/initialized   告知准备好了
tools/list                  看有哪些工具
tools/call                  调用工具
```

这是规范示意。现有示例由官方 SDK 管理连接和版本，不需要再手动发送这些消息。[生命周期](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)

一次调用可以这样写：

```json
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"resume","arguments":{"project":"yuuki-box"}}}
```

`tools/call` 是 MCP 方法，`resume` 是具体工具，`id` 用来配对这次请求和响应。[调用约定](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#calling-tools)

连接代码在 [client.ts](../../examples/minimal-mcp/src/client.ts)，输入和输出检查在 [contracts.ts](../../examples/minimal-mcp/src/contracts.ts)。

工具结果里的 `isError` 表示工具执行错误；JSON-RPC 的 `error` 表示协议层面的调用错误。[错误约定](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling)

应用还要保存运行编号、模型工具调用编号和 RPC 请求编号的对应关系。工具结果经过检查，再交回模型，让它继续回答。

</details>

<details>
<summary>选读：MCP 与 SSE 的关系</summary>

这里引用的规范提供 stdio 和 Streamable HTTP 两种标准传输。前者按行发送 JSON-RPC；后者可以返回 JSON，也可以使用 SSE。[传输规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

Streamable HTTP 替代了早期 HTTP+SSE 的传输布局。看旧教程时，要确认版本。

现有 Swift runtime 还在调用内建工具。把 MCP 接进去是[下一步练习](../agent-engineering/01-mcp-tool-source.md)。

</details>
