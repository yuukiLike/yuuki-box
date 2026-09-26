# Rust + GPUI：可编辑、可运行的 Agent 工作台

这个 macOS 示例真正使用 Rust、GPUI 0.2.2 与 Metal 绘制界面。它现在包含两个入口：**Agent 工作台**连接共用的本地 Agent Runtime，执行模型与工具循环；**渲染 / 更新实验**保留固定事件回放与软件更新清单实验。它没有 WebView，也不依赖本机 Zed checkout。

当前交付是已实现的代码与本机构建产物。按本轮要求，没有运行界面、测试、真实 API 调用、录音、Whisper 推理或模型下载。编译成功不表示这些交互已经完成验收；下文分别说明实际实现与仍未验证的部分。

## 开始

需要 macOS 14+、Rust 1.93+ 与 Apple Command Line Tools。首次构建会下载 Cargo 依赖，`Cargo.lock` 已锁定。当前机器无需先安装完整 Xcode或升级 Rust。

```bash
cd examples/rust-gpui
bash build.sh
open 'build/Yuuki GPUI.app'
```

`build.sh` 默认 dev/debug，也支持 `bash build.sh --release`、`bash build.sh release` 或 `PROFILE=release bash build.sh`。当前生成的 dev 产物不能直接与 Swift `-O` 产物做公平性能排名。脚本编译两个共享 Swift helper，将它们放入应用 Resources，再分别做 ad-hoc 签名：

- `AgentRuntime.app/Contents/MacOS/agent-runtime`：设置、Keychain、会话、模型循环、工具、审批与导出。
- `NativeCapabilities.app/Contents/MacOS/native-capabilities`：Apple Speech 或本地 Whisper 的语音识别。

本地 ad-hoc 签名不等于 Developer ID 签名、公证或可分发升级包。

## Agent 工作台里怎样操作

1. 进入“设置”，填写 API 地址、模型和工作区绝对路径。默认模型来自共享运行时，为 `deepseek-flash`，可以修改。API Key 输入遮罩显示，保存后立即清空；运行时将凭据写入 macOS Keychain，GPUI 不把它保存到文件或命令行。留空表示保留已有凭据，另有“移除 Keychain API Key”按钮。
2. 保存设置并观察运行时返回的状态。最大输出 token 与工具循环轮数可以配置；运行过程中禁止修改设置与切换会话。
3. 在“Agent”页面输入任务并点击“发送任务”。例如要求列出工作区文件或阅读 README。模型文本、工具名、工具结果与状态显示在会话中。只有你发送任务才会调用模型；本次没有代你发起收费请求。
4. 工具请求需要批准的写入时，界面显示工具名、目标路径与内容预览，由你点击批准或拒绝。界面不会自动批准。
5. 可取消当前运行，新建或切换会话，查看用量，以及导出 Markdown。导出成功后显示实际本地路径。

会话按 `gpui` 路线隔离；设置与 Keychain 凭据由共享运行时统一维护，其他路线修改设置也会影响下一次运行时读取。持久化格式、工具权限与模型处理属于共享运行时，见 [JSONL 协议](../shared/runtime/PROTOCOL.md)。本示例只是该协议的一个 GPUI 客户端，UI 不直接执行模型返回的任意命令。

真实输入框由 GPUI 的 `EntityInputHandler` 驱动，不是用粘贴板弹窗替代输入。支持点击定位、选择、退格/删除、方向键、常用剪贴板操作与 IME 协议；密码字段禁用复制/剪切，并向输入法的文本查询返回遮罩。当前输入框是单行，粘贴/放入转录时将换行合并为空格；尚未实现完整编辑器的撤销/重做、多行任务编辑、Tab 导航或生产级可访问性，中文输入行为也尚未实际操作验证。

## Apple Speech 与本地 Whisper

在设置中选择后端并保存。语音使用**运行时已确认的设置**，不会使用尚未保存的表单草稿。

