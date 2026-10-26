# 开场 看懂一次 MCP 工具调用

如果你的目标是让 Codex 直接使用自己写的工具，先读[在 Codex 里用自己的 MCP](00-codex-mcp.md)。那一版只写服务端，由 Codex 提供客户端；本篇保留独立客户端和固定演示，便于观察协议调用。

**这一课的目的：看懂客户端怎样发现工具、调用工具，再拿到执行结果。**

用“保存一段文字，再取回”做实验。服务端提供两个工具：`save_checkpoint` 把文字写进 Markdown 文件，`resume` 读出原文。客户端通过 MCP 调用它们。

先分清这次实验里的两件事：

| 你看到的过程 | 它在说明什么 |
| --- | --- |
| `tools/list` 获取清单 → `tools/call` 调用工具 → 收到结果 | **MCP 的发现与调用。** 客户端按协议使用服务端的工具。 |
| 保存文件 → 重启服务进程 → 读取同一文件 | **工具实现的持久化。** 记录来自磁盘上的 Markdown；MCP 不会自动替工具保存业务数据。 |

**工具发现看 `tools/list`；“重启后取回”用来验证文件持久化。** 重启不是发现工具的必要步骤，只是为了让你看清服务进程的内存和磁盘文件的区别。

**你要做的事：运行一次 → 找到调用与读写代码 → 改一句话再运行 → 试一次错误输入。** 完成后，你能指出 MCP 负责哪一段，文件读写由谁实现。整段练习约 30 分钟，可以分步完成。

## 教学流程与你的操作

[![第一课流程：运行 demo，区分 MCP 发现与调用和文件持久化；定位代码，修改 next，再验证错误输入](../../site/public/diagrams/ai-from-scaling/00-minimal-mcp-flow.svg)](../../site/public/diagrams/ai-from-scaling/00-minimal-mcp-flow.svg)

## 1. 运行：先看到完整结果

**你来做：** 使用 Node.js 22.22 或更高版本、pnpm 11.14，在仓库根目录执行：

```bash
pnpm --dir examples/minimal-mcp install --frozen-lockfile
pnpm --dir examples/minimal-mcp demo
```

**你要看到：** 输出标明了 MCP 方法、工具名、执行状态和实际文件路径。下面省略启动日志与部分记录，`<临时目录>` 在实际运行时会显示为本机路径：

```text
[MCP] tools/list → save_checkpoint, resume
[MCP] tools/call → save_checkpoint | project=yuuki-box
[结果] 保存成功 | saved=true
[文件] <临时目录>/yuuki-box.md
[演示] 原服务进程已关闭；使用同一存储目录启动新进程。
[MCP] tools/call → resume | project=yuuki-box
[结果] 读取成功 | found=true
[文件] <临时目录>/yuuki-box.md

--- resume 返回的 Markdown ---
# yuuki-box
……
## 下一步
打开 examples/minimal-mcp/src/server.ts，对照 writeFile() 与 readFile()。
……
--- Markdown 结束 ---
[验证] 新进程已从同一文件读回记录。
[清理] 演示临时目录已删除。
```

按三个观察点读这段输出：

1. **发现：** `tools/list` 返回两个工具名，说明客户端拿到了工具清单。到这里，工具发现已经完成。
2. **调用：** `tools/call → save_checkpoint` 后出现 `saved=true`，说明客户端调用了具体工具并收到了成功结果。这里已经走完一次 MCP 工具调用。
3. **持久化：** 重启后，`tools/call → resume` 返回 `found=true` 和原文。前后两行 `[文件]` 指向同一路径，说明新进程读取了先前保存的文件。

这些带方括号的行是演示客户端的日志；MCP 请求和响应由 SDK 收发。`saved`、`found` 和 `path` 是本例工具定义的结果字段，MCP 不规定每个工具都返回这些字段。

启动新进程、保存、取回都由演示自动完成。安装依赖后，这次运行不联网，不需要模型或 API key。记录中的实验说明和“下一步”来自 `demo.ts` 预先填写的示例文字，不是模型对你的学习进度作出的判断。

**这一步完成的标志：** 你能把输出里的“发现工具”“调用工具”和“文件持久化”分别指出来。看到两个成功结果后，从第 2 步继续。

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

输入先被整理成 Markdown 字符串 `note`，再写进临时文件，用 `rename()` 替换正式文件。这样读取方不会碰到只写了一半的记录。写完后，`toolResult({ saved: true, project, path })` 把成功结果交回客户端，所以终端会打印 `[结果] 保存成功 | saved=true` 和文件路径。

