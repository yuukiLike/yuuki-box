# 四小时路线：模型基础与 Agent 入门

前两课学模型与训练，后两课搭 Harness、接真实模型。可分四次完成，需要基础 JavaScript、终端和文件编辑。

先做工具选 [MCP 入门](00-codex-mcp.md)，先写执行循环选 [Agent 入门](03-build-a-harness.md)；<mark class="key">都不必先训练模型</mark>。

## MCP 练习怎么选

开发工具按 **[Codex 接入](00-codex-mcp.md) → [MCP 项目实战](../mcp-projects/README.md)** 继续：自己写 Server，应用提供 Host 与 Client。

| 路线 | 内容 | 第一份成果 |
| --- | --- | --- |
| 入门 | [只写服务端，在 Codex 里调用工具](00-codex-mcp.md) | 保存记录，并跨会话取回 |
| 实战 | [选一个想用的工具](../mcp-projects/README.md) | 天气查询、建模、修复验证或音乐可视化 |
| 选修 · 约 30 分钟 | [MCP 客户端与调用链实验](00-minimal-mcp.md) | 找到调用编排、协议通信、文件读写与校验的位置 |

选修实验用脚本编排真实 MCP 调用与文件读写；只开发 Server 可跳过。

需要远程接入与用户授权，再看紧随实战的[远程 MCP 与授权](../ai-communication/weather-mcp/README.md)；想追踪消息，去[应用通信](../ai-communication/README.md)。

各演示统一在仓库根目录运行，例如 `pnpm demo:mini-mcp`、`pnpm demo:tiny-model`、`pnpm demo:harness`；运行 `pnpm run` 查看全部脚本。

TS 工程基础见 [TypeScript 技术栈与学习顺序](00-minimal-mcp.md#typescript-stack)：Node.js、Zod、异步、进程通信和测试。

## 四小时跨专题路线

240 分钟连接模型与 Agent 两个专题，也可只学其中两课；MCP 时间另计。

| 时间 | 内容 | 这一段要完成什么 |
| --- | --- | --- |
| 00—50 分钟 | [从缩放定律理解模型](01-understand-models.md) | 连起规模、预测、训练、Transformer、后训练与推理 |
| 50—60 分钟 | 休息与提问 | 用自己的话解释参数、上下文和工具分别是什么 |
| 60—110 分钟 | [训练一个小语言模型](02-train-a-model.md) | 亲手写出概率、loss 和参数更新，比较训练前后的输出 |
| 110—120 分钟 | 休息与整理 | 保存一份模型，记下一个它仍然会犯的错 |
| 120—170 分钟 | [搭建工具调用 Harness](03-build-a-harness.md) | 跑通工具循环，找到可加统计、策略和审计的三个入口 |
| 170—180 分钟 | 休息与提问 | 找出模型提出动作与程序执行动作的交界处 |
| 180—230 分钟 | [接真实模型并做对照实验](04-experiments.md) | 切换模型接口，制造错误、拒绝、循环和取消，检查真实结果 |
| 230—240 分钟 | 复述与验收 | 用两份产物解释学习、推理、行动和验证 |

共 240 分钟，含 30 分钟休息与提问；跟写速度可调整。

## 我们会做出什么

| 产物 | 观察什么 |
| --- | --- |
| MCP 记录服务 | 工具发现、调用与文件持久化 |
| 字符语言模型 | 用上下文分数表预测，按 loss 更新参数，再生成短句 |
| 工具调用 Harness | 读活动计划、算预算、审批保存，处理限额、取消与结果 |

Harness 先用脚本检查循环，再接 DeepSeek。字符小模型只练习续写；工具调用使用现成模型。

## 开始前准备

在仓库根目录执行：

```bash
node --version
```

使用 Node.js ≥22.22。MCP 需 pnpm 安装固定版本 SDK；小模型与 Harness 无需 npm 依赖，均无需下载模型或 GPU。

参考实现：[Codex MCP](../../examples/codex-continue-mcp/src/server.ts)、[客户端实验（选修）](../../examples/minimal-mcp/src/demo.ts)、[小模型](labs/tiny-model.mjs)、[Harness](labs/harness.mjs)。先跑通，再跟改关键函数。

<mark class="caution">真实模型调用会产生用量</mark>，需 DeepSeek API key；其余实验可离线，Codex 篇沿用已有模型配置。

## 学完以后检查什么

- 能让 Codex 调用自己的 MCP Server，并解释工具结果来自哪里。
- 能指出预测概率、loss 和参数更新分别发生在哪一行，并解释验证集的用途。
- 能说明为什么“多训练一些”和“让模型多看一个字”改变的是不同因素。
- 能沿着 `assistant.tool_calls → 本地执行 → tool 结果 → 下一轮模型请求` 追踪一次任务。
- 能让保存请求被拒绝，也能在自己允许后创建文件，并核对文件内容。
- 能区分模型回答结束、工具执行成功，以及用户任务确实完成。

## 学完以后接到哪里

想继续实现 Transformer，可以先复习 [Attention 与 KV Cache](../kv-cache/02-attention-and-kv.md)，再参考 Karpathy 的 [makemore](https://github.com/karpathy/makemore) 从字符模型走到神经网络结构。

接入 Yuuki 读[共享运行时](../../examples/shared/runtime/README.md)与[可取消和恢复的运行](../agent-engineering/05-harness-vertical-slice.md)。MCP 用 Markdown 持久化；选修 demo 清理临时记录，Codex 保留日常记录。小型 Harness 事件仅存在内存与终端，持久化和恢复留到工程专题。

## 番外：工具调用怎样长成 Agent

[工具调用简史](extra-tool-use-story.md)串起 ReAct、Plugins、Code Interpreter、function calling、MCP 与 Skills，区分 Skills 首次推出与开放标准发布的日期，无需跟做。

返回[文档目录](../../site/src/pages/index.astro)，或按兴趣选择一个 [MCP 实战项目](../mcp-projects/README.md)。
