# 在 Codex 里用自己的 MCP

[![MCP 全景：你使用 Codex 这样的 Host，应用内置的 Client 连接你编写的 Server；Zed、Warp、Raycast 也能接入外部 MCP](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)

点击图可放大查看。**本篇里：你操作 Codex（Host），Codex 提供 Client，你编写「接着做」Server。** 四个平台的接入方式与图中服务的官方来源，见[角色与平台说明](../ai-communication/04-mcp.md#先分清你hostclientserver)。

[课程目录](README.md) · [独立协议演示](00-minimal-mcp.md)

**这一篇：只写服务端，让 Codex 真正调用一次你提供的工具。**

我们继续做「接着做」MCP：把项目进度和下一步保存为 Markdown，下次会话再取回。源码在 [`examples/codex-continue-mcp/src/server.ts`](../../examples/codex-continue-mcp/src/server.ts)，业务代码只有这一份文件。

```text
你在 Codex 里说话
  → Codex 通过内置 MCP 客户端发出请求
  → 你的 MCP 服务读写 Markdown
  → 结果回到 Codex 当前会话
```

`client.ts` 和 `demo.ts` 不属于这个版本。你提供工具，Codex 负责连接服务、发现工具、根据对话生成调用参数，再把结果交回会话。

[![每日一眼：temperature 是温度，0.2 稳、0.7 日常、1.0 多样；top_p 是核采样阈值，1.0 不裁剪、0.95 或 0.9 收窄候选。温度调概率，Top-P 划范围。](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)

采样参数速记，点击图片可放大。图中的取值是经验起点；先确认模型支持，通常先只调整其中一个，另一个保持默认。[参数说明](https://developers.openai.com/api/reference/resources/responses/websocket-events#response.create)

## 先接入 Codex

需要 Node.js 22.22 或更高版本、pnpm 11.14，以及已经可以正常使用的 Codex CLI。在仓库根目录执行：

```bash
pnpm --dir examples/codex-continue-mcp install --frozen-lockfile
pnpm --dir examples/codex-continue-mcp build

codex mcp add yuuki-continue -- \
  "$(command -v node)" \
  "$PWD/examples/codex-continue-mcp/dist/server.js"

codex mcp get yuuki-continue
```

这里的 `build` 将 `src/server.ts` 编译为 `dist/server.js`。`codex mcp add` 保存启动命令：`--` 后面是 Node 的位置和编译后的服务入口，均使用绝对路径。

重新打开一个 Codex 会话，用 `/mcp` 确认 `yuuki-continue` 已连接。之后由 Codex 启动服务，不需要另开终端运行 `pnpm start`。

如果以前已经注册过同名服务，先用 `codex mcp get yuuki-continue` 查看路径。需要切换到本版本时，执行 `codex mcp remove yuuki-continue` 后重新注册；移除连接配置不会删除记录文件。

命令与配置方法见 [OpenAI 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。本篇使用本机 stdio 服务，Codex 与服务进程之间不需要 HTTP 地址。

## 在会话里亲自调用

先用 `mcp-learning` 作为练习项目。在 Codex 中直接说：

```text
用 yuuki-continue 给 mcp-learning 保存接续记录：
今天已经理解 MCP 客户端由 Codex 提供。
下一步读 examples/codex-continue-mcp/src/server.ts，
找到 save_checkpoint 写文件的位置。
能解释工具参数怎样变成 Markdown 后就停。
```

这次没有脚本提前填好工具参数。Codex 根据你的话调用 `save_checkpoint`，服务端把收到的内容保存下来。

观察两件事：

- 会话中出现 `save_checkpoint` 工具调用，并返回保存结果。
- 打开 `~/.yuuki/continue/mcp-learning.md`，确实能看到进度、下一步和停止条件。

只有一句“已经保存”不足以说明工具执行成功；以实际工具结果和文件内容为准。如果调用被拒绝或报错，先处理该结果。

换一个 Codex 会话，再说：

```text
用 yuuki-continue 取回 mcp-learning 的接续记录，先展示原文。
```

这次应出现 `resume` 调用，并返回刚才的 Markdown 原文。

**到这里就停：能在两个会话中完成一次保存和取回，并指出记录文件在哪里。**

## 回头看你写了什么

打开 [`src/server.ts`](../../examples/codex-continue-mcp/src/server.ts)，先找四处：

| 代码 | 负责什么 |
| --- | --- |
| `server.registerTool('save_checkpoint', ...)` | 告诉 Codex：有一个保存工具，它需要哪些参数 |
| 回调里的 `writeFile()`、`rename()` | 把参数排成 Markdown，写完临时文件后替换正式记录 |
| `server.registerTool('resume', ...)` 和 `readFile()` | 提供读取工具，返回上次记录的原文 |
| 文件末尾的 `serveStdio(createServer, ...)` | 让服务通过标准输入、标准输出接收调用并返回结果 |

两个工具的输入是：

| 工具 | 必填 | 可选 |
| --- | --- | --- |
| `save_checkpoint` | `project`、`next` | `context`、`stopWhen` |
| `resume` | `project` | 无 |

`inputSchema` 中的说明供客户端发现和理解参数；实际收到的数据也会按这份规则校验。工具执行失败时返回错误，不能把失败当成已保存。

想再做一个小改动，可以修改工具的 `description`，重新编译并重开 Codex 会话，查看发现到的工具说明是否更新。改源码后需要重新运行 `build`，因为 Codex 启动的是 `dist/server.js`。

<details>
<summary>客户端、编译产物、JSON-RPC 分别在哪里？</summary>

客户端能力由 Codex 提供。原来的 [`minimal-mcp/src/client.ts`](../../examples/minimal-mcp/src/client.ts) 是独立演示使用的客户端代码；Codex 不会加载这个文件。

本版本的文件关系是：

```text
src/server.ts → TypeScript 编译 → dist/server.js → Node 运行 → MCP 服务进程
```

编译结果是一组 JavaScript 文件及对应的 source map，仍需 Node 和项目依赖。npm 包是分发程序的一种方式，MCP 协议并不要求你把服务发布成包。

Codex 内置客户端负责发出 JSON-RPC 请求，服务端 SDK 负责解析请求、找到工具回调，再包装返回结果。你只需声明工具和实现回调；源码不需要手动拼接 `jsonrpc`、请求 `id` 等协议字段。

`typecheck` 运行 `tsc --noEmit`，只检查类型；`build` 运行 `tsc`，生成可运行的 JS。两者都不能代替前面的真实会话调用和文件核对。

</details>

## 记录的范围

默认文件是 `~/.yuuki/continue/<project>.md`，与原演示版兼容。每个项目只保留最新一份记录；再次保存会替换整份旧内容，包括手动补充的内容。多个会话同时保存时，以最后完成替换的记录为准。

项目名只接受 1–64 个小写字母、数字或连字符，以字母或数字开头。读取超过 16 KiB 的记录会报错，先精简 Markdown 后再取回。

需要独立目录时，在注册命令的 `--` 前加入 `--env YUUKI_CONTINUE_DIR=/你的绝对路径`。

服务只负责文件存取，没有内置模型，也不会执行记录里的下一步。取回的文字会进入当前 Codex 会话；只保存你愿意交给该会话的内容。

需要移除连接时执行 `codex mcp remove yuuki-continue`，已经保存的 Markdown 文件仍然保留。

返回[课程目录](README.md) · 想单独观察跨进程调用，继续看[换个会话，接着做](00-minimal-mcp.md)。
