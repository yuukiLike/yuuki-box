# 五条 Agent 工作台路线：收益、代价与观察方式

日期：2026-09-26。五个应用已经接入相同的 Swift Agent runtime 与 Apple/Whisper helper；最新整套 `.app` 已完成顺序构建、打包与本地签名。没有运行界面、模型 API、语音或性能测试，因此不提供“最快”“最低内存”或识别成功率排名。

新增的[十五个 Harness 场景实验](../docs/learning/harness-scenario-lab.md)把下述成本落实成可切换的朴素/优化路径。场景包含真实执行计数、可编辑探针、停止/清理及代价说明，分别位于五个应用的「场景实验」。实验与原 Agent/回放实现分离：局部场景的优化不意味着原 Agent 页已经完成同样优化。

## 1. 相同业务，五种真实 UI

| 路线 | 界面更新 | Agent 能力路径 | 源码已能说明的代价 |
|---|---|---|---|
| Swift 原生 | SwiftUI 状态 + AppKit 窗口 | Swift 客户端 → Swift runtime | 系统控件与语言一致；仍需控制主线程工作、状态更新和子进程 |
| Rust + GPUI | Rust Entity / Render → GPUI / Metal | Rust JSONL 客户端 → Swift runtime | 自绘与生命周期控制明确；需要维护原生能力桥、文本输入与自绘交互 |
| React → AppKit | Node React reconciler → 完整 JSON 树 → Swift 控件 | Node → Swift host → runtime | 组件、协议、原生控件、反向事件和多个运行时都需维护 |
| React + WKWebView | ReactDOM → 系统 WebKit | script message → Swift host → runtime | Web UI 可复用，运行时没有 Node；仍有 WebKit 进程、宿主桥与系统版本差异 |
| Electron | ReactDOM → 随包 Chromium | preload IPC → Node main → runtime | 浏览器版本固定；同时承担引擎、Node、多进程和分发成本 |

各路线都拥有任务发送/取消、会话创建/选择、流式助手/工具消息、写入审批、设置和导出。它们共享 Harness 的模型循环、工具策略、Keychain 与持久化，避免把五套 Agent 实现差异误归因于 UI。它们也不复刻 Zed、Raycast 或 Warp 的完整产品。

这次可以比较 Rust/GPUI 的界面与集成成本，不能把结果称为 Rust Harness 对 Swift Harness 的比较。共同架构见 [AI 与语音基础](../docs/architecture/ai-and-speech-foundation.md)，运行语义见 [runtime](shared/runtime/README.md)。

## 2. 共享 Harness 解决了什么，又增加什么

runtime 使用 DeepSeek Chat Completions / SSE，默认 `deepseek-flash`、关闭 thinking。模型名、API Base、输出与轮数限制可配置。列目录和读取文本受工作区限制，新建笔记需要显式允许且不覆盖已有文件；没有通用 shell。

分离 runtime 让 UI 不必自己解释工具调用和写盘，也让取消、审批、用量与中断恢复有同一实现。但每个客户端仍需要处理启动、JSONL 分片、错误、断开和状态恢复。进程隔离不会自动带来操作系统沙箱；用户也仍需选择合适的工作目录与可信 API 服务。

凭据只由 runtime 保存 Keychain，事件只回传 `hasAPIKey`。React 原生桥用原生密码框直达 runtime；WebView/Electron 的未受控 password 字段在提交后清空，不进 React state/storage，但输入期间仍在 Web 内容进程内。不能把这两种凭据路径写成完全相同。

会话按路线隔离，设置与凭据共享。关闭 App 会取消运行，并不承诺后台继续；重新打开不自动重放中断工具。真实网络、竞态、权限与恢复行为尚未实测。

## 3. 将真实任务与固定回放分开观察

真实 Agent 的等待由模型服务、网络、工具、runtime 和 UI 共同造成；仅凭回复速度无法判断渲染框架。Lab/回放仍使用固定 1k/10k 历史、50ms/条、每轮 200 条的负载，不访问模型。

GPUI 用 `uniform_list`，原生桥用 `NSTableView`，WebView/Electron 用固定高度的可见行窗口。可见行复用减少控件数量，但不消除数组、筛选、复制、JSON 或文本布局成本。长期对话与固定行高回放也是不同负载；当前 ReactDOM 对话区还没有分页虚拟化。

React 原生桥的基础 Agent 路径使用完整 UI 树；隐藏回放页不传 10k 列表，但不断增长的对话仍会增加数据量。新 N1 场景专门对照完整树与真实属性 patch，N2 对照发布批次，N3 对照原生对象复用。背压保留最新快照与字段 patch 是不同优化。界面的 JSON 大小、解码/更新耗时不等于 FPS 或端到端输入延迟。

WKWebView 和 Electron 共享 `workbench-view.jsx`，但桥和 Lab timer 不同：WK 回放 timer 在 Web 内容进程，Electron 在 Node main 生成事件再逐条 IPC；原生桥通过 Node 的 UI 树回到 AppKit。不能因为共用 JSX 就假定成本相同。

后续受控测量应统一 release/优化构建、窗口字体、行高、可见文本、缓冲行和操作轨迹。GPUI 当前默认 dev/debug，不能直接和 Swift `-O` 排名。系统 WebKit/Chromium 的实际进程数也应观测，不从源码写死常数。

