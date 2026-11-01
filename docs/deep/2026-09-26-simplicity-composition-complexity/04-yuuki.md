# 回到 Yuuki：用一次变化看清简单、组合与复杂性

<mark class="key">用一次变化检验共同能力的边界</mark>。五种 UI 已共用 runtime/helper，可观察换工具、识别后端或交互牵动什么，而非按语言/进程数选赢家。本章把[上轮调查](../2026-09-26-zed-pi-rust/README.md)与[分析框架](01-framework.md)用于当前项目。

## 1. 先把观察时点说清楚

依据 2026-09-26 本地源码：当时无 Git 元数据，且实现同步变化，行号不是固定 commit。本轮已从旧基线推进到 `command → run → completion → tool`、会话保存和五 UI 集成，[文档入口](../../README.md)同步更新。[架构](../../architecture/ai-and-speech-foundation.md) · [runtime 源码](../../../examples/shared/runtime/Sources/main.swift)。

runtime 仅编译；真实 API、权限、竞态、恢复和工具边界未端到端测试，协议仍标 implementation in progress。本轮未运行应用、模型、语音或读取凭据。[验证范围](../../../examples/shared/runtime/README.md) · [协议状态](../../../examples/shared/runtime/PROTOCOL.md)。

共用 Swift runtime 只能比较 UI、宿主和协议成本，不能比较 Swift/Rust Harness 性能。Rust/GPUI、自研 loop 仍是候选方向，未作最终选型。[语音基础](../../architecture/ai-and-speech-foundation.md) · [选型边界](../2026-09-26-zed-pi-rust/04-yuuki-box.md)。

## 2. 共同运行时：少写五份规则，同时保留明确的时间语义

以下为数据与意图关系，进程拓扑随 UI 路线变化：

```text
UI：草稿、按钮、状态投影
  ├─ 任务命令 → Agent runtime：模型循环、工具、审批、持久化
  │                └─ 状态 / 文本增量 / 结果 → UI
  └─ 语音命令 → native helper：采集、识别、资源清理
                   └─ 转写 → 用户采用为草稿 → 用户发送任务
```

runtime 管请求、工具结果和会话；UI 管未提交草稿/设置。Web model 用 `state` 替换投影，按 session/message ID 应用 `delta`，保护本地编辑。要删除的是重复权威，不是所有数据副本。[状态源码](../../../examples/shared/web/src/agent-model.mjs:37)。

JSONL 之外还需顺序：先 state 中的消息，再 delta，终态给完整 state。忙时仅接受 bootstrap、取消和审批，拒绝新建/切会话及改设置；缩小状态组合，也限制运行中的操作。[协议](../../../examples/shared/runtime/PROTOCOL.md) · [命令入口](../../../examples/shared/runtime/Sources/main.swift:192)。

### 变化链 A：加一个工具，再在不同阶段取消

未实现的 `file_info(path)` 可作探针：预期只改 schema、参数、路径策略和执行分支。结果仍为 `name/content/status` 时，UI 无需识别新输出；此推断未用改动验证。[toolDefinitions](../../../examples/shared/runtime/Sources/main.swift:440) · [工具结果](../../../examples/shared/runtime/Sources/main.swift:305)。

当前 `tool()` 要求 `path`，并分别限定 `write_note`/其他工具字段；只适配少量文件工具。无路径计算、分页查询或长期任务需重设计，不能称任意工具可插拔。[参数与分派](../../../examples/shared/runtime/Sources/main.swift:472)。

`run.cancel` 取消 Task/请求、唤醒审批 continuation；循环保存已有内容/结果并标 cancelled，`write_note` 在审批后、创建前再查取消。分别观察流式请求、审批等待和写入后取消；<mark class="caution">取消不能撤销已写文件</mark>，也无自动回滚承诺。[入口](../../../examples/shared/runtime/Sources/main.swift:236) · [结束路径](../../../examples/shared/runtime/Sources/main.swift:276) · [写入边界](../../../examples/shared/runtime/Sources/main.swift:492)。

检验新工具能否复用取消、结果与恢复语义；不可撤销动作须区分执行中、结果已知/未知。PI 同样区分接收、记录、完成，进程或语言不能替代定义。[PI 简化与代价](../2026-09-26-zed-pi-rust/03-pi-desktop.md)。

## 3. 共同语音协议：能够替换后端，不代表后端行为相同

### 变化链 B：Apple Speech → Whisper，停止还能叫同一件事吗？

helper 包含 Apple Speech/AVFoundation 与录音转换→whisper.cpp CLI 两条路径，共用 `speech.state/partial/final/error`；Whisper 先录后转、不产 partial，各 UI 共用转换/CLI 管理。[helper](../../../examples/shared/native/README.md)。

Apple `stop` 停止采集后短暂收尾，Whisper `stop` 后还要转换/推理；`cancel`、stdin EOF 或宿主退出才放弃。宿主需保留 stdin、等待和取消入口，不能照搬 Apple 的短时强杀；当前 Swift 宿主已保留转写时间。[stopSpeech](../../../examples/shared/web/NativeHostSupport.swift:132) · [停止约定](../../../examples/shared/native/README.md)。

Whisper 分准备、录音、转换、推理、完成阶段；转换响应取消前不能删临时文件，CLI 终止退出后再清理。内部细节可隐藏，但外部须知道仍在收尾、取消不产 final。[阶段与资源](../../../examples/shared/native/Sources/WhisperSession.swift:33) · [清理顺序](../../../examples/shared/native/Sources/WhisperSession.swift:321)。

