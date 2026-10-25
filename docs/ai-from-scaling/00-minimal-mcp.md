# 开场 换个会话，接着做

今天读到一半的 AI 教程，明天从哪里继续？算法练习暂时放下，回来时还记得卡在哪个输入吗？

做一个你能反复使用的小工具：**「接着做」MCP，给每个项目留下一份接续记录。** 关掉会话、重启工具进程，再回来取出原文。记录是普通 Markdown，你可以直接修改。

先用五分钟跑通下面的演示，能解释“为什么重启以后还在”就可以停。想亲手跟写，整段开场约 30 分钟。实现使用完整的 TypeScript 工程。参考实现：[工具服务](../../examples/minimal-mcp/src/server.ts) · [客户端](../../examples/minimal-mcp/src/client.ts) · [演示入口](../../examples/minimal-mcp/src/demo.ts)。

## 先跑一次，今天就到这里也可以

使用 Node.js 22.22 或更高版本、pnpm 11.14，在仓库根目录执行：

```bash
pnpm --dir examples/minimal-mcp install --frozen-lockfile
pnpm --dir examples/minimal-mcp demo
```

客户端会发现两个工具，保存一条记录，关闭连接，再启动新的服务进程取回它：

```text
发现工具： save_checkpoint, resume
留下记录： true
关闭连接，再启动一个服务进程。
重启后取回：
# yuuki-box
……
## 下一步
打开 src/server.ts，找到 save_checkpoint 真正写入文件的位置。

## 到这里就停
能解释记录为什么在服务进程重启后仍然存在。
```

演示只写临时目录，退出时清理；不会覆盖日常记录。安装依赖后，这次运行不联网，不需要模型、API key 或 GPU。

**第一处停点：** 找到 [src/server.ts](../../examples/minimal-mcp/src/server.ts) 里的 `writeFile()` 和 `readFile()`。记录留在文件里，新进程读的是同一份文件。

## 为什么选这个题目

结合你此前表达的学习和工作偏好，把第一版收在三个细节里：

| 你的工作方式 | 工具里的对应选择 |
| --- | --- |
| 在 AI 学习、算法练习和音乐项目间切换 | 按项目分别保存，下次取回对应记录 |
| 一次先做一小步，有清楚的停点 | 必填“下一步”，可选“到这里就停” |
| 喜欢小核心、透明数据流，也愿意自己改 Markdown | 两个工具、每项目一个文件，存取过程可以顺着代码读完 |

这是根据已有记录选出的使用场景，是否值得长期保留，要看你实际用过后的反馈。

例如，可以留下这些内容；它们只是示例，不代表这些项目当前的真实进度：

| 项目 | 下一步 | 到这里就停 |
| --- | --- | --- |
| `yuuki-box` | 跑一次缓存实验，对照有无缓存的输出 | 能解释结果为什么应当一致 |
| `algorithm-box` | 给自己的答案跑测试，找出第一个失败输入 | 能解释这个输入为什么失败 |
| `violin` | 慢练自己标出的两小节 | 完成这一小段就收琴 |

## 两个工具就够了

| 工具 | 参数 | 实际行为 |
| --- | --- | --- |
| `save_checkpoint` | `project`、`next`；可选 `context`、`stopWhen` | 创建或替换该项目的记录 |
| `resume` | `project` | 返回 Markdown 原文；不存在则返回 `found: false` |

项目名使用 1–64 个小写字母、数字或连字符，首字符为字母或数字，例如 `yuuki-box`。每个项目只保留最新一份；下次保存会替换整份旧记录，包括你手动补充的内容。多个会话同时保存时，以最后完成替换的那份为准。

日常记录默认放在 `~/.yuuki/continue/<project>.md`，也可以在服务启动环境里设置 `YUUKI_CONTINUE_DIR` 为另一个绝对路径。不同客户端使用同一目录，就能共享记录。

一条保存请求可以长这样：

```json
{
  "project": "algorithm-box",
  "context": "答案仍由我自己完成，今天先检查已有实现。",
  "next": "跑一次括号练习的测试，记录第一个失败输入。",
  "stopWhen": "能解释这个输入为什么失败。"
}
```

