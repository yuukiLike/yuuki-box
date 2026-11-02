# AI Hooks：Claude Code、DeepSeek Harness 与 Codex

Hook（钩子）是<mark class="key">宿主在生命周期节点自动调用的程序</mark>，可在工具执行前检查、执行后记录、任务结束前核对验收。

以调用记录与演示命令拒绝比较三种实现：记录调用，拒绝含 `HOOK_DEMO_BLOCK` 的命令。

资料核对：**2026-10-31**。Claude Code、Codex 据官方文档，面向本地客户端；DeepSeek 指官方 Harness（`dsh`），固定于 [`ce7073d`](https://github.com/deepseek-ai/deepseek-harness/tree/ce7073d51254c26cd63b22a60835b8f948deb447)。示例未在本仓库启用。

<div class="heading-alias" id="先看它插在什么位置" aria-hidden="true"></div>

## 触发位置

```text
用户提交任务
  → 宿主接收输入
  → 模型决定调用工具
  → 执行前 hook：检查参数，必要时拒绝
  → 宿主按权限策略执行工具
  → 执行后 hook：观察或处理结果
  → 模型根据结果继续工作
  → 准备结束时的 hook：判断是否还要继续
```

Hook 有三个要素：

| 要素 | 含义 | 例子 |
| --- | --- | --- |
| Event：何时触发 | 生命周期节点 | `PreToolUse`：执行前 |
| Matcher：筛选调用 | 在事件内筛选 | 仅匹配 `Bash` |
| Handler：执行什么 | 脚本、服务或插件 | 读参数，返回决定 |

<mark class="caution">Matcher 匹配工具名，不检查命令内容</mark>。`Bash` 选中终端工具，handler 再查参数；各宿主的输入和输出格式不同。

<div class="heading-alias" id="第一个实验先读懂输入与输出" aria-hidden="true"></div>

## 实验一：输入与输出

Claude Code 与 Codex 的 command hook 均从 stdin 读取 JSON。最小样本如下，真实事件还含会话、目录等字段：

```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "echo HOOK_DEMO_BLOCK" }
}
```

脚本只检查待执行命令并回传决定，不执行 `echo`。[Claude 输入输出](https://code.claude.com/docs/en/hooks-guide#read-input-and-return-output) · [Codex PreToolUse](https://learn.chatgpt.com/docs/hooks#pretooluse)

<div class="heading-alias" id="写一个两家都能理解的演示脚本" aria-hidden="true"></div>

### Claude Code 与 Codex 共用脚本

用 Node.js 在练习目录创建 `hook-lab/demo-hook.mjs`，将事件、工具名和时间写到旁边的 `events.jsonl`，不记命令全文。

```js
import { appendFileSync, readFileSync } from 'node:fs';

const event = JSON.parse(readFileSync(0, 'utf8'));
appendFileSync(new URL('./events.jsonl', import.meta.url), JSON.stringify({
  at: new Date().toISOString(),
  event: event.hook_event_name,
  tool: event.tool_name,
}) + '\n');

const command = event.tool_input?.command;
const blocked = event.hook_event_name === 'PreToolUse'
  && event.tool_name === 'Bash'
  && typeof command === 'string'
  && command.includes('HOOK_DEMO_BLOCK');

const output = blocked ? {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: '演示规则：这条命令包含 HOOK_DEMO_BLOCK。',
  },
} : {};

process.stdout.write(JSON.stringify(output) + '\n');
```

`{}` 不作额外决定，继续原权限流程，并非批准；拒绝输出 `deny`。两家仅此处的 `PreToolUse` 格式兼容。

先模拟事件，不调用模型或执行其中命令：

```sh
printf '%s\n' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo HOOK_DEMO_OK"}}' | node hook-lab/demo-hook.mjs
printf '%s\n' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo HOOK_DEMO_BLOCK"}}' | node hook-lab/demo-hook.mjs
```

预期第一条输出 `{}`，第二条含 `permissionDecision: "deny"`，日志新增两条。这里只验证脚本，尚未验证客户端加载。

### Claude Code：把脚本接到 PreToolUse

将配置合并到练习项目 `.claude/settings.local.json`；保留已有设置，替换脚本绝对路径并保留两侧引号。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/absolute/path/to/hook-lab/demo-hook.mjs\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

`^Bash$` 完整匹配工具名，`timeout` 单位为秒。在 `/hooks` 确认配置被发现后发送：

> 请分别通过终端工具运行 `echo HOOK_DEMO_OK` 和 `echo HOOK_DEMO_BLOCK`。如果第二条被 hook 拒绝，就报告拒绝结果，不改写重试。

核对两条命令的工具结果、拒绝理由和新增日志；日志只证明 hook 被调用，不证明命令执行。[Claude 排查入口](https://code.claude.com/docs/en/hooks-guide#set-up-your-first-hook)

<div class="heading-alias" id="codex复用演示留意加载与信任" aria-hidden="true"></div>

### Codex：脚本复用、加载与信任

将 `hooks` 合并到练习项目 `.codex/hooks.json`，保留脚本绝对路径。信任项目 `.codex` 配置层，再在 CLI `/hooks` 核对来源并信任定义；未审核的新建或变更非托管 hook 会被跳过。[信任流程](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)

发送同样请求，核对结果与日志。Codex 将终端调用规范化为 `Bash`；多来源 hooks 合并，项目配置不覆盖用户级配置。日志重复时检查是否重复注册。[加载](https://learn.chatgpt.com/docs/hooks#where-codex-looks-for-hooks) · [覆盖范围](https://learn.chatgpt.com/docs/hooks#tool-coverage)

迁移到编辑工具时重查参数：Claude `Edit` / `Write` 用 `tool_input.file_path`；Codex 即使匹配该别名仍报告 `apply_patch`，补丁在 `tool_input.command`，不能照搬 `.file_path`。[Claude 输入](https://code.claude.com/docs/en/hooks#pretooluse) · [Codex 输入](https://learn.chatgpt.com/docs/hooks#pretooluse)

<details>
<summary>选读：职责与宿主机制对照</summary>

<div class="heading-alias" id="hookskillmcp-怎么一起用" aria-hidden="true"></div>

### Hook、Skill、MCP 的职责

| 机制 | 职责 | 文档项目示例 |
| --- | --- | --- |
| Prompt / 项目指令 | 这次任务与长期约定是什么 | “修改文档后检查链接” |
| Skill | 一类任务按什么步骤做 | 整理资料、写教程、验证、提交的流程 |
| MCP | 通过什么接口提供外部工具与资源 | 给 Agent 提供 GitHub 仓库读取工具 |
| Hook | 到哪个运行节点自动执行什么 | 工具调用前检查参数，调用后记录结果 |

它们可组合，但提示词里的“请检查”不会注册 hook。背景：[Skills](03-skills-structure.md)、[MCP 工具源](01-mcp-tool-source.md)、[Harness](../ai-from-scaling/03-build-a-harness.md)。

<div class="heading-alias" id="三家的机制先对齐" aria-hidden="true"></div>

## 宿主机制对照

| 比较项 | Claude Code | DeepSeek Harness | Codex |
| --- | --- | --- | --- |
| 谁提供机制 | Claude Code 客户端 | `dsh` 的 Cordis 插件框架 | 支持 hooks 的 Codex 客户端 |
| 常用入口 | `.claude/settings.json`；个人项目配置可用 `.claude/settings.local.json` | TypeScript 插件，通过 profile 的 patch 挂载 | `.codex/hooks.json` 或 `config.toml` 内的 `[hooks]` |
| 工具执行前 | `PreToolUse` | `tools/pre-execute` | `PreToolUse` |
| 工具执行后 | 成功：`PostToolUse`；失败：`PostToolUseFailure` | `tools/post-execute`；最终结果观察用 `tools/result` | `PostToolUse`，也覆盖已完成但退出码非零的 Bash 调用 |
| 准备结束一轮 | `Stop` | `agent/turn-stopping` | `Stop` |
| 扩展写法 | 配置 handler | `ctx.on(事件名, 函数)` | 配置 handler |

职责相近不代表事件等价；配置和字段见 [Claude reference](https://code.claude.com/docs/en/hooks)、[DeepSeek 架构](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/architecture.md)、[Codex Hooks](https://learn.chatgpt.com/docs/hooks)。

Claude Code 支持 `command`、`http`、`mcp_tool`、`prompt`、实验性 `agent`。Codex 执行 `command`、`mcp_tool`，解析到 `prompt`、`agent` 仍会跳过；同名配置不能直接迁移。[Claude 类型](https://code.claude.com/docs/en/hooks#hook-handler-fields) · [Codex 配置](https://learn.chatgpt.com/docs/hooks#config-shape)

宿主控制触发；handler 若调用模型，结果仍受模型影响。入门先用明确的程序条件。

`tools/*` 由 Harness 运行时派发，仅调用 DeepSeek 模型 API 不会运行本地插件。参见[请求装配课](../kv-cache/04-deepseek-harness.md)。

</details>

## DeepSeek Harness：同一条规则，写成插件

`dsh` hook 是 Cordis 插件：监听器接收类型化调用并返回决策，不打印 Claude / Codex JSON。[官方示例](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/cookbook/extension-cookbook.md#a-hook-plugin-permission-gate-example)

在 **DeepSeek Harness checkout** 完成[源码运行依赖](https://github.com/deepseek-ai/deepseek-harness/tree/ce7073d51254c26cd63b22a60835b8f948deb447#run-from-source)，以下命令不在 Yuuki Box 根目录执行。

创建 `scratch-plugin/src/demo-hook.ts`：

```ts
import type { Context } from '@deepseek-ai/cordis';
import type { PreToolDecision } from '@deepseek-ai/dsh-tools';

export const name = 'demo-hook';

export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    console.info('[hook-demo]', exec.name);

    const args = exec.arguments;
    const command = typeof args === 'object' && args !== null
      && 'command' in args && typeof args.command === 'string'
      ? args.command : '';

    if (exec.name === 'bash' && command.includes('HOOK_DEMO_BLOCK')) {
      return { kind: 'deny', reason: '演示规则：这条命令包含 HOOK_DEMO_BLOCK。' };
    }

    return next();
  });
}
```

注意三个变化：

- 工具名为小写 `bash`，参数为 `exec.arguments.command`。[Bash 源码](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/shell/tool-bash/src/index.ts)
- 拒绝返回 `{ kind: 'deny', reason }`；继续用 `next()`，直接返回 `allow` 会截断后续监听器。
- 该事件不能改写已记录参数。不可被后续策略放宽的最终拒绝用 `ctx.tools.guard()`，不等同普通监听。[策略与决策](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/tools.md#execution-extensible-waterfalls-plus-monotonic-policy)

**waterfall** 是串行中间件：监听器返回结果或调用 `next()`，不是同时执行、各打印 JSON。[Cordis 说明](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/cordis-primer.md#cordis-waterfall-semantics)

创建 `scratch-plugin/cordis.yml`，替换为真实的绝对路径：

```yaml
- insert:
    - id: demo-hook
      name: '/absolute/path/to/deepseek-harness/scratch-plugin/src/demo-hook.ts'
```

从 DeepSeek Harness 仓库启动：

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

在 Web UI 选模型、练习工作区，用 `bash` 运行两条演示命令；工具缺失时先查 profile。核对终端 `[hook-demo] bash` 及 UI 结果和拒绝信息。[官方挂载教程](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/user/develop/basic/index.md)

<div class="heading-alias" id="继续认识三个有用的-deepseek-事件" aria-hidden="true"></div>

### DeepSeek 补充事件

| 事件 | 适合什么 | 需要理解的边界 |
| --- | --- | --- |
| `agent/pre-step` | 在一次模型步骤进入前处理待接收消息 | 一个 turn 可能包含多个 step，不能等同于“一条用户消息” |
| `tools/execute` | 包裹工具执行过程，记录耗时或处理执行生命周期 | 它是中间件，要正确传递 `next()` 与取消信号 |
| `tools/result` | 统计最终工具成功、失败与结果 | 用于观察冻结后的结果，不在这里改写结果 |

事件顺序见 [Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/architecture.md#turn-flow)、[工具事件](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/tools.md#tools-events)。

<div class="heading-alias" id="stop-最容易读反拒绝停止就会继续工作" aria-hidden="true"></div>

## Stop：阻止停止与继续执行

两家均有 `Stop`。返回以下决定表示<mark class="caution">阻止停止，继续工作</mark>：

```json
{
  "decision": "block",
  "reason": "刚才的检查仍然失败，请处理失败项并重新验证。"
}
```

这不撤销任务，也不证明验收通过。handler 须实际读取或运行检查，模型一句“通过”不算证据。[Claude Stop](https://code.claude.com/docs/en/hooks#stop) · [Codex Stop](https://learn.chatgpt.com/docs/hooks#stop)

检查 `stop_hook_active`，限定继续次数或退出条件。Codex Stop 退出码为 0 时 stdout 须为 JSON；补救后允许停止也须如实报告失败。

先完成观察与拒绝实验，再试 Stop，便于区分触发、决策和执行结果。

<div class="heading-alias" id="可以为自己的项目做哪些事" aria-hidden="true"></div>

## 项目接入场景

以下练习**尚未接入本仓库**；先选一项，定义可观察结果。

| 想解决的问题 | 可以用的入口 | 怎么判断确实有效 |
| --- | --- | --- |
| 等待用户确认时提醒 | Claude `Notification`，筛通知类型 | 等待时通知一次，继续后不重复 |
| 新会话补项目状态 | Claude / Codex `SessionStart`；`dsh` 消息装配 | 仅注入分支、环境等可核对事实 |
| 区分模型与工具耗时 | 工具前后事件；`dsh` 包裹 `tools/execute` | 调用 ID 关联起止，分开统计等待、执行、失败 |
| 改文件后格式化 | 编辑后事件或文件监听 | 仅处理目标文件，防止自身写入循环触发 |
| 收尾发现构建失败 | `Stop` 读当前版本检查结果 | 注入坏链接或构建错误，观察失败与补救 |
| 统计外部工具失败 | Claude / Codex MCP 调用事件；`dsh` 最终结果 | 按工具统计，不记录完整私有内容 |

入口依据 [Claude 指南](https://code.claude.com/docs/en/hooks-guide)、[Codex 事件](https://learn.chatgpt.com/docs/hooks)、[DeepSeek 事件图谱](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/event-producer-consumer.md)；方案和验收是本课设计。

本站可先记工具事件，收尾运行 `pnpm --dir site check` 和 `pnpm docs:build`；无需逐字构建，检查结果须对应当前版本。

## 六个常见误解

| 误解 | 应该怎样判断 |
| --- | --- |
| “换 DeepSeek 模型就用它的 hook 配置” | 看宿主；自写 Agent 须自行实现生命周期与插件 |
| “打印禁止执行就能拦住” | 须返回事件支持的决策格式，普通 stdout 不算 |
| “非零退出码总能阻止操作” | 错误、超时、拒绝不同；两家 `PreToolUse` 用 2 拒绝，普通错误码 1 不等价 |
| “PostToolUse 拒绝后文件没写入” | 操作已发生，后置反馈不自动回滚 |
| “Edit / Write 覆盖所有写文件” | Bash、MCP 也能写；matcher 仅覆盖匹配调用 |
| “后台检查会阻止操作” | Codex 异步 command hook 不阻断、改写或审批；执行前决策用同步入口 |

规则见 [Claude 错误处理](https://code.claude.com/docs/en/hooks#hook-execution-details)、[Codex 输出](https://learn.chatgpt.com/docs/hooks#pretooluse)、[异步限制](https://learn.chatgpt.com/docs/hooks#limitations)。字符串匹配仅作演示，完整权限与沙箱须另配。

验证记录：JSON、shell 语法及 Node 的 5 个离线样本通过；DeepSeek 通过 TS 转译和 3 个模拟回调，验证拒绝与 `next()`。未做完整类型检查、真实客户端集成或启用示例。

<div class="heading-alias" id="学会了没有用三道题检查" aria-hidden="true"></div>

## 机制自测

<details class="qa">
<summary>1 · 要求 AI 修改文件后运行测试，是否构成 hook？</summary>

不是。指令或 Skill 描述要求；注册事件及处理程序后才有 hook。

</details>

<details class="qa">
<summary>2 · demo-hook 日志里出现了一条 Bash 记录，能证明命令已经运行吗？</summary>

不能。`PreToolUse` 先于执行，之后仍可能被拒绝；须查工具结果或执行后事件。

</details>

<details class="qa">
<summary>3 · DeepSeek 监听器未命中规则时，为什么返回 next() 而非 allow？</summary>

`next()` 继续后续检查；直接返回决策会截断 waterfall。最终 guard 另行约束，普通 hook 不代表全部授权。

</details>

练习后仅移除自己添加的配置；`dsh` 下次不带该 patch。继续读[权限策略](02-mcp-policy.md)或 [Agent 总览](README.md)。
