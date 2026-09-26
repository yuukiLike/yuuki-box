# SwiftUI + AppKit Agent 工作台

这个示例现在包含三个独立入口：**Agent 工作台**调用真实本地 Harness；**回放与更新实验**保留各路线共有的固定负载；**场景实验**提供三组可以切换“朴素 / 优化”的真实实现。SwiftUI 管理界面，AppKit 管理窗口和文件选择，两个本地 helper 分别管理模型/工具循环与语音。

## 构建与打开

在仓库根目录：

```sh
bash examples/swift-native/build.sh
open examples/swift-native/build/YuukiSwiftNative.app
```

脚本编译共享语音 helper、共享 Agent Runtime 和当前界面，然后复制 fixtures 并 ad-hoc 签名。只使用 Swift、系统 SDK 和框架，不需要先创建 Xcode 工程。当前是本机架构、macOS 14 部署目标的本地示例；正式签名、公证、分发和 iOS target 未完成。

包中的进程：

```text
YuukiSwiftNative.app/Contents/MacOS/yuuki-swift-native
YuukiSwiftNative.app/Contents/Resources/AgentRuntime.app/Contents/MacOS/agent-runtime
YuukiSwiftNative.app/Contents/Helpers/NativeCapabilities.app/Contents/MacOS/native-capabilities
```

## 直接在应用中配置

1. 在 Agent 页打开“设置”，填写 API Base、模型名称和 API Key。密钥使用 `SecureField`，发送给 Runtime 后清空输入；界面不把密钥写入配置文件或日志，Runtime 负责 Keychain。空输入保留已有凭据，也可以明确清除保存的 Key。若使用环境变量凭据，清除 Keychain 不会移除环境变量。
2. 选择本地工作区，设置最大输出 token 和工具循环次数。Runtime 会再次校验输入和目录范围。
3. 选择 Apple Speech 或 Whisper。Whisper 需要已有的 `whisper-cli` 和本地模型，可通过文件选择器填写绝对路径。中文请选多语言 small 模型，不选 `small.en`。
4. 保存后进入会话，输入一项任务，点击“发送任务”或 ⌘↵。配置和草稿都可以通过界面完成，不要求从终端注入配置。

模型调用会使用你配置的服务和凭据。打开窗口、回放固定数据或配置语音本身不会发送 Agent 任务；只有明确发送任务才启动模型循环。

## Agent 页已经接通的行为

- **会话**：创建和选择真实 Runtime 会话，读取已持久化消息。各技术路线使用各自的会话空间，配置与 Keychain 由共享 Runtime 管理。当前输入草稿在窗口存活期间按会话保留，尚不持久保存草稿。
- **任务**：提交真实模型任务，接收 `state` / `delta`，显示 assistant 和 tool 输出；取消请求交给 Runtime。界面在忙碌时禁用会话切换和设置保存，避免把正在执行的操作移到其他会话。
- **错误与用量**：显示 Runtime 提供的错误、请求次数、token 和未知用量次数；不把未上报的用量伪装成零费用。
- **审批**：需要写入笔记时，展示工具名、目标路径和完整可滚动预览，再提供“允许写入”/“拒绝”。界面不会自行绕过 Runtime 的工具策略。
- **导出**：请求 Runtime 导出当前会话为本地 Markdown；显示实际路径，可以点击在 Finder 中定位。
- **断连**：子进程退出后显示状态并提供重新连接。重连重新 bootstrap，旧进程事件不会替换新连接的状态。

真实工具集合、写入限制、持久化和模型循环的实现见 [共享 Runtime](../shared/runtime/README.md) 与 [协议](../shared/runtime/PROTOCOL.md)。这个 UI 没有在自身添加任意 shell 执行入口，也不从终端输出猜测工具状态。

## Apple 与 Whisper 语音

语音入口读取已保存的设置，提供“开始录音”和“音频文件…”。选择文件不会立即发给模型；转写文本只显示在语音区域。你确认后点击 **“将转写替换草稿”**，再自行发送任务。识别结束不会自动发送，也不会偷偷覆盖正在编辑的草稿。

Apple 后端默认设备端识别，可显示部分结果；设备或语言不支持时明确报错。Whisper 是先录音后转写：点击“停止并转写”会启动本地推理，转写期间保留“取消语音”；没有 3 秒强杀长推理的逻辑。关闭窗口或取消时向 helper 发 cancel 并结束子进程。

