# 在 Codex 里用自己的 MCP

**本课只做一件事：用「接着做」MCP 保存一份项目记录，换一个 Codex 会话再取回。**

按顺序完成「接入 → 保存与取回 → 对照源码」就结束本课。正文包含这次练习需要的说明；延伸资料集中在文末，完成以后再按需查看。

先记住三个角色：你操作 Codex（Host），Codex 内置 Client，「接着做」Server 负责保存和读取 Markdown 文件。工具名与参数交给 Server，执行结果再返回 Codex。

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

重开 Codex，用 `/mcp` 确认 `yuuki-continue` 已连接。

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

看到 `resume` 返回原文，这一步完成。

同项目再次保存会替换整份记录；`resume` 只读取，不执行下一步。

## 对照源码

在编辑器里打开本地文件 `examples/codex-continue-mcp/src/server.ts`，只找下面四处，能把它们与刚才的保存、取回操作对应起来即可。

| 代码 | 作用 |
| --- | --- |
| `registerTool()`、`inputSchema` | 声明工具和参数 |
| `writeFile()`、`rename()` | 写入 Markdown，替换项目记录 |
| `resume` 中的 `readFile()` | 读取原文 |
| `serveStdio()` | 通过标准输入、输出连接 Codex |

改源码后重新运行 `build` 并重开会话：Codex 启动的是 `dist/server.js`。

## 本课完成

确认三件事就可以结束：Codex 已连接服务，换会话后取回了同一份记录，能在源码中指出工具声明与文件读写的位置。

后面的资料不计入本课的完成条件，今天可以直接停在这里。

<details>
<summary>以后再看：参考资料与其他练习</summary>

**接入与示例参考**

- [Codex 官方接入文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)：需要核对客户端配置时查阅。
- [示例说明](../../examples/codex-continue-mcp/README.md)：工具参数、目录设置与调用统计。
- [服务端源码](../../examples/codex-continue-mcp/src/server.ts)：网页版代码入口。

**角色与平台**

[![MCP 全景：你使用 Codex 这样的 Host，应用内置的 Client 连接你编写的 Server；Zed、Warp、Raycast 也能接入外部 MCP](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)

点击图可放大。四个平台的接入方式与图中服务的官方来源，见[角色与平台说明](../ai-communication/04-mcp.md#先分清你hostclientserver)。

**其他练习**

下次想观察跨进程调用时，选[独立 MCP 演示](00-minimal-mcp.md)；想做一个实际工具时，选 [MCP 实战项目](../mcp-projects/README.md)。[课程目录](README.md)保留其他学习入口。

**模型采样参数速记**

这是另一个主题，留到学习模型输出时查看。

[![temperature 用三组柱状图比较候选词的抽中概率；top_p 用绿色圆框圈住保留的候选。](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)

点击图片可放大。图中的取值是经验起点；先确认模型支持，通常先只调整其中一个，另一个保持默认。[参数说明](https://developers.openai.com/api/reference/resources/responses/websocket-events#response.create)

</details>