工具把你传入的内容保存下来；选择下一步、判断进度、决定是否开工，仍由你和当前会话完成。取回记录也不会自动执行里面的动作。

## 顺着代码亲手跟写

依赖使用官方 MCP SDK v2：`@modelcontextprotocol/server`、`@modelcontextprotocol/client` 均为 `2.4.0`，`zod` 为 `4.6.7`；TypeScript 与 Node 类型也锁定在 `package.json` 和锁文件里。

先看文件分别负责什么：

| 文件 | 负责 |
| --- | --- |
| [src/contracts.ts](../../examples/minimal-mcp/src/contracts.ts) | 输入、输出的 Zod 契约，以及由它们推导的 TS 类型 |
| [src/server.ts](../../examples/minimal-mcp/src/server.ts) | 注册两个工具，读写记录 |
| [src/stdio.ts](../../examples/minimal-mcp/src/stdio.ts) | 启动服务；日志写 stderr |
| [src/client.ts](../../examples/minimal-mcp/src/client.ts) | 连接服务、发出调用、校验返回值、关闭连接 |
| [src/demo.ts](../../examples/minimal-mcp/src/demo.ts) | 用两次连接演示保存与取回 |
| [tests/server.test.ts](../../examples/minimal-mcp/tests/server.test.ts) | 用真实服务进程检查行为 |

先打开 `contracts.ts`，找到这一行：

```ts
export type CheckpointInput = z.infer<typeof saveCheckpointInputSchema>;
```

Zod schema 校验运行时的数据，`z.infer` 从同一份规则推导 TypeScript 类型。工具回调的参数由 SDK 从 schema 推导；演示里的 `CheckpointInput` 也来自这份契约。只改一份规则，编辑器和实际调用都跟着检查。

客户端先验证真实的 `structuredContent`，再把结果交给调用方。`resume` 的输出按 `found` 分成两种情况：没有记录时只有项目名；找到记录时才有路径和原文。

```ts
const result = await callTool(client, 'resume', { project: 'yuuki-box' }, resumeOutputSchema);
if (result.found) {
  console.log(result.note); // 此处 TS 已经知道 note 存在。
}
```

先看服务端的 `createServer()`。两次 `registerTool()` 都包含工具名、`inputSchema` 和执行回调。以只读的工具为起点：

```ts
server.registerTool('resume', {
  description: '取回一个项目上次留下的 Markdown 原文。',
  inputSchema: resumeInputSchema,
  outputSchema: resumeOutputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async ({ project }) => {
  // 在参考实现中继续找到：路径 → readFile → 返回结果。
});
```

然后看 `save_checkpoint`：把输入排成 Markdown，写入同目录的临时文件，再用 `rename()` 替换正式文件，避免读取方撞上写到一半的记录。保存失败会返回工具错误，不能把它当成保存成功。

返回结果里，`content` 提供文本，`structuredContent` 提供结构化数据；`found: false` 表示确实没有记录，其他文件读取失败则报告错误。手动编辑后的文件超过 16 KiB 时，工具也会拒绝整份返回，提示你先精简。

