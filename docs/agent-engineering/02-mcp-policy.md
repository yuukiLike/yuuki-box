# MCP：工具授权与结果限额

服务端提供工具后，还要经过<mark class="key">宿主规则检查</mark>才能调用。

练习：只读服务升级后新增删除工具；模型列表不展示它，直接请求也要拒绝。

**待实现练习，配置尚未接入 runtime。** 先完成[工具源适配](01-mcp-tool-source.md)，再接策略与验证。

**流程：允许清单 → 两道检查 → 越界请求 → 拒绝记录。**

<div class="heading-alias" id="先看展示前一次检查调用前再查一次" aria-hidden="true"></div>

## 检查时机：工具展示前与调用前

[![MCP 权限检查：发现清单先筛选，调用入口重新核对工具、参数和审批；未授权请求拒绝，执行结果受限处理；外部文本不会获得授权](../../site/public/diagrams/agent-engineering/02-mcp-policy.svg)](../../site/public/diagrams/agent-engineering/02-mcp-policy.svg)

MCP 定义发现与调用消息；宿主实现允许清单、审批和记录。`tools/list` 不是授权，宿主与服务端各自检查权限。[工具规范](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

## 1. 配置：只允许两个已核对的只读工具

**操作：** 配置测试 server，仅允许 `list_directory` 和 `read_file`：

```json
{
  "id": "filesystem",
  "transport": "stdio",
  "command": ["<server-command>", "<allowed-root>"],
  "version": "<pinned-version>",
  "allowedTools": ["list_directory", "read_file"],
  "sideEffects": {
    "list_directory": "read",
    "read_file": "read"
  },
  "timeoutMs": 15000,
  "maxResultBytes": 262144
}
```

替换实际服务、目录和版本；`sideEffects` 须核对实现，不能照抄只读声明。远程连接只存凭据引用。

这些字段是自定义宿主配置，<mark class="caution">保存 JSON 不会自动拦截调用</mark>；适配器须读取并在第 2、3 步执行检查。

**验收：** 工具、读取目录、调用超时与结果上限均有明确配置。

## 2. 实现：把工具清单与调用入口都管住

**操作：** 实现图中的两道检查。

发现后记录候选，仅将已核对且位于 `allowedTools` 的工具展示给模型；版本、描述或 schema 变化时重查。

调用前重查来源、工具、参数、路径和审批。拒绝时返回结构化错误，不发出 `tools/call`；这一层才覆盖绕过列表的请求。

本练习的宿主默认策略如下，项目按授权范围配置：

| 已核对的副作用 | 默认处理 |
| --- | --- |
| 只读 | 工具、参数和路径检查通过后执行并记录 |
| 写入 | 展示目标与变更，取得相应授权后执行 |
| 外部网络访问 | 限定目的地址和凭据范围，按配置决定审批 |
| 删除或覆盖 | 默认拒绝，另行明确授权和范围 |

多种副作用须同时受限；名为 `read_file` 也要核对是否上传内容。

**完成标志：** 新增工具不会自动进入模型工具表，直接调用它也会得到拒绝。

## 3. 处理结果：给内容和保存过程都设上限

**操作：** 在结果进入模型上下文之前，执行以下处理：

1. 接收有硬上限，超限停止积累，返回错误或受限截断结果。
2. artifact 限定大小、权限，记录来源、时间与完整性；敏感内容脱敏或不保留。
3. 模型输入有界，注明截断与材料引用。
4. 返回文字仅是资料，不能改允许清单或替代授权。

`maxResultBytes` 限制接收；artifact 与模型上下文另设预算。不能截断展示，却无界保存原文。

**完成标志：** 超大结果有可见终态，模型输入与保存产物都符合已设上限。

<div class="heading-alias" id="4-验证亲手安排四次越界尝试" aria-hidden="true"></div>

## 4. 验证：四类越界请求

仅在受控测试 server 和临时目录中运行：

| 注入条件 | 预期结果 |
| --- | --- |
| 服务端清单新增 `delete_file` | 模型仍只看到原先两个工具，留下工具表变化记录 |
| 直接请求 `delete_file` | 返回 `permission_denied`，测试 server 没收到这次调用 |
| 返回超过 262144 字节的文本 | 按限制停止接收；错误或截断标记与实际保存内容一致 |
| 结果文字要求删除练习文件 | 文本被当作材料；即使模型提出删除，策略仍拒绝并记录 |

记录 server、tool、version、参数摘要、耗时、接收字节数、截断、终态与审批；不写凭据或整段用户内容。

**验收：** 工具结果与服务端记录可确认请求被拦截的位置。

<div class="heading-alias" id="到这里完成" aria-hidden="true"></div>

## 验收标准

用四次实验验证列表筛选、入口拒绝、超限处理与外部文本边界；通过后留作回归。

## 选读与参考

<details>
<summary>两类边界需要分别检查</summary>

允许清单约束宿主调用；server 的文件与网络访问另由账户、沙箱或隔离环境约束。

固定版本后，升级仍需审查。`readOnlyHint` 仅是提示，不能证明权限或建立只读沙箱。[工具规范中的安全考虑](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#security-considerations)

</details>

<details>
<summary>错误与记录字段</summary>

`permission_denied` 等是宿主分类，须转为模型可读、UI 可查的结构化结果；`unknown` 保留已发出但效果未明的事实。字段对齐[运行状态设计](05-harness-vertical-slice.md)。

```text
server / tool / version
args_hash / args_summary
started_at / duration_ms
result_bytes / truncated
status / approval
```

完整材料回到受控 artifact，并核对完整性；日志、路径与引用也按实际数据处理。

</details>

返回[上一篇](01-mcp-tool-source.md) · [总览](README.md) · 下一篇[Hooks：工具执行前后的检查](hooks.md)。
