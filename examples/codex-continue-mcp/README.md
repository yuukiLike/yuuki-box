# 给 Codex 使用的「接着做」MCP

这个版本只提供 MCP 服务端。你在 Codex 里说话，Codex 用内置的 MCP 客户端调用工具。业务代码都在 [`src/server.ts`](src/server.ts)，不需要编写客户端或演示脚本。

完整跟做教程：[在 Codex 里用自己的 MCP](../../docs/ai-from-scaling/00-codex-mcp.md)。

```text
你在 Codex 里说话
  → Codex 发起 MCP 工具调用
  → 本项目的 server.ts 读写 Markdown
  → Codex 收到结果并回答
```

## 先接入，再用一次

需要 Node.js 22.22 或更高版本、pnpm 11.14，以及已经可以正常使用的 Codex CLI。在仓库根目录执行：

```bash
pnpm --dir examples/codex-continue-mcp install --frozen-lockfile
pnpm --dir examples/codex-continue-mcp build

codex mcp add yuuki-continue -- \
  "$(command -v node)" \
  "$PWD/examples/codex-continue-mcp/dist/server.js"

codex mcp get yuuki-continue
```

`codex mcp add` 保存启动命令。之后由 Codex 启动并连接这个服务，不需要另开终端运行 `pnpm start`。Node 和服务入口使用绝对路径，切换工作目录后仍能启动。

重新打开一个 Codex 会话，用 `/mcp` 确认 `yuuki-continue` 已连接，然后直接说：

```text
用 yuuki-continue 给 yuuki-box 保存接续记录：
今天已经理解 MCP 客户端由 Codex 提供。
下一步读 src/server.ts，找到 save_checkpoint 写文件的位置。
能解释工具参数怎样变成 Markdown 后就停。
```

这次调用的内容来自你的对话。应当能看到 `save_checkpoint` 工具调用和保存结果，文件位于 `~/.yuuki/continue/yuuki-box.md`；只有口头说“保存了”不算完成。

换一个 Codex 会话，再说：

```text
用 yuuki-continue 取回 yuuki-box 的接续记录，先展示原文。
```

看到 `resume` 调用返回上次记录，就可以停。接入方法见 [OpenAI 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

## 接着看一份源码

打开 [`src/server.ts`](src/server.ts)，按顺序找：

1. `inputSchema`：Codex 调用工具时需要传什么。
2. `save_checkpoint` 回调里的 `writeFile()` 和 `rename()`：记录实际怎样保存。
3. `resume` 回调里的 `readFile()`：下次怎样取回。
4. 文件末尾的 `serveStdio()`：让 Codex 通过标准输入、标准输出连接服务。

`typecheck` 检查类型，`build` 将这一份 TS 源码编译为 `dist/server.js`；`start` 是直接启动服务的备用命令。源码中没有模型调用，也没有自己构造 JSON-RPC 的代码，这些通信工作交给 SDK。

## 保存什么、保存在哪里

| 工具 | 输入 | 行为 |
| --- | --- | --- |
| `save_checkpoint` | 必填 `project`、`next`；可选 `context`、`stopWhen` | 保存或替换该项目的一份 Markdown |
| `resume` | `project` | 返回原文；不存在时返回 `found: false` |

默认目录是 `~/.yuuki/continue/`，沿用原示例的记录格式。同项目再次保存会替换整份旧记录；项目名只接受 1–64 个小写字母、数字或连字符，以字母或数字开头。多个会话同时保存时，以最后完成替换的记录为准。读取超过 16 KiB 的文件会报告错误。

需要独立目录时，在注册命令的 `--` 前加入 `--env YUUKI_CONTINUE_DIR=/你的绝对路径`。文件写入失败会作为工具错误返回，不会报告保存成功。

服务本身不联网；取回的记录会交给当前 Codex 会话，只保存你愿意放进该会话的内容。`resume` 只读取记录，是否继续执行由你和当前会话决定。

移除连接用 `codex mcp remove yuuki-continue`，已经保存的 Markdown 文件仍然保留。原来的 [`minimal-mcp`](../minimal-mcp/) 演示保持独立。
