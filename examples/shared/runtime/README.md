# 小型 Agent Harness：DeepSeek + 工作区工具 + 会话

这是五条 UI 路线共用的 Swift 原生运行时。应用以子进程启动它，通过 JSONL 发送命令、接收状态和文本增量。模型调用、工具执行与存储都在运行时里，UI 不直接访问 API key，也不根据显示文字猜测工具状态。

## 你现在可以使用的闭环

1. 打开任意路线的应用，进入设置，填写 DeepSeek API key，保存到 macOS Keychain。
2. 默认 API base 为 `https://api.deepseek.com`，模型为 `deepseek-flash`。模型名可以改；默认关闭 thinking，输出上限 2048 tokens，每次任务最多 4 次模型请求。
3. 不填工作区也可聊天。填写一个已存在的绝对目录后，启用列目录、读文本和经确认创建笔记的工具。
4. 新建或选择会话，输入任务。UI 展示流式回答、工具结果、用量和结束状态；可以取消。
5. 模型请求 `write_note` 时，UI 展示目标路径与内容，只有你允许后才创建；拒绝、超时或取消都不写入。
6. 会话自动保存，可导出 Markdown。语音转写先由你放入任务草稿，再主动发送。

建议用单独的练习目录开始，例如放入两份普通 `.txt`/`.md` 后输入：

```text
列出这个目录的文件，读取其中的 README.md，概括内容。
如果需要保存总结，请先提出新建 summary.md 的请求，让我确认。
```

工作区工具读取的文本会作为工具结果发给你配置的模型 API；语音音频不会随聊天请求发送，只有你主动提交的转写文字成为任务内容。

## 配置与费用

| 字段 | 默认 / 范围 | 含义 |
|---|---|---|
| `apiBase` | `https://api.deepseek.com` | HTTPS base；运行时添加 `/chat/completions`；不跟随 HTTP 重定向 |
| `model` | `deepseek-flash` | 可编辑，按 DeepSeek 当前账户可用模型填写 |
| `maxOutputTokens` | 2048；128–16384 | 每次模型请求的输出上限 |
| `maxRounds` | 4；1–12 | 一次任务的模型调用次数上限，含工具后的继续回答 |
| `workspace` | 空 | 空表示禁用工具；非空必须是现有绝对目录 |
| `speechBackend` | `apple` | `apple` 或 `whisper`，由 UI 交给语音 helper |
| `whisperCLI` / `whisperModel` | 空 | 下载模型和 CLI 后再填绝对路径 |

