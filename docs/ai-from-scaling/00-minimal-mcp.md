# 开场 看懂一次 MCP 工具调用

**这一课的目的：看懂客户端怎样发现工具、调用工具，再拿到执行结果。**

用“保存一段文字，再取回”做实验。服务端提供两个工具：`save_checkpoint` 把文字写进 Markdown 文件，`resume` 读出原文。客户端通过 MCP 调用它们。

**你要做的事：运行一次 → 找到调用与读写代码 → 改一句话再运行 → 试一次错误输入。** 完成后，你能指出文字经过了哪里，以及服务进程重启后为什么还能取回它。整段练习约 30 分钟，可以分步完成。

## 教学流程与你的操作

[![第一课流程：运行 demo 看结果，找到调用与读写代码，修改 next 后核对输出，运行 demo --invalid 观察拒绝](../../site/public/diagrams/ai-from-scaling/00-minimal-mcp-flow.svg)](../../site/public/diagrams/ai-from-scaling/00-minimal-mcp-flow.svg)

## 1. 运行：先看到完整结果

**你来做：** 使用 Node.js 22.22 或更高版本、pnpm 11.14，在仓库根目录执行：

```bash
pnpm --dir examples/minimal-mcp install --frozen-lockfile
pnpm --dir examples/minimal-mcp demo
```

**你要看到：** 输出中依次出现工具名、保存成功，以及重启后取回的文字：

```text
发现工具： save_checkpoint, resume
留下记录： true
关闭连接，再启动一个服务进程。
重启后取回：
# yuuki-box
……
## 下一步
打开 src/server.ts，找到 save_checkpoint 真正写入文件的位置。
```

启动新进程、保存、取回都由演示自动完成。安装依赖后，这次运行不联网，不需要模型或 API key。输出中的学习进度和“下一步”来自 `demo.ts` 预先填写的示例文字。

**这一步完成的标志：** 你看到了 `留下记录：true`，以及 `重启后取回：` 后面的原文。已经得到这份输出，就从第 2 步继续。

## 2. 定位：谁调用，谁真正读写文件

**你来做：** 按下面的顺序打开三个文件，各找一个位置。

1. [demo.ts](../../examples/minimal-mcp/src/demo.ts)：找到 `client.listTools()` 和 `callTool(client, 'save_checkpoint', checkpoint, ...)`。前者查询有哪些工具，后者把工具名和 `checkpoint` 参数交给客户端的调用函数。
2. [client.ts](../../examples/minimal-mcp/src/client.ts)：找到 `client.callTool({ name, arguments: args })`。这一行通过 MCP 连接发出请求，等待服务端返回结果。
3. [server.ts](../../examples/minimal-mcp/src/server.ts)：找到 `registerTool('save_checkpoint', ...)` 和 `registerTool('resume', ...)`。它们把工具名对应到执行函数；函数里的 `writeFile()` 和 `readFile()` 真正操作文件。

先看保存函数里的这两行：

```ts
await writeFile(temporaryPath, note, { flag: 'wx', mode: 0o600 });
await rename(temporaryPath, path);
```

输入先被整理成 Markdown 字符串 `note`，再写进临时文件，用 `rename()` 替换正式文件。这样读取方不会碰到只写了一半的记录。写完后，`toolResult({ saved: true, project, path })` 把成功结果交回客户端，所以终端会打印 `留下记录：true`。

再看取回函数中的这一行：

```ts
const note = await readFile(path, 'utf8');
```

两次服务进程使用同一个目录和项目名，所以能找到同一份文件。**进程退出会释放内存，已经写到磁盘上的文件仍然存在。** 新进程读取文件，再把原文返回给客户端。

演示在 `demo.ts` 中创建临时目录，两次 `withClient(directory, ...)` 共用它，整个演示结束后才清理。这里观察的是一次演示内跨服务进程的保存与取回。

**这一步完成的标志：** 你能在代码中指出“调用从哪里发出”和“文件在哪里读写”，并解释新进程为什么能读到旧记录。

## 3. 修改：让取回的内容变成你写的文字

**你来做：** 在 [demo.ts](../../examples/minimal-mcp/src/demo.ts) 的 `checkpoint` 对象里，只修改 `next` 的值，例如：

```ts
next: '我改了这句话，重启后还能读到。',
```

保存源码，再运行：

```bash
pnpm --dir examples/minimal-mcp demo
```

**你要看到：** `重启后取回：` 下的对应内容变成：

```text
## 下一步
我改了这句话，重启后还能读到。
```

`demo` 每次都会先编译源码。你修改的字符串作为参数传给 `save_checkpoint`，被写入文件，再由新进程中的 `resume` 读回。

