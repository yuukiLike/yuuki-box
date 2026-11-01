// 每次只启动一个小目标；完成它不等于读完或掌握整章。
/** @type {Record<string, [string, string, string?]>} */
export const learningSteps = {
  'guide': ['打开 MCP 第一课，先看它要保存哪一份记录。', '能说出这次要保存什么、怎样取回，就先停。', 'MCP 入门'],
  'ai-from-scaling': ['只看 MCP 练习的两种入口，先选 Codex 接入。', '知道第一课的文件和入口就停，四小时路线留到以后。'],
  'ai-from-scaling/00-codex-mcp': ['先看 MCP 全景，对上 Codex、Client 和「接着做」Server 的位置。', '能说清谁连接、谁读写文件，就完成这一小步。', '先看 MCP 全景'],
  'ai-from-scaling/00-minimal-mcp': ['在准备好依赖后，只运行一次本页的 demo。', '找到 tools/list、saved=true 和 found=true 三处输出就停。', '1. 运行：先看到完整结果'],
  'ai-from-scaling/01-understand-models': ['只读第一个例子，找出模型在猜什么。', '能用一句话解释“预测下一个 token”就停。'],
  'ai-from-scaling/02-train-a-model': ['按第一节运行一次训练前的字符模型。', '保存一段训练前的输出就停，先不调整参数。'],
  'ai-from-scaling/03-build-a-harness': ['沿第一节的一次任务，找出模型请求和工具结果。', '能指认一次“模型 → 工具 → 模型”的往返就停。'],
  'ai-from-scaling/04-experiments': ['只检查第一节列出的真实模型接入条件。', '记下已有条件和缺少的一项条件就停。'],
  'ai-from-scaling/05-blender-mcp': ['先检查 Blender 与示例的运行条件，再按运行节做一次演示。', '找到第一次生成的文件就停，尺寸修改留到下一次。', '1. 运行：找到真正生成的文件'],
  'ai-from-scaling/06-github-lab-mcp': ['按运行节取得一次报告，先读报告里的基线结果。', '找到同一断言在修复前后的结果就停。', '1. 运行：先取得一份真实报告'],
  'ai-from-scaling/07-weatherkit-mcp': ['只运行离线天气样本。', '看到一份地点与出门时段的结果就停，Apple 配置以后再做。', '1. 跑通离线样本，先看一份有用的结果'],
  'ai-from-scaling/07-music-space-mcp': ['按“打开第一场实验”准备示例并打开预览。', '看到第一份音乐可视化就停，导出留到下一次。'],
  'ai-from-scaling/08-music-photo-mcp': ['按“打开剧场”打开现有示例。', '看见照片图层与音乐一起变化就停。'],
  'ai-from-scaling/extra-tool-use-story': ['只读“五个零件”。', '能区分模型、工具和执行器就停，历史时间线是选读。'],
  'agent-engineering': ['只看“先跑通两课”，找到 Harness 入门第一课。', '知道工具循环从哪里开始就停。'],
  'agent-engineering/01-mcp-tool-source': ['在第一项定位练习里找出现有工具执行入口。', '记下一个函数名和文件位置就停。', '1. 定位：先找到现有工具执行入口'],
  'agent-engineering/02-mcp-policy': ['只看第一项配置，圈出两个允许执行的只读工具。', '能指出允许与拒绝的判断位置就停。', '1. 配置：只允许两个已核对的只读工具'],
  'agent-engineering/03-skills-structure': ['只看 Skill 的组成，找出 description 与正文。', '能说清“什么时候触发”和“怎样执行”分别写在哪里就停。'],
  'agent-engineering/04-skills-validation': ['只读“为什么需要脚本”，选一个可检查的完成条件。', '写下一条通过条件和一条失败条件就停。'],
  'agent-engineering/05-harness-vertical-slice': ['从六个状态场景中只看“用户取消”这一项。', '写出取消后的预期状态就停，其他场景以后逐项做。', '六个状态场景'],
  'agent-engineering/06-context-and-report': ['先看“两本账”，区分模型用量和本地运行记录。', '各写一个应记录的字段就停。'],
  'agent-engineering/07-scenario-regression': ['只看三层测试各自检查什么。', '给一个取消问题选定测试层就停。'],
  'agent-engineering/computer-use': ['只看正文的第一次“观察 → 动作 → 检查”说明。', '能说明为什么动作之后还要再观察就停。'],
  'agent-engineering/cua-repl': ['先阅读连接与状态的说明，找到第一次观察的入口。', '能区分桌面应用连接与浏览器连接就停。'],
  'agent-engineering/computer-use-ecosystem': ['只比较你正在用的工具与另一个方案。', '记下一个连接入口的差别就停。'],
  'agent-engineering/computer-use-misconceptions': ['只做第一道自测，先自己回答再看说明。', '能指出自己的答案缺少哪条证据就停。'],
  'agent-engineering/hooks': ['先看一个 Hook 在什么时候触发、收到什么输入。', '能指出“事件”和“执行动作”就停。'],
  'agent-engineering/openai-api': ['只核对额度入口、到期日期和当前可用范围。', '记下额度是否可用就停，先不发起模型调用。'],
  'agent-engineering/openai-api-projects': ['只看语音灵感卡的第一个项目。', '写下一份输入和想拿回的产物就停。'],
  'ai-communication': ['只找到 RPC 第一课和它的运行命令。', '知道第一条命令会让另一个程序做什么就停。'],
  'ai-communication/01-rpc': ['按“先运行”执行一次例子。', '看到另一个进程返回笔记内容就停。'],
  'ai-communication/02-json-rpc': ['按“先运行”执行一次请求。', '在输出里找到同一请求的 id 和 result 就停。'],
  'ai-communication/03-sse': ['按“先运行”观察第一组分段响应。', '看到内容分几次到达就停。'],
  'ai-communication/03-sse-http': ['先按运行节建立一次 HTTP 流连接。', '看到第一条事件就停，断流实验下一次再做。'],
  'ai-communication/04-mcp': ['先在角色表里找到 Host、Client 和 Server。', '能指出真正读写文件的是谁就停。'],
  'ai-communication/05-failure': ['运行第一个失败例子，只看它怎样报告错误。', '记下错误是否被当成成功就停。'],
  'ai-communication/06-yuuki': ['先看图，只沿一条请求追到执行端。', '找到请求进入执行端的位置就停。'],
  'ai-communication/weather-mcp': ['只看“今天先做到哪里”，确定第一份成果。', '能区分用户凭证和 Apple 凭证就停。'],
  'ai-communication/weather-mcp/01-user-journey': ['只读用户连接时看到的四步。', '能按顺序复述登录、授权和工具查询就停。'],
  'ai-communication/weather-mcp/02-supabase-auth': ['先把第一节的三个地址抄到自己的练习记录。', '能指出客户端、授权服务与回调各是哪一个就停。'],
  'ai-communication/weather-mcp/03-apple-weatherkit': ['只核对第一节需要准备的四个值。', '列出自己已经具备和仍缺少的条件就停，不粘贴私钥。'],
  'ai-communication/weather-mcp/04-mcp-server': ['先看完整目录，找到用户鉴权和天气查询分别在哪个文件。', '记下这两个位置就停。'],
  'ai-communication/weather-mcp/05-connect-and-verify': ['只核对练习工程是否具备第一节列出的代码。', '确认目录齐全或记下一个缺口就停。'],
  'ai-ideas': ['只填写“给它什么”和“想拿回什么”两行。', '得到一个具体的小实验题目就停。'],
  'ai-ideas/01-ideas-map': ['只看 Issue 夜班这一条构想。', '能说出一次任务的输入和交付物就停。', '你的设想一：白天记 Issue，AI 夜间修复'],
  'ai-ideas/02-five-new-directions': ['只看故障驱动方向，先找一份可脱敏的错误记录。', '记下这份记录能回答什么问题就停，其他方向留作选读。'],
  'ai-practices': ['先看 Issue 到 PR 的第一项实践。', '知道一份任务单需要哪些验收条件就停。'],
  'ai-practices/your-workflow': ['只看“下一次只试一件事”，选一个边界清楚的小 bug。', '写出一次复现的操作与预期结果就停。', '下一次只试一件事'],
  'ai-practices/01-coderabbit-review': ['先看公开审查记录中的一条意见。', '记下它的触发条件和验证方法就停。'],
  'ai-practices/02-issue-to-pr': ['只读“从任务单到交付物”。', '用一句话写出一个小 Issue 的验收条件就停。', '从任务单到交付物'],
  'ai-practices/03-error-to-fix': ['从案例里只找一条支撑根因的运行证据。', '能区分观察与假设就停。'],
  'ai-practices/04-security-autofix': ['只追踪一个告警从哪里进入危险路径。', '写出它的输入条件就停，先不尝试批量修复。', '告警怎样走到补丁'],
  'ai-practices/05-test-generation': ['只看候选测试为什么会被淘汰。', '能举出一个“通过但无效”的测试就停。'],
  'ai-practices/06-code-migration': ['只为一个依赖升级填写改前、改后和检查方式。', '得到一条能回查的迁移记录就停。', '把升级拆成一条能回查的路径'],
  'architecture/ai-and-speech-foundation': ['只沿功能闭环看一次语音输入怎样变成模型任务。', '能指出转写结束、模型开始的位置就停。'],
  'architecture/mac-local-harness': ['只读已确认目标与当前范围。', '记下第一版要完成的一条本地闭环就停。'],
  'architecture/technology-assessment': ['只看第一节，选一个需要比较的用户行为。', '写出这次比较要回答的问题就停。'],
  'appendix/openai-api-models': ['只看类型速查，选择这次想用到的一种能力。', '记下一个候选模型和想得到的产物就停。', '类型速查'],
  'codex-cloud': ['先看本页的最快入口，选择 for-safe 的只读任务。', '找到创建环境与第一条任务的入口就停。'],
  'codex-cloud/01-for-safe': ['打开 Codex 新任务，选择 Cloud，再打开环境选择器。', '确认 for-safe 是否已有已发布环境，就完成这次启动。', '② 创建并发布环境'],
  'codex-cloud/02-community': ['只看第一种社区用法。', '记下一项云端实际做过的工作与一项仍需人检查的结果就停。'],
  'codex-cloud/03-for-job': ['先核对仓库说明里的安装与检查条件。', '确认能否开始一次基线检查就停，导出回归下一次再做。'],
  'codex-cloud/04-agent-symphony': ['先看事件样本与真实宿主接入的区别。', '能说出本轮样本验证不覆盖什么就停。'],
  'codex-cloud/05-issue-to-pr': ['先读三条路线的比较，只为这一次选定一条。', '写下仓库、Issue 和执行路线就停，先不启动并行实验。'],
  'deep/2026-09-26-simplicity-composition-complexity': ['先看阅读路线，只挑“组合成立需要什么”这一个问题。', '选出要读的一节就停。'],
  'deep/2026-09-26-simplicity-composition-complexity/01-framework': ['只读第一节，给“简单”指定一个使用者和一个任务。', '写出“谁做什么时觉得简单”就停。'],
  'deep/2026-09-26-simplicity-composition-complexity/02-raycast-warp': ['只看 Raycast 的一套操作语法。', '举出两个能复用同一种操作的对象就停。'],
  'deep/2026-09-26-simplicity-composition-complexity/03-zed-grok': ['只看 Zed 怎样复用编辑能力。', '能指出被复用的单位就停。'],
  'deep/2026-09-26-simplicity-composition-complexity/04-yuuki': ['先读观察时点，区分已有实现和后续设想。', '记下一个已有能力和一项未验证行为就停。'],
  'deep/2026-09-26-zed-pi-rust': ['只看关键结论中的第一项。', '记下一条需要源码支持的判断就停。', '关键结论'],
  'deep/2026-09-26-zed-pi-rust/01-why-rust': ['先看第一节，把“选择 Rust”拆成一个具体边界。', '能区分 UI 与运行时的语言选择就停。'],
  'deep/2026-09-26-zed-pi-rust/02-zed-architecture': ['只看第一张源码阅读地图。', '找到文件打开流程的入口就停。'],
  'deep/2026-09-26-zed-pi-rust/03-pi-desktop': ['只看单一 crate 内部有哪些职责。', '能指出一个宿主职责和一个 sidecar 职责就停。'],
  'deep/2026-09-26-zed-pi-rust/04-yuuki-box': ['只沿自己最熟悉的一条现有实现看调用路径。', '找到 UI 与运行时的边界就停。'],
  'frontend-foundations': ['先回答本页的第一个查找问题。', '能说出数组查找在重复做什么就停。'],
  'frontend-foundations/keys-and-maps': ['只比较一次数组查找和一次 Map 查询。', '指出索引建立发生在哪一步就停。'],
  'frontend-foundations/cache-cost': ['只区分保存引用和复制内容。', '能给两种操作各举一个例子就停。'],
  'issue-garden': ['只按本页示例写一条 Issue 的现象和预期。', '得到一个能复现的小问题就停。', '写 Issue 可以很短'],
  'issue-garden/01-first-scan': ['先阅读工作流示例，确认它只读取 Issue。', '找到手动触发和读取权限两处配置就停。'],
  'issue-garden/02-first-repair': ['先给一个小问题写一条完成条件。', '另一人能按同样步骤判断修好与否，就先停。'],
  'issue-garden/03-night-shift': ['先读“一次只领一个 Issue”的选择规则。', '能说清已有 PR 的问题怎样跳过就停。'],
  'issue-garden/04-dot-shift': ['先核对你、Dot、Codex 和 GitHub 的分工。', '知道任务记录和需要你决定的问题放在哪里就停。'],
  'issue-garden/05-codex-api': ['先核对配置条件，列出 API 与仓库各需要什么。', '确定已有条件和一个缺口就停，先不运行付费工作流。'],
  'issue-garden/06-agentic-workflows': ['先看准备条件，区分工作流编译与模型执行。', '知道当前缺的是编译工具还是 API 凭据就停。'],
  'kv-cache': ['只做“改一个输入”的第一局。', '能指出缓存从哪个位置失效就停。', '第一局：改一个输入，看缓存从哪里失效'],
  'kv-cache/00-first-request': ['只看第一组消息数组。', '能指出本次用户消息和系统说明就停。'],
  'kv-cache/00-why-so-large': ['先把 KV 看作一份随 token 增长的派生数据。', '能说出容量还受层数和精度影响就停。'],
  'kv-cache/01-from-frontend': ['只区分原始输入和算出来的结果。', '能解释为什么修改前面的输入会影响后面就停。'],
  'kv-cache/02-attention-and-kv': ['先看数组例子，区分 Q、K、V 的职责。', '能说出哪些旧结果可以保留就停。'],
  'kv-cache/03-prefix-cache-and-yuuki': ['只在消息数组里找最长不变前缀。', '圈出第一个发生变化的位置就停。'],
  'kv-cache/04-deepseek-harness': ['先读请求函数，找“不需要更新”的分支。', '能说出它省掉了哪次重复工作就停。', '第一眼，先看“不需要更新”的分支'],
  'kv-cache/05-pi': ['只对照第一局里的输入与缓存 token 数。', '能解释一次用量统计的口径就停。', '第一局：把 10,000 个输入 token 对上账'],
  'kv-cache/06-study-map': ['只选“前缀为什么失效”这一个问题。', '写下一份固定输入和一个判定方法就停。'],
  'learning/ai-frontend-intersections': ['只选数组查找这一个实验，先记下输入规模。', '知道怎样比较重复工作就停。'],
  'learning/apple-reading-sync': ['先看使用者视角中的登录与同步流程。', '知道无需登录也能阅读、登录后同步什么就停。', '使用者视角 · 如何跨设备同步'],
  'learning/harness-scenario-lab': ['从十五个问题中只看自己最熟悉的一条 UI 路线。', '选定一个可观察的卡顿现象就停。', '十五个具体问题'],
  'learning/rendering-performance': ['先区分回复等待和界面卡顿。', '给一个具体问题选出应测的响应行为就停。', '1. 先理解「流畅」是哪一种感觉'],
  'mcp-projects': ['在成果表中先看离线天气工具。', '知道第一份天气结果长什么样就停，其他项目以后再选。'],
  'plan/first-mac-loop': ['只读“这轮开发的结果”。', '能描述一个输入、工具执行与结果的闭环就停。'],
  'research/zed-raycast-warp': ['只读当前结论与决策边界。', '写下一条判断及会改变它的证据就停。'],
  'side-by-side': ['先按 Issue 示例写一个想托付的小问题。', '写清现象、期望和完成条件就停，执行路线下一次再选。'],
  'tts': ['只看第一站的 edge-tts 练习。', '知道合成一句话需要的输入与输出就停。'],
  'tts/让-Yuuki-开口说第一句话': ['先检查终端和音频播放条件，再合成示例中的一句中文。', '听到第一段声音就停，换音色下一次再做。'],
  'wasm': ['先分清模块、调用边界和浏览器执行。', '能说出 JavaScript 要传给 Wasm 什么就停。'],
  'wasm/workers-and-memory': ['先看 Worker 提供了什么执行边界。', '能说出它为什么仍有数据搬运成本就停。'],
  'wasm/browser-ai': ['只看应用、运行时、模型这几层。', '能指出下载模型与执行推理发生在哪里就停。'],
  'windows-local-ai': ['先核对系统、显卡和磁盘条件。', '列出已有条件和缺少的一项条件就停，先不下载模型。'],
  'windows-local-ai/01-qwen-image': ['只做第一节的空间与驱动检查。', '确认模型存放位置和可用空间就停。'],
  'windows-local-ai/02-ace-step-music': ['先确认上一课的 ComfyUI 是否可用。', '找到配乐工作流所需的模型就停，下载与生成分开做。'],
  'labs/kv-memory': ['只改一次上下文长度，其他输入保持默认。', '看到 KV 内存怎样随长度变化就停。'],
  'labs/lookup': ['只运行一次默认规模的数组与 Map 对照。', '找到两种查询的工作量差别就停。'],
  'labs/wasm-bridge': ['只运行一次整数加法。', '看见 JavaScript 输入与 Wasm 输出对应就停。'],
};

