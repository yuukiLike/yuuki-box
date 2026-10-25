# 开场 亲手实现一个极简 MCP

先做出一个能被客户端发现和调用的工具：输入人数、费用和预算，服务返回总额与余额。跑通以后，再沿着缩放定律、模型训练与 Harness 理解完整的 Agent。

这一章约 30 分钟，放在[四小时主线](README.md)之前。使用 JavaScript 和官方 MCP SDK v2，本地测试无需模型、API key 或 GPU。参考实现：[服务端](../../examples/minimal-mcp/server.mjs) · [客户端](../../examples/minimal-mcp/client.mjs)。

## 先分清服务端与客户端

服务端提供工具的名字、参数说明和实际函数。客户端发现工具、发送调用、接收结果。把模型接进来以后，由 Host 中的客户端代它调用服务。

```text
本地客户端 → tools/list → 发现 calculate_total
本地客户端 → tools/call → 服务端计算 → 返回结果
```

本章先用确定的参数调用工具，方便检查协议与计算。后面的 Harness 再负责把工具交给模型选择，并把结果送回模型上下文。

## 第一步 安装这个实验的依赖

在仓库根目录执行，使用 Node.js 22.22 或更高版本、pnpm 11.14：

```bash
pnpm --dir examples/minimal-mcp install --frozen-lockfile
```

这个实验单独固定了 `@modelcontextprotocol/server`、`@modelcontextprotocol/client` 的 `2.4.0` 和 `zod` 的 `4.6.7`，依赖只安装到示例项目。版本以同目录的 `package.json` 和锁文件为准。

如果从空目录跟写，可以在仓库外建立临时实验目录，再执行：

```bash
MCP_LAB_DIR=$(mktemp -d)
cd "$MCP_LAB_DIR"
pnpm init
pnpm add @modelcontextprotocol/server@2.4.0 @modelcontextprotocol/client@2.4.0 zod@4.6.7
```

接下来创建 `server.mjs` 和 `client.mjs`。使用 `.mjs`，可以直接运行 ES module，无需额外配置 TypeScript 编译。

## 第二步 写一个提供工具的服务

先写导入，再把工具注册进 `createServer()`。下面就是本课服务端的主体：

```js
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

function createServer() {
  const server = new McpServer({ name: 'yuuki-budget', version: '1.0.0' });
  server.registerTool('calculate_total', {
    description: '根据人数、每人费用、场地费和预算核算活动花费，金额单位为元。',
    inputSchema: z.object({
      people: z.number().int().min(1).max(1000),
      perPerson: z.number().min(0).max(1e6),
      venue: z.number().min(0).max(1e6),
      budget: z.number().min(0).max(1e6),
    }).strict(),
  }, async ({ people, perPerson, venue, budget }) => {
    const total = Math.round((people * perPerson + venue) * 100) / 100;
    const result = {
      total,
      remaining: Math.round((budget - total) * 100) / 100,
      withinBudget: total <= budget,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  });
  return server;
}

serveStdio(createServer, { onerror: (error) => console.error(error.message) });
console.error('Yuuki budget MCP 已启动，等待 stdio 请求。');
```

先认清三处：`inputSchema` 声明并校验输入；回调函数实际计算；`content` 与 `structuredContent` 分别提供文本内容和结构化结果。参考实现另外加了只读、幂等等工具提示，权限决定仍由使用工具的应用负责。

