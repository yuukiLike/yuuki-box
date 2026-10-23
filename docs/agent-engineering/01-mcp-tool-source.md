# MCP：先把外部工具接成 ToolSource

**让 MCP 只负责发现与调用工具；权限、审批、事件和恢复仍由现有 Harness 负责。** 换一个 MCP server 不应该绕过你已经写好的工作区校验和审批流程。

状态：实现建议。以下 Swift 片段只说明接口，未接入 `examples/shared/runtime`。资料核对：2026-10-23。

## 为什么不让模型直连 server

你现在的 runtime 只有 `list_files`、`read_file`、`write_note` 三个固定工具，参数逐项校验，写入需要审批，结果有大小上限。[runtime 说明](../../examples/shared/runtime/README.md)

MCP 会把工具数量、参数和返回内容交给外部进程。外部进程可能超时、崩溃、返回超大内容，或者在 tool description、resource、prompt 里夹带指令。如果模型直接连接 server，这些内容会绕过现有的参数校验、审批和事件记录。

所以 MCP client 应该是 Harness 的一个 `ToolSource`，不是第二个执行器。

## 最小接口

```swift
struct ToolDescriptor: Sendable {
    let name: String          // server 内的原始名字
    let description: String
    let inputSchema: Data
    let sideEffect: SideEffect
}

protocol ToolSource: Sendable {
    var id: String { get }    // 例如 "mcp.filesystem"
    func discover() async throws -> [ToolDescriptor]
    func call(_ tool: String, arguments: Data) async throws -> ToolResult
}
```

Harness 对外暴露的名字是 `mcp.<server>.<tool>`，例如 `mcp.filesystem.read_file`。模型看到的 schema 由 Harness 重新生成和校验，不直接把 server 的原始 JSON 透传。这样在名字冲突、schema 变化和版本升级时仍有控制点。

## 接进现有状态机

```text
用户提交任务 → 模型请求 mcp.filesystem.read_file
            → ToolCall proposed → 策略允许只读 → ready
            → 持久化执行 intent → tools/call → result
            → 原始内容写 artifact → 模型收到有界摘要 → 继续回答
```

- 只读工具可以按策略直接进入 `ready`；写入、网络或破坏性工具默认进入 `waiting_for_approval`。
- 发送 `tools/call` 前先持久化执行 intent。崩溃后才能知道“可能已经发出过”。
- 原始结果先落 artifact，模型只收摘要和引用；不要因为 server 说结果很短就跳过限额。
- 取消时发送 `notifications/cancelled` 只是 best effort。本地必须立即停止等待并记录 `cancelled`，不能假设 server 已经停止。
- 超时和连接中断不要一律标成 `failed`；无法确认副作用时使用 `unknown`，并让 Run 进入可对账的 `interrupted`。

## 最小 MCP 客户端

先用 stdio 和 JSON-RPC 2.0，只实现四步：

```text
initialize
→ notifications/initialized
→ tools/list
→ tools/call
```

需要处理：请求 id、每类请求的超时、进程退出、stderr、消息分帧、未知通知、结果大小上限。不要先引入完整 SDK 再理解协议；一个只支持文本工具的最小客户端更容易审查。

第一版只支持文本结果。遇到图片、资源引用或不认识的 content 类型时，保存原始 JSON 到 artifact，并向模型返回“暂不支持该类型”，不要猜内容。

## 第一次实验

接一个本地 stdio server，只暴露两个只读工具，例如列目录和读文本。用现有 JSONL 协议跑一次：

```text
列出工作区里的文件，读取 README.md，然后用三句话概括。
```

然后做三次故障注入：

| 注入 | 期望 |
| --- | --- |
| 调用一个未加入 allowlist 的写入工具 | ToolCall 以 `permission_denied` 结束，模型能继续回答 |
| server 在调用中途被 kill | ToolCall 落到 `failed` 或 `unknown`，Run 不丢失已有事件 |
| server 返回超过上限的内容 | 原始内容进 artifact，模型只收到截断标记和摘要 |

## 验收

- 每次调用都能查到 `server`、`tool`、参数摘要、开始时间、耗时、结果字节数和终态。
- 断连后重启不会自动重放副作用；需要人工确认的调用有明确记录。
- 工作区边界仍由 Harness 校验，不依赖 server 自觉遵守。
- 模型看到的工具表只包含 allowlist 中的工具。

## 边界

- **MCP server 不继承你的 `read_file` 限制。** 它可能读到隐藏文件、凭据或工作区外路径；Harness 侧仍要校验路径和参数。
- **tool annotations 不可信。** 除非 server 本身可信，否则“只读”“安全”这类标注只能当提示，不能当权限依据。
- **stdio server 是本机进程，不是沙箱。** 它拥有你启动它时的 OS 权限；不可信 server 应换独立用户、容器或虚拟机运行。
- **远程 server 另算信任边界。** 使用最小 scope 的凭据，固定版本，记录连接来源；不要因为走 HTTPS 就默认可信。

## 和现有代码的关系

- 工具执行与审批：[`examples/shared/runtime/Sources/main.swift`](../../examples/shared/runtime/Sources/main.swift)
- 协议与命令：[`examples/shared/runtime/PROTOCOL.md`](../../examples/shared/runtime/PROTOCOL.md)
- Run/ToolCall 状态与事件建议：[Mac 本地 Harness](../architecture/mac-local-harness.md) 第 6、7、9、10 节

返回[总览](README.md) · 下一篇[MCP：清单与默认拒绝](02-mcp-policy.md)。