**这一步完成的标志：** 你亲手改的文字出现在取回结果里，能顺着“输入 → 写入 → 读取 → 返回”找到它经过的代码。

## 4. 验证：给一次错误输入

**你来做：** 运行：

```bash
pnpm --dir examples/minimal-mcp demo --invalid
```

**你要看到：** 参数错误，命令以非零状态退出。这次演示会把项目名改成 `../outside`；保存请求被拒绝，不会打印 `留下记录：true`。

打开 [contracts.ts](../../examples/minimal-mcp/src/contracts.ts)，找到 `projectSchema` 的 `.regex(...)`。它限定了项目名的格式，`../outside` 不符合规则。再回到 `server.ts`，找到注册工具时传入的 `inputSchema: saveCheckpointInputSchema`：SDK 会按这份规则检查输入。

**这一步完成的标志：** 你看到了失败结果，也找到了拒绝这次输入的规则。

## 到这里完成

用自己的话说清下面三件事，就完成了这一课：

1. 客户端在哪里发现和调用工具，服务端在哪里执行文件读写。
2. 你修改的 `next` 怎样进入文件，又为什么能被新进程读回。
3. `../outside` 为什么被拒绝，输入规则定义在哪里。

下面是需要时再查的细节。想继续主线，可以回到[课程总览](README.md)，进入[第一小时 从缩放定律理解模型](01-understand-models.md)。

## 选读与参考

<details>
<summary>工具参数与文件保存规则</summary>

| 工具 | 参数 | 实际行为 |
| --- | --- | --- |
| `save_checkpoint` | `project`、`next`；可选 `context`、`stopWhen` | 创建或替换该项目的记录 |
| `resume` | `project` | 返回 Markdown 原文；不存在则返回 `found: false` |

项目名使用 1–64 个小写字母、数字或连字符，首字符为字母或数字，例如 `yuuki-box`。每个项目只保留最新一份；下次保存会替换整份旧记录，包括你手动补充的内容。多个会话同时保存时，以最后完成替换的那份为准。

日常使用时，默认文件路径是 `~/.yuuki/continue/<project>.md`；也可以设置环境变量 `YUUKI_CONTINUE_DIR` 为另一个绝对目录路径。演示专门传入临时目录，并在结束后清理。不同客户端使用同一目录和项目名，就能读到同一份记录。

`project` 用于选文件。这个本地服务使用当前系统用户的文件权限；将来变成多用户远程服务时，需要另做身份与访问检查。

工具保存你传入的文字，`resume` 只读回原文。接入模型后，客户端要把原文交回对话，模型才能据此回答；取回记录不会自动执行其中写的动作。

返回结果中，`content` 提供文本，`structuredContent` 提供结构化数据。`found: false` 表示没有记录，其他文件读取失败会报告错误。手动编辑后的文件超过 16 KiB 时，工具会提示先精简。

</details>

<details>
<summary>TypeScript、启动方式与自动检查</summary>

依赖使用官方 MCP SDK v2：`@modelcontextprotocol/server`、`@modelcontextprotocol/client` 均为 `2.4.0`，`zod` 为 `4.6.7`；具体版本见 [package.json](../../examples/minimal-mcp/package.json) 和锁文件。

[contracts.ts](../../examples/minimal-mcp/src/contracts.ts) 同时提供运行时规则与 TypeScript 类型：

```ts
export type CheckpointInput = z.infer<typeof saveCheckpointInputSchema>;
```

Zod schema 校验实际数据，`z.infer` 从同一份规则推导类型。客户端也会校验服务端返回的 `structuredContent`；`resume` 返回 `found: true` 时，才有 `path` 和 `note`。