这里的 stdio 是客户端启动子进程后，通过标准输入与标准输出传递协议消息。服务端日志用 `console.error()` 写到 stderr，stdout 留给 MCP，避免普通日志混进协议消息。[MCP 官方服务端教程](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server#logging-in-mcp-servers)

`serveStdio(createServer, ...)` 负责协议版本协商，并按需要创建服务实例。它能处理新版本的请求，也支持仍使用 `initialize` 的旧客户端；不要把旧初始化流程当成所有版本都必须手写的步骤。[官方运行方式](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server)

## 第三步 写一个调用它的客户端

新建 `client.mjs`，先写下面这份正常调用。仓库里的参考实现额外提供了 `--invalid` 参数，用来测试错误输入。

```js
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const client = new Client(
  { name: 'yuuki-budget-client', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('./server.mjs', import.meta.url))],
});

try {
  await client.connect(transport);
  console.log('协议版本：', client.getNegotiatedProtocolVersion());
  const { tools } = await client.listTools();
  console.log('发现工具：', tools.map((tool) => tool.name).join(', '));
  const result = await client.callTool({
    name: 'calculate_total',
    arguments: { people: 20, perPerson: 35, venue: 80, budget: 800 },
  });
  if (result.isError) throw new Error(JSON.stringify(result.content));
  console.log('计算结果：', JSON.stringify(result.structuredContent));
} finally {
  await client.close();
}
```

客户端的 `connect()` 启动并连接服务进程，本例显式启用 `auto` 版本协商；`listTools()` 对应工具发现，`callTool()` 对应工具调用，最后关闭连接。客户端在自己的 stdout 打印结果没有问题；需要保持干净的是服务端的协议输出。

## 第四步 运行并故意给一次错误输入

使用仓库参考实现时，在仓库根目录执行：

```bash
node examples/minimal-mcp/client.mjs
```

预期结果：

```text
协议版本： 2026-07-28
发现工具： calculate_total
计算结果： {"total":780,"remaining":20,"withinBudget":true}
```

客户端会自动启动服务端，不需要另开终端。若单独运行 `server.mjs`，它会等待协议请求，不能把等待输入误认为程序卡死。

再执行：

```bash
node examples/minimal-mcp/client.mjs --invalid
```

这次把人数设为 `-1`。检查调用被拒绝、终端报告参数错误并以非零状态退出，而不是返回正常预算。自己跟写的版本，可以临时把调用参数中的 `people` 改为 `-1`，再恢复为 20。

此时你已经完成了一次真实 MCP 工具发现和跨进程调用。测试过程没有请求语言模型，计算由你的服务端代码完成。

## 第五步 按需接入 Claude Code

如果已安装 Claude Code，可以在仓库根目录执行下面的注册命令。它会把这个本地服务加入 Claude Code 的项目本地配置：

```bash
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/minimal-mcp/server.mjs"
claude mcp add --transport stdio yuuki-budget -- "$MCP_NODE" "$MCP_SERVER"
claude mcp get yuuki-budget
```

然后在 Claude Code 中检查 `/mcp`，提出任务：

```text
使用 yuuki-budget 的 calculate_total 工具，核算 20 人、
每人 35 元、场地费 80 元、预算 800 元的活动。
```

核对实际调用参数与返回值。需要移除时使用 `claude mcp remove yuuki-budget`。命令写法与配置范围来自 [Claude Code 官方 MCP 文档](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。

## 从 Cookie 接回身份与状态

这个工具是纯计算：每次输入包含核算所需的全部业务数据，服务无需记住上一次结果。stdio 的进程连接可以持续存在，但本例没有登录、远程 HTTP 授权或跨请求业务存储。

如果以后增加草稿工具，可以让创建操作返回 `draftId`，后续修改带上它；草稿内容由业务服务保存。谁能访问这份草稿，则由另外的授权凭据与权限检查决定。

| 要解决的问题 | 可以放在哪里 |
| --- | --- |
| 谁在调用、有什么权限 | 客户端管理授权凭据，服务端验证 |
| 操作哪份草稿 | 工具参数里的 `draftId`，以及业务服务的存储 |
| Agent 做到哪一步 | Host／Harness 的任务与执行记录 |

当前 `2026-07-28` 版 Streamable HTTP 已移除协议级会话；旧资料中的 `Mcp-Session-Id` 属于较早版本。协议级会话与业务存储需要分开理解。[MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)

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

## 做完以后检查三件事

1. 找出工具名、输入 schema、真正计算的函数、返回内容分别在哪里。
2. 解释 `listTools()` 与 `callTool()` 的区别，证明错误人数没有得到正常结果。
3. 指出当前例子里的客户端与服务端，以及接入模型后由哪个程序把结果放回上下文。

接下来回到[课程总览](README.md)，进入[第一小时 从缩放定律理解模型](01-understand-models.md)。
