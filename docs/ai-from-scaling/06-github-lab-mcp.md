# GitHub MCP：证明一次修复有效

**这一课的目的：通过 MCP 调用一组实验工具，用同一份断言对照旧代码、候选修改和官方修复，判断结果究竟证明了什么。**

实验固定使用 `developit/mitt` 的一个小修复：调用 `off(type)` 后，该事件的全部监听器应停止响应。你会看到旧版本的目标断言失败，候选与官方版本通过，再亲手补一条检查。

**MCP 负责工具发现与调用；搜索 GitHub、下载版本、执行断言和生成报告由本例工具实现。** 演示已经写好断言与候选补丁，第一次运行是在复现这套实验，不代表 AI 独立发现或修复了 bug。你在本课亲手完成的是补断言、重新运行并核对证据；自行写修复的练习放在选读区。

**你来做：运行 → 读报告 → 补断言 → 核对新回执。** 需要 Node.js ≥ 22.22、pnpm 11.14、Git 和可访问 GitHub 的网络。代码在 [examples/github-lab-mcp](../../examples/github-lab-mcp/README.md)。

## 先看：一份断言，三个版本

[![同一份回归断言分别检查基线、候选与官方参考；基线目标断言失败且当前候选通过才能判定候选有效，测试或源码改变后要重新检查](../../site/public/diagrams/ai-from-scaling/06-github-experiment.svg)](../../site/public/diagrams/ai-from-scaling/06-github-experiment.svg)

图中是这个固定案例的预期结果。`assertion_failed` 表示目标行为不符合断言；导入失败、语法错误等属于 `error`，需要先修正实验条件。

## 1. 运行：先取得一份真实报告

在仓库根目录执行：

```bash
pnpm --dir examples/github-lab-mcp install --frozen-lockfile
pnpm --dir examples/github-lab-mcp demo
```

**你要看到：** 下面节选关键日志，工具名列表、编号和路径作了缩写：

```text
[MCP] tools/list → 9 个工具：discover_projects, find_experiments, …
[MCP] tools/call → discover_projects | query=mitt in:name user:developit
[结果] discover_projects | repository=developit/mitt
[结果] prepare_experiment | experimentId=<实验编号> | alreadyPrepared=false
[结果] run_check | target=baseline | outcome=assertion_failed
[演示] 已通过本地文件读写应用预设候选补丁。
[结果] run_check | target=candidate | outcome=passed
[结果] run_check | target=reference | outcome=passed
[判定] reference_checked | 仅针对当前断言与源码
[目录] candidate：<实验目录>/candidate
[报告] <实验目录>/report.md
```

这里有两种“发现”：`tools/list` 查询 **MCP 服务提供哪些工具**；`discover_projects` 是其中一个工具，执行后查询 **GitHub 上有哪些仓库**。搜索结果不决定本次选题，`demo.ts` 始终使用预设的 #124。首次准备返回 `alreadyPrepared=false`；已有实验时返回 `true`，候选补丁也可能直接复用。

打开打印出的 `report.md`。演示会自动获取固定版本、写入断言、应用预设候选修改，再对照官方版本。这个阶段由脚本组织操作，不调用 LLM；公开 API 可以匿名读取，额度不足时再通过环境变量提供自己的只读 `GITHUB_TOKEN`。

