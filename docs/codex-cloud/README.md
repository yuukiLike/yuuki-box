# 云端 Codex：把一次开发任务交出去

**把仓库和一个明确任务交给 Codex，让它在云端读文件、改代码、运行命令，再回来检查结果。你的电脑休眠后，云端任务仍能继续。** [官方概览](https://learn.chatgpt.com/docs/cloud)

这一专题用 `for-safe` 做练习：先让 AI 拆出能在云端验证的工作，再把需要无线设备和 macOS 权限的部分留给真实 Mac。先完成一次小任务，就能开始你的「AI 尽可能接管开发流程」实验。

| 阅读顺序 | 你会得到什么 |
| --- | --- |
| 本页 · 三个概念 | 分清环境、任务、PR，以及额度与硬件边界 |
| [1 · 用 for-safe 开始](01-for-safe.md) | 创建环境、发布、发出第一条任务、检查交付 |
| [2 · 社区怎么用](02-community.md) | 三种有公开来源的做法，两张真实历史界面截图 |

产品规则核对于 **2026-10-29**。正文按新版 **Codex Cloud** 编写；官方仍保留 **Codex Cloud (Legacy)**。社区旧截图均单独标注，不能用旧版的缓存、联网或密钥规则解释新版。[新版与 Legacy 的入口](https://learn.chatgpt.com/docs/environments/cloud-environments)

## 先记三个词

| 词 | 把它理解成 | 你需要做什么 |
| --- | --- | --- |
| **环境 Environment** | 准备好的工作台：仓库、依赖、工具与访问配置 | 准备一次，检查后发布，之后复用 |
| **任务 Task** | 在独立工作区里完成的一次委托 | 给清楚目标、范围和完成标准 |
| **PR（拉取请求）** | 把一组代码改动交给你审阅、合并 | 看差异和验证证据，再决定是否合并 |

新版每个新任务从已发布环境的文件状态开始，任务之间的工作文件独立；同一任务可以继续。**Publish 发布的是环境，PR 交付的是代码改动，二者不是同一个动作。** 环境中的保存状态也不能替代 Git 提交。[环境与状态](https://learn.chatgpt.com/docs/environments/cloud-environments#reuse-and-update-saved-state)

<details class="qa">
<summary>大家说的「云端容器」，是一台可以随便用的云电脑吗？</summary>

可以先理解成托管的开发环境。新版官方使用 VM（虚拟机）的表述；Legacy 文档则讲容器、setup script 和缓存。第一次使用不需要自己租服务器、写 Dockerfile 或搭建容器平台。

它适合开发任务，不能据此假定获得了永久运行的服务器、Mac 桌面或 GPU。新版默认在最近一次启动或恢复后的 7 天内保留可恢复的 VM 状态，重要结果应提交或另行保存。[环境规格与限制](https://learn.chatgpt.com/docs/environments/cloud-environments)

</details>

## for-safe：什么交给云端，什么回到 Mac？

`for-safe` 想做的是 Mac 本地安全检查。**截至本次阅读，它仍处于规格阶段，没有可直接运行的应用和测试套件。** 下面是建议的任务划分，不是已经完成的验证记录。

| 工作 | 云端适合完成的部分 | 还需要的证据 |
| --- | --- | --- |
| 阅读规格、拆任务 | 找矛盾、列未知项、拟定验收条件 | 对照原文确认没有扩大范围 |
| 结果分类、脱敏与导出 | 实现不依赖系统 API 的逻辑，运行样本测试 | 样本只能证明规则处理正确 |
| 任务状态与取消 | 用模拟事件测试迟到回调、重复运行和取消 | 原生适配器是否真的停止，需在 Mac 验证 |
| Wi-Fi / 蓝牙扫描 | 编写接口、模拟数据、错误处理与测试方案 | 真实无线设备、权限允许/拒绝、开关与休眠恢复 |
| 麦克风 / 屏幕等访问归因 | 整理 API 证据和待验证假设 | 实际 macOS 版本、应用身份与真实权限行为 |

**模拟扫描通过，不等于真机扫描通过；云端能联网，也不等于能看到你家附近的 Wi-Fi。** 若以后给云端接入自有 Mac 测试服务，硬件验收仍发生在那台 Mac 上。

这里依据本机 `~/codex/for-safe/docs/spec/` 中的 `01-architecture-and-contracts.md`、`04-delivery-and-acceptance.md`、`08-sensitive-access-observation.md` 整理。它们属于另一个项目，本站不附带那份代码；跟做时以你提交到目标仓库的实际文件为准。

## 额度：云端和本地会互相影响吗？

**会：使用 ChatGPT 登录的本地 Codex 与云端任务共享套餐用量。** 任务大小、模型、上下文和工具调用都会影响消耗，不能按「一个任务固定扣多少」估算。剩余额度与重置时间看 [Codex 用量面板](https://chatgpt.com/codex/settings/usage)。[计费说明](https://learn.chatgpt.com/docs/pricing)

之前截图里的 **API credit balance** 是 API 侧余额，不是这里的云端任务额度。订阅赠送的 API credits 也不适用于通过 API key 使用 Codex。云端跟做使用 ChatGPT 登录，不需要把 API key 填进环境。[API 赠额适用范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

**下一步：[用 for-safe 发出第一条云端任务 →](01-for-safe.md)**
