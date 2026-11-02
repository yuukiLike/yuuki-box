// 每次只启动一个小目标；完成它不等于读完或掌握整章。
/** @type {Record<string, [string, string, string?]>} */
export const learningSteps = {
  'rag': ['运行本地检索，把资料与问题交给模型。', '回答内容可与来源片段逐一核对。', '1. 检索本地资料'],
  'guide': ['运行 MCP 最简 demo，核对保存与取回流程。', '工具清单、保存结果与重启读取结果均可核对。', 'MCP 入门'],
  'ai-from-scaling': ['按最简 demo、记录服务、天气定位 MCP 学习入口。', '本地记录服务位于天气查询之前。'],
  'ai-from-scaling/00-codex-mcp': ['在仓库中安装并注册 MCP 服务。', 'Codex 可发现服务并完成保存、取回记录。', '接入 Codex'],
  'ai-from-scaling/00-minimal-mcp': ['在仓库根目录运行 `pnpm install:mini-mcp` 与 `pnpm demo:mini-mcp`。', '输出包含工具清单、保存成功及重启后取回的原文。', '1. 运行与结果'],
  'ai-from-scaling/01-understand-models': ['阅读预测示例，定位输入与预测目标。', '可解释下一 token 预测的输入与输出。'],
  'ai-from-scaling/02-train-a-model': ['运行训练前的字符模型。', '已保存训练前输出，参数保持初始配置。'],
  'ai-from-scaling/03-build-a-harness': ['沿示例任务定位模型请求与工具结果。', '可追踪一次模型请求、工具执行与结果回传。'],
  'ai-from-scaling/04-experiments': ['核对真实模型的接入条件。', '已有配置与缺失条件均已列明。'],
  'ai-from-scaling/05-blender-mcp': ['核对 Blender 运行条件并执行演示。', '已找到生成文件并核对其路径。', '1. 运行：找到真正生成的文件'],
  'ai-from-scaling/06-github-lab-mcp': ['执行示例并检查报告中的基线结果。', '已找到同一断言在修复前后的结果。', '1. 运行：先取得一份真实报告'],
  'ai-from-scaling/07-weatherkit-mcp': ['运行离线天气样本，核对地点与出门时段。', '地点、时区、连续时长与 `mode=fixture` 均可核对。', '1. 离线样本验证'],
  'ai-from-scaling/07-music-space-mcp': ['选修：运行示例并打开钢琴排练台。', '已定位一个小节并独听一条声部。'],
  'ai-from-scaling/08-music-photo-mcp': ['选修：打开舞台预演台并查看整体机位。', '音箱位置调整与工具调用回执一致。'],
  'ai-from-scaling/extra-tool-use-story': ['阅读模型、工具接口、运行循环与执行器的分工。', '可区分模型、工具和执行器的职责。'],
  'agent-engineering': ['定位 Harness 入门课程与工具循环示例。', '已确认工具循环的运行入口。'],
  'agent-engineering/01-mcp-tool-source': ['定位现有工具执行入口。', '函数名与源码位置均有记录。', '1. 定位：先找到现有工具执行入口'],
  'agent-engineering/02-mcp-policy': ['核对配置允许执行的两个只读工具。', '允许与拒绝的判断位置均可定位。', '1. 配置：只允许两个已核对的只读工具'],
  'agent-engineering/03-skills-structure': ['对照 Skill 的 description 与正文结构。', '触发条件与执行步骤的位置清楚。'],
  'agent-engineering/04-skills-validation': ['选定一个可检查的完成条件。', '已定义一条通过条件和一条失败条件。'],
  'agent-engineering/05-harness-vertical-slice': ['检查用户取消场景及终态处理。', '取消后的预期状态明确。', '六个状态场景'],
  'agent-engineering/06-context-and-report': ['区分模型用量与本地运行记录。', '两类记录各有一个明确字段。'],
  'agent-engineering/07-scenario-regression': ['对照三层测试的职责。', '已为一个取消问题选定测试层。'],
  'agent-engineering/computer-use': ['阅读观察、动作与检查的执行循环。', '可说明动作后再次观察的用途。'],
  'agent-engineering/cua-repl': ['核对当前接口契约并选择首次观察入口。', '已按连接状态选定浏览器或桌面入口。', '首次调用与入口选择'],
  'agent-engineering/computer-use-ecosystem': ['比较两种工具的连接方式。', '已记录一项连接入口差异。'],
  'agent-engineering/computer-use-misconceptions': ['完成第一道自测，再核对解释与证据。', '结论及其缺少的证据明确。'],
  'agent-engineering/hooks': ['运行最小 Hook 并核对输入与输出。', '已区分记录事件与阻止执行。', '实验一：输入与输出'],
  'agent-engineering/openai-api': ['核对额度入口、到期日期与适用范围。', '额度可用性明确；本步骤不发起模型调用。'],
  'agent-engineering/openai-api-projects': ['检查语音项目的输入与产物。', '已定义一份输入和对应产物。'],
  'ai-communication': ['定位 RPC 示例及运行命令。', '命令对应的跨进程操作明确。'],
  'ai-communication/01-rpc': ['执行 RPC 示例。', '另一进程返回笔记内容。'],
  'ai-communication/02-json-rpc': ['执行一次 JSON-RPC 请求。', '输出中的 id 与 result 对应同一请求。'],
  'ai-communication/03-sse': ['运行分段响应示例。', '已观察到内容分批到达。'],
  'ai-communication/03-sse-http': ['建立一次 HTTP 流连接。', '已接收第一条事件。'],
  'ai-communication/04-mcp': ['运行最简 MCP demo 并检查请求输出。', '工具发现与实际调用可区分。', '1. 运行：观察两种不同的请求'],
  'ai-communication/05-failure': ['运行首个失败示例并检查错误报告。', '错误不会被标记为成功。'],
  'ai-communication/06-yuuki': ['沿一条请求追踪至执行端。', '执行端的请求入口可定位。'],
  'ai-communication/weather-mcp': ['核对远程天气工程的首阶段产物。', '用户凭证与 Apple 凭证可区分。'],
  'ai-communication/weather-mcp/01-user-journey': ['检查用户连接流程的四个步骤。', '登录、授权与工具查询的顺序清楚。'],
  'ai-communication/weather-mcp/02-supabase-auth': ['记录客户端、授权服务与回调地址。', '三个地址与各自职责对应。'],
  'ai-communication/weather-mcp/03-apple-weatherkit': ['核对 Apple 配置所需的四个值。', '已有条件与缺失项明确，记录不包含私钥。'],
  'ai-communication/weather-mcp/04-mcp-server': ['定位用户鉴权与天气查询的实现文件。', '两个职责的文件位置均有记录。'],
  'ai-communication/weather-mcp/05-connect-and-verify': ['核对工程是否具备所需代码与目录。', '完整项与缺失项均已记录。'],
  'ai-ideas': ['定义实验输入与预期产物。', '实验目标具体且可检查。'],
  'ai-ideas/01-ideas-map': ['打开完整方案中的独立审查章节。', '审查输入、返修规则与验收条件明确。'],
  'ai-ideas/02-five-new-directions': ['写三条阅读规格并对照当前实现。', '选定的实验有输入、交付物与判定标准。', '实验选择'],
  'ai-practices': ['检查 Issue 到 PR 的任务单。', '任务验收条件完整。'],
  'ai-practices/your-workflow': ['选择一个范围明确的小型问题。', '复现步骤与预期结果清楚。', '单任务验证'],
  'ai-practices/01-coderabbit-review': ['检查一条公开审查意见。', '触发条件与验证方法均有记录。'],
  'ai-practices/02-issue-to-pr': ['按任务单定义一个小型 Issue。', 'Issue 有明确验收条件。', '从任务单到交付物'],
  'ai-practices/03-error-to-fix': ['从案例中定位支撑根因的运行证据。', '已区分观察事实与待验证假设。'],
  'ai-practices/04-security-autofix': ['追踪一个告警的危险输入路径。', '输入条件明确，尚未扩大为批量修复。', '告警怎样走到补丁'],
  'ai-practices/05-test-generation': ['分析一个被淘汰的候选测试。', '可说明测试通过但验证无效的原因。'],
  'ai-practices/06-code-migration': ['记录单个依赖的升级前后状态与检查方式。', '升级记录可回查。', '把升级拆成一条能回查的路径'],
  'architecture/ai-and-speech-foundation': ['追踪语音输入转为模型任务的调用链。', '转写结束与模型请求的边界明确。'],
  'architecture/mac-local-harness': ['核对已确认目标与首版范围。', '首版本地执行闭环明确。'],
  'architecture/technology-assessment': ['选定一项需要比较的用户行为。', '比较目标及待回答的问题明确。'],
  'appendix/openai-api-models': ['按用途选择一种 API 能力。', '候选模型与预期产物明确。', '类型速查'],
  'codex-cloud': ['定位 for-safe 只读任务及环境配置入口。', '环境创建与首条任务的入口明确。'],
  'codex-cloud/cloud-machine': ['发送只读资源查询任务。', '资源限制、项目状态及 CPU 可见数与配额均已核对。', '环境资源复查'],
  'codex-cloud/01-for-safe': ['在 Codex 新任务中选择 Cloud 并打开环境选择器。', '已确认 for-safe 是否具备已发布环境。', '② 创建并发布环境'],
  'codex-cloud/02-community': ['检查一个公开云端案例。', '实际完成项与待人工验证项均有记录。'],
  'codex-cloud/03-for-job': ['核对仓库安装与检查条件。', '已确认是否具备基线检查条件。'],
  'codex-cloud/04-agent-symphony': ['比较事件样本与真实宿主接入。', '样本验证的覆盖范围与缺口明确。'],
  'codex-cloud/05-issue-to-pr': ['比较三条路线并选定本次执行方式。', '仓库、Issue 与执行路线明确；本步骤不启动并行实验。'],
  'deep/2026-09-26-simplicity-composition-complexity': ['按阅读路线分析组合成立的条件。', '已选定一节及其分析问题。'],
  'deep/2026-09-26-simplicity-composition-complexity/01-framework': ['为简单性分析指定使用者与任务。', '评价主体与任务场景明确。'],
  'deep/2026-09-26-simplicity-composition-complexity/02-raycast-warp': ['分析 Raycast 的一套操作语法。', '已列出两个可复用同一操作的对象。'],
  'deep/2026-09-26-simplicity-composition-complexity/03-zed-grok': ['分析 Zed 的编辑能力复用。', '可定位被复用的能力单元。'],
  'deep/2026-09-26-simplicity-composition-complexity/04-yuuki': ['按观察日期区分已有实现与后续方案。', '已有能力与未验证行为均有记录。'],
  'deep/2026-09-26-zed-pi-rust': ['核对一项关键结论的源码依据。', '结论与对应证据明确。', '关键结论'],
  'deep/2026-09-26-zed-pi-rust/01-why-rust': ['从具体边界分析 Rust 的用途。', 'UI 与运行时的语言选择可区分。'],
  'deep/2026-09-26-zed-pi-rust/02-zed-architecture': ['沿源码地图定位文件打开流程。', '文件打开的实现入口明确。'],
  'deep/2026-09-26-zed-pi-rust/03-pi-desktop': ['分析单一 crate 内的职责分配。', '宿主与 sidecar 的职责可区分。'],
  'deep/2026-09-26-zed-pi-rust/04-yuuki-box': ['沿一条已有实现追踪调用路径。', 'UI 与运行时的边界可定位。'],
  'frontend-foundations': ['分析数组查找示例。', '重复执行的查找工作明确。'],
  'frontend-foundations/keys-and-maps': ['比较一次数组查找与 Map 查询。', '索引建立的时机明确。'],
  'frontend-foundations/cache-cost': ['比较引用保留与内容复制。', '两类操作各有明确示例。'],
  'issue-garden': ['沿完整流程选定本轮路线与交付条件。', 'Issue、执行路线、验收条件与停止规则明确。', '完整流程'],
  'issue-garden/01-first-scan': ['核对扫描工作流的触发与读取范围。', '手动触发和只读权限配置可定位。'],
  'issue-garden/02-first-repair': ['为小型问题定义完成条件。', '独立操作者可按相同步骤判断修复结果。'],
  'issue-garden/03-night-shift': ['核对单任务领取与已有 PR 跳过规则。', '已有关联 PR 的任务不会重复领取。'],
  'issue-garden/04-dot-shift': ['核对操作者、Dot、Codex 与 GitHub 的分工。', '任务记录与待决策事项的归属明确。'],
  'issue-garden/05-codex-api': ['核对 API 与仓库配置条件。', '已有条件与缺口明确；本步骤不运行付费工作流。'],
  'issue-garden/06-agentic-workflows': ['区分工作流编译与模型执行的前置条件。', '工具与 API 凭据的缺口明确。'],
  'issue-garden/07-automation-options': ['打开完整方案中的路线与费用。', '执行器与额度来源明确。'],
  'issue-garden/08-github-outlook': ['打开完整方案中的 Outlook 通知。', '原生邮件配置与事件范围明确。'],
  'issue-garden/09-multi-agent-event-bus': ['打开完整方案中的多 AI 演进。', '任务状态与结果版本的核对规则明确。'],
  'kv-cache': ['修改一个输入，观察前缀缓存变化。', '已定位缓存失效的起点。', '实验一：输入变化与缓存失效'],
  'kv-cache/00-first-request': ['对照第一组消息数组。', '用户消息与系统说明可区分。'],
  'kv-cache/00-why-so-large': ['分析 KV 随 token 增长的容量。', '容量对层数、精度及 token 数的依赖明确。'],
  'kv-cache/01-from-frontend': ['区分原始输入与计算结果。', '前部输入变化对后续结果的影响明确。'],
  'kv-cache/02-attention-and-kv': ['用数值示例区分 Q、K、V。', '可复用的既有结果明确。'],
  'kv-cache/03-prefix-cache-and-yuuki': ['在消息数组中定位最长不变前缀。', '已定位首次变化的位置。'],
  'kv-cache/04-deepseek-harness': ['检查请求函数中无需更新的分支。', '被避免的重复工作明确。', '文本未变化时的投影分支'],
  'kv-cache/05-pi': ['对照输入 token 与缓存 token 数。', '一次用量统计的口径明确。', '输入用量对账'],
  'kv-cache/06-study-map': ['定义前缀失效的验证问题。', '固定输入与判定方法均已记录。'],
  'learning/ai-frontend-intersections': ['选择数组查找实验并记录输入规模。', '重复工作量的比较方法明确。'],
  'learning/apple-reading-sync': ['检查登录与跨设备同步流程。', '匿名阅读能力与登录后的同步范围明确。', '使用者视角 · 如何跨设备同步'],
  'learning/harness-scenario-lab': ['选择 W2 或 G2 场景，只改变一个因素。', '已记录可复现现象和同一指标的前后结果。', '实验步骤'],
  'learning/rendering-performance': ['区分模型回复等待与界面卡顿。', '待测的响应行为与问题对应。', '1. 界面响应指标'],
  'mcp-projects': ['按记录服务、天气与其他工具定位入口。', '本地文件服务与外部 API 的前置条件可区分。'],
  'plan/first-mac-loop': ['核对首轮开发的交付范围。', '输入、工具执行与结果的闭环明确。'],
  'research/zed-raycast-warp': ['核对当前结论与决策边界。', '判断依据及其失效条件明确。'],
  'side-by-side': ['打开 Issue 自动化完整方案。', '任务流程与实现路线可在同一页查阅。'],
  'tts': ['核对 edge-tts 示例的输入与输出。', '文字、合成命令与音频产物的对应关系清楚。'],
  'tts/让-Yuuki-开口说第一句话': ['核对终端与播放条件并合成示例中文。', '已生成并播放示例音频。'],
  'wasm': ['在浏览器实验中计算 21 + 21。', 'JavaScript 调用 Wasm 并返回 42。', '先调用一个真实的小模块'],
  'wasm/workers-and-memory': ['分析 Worker 的执行边界。', '数据传递与复制成本明确。'],
  'wasm/browser-ai': ['区分应用、运行时与模型。', '模型下载与推理执行的位置明确。'],
  'windows-local-ai': ['核对系统、显卡与磁盘前置条件。', '已有条件与缺口明确；本步骤不下载模型。'],
  'windows-local-ai/01-qwen-image': ['检查可用空间与显卡驱动。', '模型目录及可用容量明确。'],
  'windows-local-ai/02-ace-step-music': ['核对 ComfyUI 及配乐工作流所需模型。', '运行环境与模型清单明确，下载和生成分别记录。'],
  'labs/kv-memory': ['仅修改上下文长度，其余输入保持默认。', '已观察 KV 内存随上下文长度的变化。'],
  'labs/lookup': ['按默认规模运行数组与 Map 对照。', '两种查询的工作量差异可核对。'],
  'labs/wasm-bridge': ['执行一次整数加法。', 'JavaScript 输入与 Wasm 输出对应。'],
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