默认模型名与 `thinking: {type: disabled}` 根据 2026-09-26 的官方接口文档核实，未沿用旧教程中的固定别名。接口和模型可能更新，配置保留可编辑。[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion)、[Thinking 模式](https://api-docs.deepseek.com/guides/thinking_mode)

API key 只通过 stdin 传入运行时写入 Keychain，不通过命令行参数、设置 JSON 或事件回显。`DEEPSEEK_API_KEY` 若由你在启动环境显式设置，会优先于 Keychain；删除 Keychain 项不会清除外部环境变量。不同本地 ad-hoc 签名应用第一次访问钥匙串时，系统可能要求你确认访问。

费用展示采用供应商实际返回的 token 用量，不硬编码价格或推算账户余额。`unreportedRequests` 表示未拿到完整用量的请求，不能把它们视为零费用。网络失败、429 或中断不自动重试，避免无意重复付费。轮数与 token 上限也不能直接保证某个金额；价格请以 [DeepSeek 官方定价](https://api-docs.deepseek.com/quick_start/pricing) 为准。

## 工具的边界

| 工具 | 实现 |
|---|---|
| `list_files` | 工作区相对目录的直接子项，输出最多 100 个，明确是否截断 |
| `read_file` | 普通 UTF-8 文件，最多 32 KiB；拒绝隐藏/常见凭据路径、工作区外路径和越界符号链接 |
| `write_note` | 只新建 `.md` / `.txt`，最多 16 KiB；展示完整内容并等待允许；独占创建，已有文件不会覆盖 |

没有通用 shell、文件删除、任意修改或递归遍历。路径校验与权限策略是本例的应用层约束，不是操作系统沙箱，也不是覆盖所有秘密格式的数据防泄漏系统。只有在你选择的工作区内调用这些固定能力。

工具参数即使来自模型仍逐项校验；未知工具、无效 JSON 或文件错误作为结构化工具结果回传，让模型可以解释或修正。写入等待最多 180 秒，超时按拒绝处理。写入失败可能留下部分新文件时会明确提示，不把它伪装为成功或擅自删除。

## 取消、结束原因与恢复

- 一条路线同一时间只运行一个任务；运行时不允许切会话或改设置。取消与审批保持可用。
- SSE 解析会拼装分片的工具名称/参数与文本；文本约每 50 ms 合并发送一次 UI 增量，结束时补齐余量。
- 完整响应需要模型结束原因与 `[DONE]`。`length`、流中断、HTTP 错误、资源限制不会被标为正常完成。
- 取消会结束 URLSession 请求，并唤醒等待中的审批；已经完成的工具副作用保留记录。
- 开始任务、工具意图、工具结果和结束状态落盘；每个 token 不写盘。崩溃可能丢失当前正在生成的一小段回答。
- 中断的工具调用补为“结果未知，不自动重放”，新任务不会自动继续上次执行。写入发生后到结果落盘前崩溃，仍需要人检查文件。
- stdin EOF / SIGTERM 视为宿主退出，取消并保存中断状态，运行时退出；不承诺关闭 App 后后台继续工作。
- 每路线有文件锁，避免两个相同路线的运行时同时写同一份会话。五条不同路线可以各自使用，但性能比较仍应逐个采样。

## 存储与共享范围

```text
~/Library/Application Support/YuukiBoxLab/
  settings.json                 # 五路线共享；无 API key
  swift/sessions.json           # 各路线隔离的会话和供应商上下文
  gpui/sessions.json
  react-native/sessions.json
  webview/sessions.json
  electron/sessions.json
  <route>/runtime.lock
  <route>/exports/<session>-<time>.md
```

这是一份可读的本地实验存储，采用原子 JSON 写入，目录/文件设置为当前用户权限。没有引入 SQLite、数据库迁移或云同步。配置共享，以最后一次保存为准；另一个已打开窗口可以重新 bootstrap/重新打开应用读取新设置。会话和模型上下文是本地明文，应按普通本地工作资料管理。

最多 30 个会话；单任务请求/输出/工具数量、JSONL 行、会话上下文也有限制。达到上限会提示导出并新建，而非静默裁剪关键工具关系。当前没有自动摘要或会话删除 UI；需要时可退出应用、备份再整理会话文件。

## 代码如何读

入口是 [Sources/main.swift](Sources/main.swift)：

1. `command`：接收 UI 意图与拒绝不合适的状态转换。
2. `run`：模型回答 → 工具调用 → 执行结果 → 再次请求，直到结束或限额。
3. `completion`：请求 DeepSeek、解析 SSE、合并工具调用、收集用量。
4. `tool` / `workspacePath`：固定工具、目录边界与写入审批。
5. `saveSessions` / `repaired`：持久化与不盲目重放的恢复规则。
6. `Credential`：系统 Keychain；`state`：只向 UI 暴露是否存在凭据。

协议见 [PROTOCOL.md](PROTOCOL.md)。运行时当前不依赖 UI 框架，可以继续做 Swift core 拆分或 Rust 运行时对照，但五个示例先共用一份逻辑，便于理解和比较界面集成成本。

构建：

```bash
bash examples/shared/runtime/build.sh
```

单独运行协议程序的形式为 `agent-runtime serve --route swift` 等。日常使用通过各应用更方便，不需要在终端手写含密钥的命令。本轮只编译，没有启动运行时、读写用户 Keychain、使用密钥、付费请求或执行工作区工具。

## 尚未完成的生产能力

真实 DeepSeek 端到端调用、权限体验、并发竞态、断电恢复和工具边界尚未进行测试。SQLite 事务、跨设备身份、后台常驻、完整 OS 沙箱、广泛的文件编辑/shell、模型自动摘要和正式分发更新没有实现。应用已经包含这些基础能力的实际代码与调用路径，但本次构建不能替代运行验收。
