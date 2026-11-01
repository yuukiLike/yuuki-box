# 第四章：看清 MCP 的发现与调用

[![MCP 全景：用户操作 Host，Host 内的 Client 连接 Server；Codex、Zed、Warp、Raycast 都可以作为 Host，外接 GitHub、Context7、Playwright 等服务](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)

点击图可打开完整 SVG、放大查看；原图中的平台与服务卡片链接到官方资料。

[上一课：SSE 实战](03-sse-http.md) · [目录](README.md) · [下一课](05-failure.md)

复用[客户端与调用链实验](../ai-from-scaling/00-minimal-mcp.md)：`tools/list` 查已连接服务的工具，`tools/call` 按名称和参数调用。服务启动命令已在 `client.ts` 指定。[工具规范](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

**看输出 → 找代码 → 对照名称、参数与结果。**

## 先分清：你、Host、Client、Server

| 角色 | 负责什么 | 和你的关系 |
| --- | --- | --- |
| 用户 | 提出目标、选择应用、连接账号，按应用策略确认操作 | 你在应用里说话、查看调用与结果 |
| **Host：宿主应用** | 管理对话和模型、决定暴露哪些工具、检查权限、管理 Client | 在这个接入场景里，就是你操作的 Codex、Zed、Warp 或 Raycast |
| **Client：连接组件** | 与一个 Server 通信，发现能力、发送请求、接收结果 | 通常内置在 Host 中，接入已有平台时由平台提供 |
| **Server：能力提供程序** | 提供工具、资源或提示模板；收到调用后访问实际文件、浏览器或业务 API | 你安装、连接或自己编写的 MCP 服务 |
| 模型（LLM） | 根据上下文提出工具调用，收到结果后继续回答 | Host 通过模型接口联系它；图中紫色连接表示模型 API，绿色连接表示 MCP |

**Host 可管理多个 Client，每个 Client 连接一个 Server。远程 Server 可服务多个平台；本机程序也可以是 Server。**[MCP 官方架构说明](https://modelcontextprotocol.io/docs/learn/architecture)

日常说 Codex 是“MCP 客户端”，指它能接 MCP；按内部职责，它是 Host。

<details class="qa">
<summary>Codex、Zed、Warp、Raycast 怎样接入？</summary>

以下支持方式核对于 **2026-10-26**，指各平台自己的 AI / Agent 功能接入外部 Server。

| 平台 | 接入入口与配置 | 连接方式与边界 |
| --- | --- | --- |
| [Codex](https://learn.chatgpt.com/docs/extend/mcp) | `codex mcp`、MCP 设置；配置保存在 `config.toml` | 本机 stdio、远程 Streamable HTTP；支持相应的 token / OAuth 认证。本仓库的[Codex 实操篇](../ai-from-scaling/00-codex-mcp.md)只需编写 Server |
| [Zed](https://zed.dev/docs/ai/mcp) | Settings → AI → MCP Servers；配置字段是 `context_servers`，也可通过扩展安装 | 支持本地命令和远程 URL；Zed Agent 直接使用这些服务，外部 Agent 的配置传递还涉及 ACP |
| [Warp](https://docs.warp.dev/agents/capabilities/mcp/) | Settings → Agents → MCP servers；添加启动命令或 URL | 本地命令、Streamable HTTP，也兼容 SSE 连接；此处指 Warp 应用内的本地 Agent |
| [Raycast](https://manual.raycast.com/ai/model-context-protocol) | `Install MCP Server` / `Manage MCP Servers`；在 AI Chat、Quick AI 等入口使用 | 桌面支持 stdio 和 HTTP，HTTP 支持 OAuth；iOS 只支持 HTTP |

各平台分别配置、授权和连接。能否复用 Server，取决于双方的传输、认证与功能支持。

“在 Warp 终端里运行 Codex CLI”时，直接连接 MCP 的是 Codex；使用 Warp 自己的 Agent 时，则由 Warp 管理连接。Zed 的内置 Agent、外部 Agent 和终端线程也有各自的配置路径，详见上表官方文档。

</details>

<details class="qa">
<summary>常见 MCP Server 提供什么？</summary>

以下按用途举例，不是热度排行榜。服务提供的 Tools、Resources、Prompts，以及平台能使用其中哪些功能，都以双方实际支持为准。

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

## 1. 运行：观察两种不同的请求

已经跑过客户端实验，可以直接看下一步。首次使用先按[选修实验](../ai-from-scaling/00-minimal-mcp.md)安装依赖，再运行：

```bash
pnpm demo:mini-mcp
```

核对输出：`tools/list` 列出工具，两次 `tools/call` 保存和读取，`[结果]` 显示执行结果。重启后可取回，是因为读取同一份文件。演示离线运行，由脚本填参数。

**完成标志：** 你能从输出中分出“发现工具”和“执行工具”两个阶段。

## 2. 看图：文件操作发生在服务端

[![2026-07-28 版极简 MCP 时序：SDK 查询服务信息，客户端发现和调用工具；重建连接后再查服务信息，调用取回并读取同一磁盘文件](../../site/public/diagrams/ai-communication/04-mcp-sequence.svg)](../../site/public/diagrams/ai-communication/04-mcp-sequence.svg)

图按 **2026-07-28** 交互绘制，省略 ID、`_meta` 和版本探测进程。`auto` 模式先用 `server/discover` 查服务与版本，再用 `tools/list` 查工具。[服务发现规范](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)

**你来做：** 在源码中沿三条线找位置：

1. [demo.ts](../../examples/minimal-mcp/src/demo.ts) 的 `listTools()` 对应图中的查询清单。
2. [client.ts](../../examples/minimal-mcp/src/client.ts) 的 `client.callTool({ name, arguments: args })` 对应发送调用。
3. [server.ts](../../examples/minimal-mcp/src/server.ts) 的 `writeFile()` / `readFile()` 对应真正的文件操作。

两次服务共用目录，结束后才清理。第二次仍查询服务信息，但脚本已知 `resume` 参数，因此直接调用，不再查工具清单。

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

`resume`、`project`、`found`、`note` 由业务定义；换工具后，协议方法仍可用 `tools/call`。客户端校验 `structuredContent` 后再显示结果。`[MCP]`、`[结果]` 只是日志标签。

**完成标志：** 你能把工具名、参数、执行函数和返回原文连起来。

## 到这里完成

用代码解释：客户端怎样知道服务端有什么工具，以及一个 `tools/call` 最终怎样读到文件。想观察调用没有正常结束的情况，继续[下一课](05-failure.md)。

## 选读与参考

<details class="qa">
<summary>接上模型后，谁提出、谁执行？</summary>

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

<details class="qa">
<summary>MCP 与 SSE 有什么关系？</summary>

这里引用的规范提供 stdio 和 Streamable HTTP 两种标准传输。前者按行发送 JSON-RPC；后者可以返回 JSON，也可以使用 SSE。[传输规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

Streamable HTTP 替代了早期 HTTP+SSE 的传输布局。看旧教程时，要确认版本。

现有 Swift runtime 还在调用内建工具。把 MCP 接进去是[下一步练习](../agent-engineering/01-mcp-tool-source.md)。

</details>
