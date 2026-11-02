# 四小时路线：模型基础与 Agent 入门

模型路线先看预测，再看上下文与训练；Agent 路线先跑离线工具循环，再接真实模型。两条路线可独立学习，需要基础 JavaScript、终端和文件编辑。

工具开发从[最简 demo](00-minimal-mcp.md)开始；[Codex 接入](00-codex-mcp.md)按需选读，执行循环见 [Agent 入门](03-build-a-harness.md)。<mark class="key">无需先训练模型</mark>。

<div class="heading-alias" id="mcp-练习怎么选" aria-hidden="true"></div>

## MCP 练习路线

主线为 **[最简 demo](00-minimal-mcp.md) → [本地天气 MCP](07-weatherkit-mcp.md) → 其他案例**。服务实现 Server，应用提供 Host 与 Client；[Codex 接入](00-codex-mcp.md)为选读。

| 路线 | 内容 | 第一份成果 |
| --- | --- | --- |
| 1 · 最简 demo | [工具调用与文件读写](00-minimal-mcp.md) | 保存记录，重启服务后取回 |
| 2 · 天气实战 | [本地 Apple 天气 MCP](07-weatherkit-mcp.md) | 离线样本、真实天气查询与客户端接入 |
| 其他案例 | [MCP 项目实战](../mcp-projects/README.md) | 建模与修复验证；音乐案例为选修 |
| 选读 · Codex 接入 | [服务接入与记录保存](00-codex-mcp.md) | 在真实会话调用自建服务 |

最简 demo 用脚本编排真实 MCP 调用与文件读写；第一节即可完成运行验证，客户端实现细节按需阅读。

本地调用稳定后，按需做其他案例；需要网站登录、多用户与部署时，再进入[远程 MCP 与授权](../ai-communication/weather-mcp/README.md)。消息机制见[应用通信](../ai-communication/README.md)。

各演示统一在仓库根目录运行，例如 `pnpm demo:mini-mcp`、`pnpm demo:tiny-model`、`pnpm demo:harness`；运行 `pnpm run` 查看全部脚本。

TS 工程基础见 [TypeScript 技术栈与学习顺序](00-minimal-mcp.md#typescript-stack)：Node.js、Zod、异步、进程通信和测试。

## 四小时跨专题路线

240 分钟连接模型与 Agent 两个专题，也可只学其中两课；MCP 时间另计。

| 时间 | 内容 | 这一段要完成什么 |
| --- | --- | --- |
| 00—50 分钟 | [预测、上下文与训练](01-understand-models.md) | 从字符预测理解参数更新，再看上下文、训练规模与助手 |
| 50—60 分钟 | 休息与提问 | 说明参数、上下文和工具的区别 |
| 60—110 分钟 | [训练一个小语言模型](02-train-a-model.md) | 先比较训练前后与上下文长度，再选读概率、loss 和参数更新实现 |
| 110—120 分钟 | 休息与整理 | 保存一份模型，记下一个它仍然会犯的错 |
| 120—170 分钟 | [搭建工具调用 Harness](03-build-a-harness.md) | 跑通工具循环，找到可加统计、策略和审计的三个入口 |
| 170—180 分钟 | 休息与提问 | 找出模型提出动作与程序执行动作的交界处 |
| 180—230 分钟 | [接真实模型并做对照实验](04-experiments.md) | 切换模型接口，制造错误、拒绝、循环和取消，检查真实结果 |
| 230—240 分钟 | 复述与验收 | 用两份产物解释学习、推理、行动和验证 |

共 240 分钟，含 30 分钟休息与提问；跟写速度可调整。

<div class="heading-alias" id="我们会做出什么" aria-hidden="true"></div>

## 实验产物

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

参考实现：[Codex MCP](../../examples/codex-continue-mcp/src/server.ts)、[最简 demo](../../examples/minimal-mcp/src/demo.ts)、[小模型](labs/tiny-model.mjs)、[Harness](labs/harness.mjs)。先跑通，再跟改关键函数。

<mark class="caution">真实模型调用会产生用量</mark>，需 DeepSeek API key；其余实验可离线，Codex 篇沿用已有模型配置。

<div class="heading-alias" id="学完以后检查什么" aria-hidden="true"></div>

## 验收标准

- 选读验收：Codex 可调用自建 MCP Server，工具结果来源清楚。
- 基础验收：能比较训练前后输出，解释上下文与参数更新的区别；实现选读后再定位概率、loss 与更新代码。
- 能说明为什么“多训练一些”和“让模型多看一个字”改变的是不同因素。
- 能沿着 `assistant.tool_calls → 本地执行 → tool 结果 → 下一轮模型请求` 追踪一次任务。
- 能让保存请求被拒绝，也能经审批后创建文件，并核对文件内容。
- 能区分模型回答结束、工具执行成功，以及用户任务确实完成。

<div class="heading-alias" id="学完以后接到哪里" aria-hidden="true"></div>

## 延伸方向

Transformer 实现可先复习 [Attention 与 KV Cache](../kv-cache/02-attention-and-kv.md)，再参考 Karpathy 的 [makemore](https://github.com/karpathy/makemore) 从字符模型走到神经网络结构。

接入 Yuuki 读[共享运行时](../../examples/shared/runtime/README.md)与[可取消和恢复的运行](../agent-engineering/05-harness-vertical-slice.md)。MCP 用 Markdown 持久化；最简 demo 清理临时记录，Codex 保留日常记录。小型 Harness 事件仅存在内存与终端，持久化和恢复留到工程专题。

## 音乐 MCP（选修）

选修案例包括[钢琴排练台](07-music-space-mcp.md)或[舞台预演台](08-music-photo-mcp.md)：对照真实 MCP 参数、结果与模型变化，练习定位独听、部件调整和 PNG／MP4／GLB 导出。两篇共用本地存储、时间轴与工具，不作为天气主线前置，也无需先完成模型训练。

## 番外：工具调用怎样长成 Agent

[工具调用简史](extra-tool-use-story.md)串起 ReAct、Plugins、Code Interpreter、function calling、MCP 与 Skills，区分 Skills 首次推出与开放标准发布的日期，无需跟做。

返回[文档目录](../../site/src/pages/index.astro)，或选择 [MCP 实战项目](../mcp-projects/README.md)。