再看取回函数中的这一行：

```ts
const note = await readFile(path, 'utf8');
```

两次服务进程使用同一个目录和项目名，所以能找到同一份文件。**进程退出会释放内存，已经写到磁盘上的文件仍然存在。** 新进程读取文件，再把原文返回给客户端。

具体看目录怎样传递：`demo.ts` 用 `mkdtemp()` 创建临时目录，两次 `withClient(directory, ...)` 共用它；`client.ts` 通过 `YUUKI_CONTINUE_DIR` 把目录传给新服务进程；`server.ts` 用目录加上 `${project}.md` 定位文件。整个演示结束后才删除该目录。

**这里没有把记录存入 `sessions`，也没有恢复原来的 MCP 连接。** 每次 `withClient()` 都新建客户端连接和服务进程。这个示例独立使用 Markdown 文件，不依赖其他章节 Harness 的 `sessions.json`。演示中的 `resume` 只是我们给“读取项目记录”这个工具起的名字，不是 MCP 内置的会话恢复方法。

**MCP 在这里的价值，是让客户端按统一协议发现和调用这两个读写工具。** 文件持久化由 `server.ts` 自己实现：即使不用 MCP，普通程序也能写入并读回文件；而只有 MCP 连接、没有存储实现，也不会自动留下这份记录。

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

**你要看到：** `resume 返回的 Markdown` 中的对应内容变成：

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

**你要看到：** `[失败]` 日志中的参数错误，命令以非零状态退出。这次演示会把项目名改成 `../outside`；保存请求被拒绝，不会打印 `[结果] 保存成功`。

打开 [contracts.ts](../../examples/minimal-mcp/src/contracts.ts)，找到 `projectSchema` 的 `.regex(...)`。它限定了项目名的格式，`../outside` 不符合规则。再回到 `server.ts`，找到注册工具时传入的 `inputSchema: saveCheckpointInputSchema`：SDK 会按这份规则检查输入。

**这一步完成的标志：** 你看到了失败结果，也找到了拒绝这次输入的规则。

## 到这里完成

用自己的话说清下面三件事，就完成了这一课：

1. `tools/list` 怎样发现工具，`tools/call` 怎样发起调用；服务端在哪里执行文件读写。
2. 你修改的 `next` 怎样进入 Markdown 文件；新进程能读回它，为什么是存储实现的效果。
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

## 延伸：调试、状态、协议与发布

看懂 `demo.ts`、`client.ts`、`server.ts` 和 `stdio.ts` 后，可以用下面四个问题，把“能跑通示例”推进到“能开发和交付一个 MCP 服务”。协议说明以本例使用的 **2026-07-28** 为准，同时对照旧版 **2025-11-25**；查教程时要先确认版本。

### 1. 编写 MCP 时，应该怎样调试？

**先用确定的参数直接调用服务，再接上模型观察它会怎样选择工具。** 本章的 `demo.ts` 就是一个可以调试的客户端：它发出的是真实 MCP 请求，调用顺序和输入由脚本预先写好。

在仓库根目录，先检查现有代码：

```bash
pnpm --dir examples/minimal-mcp check
pnpm --dir examples/minimal-mcp demo
pnpm --dir examples/minimal-mcp demo --invalid
```

前两条应通过；最后一条预期失败，以非零状态退出，用来确认 `../outside` 被拒绝。自动测试适合反复检查输入、输出和文件行为；`demo` 适合观察一次完整调用。这里没有接模型，因此服务问题不会与模型是否选对工具混在一起。

想自己选工具、填写参数，可以使用官方 **MCP Inspector**。它相当于一个专门理解 MCP 的接口调试客户端，支持查询工具清单、发送调用和检查结果。下面使用命令行模式，在仓库根目录执行：

```bash
pnpm --dir examples/minimal-mcp build

# 查询工具清单。
pnpm dlx @modelcontextprotocol/inspector --cli \
  node examples/minimal-mcp/dist/src/stdio.js \
  --method tools/list

# 读取一个项目；没有对应记录时应返回 found: false。
pnpm dlx @modelcontextprotocol/inspector --cli \
  node examples/minimal-mcp/dist/src/stdio.js \
  --method tools/call --tool-name resume \
  --tool-arg project=inspector-demo
```

`pnpm dlx` 首次运行会下载 Inspector。想在终端交互操作，可以运行 `pnpm dlx @modelcontextprotocol/inspector --tui node examples/minimal-mcp/dist/src/stdio.js`；默认模式则提供浏览器界面。以上入口由 Inspector 启动服务端子进程，服务仍使用默认存储目录，或你显式设置的 `YUUKI_CONTINUE_DIR`。[Inspector 官方文档](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector)

