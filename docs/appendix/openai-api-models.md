# 附录 OpenAI API 模型分类与选型

先按目标产物查类型速查，再比较模型、成本与用法；语音生成 Issue 的组合方案为文末选读。

核对：**2026-11-01**。日期快照合并，现役、弃用、停用分别列出。可用性按组织权限查 [List models](https://developers.openai.com/api/reference/resources/models/methods/list)；能力与价格依官方资料，本项目用法为建议。 [官方模型目录](https://developers.openai.com/api/docs/models/all)

## 类型速查

| 类型 | 目标产物 | 推荐模型 |
| --- | --- | --- |
| 通用推理与编程 | 想法、任务、代码与 Issue | GPT-6.1 Sol |
| 视觉理解与电脑操作 | 理解截图、检查界面、操作应用 | GPT-6.1 Terra |
| 批量文本处理 | 分类、提取字段、整理大量记录 | GPT-6 Luna |
| 图片生成与编辑 | 封面、角色、贴纸、修改参考图 | Sunburst 精修，Flare 快速生成 |
| 语音对话与输出 | 自然交谈、语音答复、调用工具 | GPT-Live 1 或 GPT-Realtime-2.1 Mini |
| 语音转写 | 把录音或实时讲话变成文字 | 文件用 GPT-Transcribe，实时用 GPT-Live-Transcribe |
| 实时翻译 | 边听边返回翻译后的语音与文字 | GPT-Realtime-Translate |
| 文本检索 | 检索笔记、截图说明与 Issue | text-embedding-3-small |
| 内容分类 | 识别文字与图片中的潜在有害内容 | omni-moderation-latest |
| 专业领域 | 安全研究、生命科学、法律用途 | 按领域和开通条件选择 |
| 开放权重 | 本地部署、定制与微调 | gpt-oss-20b 或 gpt-oss-120b |

按需要查对应类型即可。

## 通用推理与编程

四个主力均接文字、图片，输出文字；图片、语音生成另选专用模型。GitHub、MCP、电脑工具由应用执行。

标准处理价为**每百万文本 token**的美元输入／输出价；输入超过 272K 加收长上下文费用，缓存、模式与工具另计。

| 模型 | 主要特点 | 适合本项目的用法 | 输入／输出 |
| --- | --- | --- | ---: |
| [gpt-6.1-sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | 复杂编程、电脑与专业工作 | 通用处理：想法、任务拆分、Issue | $2／$10 |
| [gpt-6.1-terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | 视觉、电脑操作与自然写作 | 截图、界面检查、课程文案 | $1／$5 |
| [gpt-6-luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | 明确、批量、成本敏感任务 | Issue 分类、提取、转写整理、标签 | $0.10／$0.50 |
| [gpt-6-astra](https://developers.openai.com/api/docs/models/gpt-6-astra) | 最困难的推理、研究、编程 | 疑难、复杂架构与深入比较 | $10／$50 |

先用 Sol 跑 Issue；批量分类交 Luna，看图比较 Terra，难题再试 Astra。

## 图片生成与编辑

| 模型 | 主要特点 | 适合本项目的用法 |
| --- | --- | --- |
| [gpt-image-2.5-sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) | 强调生成质量和精确编辑 | 按参考图调整角色、场景，精修封面或漫画 |
| [gpt-image-2.5-flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare) | 强调快速、高质量的日常生成 | 想法图、贴纸、多方向探索 |
| [gpt-image-2](https://developers.openai.com/api/docs/models/gpt-image-2) | 生成、编辑、灵活尺寸、高保真输入 | 维护已有项目；新项目先比较上两项 |

Sunburst／Flare 同为每百万 token：文字输入 $5、图片输入 $8、图片输出 $30。Flare 主打速度，单张费用随尺寸、质量和参考图变化。 [图片计费](https://developers.openai.com/api/docs/pricing)

## 语音对话与输出

| 模型 | 主要特点 | 适合本项目的用法 |
| --- | --- | --- |
| [gpt-live-1](https://developers.openai.com/api/docs/models/gpt-live-1) | 实时交谈、边听边说、打断、后端 Agent 委派 | 交谈并委托 Sol；会话 $0.05／分钟，后端与工具另计 |
| [gpt-realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) | 实时语音、可配置推理和工具调用 | 交谈、查资料、任务与工具控制音乐 |
| [gpt-realtime-2.1-mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini) | 更快、成本更低的实时语音推理 | 轻量助手、任务确认、口语与语音输出 |
| [gpt-realtime-2](https://developers.openai.com/api/docs/models/gpt-realtime-2) | 上一版实时语音推理模型 | 维护旧项目；新项目比较 2.1 的数字字母识别、噪声与打断改进 |
| [gpt-realtime-1.5](https://developers.openai.com/api/docs/models/gpt-realtime-1.5) | 较早的实时语音 Agent 模型 | 维护旧项目；新原型先比较 Live／2.1 |
| [gpt-audio-1.5](https://developers.openai.com/api/docs/models/gpt-audio-1.5) | 通过 Chat Completions 接收和输出音频 | 已有请求式应用的一问一答 |

Live 负责交谈，后端 Agent 做推理与工具任务；进度、函数执行及打断后的任务处置由应用管理。 [GPT-Live 工作方式](https://developers.openai.com/api/docs/guides/live)

每百万音频 token 输入／输出：2.1 为 $32／$64，Mini 为 $10／$20；文字另计，Live 按分钟计费。 [语音计费](https://developers.openai.com/api/docs/pricing)

## 语音转写

| 模型 | 主要特点 | 适合本项目的用法 | 每分钟 |
| --- | --- | --- | ---: |
| [gpt-transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe) | 文件、文件流及指定 Realtime 提交回合转写 | 语音日记、随口记想法、口述 Issue；一小时约 $0.27 | $0.0045 |
| [gpt-live-transcribe](https://developers.openai.com/api/docs/models/gpt-live-transcribe) | 低延迟实时转写 | 同步文字、字幕、会议记录 | $0.017 |
| [gpt-realtime-whisper](https://developers.openai.com/api/docs/models/gpt-realtime-whisper) | 实时转写，可调整延迟与准确率 | 维护旧集成；新项目建议 Live-Transcribe | $0.017 |

录完文件选 Transcribe，实时麦克风选 Live-Transcribe；文件也可流式返回，实时连接取决于音频是否持续到达。 [转写工作流](https://developers.openai.com/api/docs/guides/transcription)

## 实时翻译

[gpt-realtime-translate](https://developers.openai.com/api/docs/models/gpt-realtime-translate) 边接语音边返回翻译音频与文字，**$0.034／分钟**。

适合实时跨语言交流；使用专用接口，从旧文件翻译迁移须改会话流程。

## 文本检索与内容分类

| 模型 | 主要特点 | 适合本项目的用法 | 价格 |
| --- | --- | --- | ---: |
| [text-embedding-3-small](https://developers.openai.com/api/docs/models/text-embedding-3-small) | 文字转相关性向量 | 先验笔记、相似 Issue 检索 | $0.02／百万输入 token |
| [text-embedding-3-large](https://developers.openai.com/api/docs/models/text-embedding-3-large) | 强调英语、非英语检索质量 | 中文库与 small 比命中率 | $0.13／百万输入 token |
| [text-embedding-ada-002](https://developers.openai.com/api/docs/models/text-embedding-ada-002) | 较老的向量模型 | 维护旧索引，新项目先比较第三代 | $0.10／百万输入 token |
| [omni-moderation-latest](https://developers.openai.com/api/docs/models/omni-moderation-latest) | 识别文字和图片中的潜在有害内容 | 产品开放给其他用户时按需要接入 | 免费 |

Embedding 找相关内容；应用仍须保存记忆、任务状态，并将检索结果交给模型。

## 专业领域

| 类型 | 模型或配置 | 主要用途与条件 | 输入／输出 |
| --- | --- | --- | ---: |
| 网络安全 | [gpt-5.6-cyber](https://developers.openai.com/api/docs/models/gpt-5.6-cyber) | 授权安全研究、测试；须单独审批 | $12.50／$75 |
| 生命科学 | gpt-6-rosalind | 生命科学；限获批组织研究 | $15／$75 |
| 生命科学 | gpt-rosalind-research | Rosalind 系列，限经过批准的组织研究使用 | $5／$25 |
| 生命科学 | gpt-rosalind-discovery | Rosalind 系列，限经过批准的组织研究使用 | $5／$25 |
| 法律 | gpt-6-astra-law | 法律配置；按账号开通情况调用 | $10／$50 |

单位为每百万文本 token。Rosalind research／discovery 按获批用途核对能力，不能仅凭名字区分；与当前课程和 Issue 原型关联较小。 [专业配置与价格](https://developers.openai.com/api/docs/pricing)

## 开放权重

| 模型 | 主要特点 | 适合本项目的用法 |
| --- | --- | --- |
| [gpt-oss-20b](https://developers.openai.com/api/docs/models/gpt-oss-20b) | 低延迟、本地／专用，支持微调 | 本地助手、定制；需推理环境 |
| [gpt-oss-120b](https://developers.openai.com/api/docs/models/gpt-oss-120b) | 更大模型，官方标注单张 H100 可容纳 | 有算力时比较自部署／托管的效果与成本 |

两者为 Apache 2.0，自行或第三方部署；费用主要是硬件与托管服务。

## 仍可用的较早通用模型

以下仍列官方目录；已有流程可保留，新项目比较任务表现、延迟与实耗。价格为标准每百万文本 token 输入／输出。

| 模型 | 主要用途与选型建议 | 输入／输出 |
| --- | --- | ---: |
| [gpt-6-sol](https://developers.openai.com/api/docs/models/gpt-6-sol) | 编程与 Agent；新项目先试更新的 6.1 Sol | $2／$10 |
| [gpt-5.6-sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) | 上一代复杂主力；保留已验行为，促销至少至 2026-11-21 | $4／$20 |
| [gpt-5.6-terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) | 上一代平衡型；与 6.1 Terra／Sol 比较 | $2／$12 |
| [gpt-5.6-luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) | 上一代批处理；新分类先看 GPT-6 Luna | $0.20／$1.20 |
| [gpt-5.5](https://developers.openai.com/api/docs/models/gpt-5.5) | 复杂专业工作；新原型先测试较便宜的 Sol | $5／$30 |
| [gpt-5.5-pro](https://developers.openai.com/api/docs/models/gpt-5.5-pro) | 更多计算解难题；可能耗时数分钟，按需比较 | $30／$180 |
| [gpt-5.4](https://developers.openai.com/api/docs/models/gpt-5.4) | 编程与专业工作，主要考虑已有集成 | $2.50／$15 |
| [gpt-5.4-pro](https://developers.openai.com/api/docs/models/gpt-5.4-pro) | 重推理，与 5.5 Pro 同价；按任务选择 | $30／$180 |
| [gpt-5.4-mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini) | 编程、电脑、大量小任务的对照组 | $0.75／$4.50 |
| [gpt-5.2](https://developers.openai.com/api/docs/models/gpt-5.2) | 较早专业主力；比 6.1 Sol 输入便宜、输出贵，按实耗比较 | $1.75／$14 |
| [gpt-5.2-pro](https://developers.openai.com/api/docs/models/gpt-5.2-pro) | 较早重推理；成本与等待不适合默认助手 | $21／$168 |

## 已弃用但尚未停用

**弃用进入退出流程，<mark class="caution">计划停用前可能仍可调用</mark>；停用则不再提供接口。** 下表日期限公告别名／快照，更早快照可能已停用。 [停用公告与快照范围](https://developers.openai.com/api/docs/deprecations)

| 类型 | 模型 | 原本用途 | 计划停用 |
| --- | --- | --- | --- |
| 通用 | GPT-5 | 通用推理、编程、Agent | 2026-12-11 |
| 通用 | GPT-5 Mini | 较低成本的明确任务 | 2026-12-11 |
| 通用 | GPT-5 Nano | 摘要、分类 | 2026-12-11 |
| 通用 | GPT-5 Pro | 更重的推理 | 2026-12-11 |
| 通用 | o3 | 数学、编程、视觉推理 | 2026-12-11 |
| 通用 | o3-pro | 使用更多计算的 o3 | 2026-12-11 |
| 通用 | GPT-5.1 | 编程、Agent | 2027-04-01 |
| 编程 | GPT-5.3-Codex | Agent 编程 | 2027-04-01 |
| 通用 | GPT-5.4 Nano | 分类、提取、排序 | 2027-04-01 |
| 通用 | GPT-4o | 文字与视觉任务 | 2027-01-14 |
| 通用 | GPT-4o Mini | 轻量文字与视觉任务 | 2027-01-14 |
| 通用 | GPT-4.1 | 长上下文、指令与工具调用 | 2027-01-14 |
| 通用 | GPT-4.1 Mini | 更轻量的 4.1 | 2027-01-14 |
| 转写 | GPT-4o Transcribe | 录音转文字 | 2027-02-26 |
| 转写 | GPT-4o Mini Transcribe | 较低成本转写 | 2027-02-26 |
| 转写 | GPT-4o Transcribe Diarize | 带说话人区分的转写 | 2027-02-26 |
| 转写 | Whisper-1 | 转写、字幕时间戳等旧工作流 | 2027-02-26 |
| 语音输出 | GPT-4o Mini TTS | 文字转语音 | 2027-01-06 |
| 语音输出 | TTS-1 | 强调速度的文字转语音 | 2027-01-06 |
| 语音输出 | TTS-1 HD | 强调质量的文字转语音 | 2027-01-06 |
| 语音对话 | GPT-Realtime | 旧版实时语音 | 2027-01-20 |
| 语音对话 | GPT-Realtime Mini | 旧版低成本实时语音 | 2027-01-20 |
| 音频输入输出 | GPT-Audio | 旧版请求式音频输入输出 | 2027-01-20 |
| 音频输入输出 | GPT-Audio Mini | 旧版低成本请求式音频 | 2027-01-20 |
| 图片 | GPT-Image-1.5 | 上一代图片生成、编辑 | 2026-12-01 |
| 图片 | GPT-Image-1 Mini | 低成本旧版图片模型 | 2026-12-01 |
| 图片 | chatgpt-image-latest | 指向此前 ChatGPT 图片模型的别名 | 2026-12-01 |

[Daybreak Red](https://developers.openai.com/api/docs/models/gpt-daybreak-red-latest)／[Blue](https://developers.openai.com/api/docs/models/gpt-daybreak-blue-latest) 也已弃用，模型页未列停用日。

转写迁移须核对说话人、时间戳与格式；旧 TTS 改用 Realtime API，不能只换模型名。 [转写迁移](https://developers.openai.com/api/docs/guides/transcription)、[语音输出迁移](https://developers.openai.com/api/docs/guides/text-to-speech)

## 已停用的旧路线

Sora 2／Videos API 于 2026-09-24、GPT-Image-1 于 2026-10-23 停用；旧 Deep Research、computer-use-preview 及部分 Codex／Chat／音频快照亦已停用。 [完整停用记录](https://developers.openai.com/api/docs/deprecations)

<details>
<summary>选读：语音生成 Issue 草稿</summary>

<div class="heading-alias" id="试做方案-开工搭子" aria-hidden="true"></div>

## 试做方案：语音生成 Issue 草稿

**首版范围：语音输入 → Issue 草稿。**

1. 录下约 30 秒想法，由 GPT-Transcribe 转成文字。
2. 将文字交给 GPT-6.1 Sol，整理出 Issue 标题、现象、期望和完成条件。
3. 列出一个可执行动作及完成条件。
4. 核对草稿；确认需要提交后，再由接入的 GitHub 工具创建 Issue。

**交付：可修改的 Issue 草稿与明确动作。** 方案待实现；需要自然交谈时再接 Live，复杂任务交后端 Sol。

准备实际接入时，按需查阅[API 额度与调用入口](../agent-engineering/openai-api.md)、[语音与多模态小项目](../agent-engineering/openai-api-projects.md)和[Issue 自动化](../issue-garden/README.md)。

</details>