Whisper 需要你先准备可信任的 CLI 与模型，本示例不下载它们，也不回退到网络识别。音频转换、120 秒录音上限、10 分钟文件/推理上限、输出限制与临时文件清理见 [共享语音说明](../shared/native/README.md)。麦克风和系统权限由你主动操作时决定；本轮没有替你触发权限。

## 回放与更新实验页

这个页保留 UI 比较的固定数据路径，与真实 Agent 会话分开：

- 1,000 / 10,000 条历史，全部/工具筛选。
- 每 50 ms 追加 1 条固定事件，每轮最多 200 条，保留上限 10,200；可以取消与重新开始。
- 实验页输入和侧栏只用于交互体验，不驱动真实模型或独立会话。真正会话在 Agent 页。
- 不自动滚到底部，方便在持续追加时阅读旧内容；尚未加入富 Markdown 或语法高亮。

更新按钮仍是**版本发现**，不是完整自动安装器。默认读取本地清单：当前版本 0.1.0，可用版本 0.2.0；链接使用 example.com 占位，只有你点击才打开浏览器。

```sh
# 三个固定场景：available（默认）、current、invalid。
YUUKI_UPDATE_FIXTURE=current \
  examples/swift-native/build/YuukiSwiftNative.app/Contents/MacOS/yuuki-swift-native

# 明确配置远程清单。只有点击检查更新才发请求。
YUUKI_UPDATE_URL=https://your-domain.example/update.json \
  examples/swift-native/build/YuukiSwiftNative.app/Contents/MacOS/yuuki-swift-native
```

