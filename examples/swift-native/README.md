# SwiftUI + AppKit Agent 工作台

这个示例现在包含两个独立入口：**Agent 工作台**调用真实本地 Harness；**回放与更新实验**保留相同负载的 UI 路线比较。SwiftUI 管理界面，AppKit 管理窗口和文件选择，两个本地 helper 分别管理模型/工具循环与语音。

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

## 按调用路径读代码

| 文件 | 主要职责 |
|---|---|
| [Sources/AgentWorkbench.swift](Sources/AgentWorkbench.swift) | Runtime JSONL 客户端、状态模型、会话与设置 UI、审批、导出、Apple/Whisper 交互 |
| [Sources/main.swift](Sources/main.swift) | 回放实验、更新检查、AppKit 应用与窗口生命周期 |
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

本次实现的 Swift Agent UI 已通过直接 `swiftc` 编译；最终 `.app` 由统一构建流程生成并复制新版 Runtime/语音 helper。Apple + Whisper helper 也已编译。按用户指示没有运行 UI、测试、网络模型调用、真实录音、CLI 转写、性能测量或完整更新安装，因此不把编译结果描述为端到端验收。

原 `--self-test` 入口保留旧的 fixture/版本检查，未覆盖新 Agent/Whisper 路径，本轮没有运行。没有虚构速度、识别准确率、Token 消耗或工具执行结果。

仍未实现的产品能力包括：自动更新安装、后台系统服务、iOS/iPadOS 客户端、跨设备同步、成熟 Markdown 编辑和发行配置。可以从当前完整调用路径继续学习，而不必先选定最终技术路线。
