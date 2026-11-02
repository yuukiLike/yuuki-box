# 第四章：MCP 工具发现与调用

[上一课：SSE 入门](03-sse.md) · [目录](README.md) · [下一课](05-failure.md)

复用[最简 demo](../ai-from-scaling/00-minimal-mcp.md)：`tools/list` 查已连接服务的工具，`tools/call` 按名称和参数调用。服务启动命令已在 `client.ts` 指定。[工具规范](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

<mark class="key">看输出 → 找代码 → 对照结果。</mark>

## 1. 运行：观察两种不同的请求

依赖安装见[最简 demo](../ai-from-scaling/00-minimal-mcp.md)，随后运行：

```bash
pnpm demo:mini-mcp
```

输出应有 `tools/list` 和保存、读取两次 `tools/call`。离线脚本填参数，重启后读取同一文件。

完成：分清发现与执行。

<div class="heading-alias" id="先分清你hostclientserver" aria-hidden="true"></div>

## 用户、Host、Client、Server

| 角色 | 职责 | 实例与位置 |
| --- | --- | --- |
| 用户 | 提出目标、选择应用、连接账号，按应用策略确认操作 | 操作界面，查看调用与结果 |
| **Host：宿主应用** | 管理对话、模型、工具准入与 Client | Codex、Zed、Warp、Raycast |
| **Client：连接组件** | 与一个 Server 发现、请求和接收结果 | 通常由 Host 内置 |
| **Server：能力提供程序** | 提供工具、资源、提示模板，访问实际系统 | 已安装或自行开发的 MCP 服务 |
| 模型（LLM） | 根据上下文提出工具调用，收到结果后继续回答 | Host 通过模型接口联系它；图中紫色连接表示模型 API，绿色连接表示 MCP |

Host 可有多个 Client，每个 Client 连一个 Server；远程 Server 可服务多个平台，本机程序也可提供服务。[MCP 官方架构说明](https://modelcontextprotocol.io/docs/learn/architecture)

日常说 Codex 是“MCP 客户端”，指它能接 MCP；按内部职责，它是 Host。

<details class="qa">
<summary>Codex、Zed、Warp、Raycast 怎样接入？</summary>

[![MCP 全景：用户操作 Host，Host 内的 Client 连接 Server；Codex、Zed、Warp、Raycast 都可以作为 Host，外接 GitHub、Context7、Playwright 等服务](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)

点击 SVG 放大，卡片可跳转官方资料。

2026-10-26 核对：以下指平台内置 AI / Agent 接入外部 Server。

| 平台 | 接入入口与配置 | 连接方式与边界 |
| --- | --- | --- |
| [Codex](https://learn.chatgpt.com/docs/extend/mcp) | `codex mcp`、MCP 设置；配置保存在 `config.toml` | 本机 stdio、远程 Streamable HTTP；支持相应的 token / OAuth 认证。本仓库的[Codex 实操篇](../ai-from-scaling/00-codex-mcp.md)只需编写 Server |
| [Zed](https://zed.dev/docs/ai/mcp) | Settings → AI → MCP Servers；配置字段是 `context_servers`，也可通过扩展安装 | 支持本地命令和远程 URL；Zed Agent 直接使用这些服务，外部 Agent 的配置传递还涉及 ACP |
| [Warp](https://docs.warp.dev/agents/capabilities/mcp/) | Settings → Agents → MCP servers；添加启动命令或 URL | 本地命令、Streamable HTTP，也兼容 SSE 连接；此处指 Warp 应用内的本地 Agent |
| [Raycast](https://manual.raycast.com/ai/model-context-protocol) | `Install MCP Server` / `Manage MCP Servers`；在 AI Chat、Quick AI 等入口使用 | 桌面支持 stdio 和 HTTP，HTTP 支持 OAuth；iOS 只支持 HTTP |

各平台独立配置授权；能否复用取决于传输、认证和功能兼容。

Warp 终端里的 Codex CLI 使用 Codex 配置，Warp Agent 使用 Warp 配置；Zed 的不同 Agent 入口也各有配置，见上表。

</details>

<details class="qa">
<summary>常见 MCP Server 提供什么？</summary>

按用途举例；Tools、Resources、Prompts 的可用性以双方实际支持为准。

| Server | 把什么能力接进 Host | 实际连接的对象 |
| --- | --- | --- |
| [GitHub MCP](https://github.com/github/github-mcp-server) | 查询或操作仓库、Issue、PR 等 | GitHub API；官方提供本地与远程服务 |
| [Context7](https://github.com/upstash/context7) | 按库查询文档与代码示例 | Context7 的开发文档索引 |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | 打开网页、点击、读取页面 | Playwright 控制的浏览器 |
| [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/) | 读取设计上下文，按支持的功能创建或修改画布内容 | Figma 文件与设计系统；具体能力受服务模式与权限影响 |
| [Sentry MCP](https://mcp.sentry.dev/) | 查询错误、性能与项目问题 | 授权范围内的 Sentry 项目 |
| [Filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) | 读写允许目录中的文件 | 本机文件系统；这是 MCP 的参考实现之一 |

「接着做」是 Server，负责读写 Markdown。Codex 提供 Client；独立演示的 `client.ts` 用于观察连接过程。

</details>

总览图说明角色与连接关系；下面的实验和消息顺序按本课明确引用的 **2026-07-28** 规范阅读。

## 2. 看图：文件操作发生在服务端

[![2026-07-28 版极简 MCP 时序：SDK 查询服务信息，客户端发现和调用工具；重建连接后再查服务信息，调用取回并读取同一磁盘文件](../../site/public/diagrams/ai-communication/04-mcp-sequence.svg)](../../site/public/diagrams/ai-communication/04-mcp-sequence.svg)

图按 **2026-07-28** 绘制，省略 ID、`_meta`、版本探测。`auto` 先 `server/discover` 查服务和版本，再 `tools/list`。[服务发现规范](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)

**代码核对：** 对照三处调用：

1. [demo.ts](../../examples/minimal-mcp/src/demo.ts) 的 `listTools()` 对应图中的查询清单。
2. [client.ts](../../examples/minimal-mcp/src/client.ts) 的 `client.callTool({ name, arguments: args })` 对应发送调用。
3. [server.ts](../../examples/minimal-mcp/src/server.ts) 的 `writeFile()` / `readFile()` 对应真正的文件操作。

两次服务共用目录，结束后清理；第二次查询服务后，因已知 `resume` 参数而跳过工具清单。

完成：指出跨进程请求与实际文件操作。

## 3. 对照：方法名和工具名各指什么

对照 [demo.ts](../../examples/minimal-mcp/src/demo.ts) 的 `resume` 调用。下面省略由 SDK 补充的 `_meta` 版本、身份与能力字段：

```json
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"resume","arguments":{"project":"yuuki-box"}}}
```

- `tools/call`：协议方法，表示“调用一个工具”。
- `resume`：具体工具名，决定服务端执行哪个回调。
- `project`：工具参数，决定读取哪份记录。
- `id`：把请求与响应配对；这里的 `7` 是示意值。

`resume`、`project`、`found`、`note` 是业务字段；协议方法仍为 `tools/call`。客户端校验 `structuredContent` 再显示，`[MCP]`、`[结果]` 仅为日志标签。

完成：串起工具名、参数、执行函数和结果。

<div class="heading-alias" id="到这里完成" aria-hidden="true"></div>

## 验收标准

沿源码说明工具发现、`tools/call` 与文件读取的完整链路。调用异常见[下一课](05-failure.md)。

## 选读与参考

<details class="qa">
<summary>接上模型后，谁提出、谁执行？</summary>

[![接上模型后的分工：模型提出调用，应用检查并发出 MCP 请求，工具程序执行后返回结果](../../site/public/diagrams/ai-communication/04-mcp.svg)](../../site/public/diagrams/ai-communication/04-mcp.svg)

模型提出调用，应用检查连接、参数与权限，再回传结果；本课用固定代码演示。

</details>

<details>
<summary>当前版本、旧版初始化与两类错误</summary>

本例使用 SDK 的 `auto` 模式。与当前示例服务连接时，协商到 2026-07-28，首次发现并调用工具的顺序为：

```text
server/discover             查询服务身份、支持的版本与能力
tools/list                  看有哪些工具
tools/call                  调用工具
```

2026-07-28 请求各自携带版本和能力，由 SDK 处理；协议无会话状态，业务仍可存文件或数据库。[架构说明](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture#statelessness-and-discovery)

2025-11-25 使用 `initialize → notifications/initialized`；`auto` 在符合条件时可回退。先核对实际协议版本，再读规范。[旧版生命周期](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)

连接代码在 [client.ts](../../examples/minimal-mcp/src/client.ts)，输入和输出检查在 [contracts.ts](../../examples/minimal-mcp/src/contracts.ts)。

`isError` 是工具错误，JSON-RPC `error` 是协议错误；`run_check` 还可成功返回“断言失败”。<mark class="caution">调用完成不等于业务通过。</mark>[错误约定](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling)

应用保存 Run、模型调用、RPC 请求的编号映射，校验结果后交回模型。

</details>

<details class="qa">
<summary>MCP 与 SSE 有什么关系？</summary>

标准传输为 stdio 和 Streamable HTTP：前者逐行 JSON-RPC，后者返回 JSON 或 SSE。[传输规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

Streamable HTTP 替代了早期 HTTP+SSE 的传输布局。看旧教程时，要确认版本。

现有 Swift runtime 还在调用内建工具。把 MCP 接进去是[下一步练习](../agent-engineering/01-mcp-tool-source.md)。

</details>
