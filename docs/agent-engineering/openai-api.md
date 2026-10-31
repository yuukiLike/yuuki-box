# OpenAI API：额度、图片与语音

**ChatGPT Pro / Business 订阅赠送的 API 额度可以用于文字、图片和语音。先把额度领取到自己的 API 组织，再使用该组织的项目 Key 调用。** 本页说明这项订阅福利；其他活动赠额要按各自条款判断。[官方适用范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

资料核对：**2026-10-31**。这里的 `$40` 表示可抵扣的 API 费用，能用多少取决于模型和实际用量。

## 官方入口：领取后先试一次

| 现在要做什么 | 官方入口 |
| --- | --- |
| 登录 API 平台 | [OpenAI Platform](https://platform.openai.com/) |
| 领取订阅赠额、查看余额 | [Billing](https://platform.openai.com/settings/organization/billing/) |
| 在网页里试文字与看图请求 | [Responses Playground](https://platform.openai.com/chat/) |
| 查看模型与调用方式 | [模型目录](https://developers.openai.com/api/docs/models/all)、[API 入门](https://developers.openai.com/api/docs/quickstart) |

1. 用订阅对应的邮箱登录 API 平台，选择自己拥有的 API 组织。
2. 在 Billing 找到 API credits 福利，选择符合资格的订阅或 Business 工作区，确认关联。
3. 查看到账余额与到期时间，再在该组织下试一次 Playground 请求；自己的应用使用该组织的项目 API Key。

领取与使用须满足订阅资格和 API 访问条件；模型权限、速率限制以所选组织为准。[领取说明](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

## 本期没用完，下期还有吗？

**按月发放的赠额会在订阅账单周期结束时失效，不结转；首次激活后，续费时自动发放下一期额度，前提是福利仍提供、订阅仍符合资格。** 不需要每期重新领取。[到期与续发规则](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

| 情况 | 怎么理解 |
| --- | --- |
| 月底还有余额 | 看账单周期截止时间，不直接按自然月月底判断 |
| 首次显示 `$40` | 首次赠额按本期剩余时间折算，不能据此认定以后每期都是 `$40` |
| 取消订阅 | 后续赠额停止；已发放额度仍可用到其到期时间 |
| Business 年付 | 按年预付的工作区一次获得全年赠额，在年度账单周期结束时到期 |

例如，后台若显示当前赠额在 11 月 12 日到期，就按该日期安排使用。10 月 31 日不会仅因为到了月末而自动成为截止日。上表规则见[订阅赠额文档](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)。

<details class="qa">
<summary>哪些账号可以领取？为什么有订阅却看不到入口？</summary>

官方要求付费 Pro 或 Business 订阅已生效至少 7 天；领取人同时拥有对应订阅或工作区，以及接收额度的 API 组织，关联时使用同一邮箱。试用与赠送订阅不符合资格。实际资格以领取页面为准。[资格条件](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

</details>

## 可以调用哪些模型？

下面列出常见用途与当前模型示例。**图片、TTS、转写和实时语音都可以消耗同一笔赠额**，具体费用随模型与用量变化。[额度覆盖范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

| 想做什么 | 模型示例 | 调用入口 |
| --- | --- | --- |
| 聊天、写代码、理解图片 | `gpt-6-astra`、`gpt-6.1-sol`、`gpt-6.1-terra`、`gpt-6-luna` | Responses API |
| 生成或修改图片 | `gpt-image-2.5-sunburst`、`gpt-image-2.5-flare` | Images API，或 Responses 的图片生成工具 |
| 文字转语音（TTS） | `gpt-realtime-2.1-mini` | Realtime API |
| 录音转文字 | `gpt-transcribe` | 音频转写 API |
| 实时语音对话 | `gpt-live-1`、`gpt-realtime-2.1` | 分别使用 GPT-Live 与 Realtime API |

模型清单见[官方目录](https://developers.openai.com/api/docs/models/all)。TTS 的接入方式见[文字转语音文档](https://developers.openai.com/api/docs/guides/text-to-speech)；当前价格看[API 定价](https://developers.openai.com/api/docs/pricing)。模型可选项仍取决于组织权限。

图片先按目标选择：需要精细编辑时用 Sunburst，日常快速出图用 Flare。两者支持从提示词生成图片，也支持修改已有图片。[图片生成与编辑指南](https://developers.openai.com/api/docs/guides/image-generation)

<details class="qa">
<summary>教程里的 tts-1、tts-1-hd、gpt-4o-mini-tts 还能用吗？</summary>

核对时仍可通过 `/v1/audio/speech` 使用，但这些模型已弃用，计划于 **2027 年 1 月 6 日停用**。新项目按官方建议使用 `gpt-realtime-2.1-mini` 与 Realtime API。

迁移需要调整接口流程，不能只替换模型名：`gpt-realtime-2.1-mini` 不支持 `/v1/audio/speech`。[TTS 迁移说明](https://developers.openai.com/api/docs/guides/text-to-speech)

</details>

## 使用时确认三件事

- **费用记在哪个组织。** 赠额只抵扣关联组织的 API 用量，应用使用该组织的项目 Key。
- **是否属于 Codex 用量。** 这项福利不支持通过 API Key 使用 Codex，也不增加 ChatGPT 或登录态 Codex 的订阅使用限额。
- **赠额用完以后怎么计费。** 系统先使用免费额度；若还有购买的 API 余额，会继续扣购买余额。没有余额时，请求会返回 `429`，错误码为 `credit_balance_exhausted`。[官方计费说明](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)

<span id="community-ideas"></span>

## 社区里的六个妙用

下面的灵感来自 Hacker News、Reddit 与 OpenAI 开发者社区，检索于 **2026-10-31**。**「社区实作」是原作者的公开自述；「试做建议」是据此为本仓库设计的小实验，尚未实现或运行。** 老帖用于说明玩法，接入时采用上文的当前 API；原项目可能混用其他供应商，赠额只覆盖符合规则的 OpenAI API 费用。

| 想得到什么 | 可以先试多小 | 用到的能力 |
| --- | --- | --- |
| 问一句话，找回以前存的截图 | 20 张截图，返回匹配原图 | 看图理解、文本检索 |
| 离开屏幕，开口复习技术概念 | 一篇文档、5 张口答卡 | 文本、TTS、转写 |
| 把自己的教程变成通勤播客 | 一篇笔记、一段约 3 分钟的音频 | 文本、TTS |
| 查出转接头放在哪个抽屉 | 3 张照片、手动指定存放位置 | 看图理解、字段提取 |
| 用同一个角色连载学习漫画 | 一张角色参考图、3 格故事 | 文本、生图、图片编辑 |
| 玩一个有存档的语音冒险 | 一个场景、一个 NPC、5 个回合 | 文本、语音、应用保存状态 |

<details>
<summary>1 · 截图记忆库：找回「那张我明明存过的图」</summary>

**社区实作：** Trickle 作者在 2023 年的 Show HN 中介绍了截图收藏、检索和提问。原版当时采用 OCR 与文本 GPT-4，并非如今的原生看图模型。[HN 原帖与作者说明](https://news.ycombinator.com/item?id=37432793)

**试做建议：** 给 20 张自己的截图编号，用看图模型生成标题、标签和简短说明，连同原图路径保存。以后问「那个粉色侧栏的设置界面在哪」，返回候选原图，点击即可查看。第一版把这些说明放进一次请求即可，后续再考虑检索索引。

**看什么结果：** 用 5 个不同说法寻找已知截图，记录能否命中；用原图核对答案，避免只得到一段看似合理的描述。

</details>

<details>
<summary>2 · 开口复习：让文档变成会追问的卡片</summary>

**社区实作：** Hands-Free Anki 作者在 2023 年公开了读出卡片、语音作答、自动评分的方案，使用 Anki 保存卡片与安排复习，组合了 TTS、Faster-Whisper 和 ChatGPT。[HN 作者介绍](https://news.ycombinator.com/item?id=38620389)

**试做建议：** 从本站 KV Cache 或 SSE 教程提取 5 道题，每题保留标准答案和原文位置。先读题，录下你的解释，再指出遗漏并追问一小步。可以先使用「TTS → 录音转写 → 文本判答」三段流程，之后再试实时语音。

**看什么结果：** 故意漏答一个条件，检查反馈能否指出它并链接原文；转写错了术语时，允许修正后再判答。

</details>

<details>
<summary>3 · 私人播客：把今天的学习笔记装进耳机</summary>

**社区实作：** Podcastfy 作者在 2024 年展示了将网页、PDF、图片等资料转成可定制的双人音频对话，并支持多种 TTS 提供方。[HN 作者介绍](https://news.ycombinator.com/item?id=41852401) 另有 HN 用户介绍了「网页正文 → TTS → 音频文件与 RSS → Apple Podcasts」的个人收听流程。[用户实作](https://news.ycombinator.com/item?id=50069680)

**试做建议：** 选一篇自己的学习笔记，让两个虚构角色分别负责「讲清楚」与「追问容易混淆的地方」，先生成约 3 分钟的脚本。核对内容后再合成音频，并保留脚本和原文链接；喜欢这种方式，再接 RSS。

**看什么结果：** 听完能否复述核心区别；数字、结论能否回到笔记中找到依据。先生成一小段听音色与术语发音，再处理全文。

</details>

<details>
<summary>4 · 拍照收纳：给抽屉建立可搜索的清单</summary>

**社区实作：** Homebox Companion 作者在 Reddit 展示了用 OpenAI 视觉模型识别照片中的物品、数量和可见字段，人工修正后写入 Homebox，并附有仓库和演示链接。[Reddit 原帖](https://www.reddit.com/r/homebox/comments/1pf5orf/homebox_companion_ai_powered_photo_cataloging_for/)

**试做建议：** 拍几张线材、转接头或工具的照片，手动填写「书桌第二个抽屉」。让模型生成物品名、数量、可见型号与照片编号，先存成 CSV。以后搜「HDMI 转接头」，就能找到记录的位置和对应照片。

**看什么结果：** 对照实物检查漏识别与重复计数；看不清的型号留空。位置由你提供，物品移动后更新记录。

</details>

<details>
<summary>5 · 连载学习漫画：让同一个角色解释不同概念</summary>

**社区实作：** OpenAI 社区用户 `_j` 在 2026-09-29 展示了参考已有漫画的角色与画风继续创作，并讨论通过图片编辑 API 提供参考图。[社区示例，第 1229 帖](https://community.openai.com/t/gpt-image-general-ai-art-gallery-art-created-by-users-of-openai-products-2026/1388609?page=61)

**试做建议：** 先做一张自己的 Yuuki 角色参考图，然后围绕「缓存命中 → 条件改变 → 缓存失效」写 3 格故事。每次带上参考图和角色描述，生成画面，再把下一篇概念接成新一集。

**看什么结果：** 先核对知识点与分镜，再检查角色、服装和配色是否一致；发现漂移时针对该格编辑。需要精确呈现的公式和代码，可在排版时加入。

</details>

<details>
<summary>6 · 有存档的语音冒险：让一个 NPC 记得上一回合</summary>

**社区实作：** 在 OpenAI 的 DnD 讨论中，一位作者介绍了使用 OpenAI API 制作的互动小说；讨论同时记录了语音朗读，以及作者当时尚待完善的历史上下文问题。[社区原帖，作者第 2、4 帖](https://community.openai.com/t/using-chatgpt-as-a-dm-in-dnd/259037)

**试做建议：** 设定「飞船维修店」和一个 NPC，让你通过说话选择行动，模型负责台词与叙事。应用另外保存位置、背包、任务进度，每回合把这些状态提供给模型；先玩 5 回合，再试保存和继续。

**看什么结果：** 交出去的道具是否从背包移除，重开后人物是否记得已完成的任务。可以先做文字版，确认状态连贯，再加语音与场景插画。

</details>

## 接着试什么

想先把额度用在自己的学习上，优先试 **5 张口答复习卡**；想留下直观的图片成果，试 **3 格学习漫画**。先完成上表的小样本，核对结果和平台 Usage 中的实际用量，再决定是否扩大。

核对日期只表示本文查阅过官方文档与社区帖子；本页没有执行实际付费调用，账户金额、到期时间和权限仍需在后台确认。

想先了解语音链路，读[语音交互：合成、转写与人声检测](../tts/README.md)。想搭自己的工具循环，回到 [Agent 工程总览](README.md)。
