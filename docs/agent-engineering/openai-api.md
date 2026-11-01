# OpenAI API：额度、图片与语音

Pro / Business 的 API 赠额可用于文字、图片和语音：<mark class="key">先领取到 API 组织，再用该组织的项目 Key</mark>。其他活动按各自条款判断。[官方范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

核对：**2026-10-31**。`$40` 是费用抵扣额，调用量取决于模型与实际用量。

<div class="heading-alias" id="官方入口领取后先试一次" aria-hidden="true"></div>

## 官方入口与首次调用

| 操作 | 官方入口 |
| --- | --- |
| 登录 API 平台 | [OpenAI Platform](https://platform.openai.com/) |
| 领取订阅赠额、查看余额 | [Billing](https://platform.openai.com/settings/organization/billing/) |
| 在网页里试文字与看图请求 | [Responses Playground](https://platform.openai.com/chat/) |
| 查看模型与调用方式 | [模型目录](https://developers.openai.com/api/docs/models/all)、[API 入门](https://developers.openai.com/api/docs/quickstart) |

1. 用订阅对应的邮箱登录 API 平台，选择有所有权的 API 组织。
2. 在 Billing 找到 API credits 福利，选择符合资格的订阅或 Business 工作区，确认关联。
3. 核对余额与到期时间，在该组织试一次 Playground；应用使用该组织的项目 Key。

资格、模型权限与速率限制以所选组织为准。[领取说明](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

<div class="heading-alias" id="本期没用完下期还有吗" aria-hidden="true"></div>

## 赠额有效期与续发

月度赠额在账单周期结束时失效、不结转；首次激活后，福利与订阅资格仍有效时随续费自动发放，无需重领。[到期与续发](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

| 情况 | 怎么理解 |
| --- | --- |
| 月底还有余额 | 看账单周期截止时间，不直接按自然月月底判断 |
| 首次显示 `$40` | 首次赠额按本期剩余时间折算，不能据此认定以后每期都是 `$40` |
| 取消订阅 | 后续赠额停止；已发放额度仍可用到其到期时间 |
| Business 年付 | 按年预付的工作区一次获得全年赠额，在年度账单周期结束时到期 |

后台显示 11 月 12 日到期，就按该日期使用，不按自然月末推算。[赠额规则](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)。

<details class="qa">
<summary>哪些账号可以领取？为什么有订阅却看不到入口？</summary>

付费 Pro / Business 须生效至少 7 天；领取人拥有订阅或工作区及 API 组织，并用同一邮箱关联。试用、赠送订阅不符合资格，以领取页为准。[资格条件](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

</details>

<div class="heading-alias" id="可以调用哪些模型" aria-hidden="true"></div>

## 可用模型与接口

分类、选型与停用计划见[模型附录](../appendix/openai-api-models.md)。

图片、TTS、转写与实时语音可使用同一笔赠额，费用随模型和用量变化。[覆盖范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

| 用途 | 模型示例 | 调用入口 |
| --- | --- | --- |
| 聊天、写代码、理解图片 | `gpt-6-astra`、`gpt-6.1-sol`、`gpt-6.1-terra`、`gpt-6-luna` | Responses API |
| 生成或修改图片 | `gpt-image-2.5-sunburst`、`gpt-image-2.5-flare` | Images API，或 Responses 的图片生成工具 |
| 文字转语音（TTS） | `gpt-realtime-2.1-mini` | Realtime API |
| 录音转文字 | `gpt-transcribe` | 音频转写 API |
| 实时语音对话 | `gpt-live-1`、`gpt-realtime-2.1` | 分别使用 GPT-Live 与 Realtime API |

查[模型目录](https://developers.openai.com/api/docs/models/all)、[TTS 接入](https://developers.openai.com/api/docs/guides/text-to-speech)和[定价](https://developers.openai.com/api/docs/pricing)；可用模型取决于组织权限。

精细编辑选 Sunburst，快速出图选 Flare；两者均可生成、编辑图片。[图片指南](https://developers.openai.com/api/docs/guides/image-generation)

<details class="qa">
<summary>教程里的 tts-1、tts-1-hd、gpt-4o-mini-tts 还能用吗？</summary>

核对时 `/v1/audio/speech` 仍可用，但三款模型已弃用，计划 **2027-01-06 停用**。新项目采用 `gpt-realtime-2.1-mini` 与 Realtime API。

迁移需改接口流程：`gpt-realtime-2.1-mini` 不支持 `/v1/audio/speech`。[迁移说明](https://developers.openai.com/api/docs/guides/text-to-speech)

</details>

<div class="heading-alias" id="使用时确认三件事" aria-hidden="true"></div>

## 费用核对

- **组织：** 仅抵扣关联组织的 API，用其项目 Key。
- **Codex：** <mark class="caution">不支持 API Key 调用 Codex</mark>，也不增加 ChatGPT / 登录态 Codex 限额。
- **用完后：** 先赠额、后购买余额；无余额返回 `429 / credit_balance_exhausted`。[计费说明](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

<span id="community-ideas"></span>

<div class="heading-alias" id="社区里的六个妙用" aria-hidden="true"></div>

## 六类社区案例

来源为 HN、Reddit 与 OpenAI 社区，检索于 **2026-10-31**。“实作”是作者自述，“建议”是尚未运行的本仓库实验。老帖说明玩法，接入用当前 API；其他供应商费用不计入 OpenAI 赠额。

| 目标 | 最小实验 | 所需能力 |
| --- | --- | --- |
| 问一句话，找回以前存的截图 | 20 张截图，返回匹配原图 | 看图理解、文本检索 |
| 离开屏幕，开口复习技术概念 | 一篇文档、5 张口答卡 | 文本、TTS、转写 |
| 将教程转为学习播客 | 一篇笔记、一段约 3 分钟的音频 | 文本、TTS |
| 查出转接头放在哪个抽屉 | 3 张照片、手动指定存放位置 | 看图理解、字段提取 |
| 用同一个角色连载学习漫画 | 一张角色参考图、3 格故事 | 文本、生图、图片编辑 |
| 实现带存档的语音冒险 | 一个场景、一个 NPC、5 个回合 | 文本、语音、应用保存状态 |

<details>
<summary>1 · 截图记忆库：按描述检索原图</summary>

**实作：** Trickle 在 2023 Show HN 展示截图收藏、检索与提问，当时使用 OCR + 文本 GPT-4，非原生看图模型。[原帖](https://news.ycombinator.com/item?id=37432793)

**试做：** 给 20 张截图编号，生成标题、标签与说明，保存原图路径。查询“粉色侧栏设置页”时返回候选原图；首版直接发送说明，后续再建索引。

**验收：** 用 5 种说法找已知截图，记录命中并核对原图。

</details>

<details>
<summary>2 · 开口复习：让文档变成会追问的卡片</summary>

**实作：** 2023 年 Hands-Free Anki 用 Anki 管理卡片与复习，组合 TTS、Faster-Whisper、ChatGPT 做读题、作答和评分。[作者介绍](https://news.ycombinator.com/item?id=38620389)

**试做：** 从 KV Cache 或 SSE 提取 5 题，附答案与原文。用“TTS → 录音转写 → 文本判答”指出遗漏并追问，之后再试实时语音。

**验收：** 漏答条件时能指出并链接原文；术语转写错后可修正重判。

</details>

<details>
<summary>3 · 学习播客：笔记转音频</summary>

**实作：** Podcastfy 在 2024 年展示网页、PDF、图片转双人音频，支持多家 TTS。[作者介绍](https://news.ycombinator.com/item?id=41852401) 另有“网页 → TTS → 音频与 RSS → Apple Podcasts”流程。[用户实作](https://news.ycombinator.com/item?id=50069680)

**试做：** 一篇笔记生成约 3 分钟双人脚本，一人讲解、一人追问；核对后合成音频，保留脚本与原文，再按需接 RSS。

**验收：** 能复述核心区别，数字与结论有依据；先试听一小段音色和术语发音。

</details>

<details>
<summary>4 · 拍照收纳：给抽屉建立可搜索的清单</summary>

**实作：** Homebox Companion 用 OpenAI 视觉识别物品、数量与字段，人工修正后写入 Homebox，附仓库和演示。[Reddit 原帖](https://www.reddit.com/r/homebox/comments/1pf5orf/homebox_companion_ai_powered_photo_cataloging_for/)

**试做：** 拍线材与工具，手填存放位置；模型提取物品、数量、可见型号与照片编号，存成 CSV。搜索物品时返回位置和原图。

**验收：** 对照实物查漏识别和重复计数，模糊型号留空；位置由人提供，移动后更新。

</details>

<details>
<summary>5 · 连载学习漫画：让同一个角色解释不同概念</summary>

**实作：** `_j` 于 2026-09-29 展示按已有角色与画风续作，并讨论编辑 API 参考图。[社区第 1229 帖](https://community.openai.com/t/gpt-image-general-ai-art-gallery-art-created-by-users-of-openai-products-2026/1388609?page=61)

**试做：** 用 Yuuki 参考图与角色描述，画“缓存命中 → 条件改变 → 失效”3 格故事，再续作新概念。

**验收：** 核对知识、分镜及角色服装配色；漂移时单格编辑，公式代码在排版时加入。

</details>

<details>
<summary>6 · 有存档的语音冒险：让一个 NPC 记得上一回合</summary>

**实作：** OpenAI DnD 讨论中，作者介绍 API 互动小说与语音朗读，当时历史上下文仍待完善。[作者第 2、4 帖](https://community.openai.com/t/using-chatgpt-as-a-dm-in-dnd/259037)

**试做：** 在“飞船维修店”用语音选择行动；模型写台词，应用保存位置、背包、进度，每回合传入。玩 5 回合后测试存档继续。

**验收：** 道具交出后移除，重开后保留进度；先验证文字状态，再加语音插画。

</details>

<div class="heading-alias" id="接着试什么" aria-hidden="true"></div>

## 实验入口

语音与音乐方案见[额度怎么用](openai-api-projects.md)：灵感卡、笔记、复习、配乐、MIDI 与短片。

学习先试 **5 张口答卡**，图片先试 **3 格漫画**；核对成果与 Usage 后再扩大。

本页仅查阅官方与社区资料，未付费调用；金额、到期与权限仍须后台确认。

语音链路见[语音交互：合成、转写与人声检测](../tts/README.md)；工具循环见 [Agent 工程总览](README.md)。