fixture 值固定映射，不接受任意路径，未知值报错。非空 `YUUKI_UPDATE_URL` 优先于 fixture，只接受 HTTPS；超时 10 秒，清单接收后限制 64 KiB，数字版本比较与发布地址校验仍在界面代码中。下载、签名校验、替换、重启和失败恢复没有实现；独立分发后续可实际接入 [Sparkle](https://sparkle-project.org/documentation/)。

## 三个 Harness 场景：亲手对照实现

打开“场景实验”，选择一个场景、负载和实现模式，点击“运行 / 重跑”。上方**响应探针**始终可以输入；运行中持续打字、移动光标，再去阅读对应内容，能观察真实调度与界面更新对输入的影响。探针和搜索查询在切换、停止、重置时保留。这里没有假延时、空转循环、模型请求、麦克风或真实工作区读写；日志路径是确定生成的内存数据。

建议用同一负载先完成朴素模式，再切换优化模式重跑。每个场景保留两种模式各自**最近的完整结果**，包含输入规模、输出规模、工作计数、函数处理用时和 FNV-1a 指纹。只有输入条件相同才显示指纹对照；未完成的运行不覆盖完整结果。摘要是非密码学辅助检查，不证明像素、时序或所有交互都等价。

| 场景 | 朴素路径 | 优化路径 | 轻 / 中（默认）/ 重 |
|---|---|---|---|
| 长会话流式排版 | 每个块重新 Markdown 解析全部历史，再发布当前消息 | 历史一次解析、稳定 revision 隔离；独立当前消息每 6 块发布 | 400 / 1,500 / 3,000 条历史；均为 180 块、名义间隔 30 ms |
| 工作区日志检索 | 每次查询在 MainActor 重新归一化全部数据，再过滤/计分/排序 | 后台建立可复用索引；detached 查询 + 取消 + generation 检查 | 3,000 / 12,000 / 24,000 条日志；查询前 96 字符、最多 8 词；显示前 100 条 |
| 工具控制台追加 | 每次更新拼出全部字符串，用 `setAttributedString` 替换全部存储 | 加载一次旧输出，再用 `NSTextStorage.append` 追加所有遗漏批次 | 600 / 2,400 / 4,800 条旧行；均追加 160 批 × 4 行，名义间隔 25 ms |

定时器只模拟同一数据源的到达节奏，负载来自实际解析、归一化、排序和文本存储工作。主线程繁忙时到达回调可能延后；本例不把名义间隔当实际 FPS，也不通过固定睡眠让某个模式看起来慢。负载有上限，当前设备上差异是否明显仍需你主动体验。

### 场景 1：长会话继续输出，历史无需再解析

Harness 中，旧 assistant / tool 消息可能已经稳定，只有当前消息还在流入。本例两种模式调用同一个 Markdown 格式化函数。朴素模式每个块重新处理全部历史；优化模式保持不可变格式化历史，以 `CachedConversationHistory` 的 revision 明确隔离，并让 `ActiveConversationText` 单独发布当前文本。

你可以在历史区域滚动、选择文字，同时在探针编辑下一条指令。屏幕计数包括实际接收块数、累计解析历史行数、当前消息发布次数以及格式化段用时。初始历史生成/解析计入累计处理；它不是完整帧或键盘到显示的测量。最终指纹覆盖格式化后的历史纯文本与当前消息纯文本，正文长度按 UTF-16 计；Markdown 样式本身不在这个摘要中。

优化代价是缓存失效规则和中间更新频率：每 6 块发布意味着名义上最多约 180 ms 的批量窗口，停止时会发布尾批。不能把少显示中间状态说成没有取舍；两边的最终文本与全部历史都保留。

源码入口：[ScenarioLabs.swift](Sources/ScenarioLabs.swift) 的 `ConversationScenario.receiveNextChunk`、`reformatAllHistoryAndActive`、`publishOnlyActive`、`CachedConversationHistory` 和 `ActiveConversationPanel`。

### 场景 2：每个按键都搜索同一工作区

点击运行后修改查询，例如 `error`、`agent cancel`、`approval` 或 `cafe`。两条路径都使用大小写/重音/全角归一化，要求所有词匹配，以相同分数与稳定 ID 排序。空查询也有确定结果。数据只生成一次；这里不访问磁盘。

朴素实现把全数据归一化和排序都放在 MainActor 的输入回调。优化实现只构建一次索引，然后让 `Task.detached` 承担查询；每 64 条检查一次取消，排序结束再次检查，发布前再核对运行 ID 和查询 generation。索引尚未完成时可以继续修改查询，完成后采用最新输入。停止会禁用后续自动查询，直到再次点击运行。

计数包括累计归一化行数、扫描行数、实际发起/发布的查询次数、取消请求和确实丢弃的完成结果。最近查询处理时间：朴素包含重新归一化与排序，优化只包含已建索引上的匹配排序；界面另列累计建索引时间，不能把它当免费。指纹覆盖总匹配数和实际显示的前 100 条结果（ID、分数、路径、正文）；对照输入包含数据规模与查询。

优化代价是额外内存、索引失效、协作式取消和过期结果处理。取消不等于立即中止任意一条底层字符串操作，任务仍需到达检查点；generation 守卫负责防止它覆盖更新输入的结果。

源码入口：[SearchScenario.swift](Sources/SearchScenario.swift) 的 `WorkspaceSearchAlgorithm.buildIndex` / `rank` / `score`、`SearchScenario.normalizeAndRankOnMainActor` 与 `rankCachedIndexInBackground`。

### 场景 3：大段工具输出的全量替换与原生增量修改

两种模式使用**同一个 NSTextView**，相同字体、TextKit 设置和选区/滚动恢复逻辑。运行时向上阅读并选中旧输出，再去探针输入。只有原本在底部且没有选区时才跟随新增内容，不人为给朴素模式添加丢失选区或跳到底部的缺陷。

差别发生在文本存储：朴素模式重新构造全字符串并替换；优化模式根据已应用游标追加所有尚未应用的块。如果 SwiftUI 合并更新，它也会追加所有遗漏块，而不是丢数据。旧行和全部 640 条新增行都保留；这段视图不把输出截短来制造速度差异。

屏幕显示实际文本存储写入次数、累计交给存储的 UTF-16 字符数、当前文档字符数，以及同步构造/修改/滚动恢复区间的用时。追加次数不一定等于输入批次数，因为视图更新可以合并。最终指纹直接读取最终 `NSTextStorage.string`，只在完成时计算，并排除在存储操作计时之外。

优化代价是已应用游标、generation、reset 处理，以及 SwiftUI ↔ AppKit 文本容器和滚动桥接。它是工具日志视图，不是 ANSI/PTY 终端模拟器；现有 Agent/语音/回放入口保持独立。

源码入口：[ConsoleScenario.swift](Sources/ConsoleScenario.swift) 的 `ConsoleFeed`、`ConsoleScenario.start`、`IncrementalConsoleText.updateNSView`。该函数中的两个分支分别调用 `setAttributedString` 与 `append`，共享选区/滚动恢复，不隐藏到抽象层之后。

### 如何解释屏幕上的数字

这些是你运行时才产生的真实计数和函数区间墙钟时间；不是预置成绩、帧率、CPU 时间或端到端输入延迟。指纹计算不混入处理计时。比较时保持同一负载、查询和交互顺序；索引准备、批量发布等待和额外内存也要一起考虑。最近完整结果会跨模式切换保留，方便直接阅读，无需另建复杂报告。

停止、重置、切换场景/模式/负载、离开场景页都会取消计时器或后台任务，并用运行身份阻止旧结果落入新场景。重置清空当前数据和计数，但保留输入与两种模式的最近完整对照。没有把本轮未执行的界面实验写成已通过：**这次只编译，未运行这些负载或采集数值。**

平台参考：[Apple NSTextStorage](https://developer.apple.com/documentation/appkit/nstextstorage)、[NSTextView selectedRanges](https://developer.apple.com/documentation/appkit/nstextview/selectedranges)。

## 按调用路径读代码

| 文件 | 主要职责 |
|---|---|
| [Sources/AgentWorkbench.swift](Sources/AgentWorkbench.swift) | Runtime JSONL 客户端、状态模型、会话与设置 UI、审批、导出、Apple/Whisper 交互 |
| [Sources/main.swift](Sources/main.swift) | 回放实验、更新检查、AppKit 应用与窗口生命周期 |
| [Sources/ScenarioLabs.swift](Sources/ScenarioLabs.swift) | 场景控制、保留的输入探针、对照摘要、长会话全量重排与独立流式更新 |
| [Sources/SearchScenario.swift](Sources/SearchScenario.swift) | 同一检索算法的主线程重复计算与缓存/后台/取消路径 |
| [Sources/ConsoleScenario.swift](Sources/ConsoleScenario.swift) | 同一原生文本视图的全量替换与增量追加路径 |
| [../shared/runtime/PROTOCOL.md](../shared/runtime/PROTOCOL.md) | UI 与真实 Harness 的命令/事件边界 |
| [../shared/native/Sources/WhisperSession.swift](../shared/native/Sources/WhisperSession.swift) | 录音、音频规范化、CLI 推理、取消与文件清理 |

`JSONLChild` 保持 stdin 打开，按字节积累 stdout，每条消息上限 2 MiB。界面不输出协议 payload 或 API Key 日志；错误走结构化事件。delta 只追加到匹配的会话和 message ID；单消息还设有显示容量上限。读取与进程等待在后台，状态修改在 MainActor。

Swift 示例也使用共享 helper 子进程，使各 UI 路线采用相同的语音与 Harness 实现。纯 Swift 产品可以合并进程或改用其他 IPC；那会改变生命周期、隔离和性能比较条件，应作为下一步明确的实验。

## 这条路线的具体收益与代价

| 问题 | 当前实现带来的收益 | 仍需承担的成本 |
|---|---|---|
| 系统窗口与输入 | 系统控件、SecureField、文件选择器直接使用 | 特殊窗口、复杂列表或不同 macOS 版本可能需要进一步 AppKit 工作 |
| 模型与工具运行 | UI 不直接持有网络循环，结构化协议可读 | 两个 helper 的生命周期、事件顺序和打包都需要处理 |
| Apple 能力 | Swift 直接使用 Speech/AVFoundation，类型和错误语义明确 | TCC、签名身份、模型可用性与音频中断仍是真实问题 |
| Whisper 控制权 | 可明确选择本地 CLI 和模型，音频无需发送云端 | 模型加载、推理等待、资源占用和兼容性由应用自己承担 |
| 视图状态 | SwiftUI List、表单和状态绑定让 MVP 容易修改 | 不能由框架名称推断流畅；频繁状态更新、筛选扫描和长文本仍需实际体验 |
| Apple 多设备 | 视图思想和 Swift 代码可复用 | AppKit 窗口、子进程与 macOS 权限模型不能直接搬到 iOS |

## 当前证据范围

本次实现的 Swift Agent UI 与三个场景对照已通过直接 `swiftc` 编译；最终 `.app` 由统一构建流程生成并复制新版 Runtime/语音 helper。Apple + Whisper helper 也已编译。按用户指示没有运行 UI、测试、场景负载、网络模型调用、真实录音、CLI 转写、性能测量或完整更新安装，因此不把编译结果描述为端到端验收。

原 `--self-test` 入口保留旧的 fixture/版本检查，未覆盖新 Agent/Whisper 路径，本轮没有运行。没有虚构速度、识别准确率、Token 消耗或工具执行结果。

仍未实现的产品能力包括：自动更新安装、后台系统服务、iOS/iPadOS 客户端、跨设备同步、成熟 Markdown 编辑和发行配置。可以从当前完整调用路径继续学习，而不必先选定最终技术路线。