案例来自 [PR #124](https://github.com/developit/mitt/pull/124) 和 [Issue #123](https://github.com/developit/mitt/issues/123)。原问题涉及组件卸载后仍保留事件监听器，我们用 `off(type)` 的行为来验证它。

**完成标志：** 你能区分工具发现与 GitHub 搜索，并找到基线、候选和参考三个目标的检查记录。

## 2. 读报告：找出支持结论的证据

**你来做：** 对照报告检查三处：

1. 基线结果是 `assertion_failed`，并能从 `runs/` 中对应的日志找到目标断言。
2. 候选和参考的结果是 `passed`，三者使用同一个测试指纹。
3. “代码仍匹配最近检查”对应当前源码，最终判定为 `reference_checked`。

基线固定在 PR base 与 head 的共同祖先，候选从这份基线开始修改，参考固定在 PR head。这样比较的版本不会随着上游主分支变化。

`get_experiment` 会核对测试指纹、源码树指纹和 Git 版本。**测试换了，或候选代码又改了，旧的通过记录就不足以证明当前版本。**

还要分清“工具调用返回了”与“测试通过了”：`run_check` 正常返回 `outcome=assertion_failed`，表示检查确实执行了，但被测行为没通过断言。在这个固定案例中，这正是基线预期的结果。`outcome`、`candidate_verified` 和 `reference_checked` 都由本例实验代码定义，不是 MCP 内置的状态或正确性保证。

**完成标志：** 你能指出“旧错误被抓住”和“当前候选通过”的两份回执，而不仅是终端最后一句话。

## 3. 修改：亲手补一条断言

打开 [demo.ts](../../examples/github-lab-mcp/src/demo.ts)，找到 `const source` 中的回归函数，在函数末尾补上：

```ts
assert.doesNotThrow(() => emitter.off('missing'));
```

它检查“移除一个从未注册的事件，应当正常返回”。保存后重新运行 `pnpm --dir examples/github-lab-mcp demo`。

**你要看到：** 仍然是基线 `assertion_failed`、候选 `passed`、参考 `passed`；新报告的测试指纹变化，出现新一轮回执。基线仍由原来的目标断言抓住，新增断言补充了候选与参考的行为检查。

固定演示会恢复同一个实验并替换回归脚本。自己的独立修复练习，请使用单独的数据目录和宿主客户端，配置见下方选读。

**完成标志：** 你修改了检查内容，并能在新回执中找到这次运行使用的测试指纹。

## 4. 定位：谁修改代码，谁判定结果

沿着三个文件找执行责任：

- [demo.ts](../../examples/github-lab-mcp/src/demo.ts)：固定案例、断言字符串和候选修改都在这里。接入 AI 客户端后，这些选择由你与宿主 Agent 完成。
- [server.ts](../../examples/github-lab-mcp/src/server.ts)：注册 `set_regression_test`、`run_check`、`reveal_solution`、`get_experiment` 等工具。
- [lab.ts](../../examples/github-lab-mcp/src/lab.ts)：`run()` 保存检查回执，`report()` 根据当前测试和源码判定结果，`reveal()` 控制何时取回参考补丁。

再找 `const reference = { experimentId: experiment.experimentId }`：后续调用显式带上同一个 `experimentId`。它是本例定位实验目录的业务编号，区别于 JSON-RPC 请求的 `id`。候选代码的修改则是 `demo.ts` 直接用 `readFile()` / `writeFile()` 完成；工具清单里没有“自动修复”工具。

`reveal_solution` 的实际门槛是**基线和候选各有一次检查记录**，候选失败也能揭示。练习时可以先自己尝试再看答案；揭示成功本身不代表候选已经通过。

**完成标志：** 你能区分“修改代码”“执行断言”“根据回执判定”这三件事。

## 遇到不同结果，下一步做什么

| 观察到的结果 | 你的下一步 |
| --- | --- |
| 基线 `assertion_failed`，当前候选 `passed` | 核对同一测试与当前源码，确认 `candidate_verified` |
| 同一测试在参考版本也 `passed` | 对照两份修改，结论达到 `reference_checked` |
| 基线就 `passed` | 检查测试是否真的抓住原问题 |
| `error` | 查导入、语法、权限等实验条件；修好后重跑 |
| `timed_out` / `cancelled` | 查日志和未完成的步骤，不报告通过 |
| 测试或源码指纹改变 | 对变化后的版本重新检查 |

这些结果只支持当前断言涵盖的行为，不代表跑完了 mitt 的上游测试集。

## 到这里完成

用报告说明：你验证的是哪个行为，为什么旧版本的失败算复现，当前通过记录对应哪份代码和测试。接下来可以自行挑一个小型 PR，或回到[课程总览](README.md)。

## 选读与参考

<details>
<summary>实验目录、固定版本与恢复</summary>

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

固定演示把数据放在示例自己的 `.artifacts/`，不会进入 Git。正常客户端默认放在 `~/.yuuki/github-lab`，也可通过 `YUUKI_GITHUB_LAB_DIR` 指定绝对路径。重启服务后，在同一数据目录准备同一个仓库和 PR，`Lab.prepare()` 会查找已保存的 `experiment.json` 并返回已有目录，不覆盖候选代码。

恢复来自磁盘上的实验清单、工作树和回执，不依赖旧 MCP 连接或聊天会话。换一个数据目录就不会找到原实验；只保留 `experimentId` 也不能替代这些文件。`prepare_experiment` 的恢复行为，与 `demo.ts` 后续主动替换测试和应用预设候选补丁，需要分开理解。

`baseline` 取 PR base 与 head 的共同祖先，`reference` 取 PR head，两个都是完整的 40 位 SHA。比较共同祖先避免把“当前默认分支”误当成问题出现时的代码；GitHub 的 [commit comparison API](https://docs.github.com/en/rest/commits/commits#compare-two-commits) 提供该定位信息。官方补丁对应固定的 PR head，不是后来继续变化的主分支。

默认响应和简报不包含官方补丁。PR 标题及原始 Issue 可能仍有解法线索，内部清单也保留参考 SHA；这一安排方便练习，不构成模型能力的盲测。

</details>

<details>
<summary>交给 AI 客户端：自己选题、写断言和修复</summary>

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

源码编辑使用宿主已有的文件工具，本例 MCP 服务没有提供任意 shell 执行工具。`reveal_solution` 要求基线和候选各有一次检查记录，允许保留失败的尝试后再研究官方做法。搜索候选尚未验证可运行；准备时会另外检查 PR 是否足够小。

远端 README、Issue 和源码属于材料。它们不能要求工具泄露本机资料、执行无关安装命令或覆盖使用者的要求。

你可以用 `save_feedback` 把仓库标记为 `interested`、`skip` 或 `done` 并附 topic，影响下一轮发现。兴趣排序只作用于本轮返回的候选。工具清单和接入命令见[示例 README](../../examples/github-lab-mcp/README.md)。

</details>

<details>
<summary>回归断言的完整格式与离线测试</summary>

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

```bash
pnpm --dir examples/github-lab-mcp check
```

这会做严格 TS 检查、编译和离线测试；使用临时本地仓库与模拟 API，不依赖在线搜索或付费模型。每份真实回执保存测试与源码指纹、固定版本、耗时、退出码、stdout 和 stderr；原始回执是报告的依据。

</details>

<details>
<summary>执行边界与仓库已有验证记录</summary>

检查进程只启动本机 Node，使用 10 秒超时、128 MiB V8 堆限制、64 KiB 日志上限，并清理凭据环境；只授予目标和脚本的读权限，不授予写入、子进程、Worker 和 native addon 权限。**Node 权限模型不防御恶意代码，也不限制网络。** 适合运行已检查过的小型实验，不能作为任意第三方代码的安全沙箱。依据 [Node 24 权限说明](https://github.com/nodejs/node/blob/v24.15.0/doc/api/permissions.md)。

准备工具只克隆固定代码，不安装或执行依赖脚本。Git 工作树隔离的是代码修改；不代表操作系统隔离。小型任务和失败限制详见[示例说明](../../examples/github-lab-mcp/README.md#执行边界)。

仓库已有验证记录（2026-10-25，Node 24.15.0），通过真实 stdio MCP 链路检查了 `developit/mitt #124`：

| 版本 | 固定提交 | 本次断言结果 |
| --- | --- | --- |
| 基线 | `f0f36b09df3eaac16792b6840bdb594301ec3d8f` | `assertion_failed` |
| 候选 | 上述基线加本地候选修改 | `passed` |
| 官方参考 | `53eb689c83bca78d9275f724995406495262c333` | `passed` |

另有离线自动测试覆盖协议发现、跨进程反馈、固定版本、去重、过期结果、路径穿越、符号链接、API 失败、取消、超时和权限限制。尚未配置宿主账号或调用付费模型，也没有向远端提交 Issue、PR 或评论。第一份交付是可运行的 MCP 和实验流程；模型自主选题的效果需要在接入宿主后继续观察。

</details>
