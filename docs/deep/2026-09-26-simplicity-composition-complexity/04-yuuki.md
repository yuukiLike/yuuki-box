# 回到 Yuuki：用一次变化看清简单、组合与复杂性

**Yuuki 现在最值得研究的，是共同能力能否让一次变化停在合适的边界内。** 五种 UI 已开始共用实际 Agent runtime 和语音 helper；因此可以直接观察“换一个工具、换一个识别后端、加一种交互”会牵动什么。这比按语言、进程数或代码量选赢家更接近长期维护体验。本章承接[上轮 Zed / PI 调查](../2026-09-26-zed-pi-rust/README.md)，将本轮的[概念框架](01-framework.md)落到当前项目。

## 1. 先把观察时点说清楚

本章依据 2026-09-26 的本地源码和文档。项目目录没有 Git 元数据，源码也在其他任务中同步变化；下面的行号是本轮阅读定位，不能当作固定 commit。本轮阅读过程中，项目从旧文档“尚无真实模型调用、工具循环、持久化”的基线推进到了新实现，最终[文档入口](../../README.md)也已更新。目前已有 `command → run → completion → tool` 的实际代码、会话保存和五条 UI 的集成路径。[新架构说明](../../architecture/ai-and-speech-foundation.md)与 [runtime 源码](../../../examples/shared/runtime/Sources/main.swift)反映了这个变化。

“有代码”与“行为已验证”仍需分开：runtime README 明确记录仅编译，真实 API、权限、并发竞态、恢复和工具边界尚未端到端测试；协议文件仍标注 implementation in progress。本次调查没有运行应用、调用模型、读取凭据或执行语音识别。[构建与未验证范围](../../../examples/shared/runtime/README.md) · [协议状态](../../../examples/shared/runtime/PROTOCOL.md)。

五条路线共用 Swift runtime，也意味着现阶段能比较的是 UI、宿主和协议接入成本，不能据此比较 Swift Harness 与 Rust Harness 的性能。Rust / GPUI 继续是正式学习与产品候选，自研 model/tool loop 继续是方向；当前共享实现没有替未来做最终选型。[AI 与语音基础说明](../../architecture/ai-and-speech-foundation.md) · [上轮选型边界](../2026-09-26-zed-pi-rust/04-yuuki-box.md)。

## 2. 共同运行时：少写五份规则，同时保留明确的时间语义

当前责任关系可以读成下面这张图。它表示数据和意图的关系，具体进程拓扑随 UI 路线变化：

```text
UI：草稿、按钮、状态投影
  ├─ 任务命令 → Agent runtime：模型循环、工具、审批、持久化
  │                └─ 状态 / 文本增量 / 结果 → UI
  └─ 语音命令 → native helper：采集、识别、资源清理
                   └─ 转写 → 用户采用为草稿 → 用户发送任务
```

模型请求、工具结果与会话状态由 runtime 管；UI 保留尚未提交的草稿和正在编辑的设置。共享 Web model 收到 `state` 时替换 runtime 投影，收到 `delta` 时按 `sessionId` 和 `messageId` 更新消息，同时保护未提交草稿与设置。这些本地状态有各自目的，不能因“都有一份数据”就全部删掉；应检查是否出现两个地方同时决定同一个业务事实。[状态处理源码](../../../examples/shared/web/src/agent-model.mjs:37)。

同样，JSONL 只解决传输表示。协议还必须说清：流式消息先出现在状态中，随后才有增量；终态重新提供完整状态；运行中哪些命令可用。当前 runtime 忙时拒绝新建会话、切会话和改设置，仅保留 bootstrap、取消和审批。这是通过限制可同时发生的事情缩小状态组合，代价是任务运行时用户不能随意切换工作。[协议](../../../examples/shared/runtime/PROTOCOL.md) · [命令入口](../../../examples/shared/runtime/Sources/main.swift:192)。

### 变化链 A：加一个工具，再在不同阶段取消

以尚未实现的 `file_info(path)` 为阅读探针：若它只返回工作区文件元信息，预计变化集中在工具 schema、参数校验、路径策略复用和执行分支。现有循环将工具结果统一转换为 `name/content/status` 消息；在保持这种结果形式时，五个 UI 不必各自理解一种新的工具输出。这个判断来自现有调用链，尚未用实际改动验证。[toolDefinitions](../../../examples/shared/runtime/Sources/main.swift:440) · [工具循环与结果](../../../examples/shared/runtime/Sources/main.swift:305)。

边界也很具体：当前 `tool()` 在分派前要求所有参数都含 `path`，并按 `write_note` 与其他工具限定字段。它是“少量工作区文件工具”的接口。如果新增无需路径的计算工具、需要分页的远端查询或长期任务，前置假设就要重新设计。泛化为“任意工具已经可插拔”会隐藏真正的改动。[参数检查和分派](../../../examples/shared/runtime/Sources/main.swift:472)。