export const learningFocusKey = 'yuuki-learning-focus';
/** @typedef {{ id: string, label: string, done: boolean, anchor?: string }} LearningFocus */

export function learningStep(id) {
  const value = Object.hasOwn(learningSteps, id) ? learningSteps[id] : undefined;
  return value && { first: value[0], stop: value[1], section: value[2] };
}

export function learningUrl(id, anchor = 'learning-step-start') {
  return learningStep(id) ? `/${id.split('/').map(encodeURIComponent).join('/')}/#${encodeURIComponent(anchor)}` : '/';
}

/** @returns {LearningFocus | null} */
export function parseLearningFocus(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || !learningStep(value.id) || typeof value.label !== 'string'
      || !value.label.trim() || value.label.length > 180 || typeof value.done !== 'boolean') return null;
    if (value.anchor !== undefined && (typeof value.anchor !== 'string' || !value.anchor
      || value.anchor.length > 256 || /[\u0000-\u001f\u007f]/.test(value.anchor))) return null;
    return { id: value.id, label: value.label, done: value.done, anchor: value.anchor };
  } catch { return null; }
}

export function saveLearningFocus(storage, value) {
  try {
    if (!parseLearningFocus(JSON.stringify(value))) return false;
    if (!storage) return false;
    storage.setItem(learningFocusKey, JSON.stringify(value));
    return true;
  } catch { return false; }
}