- **Apple Speech**：默认 `zh-CN`，要求设备端识别。设备、语言、模型和授权不满足时显示错误，不静默回退网络。
- **Whisper**：填写已有 `whisper-cli` 和模型文件的绝对路径。示例不会安装 CLI 或下载模型，需由你准备与 helper 支持的 whisper.cpp CLI 相兼容的文件。
- 底部音频文件字段留空时使用麦克风；填写路径时使用文件识别。只有你启动语音才会调用 helper，系统可能按后端与输入方式请求相应权限。
- “结束录音并转写”发送 `stop`，保留子进程并等待识别完成。**Whisper 转写没有 2.5 秒强杀**；耗时推理可以继续等待，或用“取消语音”明确中断。
- “取消语音”发送 `cancel`。关闭宿主时关闭管道，helper 根据 EOF 中止；连接回收另有进程退出兜底，和正常 `stop` 后等待转写是两条不同路径。
- 转录显示后，点击“转录放入任务”才会写入任务草稿；不会自动发送给模型。你可以先修改文本再发送。

本次没有真实开麦、系统授权、文件转写或本地模型推理，因此不声称某种语言、设备或 Whisper 模型已经成功识别。父应用与 helper 的权限说明都已打包；用途声明不会自动授予权限。

## 保留的渲染与更新实验

进入“渲染 / 更新实验”可操作：

- 载入 1,000 / 10,000 条历史，共用 `../shared/fixtures/events.json`。
- 全部 / 仅工具过滤。
- 每 50 ms 追加一条固定事件，每轮最多 200 条，随时停止，总历史上限 10,200。
- `uniform_list` 只为可见范围创建固定 32 px 行，没有一次性创建一万个行元素。
- 更新 JSON、schema、SemVer、说明和 HTTPS URL 校验，然后展示结果，不下载或安装。

模拟流不调用模型。切回 Agent 页面会停止模拟回放；已经运行的真实任务仍由本地运行时维护。

`YUUKI_UPDATE_FIXTURE=available|current|invalid` 分别固定选择 `update.json`、`update-current.json`、`update-invalid.json`，未知值拒绝，不接受任意路径。默认 available。退出旧实例后，可以用下列方式启动另一种清单场景：

```bash
YUUKI_UPDATE_FIXTURE=invalid 'build/Yuuki GPUI.app/Contents/MacOS/yuuki-gpui'
```

## 这条路线的优点与需要承担的工作

| 观察点 | 当前实现 | 收益 | 代价与边界 |
|---|---|---|---|
| 绘制与状态 | Rust `Render` / `Entity` / `Context` → GPUI → Metal | 绘制与更新路径直接，没有 DOM 或 JS UI 桥 | 必须理解所有权、任务生命周期与通知；主线程上的重活仍会卡住界面 |
| 输入 | 依据 GPUI 发布版示例实现文本系统协议、选择与绘制 | 亲手掌握输入如何成为文本与光标 | 单个可编辑输入框就涉及 UTF-8/UTF-16、字形位置、组合文本与焦点，不能只“画一个框” |
| 历史回放 | `uniform_list` + 可见索引 | 限制可见区域的布局工作 | 固定行高、单行截断；容量满后 `Vec::remove(0)` 与重新筛选仍是 O(n) |
| 真实会话 | 普通可滚动多行消息与工具记录 | 内容完整，审批和状态逻辑便于阅读 | 当前会话视图没有大历史虚拟化、Markdown 缓存或高亮；不能把回放列表的实现直接当成长会话性能证据 |
| 进程边界 | Rust stdin/stdout JSONL，两个 Swift helper | 核心运行与平台能力可以独立于 UI | 需要进程协议、错误状态、退出清理、bundle 与权限管理 |
| 流式事件 | 阻塞 I/O 在后台线程，有界通道到 GPUI async task | 等待事件时不轮询；UI 更新在 GPUI 上下文中进行 | 每行上限 2 MiB、入站 32 事件、出站 8 命令；这些容量需在真实负载下再评估 |
| API Key | 临时遮罩输入 → 运行时 → Keychain | 不把密钥作为参数或明文文件保存 | 密钥仍会短暂存在输入和管道内存中；这不是硬件安全输入或内存清零保证 |
| 软件更新 | 固定清单校验与呈现 | 理解“发现更新”的最小路径 | 尚未接入 Sparkle、发布源信任、包签名、下载、替换和失败恢复 |
| Apple 移动端 | 本项目仅提供 macOS 窗口 | 可直接学习 Rust 与自绘 UI | 不提供 iOS/iPadOS GPUI UI、触控与生命周期实现，不能承诺 UI 直接复用 |

