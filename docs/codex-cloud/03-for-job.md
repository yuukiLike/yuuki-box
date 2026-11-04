# for-job 的云端检查与导出回归

**<mark class="key">先取得 `for-job` 检查基线</mark>，再做一个恢复或导出任务。** 项目已有编辑器、单测与浏览器用例。

按 **2026-10-31** 本机 `~/codex/for-job` 的清单、说明及测试配置整理；本页尚无云端执行结果。

<div class="heading-alias" id="先认清现有能力" aria-hidden="true"></div>

## 现有能力与边界

| 已有内容 | 云端可以先做什么 | 验收时保留什么边界 |
| --- | --- | --- |
| 简历编辑、草稿、撤销与备份导入 | 检查文档校验、旧格式迁移与恢复逻辑 | 云端草稿独立，读不到本机旧稿 |
| 视觉 PDF / PNG、ATS PDF / DOCX | 运行已有导出用例，核对文件内容、顺序与结构 | 下载不证明排版；字体、版式查页面与文件 |
| 本地 stdio MCP | 用虚构数据验证 `.resume.json` 文件往返 | 文件往返尚不等于与网页实时草稿同步 |
| 截图收件箱本地原型 | 用测试图片验证导入、去重、存储与重试 | iPhone／iCloud 需真机；OCR、岗位提取未接入 |

使用已有虚构样本，不上传个人简历、相册或 iCloud 收件箱。

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

验证安装步骤后存 **Install script**，**Publish** 并启动新任务；依赖变化后验证、**Republish**。 [OpenAI 官方环境说明，核对于 2026-10-31](https://learn.chatgpt.com/docs/environments/cloud-environments#customize-installation-and-startup)

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

记录当前提交在当前环境的结果；失败先定位，历史 QA 数量不能代替。

## 第二条任务验证备份恢复与导出

先跑已有回归，再选真实失败。配置为生产服务 `localhost:3001`、单 worker；新任务需构建当前提交，由 Playwright 启动服务。

```bash
pnpm exec playwright install chrome
pnpm build
pnpm exec playwright test tests/e2e/editing/storage-recovery.spec.ts tests/e2e/export/ats-artifacts.spec.ts
```

Linux 依赖参考 CI 的 `pnpm exec playwright install-deps chromium`；无安装条件时保留原因。

```text
先构建当前提交，再运行仓库已有的 storage-recovery 和 ats-artifacts 浏览器用例。
只使用测试 fixtures，保留失败截图、trace、报告及需要核对的导出文件。

检查损坏草稿的备份、恢复和保存失败反馈；
检查 ATS PDF 的可提取文字与顺序、DOCX 的实际结构。
若失败，先复现并判断是否为环境问题，提交一个最小修复建议，
附触发条件、代码依据、拟改文件和同一用例的验收方法，本轮先不改代码。
若全部通过，报告覆盖范围和下一条值得做的具体任务，不为产生 diff 而改代码。
```

Cloud 无内置 computer／browser use；这里运行仓库自带 Playwright，以实测为准。 [官方工具边界](https://learn.chatgpt.com/docs/environments/cloud-environments#current-limitations)

视觉导出另跑 `tests/e2e/export/visual-pdf.spec.ts` 等相关用例，查页面与文件；ATS／恢复测试不覆盖全部导出和编辑行为。

<div class="heading-alias" id="怎样接回一次实现" aria-hidden="true"></div>

## 实现与交付

明确修复范围与完成条件；按项目做实现、兼容自审，再审实页和 diff，写回 `TODO.md`。界面保留视口、长文本、多页与文件证据。

交付行为变化、命令结果、产物和待验项；无法验证的实页、字体明确保留，再按项目规则整合。

<details>
<summary>本页对应的项目文件</summary>

以下路径相对 `for-job` 根目录，以目标分支中的实际文件为准：

- `README.md`、`AGENTS.md`、`package.json`、`.github/workflows/ci.yml`：运行版本、检查与交付约定。
- `tests/unit/resume-document-codec.test.ts`：文档与备份格式、旧稿保留等离线检查。
- `playwright.config.ts`、`tests/e2e/editing/storage-recovery.spec.ts`、`tests/e2e/export/ats-artifacts.spec.ts`：生产服务、恢复与真实导出检查。
- `docs/index.md`、`docs/guides/iphone-inbox.md`、`fast-todo.md`：已有能力、真机待验项与后续 AI / MCP 计划。

</details>

继续看 [agent-symphony 的事件与回放验证](04-agent-symphony.md)，或返回[三个项目的选择](README.md#三个项目怎样选)。
