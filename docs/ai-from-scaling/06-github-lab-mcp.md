# GitHub：把一次真实修复变成实验

打开一个修复 PR，你已经知道作者最后交了什么。换一种玩法：先回到修复前的源码，自己解释问题、写出能抓住它的断言，再让 AI 尝试修复。最后打开官方补丁，对照两条思路。

**这次先完成一个小动作：运行真实案例，看见同一份断言在旧版本失败、在修复后通过。** 完成后就可以停，再决定是否自己挑下一张 PR。

代码位于 [examples/github-lab-mcp](../../examples/github-lab-mcp/README.md)。继续使用 TypeScript、官方 MCP SDK 与 Zod；GitHub 接入选用官方生态的 [Octokit REST 客户端](https://github.com/octokit/rest.js)，复用其接口类型和请求实现。服务器负责资料与实验工具，宿主 Agent 负责判断、阅读与提出修改。

## 先跑一局

需要 Node.js ≥ 22.22、pnpm 11.14、Git，以及访问 GitHub 的网络。在仓库根目录执行：

```bash
pnpm --dir examples/github-lab-mcp install --frozen-lockfile
pnpm --dir examples/github-lab-mcp check
pnpm --dir examples/github-lab-mcp demo
```

`check` 先做严格 TS 检查，再运行离线测试；`demo` 通过真实 MCP 客户端搜索、准备和验证一个公开案例。公开 API 可匿名调用，限额不足时再提供 `GITHUB_TOKEN`；这里不需要模型 key。

演示固定选择 [mitt #124](https://github.com/developit/mitt/pull/124)，关联的 [Issue #123](https://github.com/developit/mitt/issues/123) 描述了 Vue 组件卸载后监听器仍在、再次进入时重复响应的问题。我们把它收成一个具体行为：

> 注册某个事件的多个监听器，调用 `off(type)`，再触发该事件；这些监听器应当不再执行。其他事件和通配监听器继续工作。

终端应出现：

```text
发现 9 个 MCP 工具。
真实 GitHub 项目发现：developit/mitt。
同一份断言：旧版 assertion_failed → 候选 passed → 官方修复 passed。
实验目录：……/candidate
报告：……/report.md
```

**第一个停点：打开打印出来的报告，指出哪条记录证明旧版本确实没有满足断言。** 仅看到报错还不够，必须确认它是目标断言失败，不能把导入失败或语法错误算作复现。

演示脚本提供固定的断言与候选修改，没有调用 LLM。它验证工具发现、跨进程调用、真实 GitHub 取码及结果判定。接入 AI 客户端后，才由你的宿主 Agent 自己选择任务、写断言和修改候选。

## 一次实验留下什么

```text
~/.yuuki/github-lab/<experimentId>/
  experiment.json   # 固定版本与来源
  briefing.md       # 目标、原始 Issue 和完成条件
  baseline/         # 旧版本，保持干净
  candidate/        # 自己或 AI 修改的版本
  regression.mts   # 当前 TypeScript 断言
  checks/          # 每次运行时的断言快照
  runs/            # 原始日志、运行回执和候选 diff
  reference/       # 显式揭示后才下载的官方修复
  official.patch   # 显式揭示后保存的补丁
  report.md        # 根据运行回执生成的报告
```

固定演示把数据放在示例自己的 `.artifacts/`，不会进入 Git。正常客户端默认放在 `~/.yuuki/github-lab`，也可通过 `YUUKI_GITHUB_LAB_DIR` 指定绝对路径。重启服务后，准备同一个仓库和 PR 会恢复已有实验，不覆盖候选代码。

`baseline` 取 PR base 与 head 的共同祖先，`reference` 取 PR head，两个都是完整的 40 位 SHA。比较共同祖先避免把“当前默认分支”误当成问题出现时的代码；GitHub 的 [commit comparison API](https://docs.github.com/en/rest/commits/commits#compare-two-commits) 提供该定位信息。官方补丁对应固定的 PR head，不是后来继续变化的主分支。

默认响应和简报不包含官方补丁。PR 标题及原始 Issue 可能仍有解法线索，内部清单也保留参考 SHA；这一安排方便练习，不构成模型能力的盲测。

## 交给 AI 客户端时怎样玩

按[示例的 stdio 配置](../../examples/github-lab-mcp/README.md#接入-stdio-客户端)连接后，可以给宿主这样的任务：

```text
用 GitHub 实验员找一个小型 TypeScript 修复，偏向 MCP 或 Harness。
先看原始问题和旧代码，不打开官方补丁。
说明怎样复现，再写回归断言并检查旧版。
只在 candidate 中修改，检查通过后再揭示官方修复。
最后告诉我：你做了什么、运行证明了什么、还有哪里没有验证。
```

工具调用顺序可以是：

```text
discover_projects → find_experiments → prepare_experiment
→ read_source → set_regression_test → run_check(baseline)
→ 宿主修改 candidate → run_check(candidate)
→ reveal_solution → run_check(reference) → get_experiment
→ 使用者给反馈 → save_feedback
```

源码编辑使用宿主已有的文件工具，MCP 不提供任意 shell 执行。`reveal_solution` 要求基线和候选各有一次检查记录，允许保留失败的尝试后再研究官方做法。搜索候选尚未验证可运行；准备时会另外检查 PR 是否足够小。

远端 README、Issue 和源码属于材料。它们不能要求工具泄露本机资料、执行无关安装命令或覆盖使用者的要求。

## 怎样写一份回归断言

`set_regression_test` 接受 TypeScript ESM，默认导出一个函数。参数是本次目标目录；相同脚本分别对三个版本运行。

```ts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export default async function (target: string) {
  const { default: mitt } = await import(
    pathToFileURL(join(target, 'src/index.ts')).href
  );
  const emitter = mitt();
  let calls = 0;
  emitter.on('save', () => { calls++; });
  emitter.off('save');
  emitter.emit('save');
  assert.equal(calls, 0, '清理后不应再调用监听器');
}
```

这是 Native TypeScript 能去掉类型标注的脚本格式；脚本本身没有另跑 `tsc`。服务端和客户端源码则会经过完整 TS 类型检查。断言只能导入 Node 内置模块和已准备的源码；依赖构建产物或安装脚本的项目需要另外准备，不能把没跑通写成通过。

完整演示还检查：多个监听器一起清理、其他事件继续工作、通配监听器保留、传入未注册回调不误删监听器，以及按具体回调移除仍有效。这些断言只约束上述行为，不等于跑完 mitt 的上游测试集。

## 结果怎样影响下一步

| 观察 | 判定与下一步 |
| --- | --- |
| 旧版本产生 `assertion_failed` | 当前断言抓住了一个行为差异，判定 `baseline_reproduced` |
| 同一脚本在当前候选通过 | 判定 `candidate_verified`，可以揭示补丁做对照 |
| 同一脚本在官方版本也通过 | 判定 `reference_checked`，讨论两份修复的差别 |
| 导入、语法、权限错误 | `error`；修正实验条件后重跑 |
| 超时或取消 | `timed_out` / `cancelled`，保留日志，不报告完成 |
| 修改了测试脚本 | 指纹变化，重新跑基线与候选 |
| 候选源码在通过后又改变 | 旧成功失效，对当前源码重新检查 |

每份回执都保存测试 SHA-256、目标源码树 SHA-256、固定 Git 版本、耗时、退出码、stdout 和 stderr。源码指纹覆盖目标目录中的普通文件，包括未跟踪、被忽略的文件；`.git` 元数据除外。候选 diff 保存已跟踪文件的变动，新增文件仍保留在候选目录。报告由这些事实推导，不接受一句“测试通过”来替代运行记录。

你可以把某仓库标记为 `interested`、`skip` 或 `done`，并附上 `mcp`、`harness` 等 topic。下一次搜索默认排除已准备、跳过和完成的仓库；感兴趣仓库及相匹配 topic 排在前面。兴趣影响本轮 GitHub 返回的候选，不代表搜索了整个 GitHub。

## 接回自己的 AI 实践

- [有效测试](../ai-practices/05-test-generation.md)：先证明断言抓得到旧错误，再保留测试。
- [Issue 到 PR](../ai-practices/02-issue-to-pr.md)：练习把问题、验收条件、修改和证据写清楚；是否贡献上游由后续任务决定。
- [AI 审查](../ai-practices/01-coderabbit-review.md)：拿候选 diff 和官方 diff，逐条核对审查意见。
- [Harness 实验](03-build-a-harness.md)：观察工具失败、取消和结果回传，区分模型判断与程序执行。

你可以先发现一个项目，完成一次复现，最后给自己留一个小挑战：**下次换一条断言，检查它能不能排除另一种看似合理的修复。**

## 执行范围与本次证据

检查进程只启动本机 Node，使用 10 秒超时、128 MiB V8 堆限制、64 KiB 日志上限，并清理凭据环境；只授予目标和脚本的读权限，不授予写入、子进程、Worker 和 native addon 权限。**Node 权限模型不防御恶意代码，也不限制网络。** 适合运行已检查过的小型实验，不能作为任意第三方代码的安全沙箱。依据 [Node 24 权限说明](https://github.com/nodejs/node/blob/v24.15.0/doc/api/permissions.md)。

准备工具只克隆固定代码，不安装或执行依赖脚本。Git 工作树隔离的是代码修改；不代表操作系统隔离。小型任务和失败限制详见[示例说明](../../examples/github-lab-mcp/README.md#执行边界)。

2026-10-25，在 Node 24.15.0 下，通过真实 stdio MCP 链路验证了 `developit/mitt #124`：

| 版本 | 固定提交 | 本次断言结果 |
| --- | --- | --- |
| 基线 | `f0f36b09df3eaac16792b6840bdb594301ec3d8f` | `assertion_failed` |
| 候选 | 上述基线加本地候选修改 | `passed` |
| 官方参考 | `53eb689c83bca78d9275f724995406495262c333` | `passed` |

另有离线自动测试覆盖协议发现、跨进程反馈、固定版本、去重、过期结果、路径穿越、符号链接、API 失败、取消、超时和权限限制。尚未配置宿主账号或调用付费模型，也没有向远端提交 Issue、PR 或评论。第一份交付是可运行的 MCP 和实验流程；模型自主选题的效果需要在接入宿主后继续观察。