识别结果先经用户检查，再发送给 Agent；`useTranscript()` 只改草稿，不启动任务，避免录音直接触发工具或费用。[草稿与语音](../../../examples/shared/web/src/agent-model.mjs:29)。

CLI 换常驻 worker 可局限在 helper，新增 partial、并行或恢复则可能扩展上层契约。同字段不等于行为互换；Whisper 耗时、质量与取消延迟未实测。[未验证项](../../../examples/shared/native/README.md)。

## 4. React → AppKit：组合现有词汇，与创造新词汇的成本不同

### 变化链 C：加一个按钮，与加一种编辑器

React reconciler 在 Node 生成树，Swift 映射 AppKit，动作按 ID 回传 callback。Button、Field、Select、Editor、Transcript 是共同词汇；稳定 ID 保留控件，避免每次重建输入对象。[拓扑](../../../examples/react-native-bridge/README.md) · [映射](../../../examples/react-native-bridge/src/Host.swift:192)。

给已有动作加 Button，可复用 title、enabled、ID、onPress；新能力仍需实现业务命令，外观复用不能替代。[按钮与回调](../../../examples/react-native-bridge/src/main.jsx:75)。

加纯文本草稿区可复用 Editor；富文本、选区、IME、撤销与文档语义则扩展词汇，涉及 props、JSON、AppKit 生命周期、反向事件和状态归属。当前不承诺通用 UI、复杂富文本或 Markdown 编辑器，成本应计入平台开发。[范围](../../../examples/react-native-bridge/README.md) · [文本入口](../../../examples/react-native-bridge/src/Host.swift:213)。

`commitTree()` 先全树序列化，`writeRender()` 后丢弃积压快照，未省去前面的工作。保留控件、丢待发快照、增量数据是不同层次；解码时间也不是帧率。[背压源码](../../../examples/react-native-bridge/src/main.jsx:12)。

对照 [Raycast / Warp](02-raycast-warp.md)：受控词汇便于常见组合，超出词汇则需平台开发。Yuuki 先观察重复限制，无需先做通用 renderer。

## 5. 把复杂性放到一张实际可用的变更探针表里

以下探针<mark class="caution">尚未实施或运行</mark>。每次选一行，记录改动、契约和失败，不将文件数当复杂度分数。

| 变更 | 应该局部化的位置 | 仍必须暴露的契约 | 需要观察的失败 |
|---|---|---|---|
| 新增 `file_info(path)` 只读工具 | runtime 的定义、参数和执行分支 | 工作区边界、结果大小、结构化错误 | UI 被迫识别新工具名；越界路径；结果超限 |
| 新增无需 path 的工具 | 工具分派与参数策略 | 每类参数形状、能力范围、取消语义 | 为迁就旧接口伪造 path；全局规则误拒绝 |
| 网络输出、审批等待、写入后分别取消 | runtime 的生命周期与副作用边界 | 已取消是否仍有结果；已执行是否可撤销 | 审批悬挂；取消后重复执行；已写文件被显示成未执行 |
| Apple 切 Whisper，并在录音/推理时停止或取消 | helper 后端和资源管理 | stop 与 cancel 不同；转写期间仍忙；final 规则 | stop 后 EOF；短计时强杀；临时文件被过早删除 |
| 给已有动作增加 Button | React 组件与 model | 稳定 ID、enabled、动作返回 | 误触发；事件回到错误节点；宿主不得不新增特例 |
| 纯文本 Editor 扩展为复杂编辑器 | 新控件契约及 AppKit 实现 | 选区、输入法、撤销、状态归属 | 组合输入被覆盖；焦点丢失；两侧文本互相覆盖 |
| 对话内容增长并保持连续输出 | UI 投影、传输和渲染策略 | 增量先后顺序、消息身份、终态对齐 | 全量复制增长；积压；旧增量进入新会话 |

基线见 [runtime](../../../examples/shared/runtime/README.md)、[helper](../../../examples/shared/native/README.md)、[原生桥](../../../examples/react-native-bridge/README.md)。内容增长还需遵守[性能比较口径](../../../examples/COMPARISON.md)，固定单行回放不代表完整聊天。

## 6. 哪些复杂性值得承担，哪些可以等

任务身份、取消、副作用与恢复已进入语义；签名、权限、进程和输入法是平台约束；插件、多 Agent、同步和常驻可延后。分清三类，才知道是在删能力、集中重复，还是搬到别处。[范围](../../../examples/shared/runtime/README.md) · [五路线](../../../examples/COMPARISON.md)。

Zed 可借鉴领域模型、注册、快照和版本；PI 可借鉴状态权威与故障边界，不必复制 crate、进程数量或完整编辑器。[Zed](../2026-09-26-zed-pi-rust/02-zed-architecture.md) · [PI](../2026-09-26-zed-pi-rust/03-pi-desktop.md)。

五个示例仍是 Mac 样本：任务/事件和纯领域逻辑可复用，macOS helper、进程、Keychain 和 UI 生命周期不能直接搬到移动端。选一条愿维护的 UI，追一项变化的成败，再对照另一条成本，为未来 Rust runtime 保留共同问题。[目标与候选](../../README.md) · [验证建议](../2026-09-26-zed-pi-rust/04-yuuki-box.md)。

返回[本轮调查入口](README.md) · 对照[Zed / Grok](03-zed-grok.md)。