## 4. Rust/GPUI 和原生桥的学习价值

GPUI 0.2.2 使用发布版 API，不能直接把当前 Zed 源码中的同名接口当作相同版本的用法。本机采用 `runtime_shaders`，将部分 Metal shader 编译留到运行期；这解决当前工具链条件，启动成本尚未测量。[发布版示例](https://docs.rs/crate/gpui/0.2.2/source/examples/hello_world.rs)、[GPUI build.rs](https://docs.rs/crate/gpui/0.2.2/source/build.rs)

你会直接接触 Entity、Context、Task、notify、所有权和自绘输入。它们给状态和生命周期明确表达，也要求你学习焦点、键盘、文本与可访问性。Rust 和 GPU 不会自动修正 O(n) 数组操作或完善控件行为。

React 原生桥让 React 声明受控组件并使用真实 AppKit 控件。代价在扩展控件时尤其明显：props、wire 表示、Swift 对象、更新、反向动作与焦点都需要协调。本轮已经增加原生密码框、选择器、多行编辑与纯文本输出，但仍不是通用 UI 框架或插件平台。

React 18.3.1 与 react-reconciler 0.29.2 固定配对；升级要同时检查 host config。Node 随原生桥打包，不能把“没有浏览器”描述成“没有运行时成本”。[reconciler 说明](https://www.npmjs.com/package/react-reconciler)

## 5. 相同语音后端，比较集成而非精度

五路线调用同一个 Swift helper，后端可选 Apple Speech 或已配置的 whisper.cpp CLI。语音结果先进入转写区，显式采用后成为草稿，主动发送才调用 DeepSeek。Whisper 负责音频转文字，DeepSeek 负责基于文字与工具完成任务。

| 方式 | 实现收益 | 当前代价 |
|---|---|---|
| Apple Speech | 直接使用系统 Speech / AVFoundation，支持部分转写 | 受授权、语言与设备端模型可用性约束 |
| Whisper CLI | CLI/模型位置明确，五种客户端复用同一协议 | 每次启动 CLI、加载模型、转换/临时文件；尚无常驻模型、VAD 或连续分段 |
| 文件输入 | 跳过实时麦克风采集 | 仍需兼容格式、时长/大小边界和错误处理 |
| 麦克风输入 | 在应用内形成录音→转写→草稿路径 | TCC 身份、设备、停止与取消都需维护 |

Whisper 先录音，stop 后继续转写，宿主不能用旧的两秒期限杀死正常推理；cancel、EOF 和退出负责取消。应用不会下载 CLI/模型。Apple 默认要求设备端识别，不静默回退网络。

TCC 可能受父应用、helper、Finder/终端启动与签名身份影响。声明用途不会自动授予权限。本轮没有真实识别、模型下载或权限操作，不把早期 Apple 能力查询算成 Whisper 或整套 App 验收。细节见 [helper](shared/native/README.md)。

## 6. 软件更新仍然只是清单实验

五路线已有“读取 → 校验 → 数字版本比较 → 显示状态”，提供新版本、相同版本、无效清单。真实下载、签名校验、程序替换、重启和回滚没有实现。

Swift/AppKit 宿主可继续研究 Sparkle；GPUI 要考虑 macOS 侧桥接与应用退出协调；Electron 可研究 autoUpdater/Squirrel.Mac。它们都需要真实发布源、正确签名和至少两个可升级版本。这是未来学习范围，不表示当前已经接入。[Sparkle 文档](https://sparkle-project.org/documentation/)、[Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater)

ad-hoc 本机包不等于 Developer ID、公证或可信升级。比较实现成本时，也要把发布与升级运维纳入，而不只计算 UI 源码。

## 7. 怎样评价，而不制造总分

先分别记录架构事实、实际性能和完成同一小改动的成本。静态可见的跨语言/进程边界有意义，但 LOC、文件数和锁文件包数不能推导开发效率。系统 WebKit 的实现不在仓库里，Electron 随包交付引擎，GPUI 锁文件还可能包含其他平台依赖，共享 runtime/helper 更不能重复计作五份开发量。

可以给每条路线做同一项小改动，例如“增加任务状态与重试按钮”，记录理解、实现、调试、打包各花多少时间，以及需要触及哪些职责和协议。当前不执行这个实验，先保留可追踪的观察项：

| 记录项 | 当前证据 |
|---|---|
| 数据、UI、runtime、语音边界 | 源码可读，见各路线 README |
| 开发修改与调试体验 | 待亲自修改后记录 |
| 输入、滚动、长对话、取消的实际响应 | 未运行 |
| 启动、内存、CPU、耗电、GPU | 未测量 |
| DeepSeek 端到端、工具审批与恢复 | 未运行 |
| Apple/Whisper、TCC 和实际音频 | 未运行 |
| 最新五路线统一打包 | 已完成；build-all.sh 退出码 0，所有包包含最新 runtime/helper |

本轮遵守不运行测试、GUI、computer-use、真实 API、录音或下载的范围。已有代码与编译结果值得阅读和试用，完整交互与性能仍需后续真实证据。

返回 [examples 入口](README.md) · [runtime](shared/runtime/README.md) · [AI 与语音架构](../docs/architecture/ai-and-speech-foundation.md)。