`src/stdio.ts` 负责启动，导入 `server.ts` 只会取得工厂函数，不会启动服务。服务端通过 stdio 收发协议消息。日志使用 `console.error()` 写 stderr，stdout 留给 MCP；`serveStdio(createServer, ...)` 处理消息与版本协商。[MCP 服务端教程](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server#logging-in-mcp-servers)

再看客户端的 `withClient()`，沿下面这条路找对应代码：

```text
connect → listTools → callTool(save_checkpoint) → close
connect → callTool(resume) → close
```

两次 `withClient()` 分别创建连接和服务进程，使用同一个演示目录。模型暂时没有参与，参数由客户端写好；MCP 已经完成真实的工具发现与跨进程调用。

### 看懂 TypeScript 怎样变成可运行的程序

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
```

前者只检查，后者编译到 `dist/`。`demo` 和 `test` 都会先构建，确保执行的是这次的源码；`start` 直接运行编译后的 stdio 入口，避免构建日志进入 MCP 协议输出。

这些选择遵循 [TypeScript 的 Node 模块说明](https://www.typescriptlang.org/tsconfig/module.html)与[严格模式说明](https://www.typescriptlang.org/tsconfig/strict.html)。可以对照 [MCP 官方 TS 工程示例](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/server-quickstart)看源码、配置与运行入口。

最后故意给一次错误输入：

```bash
pnpm --dir examples/minimal-mcp demo --invalid
```

这次项目名为 `../outside`，应报告参数错误并以非零状态退出。找到拒绝它的 schema，再看正常项目名怎样变成文件名。

自动检查也可以单独运行：

```bash
pnpm --dir examples/minimal-mcp check
```

`check` 依次运行类型检查、编译和测试。测试覆盖重启后的取回、手改 Markdown、项目隔离、错误参数和文件读写失败。

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

## 从 Cookie 接回身份与状态

这个例子里，`project` 标识“要读哪份记录”，Markdown 文件保存业务状态。MCP 服务进程重启后，文件仍然存在；客户端重新连接，就能再读。

`project` 不是授权凭据，工具提示也不是权限控制。这个本地示例由启动它的客户端使用当前系统用户的文件权限；将来变成多用户远程服务时，需要另做身份与访问检查。

记录只有被 `resume` 读取并交回会话后，才会影响模型的回答。这份文件保存的是接续信息；KV cache 复用的是推理中的注意力中间结果，可以继续沿[缓存专题](../kv-cache/README.md)分别学习。

<details>
<summary>继续对照：OpenAI 与 Claude 的官方案例</summary>

## 对照 OpenAI 与 Claude 的官方案例

### OpenAI 的待办应用

[OpenAI MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart) 用添加待办和完成待办串起 MCP 工具与可选的聊天内 UI。前端读到结构化工具结果后更新列表；服务端为每个待办保存 ID 和完成状态。

跟读时重点找三处：工具怎样声明输入，待办 ID 怎样传回下一次操作，工具结果怎样更新 UI。文档里的待办保存在进程内变量中，重启后的持久化需要另行实现。它很适合继续追问“协议无状态时，业务状态放在哪里”。

该案例使用 HTTP `/mcp` 与 MCP Apps。它的接入方式需要按官方教程搭建；本章的本地 stdio 启动命令不等同于一个远程服务地址。

该官方示例使用 `@modelcontextprotocol/sdk` v1 包，本章使用 v2 拆分包。跟写时保留各自的依赖与导入方式，再对照工具的业务逻辑。

### OpenAI 的公开文档查询

[OpenAI Responses API 的 MCP 示例](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) 演示连接官方公开文档服务，让模型查询 Responses API 文档。跟读时看 `server_url` 指向谁，以及响应中的工具发现记录与 `mcp_call` 如何呈现调用和结果。

这个案例连接现有远程服务；本章让你亲手实现服务端。两者可以对照理解客户端与服务端的职责。运行官方 API 示例需要自己的 OpenAI API 凭据，会产生模型用量。

### Claude Code 的 GitHub 审查案例

[Claude Code 官方 GitHub 示例](https://code.claude.com/docs/en/mcp#example-connect-to-github-for-code-reviews) 演示配置 GitHub 远程 MCP 服务并通过授权访问仓库，用于代码审查等任务。

跟读时区分三件事：远程服务地址、授权凭据、模型真正发出的工具调用。与本章对照，本地服务通过 stdio 启动，远程服务通过网络连接；它们都需要把工具名称、输入与结果交给客户端处理。

如果想进一步比较由服务商托管 MCP 客户端的方式，可读 [Claude Messages API MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)。它连接远程 HTTP 服务，本章的本地 stdio 服务不能直接填进 `mcp_servers.url`。

</details>

## 做完以后检查三件事

1. 指出工具名、输入 schema、实际文件读写与返回内容分别在哪里。
2. 解释为什么新进程能取回旧记录，并确认错误项目名没有创建记录。
3. 分清服务端、客户端与模型：现在谁在填写参数，以后谁把取回的原文交给模型？

能解释就停。想继续时，回到[课程总览](README.md)，进入[第一小时 从缩放定律理解模型](01-understand-models.md)。
