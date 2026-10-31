# AI Hooks：Claude Code、DeepSeek Harness 与 Codex

**Hook（钩子）是在 Agent 运行到某个时刻，由宿主自动调用的程序。** 例如，模型准备运行终端命令时，先交给你的脚本检查；工具执行后，记录结果；一轮任务准备结束时，核对验收条件。

这篇先讲共同原理，再用同一个无害实验比较三家：**记录工具调用，并拒绝包含 `HOOK_DEMO_BLOCK` 的演示命令。** 不需要先理解模型训练。

资料核对：**2026-10-31**。Claude Code、Codex 部分依据当前官方文档，示例面向本地客户端；DeepSeek 部分指官方 **DeepSeek Harness（`dsh`）**，源码固定于 [`ce7073d`](https://github.com/deepseek-ai/deepseek-harness/tree/ce7073d51254c26cd63b22a60835b8f948deb447)。本文保存教学示例，未在本仓库启用 hooks。

## 先看它插在什么位置

```text
你发出任务
  → 宿主接收输入
  → 模型决定调用工具
  → 执行前 hook：检查参数，必要时拒绝
  → 宿主按权限策略执行工具
  → 执行后 hook：观察或处理结果
  → 模型根据结果继续工作
  → 准备结束时的 hook：判断是否还要继续
```

一次 hook 可以拆成三个问题：

| 要素 | 含义 | 例子 |
| --- | --- | --- |
| Event：何时触发 | 宿主提供的生命周期节点 | `PreToolUse`：工具执行之前 |
| Matcher：哪些调用触发 | 在该事件内进一步筛选 | 只匹配名为 `Bash` 的工具 |
| Handler：触发后做什么 | 脚本、服务或插件函数 | 读取参数，返回拒绝决定 |

**Matcher 匹配工具名，不等于检查命令内容。** `Bash` 选中了终端工具；是否包含演示标记，要由 handler 读取参数后判断。三家的输入和返回格式由各自宿主定义，下面分别展示。

### Hook、Skill、MCP 怎么一起用？

| 机制 | 你在表达什么 | 在文档项目里的例子 |
| --- | --- | --- |
| Prompt / 项目指令 | 这次任务与长期约定是什么 | “修改文档后检查链接” |
| Skill | 一类任务按什么步骤做 | 整理资料、写教程、验证、提交的流程 |
| MCP | 通过什么接口提供外部工具与资源 | 给 Agent 提供 GitHub 仓库读取工具 |
| Hook | 到哪个运行节点自动执行什么 | 工具调用前检查参数，调用后记录结果 |

它们可以组合：Skill 描述提交流程，Agent 调用 MCP 工具读取资料，宿主在调用前后触发 hook。**把“请检查”写进提示词，不会自动注册一个 hook。** 背景可接着读 [Skills](03-skills-structure.md)、[MCP 工具源](01-mcp-tool-source.md)和 [Harness 入门](../ai-from-scaling/03-build-a-harness.md)。

## 三家的机制先对齐

| 比较项 | Claude Code | DeepSeek Harness | Codex |
| --- | --- | --- | --- |
| 谁提供机制 | Claude Code 客户端 | `dsh` 的 Cordis 插件框架 | 支持 hooks 的 Codex 客户端 |
| 常用入口 | `.claude/settings.json`；个人项目配置可用 `.claude/settings.local.json` | TypeScript 插件，通过 profile 的 patch 挂载 | `.codex/hooks.json` 或 `config.toml` 内的 `[hooks]` |
| 工具执行前 | `PreToolUse` | `tools/pre-execute` | `PreToolUse` |
| 工具执行后 | 成功：`PostToolUse`；失败：`PostToolUseFailure` | `tools/post-execute`；最终结果观察用 `tools/result` | `PostToolUse`，也覆盖已完成但退出码非零的 Bash 调用 |
| 准备结束一轮 | `Stop` | `agent/turn-stopping` | `Stop` |
| 扩展写法 | 配置 handler | `ctx.on(事件名, 函数)` | 配置 handler |

这是职责对照，事件不保证一一等价。配置位置、触发范围与字段分别见 [Claude Code reference](https://code.claude.com/docs/en/hooks)、[DeepSeek 架构](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/architecture.md)和 [Codex Hooks](https://learn.chatgpt.com/docs/hooks)。

当前 Claude Code 列出 `command`、`http`、`mcp_tool`、`prompt`、`agent` 五种 handler，`agent` 仍属实验功能。Codex 当前执行 `command` 和 `mcp_tool`；`prompt`、`agent` 虽能被解析，却会被跳过。不要仅凭配置名称相同就迁移。[Claude handler 类型](https://code.claude.com/docs/en/hooks#hook-handler-fields) · [Codex 配置](https://learn.chatgpt.com/docs/hooks#config-shape)

宿主控制触发时机；如果 handler 内部又请模型判断，判断结果仍受模型影响。入门时用明确的程序条件，比较容易看清发生了什么。

DeepSeek 模型 API 与 `dsh` 要分开理解：本页的 `tools/*` 事件由 Harness 运行时派发。只发一个模型 API 请求，不会替你运行这里的本地插件。已有的 [DeepSeek Harness 请求装配课](../kv-cache/04-deepseek-harness.md)可以帮助你找到这一层。

## 第一个实验：先读懂输入与输出

Claude Code 和 Codex 的 command hook 都可以从标准输入读取一个 JSON 对象。这个最小样本只保留实验脚本要用的字段；真实事件还包含会话、目录等信息：

```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "echo HOOK_DEMO_BLOCK" }
}
```

脚本不会接管终端去执行这个 `echo`。它只检查宿主即将执行的命令，再将决定交回宿主。[Claude 输入与输出](https://code.claude.com/docs/en/hooks-guide#read-input-and-return-output) · [Codex PreToolUse](https://learn.chatgpt.com/docs/hooks#pretooluse)

### 写一个两家都能理解的演示脚本

在自己的练习目录创建 `hook-lab/demo-hook.mjs`，需要 Node.js。脚本把事件名、工具名和时间写到自身旁边的 `events.jsonl`，便于确认它是否运行；不记录命令全文。

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

这里 `{}` 表示本 hook 不作额外决定，继续宿主原有的权限流程；它不代表自动批准。拒绝时才输出明确的 `deny`。这是两家当前 `PreToolUse` 都接受的格式，不能推断所有事件的返回值都兼容。

先在终端模拟事件，完全不调用模型，也不会执行 JSON 里面的命令：

```sh
printf '%s\n' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo HOOK_DEMO_OK"}}' | node hook-lab/demo-hook.mjs
printf '%s\n' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo HOOK_DEMO_BLOCK"}}' | node hook-lab/demo-hook.mjs
```

第一条应输出 `{}`；第二条应输出带 `permissionDecision: "deny"` 的对象。`events.jsonl` 应增加两条记录。这一步只证明脚本的输入输出符合预期；客户端有没有加载它，要继续验证。

### Claude Code：把脚本接到 PreToolUse

在练习项目的 `.claude/settings.local.json` 中合并下面的配置，保留已有设置。把 `/absolute/path/to/hook-lab/demo-hook.mjs` 换成脚本的绝对路径，路径两侧的引号要保留。

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

`^Bash$` 表示完整匹配这个工具名；`timeout` 的单位是秒。打开 Claude Code 的 `/hooks` 查看该配置是否被发现，然后发出：

> 请分别通过终端工具运行 `echo HOOK_DEMO_OK` 和 `echo HOOK_DEMO_BLOCK`。如果第二条被 hook 拒绝，就报告拒绝结果，不改写重试。

观察第一条的工具结果、第二条的拒绝理由，以及日志是否新增记录。脚本日志只能证明 hook 被调用，工具结果才能证明命令有没有执行。配置与排查入口见 [Claude 官方入门](https://code.claude.com/docs/en/hooks-guide#set-up-your-first-hook)。

### Codex：复用演示，留意加载与信任

将上面的 `hooks` 对象合并到练习项目的 `.codex/hooks.json`，脚本仍使用绝对路径。项目 `.codex` 配置层需要受信任；随后在 CLI 的 `/hooks` 中检查来源并信任该 hook 定义。新建或变更的非托管 hook 在审核前会被跳过。[Codex 信任流程](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)

再发送相同的两条命令请求，核对工具结果与日志。Codex 将终端调用规范化为 `Bash`，因此本例可以复用；多个配置来源的 hooks 会合并，项目配置不会自动覆盖用户级 hook。重复日志时先检查是否注册了两遍。[配置加载](https://learn.chatgpt.com/docs/hooks#where-codex-looks-for-hooks) · [工具覆盖范围](https://learn.chatgpt.com/docs/hooks#tool-coverage)

**从这个例子迁移到文件编辑时，需要重新核对参数。** Claude 的 `Edit` / `Write` 提供 `tool_input.file_path`；Codex 的 `apply_patch` 即使被 `Edit` / `Write` 别名匹配，事件仍报告 `apply_patch`，补丁文本在 `tool_input.command`。直接搬用 `.file_path` 脚本会失效。[Claude 工具输入](https://code.claude.com/docs/en/hooks#pretooluse) · [Codex 工具输入](https://learn.chatgpt.com/docs/hooks#pretooluse)

## DeepSeek Harness：同一条规则，写成插件

`dsh` 的原生 hook 是普通 Cordis 插件。监听函数直接收到类型化的工具调用对象，返回决策，不需要将结果打印成 Claude / Codex 的 JSON 协议。[官方 hook 插件示例](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/cookbook/extension-cookbook.md#a-hook-plugin-permission-gate-example)

下面在 **DeepSeek Harness 源码 checkout** 中操作。先完成官方[从源码运行](https://github.com/deepseek-ai/deepseek-harness/tree/ce7073d51254c26cd63b22a60835b8f948deb447#run-from-source)的依赖安装；这些命令不在 Yuuki Box 根目录执行。

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

- 这里的内置终端工具名是小写 `bash`，参数在 `exec.arguments.command`。[Bash 工具源码](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/shell/tool-bash/src/index.ts)
- 拒绝返回 `{ kind: 'deny', reason }`。允许继续检查时用 `next()`，把控制交给后续监听器；直接返回 `allow` 会截断这条 waterfall 的后续监听器。
- 这个事件不能改写已经记录的工具参数。需要不可被后续策略放宽的最终拒绝规则时，官方提供 `ctx.tools.guard()`；普通插件监听与最终 guard 要区分。[工具策略与决策类型](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/tools.md#execution-extensible-waterfalls-plus-monotonic-policy)

这里的 **waterfall** 可以理解成一串中间件：每个监听器决定返回结果，还是调用 `next()` 继续传递。它与“大家同时执行，各打印一份 JSON”的模式不同。[Cordis waterfall 说明](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/cordis-primer.md#cordis-waterfall-semantics)

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

在 Web UI 选择模型和练习工作区后，要求通过 `bash` 工具运行同样的两条演示命令；若所选 profile 没有该工具，先检查工具配置。观察进程终端的 `[hook-demo] bash`，以及 UI 中的工具结果与拒绝信息。插件挂载方式来自[官方第一个插件教程](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/user/develop/basic/index.md)。

### 继续认识三个有用的 DeepSeek 事件

| 事件 | 适合什么 | 需要理解的边界 |
| --- | --- | --- |
| `agent/pre-step` | 在一次模型步骤进入前处理待接收消息 | 一个 turn 可能包含多个 step，别把它等同于“一条用户消息” |
| `tools/execute` | 包裹工具执行过程，记录耗时或处理执行生命周期 | 它是中间件，要正确传递 `next()` 与取消信号 |
| `tools/result` | 统计最终工具成功、失败与结果 | 用于观察冻结后的结果，不在这里改写结果 |

事件入口与顺序见[架构里的 Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/architecture.md#turn-flow)和[工具事件参考](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/tools.md#tools-events)。

## Stop 最容易读反：拒绝停止，就会继续工作

Claude Code 和 Codex 都有 `Stop`。对这个事件返回下面的决定，意思是“还有事没做完，继续工作”：

```json
{
  "decision": "block",
  "reason": "刚才的检查仍然失败，请处理失败项并重新验证。"
}
```

它不表示撤销任务，也不证明之前的产物已验收。要实现“检查没过就继续”，handler 必须实际读取或运行检查；只让模型在最后说“全部通过”没有提供证据。[Claude Stop](https://code.claude.com/docs/en/hooks#stop) · [Codex Stop](https://learn.chatgpt.com/docs/hooks#stop)

写这类 hook 时检查输入中的 `stop_hook_active`，并设置明确的继续次数或退出条件；否则可能反复要求继续。Codex 的 Stop 在退出码为 0 时要求 stdout 为 JSON，不能只打印一句“完成了”。如果采用“一次补救后允许停止”的策略，失败状态仍应报告给用户，不能将它改写为成功。

本课建议先完成前面的观察与拒绝实验，再尝试 Stop。前者能让你分别看见触发、决策与工具结果，较容易定位问题。

## 可以为自己的项目做哪些事？

下面是根据事件能力设计的练习，**尚未接入本仓库**。先选一项，并为它定义可观察的结果。

| 想解决的问题 | 可以用的入口 | 怎么判断确实有效 |
| --- | --- | --- |
| AI 等我确认时，我正看别的窗口 | Claude `Notification`，按通知类型筛选 | 等待输入时通知一次，任务继续后不再重复提醒 |
| 新会话总要重新交代项目状态 | Claude / Codex `SessionStart`；`dsh` 按消息装配入口注入上下文 | 只加入当前分支、运行环境等简短事实，并能核对来源 |
| 不知道一次任务慢在模型还是工具 | 成对记录工具前后事件；`dsh` 可包裹 `tools/execute` | 用调用 ID 关联开始与结束，能分开看等待、执行与失败 |
| AI 改了文件，总忘记格式化 | 文件编辑后的事件，或按需监听文件变化 | 只处理目标文件；检查格式化器自己的写入是否会再次触发 |
| 文档改完就说“好了”，但站点构建失败 | `Stop` 读取与当前改动对应的检查结果 | 故意制造一个坏链接或构建错误，能看到失败与补救 |
| 想研究哪些外部工具最常失败 | Claude / Codex 对 MCP 工具的调用事件；`dsh` 的最终结果事件 | 按工具统计成功与失败，不把完整私有内容写进统计日志 |

这些入口的行为依据 [Claude 自动化指南](https://code.claude.com/docs/en/hooks-guide)、[Codex 生命周期事件](https://learn.chatgpt.com/docs/hooks)和 [DeepSeek 事件图谱](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/event-producer-consumer.md)。具体方案与验收方式是本课的练习设计。

对这个文档仓库，可以先记录工具事件，再在任务收尾检查 `pnpm --dir site check` 和 `pnpm docs:build`。不要每写一个字符就全量构建；检查记录还要对应当前文件版本，旧的成功结果不能为新改动背书。

## 六个常见误解

| 误解 | 应该怎样判断 |
| --- | --- |
| “换成 DeepSeek 模型，就该用 DeepSeek hook 配置” | 看运行它的宿主。如果是自己写的 Agent，生命周期与插件由自己实现 |
| “hook 输出一句禁止执行，就能拦住” | 宿主要收到这个事件支持的决策格式；普通 stdout 不等于拒绝 |
| “程序退出码非零，总会阻止操作” | 不成立。错误、超时与主动拒绝有不同语义；例如两家的 `PreToolUse` 支持退出码 2 拒绝，不能把普通错误码 1 当成同义词 |
| “PostToolUse 返回拒绝，文件就没写进去” | 操作已经发生。后置 hook 可以反馈或处理结果，不能自动回滚副作用 |
| “匹配 Edit / Write 就覆盖所有写文件” | Bash、MCP 工具等也能写文件；工具 matcher 只覆盖实际匹配到的调用 |
| “把检查放后台，操作会等它放行” | Codex 的异步 command hook 不参与阻断、改写或审批。需要执行前决策就使用对应的同步入口 |

错误与阻断规则见 [Claude 执行与错误处理](https://code.claude.com/docs/en/hooks#hook-execution-details)、[Codex 事件输出](https://learn.chatgpt.com/docs/hooks#pretooluse)和[异步限制](https://learn.chatgpt.com/docs/hooks#limitations)。演示里的字符串匹配只用来理解流程，不能作为完整的命令权限策略；权限与沙箱还需要独立配置。

本页验证记录：JSON 与 shell 语法检查通过；Node 脚本的 5 个离线事件样本符合预期。DeepSeek 示例通过 TypeScript 转译与 3 个模拟回调检查，确认拒绝及 `next()` 传递行为；这不等于完整类型检查或真实客户端集成。尚未在 Claude Code、Codex 或 `dsh` 会话中启用这些示例。

## 学会了没有：用三道题检查

<details class="qa">
<summary>1 · 我要求 AI 修改文件后运行测试，这已经是 hook 吗？</summary>

还不是。这是任务指令。注册生命周期事件及其处理程序后，才有宿主触发的 hook。Skill 可以保存这条流程要求，也仍需区分文字要求和实际事件注册。

</details>

<details class="qa">
<summary>2 · demo-hook 日志里出现了一条 Bash 记录，能证明命令已经运行吗？</summary>

不能。本实验记录的是 `PreToolUse`，它发生在工具执行之前，后面可能被 hook 或其他权限策略拒绝。要看工具结果或相应的执行后事件。

</details>

<details class="qa">
<summary>3 · DeepSeek 的监听器不命中我的规则，为什么返回 next()，而不直接返回 allow？</summary>

`next()` 让后续监听器继续检查。直接返回一个决策会截断该 waterfall 的后续监听器。最终 guard 是另一层约束；不要靠一个普通 hook 宣称整个调用已获得全部权限。

</details>

完成练习后移除自己添加的演示配置；`dsh` 下次启动不带这个 patch 即可。保留其他配置不变。继续学习[工具权限策略](02-mcp-policy.md)或返回 [Agent 工程总览](README.md)。
