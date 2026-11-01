# 四小时路线：模型基础与 Agent 入门

这是一条跨专题的阅读顺序：用前两课理解模型与训练，用后两课搭建 Harness、接入真实模型。可分四次完成；需要基础 JavaScript、终端与文件编辑，其他概念随用随讲。

目录中的 **MCP 入门、MCP 项目实战、模型基础、Agent 工程** 各有自己的学习目标。想先做工具，可以直接进入 [MCP 入门](00-codex-mcp.md)；想先写执行循环，可以直接进入 [Agent 入门](03-build-a-harness.md)。训练字符模型不作为这两条路线的前置。

## MCP 练习怎么选

开发 MCP 工具，推荐沿 **[Codex 接入](00-codex-mcp.md) → [MCP 项目实战](../mcp-projects/README.md)** 继续。通常由我们编写 Server，Host 与 Client 由现有应用提供。

| 路线 | 内容 | 第一份成果 |
| --- | --- | --- |
| 入门 | [只写服务端，在 Codex 里调用工具](00-codex-mcp.md) | 保存记录，并跨会话取回 |
| 实战 | [选一个想用的工具](../mcp-projects/README.md) | 天气查询、建模、修复验证或音乐可视化 |
| 选修 · 约 30 分钟 | [MCP 客户端与调用链实验](00-minimal-mcp.md) | 找到调用编排、协议通信、文件读写与校验的位置 |

选修实验用固定脚本代替 Host 编排，真实执行 MCP 通信与文件读写。需要自己写客户端或排查通信时再做；只开发 Server 可以跳过。

需要远程接入与用户授权，再看紧随实战的[远程 MCP 与授权](../ai-communication/weather-mcp/README.md)；想追踪消息，去[应用通信](../ai-communication/README.md)。

各演示统一在仓库根目录运行，例如 `pnpm demo:mini-mcp`、`pnpm demo:tiny-model`、`pnpm demo:harness`；运行 `pnpm run` 查看全部脚本。

想补齐 TS 工具工程基础，按需读选修实验里的 [TypeScript 技术栈与学习顺序](00-minimal-mcp.md#typescript-stack)：从现有代码认识 Node.js、Zod、异步执行、进程通信与自动测试。

## 四小时跨专题路线

下面的 240 分钟连接两个专题。只学习其中一个专题时，按对应两课进行；MCP 入门与实战的时间单独计算。

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

使用 Node.js 22.22 或更高版本，与现有文档站要求一致。MCP 示例需要用 pnpm 安装固定版本的官方 SDK；小模型与 Harness 两份实验无需安装 npm 包，所有本地实验均无需下载模型或使用 GPU。

参考实现：[Codex MCP](../../examples/codex-continue-mcp/src/server.ts)、[客户端实验（选修）](../../examples/minimal-mcp/src/demo.ts)、[小模型](labs/tiny-model.mjs)、[Harness](labs/harness.mjs)。先跑通，再跟改关键函数。

“接真实模型”需要自己的 DeepSeek API key 并产生用量。客户端实验、小模型和脚本 Harness 可离线运行；Codex 篇使用已有模型配置。

## 学完以后检查什么

- 能让 Codex 调用自己的 MCP Server，并解释工具结果来自哪里。
- 能指出预测概率、loss 和参数更新分别发生在哪一行，并解释验证集的用途。
- 能说明为什么“多训练一些”和“让模型多看一个字”改变的是不同因素。
- 能沿着 `assistant.tool_calls → 本地执行 → tool 结果 → 下一轮模型请求` 追踪一次任务。
- 能让保存请求被拒绝，也能在自己允许后创建文件，并核对文件内容。
- 能区分模型回答结束、工具执行成功，以及用户任务确实完成。

## 学完以后接到哪里

想继续实现 Transformer，可以先复习 [Attention 与 KV Cache](../kv-cache/02-attention-and-kv.md)，再参考 Karpathy 的 [makemore](https://github.com/karpathy/makemore) 从字符模型走到神经网络结构。

想把 Harness 接进 Yuuki，继续读[共享运行时](../../examples/shared/runtime/README.md)与[可取消和恢复的运行](../agent-engineering/05-harness-vertical-slice.md)。MCP 记录服务通过 Markdown 文件实现持久化：选修实验的 `demo` 会清理自己的临时记录，日常 Codex 接入则保留配置目录中的记录。本课程小型 Harness 的运行事件保存在内存并打印到终端。执行过程的持久化、崩溃恢复和多设备执行沿用后续工程专题展开。

## 番外：工具调用怎样长成 Agent

[工具调用简史](extra-tool-use-story.md)串起 ReAct、Plugins、Code Interpreter、function calling、MCP 与 Skills，区分 Skills 首次推出与开放标准发布的日期，无需跟做。

返回[文档目录](../../site/src/pages/index.astro)，或按兴趣选择一个 [MCP 实战项目](../mcp-projects/README.md)。
