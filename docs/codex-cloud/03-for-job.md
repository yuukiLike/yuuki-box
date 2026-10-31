# for-job 的云端检查与导出回归

**先让云端为 `for-job` 跑出当前代码的检查基线，再交一个备份恢复或导出的小任务。** 它已有可运行的简历编辑器、单测和浏览器用例，适合观察 AI 能否从读代码一直做到可检查的交付。

项目状态按 **2026-10-31** 本机 `~/codex/for-job` 核对；命令来自该项目的 `package.json`、`README.md`、`AGENTS.md` 与测试配置。本页提供云端跟做步骤，尚无该项目的云端执行结果。

## 先认清现有能力

| 已有内容 | 云端可以先做什么 | 验收时保留什么边界 |
| --- | --- | --- |
| 简历编辑、草稿、撤销与备份导入 | 检查文档校验、旧格式迁移与恢复逻辑 | 云端测试浏览器拥有自己的草稿，不能读取你本机浏览器中的旧稿 |
| 视觉 PDF / PNG、ATS PDF / DOCX | 运行已有导出用例，核对文件内容、顺序与结构 | 下载成功不代表排版正确；字体和实际版式需要对应的页面、文件证据 |
| 本地 stdio MCP | 用虚构数据验证 `.resume.json` 文件往返 | 文件往返尚不等于与网页实时草稿同步 |
| 截图收件箱本地原型 | 用测试图片验证导入、去重、存储与重试 | iPhone 分享和 iCloud 同步仍需真机验收；OCR 与岗位提取尚未接入 |

第一轮用仓库已有样本。项目要求个人简历不进入源码、示例或公开测试证据；无需把个人草稿、相册或 iCloud 收件箱搬进云端环境。

## 准备并发布环境

按[第一次任务](01-for-safe.md#-创建并发布环境)创建环境，仓库改选 `for-job`。准备对话可直接发送：

```text
为 for-job 准备云端环境。先读 README.md、AGENTS.md、package.json、
pnpm-lock.yaml、.github/workflows/ci.yml 和 playwright.config.ts。
报告实际仓库、分支与提交，确认这些文件已在目标分支。

按仓库声明使用 Node.js >=22.13.0、pnpm 11.14.0，
执行 pnpm install --frozen-lockfile。
核对当前代码需要的 Node 内置能力，包括资源收件箱使用的 node:sqlite。
不要为让安装通过而更新依赖、锁文件或业务代码。

说明架构、类型、lint、单测、应用构建与浏览器测试分别用什么命令。
先验证基础检查；浏览器测试另检查 Chromium 与系统依赖。
安装或检查失败时，保留实际命令、错误和缺少的条件。
```

把实际验证过的依赖安装步骤保存到 **Install script**。确认准备报告后 **Publish**，再启动新任务；依赖或工具变化时验证并 **Republish**。[OpenAI 官方环境说明，核对于 2026-10-31](https://learn.chatgpt.com/docs/environments/cloud-environments#customize-installation-and-startup)

## 第一条任务先取得基线

```text
在 for-job 当前提交上建立云端检查基线。本轮不修改源码、依赖或项目约定，不创建 PR。
先读项目约定，报告提交、Node 与 pnpm 的实际版本，执行：

pnpm check:architecture
pnpm test:unit
pnpm lint
pnpm typecheck
pnpm build

逐项报告通过、失败或未运行，附命令和退出结果。
某一步失败后，判断其余检查是否仍能独立执行；不要把未运行写成通过。
区分现有代码失败与环境缺少工具，不顺手修复或放宽检查。
最后推荐一个范围最小的下一步，写明受影响文件和完成条件。
```

这轮先回答“这个提交在这个环境能跑到哪一步”。历史 QA 的通过数量不能代替当前结果。基线有失败时，先定位原因，再决定是否把修复作为下一条任务。

## 第二条任务验证备份恢复与导出

基线可用后，先运行已有回归，再从真实失败中挑一个小修复。当前测试配置使用生产服务 `localhost:3001`、单个 worker。新任务的工作文件独立，本轮仍需先构建当前提交，再由 Playwright 配置启动服务。

```bash
pnpm exec playwright install chromium
pnpm build
pnpm exec playwright test tests/e2e/editing/storage-recovery.spec.ts tests/e2e/export/ats-artifacts.spec.ts
```

Linux 系统依赖的准备参考仓库 CI 中的 `pnpm exec playwright install-deps chromium`。先检查环境是否具备安装条件，失败时保留原因。

```text
先构建当前提交，再运行仓库已有的 storage-recovery 和 ats-artifacts 浏览器用例。
只使用测试 fixtures，保留失败截图、trace、报告及需要核对的导出文件。

检查损坏草稿的备份、恢复和保存失败反馈；
检查 ATS PDF 的可提取文字与顺序、DOCX 的实际结构。
若失败，先复现并判断是否为环境问题，提交一个最小修复建议，
附触发条件、代码依据、拟改文件和同一用例的验收方法，本轮先不改代码。
若全部通过，报告覆盖范围和下一条值得做的具体任务，不为产生 diff 而改代码。
```

新版 Cloud 当前不提供内置 computer / browser use；这里尝试的是**仓库自带的 Playwright 命令行测试**，能否运行以环境实测为准。[官方工具边界](https://learn.chatgpt.com/docs/environments/cloud-environments#current-limitations)

需要检查视觉导出时，再按改动范围运行 `tests/e2e/export/visual-pdf.spec.ts` 等已有用例，并查看对应页面和实际文件。两份 ATS / 恢复测试不覆盖所有导出、编辑和语言行为。

## 怎样接回一次实现

选定一个已复现的问题后，把修复范围和完成条件交给云端。要求它沿用项目的两次自审：先审实现、兼容和边界，再审实页、交付与最终 diff；结论写回项目已有的 `TODO.md`。涉及界面的改动，保留宽窄视口、长文本、多页和实际交付文件中相关的证据。

交付应列出修改的行为、实际运行的检查、产物位置与剩余验收。云端没有能力检查的实页或本机字体行为，继续留作明确的待验项。再按项目规则审阅和整合改动。

<details>
<summary>本页对应的项目文件</summary>

以下路径相对 `for-job` 根目录，跟做时以目标分支中的实际文件为准：

- `README.md`、`AGENTS.md`、`package.json`、`.github/workflows/ci.yml`：运行版本、检查与交付约定。
- `tests/unit/resume-document-codec.test.ts`：文档与备份格式、旧稿保留等离线检查。
- `playwright.config.ts`、`tests/e2e/editing/storage-recovery.spec.ts`、`tests/e2e/export/ats-artifacts.spec.ts`：生产服务、恢复与真实导出检查。
- `docs/index.md`、`docs/guides/iphone-inbox.md`、`fast-todo.md`：已有能力、真机待验项与后续 AI / MCP 计划。

</details>

继续看 [agent-symphony 的事件与回放验证](04-agent-symphony.md)，或返回[三个项目的选择](README.md#三个项目怎样选)。
