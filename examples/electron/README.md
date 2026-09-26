# Electron + React Agent 工作台

ReactDOM 运行在随包 Chromium 中，preload 暴露固定能力，Node 主进程管理共享 Swift Agent runtime、语音 helper 和原始回放 timer。Agent 与设置视图复用 WKWebView 的 React 组件，运行架构仍是 Electron。

## 构建与打开

```bash
bash examples/electron/build.sh
```

脚本构建共享 runtime/helper、安装锁定依赖、生成 renderer，再打包 `build/YuukiElectron-<时间>.app`。最新路径在 `build/latest-path.txt`；从 Finder 打开该包。每次产生新包，避免覆盖正在使用的签名包。开发时 `pnpm start` 要先有 dist、runtime 和 helper，且开发 Electron.app 的权限归属可能不同。

工作台配置和操作见[共同说明](../shared/web/README.md)：会话创建/选择、任务与取消、流式聊天和工具结果、审批允许/拒绝、模型与 Keychain 设置、Markdown 导出、Apple/Whisper 语音、识别结果显式转为草稿。不会自动发送语音文字。

## 进程与权限路径

```text
ReactDOM renderer
  → contextBridge / preload IPC
  → Electron main
  → bundled AgentRuntime (serve --route electron)
  → state / delta / error / export → main → renderer

语音：main → NativeCapabilities → Apple Speech / Whisper CLI
回放：main timer → 每个事件 IPC → React 虚拟列表
```

renderer 禁用 Node，启用 contextIsolation、sandbox 和 CSP；主进程检查 sender、mainFrame 与本地页面 URL。`agent-command` 只允许冻结协议中的 op，校验字段、类型与体积。没有通用 shell IPC。模型调用、工作区工具约束、会话落盘与 Keychain 都由 runtime 负责。

密码使用未受控 `type=password` 字段，仅在提交时经过 IPC，提交后清空，不放入 React state、localStorage、日志或会话。输入期间仍位于 renderer 内存。runtime 返回 `hasAPIKey`，不回传明文；语音子进程不继承 `DEEPSEEK_API_KEY`。

Whisper 设置来自 runtime 确认的配置，不能通过一次 speech IPC 任意替换参数。用户可明确配置已有 CLI/模型路径与选择文件；不安装下载。stop 结束录音后等待本地推理，cancel/关闭应用终止识别，未沿用旧版 2.5 秒硬杀。

## 优点与代价

| 收益 | 对应代价 |
|---|---|
| 与 WKWebView 共用 ReactDOM 工作台 | 仍须单独维护 Electron main/preload、协议与生命周期 |
| Node 容易管理 runtime/helper | 必须处理子进程、EOF、错误、关闭和 IPC 调用者校验 |
| 随包固定 Chromium 版本 | 包体积、内存、GPU/utility 进程与引擎升级责任也随包交付 |
| 相同 Agent 后端使能力更可对照 | 不能把模型网络延迟或共享 helper 的识别能力归给 Electron UI |

共享组件构建时把 React/ReactDOM 显式指向 Electron 的单一安装，避免两套 React 导致 hooks 分裂。相应代码在 `build.mjs`。主进程 runtime 客户端见 `runtime-client.cjs`，能力暴露见 `preload.cjs`。

对话使用完整纯文本消息；长期聊天还没有分页虚拟化。原回放页保留 54px 行高虚拟列表、1k/10k 历史、50ms/条、单次 200 条、上限 10,200，计时发生在 Electron main，不能被误写为 WebView 的本地 JS timer。离开回放页会停止其回放。

## 新增：三个 Harness 场景实验

进入「场景实验」，选择朴素 / 优化、规模，点击运行。所有输入都在本地生成，不需要 API Key、网络、麦克风或工作目录。切换场景或实现会清理旧任务；两种实现的相同规模结果保留在对照表。先从最小规模开始，再自行放大。