运行时与语音使用事件驱动接收；空闲不会每 50 ms 轮询 helper。50 ms timer 只属于明确启动的渲染回放。这是当前代码的调度结构，不是已经测得的低能耗结论。

## 没有完整 Xcode，为什么仍能构建

本机没有 `xcrun metal`，因此固定发布版 GPUI 0.2.2 并开启 `runtime_shaders`。构建时拼接 Metal shader 与生成头文件，运行时调用 Metal `new_library_with_source`。它绕过构建阶段缺失的编译工具，仍使用真正的 Metal 渲染。

代价是把着色器编译移到运行期；启动影响尚未测量。获得完整 Metal 工具链后，可以移除该 feature 生成预编译 metallib，再做受控比较。

**Zed 当前主分支 API 与 crates.io GPUI 0.2.2 不同，即使版本文本看起来相同。** 本项目使用发布版 `Application::new()`，没有引用本地 Zed workspace。最初版本的锁文件有 607 个包记录，新增输入/异步通道依赖后以当前 `Cargo.lock` 为准；记录包含其他平台依赖，不等于本机全部编译数量。

## 阅读入口

- `src/main.rs`：两种页面与原有虚拟回放列表。
- `src/workbench.rs`：任务、会话、设置、审批、语音和协议事件如何改变界面。
- `src/process.rs`：有界 JSONL、后台读写线程、EOF 与进程回收。无效协议行不会原样输出，避免意外显示敏感内容。
- `src/input.rs`：改自 GPUI 0.2.2 官方 input 示例，增加外部读写、遮罩、选择边界与横向光标可见处理；保留来源和 [Apache 2.0 许可](LICENSE-GPUI-APACHE)。
- `src/model.rs`：固定事件与更新清单校验。
- `build.sh` / `Info.plist`：从 Rust 二进制到包含两个 helper 的 `.app`。

先追踪一次任务点击，再追踪一条 `delta`，最后阅读一次语音 `stop` 为什么没有立刻释放子进程。这三条路径直接展示 GPUI 状态模型与系统集成的成本。

## 本次证据范围

本机 Rust 1.93.0 + Command Line Tools 构建成立，没有升级 Rust 或安装完整 Xcode。旧回放版本的 dev 构建日志为 33.15 秒；新增工作台的首次 `cargo build` 成功，日志为 7.39 秒，属于已有依赖缓存下的增量构建，不是可比较的性能基准。

按用户要求不运行测试、computer-use、收费 API、录音、文件识别或模型下载。此前已有的 `model.rs` 边界测试保留但未运行。没有声称帧率、内存、语音识别率或实际模型任务成功。

## 一手资料

- [GPUI 0.2.2 发布包](https://crates.io/crates/gpui/0.2.2)
- [发布版 input 示例](https://docs.rs/crate/gpui/0.2.2/source/examples/input.rs)
- [发布版 uniform_list 示例](https://docs.rs/crate/gpui/0.2.2/source/examples/uniform_list.rs)
- [build.rs：runtime_shaders](https://docs.rs/crate/gpui/0.2.2/source/build.rs)
- [Metal renderer](https://docs.rs/crate/gpui/0.2.2/source/src/platform/mac/metal_renderer.rs)
