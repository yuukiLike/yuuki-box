/** @typedef {string | { text: string, href: string }} TopicTag */
/**
 * @typedef {Object} NavigationItem
 * @property {string} [label]
 * @property {string} [sidebarLabel]
 * @property {string} [slug]
 * @property {string} [link]
 * @property {string} [color]
 * @property {string} [description]
 * @property {TopicTag[]} [tags]
 * @property {NavigationItem[]} [items]
 * @property {{ directory: string }} [autogenerate]
 * @property {boolean} [collapsed]
 */

/** @returns {TopicTag} */
const topic = (text, slug) => {
  const [path, anchor] = slug.split('#');
  return { text, href: `/${path}/${anchor ? `#${anchor}` : ''}` };
};
/** @param {string} [sidebarLabel] @returns {NavigationItem} */
const page = (slug, label, tags, sidebarLabel) => ({ slug, label, tags, sidebarLabel });

// 首页、侧栏与阅读页共用主题信息。标签链接在章节收起时仍能直达具体内容。
/** @type {NavigationItem[]} */
export const navigation = [
  { label: '文档目录', link: '/', color: 'sky', tags: ['学习专题'] },
  { ...page('ai-from-scaling', '四小时路线：模型基础与 Agent 入门', ['跨专题导读']), color: 'sky' },
  { ...page('learning/ai-frontend-intersections', '联读指南：前端与 AI 实验', ['跨专题导读']), color: 'sky' },
  {
    label: 'MCP 入门',
    color: 'sky',
    description: '最简 demo → 保存与取回记录的 MCP 服务 → 本地天气。客户端实现细节按需阅读。',
    tags: [topic('最简 demo', 'ai-from-scaling/00-minimal-mcp'), topic('记录服务', 'ai-from-scaling/00-codex-mcp'), topic('天气 MCP', 'ai-from-scaling/07-weatherkit-mcp'), topic('TypeScript 技术栈', 'ai-from-scaling/00-minimal-mcp#typescript-stack')],
    items: [
      page('ai-from-scaling/00-minimal-mcp', 'MCP 最简 demo：工具调用与文件读写', ['MCP', 'Client', 'stdio'], '1 · MCP 最简 demo'),
      page('ai-from-scaling/00-codex-mcp', 'MCP 服务：保存与取回记录', ['Codex', 'MCP', '文件读写'], '2 · MCP 记录服务'),
      page('ai-from-scaling/07-weatherkit-mcp', 'Apple 天气 MCP：天气查询与出门时段', ['WeatherKit', 'MCP'], '3 · Apple 天气 MCP'),
      {
        label: '选读：工具调用简史',
        tags: ['Agent 历史'],
        items: [
          page('ai-from-scaling/extra-tool-use-story', '工具调用简史：ReAct、函数调用、MCP 与 Skills', ['Agent 历史', '选读'], '番外 · 工具调用简史'),
        ],
      },
    ],
  },
  {
    label: 'MCP 案例',
    color: 'emerald',
    description: '天气主线之后的扩展案例：Blender 建模、GitHub 修复验证与选修音乐工作台。',
    tags: [topic('项目选择', 'mcp-projects'), topic('天气工具', 'ai-from-scaling/07-weatherkit-mcp'), topic('Blender', 'ai-from-scaling/05-blender-mcp'), topic('GitHub', 'ai-from-scaling/06-github-lab-mcp'), topic('音乐选修', 'ai-from-scaling/07-music-space-mcp')],
    items: [
      page('mcp-projects', 'MCP 案例：工具与验证目标', ['选做', '项目入口']),
      page('ai-from-scaling/05-blender-mcp', 'Blender MCP：参数建模、预览与 STL 导出', ['Blender', '3D 建模'], 'Blender MCP · 参数建模'),
      page('ai-from-scaling/06-github-lab-mcp', 'GitHub MCP：复现 bug、验证修复与补丁对照', ['GitHub', '修复验证'], 'GitHub MCP · 修复验证'),
      {
        label: '选修：音乐 MCP',
        tags: ['选修', 'MIDI', '视频导出'],
        items: [
          page('ai-from-scaling/07-music-space-mcp', '选修 1：MIDI 钢琴排练台', ['选修', 'MIDI', 'Three.js']),
          page('ai-from-scaling/08-music-photo-mcp', '选修 2：舞台预演台', ['选修', '舞台布局', '视频导出']),
        ],
      },
    ],
  },
  {
    label: '进阶：远程 MCP 与授权',
    color: 'emerald',
    description: '本地工具与客户端调用稳定后，再增加网站登录、OAuth、多用户权限与远程部署。',
    tags: [topic('连接流程', 'ai-communication/weather-mcp/01-user-journey'), topic('Supabase', 'ai-communication/weather-mcp/02-supabase-auth'), topic('WeatherKit', 'ai-communication/weather-mcp/03-apple-weatherkit'), topic('MCP 服务', 'ai-communication/weather-mcp/04-mcp-server')],
    items: [
      page('ai-communication/weather-mcp', '远程天气 MCP 总览：登录、查询与客户端连接', ['远程服务', '授权']),
      page('ai-communication/weather-mcp/01-user-journey', '1 · 连接流程：用户授权到工具查询', ['用户流程']),
      page('ai-communication/weather-mcp/02-supabase-auth', '2 · Supabase：登录、身份与权限', ['身份认证']),
      page('ai-communication/weather-mcp/03-apple-weatherkit', '3 · WeatherKit：鉴权与天气查询', ['WeatherKit']),
      page('ai-communication/weather-mcp/04-mcp-server', '4 · MCP 服务：封装天气工具', ['MCP Server']),
      page('ai-communication/weather-mcp/05-connect-and-verify', '5 · 连接 Codex 并验收天气工具', ['Codex', '验收']),
    ],
  },
  {
    label: 'Issue 自动化与 AI 协作',
    color: 'emerald',
    description: '一页串起人的决策、多人维护、Issue 修复与多 AI 协作；执行路线和配置细节按需查阅。',
    tags: [topic('完整流程', 'issue-garden#workflow'), topic('人的参与', 'issue-garden#human'), topic('多人维护', 'issue-garden#team'), topic('路线与费用', 'issue-garden#routes'), topic('独立审查', 'issue-garden#review'), topic('Outlook 通知', 'issue-garden#notifications'), topic('多 AI 演进', 'issue-garden#multi-agent')],
    items: [
      page('issue-garden', 'Issue 自动化完整方案：人的决策、协作与交付', ['完整方案', '人的参与', '多人维护'], 'Issue 自动化 · 完整方案'),
      {
        label: '选读：配置与实验',
        collapsed: true,
        tags: ['选读', '工作流配置', '路线对照'],
        items: [
          page('issue-garden/01-first-scan', '扫描配置：生成候选 Issue 清单', ['问题发现', 'Actions']),
          page('issue-garden/02-first-repair', '修复练习：复现问题并验证补丁', ['修复验证']),
          page('issue-garden/03-night-shift', '定时配置：任务领取、去重与交付', ['定时流程', '任务记录']),
          page('issue-garden/04-dot-shift', 'Dot 配置：GitHub 任务与有限返修', ['Dot', '产品额度']),
          page('issue-garden/05-codex-api', 'Codex Action 配置：Issue 到草稿 PR', ['OpenAI API', 'Codex Action', '独立验证']),
          page('issue-garden/06-agentic-workflows', 'Agentic Workflows 配置：编译与受限交付', ['OpenAI API', 'Agentic Workflows']),
          page('codex-cloud/05-issue-to-pr', '并行实验：Dot、Codex Action 与 Agentic Workflows', ['路线对照', '独立分支', 'API 用量']),
        ],
      },
    ],
  },
  {
    label: '模型基础',
    color: 'gold',
    description: '理解参数、预测与训练，运行字符模型并比较训练前后的输出。',
    tags: [topic('模型原理', 'ai-from-scaling/01-understand-models'), topic('字符模型训练', 'ai-from-scaling/02-train-a-model')],
    items: [
      page('ai-from-scaling/01-understand-models', '模型基础 1：预测、上下文与训练', ['模型原理'], '1 · 预测与上下文'),
      page('ai-from-scaling/02-train-a-model', '模型基础 2：数据、损失与字符生成', ['模型训练'], '2 · 训练字符语言模型'),
    ],
  },
  {
    label: '模型推理与 KV Cache',
    color: 'gold',
    description: '先追踪请求、观察前缀复用，再理解 Attention；容量计算、Harness 与 Pi 实现按需选读。',
    tags: [topic('生成过程', 'kv-cache/00-first-request'), topic('Attention', 'kv-cache/02-attention-and-kv'), topic('内存容量', 'kv-cache/00-why-so-large'), topic('前缀复用', 'kv-cache/03-prefix-cache-and-yuuki')],
    items: [
      page('kv-cache', 'KV Cache 总览：原理、容量与 Agent 应用', ['模型缓存'], 'KV Cache · 原理与应用'),
      {
        label: '理解与复用：请求、前缀与 Attention',
        tags: ['KV Cache', '前缀复用'],
        items: [
          page('kv-cache/00-first-request', '1 · 模型请求：消息、token 与生成过程', ['请求路径', 'Token']),
          page('kv-cache/01-from-frontend', '2 · 增量计算：追加输入与复用结果', ['增量计算']),
          page('kv-cache/02-attention-and-kv', '3 · 注意力：Q、K、V 与因果遮罩', ['Attention', 'Q/K/V']),
          page('kv-cache/03-prefix-cache-and-yuuki', '4 · 前缀缓存：DeepSeek 命中与失效', ['DeepSeek', '前缀缓存']),
        ],
      },
      {
        label: '选读：容量与工程实现',
        tags: ['选读', '内存计算', '工程实现'],
        items: [
          page('kv-cache/00-why-so-large', '选读 · KV 容量：层数、token 与数据精度', ['选读', '内存计算']),
          { label: '交互实验：计算 KV Cache 内存容量', link: '/labs/kv-memory/', tags: ['交互实验', '内存计算'] },
          page('kv-cache/04-deepseek-harness', '进阶 · Harness：请求装配与缓存复用', ['Harness', '请求装配']),
          page('kv-cache/05-pi', '进阶 · Pi：用量映射、缓存计费与预热', ['Pi', '用量统计']),
          page('kv-cache/06-study-map', '知识地图：KV 术语、关联概念与实验', ['知识地图']),
        ],
      },
    ],
  },
  {
    label: 'Agent 工程',
    color: 'pink',
    description: '离线工具循环 → 真实模型 → 单文件 Skill → 外部工具；运行恢复与界面操作随后按需增加。',
    tags: [topic('离线入门', 'ai-from-scaling/03-build-a-harness'), topic('真实模型', 'ai-from-scaling/04-experiments'), topic('Skills', 'agent-engineering/03-skills-structure'), topic('MCP 接入', 'agent-engineering/01-mcp-tool-source'), topic('运行恢复', 'agent-engineering/05-harness-vertical-slice'), topic('Computer Use', 'agent-engineering/computer-use')],
    items: [
      page('agent-engineering', 'Agent 工程总览：工具循环与执行能力', ['入门', '工程练习', 'Computer Use']),
      {
        label: '入门：跑通模型与工具循环',
        tags: ['Harness', '可运行教程'],
        items: [
          page('ai-from-scaling/03-build-a-harness', 'Agent 入门 1：搭建工具调用 Harness', ['Harness', '工具调用'], '1 · 搭建 Harness'),
          page('ai-from-scaling/04-experiments', 'Agent 入门 2：接真实模型并对照结果', ['模型 API', '对照实验'], '2 · 接真实模型'),
        ],
      },
      {
        label: 'Skills：流程复用、结构与验收规则',
        tags: ['Skills', '验收'],
        items: [
          page('agent-engineering/03-skills-structure', 'Skill 结构：保存可复用的任务流程', ['SKILL.md', '流程复用']),
          page('agent-engineering/04-skills-validation', 'Skill 验证：为完成条件设计验收', ['完成条件', '验证']),
        ],
      },
      {
        label: 'MCP：工具发现、接入与执行权限',
        tags: ['MCP', '工具权限'],
        items: [
          page('agent-engineering/01-mcp-tool-source', 'MCP 工具源：把外部工具接进 Harness', ['工具发现', 'MCP']),
          page('agent-engineering/02-mcp-policy', '工具策略：允许、拒绝与确认执行', ['权限策略']),
        ],
      },
      {
        label: '运行控制：Hooks、取消与报告',
        tags: ['Hooks', 'Harness', '运行控制'],
        items: [
          page('agent-engineering/hooks', 'AI Hooks：Claude Code、DeepSeek Harness 与 Codex', ['Hooks', 'Claude Code', 'DeepSeek', 'Codex'], 'Hooks · 机制与输入输出'),
          page('agent-engineering/05-harness-vertical-slice', '运行控制：取消、崩溃恢复与终态', ['取消', '恢复']),
          page('agent-engineering/06-context-and-report', '运行报告：上下文装配、耗时与费用', ['Context', '用量统计']),
          page('agent-engineering/07-scenario-regression', '场景回归：重放故障并检查运行结果', ['故障演练', '回归']),
        ],
      },
      {
        label: 'Computer Use：原理、接口与误区',
        tags: ['Computer Use', 'cua_repl'],
        items: [
          page('agent-engineering/computer-use', 'Computer Use：模型怎样看界面、做动作、检查结果', ['执行原理', 'AX', 'DOM'], '1 · 界面操作原理'),
          page('agent-engineering/cua-repl', 'Codex 与 cua_repl：接口、连接与状态', ['Codex', 'cua_repl', 'REPL'], '2 · Codex 与 cua_repl'),
          page('agent-engineering/computer-use-ecosystem', '同类工具：Claude、Gemini、Playwright MCP 与浏览器 Agent', ['Claude', 'Gemini', '浏览器自动化'], '3 · 同类工具对照'),
          page('agent-engineering/computer-use-misconceptions', 'Computer Use：理解误区与自测', ['理解误区', '状态', '验证'], '4 · 误区与自测'),
        ],
      },
      {
        label: '选读：API 额度与多模态',
        tags: ['选读', 'API', '语音与图片'],
        items: [
          page('agent-engineering/openai-api', 'OpenAI API：额度、图片与语音', ['API 额度', '图片生成', 'TTS', topic('社区妙用', 'agent-engineering/openai-api#community-ideas')], 'OpenAI API · 额度与妙用'),
          page('agent-engineering/openai-api-projects', '选修：OpenAI 语音、音乐与多模态项目', ['选修', '语音项目', '音乐制作', '多模态', 'API 用量'], '选修 · OpenAI 多模态项目'),
        ],
      },
    ],
  },
  {
    label: 'AI 开发案例',
    color: 'emerald',
    description: '从小 Issue、核实审查意见和回归测试开始，再选故障调查、安全修复与版本迁移。各案例可独立阅读。',
    tags: [topic('Issue → PR', 'ai-practices/02-issue-to-pr'), topic('PR 审查', 'ai-practices/01-coderabbit-review'), topic('回归测试', 'ai-practices/05-test-generation'), topic('故障调查', 'ai-practices/03-error-to-fix')],
    items: [
      page('ai-practices', '开发案例：任务修复、质量检查与代码迁移', ['Issue 修复', 'PR 审查', '回归测试']),
      {
        label: '起步：交付、审查与回归',
        tags: ['单任务', '验收'],
        items: [
          page('ai-practices/02-issue-to-pr', 'Issue → PR：明确复现、生成补丁与人工验收', ['GitHub', '任务交付']),
          page('ai-practices/01-coderabbit-review', 'CodeRabbit：核实 PR 审查意见与误报', ['CodeRabbit', '代码审查']),
          page('ai-practices/05-test-generation', '测试生成：验证测试能否抓住真实 bug', ['回归测试', '测试有效性']),
        ],
      },
      {
        label: '进阶选读：故障、安全与迁移',
        tags: ['选读', '复杂任务'],
        items: [
          page('ai-practices/03-error-to-fix', '故障修复：Sentry Seer 定位根因与生成补丁', ['Sentry Seer', '调试']),
          page('ai-practices/04-security-autofix', '安全修复：从扫描告警追到修复验证', ['CodeQL', '漏洞修复']),
          page('ai-practices/06-code-migration', '代码迁移：限定升级范围与核对关联改动', ['版本升级', '迁移']),
          page('ai-practices/your-workflow', '工作流选读：复现、修复、验收与返工分析', ['工作流', '验收', '选读']),
        ],
      },
    ],
  },
  {
    label: '应用通信',
    color: 'sky',
    description: 'RPC → JSON-RPC → SSE → MCP → 超时与取消；真实 HTTP 重连和项目源码在基础调用后选读。',
    tags: [topic('RPC', 'ai-communication/01-rpc'), topic('JSON-RPC', 'ai-communication/02-json-rpc'), topic('SSE', 'ai-communication/03-sse'), topic('MCP', 'ai-communication/04-mcp'), topic('超时与取消', 'ai-communication/05-failure')],
    items: [
      page('ai-communication', '通信课程总览：请求、流式响应与工具调用', ['协议课程']),
      page('ai-communication/01-rpc', '1 · RPC：跨进程读取笔记', ['RPC']),
      page('ai-communication/02-json-rpc', '2 · JSON-RPC：用 ID 匹配请求与响应', ['JSON-RPC']),
      page('ai-communication/03-sse', '3 · SSE：接收事件并逐步显示结果', ['SSE', '流式响应']),
      page('ai-communication/04-mcp', '4 · MCP：发现工具与执行调用', ['MCP']),
      page('ai-communication/05-failure', '5 · 通信失败：超时、取消与远端执行', ['超时', '取消']),
      {
        label: '进阶选读：真实连接与源码追踪',
        tags: ['选读', '断线重连', '项目源码'],
        items: [
          page('ai-communication/03-sse-http', 'HTTP SSE：断线重连与结束状态', ['选读', 'SSE', '断线重连']),
          page('ai-communication/06-yuuki', '6 · Yuuki：在项目中追踪通信路径', ['选读', '代码追踪']),
        ],
      },
    ],
  },
  {
    label: '前端性能',
    color: 'sky',
    description: '比较查找与缓存的成本，用 Wasm 和 Worker 组织浏览器计算，再测量流式文本的解析、更新与输入响应。',
    tags: [topic('Map 与缓存', 'frontend-foundations'), topic('Wasm / Worker', 'wasm'), topic('浏览器 AI', 'wasm/browser-ai'), topic('流式渲染', 'learning/rendering-performance'), topic('性能场景', 'learning/harness-scenario-lab')],
    items: [
      {
        label: '查找与缓存：数组、Map、身份与失效',
        tags: ['数据结构', '缓存失效'],
        items: [
          page('frontend-foundations', '查找与缓存总览：消息索引与重复计算', ['索引', '缓存']),
          { label: '交互实验：数组与 Map 的查找工作量', link: '/labs/lookup/', tags: ['交互实验', 'Map'] },
          page('frontend-foundations/keys-and-maps', 'key、Object、Map 与 WeakMap 的选择', ['对象身份', 'Map']),
          page('frontend-foundations/cache-cost', '缓存成本：命中、失效、淘汰与内存', ['缓存失效', '内存']),
        ],
      },
      {
        label: '浏览器计算：Wasm、Worker 与 WebGPU',
        tags: ['Wasm', 'Worker', 'WebGPU'],
        items: [
          page('wasm', 'Wasm 入门：JavaScript 与模块调用边界', ['WebAssembly']),
          { label: '交互实验：JavaScript 调用 Wasm 整数加法', link: '/labs/wasm-bridge/', tags: ['交互实验', 'Wasm'] },
          page('wasm/workers-and-memory', 'Worker：内存、数据搬运与任务取消', ['Worker', '内存']),
          page('wasm/browser-ai', '进阶选读：浏览器 AI 与模型运行时', ['选读', 'WebGPU', '推理运行时']),
        ],
      },
      {
        label: '界面响应：流式文本、更新范围与性能测量',
        tags: ['流式渲染', '性能测量'],
        items: [
          page('learning/rendering-performance', '渲染性能：解析、更新、滚动与输入延迟', ['渲染', '性能测量']),
          page('learning/harness-scenario-lab', '性能场景：Swift、GPUI、React、WebView 与 Electron', ['五条技术路线', '场景对照']),
        ],
      },
    ],
  },
  {
    label: '语音交互',
    color: 'orange',
    description: '先合成并播放一句中文，再按需增加转写与人声检测；完整模型与工具集成选读。',
    tags: [topic('语音合成 / TTS', 'tts/让-Yuuki-开口说第一句话'), topic('Whisper 转写', 'tts#第二站--whispercpp把声音接回文字'), topic('VAD 人声检测', 'tts#第三站--silero-vad在录音里找出人声'), topic('模型与语音集成', 'architecture/ai-and-speech-foundation')],
    items: [
      page('tts/让-Yuuki-开口说第一句话', 'TTS：合成并播放中文', ['语音合成']),
      page('tts', '语音工具总览：edge-tts、Whisper 与 Silero VAD', ['TTS', 'ASR', 'VAD']),
      page('architecture/ai-and-speech-foundation', '进阶选读：语音、模型与运行时集成', ['选读', 'DeepSeek', 'Whisper']),
    ],
  },
  {
    label: 'AI 探索（选读）',
    color: 'gold',
    description: '选读与待验证构想：故障驱动、自动实验、模拟验收、规格驱动与知识整理。按兴趣查阅，不作为课程前置。',
    tags: [
      topic('故障驱动', 'ai-ideas/02-five-new-directions#1-故障驱动从真实报错生成修复任务'),
      topic('自动实验', 'ai-ideas/02-five-new-directions#2-自动实验固定评估并比较改法'),
      topic('模拟验收', 'ai-ideas/02-five-new-directions#3-模拟验收在仿真接口中构建与验证'),
      topic('规格驱动', 'ai-ideas/02-five-new-directions#4-规格驱动从产品规则生成实现与验收'),
      topic('知识整理', 'ai-ideas/02-five-new-directions#5-知识整理从已完成任务提取可复用经验'),
    ],
    items: [
      {
        ...page('ai-ideas', '探索总览：故障驱动、自动实验、模拟、规格与记忆', ['故障驱动', '自动实验', '模拟验收', '规格驱动', '知识整理', '待验证']),
        description: '按任务来源、解法搜索、验收环境、产品规格与经验复用分类，选择一个输入和判定标准清楚的小实验。',
      },
      page('ai-ideas/02-five-new-directions', '探索方案：Seer、autoresearch、模拟验收、Spec Kit 与 Letta', ['Seer', 'autoresearch', 'StrongDM', 'Spec Kit', 'Letta']),
    ],
  },
  {
    label: '架构研究',
    color: 'emerald',
    description: '对照 Zed、Raycast 与 Warp，研究 Swift、Rust / GPUI 和 Web 界面，沿组件、状态与进程边界阅读源码。',
    tags: [topic('Zed / Raycast / Warp', 'research/zed-raycast-warp'), topic('简单与组合', 'deep/2026-09-26-simplicity-composition-complexity'), topic('Rust / GPUI', 'deep/2026-09-26-zed-pi-rust'), topic('技术评估', 'architecture/technology-assessment')],
    items: [
      {
        label: '产品架构：Zed、Raycast 与 Warp',
        tags: ['产品研究', '架构对照'],
        // 外部 glob 的 filePath 相对 site 根目录，保留对应前缀。
        items: [{ autogenerate: { directory: '../docs/research' } }],
      },
      {
        label: '设计深读：组合复杂性与 Rust 桌面架构',
        tags: ['架构研究'],
        items: [
          { label: '简单与组合：接口、状态与时间关系', tags: ['组合设计'], items: [{ autogenerate: { directory: '../docs/deep/2026-09-26-simplicity-composition-complexity' } }] },
          { label: 'Rust 桌面：Zed、GPUI 与 PI-Desktop', tags: ['Rust', 'GPUI'], items: [{ autogenerate: { directory: '../docs/deep/2026-09-26-zed-pi-rust' } }] },
        ],
      },
      page('architecture/technology-assessment', '技术评估：统一比较五条 Mac 实现路线', ['技术评估']),
    ],
  },
  {
    label: '项目设计与计划',
    color: 'pink',
    description: '回到 Yuuki 的实际范围：对照已有实现、架构提案与开发计划，明确下一步要补什么证据。',
    tags: [topic('项目状态', 'guide'), topic('Harness 设计', 'architecture/mac-local-harness'), topic('Mac 实施计划', 'plan/first-mac-loop')],
    items: [
      page('guide', '全站学习入口、产品方向与项目状态', ['项目总览']),
      page('architecture/mac-local-harness', 'Mac 本地 Harness：运行时与 UI 的完整设计', ['Mac', '架构设计']),
      { autogenerate: { directory: '../docs/plan' } },
    ],
  },
  {
    label: '云端 Codex',
    color: 'sky',
    description: '首条只读任务 → 资源复查 → 项目检查 → 事件回放；社区案例选读，Issue 协作查阅完整方案。',
    tags: [topic('基础与额度', 'codex-cloud'), topic('for-safe', 'codex-cloud/01-for-safe'), topic('for-job', 'codex-cloud/03-for-job'), topic('Agent Symphony', 'codex-cloud/04-agent-symphony'), topic('Issue 完整方案', 'issue-garden#routes')],
    items: [
      page('codex-cloud', '云端 Codex：环境、任务与验证边界', ['Cloud', '基础与额度'], '云端 Codex · 从这里开始'),
      page('codex-cloud/01-for-safe', 'for-safe：首条只读云端任务', ['for-safe', '只读任务']),
      page('codex-cloud/cloud-machine', '云端电脑实测：CPU、内存、Shell 与多对话', ['资源实测', 'Shell', '多任务'], '云端资源与多任务'),
      page('codex-cloud/03-for-job', 'for-job：云端检查与导出回归', ['for-job', '备份与导出']),
      page('codex-cloud/04-agent-symphony', 'agent-symphony：云端事件与回放验证', ['Agent Symphony', '事件与回放']),
      {
        label: '选读：社区案例',
        tags: ['选读', '社区案例'],
        items: [
          page('codex-cloud/02-community', '社区做法：公开案例与界面截图', ['选读', '社区案例', '截图']),
        ],
      },
    ],
  },
  {
    label: 'Windows 本地 AI',
    color: 'emerald',
    description: '先用 RTX 5060 Ti 16GB 与 ComfyUI 完成 Qwen Image 出图，ACE-Step 配乐为选修。',
    tags: [topic('本地运行基础', 'windows-local-ai'), topic('Qwen Image 出图', 'windows-local-ai/01-qwen-image'), topic('配乐选修', 'windows-local-ai/02-ace-step-music')],
    items: [
      page('windows-local-ai', 'Windows 本地 AI：图片与音乐生成', ['Windows', '本地模型'], 'Windows 本地 AI · 从这里开始'),
      page('windows-local-ai/01-qwen-image', '1 · Windows 第一次运行 Qwen Image', ['Qwen Image', 'ComfyUI', 'RTX 5060 Ti'], '1 · Qwen Image 首次出图'),
      page('windows-local-ai/02-ace-step-music', '选修 · ACE-Step 1.5 Turbo：配乐生成', ['选修', 'ACE-Step', '音乐生成', 'ComfyUI'], '选修 · ACE-Step 配乐'),
    ],
  },
  {
    label: '阅读同步（选读）',
    color: 'emerald',
    description: '先看跨设备使用流程，再按需阅读 Apple 登录、同步接口与数据库实现。',
    tags: [topic('使用流程', 'learning/apple-reading-sync#user-view'), topic('实现与部署', 'learning/apple-reading-sync#developer-view'), topic('Apple 登录', 'learning/apple-reading-sync#apple-setup')],
    items: [
      page('learning/apple-reading-sync', '阅读同步：使用流程与实现', ['使用流程', '开发选读', 'Apple 登录'], '阅读同步 · 使用与实现'),
    ],
  },
  {
    label: 'GitHub Actions',
    color: 'orange',
    description: '从手动报告、YAML 写法与常用命令，到多任务编排和跨系统自动化，用图解说明执行关系与费用。',
    tags: [topic('首次运行', 'github-actions'), topic('文件与命令', 'github-actions/00-files-and-commands'), topic('事件与任务', 'github-actions/01-repository-tasks'), topic('矩阵与发布', 'github-actions/02-orchestration'), topic('跨系统协作', 'github-actions/03-systems'), topic('额度与费用', 'github-actions/04-costs')],
    items: [
      page('github-actions', 'GitHub Actions：从一次运行到自动化系统', ['Actions', '用途', '首次运行'], 'GitHub Actions · 从这里开始'),
      page('github-actions/00-files-and-commands', '工作流文件与常用命令', ['YAML', 'gh CLI', '配置写法'], '文件结构与常用命令'),
      page('github-actions/01-repository-tasks', '1 · 事件触发与仓库任务', ['事件', '构建', '定时任务'], '1 · 事件与仓库任务'),
      page('github-actions/02-orchestration', '2 · 多任务编排与交付', ['矩阵', '产物', '部署审批'], '2 · 多任务编排与交付'),
      page('github-actions/03-systems', '3 · 跨系统自动化', ['外部 API', '自托管', 'AI 协作'], '3 · 跨系统自动化'),
      page('github-actions/04-costs', '4 · GitHub Actions 额度与费用', ['分钟', '存储', '费用估算'], '4 · 额度与费用'),
    ],
  },
  {
    label: '附录',
    color: 'sky',
    description: '按用途查阅 OpenAI API 模型、价格与适用场景，区分现役型号、旧型号和停用计划。',
    tags: [topic('模型分类', 'appendix/openai-api-models#类型速查'), topic('语音与图片', 'appendix/openai-api-models'), topic('停用计划', 'appendix/openai-api-models#已弃用但尚未停用')],
    items: [
      page('appendix/openai-api-models', '附录 OpenAI API 模型分类与选型', ['OpenAI API', '模型选型', '分类查阅']),
      page('rag', 'RAG：检索、引用与资料更新', ['选读']),
    ],
  },
];

export const tagText = (tag) => typeof tag === 'string' ? tag : tag.text;

export function starlightSidebar(items = navigation, inheritedColor = 'sky') {
  return items.map(({ tags, description, sidebarLabel, color = inheritedColor, ...item }) => {
    // Starlight 会自动展开当前页的祖先分组，其余分组默认收起。
    if (item.items) return { collapsed: true, ...item, items: starlightSidebar(item.items, color) };
    if (item.autogenerate) return { ...item, autogenerate: { ...item.autogenerate, attrs: { 'data-topic': color } } };
    return { ...item, label: sidebarLabel ?? item.label, attrs: { 'data-topic': color, title: item.label, 'aria-label': item.label } };
  });
}

const pages = new Map();
const groups = new Map();
const directories = [];
const routeId = (path) => decodeURIComponent(path.split(/[?#]/)[0]).replace(/^\/+|\/+$/g, '');

function indexNavigation(items, parent = {}) {
  for (const item of items) {
    const metadata = { ...item, color: item.color ?? parent.color, tags: item.tags ?? parent.tags };
    if (item.items) {
      groups.set(item.label, metadata);
      indexNavigation(item.items, metadata);
    } else if (item.autogenerate) {
      directories.push({ prefix: item.autogenerate.directory.replace(/^\.\.\/docs\//, ''), metadata: parent });
    } else {
      pages.set(routeId(item.slug ?? item.link), metadata);
    }
  }
}
indexNavigation(navigation);

export function pageMetadata(path) {
  const id = routeId(path);
  return pages.get(id) ?? directories.find(({ prefix }) => id === prefix || id.startsWith(`${prefix}/`))?.metadata;
}

export function navigationMetadata(entry) {
  return entry.type === 'link' ? pageMetadata(entry.href) : groups.get(entry.label);
}