定位问题时，沿这条顺序检查：

| 现象 | 先看哪里 |
| --- | --- |
| 连不上服务，工具清单拿不到 | 启动命令、Node 版本、编译产物、环境变量和服务端 stderr |
| 清单有工具，但参数被拒绝 | `inputSchema` 与实际发出的 `arguments` |
| 参数通过，执行或结果不对 | `registerTool()` 的回调、文件或外部 API，以及输出 schema |
| 手动调用正常，模型却不调用或填错参数 | 宿主是否加载了服务、工具描述是否清楚、模型实际生成的调用 |

要看变量和逐行执行，就把 Node 调试器附加到运行 `stdio.js` 的**服务端子进程**，在 `registerTool()` 的回调、`writeFile()` 或 `readFile()` 附近打断点，再从客户端发起调用。只调试 `demo.ts` 所在的父进程，不能自动看见子进程内部的变量；编辑器需要启用子进程调试或单独附加。

临时日志使用 `console.error()`：服务端 stdout 被 stdio 协议占用，夹入 `console.log()` 的普通文字会破坏消息解析。`demo.ts` 的 stdout 用于给人看日志；`stdio.ts` 所在服务进程的 stdout 用于给客户端传协议消息，两者职责不同。[stdio 规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)

读结果时再分清三种情况：JSON-RPC `error` 是协议层的错误响应；工具结果中的 `isError: true` 表示工具调用失败，可能发生在参数校验或工具执行阶段；`found: false` 则是本例“没有这份记录”的正常业务结果。[工具错误约定](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling)

**你可以做的练习：** 在 Inspector 中先调用 `resume`，再把 `project` 改成 `../outside`，比较“找不到记录”和“输入不合法”两种返回。本例后者实际返回 `isError: true` 和项目名校验错误；SDK 在进入文件读取逻辑前就拒绝了输入。

### 2. MCP 的无状态体现在哪里？早期的有状态又体现在哪里？

**这里的“无状态”，主要指处理一次协议请求时，不依赖前面某次握手留在服务端的会话上下文。** 工具可以照常保存业务数据，客户端也可以保留聊天记录。

先对照两个版本：

| 观察点 | 旧版：2025-11-25 | 本例：2026-07-28 |
| --- | --- | --- |
| 开始使用 | `initialize` 请求与响应，随后 `notifications/initialized` | 没有这套初始化握手；客户端可先调用 `server/discover` |
| 协议版本与客户端能力 | 在初始化阶段交换，后续交互遵守已建立的上下文 | 每次请求在 `_meta` 中携带版本与客户端能力 |
| HTTP 会话标识 | 服务端可以分配 `Mcp-Session-Id`，客户端随后带回 | 移除了协议层会话与 `Mcp-Session-Id` |
| 服务端需要记住什么 | 采用会话的实现需要关联初始化信息、订阅等会话数据 | 处理当前请求所需的协议信息随请求而来 |

