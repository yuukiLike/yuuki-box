# 云端 Codex：环境、任务与验证

**明确任务范围，由 Codex 在云端读取、修改并检查，再审阅结果。** 本机休眠不影响云端任务。 [官方概览](https://learn.chatgpt.com/docs/cloud)

<div class="heading-alias" id="最快开始先用-for-safe" aria-hidden="true"></div>

## 起步：for-safe 只读任务

**首轮选 for-safe，只读 README 与目录，交简短小结。** 不要求构建、设备或改代码。

打开[第一条任务](01-for-safe.md)，选已发布环境、复制只读指令，核对文件依据即可。

创建、发布环境后才能发起任务；已经有可用环境时直接选用。[OpenAI 官方起步流程](https://learn.chatgpt.com/docs/cloud)

资源配置见[云端实测](cloud-machine.md)：4 vCPU、32 GiB 及复查方法。

<details>
<summary>扩展案例、目录与验证边界</summary>

首次交付后，再选 `for-job` 的检查与导出，或 `agent-symphony` 的事件回放。

| 阅读顺序 | 内容 |
| --- | --- |
| 本页 · 三个概念 | 分清环境、任务、PR，以及额度与硬件边界 |
| [云端电脑实测](cloud-machine.md) | 读取 CPU、内存与磁盘，分清 Shell 入口、独立任务与资源占用 |
| [1 · 用 for-safe 开始](01-for-safe.md) | 创建环境、发布、发出第一条任务、检查交付 |
| [2 · 社区怎么用](02-community.md) | 三种有公开来源的做法，两张真实历史界面截图 |
| [3 · for-job](03-for-job.md) | 准备已有 Web 项目，验证备份恢复与实际导出 |
| [4 · agent-symphony](04-agent-symphony.md) | 验证事件处理、观察服务与浏览器回归，区分模拟和真实接入 |
| [选读 · Issue 到 PR 的并行实验](05-issue-to-pr.md) | 并行试 Dot / Cloud、Codex Action / API 与 Agentic Workflows / API |

产品规则核对：**2026-10-29**，新增项目见各页。正文为新版 Cloud；旧截图标为 Legacy，不混用缓存、联网或密钥规则。 [新版与 Legacy 的入口](https://learn.chatgpt.com/docs/environments/cloud-environments)

## 三个项目怎样选

| 项目 | 这次探索什么 | 第一份交付 | 本地继续验什么 |
| --- | --- | --- | --- |
| [for-safe](01-for-safe.md) | 从规格中拆出可验证的任务 | 有文件依据的任务划分 | macOS 权限、Wi-Fi、蓝牙与真实设备 |
| [for-job](03-for-job.md) | 已有 Web 项目的检查与小改动 | 当前提交的检查基线，再做备份恢复与导出回归 | 版式、字体、旧稿与 iPhone／iCloud |
| [agent-symphony](04-agent-symphony.md) | 用事件样本验证观察结果是否可靠 | 事件、存储与 HTTP 检查，再做界面回归 | 本地宿主 Hooks 接入、真实声音与听感 |

首次按 `for-safe` 创建环境；其他项目各准备环境、先跑基线再改代码。

自动交付先读[Issue 完整方案](../issue-garden/README.md)；需要比较路线时，再做[并行实验](05-issue-to-pr.md)。

<div class="heading-alias" id="先记三个词" aria-hidden="true"></div>

## 基础概念

| 概念 | 定义 | 配置与操作 |
| --- | --- | --- |
| **环境 Environment** | 仓库、依赖、工具与访问配置 | 准备一次，检查后发布，之后复用 |
| **任务 Task** | 在独立工作区里完成的一次委托 | 给清楚目标、范围和完成标准 |
| **PR（拉取请求）** | 待审阅、合并的代码改动 | 核对差异与验证证据，再决定是否合并 |

新任务从已发布文件状态开始，<mark class="key">任务间文件独立</mark>，同任务可继续。**Publish 发布环境，PR 交付代码**；状态保存不替代 Git 提交。 [环境与状态](https://learn.chatgpt.com/docs/environments/cloud-environments#reuse-and-update-saved-state)

<details class="qa">
<summary>云端环境提供哪些资源？</summary>

这是托管开发环境：新版称 VM，Legacy 称容器；无需先搭容器平台。

它不是永久服务器、Mac 或 GPU 承诺；新版默认保留最近启动／恢复后 7 天内的可恢复 VM 状态，重要结果另存。 [环境规格与限制](https://learn.chatgpt.com/docs/environments/cloud-environments)

</details>

<div class="heading-alias" id="for-safe什么交给云端什么回到-mac" aria-hidden="true"></div>

## for-safe：云端与本地验收

`for-safe` 仍处规格阶段，无可运行应用或测试；下表为任务划分建议。

| 工作 | 云端适合完成的部分 | 还需要的证据 |
| --- | --- | --- |
| 阅读规格、拆任务 | 找矛盾、列未知项、拟定验收条件 | 对照原文确认没有扩大范围 |
| 结果分类、脱敏与导出 | 实现不依赖系统 API 的逻辑，运行样本测试 | 样本只能证明规则处理正确 |
| 任务状态与取消 | 模拟迟到回调、重跑与取消 | Mac 验原生适配器是否停止 |
| Wi-Fi / 蓝牙扫描 | 编写接口、模拟数据、错误处理与测试方案 | 真设备、权限、开关与休眠恢复 |
| 麦克风 / 屏幕等访问归因 | 整理 API 证据和待验证假设 | 实际 macOS、应用身份与权限 |

**模拟通过不代表真机通过**；云端看不到本机周围无线设备，自有 Mac 服务也须在该 Mac 验收。

依据另一个项目 `~/codex/for-safe/docs/spec/` 的架构、交付、敏感访问规格；本站不附代码，以目标仓库实际文件为准。

<div class="heading-alias" id="额度云端和本地会互相影响吗" aria-hidden="true"></div>

## 套餐用量与 API 账单

**ChatGPT 登录的本地与云端 Codex 共享套餐用量。** 消耗随任务变化，余额与重置看[用量面板](https://chatgpt.com/codex/settings/usage)。 [计费说明](https://learn.chatgpt.com/docs/pricing)

API balance 属 API 账单；订阅赠额不支持 Codex API。云端登录态不需填 API key。 [API 赠额适用范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

</details>

本次最快入口核对：2026-11-01。其他产品规则沿用正文各自标注的核对日期。
