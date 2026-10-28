# 在 Codex 里用自己的 MCP

[![MCP 全景：你使用 Codex 这样的 Host，应用内置的 Client 连接你编写的 Server；Zed、Warp、Raycast 也能接入外部 MCP](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)

点击图可放大查看。**本篇里：你操作 Codex（Host），Codex 提供 Client，你编写「接着做」Server。** 四个平台的接入方式与图中服务的官方来源，见[角色与平台说明](../ai-communication/04-mcp.md#先分清你hostclientserver)。

[课程目录](README.md) · [独立协议演示](00-minimal-mcp.md)

用「接着做」MCP 保存项目进度，下个会话再取回。你写服务端，Codex 提供客户端。

[![每日一眼：temperature 用三组柱状图比较同一组候选词的抽中概率，低温突出第一名，高温让其他词也更有机会；0.2 稳、0.7 日常、1.0 多样。top_p 用绿色圆框圈住保留的候选，1.0 不裁剪、0.95 或 0.9 收窄候选。](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)

采样参数速记，点击图片可放大。图中的取值是经验起点；先确认模型支持，通常先只调整其中一个，另一个保持默认。[参数说明](https://developers.openai.com/api/reference/resources/responses/websocket-events#response.create)

## 接入 Codex

准备 Node.js ≥22.22、pnpm 11.14 和可用的 Codex CLI。在仓库根目录执行：

```bash
pnpm --dir examples/codex-continue-mcp install --frozen-lockfile
pnpm --dir examples/codex-continue-mcp build

codex mcp add yuuki-continue -- \
  "$(command -v node)" \
  "$PWD/examples/codex-continue-mcp/dist/server.js"

codex mcp get yuuki-continue
```

重开 Codex，用 `/mcp` 确认 `yuuki-continue` 已连接。[官方接入文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

## 保存与取回

在 Codex 中说：

```text
用 yuuki-continue 给 mcp-learning 保存接续记录：
已理解 Codex 提供 MCP 客户端。
下一步读 examples/codex-continue-mcp/src/server.ts，找到保存记录的代码。
能解释参数怎样变成 Markdown 就停。
```

核对 `save_checkpoint` 的调用结果，以及 `~/.yuuki/continue/mcp-learning.md` 的内容。

换一个 Codex 会话：

```text
用 yuuki-continue 取回 mcp-learning 的接续记录，先展示原文。
```

看到 `resume` 返回原文，练习完成。

同项目再次保存会替换整份记录；`resume` 只读取，不执行下一步。

## 对照源码

打开 [`src/server.ts`](../../examples/codex-continue-mcp/src/server.ts)，找四处：

| 代码 | 作用 |
| --- | --- |
| `registerTool()`、`inputSchema` | 声明工具和参数 |
| `writeFile()`、`rename()` | 写入 Markdown，替换项目记录 |
| `resume` 中的 `readFile()` | 读取原文 |
| `serveStdio()` | 通过标准输入、输出连接 Codex |

改源码后重新运行 `build` 并重开会话：Codex 启动的是 `dist/server.js`。

工具参数、目录设置与调用统计，见[示例说明](../../examples/codex-continue-mcp/README.md)。

返回[课程目录](README.md) · 想单独观察跨进程调用，继续看[换个会话，接着做](00-minimal-mcp.md)。