| 场景 | 朴素路径 | 优化路径 | 规模与实际指标 |
|---|---|---|---|
| E1 多工具 IPC | 一条事件一条 IPC、一次状态发布 | 每 200 条打包，一次发布 | 2k / 10k / 30k 事件；发送数据消息数、JSON UTF-8 字节、收到的条数/指纹、状态发布次数、耗时 |
| E2 工具产物索引 | main 同步生成、JSON 解析、归一化、去重、排序和摘要 | `worker_threads` 执行完全相同函数，只回传摘要 | 20k / 80k / 200k 条；产物字节、词项数量、指纹、计算耗时、含启动的总耗时、控制 IPC RTT |
| E3 长卡片时间线 | 全历史 React/DOM，滚动时全量协调 | 固定 112px 行高，视口与缓冲区，memo 稳定卡片 | 1k / 3k / 6k 卡片；实际挂载卡片和 DOM 节点、逻辑过滤结果、首次提交耗时 |

E1 两个路径都有相同的 200 条确认窗口，确认后才继续；只展示最近 20 条，但所有事件都会累计计数和指纹，不丢 `complete` 终态。30 秒无确认报告错误并释放任务。JSON 字节不等于操作系统实际传输字节；确认 IPC 不包含在数据消息指标中，状态发布次数也不是 React commit 数。E1/E3 指纹覆盖按序排列的完整记录，以 32 位非密码学滚动计算观察变化；它仍可能碰撞，不是等价证明。这个实验不负责把全量事件持久化。

E2 的特别之处是**控制面响应**：renderer 输入可能仍然响应，发往 main 的取消却会排队。控制探针每 150ms 尝试发送一次，最多一个未完成请求；界面显示最大 RTT 和样本数。很短的任务可能没有样本。main 计算时收到的取消只能等计算结束处理，界面会报告「任务已结束」，不会假装成功取消。Worker 可终止，但它有启动成本、独立内存与生命周期责任；取消与完成都等待线程实际退出，退出中的 Worker 仍占据工作槽，新任务不会与它重叠。总耗时包含 Worker 启动和退出，计算耗时另列。两侧调用同一个 `indexArtifact`，没有额外忙等或人为 sleep；该方法符合 Electron 对 CPU 密集工作避免阻塞 main 的建议。[Electron 性能说明](https://www.electronjs.org/docs/latest/tutorial/performance)、[Node Worker API](https://nodejs.org/api/worker_threads.html)

E3 的收益来自挂载范围缩小，并不证明 Chromium 在所有负载下最快。固定高度截断、跨未挂载行的选择/查找、动态 Markdown 测量是明确代价。提交耗时从点击开始，包含生成输入和 React DOM 提交，不包含后续 GPU 绘制。最重的同步提交不能中途取消，完成后用「清空场景」卸载。所有指标都是用户实际点击后产生；本轮没有运行这些实验。

源码阅读顺序：

1. [scenes.jsx](scenes.jsx)：场景 UI、真实输入探针、计数、结果对照；`RemoteScene` 与 `Timeline`。
2. [scene-controller.cjs](scene-controller.cjs)：main 任务所有权、窗口确认、取消与 Worker 生命周期。
3. [scene-work.cjs](scene-work.cjs)：两种路径完全共用的产物索引函数；[scene-worker.cjs](scene-worker.cjs) 是 Worker 的独立入口。
   [scene-fingerprint.cjs](scene-fingerprint.cjs) 是 main 与 renderer 共同使用的完整记录指纹函数。
4. [preload.cjs](preload.cjs) 与 [main.cjs](main.cjs)：固定能力方法与原有 sender 校验。没有为实验开放 Node 或通用 IPC。
5. [build.mjs](build.mjs)：Worker 文件必须显式进入 `.app`；构建只解析 CJS 语法并编译 renderer，不执行场景。

维护练习可以从 E1 新增一种 `approval_required` 终态开始：修改事件源、接收显示与终态策略，然后沿上面路径核对，不要只给 React 加一个标签。另一个练习是把 E3 卡片展开为可变高度：它会让固定高度窗口的局限变成真实需要解决的代码问题。五条路线的对照设计见[场景实验手册](../../docs/learning/harness-scenario-lab.md)。

更新页可选 available/current/invalid，仅检查包内清单，验证 HTTPS URL 和版本，不下载安装。完整 autoUpdater、正式签名、公证、回滚和分发仍未实现；本地 ad-hoc 包不能替代这些能力。

本轮只实现和编译源码，不运行测试、computer-use、GUI、模型 API 请求、模型下载或语音权限。最终总构建结果见[examples 入口](../README.md)，尚无网络兼容性、真实会话、TCC、性能或 Whisper 推理实测。