旧版过程见[初始化生命周期](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)与[HTTP 会话管理](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management)；新版过程见[版本与兼容规则](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)与[无状态架构说明](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture#statelessness-and-discovery)。新版 `server/discover` 用来查询服务信息，客户端可以调用它，但它不是必须先完成的初始化握手。

旧版的“有状态”可以这样理解：客户端先介绍自己支持哪些能力，服务端在后续交互中沿用这些信息。HTTP 服务如果把会话存在进程 A 的内存里，下一次请求被分配到进程 B，B 就可能找不到对应会话；部署时需要让请求回到 A，或专门处理会话共享。

不过，旧版规范中的 HTTP Session ID 从来就不是服务端必选项，一些旧版 SDK 也提供无状态 HTTP 模式。**“旧版有初始化握手”“某个 HTTP 实现保存会话”“工具保存业务数据”是三个不同判断。** 不能看到使用 HTTP 就推断无状态，也不能看到旧版就推断每个实现都必须生成 Session ID。[旧版会话规则](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management)、[SDK 对两类模式的说明](https://csharp.sdk.modelcontextprotocol.io/v2/concepts/stateless/stateless.html)

回到本章，下面这些“状态”分别归谁管理：

| 状态 | 本例如何处理 |
| --- | --- |
| 协议版本、客户端能力 | SDK 随新版请求携带，不依赖旧的初始化会话 |
| 保存的项目记录 | `save_checkpoint` 写入磁盘，`resume` 按 `project` 读取 |
| 一次尚未完成的调用 | SDK 仍要用请求 `id` 对应响应，处理超时与取消 |
| 模型的聊天历史 | 由宿主应用管理；本章脚本没有模型聊天历史 |

所以，`resume({ project: "yuuki-box" })` 会成功，是因为服务能按明确的 `project` 找到文件；它不需要记住“上一次这个客户端选择的是哪个项目”。前一次保存产生的**业务数据**仍然存在，前一个进程的**协议会话**不需要恢复。

这也说明：stdio 保持进程和管道打开、某次请求通过 SSE 持续返回进度，都不等于必须保存跨请求的协议会话。无状态允许处理单次请求期间保留临时数据。[传输与请求元数据](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

部署多个新版服务实例时，协议不再要求“必须回到记得我握手信息的那台机器”；但本例若仍把记录写在各机器自己的磁盘上，另一台机器还是读不到。要共享记录，仍需共享文件存储或数据库。天气缓存、订单、文档也一样：**协议无状态不会自动解决业务数据的存储与一致性。**

### 3. MCP 可以理解为 HTTP + client + RPC 吗？

可以把其中的 RPC 和客户端方向保留下来，再把层次分清：**MCP 采用客户端与服务端的架构，用 JSON-RPC 2.0 表达消息，并规定工具、资源、提示模板等能力的发现与使用规则；HTTP 是可选的传输方式。**[MCP 架构](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)

| 层次 | 回答的问题 | 本章对应 |
| --- | --- | --- |
| 宿主 Host | 谁组织整个应用与工具使用？ | 演示脚本；接模型后是聊天或编程应用 |
| Client / Server | 谁发起协议调用，谁提供能力？ | `client.ts` 与 `server.ts` |
| MCP 语义 | 有哪些方法？参数和结果怎样描述？ | `tools/list`、`tools/call`、工具 schema |
| JSON-RPC 2.0 | 请求、响应、通知长什么样？ | `jsonrpc`、`id`、`method`、`params`、`result` / `error` |
| Transport | 消息怎样从一个程序送到另一个程序？ | 本地 stdio；远程可用 Streamable HTTP |
| 业务实现 | 工具最终做什么？ | 读写 Markdown，或请求 WeatherKit |

比如本章一次调用可以这样拆开，下面只展示核心字段，实际新版请求还由 SDK 补上 `_meta`：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "resume",
    "arguments": { "project": "yuuki-box" }
  }
}
```

JSON-RPC 规定 `method`、`params`、`id` 这类消息结构；MCP 规定 `tools/call` 和工具调用参数的含义；我们的程序定义 `resume`、`project`，并执行 `readFile()`。RPC 的“远程”也不要求另一台电脑，本章跨的是同一台电脑上的两个进程。

使用 stdio 时，这段消息通过输入输出管道传递；使用 Streamable HTTP 时，消息通过 HTTP POST 送到 MCP 端点，响应可以是 JSON 或本次请求的 SSE 流。SSE 是流式传输机制，JSON-RPC 是消息格式，MCP 则规定这些消息代表哪些操作。[传输规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)

因此，只写一个 `POST /weather` 的 HTTP 接口，或者用 JSON-RPC 自定义一个 `weather.query` 方法，还不等于实现了 MCP。要让通用 MCP 客户端发现并调用它，需要遵守 MCP 的版本、能力、工具定义与调用约定；SDK 帮你完成了其中大量协议工作。

### 4. 如何发布一个 MCP？

**先确定别人通过什么方式使用它。** `new McpServer(...)` 设置的是运行时服务身份，`registerTool(...)` 把工具加入这个服务实例；这两个调用都不会把程序上传到互联网或登记到公共目录。

| 交付方式 | 你交付什么 | 别人怎样使用 |
| --- | --- | --- |
| 本地 stdio 服务 | 源码、可执行程序，或 npm / PyPI 等软件包 | 在自己的客户端配置启动命令，由客户端启动本地进程 |
| 远程 HTTP 服务 | 已部署的 MCP 地址，例如 `https://mcp.example.com/mcp` | 客户端连接该地址，按服务要求完成认证 |
| MCP Registry 登记 | 描述包、地址、版本和配置需求的元数据 | 从目录发现服务，再按包或地址连接 |

Registry 是发现目录，实际程序仍由软件包仓库分发，或由你部署的服务器运行。已有启动命令或服务地址时，客户端可以直接连接。[Registry 发布说明](https://modelcontextprotocol.io/registry/quickstart)

**方式 A：交付本地 stdio 程序**

本章已经能通过源码交付：别人克隆仓库，安装依赖、构建，再按上面的 Claude Code 配置接入 `dist/src/stdio.js`。这时程序运行在对方电脑上，记录也保存在对方的本地目录。

如果希望别人用一条 `npx` 命令启动，可以进一步发布 npm 包。当前示例的 `package.json` 有 `"private": true`，也没有 `bin`，还没有配置成可发布的命令行包。准备发布时，需要：

1. 选择自己拥有的包名和版本，移除 `private: true`，保留运行时依赖，补齐 README、许可证等发布资料。
2. 把 `bin` 指向 `dist/src/stdio.js`，并在 `src/stdio.ts` 第一行添加 `#!/usr/bin/env node`，让编译后的入口可以作为命令执行。
3. 用 `files` 指定要发布的文件，例如本例的 `dist/src`；检查包内有运行所需代码，没有 `.env`、私钥或个人记录。
4. 若还计划登记到 Registry，在发布 npm 包前就加入后面介绍的 `mcpName`。

需要合并进原 `package.json` 的字段示意如下，**这不是完整的替换文件**。`@your-scope` 是占位命名空间：

```json
{
  "name": "@your-scope/yuuki-continue-mcp",
  "version": "1.0.0",
  "bin": { "yuuki-continue-mcp": "dist/src/stdio.js" },
  "files": ["dist/src"]
}
```

完成 npm 登录及账号要求的验证后，在准备发布的包目录执行：

```bash
pnpm check
pnpm build
npm pack --dry-run
# 检查上一步列出的包内容，再发布。
npm publish --access public
```

发布成功后，用户的客户端才可以配置 `command: "npx"` 和 `args: ["-y", "@your-scope/yuuki-continue-mcp@1.0.0"]`。发布后的验收也应通过这个包启动服务，再检查 `tools/list` 和一次实际调用，才能发现漏打包等问题。[npm 的 bin / files 规则](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)、[发布公开作用域包](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

**方式 B：部署远程 Streamable HTTP 服务**

这时保留工具注册与业务实现，增加 HTTP 启动入口，把 MCP transport 接到服务地址，再部署到能运行该程序的平台。当前示例只有 stdio 入口，尚没有可直接填写的远程 URL。

部署时要明确三件事：客户端支持哪些协议版本；谁可以调用及访问哪些业务数据；进程重启或扩容后数据放在哪里。对外地址使用 HTTPS，认证方式与目标客户端相匹配。以上面的记录工具为例，远程多用户版本还需要按已认证用户隔离记录，不能只凭一个 `project` 字符串读取所有人的文件。

部署后，用 Inspector 连接真实 URL，验证工具发现、调用和认证失败的情况，再交付 URL 与配置说明。远程 MCP 的标准接入方式是 Streamable HTTP；早期独立 HTTP+SSE 传输主要用于兼容旧客户端。[当前传输规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)、[远程服务发布说明](https://modelcontextprotocol.io/registry/remote-servers)

**方式 C：登记到官方 MCP Registry**

在已经准备好软件包或远程地址后，可以使用官方 `mcp-publisher`：

```bash
brew install mcp-publisher
mcp-publisher init
```

先编辑生成的 `server.json`，填好服务名、版本和分发方式：npm 包写在 `packages`，远程地址写在 `remotes`，后者的传输类型为 `streamable-http`。配置项只声明名称与用途，实际私钥由使用者或部署环境提供。[远程服务元数据](https://modelcontextprotocol.io/registry/remote-servers)

使用 GitHub 身份认证时，服务名使用 `io.github.<GitHub 用户名>/<服务名>`。npm 包中的 `mcpName` 要与这个名字一致，因此应在发布 npm 包前加入它。确认文件内容后执行：

```bash
mcp-publisher login github
mcp-publisher publish
```

按登录提示完成授权，发布后通过 Registry 查询对应名称和版本，确认元数据可见。它不会替你启动 HTTP 服务，也不会让所有客户端自动连接你的工具。[官方发布教程](https://modelcontextprotocol.io/registry/quickstart)

对于这个仓库，当前可交付的是源码和本地 stdio 启动方式；npm 包发布、HTTP 部署和 Registry 登记是后续交付选项。`git push` 只是把课程和代码推送到 Git 远端，不会自动完成这三种发布。

继续做实用工具，可以进入 [WeatherKit 天气 MCP 课程](07-weatherkit-mcp.md)，对照“本地配置 Apple 凭据 → MCP 调用天气接口 → 返回天气与户外时间窗口”的完整实现。