取消更能显露组合质量。UI 发 `run.cancel`；runtime 取消 Task 和网络请求，并唤醒等待审批的 continuation；循环将任务归为 cancelled，保存已收到内容和已完成结果。`write_note` 在审批后、创建前再检查取消。这里至少存在三个不同观察点：请求还在流式返回、正在等待允许、文件已经写入。最后一种情形不能靠按钮把副作用撤销；现有实现也没有自动回滚承诺。[取消入口](../../../examples/shared/runtime/Sources/main.swift:236) · [任务结束路径](../../../examples/shared/runtime/Sources/main.swift:276) · [审批与写入边界](../../../examples/shared/runtime/Sources/main.swift:492)。

由此得到的研究问题是：新工具能否沿用取消、结果和恢复语义，而不是每加一个工具就新增一套特殊状态？若工具有无法撤销的副作用，就应把“开始执行”“结果已知”“结果未知”暴露给调用方。上轮 PI 的持久化与恢复调查也强调了已接收、已记录和已完成的区别；增加一个进程或换成 Rust 都不会替代这些定义。[PI 的简化与代价](../2026-09-26-zed-pi-rust/03-pi-desktop.md)。

## 3. 共同语音协议：能够替换后端，不代表后端行为相同

### 变化链 B：Apple Speech → Whisper，停止还能叫同一件事吗？

共享 helper 已有两条实际路径：Apple Speech / AVFoundation，以及 AVFoundation 录音与转换后调用本地 whisper.cpp CLI。两者复用 `speech.state/partial/final/error` 信封，但 Whisper 当前是先录音、后转写，不产生 partial。复用这一层让各 UI 无须各写一套音频转换与 CLI 管理。[语音 helper 说明](../../../examples/shared/native/README.md)。

真正影响上层的是时间语义：Apple 实时 `stop` 停止采集并短暂等待收尾；Whisper 的 `stop` 则结束录音，继续转换和推理。`cancel`、stdin EOF 或宿主退出才表示放弃。因而宿主必须在 stop 后保持 stdin 打开，并提供等待状态与取消入口；沿用 Apple 的短时间强杀会截断 Whisper 的正常工作。共享 Swift 宿主现在只发送 stop，代码中明确保留后续转写时间。[宿主 stopSpeech](../../../examples/shared/web/NativeHostSupport.swift:132) · [两种后端的停止约定](../../../examples/shared/native/README.md)。

资源清理也不是一个通用 `stop()` 足够表达的。Whisper 有准备、录音、转换、推理、完成几个阶段；转换尚未响应取消时，不能删除它仍使用的临时文件；CLI 运行时先终止，等待退出后再清理。这些细节可以留在 helper，但“任务仍在收尾、取消不产出 final”必须成为外部契约。[Whisper 阶段与资源](../../../examples/shared/native/Sources/WhisperSession.swift:33) · [finish 清理顺序](../../../examples/shared/native/Sources/WhisperSession.swift:321)。

产品层另有一条有价值的限制：识别结果先成为草稿，经用户检查再发送给 Agent。它切断了“麦克风结果一到就产生工具执行或模型费用”的隐式联系，同时允许用户修正转写。代码中的 `useTranscript()` 只更新草稿，不启动任务。这是交互选择对状态复杂性的直接约束。[草稿与语音操作](../../../examples/shared/web/src/agent-model.mjs:29)。

将来若把短命 CLI 换成常驻 worker，模型加载和临时文件策略可以在 helper 内变化；但新增流式 partial、并行识别或可恢复任务时，上层状态与身份契约仍可能需要扩展。这里的“可替换”有条件，不能从 JSON 字段相同推出所有行为都可互换。当前没有 Whisper 耗时、识别质量或取消延迟实测。[已有边界与未验证项](../../../examples/shared/native/README.md)。

## 4. React → AppKit：组合现有词汇，与创造新词汇的成本不同

### 变化链 C：加一个按钮，与加一种编辑器

这条路线已有真实 React reconciler：Node 生成结构化 UI 树，Swift 映射为 AppKit 控件；用户动作再以 ID 回到 Node callback。固定词汇中已有 Button、Field、Select、Editor、Transcript 等。Swift 按稳定 ID 保留控件，避免每次提交重建输入对象。这说明“原生控件”背后包含一份共同维护的语义词汇。[实际拓扑](../../../examples/react-native-bridge/README.md) · [控件映射](../../../examples/react-native-bridge/src/Host.swift:192)。

如果只是给已有动作加一个 Button，现有 title、enabled、ID 和 onPress 往返机制可能足够，改动可留在 React UI 与 model。若按钮代表全新能力，能力侧依然要实现命令；按钮外观的复用不能替代业务实现。[现有按钮与回调](../../../examples/react-native-bridge/src/main.jsx:75)。

若“新编辑器”指在现有纯文本 Editor 上增加一个草稿区，仍可能只是复用；若指富文本、选区同步、IME composition、撤销和文档语义，就在扩展词汇本身。届时要决定 React props、JSON 表示、AppKit 对象生命周期、反向事件与谁持有编辑状态。当前 README 明确不承诺通用 UI 框架、复杂富文本或 Markdown 编辑器。这类成本应记在平台能力开发上，不能当成“React 写几行就够了”。[renderer 范围](../../../examples/react-native-bridge/README.md) · [文本控件入口](../../../examples/react-native-bridge/src/Host.swift:213)。

