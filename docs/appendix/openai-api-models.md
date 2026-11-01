# 附录 OpenAI API 模型分类与选型

按用途查找 OpenAI API 模型，比较能力、成本和适合本项目的用法。**第一次可以选 GPT-Transcribe 加 GPT-6.1 Sol：口述一个想法，让 AI 搭子整理成 Issue 草稿和一个可以立即开始的动作。**

资料核对：**2026-11-01**。同型号的日期快照合并说明；现役、已弃用和已停用模型分别列出。实际可用模型取决于 API 组织权限，可通过 [List models](https://developers.openai.com/api/reference/resources/models/methods/list) 查询。模型定位和价格来自官方资料，“适合本项目的用法”是选型建议。[官方模型目录](https://developers.openai.com/api/docs/models/all)

## 类型速查

| 类型 | 想得到什么 | 优先试哪个 |
| --- | --- | --- |
| 通用推理与编程 | 讨论想法、拆任务、写代码、推进 Issue | GPT-6.1 Sol |
| 视觉理解与电脑操作 | 理解截图、检查界面、操作应用 | GPT-6.1 Terra |
| 批量文本处理 | 分类、提取字段、整理大量记录 | GPT-6 Luna |
| 图片生成与编辑 | 封面、角色、贴纸、修改参考图 | Sunburst 做精确编辑，Flare 做日常快速生成 |
| 语音对话与输出 | 自然交谈、语音答复、调用工具 | GPT-Live 1 或 GPT-Realtime-2.1 Mini |
| 语音转写 | 把录音或实时讲话变成文字 | 文件用 GPT-Transcribe，实时用 GPT-Live-Transcribe |
| 实时翻译 | 边听边返回翻译后的语音与文字 | GPT-Realtime-Translate |
| 文本检索 | 从笔记、截图说明和历史 Issue 找回资料 | text-embedding-3-small |
| 内容分类 | 识别文字与图片中的潜在有害内容 | omni-moderation-latest |
| 专业领域 | 安全研究、生命科学、法律用途 | 按领域和开通条件选择 |
| 开放权重 | 本地部署、定制与微调 | gpt-oss-20b 或 gpt-oss-120b |

目录中的类型对应下文各节。需要用到某种能力时再查看对应模型。

## 通用推理与编程

下面四个主力模型都能接收文字和图片，输出文字。生成图片和语音需要使用相应的专用模型。模型发出工具调用后，应用或执行环境还要负责运行 GitHub、MCP 或电脑操作工具。

价格为标准处理模式下的美元单价，单位是**每百万文本 token**，按“输入／输出”排列。输入超过 272K token 的请求有长上下文加价；缓存、处理模式和工具费用另计。

| 模型 | 主要特点 | 适合本项目的用法 | 输入／输出 |
| --- | --- | --- | ---: |
| [gpt-6.1-sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | 面向复杂编程、电脑操作和专业工作 | 默认主脑：讨论想法、拆任务、整理 Issue、推进项目 | $2／$10 |
| [gpt-6.1-terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) | 强调视觉理解、电脑操作和自然写作 | 看截图、理解界面、检查页面、修改课程文案 | $1／$5 |
| [gpt-6-luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | 面向明确、大量、成本敏感的任务 | Issue 分类、字段提取、整理转写后的文字、生成标签 | $0.10／$0.50 |
| [gpt-6-astra](https://developers.openai.com/api/docs/models/gpt-6-astra) | 面向最困难的推理、研究和编程 | 疑难排查、复杂架构、需要深入比较的问题，按需升级使用 | $10／$50 |

Issue 自动化可以先用 Sol 跑通流程。任务量增加后，再把分类与字段提取交给 Luna；需要处理截图时比较 Terra，遇到难题时再测试 Astra。

## 图片生成与编辑

| 模型 | 主要特点 | 适合本项目的用法 |
| --- | --- | --- |
| [gpt-image-2.5-sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) | 强调生成质量和精确编辑 | 根据角色参考图调整表情、服装和场景，反复打磨封面或学习漫画 |
| [gpt-image-2.5-flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare) | 强调快速、高质量的日常生成 | 把想法画出来、生成任务贴纸、探索多个视觉方向 |
| [gpt-image-2](https://developers.openai.com/api/docs/models/gpt-image-2) | 支持生成、编辑、灵活尺寸和高保真图片输入 | 已有项目可继续使用；新项目先比较上面两个模型 |

Sunburst 与 Flare 公布的标准 token 单价相同：文字输入 $5、图片输入 $8、图片输出 $30，单位均为每百万 token。Flare 的定位优势主要是速度；实际单张费用还取决于尺寸、质量与参考图消耗。[图片计费](https://developers.openai.com/api/docs/pricing)

## 语音对话与输出

| 模型 | 主要特点 | 适合本项目的用法 |
| --- | --- | --- |
| [gpt-live-1](https://developers.openai.com/api/docs/models/gpt-live-1) | 支持自然的实时交谈、边听边说与打断，并把任务交给后端 Agent | 语音搭子负责交谈，需要处理项目时委托 Sol；会话 $0.05／分钟，后端模型与工具另计 |
| [gpt-realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) | 实时语音、可配置推理和工具调用 | 边交谈边查资料、处理任务，或通过连接音乐服务的工具控制播放 |
| [gpt-realtime-2.1-mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini) | 更快、成本更低的实时语音推理 | 轻量语音助手、任务确认、口语练习与语音输出 |
| [gpt-realtime-2](https://developers.openai.com/api/docs/models/gpt-realtime-2) | 上一版实时语音推理模型 | 已有项目可保留；新项目先比较 2.1，其改进包括数字字母识别、噪声处理和打断行为 |
| [gpt-realtime-1.5](https://developers.openai.com/api/docs/models/gpt-realtime-1.5) | 较早的实时语音 Agent 模型 | 维护已有语音应用；新的搭子原型优先比较 Live 或 2.1 |
| [gpt-audio-1.5](https://developers.openai.com/api/docs/models/gpt-audio-1.5) | 通过 Chat Completions 接收和输出音频 | 一段音频输入、一个语音答复，接入已有的请求式应用 |

GPT-Live 负责交谈，后端 Agent 负责推理和工具任务。应用保存进度、运行自己的函数工具，并决定用户打断后是否继续后端工作。[GPT-Live 工作方式](https://developers.openai.com/api/docs/guides/live)

Realtime 按音频、文字等 token 分项收费。2.1 的音频输入／输出为 $32／$64，Mini 为 $10／$20，单位是每百万音频 token；它们的文字价格和 GPT-Live 的按分钟价格分别计算。[语音计费](https://developers.openai.com/api/docs/pricing)

## 语音转写

| 模型 | 主要特点 | 适合本项目的用法 | 每分钟 |
| --- | --- | --- | ---: |
| [gpt-transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe) | 已录完的文件、文件转写流和指定的 Realtime 提交回合转写 | 语音日记、随口记想法、口述 Issue；一小时约 $0.27 | $0.0045 |
| [gpt-live-transcribe](https://developers.openai.com/api/docs/models/gpt-live-transcribe) | 低延迟实时转写 | 讲话时同步显示文字、实时字幕、会议记录 | $0.017 |
| [gpt-realtime-whisper](https://developers.openai.com/api/docs/models/gpt-realtime-whisper) | 实时转写，可调整延迟与准确率 | 维护已有集成；官方建议新项目从 Live-Transcribe 开始 | $0.017 |

处理已经录完的文件，优先用 GPT-Transcribe；接麦克风实时输入，优先用 GPT-Live-Transcribe。文件转写也可以流式返回文字，是否需要实时连接取决于音频是否正在到达。[转写工作流](https://developers.openai.com/api/docs/guides/transcription)

## 实时翻译

[gpt-realtime-translate](https://developers.openai.com/api/docs/models/gpt-realtime-translate) 在接收源语音时持续返回翻译后的音频与文字，按音频时长计费，价格为 **$0.034／分钟**。

适合跨语言交流和实时翻译工具。它使用专门的实时翻译接口；从旧的录音文件翻译接口迁移时，需要调整会话流程。

## 文本检索与内容分类

| 模型 | 主要特点 | 适合本项目的用法 | 价格 |
| --- | --- | --- | ---: |
| [text-embedding-3-small](https://developers.openai.com/api/docs/models/text-embedding-3-small) | 把文字转换成用于比较相关性的向量 | 搜索个人笔记、寻找相似 Issue，先用它验证检索是否有用 | $0.02／百万输入 token |
| [text-embedding-3-large](https://developers.openai.com/api/docs/models/text-embedding-3-large) | 更强调检索质量，覆盖英语与非英语任务 | 中文资料库可以拿它和 small 比较实际命中率 | $0.13／百万输入 token |
| [text-embedding-ada-002](https://developers.openai.com/api/docs/models/text-embedding-ada-002) | 较老的向量模型 | 维持已有索引，新项目优先比较第三代 | $0.10／百万输入 token |
| [omni-moderation-latest](https://developers.openai.com/api/docs/models/omni-moderation-latest) | 识别文字和图片中的潜在有害内容 | 产品开放给其他用户时按需要接入 | 免费 |

Embedding 帮助找回相关内容。持久记忆仍需要应用保存笔记、对话和任务状态，并在需要时把检索结果交给通用模型。

## 专业领域

| 类型 | 模型或配置 | 主要用途与条件 | 输入／输出 |
| --- | --- | --- | ---: |
| 网络安全 | [gpt-5.6-cyber](https://developers.openai.com/api/docs/models/gpt-5.6-cyber) | 获授权的漏洞研究与安全测试，需要单独审批和开通 | $12.50／$75 |
| 生命科学 | gpt-6-rosalind | 生命科学专用，限经过批准的组织研究使用 | $15／$75 |
| 生命科学 | gpt-rosalind-research | Rosalind 系列，限经过批准的组织研究使用 | $5／$25 |
| 生命科学 | gpt-rosalind-discovery | Rosalind 系列，限经过批准的组织研究使用 | $5／$25 |
| 法律 | gpt-6-astra-law | 官方列为法律用途配置，是否可调用以账户开通情况为准 | $10／$50 |

价格单位为每百万文本 token。Rosalind research 与 discovery 的详细能力差异不能仅凭名称判断；选用时按获批用途和对应产品说明核对。这些领域模型与当前课程、Issue 自动化和搭子原型关联较小。[专业配置与价格](https://developers.openai.com/api/docs/pricing)

## 开放权重

| 模型 | 主要特点 | 适合本项目的用法 |
| --- | --- | --- |
| [gpt-oss-20b](https://developers.openai.com/api/docs/models/gpt-oss-20b) | 面向低延迟、本地或专门用途的开放权重模型，支持微调 | 实验本地搭子、定制模型，需要准备推理环境 |
| [gpt-oss-120b](https://developers.openai.com/api/docs/models/gpt-oss-120b) | 更大的开放权重模型，官方标注可容纳于单张 H100 | 有相应算力时比较自部署与托管模型的效果、成本和维护工作 |

这两个模型采用 Apache 2.0 许可，属于自行或第三方部署的路线。使用自己的推理环境时，成本主要来自硬件或托管服务。

## 仍可用的较早通用模型

这些型号保留在官方目录中。已有项目可以维持已经验证的工作流；新项目按任务、延迟和实际消耗与前面的主力模型比较。价格为每百万文本 token 的标准输入／输出价。

| 模型 | 主要用途与选型建议 | 输入／输出 |
| --- | --- | ---: |
| [gpt-6-sol](https://developers.openai.com/api/docs/models/gpt-6-sol) | 编程与 Agent；新项目先试更新的 6.1 Sol | $2／$10 |
| [gpt-5.6-sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) | 上一代复杂任务主力；适合保留已验证行为，当前促销价至少持续至 2026-11-21 | $4／$20 |
| [gpt-5.6-terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) | 上一代平衡型模型；与 6.1 Terra、Sol 实测比较 | $2／$12 |
| [gpt-5.6-luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) | 上一代低成本批处理模型；新分类任务先看 GPT-6 Luna | $0.20／$1.20 |
| [gpt-5.5](https://developers.openai.com/api/docs/models/gpt-5.5) | 复杂专业工作；新原型先测试较便宜的 Sol | $5／$30 |
| [gpt-5.5-pro](https://developers.openai.com/api/docs/models/gpt-5.5-pro) | 使用更多计算处理难题，部分请求可能耗时数分钟，适合专项比较 | $30／$180 |
| [gpt-5.4](https://developers.openai.com/api/docs/models/gpt-5.4) | 编程与专业工作，主要考虑已有集成 | $2.50／$15 |
| [gpt-5.4-pro](https://developers.openai.com/api/docs/models/gpt-5.4-pro) | 较重的推理版本，价格与 5.5 Pro 相同，选用需要具体任务依据 | $30／$180 |
| [gpt-5.4-mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini) | 编程、电脑操作和大量小任务，可作为小模型对照组 | $0.75／$4.50 |
| [gpt-5.2](https://developers.openai.com/api/docs/models/gpt-5.2) | 较早的专业任务主力；输入单价略低于 6.1 Sol，输出单价更高，需要按实际用量比较 | $1.75／$14 |
| [gpt-5.2-pro](https://developers.openai.com/api/docs/models/gpt-5.2-pro) | 较早的重推理模型；成本和等待时间不适合作为本项目默认搭子 | $21／$168 |

## 已弃用但尚未停用

“已弃用”表示已经进入退出流程，在计划停用前仍可能调用；“已停用”表示接口不再提供访问。下面按类型识别旧教程中的模型，新项目优先选择对应的现役路线。日期针对公告所列别名与快照，更早的快照可能已经停用。[停用公告与快照范围](https://developers.openai.com/api/docs/deprecations)

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

[Daybreak Red](https://developers.openai.com/api/docs/models/gpt-daybreak-red-latest) 与 [Daybreak Blue](https://developers.openai.com/api/docs/models/gpt-daybreak-blue-latest) 也是已弃用的安全模型别名，所查模型页未列明具体停用日。

迁移转写功能时，要核对说话人标签、时间戳与输出格式；更换模型名不保证这些能力原样保留。旧 TTS 的替代路线使用 Realtime API，也需要调整接口流程。[转写迁移](https://developers.openai.com/api/docs/guides/transcription)、[语音输出迁移](https://developers.openai.com/api/docs/guides/text-to-speech)

## 已停用的旧路线

Sora 2 与 Videos API 已于 2026-09-24 停用；GPT-Image-1 已于 2026-10-23 停用。旧 Deep Research 专用模型、computer-use-preview 及部分 Codex、Chat 和音频快照也已经停用，不能依据旧教程把它们当成当前入口。[完整停用记录](https://developers.openai.com/api/docs/deprecations)

## 试做方案 开工搭子

**第一版只做一次口述到草稿的往返。** 例如按住录音说：“我现在有点乱，想给项目加一个功能，却不知道从哪里开始。”

1. 录下约 30 秒想法，由 GPT-Transcribe 转成文字。
2. 将文字交给 GPT-6.1 Sol，整理出 Issue 标题、现象、期望和完成条件。
3. 单独突出一个可以立刻开始的动作，写明做到哪里就可以停。
4. 核对草稿；确认需要提交后，再由接入的 GitHub 工具创建 Issue。

**停止点：得到一份可修改的 Issue 草稿和一个明确动作。** 这是一项待实现的小实验。之后需要自然交谈时，可以接入 GPT-Live，把复杂任务交给后端 Sol。

准备实际接入时，按需查阅[API 额度与调用入口](../agent-engineering/openai-api.md)、[语音与多模态小项目](../agent-engineering/openai-api-projects.md)和[Issue 自动化](../issue-garden/README.md)。
