# agent-symphony 的云端事件与回放验证

**云端查事件、存储和界面，本地验宿主接入与听感。** Agent Symphony 将 Codex／dsh 记录呈现为时间线和声音。

项目：**Agent Symphony**，目录 `~/explore/agent-symphony`，包名 `agent-symphony`。状态按 **2026-10-31** 本机工作树核对，云端步骤待执行。

<div class="heading-alias" id="先把目标代码版本交给云端" aria-hidden="true"></div>

## 代码版本与云端检出

项目已有 Hooks 观察、dsh 适配、事件存储、回放与测试，部分仍未提交。**<mark class="key">先推送本轮文件</mark>，再核对云端实际 SHA 与目录。**

| 工作 | 云端先验证什么 | 还需要什么证据 |
| --- | --- | --- |
| 事件与调用关联 | 乱序、重投、冲突、未知事件和缺失结果 | 样本只能证明程序如何处理输入 |
| 存储、HTTP 与导入导出 | 隔离数据库、鉴权、分页、原始字段与历史标记 | 本地实际记录库的迁移与使用情况另验 |
| 时间线、筛选、配置和回放 | 浏览器用例、截图、声音调度与取消 | 真实输出、音色与辨识度 |
| Codex / dsh 真实接入 | 适配器契约和隔离测试 | 宿主版本、加载配置、实际触发与采集记录 |

模拟、真实 dsh 隔离执行与本机 Codex 接入分别记录；云端服务不会自动附着桌面会话。

## 准备 Node 环境

按[第一次任务](01-for-safe.md#-创建并发布环境)创建独立环境，选择 `agent-symphony` 仓库。准备对话可直接发送：

```text
为 agent-symphony 准备云端环境。
先读 readme.md（小写）、package.json、pnpm-lock.yaml、
docs/implementation-contract.md、playwright.config.mjs 和 scripts/browser-server.mjs。
检查目标分支是否已有本轮需要的适配器和测试，报告提交与缺失文件。

使用 Node.js 24+、pnpm 11.14.0，执行 pnpm install --frozen-lockfile。
项目没有前端构建步骤；不要猜测或新增 build 命令。
先验证 pnpm check、pnpm test，再检查 Chromium 和浏览器系统依赖。
本轮使用测试临时目录，不接入个人记录库或 ~/.codex、~/.dsh 配置。
不需要模型 API key，也不启动真实 Agent。
```

保存已验证安装步骤，检查后 **Publish**、启动新任务；运行时以目标清单为准。 [OpenAI 官方环境说明，核对于 2026-10-31](https://learn.chatgpt.com/docs/environments/cloud-environments#customize-installation-and-startup)

## 第一条任务验证事件是否被正确解释

```text
在 agent-symphony 当前提交上建立检查基线。本轮不修改源码、依赖或项目约定，不创建 PR。
先读 readme.md、docs/implementation-contract.md 和相关源码、测试。
报告提交、Node 与 pnpm 的实际版本，执行 pnpm check、pnpm test。

结合 src/events.mjs、src/store.mjs、src/codex.mjs 与实际存在的测试，
逐项说明已有用例验证了什么，哪些仍是缺口：
1. 工具返回先到时，能否按原生调用 ID 关联，而不按时间猜测。
2. 相同通知重投能否去重；冲突是否保留第一份证据并报告缺口。
3. 缺少返回、未知类型、Stop / SubagentStop 是否仍保留正确的不确定语义。
4. 历史导入与实时事件是否可区分，是否会错误触发现场声音。

逐项附文件依据和实际检查结果；没有测试覆盖就明确指出。
最后推荐一个最小的回归或修复任务，先不扩展宿主、日志格式或执行能力。
```

该检查仅验证输入解释；本地另验宿主事件、观察配置和漏采记录。

## 第二条任务运行界面与声音规则回归

Playwright 用 `scripts/browser-server.mjs` 启动 `127.0.0.1:4318` 隔离服务、单 worker，结束清库；不使用日常 `4317`。

```bash
pnpm exec playwright install chromium
pnpm exec playwright test test/browser/workbench.spec.mjs test/browser/sound-rules.spec.mjs
```

```text
运行已有 workbench 和 sound-rules 浏览器用例，先确认浏览器与系统依赖可用。
使用测试配置创建的临时数据，不连接日常记录服务。
核对时间线、筛选、规则保存与回放中相关的行为，保留失败截图和 trace。
报告哪些声音行为由测试断言验证，哪些仍需真实播放或人工试听。

失败时先区分环境问题、已有代码问题和断言失效，
交回一个最小修复建议与同一用例的完成条件，本轮先不改代码。
不要把演示 session 写成真实宿主接入，也不要把音频调度写成听感通过。
```

Cloud 无内置 computer／browser use；自带 Playwright 需实测。 [官方工具边界](https://learn.chatgpt.com/docs/environments/cloud-environments#current-limitations)

按改动选用例，完整入口是 `pnpm test:browser`；规则测试查调度、静音、取消，真实输出与音色回 Mac 验收。

## 真实宿主接入怎样继续

观察器面向本地 command hooks；加载、信任后须在新会话核对采集，生成文件不等于接入。 [官方 Hooks 加载与信任规则](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)

云端只验接收接口与样本；本地 command hooks 不能直接视作云端采集入口。 [官方云端编排约束](https://learn.chatgpt.com/docs/hooks#managed-hooks-from-requirementstoml)

`pnpm test:integration` 另需 `docs/dsh-setup.md` 的隔离 runtime，固定 `@deepseek-ai/dsh@0.1.6-alpha.2`。真实 dsh + 本地固定模型不代表生产或远端模型验证；缺条件可记未运行。

交付 diff、命令、事件样本及页面证据；本机新会话采集和实际声音另验。

<details>
<summary>本页对应的项目文件</summary>

以下路径相对 `agent-symphony` 根目录，未提交文件需先纳入目标分支：

- `readme.md`、`package.json`、`docs/implementation-contract.md`：运行命令、接口与观察边界。
- `src/events.mjs`、`src/store.mjs`、`src/codex.mjs`、`adapters/codex.mjs`：事件解释、存储与 Codex 通知接入。
- `test/events.test.mjs`、`test/store.test.mjs`、`test/codex.test.mjs`：事件、重投、冲突与不确定状态的回归。
- `playwright.config.mjs`、`scripts/browser-server.mjs`、`test/browser/workbench.spec.mjs`、`test/browser/sound-rules.spec.mjs`：隔离浏览器测试与声音规则检查。
- `docs/dsh-setup.md`、`scripts/test-dsh-integration.mjs`、`docs/verification.md`：dsh 联调准备与历史验证范围；历史数量不作为当前云端结果。

</details>

**下一项：[把项目练习接到 Issue 与 PR 的并行实验 →](05-issue-to-pr.md)**。也可返回[三个项目的选择](README.md#三个项目怎样选)，或对照 [for-job 的备份恢复与导出回归](03-for-job.md)。
