# 从极简 MCP 到模型训练与 Harness

先做[Codex MCP](00-codex-mcp.md)：保存项目进度，换个会话取回。想观察协议，再做约 30 分钟的[独立演示](00-minimal-mcp.md)。

然后沿四小时主线学习模型、训练字符模型、搭建 Harness 并接真实模型。可分四次完成；需要基础 JavaScript、终端与文件编辑，其他概念随用随讲。

## MCP 练习怎么选

Codex 篇由模型决定调用；独立演示由脚本安排。先分清谁发请求、谁执行、结果来自哪里。

想补齐 TS 工具工程基础，读独立演示里的 [TypeScript 技术栈与学习顺序](00-minimal-mcp.md#typescript-stack)：从现有代码认识 Node.js、Zod、异步执行、进程通信与自动测试，按需选读。

[![MCP 学习路线：极简演示之后，可选 Blender 参数建模或 GitHub 修复验证；进一步理解通信，再实现 Harness 工具源与权限策略](../../site/public/diagrams/ai-from-scaling/mcp-learning-route.svg)](../../site/public/diagrams/ai-from-scaling/mcp-learning-route.svg)

<details>
<summary>更多 MCP 练习</summary>

| 想做什么 | 入口 |
| --- | --- |
| 改尺寸并导出模型 | [Blender](05-blender-mcp.md) |
| 复现 bug、对照修复 | [GitHub](06-github-lab-mcp.md) |
| 查询天气、筛选出门时段 | [WeatherKit](07-weatherkit-mcp.md)，无密钥可先做样本 |
| 追踪请求往返 | [发现与调用](../ai-communication/04-mcp.md) |
| 接进自己的 Agent | [工具源](../agent-engineering/01-mcp-tool-source.md)、[调用策略](../agent-engineering/02-mcp-policy.md)，均为待实现练习 |

这些实践独立于四小时主线，按需选择。

</details>

## 先做 MCP 再进入四小时主线

| 开场 | 内容 | 第一份成果 |
| --- | --- | --- |
| Codex 接入 | [只写服务端，在真实会话里调用工具](00-codex-mcp.md) | 看到 Codex 的工具调用，保存并跨会话取回自己的记录 |
| 约 30 分钟 | [看懂一次 MCP 工具调用](00-minimal-mcp.md) | 改一句记录并在服务重启后取回，找到调用、读写和输入校验的位置 |

下面的 240 分钟属于原来的模型与 Harness 主线。

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

使用 Node.js 22.22 或更高版本，与现有文档站要求一致。MCP 开场需要用 pnpm 安装固定版本的官方 SDK；小模型与 Harness 两份实验无需安装 npm 包，所有本地实验均无需下载模型或使用 GPU。

参考实现：[Codex MCP](../../examples/codex-continue-mcp/src/server.ts)、[独立演示](../../examples/minimal-mcp/src/demo.ts)、[小模型](labs/tiny-model.mjs)、[Harness](labs/harness.mjs)。先跑通，再跟改关键函数。

第四章需要自己的 DeepSeek API key 并产生用量。独立演示、小模型和脚本 Harness 可离线运行；Codex 篇使用已有模型配置。

## 学完以后检查什么

- 能启动 MCP 客户端，发现服务端的工具，完成一次调用并解释结果从哪里来。
- 能指出预测概率、loss 和参数更新分别发生在哪一行，并解释验证集的用途。
- 能说明为什么“多训练一些”和“让模型多看一个字”改变的是不同因素。
- 能沿着 `assistant.tool_calls → 本地执行 → tool 结果 → 下一轮模型请求` 追踪一次任务。
- 能让保存请求被拒绝，也能在自己允许后创建文件，并核对文件内容。
- 能区分模型回答结束、工具执行成功，以及用户任务确实完成。

## 学完以后接到哪里

想继续实现 Transformer，可以先复习 [Attention 与 KV Cache](../kv-cache/02-attention-and-kv.md)，再参考 Karpathy 的 [makemore](https://github.com/karpathy/makemore) 从字符模型走到神经网络结构。

想把 Harness 接进 Yuuki，继续读[共享运行时](../../examples/shared/runtime/README.md)与[可取消和恢复的运行](../agent-engineering/05-harness-vertical-slice.md)。MCP 开场通过 Markdown 文件实现持久化，演示结束时会清理临时记录；本课程小型 Harness 的运行事件保存在内存并打印到终端。执行过程的持久化、崩溃恢复和多设备执行沿用后续工程专题展开。

## 番外：工具调用怎样长成 Agent

[工具调用简史](extra-tool-use-story.md)串起 ReAct、Plugins、Code Interpreter、function calling、MCP 与 Skills，区分 Skills 首次推出与开放标准发布的日期，无需跟做。

## 末章选修：音乐 MCP

先完成模型与 Harness 主线，以及感兴趣的 Blender、GitHub 实践，最后再按兴趣阅读这两个音乐案例。

| 选修章节 | 内容 |
| --- | --- |
| [音乐 1：声部之结](07-music-space-mcp.md) | 把 MIDI 折成可编辑的音乐雕塑，练习独听、配置保存与 GLB 导出 |
| [音乐 2：光之剧场](08-music-photo-mcp.md) | 用透明图层、音乐包络与灯光关键帧制作 2.5D 舞台短片 |

两篇共用同一个 TypeScript MCP，可保存场景、重新打开和导出 MP4，独立于 music-eyes。

返回[文档目录](../README.md)。
