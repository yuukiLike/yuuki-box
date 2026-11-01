---
next:
  link: /ai-communication/weather-mcp/
  label: 远程天气工程
---

# Codex MCP：服务接入与记录保存

用「接着做」MCP <mark class="key">保存记录，换会话取回</mark>。

按「接入 → 保存与取回 → 对照源码」完成，延伸资料在文末。

<div class="heading-alias" id="先看-mcp-全景" aria-hidden="true"></div>

## MCP 架构

MCP 定义外部能力的连接方式：Codex 内置 Client，连接「接着做」Server。

[![MCP 全景：Host 内置 Client，连接外部 Server；Codex、Zed、Warp、Raycast 均可接入 MCP](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)](../../site/public/diagrams/ai-communication/mcp-roles-platforms.svg)

点击图可放大；先对应三个角色：

| 图里的角色 | 本课具体是谁 | 负责什么 |
| --- | --- | --- |
| Host：宿主应用 | Codex | 管理对话、模型、权限与工具调用 |
| Client：连接组件 | Codex 内置的 MCP Client | 连接 Server、发现工具、发送调用并接收结果 |
| Server：能力提供程序 | 示例「接着做」 | 提供保存与取回工具，实际读写 Markdown 文件 |

模型提出调用，Codex 检查，Client 发送工具名和参数，Server 读写文件并返回结果。[MCP 官方架构说明](https://modelcontextprotocol.io/docs/learn/architecture)

**Codex 提供 Client，Server 实现工具并读写文件。** 其他 Host 的接入方式见[角色与平台说明](../ai-communication/04-mcp.md#先分清你hostclientserver)。

## 接入 Codex

准备 Node.js ≥22.22、pnpm 11.14 和可用的 Codex CLI。以下命令都在仓库根目录执行：

```bash
pnpm install:codex-continue-mcp
pnpm build:codex-continue-mcp
```

<details class="qa">
<summary>命令说明</summary>

| 命令 | 用途 |
| --- | --- |
| `pnpm install:codex-continue-mcp` | 安装依赖 |
| `pnpm build:codex-continue-mcp` | 编译服务 |

安装已启用 `--frozen-lockfile`：按锁文件安装；需更新时，报错停止。[官方说明](https://pnpm.io/cli/install#--frozen-lockfile)

</details>

接着注册服务：

```bash
codex mcp add yuuki-continue -- \
  "$(command -v node)" \
  "$PWD/examples/codex-continue-mcp/dist/server.js"

codex mcp get yuuki-continue
```

`$PWD` 表示当前目录。重开 Codex，在 `/mcp` 确认连接。

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

打开 `examples/codex-continue-mcp/src/server.ts`，对应四处代码：

| 代码 | 作用 |
| --- | --- |
| `registerTool()`、`inputSchema` | 声明工具和参数 |
| `writeFile()`、`rename()` | 写入 Markdown，替换项目记录 |
| `resume` 中的 `readFile()` | 读取原文 |
| `serveStdio()` | 通过标准输入、输出连接 Codex |

改源码后重新运行 `build` 并重开会话：Codex 启动的是 `dist/server.js`。

## 本课完成

能对应角色、跨会话保存取回，并找到工具声明与文件读写代码，就完成本课。

后文为选读资料。

后续案例见 [MCP 项目实战](../mcp-projects/README.md)。

<details>
<summary>选读：参考资料与延伸练习</summary>

**接入与示例参考**

- [Codex 官方接入文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)：需要核对客户端配置时查阅。
- [示例说明](../../examples/codex-continue-mcp/README.md)：工具参数、目录设置与调用统计。
- [服务端源码](../../examples/codex-continue-mcp/src/server.ts)：网页版代码入口。

**其他练习**

客户端实现与通信排查见[MCP 最简 demo 的选读部分](00-minimal-mcp.md)。[课程目录](README.md)保留其他学习入口。

</details>

<details>
<summary>选读：temperature 与 top_p 怎样影响输出</summary>

token 是一小段文字；模型给候选 token 分配概率，采样据此抽取下一个。图中用「猫、狗、鸟」代替真实词表。

[![同一段输入下，temperature 改变猫、狗、鸟的抽中概率；top_p 为 0.8 时保留累计概率达到 80% 的猫和狗，再按 62.5% 与 37.5% 抽取。](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)](../../site/public/diagrams/ai-from-scaling/sampling-memory-card.svg)

点击图可放大，观察同一组概率随温度变化。

**temperature 改变概率差距。** 温度 1 时，猫、狗、鸟占 50%、30%、20%；降到 0.2 后约为 92%、7%、1%，更偏向「猫」；升温则让其他候选更有机会。

**top_p 先筛候选再抽取。** 同一组概率下，`top_p = 0.8` 保留猫和狗，重新归一化为 62.5%、37.5%；`0.5` 只留猫，`1` 保留全部。

<mark class="caution">先确认模型支持参数</mark>，每次只改一个，对照同一任务。[OpenAI 参数说明](https://developers.openai.com/api/reference/python/resources/responses/methods/create)

</details>