[stdio.ts](../../examples/minimal-mcp/src/stdio.ts) 负责启动服务。`withClient()` 通过 `StdioClientTransport` 创建服务进程，双方通过 stdio 收发 MCP 消息；SDK 处理连接和版本协商。日志使用 `console.error()` 写 stderr，stdout 留给协议消息。[MCP 服务端教程](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server#logging-in-mcp-servers)

`package.json` 使用 `"type": "module"`，`tsconfig.json` 使用 `NodeNext`。源码中的本地导入写 `./server.js`：TS 检查时能找到对应的 `server.ts`，编译后 Node 读取真实的 `.js` 文件。

| 配置或约定 | 在这个例子里保护什么 |
| --- | --- |
| `strict` | 参数、返回值和错误处理要有明确类型 |
| `noUncheckedIndexedAccess` | 不能假设数组中的某个工具一定存在 |
| `exactOptionalPropertyTypes` | 区分没传可选字段与显式传 `undefined` |
| `noEmitOnError` | 有类型错误时不生成新产物 |
| `import type`、捕获错误后先缩小类型 | 区分类型与运行时代码，先检查 `unknown` 再使用 |
| `sourceMap` 与 Node 的 `--enable-source-maps` | 运行出错时尽量定位回 TS 源码 |

```bash
pnpm --dir examples/minimal-mcp typecheck
pnpm --dir examples/minimal-mcp build
pnpm --dir examples/minimal-mcp check
```

`typecheck` 只检查类型；`build` 编译到 `dist/`；`check` 依次运行类型检查、编译和测试。[测试](../../examples/minimal-mcp/tests/server.test.ts)覆盖重启后的取回、手改 Markdown、项目隔离、错误参数和文件读写失败。

`demo` 和 `test` 都会先构建；`start` 直接运行编译后的 stdio 入口，避免构建日志进入 MCP 协议输出。

相关说明：[TypeScript 的 Node 模块](https://www.typescriptlang.org/tsconfig/module.html)、[严格模式](https://www.typescriptlang.org/tsconfig/strict.html)、[MCP 官方 TS 工程示例](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/server-quickstart)。

</details>

<details>
<summary>以后日常使用：接入 Claude Code</summary>

如果已安装 Claude Code，可以在仓库根目录执行：

```bash
pnpm --dir examples/minimal-mcp build
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/minimal-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-continue -- "$MCP_NODE" "$MCP_SERVER"
claude mcp get yuuki-continue
```

这会注册项目本地配置；服务通过默认目录保存日常记录。随后在 Claude Code 的 `/mcp` 检查连接，试着说：

```text
用 yuuki-continue 给 algorithm-box 留个接续记录：
今天只检查了已有答案，下一步跑括号练习的测试，
能解释第一个失败输入就停。
```

换一个会话，再说：

```text
用 yuuki-continue 取回 algorithm-box 上次留下的记录，先展示原文。
```

需要移除连接时执行 `claude mcp remove yuuki-continue`；记录文件仍然保留。命令与配置范围见 [Claude Code 官方 MCP 文档](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。本章验证了参考客户端，尚未实际修改或验证你的 Claude Code 配置。

服务本身不联网。接到云端模型后，取回的文字会进入该模型的对话上下文；只留下你愿意交给当前客户端的内容。

</details>

<details>
<summary>继续对照：OpenAI 与 Claude 的官方案例</summary>

**OpenAI 的待办应用**

[OpenAI MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart) 用添加待办和完成待办串起 MCP 工具与可选的聊天内 UI。前端读到结构化工具结果后更新列表；服务端为每个待办保存 ID 和完成状态。

跟读时重点找三处：工具怎样声明输入，待办 ID 怎样传回下一次操作，工具结果怎样更新 UI。文档里的待办保存在进程内变量中，重启后的持久化需要另行实现。它很适合继续追问“协议无状态时，业务状态放在哪里”。

该案例使用 HTTP `/mcp` 与 MCP Apps。它的接入方式需要按官方教程搭建；本章的本地 stdio 启动命令不等同于一个远程服务地址。

该官方示例使用 `@modelcontextprotocol/sdk` v1 包，本章使用 v2 拆分包。跟写时保留各自的依赖与导入方式，再对照工具的业务逻辑。

**OpenAI 的公开文档查询**

[OpenAI Responses API 的 MCP 示例](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) 演示连接官方公开文档服务，让模型查询 Responses API 文档。跟读时看 `server_url` 指向谁，以及响应中的工具发现记录与 `mcp_call` 如何呈现调用和结果。

这个案例连接现有远程服务；本章让你运行并修改本地示例。两者可以对照理解客户端与服务端的职责。运行官方 API 示例需要自己的 OpenAI API 凭据，会产生模型用量。

**Claude Code 的 GitHub 审查案例**

[Claude Code 官方 GitHub 示例](https://code.claude.com/docs/en/mcp#example-connect-to-github-for-code-reviews) 演示配置 GitHub 远程 MCP 服务并通过授权访问仓库，用于代码审查等任务。

跟读时区分三件事：远程服务地址、授权凭据、模型真正发出的工具调用。与本章对照，本地服务通过 stdio 启动，远程服务通过网络连接；它们都需要把工具名称、输入与结果交给客户端处理。

如果想进一步比较由服务商托管 MCP 客户端的方式，可读 [Claude Messages API MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)。它连接远程 HTTP 服务，本章的本地 stdio 服务不能直接填进 `mcp_servers.url`。

</details>
