# MCP：外部工具接入 Harness

把外部工具接入运行流程，让<mark class="key">成功、拒绝和断连都有记录</mark>。

**实现练习，尚未接入 runtime。** [shared/runtime](../../examples/shared/runtime/README.md) 已有 `list_files`、`read_file`、`write_note`；下文 MCP `ToolSource`、状态和图均待实现。

**定位入口 → 接只读工具源 → 读取 → 中途断连。** 前置为[Harness 入门](../ai-from-scaling/03-build-a-harness.md)中的工具校验、审批与取消；先接只读调用，再按[运行状态与恢复](05-harness-vertical-slice.md)补持久化与故障恢复。连接过程不熟时，选读[客户端实验](../ai-from-scaling/00-minimal-mcp.md)。

<div class="heading-alias" id="先看正常返回与中途断连" aria-hidden="true"></div>

## 正常返回与中途断连

[![待实现的 Harness 接入流程：模型提出请求，Harness 检查和记录，再经 MCP 调用外部服务；正常结果有界返回，已发出的请求断连时记录未知并停止自动重放](../../site/public/diagrams/agent-engineering/01-mcp-tool-source.svg)](../../site/public/diagrams/agent-engineering/01-mcp-tool-source.svg)

`proposed`、`ready`、`unknown` 是本练习的内部状态。MCP 提供发现与调用协议，宿主负责策略、审批、记录和恢复。

客户端发请求，服务读文件，Harness 检查权限并保存记录。`ToolSource` 是自定义适配接口；审批与恢复由宿主实现。

## 1. 定位：先找到现有工具执行入口

**操作：** 对照 [Sources/main.swift](../../examples/shared/runtime/Sources/main.swift) 与 [runtime 说明](../../examples/shared/runtime/README.md#代码如何读)，定位 `run`、`tool`、`workspacePath` 和 `saveSessions`。

找出工具选择、工作区检查、意图与结果保存的位置；外部调用也必须经过它们。

`saveSessions` 保存宿主会话与执行状态；MCP Markdown、Blender 模型、GitHub 实验目录由各服务保存。恢复会话不会撤销远端结果。

**验收：** 在现有代码中定位外部调用接入点。

## 2. 实现：把发现和调用包成一个工具源

先提供发现与调用接口；`SideEffect`、`ToolResult` 对齐运行时类型：

```swift
struct ToolDescriptor: Sendable {
    let name: String
    let description: String
    let inputSchema: Data
    let sideEffect: SideEffect
}

protocol ToolSource: Sendable {
    var id: String { get }
    func discover() async throws -> [ToolDescriptor]
    func call(_ tool: String, arguments: Data) async throws -> ToolResult
}
```

**操作：** 准备本地 filesystem 测试 server，再实现适配器。首版只提供 `list_directory`、`read_file`，读取临时目录并返回文本；仓库尚无该服务。

对照[极简客户端](../../examples/minimal-mcp/src/client.ts)适配连接、发现、调用与关闭。`discover()` 对应 `tools/list`，`call()` 对应 `tools/call`；SDK 用 `server/discover` 查询版本与能力。

展示工具时加来源，如 `mcp.filesystem.read_file`，按[允许清单](02-mcp-policy.md)筛选。发送请求前，还原为服务 `filesystem` 与原名 `read_file`；前缀只是宿主约定。

**完成标志：** 适配器能发现两个工具，且一次调用能映射回正确的 server 和原始工具名。

## 3. 串起：让一次读取留下完整记录

让运行时完成这个任务：

```text
列出练习目录，读取其中的 README.md，然后概括内容。
```

**操作：** 实现参数与权限检查 → 保存执行意图 → 发出调用 → 检查结果 → 保存回执 → 将有界内容交回模型。

记录来源、工具名、参数摘要、开始时间、耗时、结果字节数与终态；摘要不含凭据原文。

**完成标志：** 返回预期内容，输出能追溯到对应调用。

<div class="heading-alias" id="4-故障练习在三个位置打断它" aria-hidden="true"></div>

## 4. 故障验证：三个中断位置

仅在受控测试 server 上运行以下实验，先记录预期：

| 注入条件 | 预期结果 |
| --- | --- |
| 绕过展示清单，直接请求未授权工具 | 调用入口返回 `permission_denied`，不向 server 发出调用 |
| 请求已发出，收到结果前终止测试 server | 记录断连；无法确认执行效果时标为 `unknown`，Run 进入 `interrupted` |
| 返回超过配置上限的文本 | 接收有硬上限；返回明确错误或有界内容与截断标记，模型上下文不接收整份超大文本 |

未发出的请求可记失败；<mark class="caution">已发出却无结果时保留未知</mark>。重启后先核对外部状态，再决定动作。

取消本地等待时，服务端可能已完成操作。stdio 用 `notifications/cancelled` 通知，迟到响应按已终止请求处理；通知不能撤回副作用。2026-07-28 Streamable HTTP 通过关闭请求响应流取消，不能照搬 stdio 步骤。[取消规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)

**验收：** 记录可区分调用失败、已发出但结果未知、用户取消等待。

<div class="heading-alias" id="到这里完成" aria-hidden="true"></div>

## 验收标准

实现并测试后，交出成功、拒绝、断连各一条记录，能对应请求与终态；恢复时不自动重放未知副作用。

## 选读与参考

<details>
<summary>协议与实现细节</summary>

2026-07-28 路径为 `server/discover → tools/list → tools/call`；旧版使用 `initialize → notifications/initialized`，见[通信章节](../ai-communication/04-mcp.md)。SDK 处理发现与编码；适配器还需接好请求 ID、超时、进程退出、stderr、未知通知、取消和结果上限。[服务发现规范](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)

首版仅支持文本。图片、资源引用或未知 content 要明确返回不支持；保存的类型与原始材料须限制大小和访问。

验证外部描述与 schema 后再生成工具表；版本或定义变化要重查，同名不自动继承权限。

</details>

<details>
<summary>宿主检查与进程权限的边界</summary>

允许清单约束宿主调用；stdio server 的文件、网络权限由系统环境决定，不自动继承内建 `read_file` 的限制。

`readOnlyHint` 只是线索；准入与副作用分类须核对实现、配置。远程服务还需明确凭据、访问范围与身份。

</details>

<details>
<summary>已有代码与后续设计入口</summary>

- [runtime 协议](../../examples/shared/runtime/PROTOCOL.md)：现有 UI 与运行时的 JSONL 命令。
- [Mac 本地 Harness](../architecture/mac-local-harness.md)：Run、ToolCall、持久化与恢复的设计建议。
- [故障演练](07-scenario-regression.md)：把成功、拒绝、取消与断连做成可重复场景。

</details>

返回[总览](README.md) · 下一篇[MCP：工具授权与结果限额](02-mcp-policy.md)。
