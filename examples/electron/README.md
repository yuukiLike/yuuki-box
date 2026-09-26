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

更新页可选 available/current/invalid，仅检查包内清单，验证 HTTPS URL 和版本，不下载安装。完整 autoUpdater、正式签名、公证、回滚和分发仍未实现；本地 ad-hoc 包不能替代这些能力。

本轮只实现和编译源码，不运行测试、computer-use、GUI、模型 API 请求、模型下载或语音权限。最终总构建结果见[examples 入口](../README.md)，尚无网络兼容性、真实会话、TCC、性能或 Whisper 推理实测。