还有一个容易被“有背压”遮住的成本：`commitTree()` 先遍历整个树并 JSON 序列化，随后 `writeRender()` 才在通道拥堵时只保留最新快照。它约束积压，尚未省去已发生的全树序列化。AppKit 保留控件、Node 丢弃旧待发快照、只更新变动数据是三个不同层次，不能相互代称。底部解码时间也不是端到端帧率。[提交与背压源码](../../../examples/react-native-bridge/src/main.jsx:12)。

这与[Raycast / Warp 的组合案例](02-raycast-warp.md)可以形成阅读对照：受控词汇让常见需求容易组合，超出词汇的能力则由平台承担扩展成本。Yuuki 无须现在成为一个通用 renderer；需要先看自己的产品是否频繁触碰同一个限制。

## 5. 把复杂性放到一张实际可用的变更探针表里

下表是后续可执行的观察计划，**本轮没有实施或运行这些探针**。每次选一行，记录实际改动、必须同时理解的契约和失败现象；不要将文件数简单加成复杂度分数。

| 变更 | 应该局部化的位置 | 仍必须暴露的契约 | 需要观察的失败 |
|---|---|---|---|
| 新增 `file_info(path)` 只读工具 | runtime 的定义、参数和执行分支 | 工作区边界、结果大小、结构化错误 | UI 被迫识别新工具名；越界路径；结果超限 |
| 新增无需 path 的工具 | 工具分派与参数策略 | 每类参数形状、能力范围、取消语义 | 为迁就旧接口伪造 path；全局规则误拒绝 |
| 网络输出、审批等待、写入后分别取消 | runtime 的生命周期与副作用边界 | 已取消是否仍有结果；已执行是否可撤销 | 审批悬挂；取消后重复执行；已写文件被显示成未执行 |
| Apple 切 Whisper，并在录音/推理时停止或取消 | helper 后端和资源管理 | stop 与 cancel 不同；转写期间仍忙；final 规则 | stop 后 EOF；短计时强杀；临时文件被过早删除 |
| 给已有动作增加 Button | React 组件与 model | 稳定 ID、enabled、动作返回 | 误触发；事件回到错误节点；宿主不得不新增特例 |
| 纯文本 Editor 扩展为复杂编辑器 | 新控件契约及 AppKit 实现 | 选区、输入法、撤销、状态归属 | 组合输入被覆盖；焦点丢失；两侧文本互相覆盖 |
| 对话内容增长并保持连续输出 | UI 投影、传输和渲染策略 | 增量先后顺序、消息身份、终态对齐 | 全量复制增长；积压；旧增量进入新会话 |

前三行的基线见 [runtime](../../../examples/shared/runtime/README.md)，语音行见 [helper](../../../examples/shared/native/README.md)，UI 行见 [原生桥](../../../examples/react-native-bridge/README.md)。最后一行还应对照[已有性能比较的口径限制](../../../examples/COMPARISON.md)，避免把固定单行回放当作完整聊天负载。

## 6. 哪些复杂性值得承担，哪些可以等

对当前 Yuuki，任务身份、取消、工具副作用和恢复属于已经进入产品的语义；签名、系统权限、子进程与输入法属于当前平台路线带来的约束；通用插件系统、多 Agent、跨设备同步、后台常驻则仍可根据实际需求延后。把这三类分开，才能看出一次简化是在删除无用能力、把重复能力集中，还是只把工作藏到了另一个进程。[当前范围](../../../examples/shared/runtime/README.md) · [Apple 平台与五路线比较](../../../examples/COMPARISON.md)。

Zed 提供的是强领域模型、注册关系、快照和版本检查的参考；PI 提供的是异构组件间状态权威与故障边界的参考。可以将这些经验用到当前小系统，却没有必要先复制它们的 crate 数、进程数或完整编辑器结构。[Zed 组合机制](../2026-09-26-zed-pi-rust/02-zed-architecture.md) · [PI 边界](../2026-09-26-zed-pi-rust/03-pi-desktop.md)。

Mac、iPad、iPhone 的方向仍应保留，但当前五个示例都是 Mac 学习样本。可复用的候选是任务与事件语义、纯领域逻辑；macOS helper、进程管理、Keychain 接入和 UI 生命周期不能直接当作移动端实现。下一次产生信息的动作，是选一条自己愿意维护的 UI 路线，沿表中一个变化追到完成与失败，再看另一条路线承担了哪些不同成本。这样留下的是具体经验，也给未来 Rust runtime 对照保留同一组问题。[已有目标与候选](../../README.md) · [上轮验证建议](../2026-09-26-zed-pi-rust/04-yuuki-box.md)。

返回[本轮调查入口](README.md) · 对照[Zed / Grok](03-zed-grok.md)。
