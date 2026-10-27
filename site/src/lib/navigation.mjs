/** @typedef {string | { text: string, href: string }} TopicTag */
/**
 * @typedef {Object} NavigationItem
 * @property {string} [label]
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
/** @returns {NavigationItem} */
const page = (slug, label, tags) => ({ slug, label, tags });

// 首页、侧栏与阅读页共用主题信息。标签链接在章节收起时仍能直达具体内容。
/** @type {NavigationItem[]} */
export const navigation = [
  { label: '文档目录', link: '/', color: 'sky', tags: ['学习路线'] },
  {
    label: 'MCP 接入、模型训练与工具调用',
    color: 'sky',
    description: '从 Codex 调用自己的 MCP 开始，训练字符模型、搭建 Harness，再连接天气、Blender 与 GitHub。',
    tags: [topic('Codex MCP', 'ai-from-scaling/00-codex-mcp'), topic('模型训练', 'ai-from-scaling/02-train-a-model'), topic('工具调用循环', 'ai-from-scaling/03-build-a-harness'), topic('天气查询', 'ai-from-scaling/07-weatherkit-mcp'), topic('Blender 建模', 'ai-from-scaling/05-blender-mcp'), topic('GitHub 修复验证', 'ai-from-scaling/06-github-lab-mcp')],
    items: [
      page('ai-from-scaling/00-codex-mcp', 'Codex MCP：保存与取回项目记录', ['Codex', 'MCP']),
      page('ai-from-scaling/00-minimal-mcp', '独立 MCP 演示：服务端、客户端与工具调用', ['JSON-RPC', 'stdio']),
      page('ai-from-scaling/07-weatherkit-mcp', 'Apple 天气 MCP：天气查询与出门时段', ['WeatherKit', 'MCP']),
      page('ai-from-scaling', '学习路线：MCP、模型训练与 Harness', ['课程总览']),
      page('ai-from-scaling/01-understand-models', '1 · 模型学习：参数、概率与缩放定律', ['模型原理']),
      page('ai-from-scaling/02-train-a-model', '2 · 训练字符语言模型：数据、损失与生成', ['模型训练']),
      page('ai-from-scaling/03-build-a-harness', '3 · 搭建 Harness：模型与工具循环', ['Harness', '工具调用']),
      page('ai-from-scaling/04-experiments', '4 · 接真实模型：工具选择与结果对照', ['模型 API', '对照实验']),
      page('ai-from-scaling/extra-tool-use-story', '工具调用简史：ReAct、函数调用与 MCP', ['Agent 历史']),
      page('ai-from-scaling/05-blender-mcp', 'Blender MCP：参数建模、预览与 STL 导出', ['Blender', '3D 建模']),
      page('ai-from-scaling/06-github-lab-mcp', 'GitHub MCP：复现 bug、验证修复与补丁对照', ['GitHub', '修复验证']),
      {
        label: '音乐 MCP：MIDI 可视化与短片导出',
        tags: ['MIDI', '3D 可视化', '视频导出'],
        collapsed: true,
        items: [
          page('ai-from-scaling/07-music-space-mcp', '声部之结：将 MIDI 声部编织成三维对象', ['MIDI', 'Three.js']),
          page('ai-from-scaling/08-music-photo-mcp', '光之剧场：照片图层、音乐动画与短片导出', ['照片图层', '视频导出']),
        ],
      },
    ],
  },
  {
    label: 'AI 开发：修复、审查、测试与迁移',
    color: 'emerald',
    description: '按手头任务选案例：从 Issue 交付 PR、从报错追根因，再做代码审查、有效测试、安全修复与版本迁移。',
    tags: [topic('Issue → PR', 'ai-practices/02-issue-to-pr'), topic('故障修复', 'ai-practices/03-error-to-fix'), topic('PR 审查', 'ai-practices/01-coderabbit-review'), topic('测试生成', 'ai-practices/05-test-generation'), topic('安全修复', 'ai-practices/04-security-autofix'), topic('代码迁移', 'ai-practices/06-code-migration')],
    items: [
      {
        ...page('ai-practices', '开发实践总览：任务修复、质量检查与代码迁移', ['Issue 修复', '故障定位', 'PR 审查', '测试生成', '安全修复', '代码迁移']),
        description: '六项实践：Issue 转 PR、故障定位、CodeRabbit 审查、测试生成、安全告警修复、版本迁移。',
      },
      page('ai-practices/your-workflow', '开发工作流：复现、修复、验收与返工分析', ['工作流', '验收']),
      {
        label: '任务交付：Issue 修复、故障定位与迁移',
        tags: ['Issue → PR', '故障定位', '版本迁移'],
        items: [
          page('ai-practices/02-issue-to-pr', 'Issue → PR：明确复现、生成补丁与人工验收', ['GitHub', '任务交付']),
          page('ai-practices/03-error-to-fix', '故障修复：Sentry Seer 定位根因与生成补丁', ['Sentry Seer', '调试']),
          page('ai-practices/06-code-migration', '代码迁移：限定升级范围与核对关联改动', ['版本升级', '迁移']),
        ],
      },
      {
        label: '质量检查：PR 审查、有效测试与安全修复',
        tags: ['PR 审查', '测试生成', '安全修复'],
        items: [
          page('ai-practices/01-coderabbit-review', 'CodeRabbit：核实 PR 审查意见与误报', ['CodeRabbit', '代码审查']),
          page('ai-practices/05-test-generation', '测试生成：验证测试能否抓住真实 bug', ['回归测试', '测试有效性']),
          page('ai-practices/04-security-autofix', '安全修复：从扫描告警追到修复验证', ['CodeQL', '漏洞修复']),
        ],
      },
      {
        label: 'Issue 夜班：扫描问题、生成 PR 与交班',
        tags: ['跟做教程', 'Issue 自动化'],
        items: [
          page('issue-garden', 'Issue 夜班总览：问题扫描与修复流程', ['流程设计']),
          page('issue-garden/01-first-scan', '1 · 扫描仓库问题并整理候选 Issue', ['问题发现']),
          page('issue-garden/02-first-repair', '2 · 修复一个 Issue 并验证补丁', ['修复验证']),
          page('issue-garden/03-night-shift', '3 · 安排夜间任务与保留交班记录', ['定时流程', '交班记录']),
          page('issue-garden/04-dot-shift', '可选 · 用 Dot 跟进 GitHub 任务与返修', ['Dot', '现有额度', '持续跟进']),
        ],
      },
    ],
  },
  {
    label: 'Agent 工程：运行控制、MCP 与 Skills',
    color: 'pink',
    description: '实现取消、崩溃恢复、上下文与用量报告，接入外部工具和权限，再用 Skills 复用流程与验收。',
    tags: [topic('取消与恢复', 'agent-engineering/05-harness-vertical-slice'), topic('上下文与用量', 'agent-engineering/06-context-and-report'), topic('MCP 接入', 'agent-engineering/01-mcp-tool-source'), topic('工具权限', 'agent-engineering/02-mcp-policy'), topic('Skills', 'agent-engineering/03-skills-structure'), topic('回归演练', 'agent-engineering/07-scenario-regression')],
    items: [
      page('agent-engineering', 'Agent 工程总览：Harness、MCP 与 Skills', ['运行控制', 'MCP', 'Skills']),
      {
        label: 'Harness：取消、恢复、上下文与运行报告',
        tags: ['Harness', '运行控制'],
        items: [
          page('agent-engineering/05-harness-vertical-slice', '运行控制：取消、崩溃恢复与终态', ['取消', '恢复']),
          page('agent-engineering/06-context-and-report', '运行报告：上下文装配、耗时与费用', ['Context', '用量统计']),
          page('agent-engineering/07-scenario-regression', '场景回归：重放故障并检查运行结果', ['故障演练', '回归']),
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
        label: 'Skills：流程复用、结构与验收规则',
        tags: ['Skills', '验收'],
        items: [
          page('agent-engineering/03-skills-structure', 'Skill 结构：保存可复用的任务流程', ['SKILL.md', '流程复用']),
          page('agent-engineering/04-skills-validation', 'Skill 验证：为完成条件设计验收', ['完成条件', '验证']),
        ],
      },
      page('architecture/mac-local-harness', 'Mac 本地 Harness：运行时与 UI 的完整设计', ['Mac', '架构设计']),
    ],
  },
  {
    label: '前端与 AI：通信、缓存、计算与渲染',
    color: 'sky',
    description: '追踪请求与流式响应，比较数组与 Map、拆解 KV Cache，用 Wasm 和 Worker 计算，再检查界面更新成本。',
    tags: [topic('RPC / SSE / MCP', 'ai-communication'), topic('Map 与缓存', 'frontend-foundations'), topic('KV Cache', 'kv-cache'), topic('Wasm / Worker', 'wasm'), topic('流式渲染', 'learning/rendering-performance')],
    items: [
      {
        ...page('learning/ai-frontend-intersections', '实验总览：通信、查找缓存、KV、Wasm 与渲染', ['RPC / SSE', 'Map 与缓存', 'KV Cache', 'Wasm / Worker', '流式渲染']),
        description: '五类实验分别观察请求往返、查找工作量、模型缓存容量、计算边界和流式界面响应。',
      },
      {
        label: '应用通信：RPC、JSON-RPC、SSE 与 MCP',
        tags: ['RPC', 'SSE', 'MCP'],
        items: [
          page('ai-communication', '通信课程总览：请求、流式响应与工具调用', ['协议课程']),
          page('ai-communication/01-rpc', '1 · RPC：跨进程读取笔记', ['RPC']),
          page('ai-communication/02-json-rpc', '2 · JSON-RPC：用 ID 匹配请求与响应', ['JSON-RPC']),
          page('ai-communication/03-sse', '3 · SSE：接收事件并逐步显示结果', ['SSE', '流式响应']),
          page('ai-communication/04-mcp', '4 · MCP：发现工具与执行调用', ['MCP']),
          page('ai-communication/05-failure', '5 · 通信失败：超时、取消与远端执行', ['超时', '取消']),
          page('ai-communication/06-yuuki', '6 · Yuuki：在项目中追踪通信路径', ['代码追踪']),
          {
            label: '天气 MCP：Supabase 登录与 Apple 天气',
            tags: ['Supabase', 'WeatherKit'],
            items: [
              page('ai-communication/weather-mcp', '天气 MCP 总览：登录、查询与客户端连接', ['完整实战']),
              page('ai-communication/weather-mcp/01-user-journey', '1 · 连接流程：用户授权到工具查询', ['用户流程']),
              page('ai-communication/weather-mcp/02-supabase-auth', '2 · Supabase：登录、身份与权限', ['身份认证']),
              page('ai-communication/weather-mcp/03-apple-weatherkit', '3 · WeatherKit：鉴权与天气查询', ['WeatherKit']),
              page('ai-communication/weather-mcp/04-mcp-server', '4 · MCP 服务：封装天气工具', ['MCP Server']),
              page('ai-communication/weather-mcp/05-connect-and-verify', '5 · 连接 Codex 并验收天气工具', ['Codex', '验收']),
            ],
          },
        ],
      },
      {
        label: '查找与缓存：数组、Map、身份与失效',
        tags: ['数据结构', '缓存失效'],
        items: [
          page('frontend-foundations', '查找与缓存总览：消息索引与重复计算', ['索引', '缓存']),
          page('frontend-foundations/keys-and-maps', 'key、Object、Map 与 WeakMap 的选择', ['对象身份', 'Map']),
          page('frontend-foundations/cache-cost', '缓存成本：命中、失效、淘汰与内存', ['缓存失效', '内存']),
          { label: '交互实验：数组与 Map 的查找工作量', link: '/labs/lookup/', tags: ['交互实验', 'Map'] },
        ],
      },
      {
        label: 'KV Cache：注意力、容量与前缀复用',
        tags: ['KV Cache', '模型缓存'],
        items: [
          page('kv-cache', 'KV Cache 总览：原理、容量与 Agent 应用', ['模型缓存']),
          page('kv-cache/00-first-request', '1 · 模型请求：消息、token 与生成过程', ['请求路径', 'Token']),
          page('kv-cache/01-from-frontend', '2 · 增量计算：追加输入与复用结果', ['增量计算']),
          page('kv-cache/02-attention-and-kv', '3 · 注意力：Q、K、V 与因果遮罩', ['Attention', 'Q/K/V']),
          page('kv-cache/00-why-so-large', 'KV 容量：层数、token 与数据精度', ['内存计算']),
          page('kv-cache/03-prefix-cache-and-yuuki', '4 · 前缀缓存：DeepSeek 命中与失效', ['DeepSeek', '前缀缓存']),
          page('kv-cache/04-deepseek-harness', '5 · Harness：请求装配与缓存复用', ['Harness', '请求装配']),
          page('kv-cache/05-pi', '6 · Pi：用量映射、缓存计费与预热', ['Pi', '用量统计']),
          page('kv-cache/06-study-map', '知识地图：KV 术语、关联概念与实验', ['知识地图']),
          { label: '交互实验：计算 KV Cache 内存容量', link: '/labs/kv-memory/', tags: ['交互实验', '内存计算'] },
        ],
      },
      {
        label: '浏览器计算：Wasm、Worker 与 WebGPU',
        tags: ['Wasm', 'Worker', 'WebGPU'],
        items: [
          page('wasm', 'Wasm 入门：JavaScript 与模块调用边界', ['WebAssembly']),
          page('wasm/workers-and-memory', 'Worker：内存、数据搬运与任务取消', ['Worker', '内存']),
          page('wasm/browser-ai', '浏览器 AI：Wasm、WebGPU 与模型运行时', ['WebGPU', '推理运行时']),
          { label: '交互实验：JavaScript 调用 Wasm 整数加法', link: '/labs/wasm-bridge/', tags: ['交互实验', 'Wasm'] },
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
    label: '语音交互：合成、转写与人声检测',
    color: 'orange',
    description: '用 edge-tts 合成中文，用 whisper.cpp 转写录音，用 Silero VAD 找出人声，再接入 Yuuki 的模型与工具流程。',
    tags: [topic('语音合成 / TTS', 'tts/让-Yuuki-开口说第一句话'), topic('Whisper 转写', 'tts#第二站--whispercpp把声音接回文字'), topic('VAD 人声检测', 'tts#第三站--silero-vad在录音里找出人声'), topic('模型与语音集成', 'architecture/ai-and-speech-foundation')],
    items: [
      page('tts', '语音工具总览：edge-tts、Whisper 与 Silero VAD', ['TTS', 'ASR', 'VAD']),
      page('tts/让-Yuuki-开口说第一句话', 'edge-tts 实践：合成并播放第一句中文', ['语音合成']),
      page('architecture/ai-and-speech-foundation', '语音集成：DeepSeek、Whisper 与运行时', ['DeepSeek', 'Whisper']),
    ],
  },
  {
    label: 'AI 探索：故障驱动、自动实验与知识整理',
    color: 'gold',
    description: '探索五种工作方式：从故障发起任务、自动比较改法、在模拟接口中验收、按规格实现，以及整理可复用经验。',
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
      page('ai-ideas/01-ideas-map', '协作构想：Issue 夜班、独立 AI 审查与配套流程', ['协作流程', '构想地图']),
      page('ai-ideas/02-five-new-directions', '探索方案：Seer、autoresearch、模拟验收、Spec Kit 与 Letta', ['Seer', 'autoresearch', 'StrongDM', 'Spec Kit', 'Letta']),
    ],
  },
  {
    label: '架构研究：Mac 技术路线与产品设计',
    color: 'emerald',
    description: '对照 Zed、Raycast 与 Warp，研究 Swift、Rust / GPUI 和 Web 界面，梳理组件组合、进程边界与 Mac 实施计划。',
    tags: [topic('项目状态', 'guide'), topic('Zed / Raycast / Warp', 'research/zed-raycast-warp'), topic('简单与组合', 'deep/2026-09-26-simplicity-composition-complexity'), topic('Rust / GPUI', 'deep/2026-09-26-zed-pi-rust'), topic('Mac 实施计划', 'plan/first-mac-loop')],
    items: [
      page('guide', '全站学习路线、产品方向与项目状态', ['项目总览']),
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
      { label: '实施计划：Mac 本地 Agent 闭环', tags: ['Mac', '实施计划'], items: [{ autogenerate: { directory: '../docs/plan' } }] },
    ],
  },
];

export const tagText = (tag) => typeof tag === 'string' ? tag : tag.text;

export function starlightSidebar(items = navigation, inheritedColor = 'sky') {
  return items.map(({ tags, description, color = inheritedColor, ...item }) => {
    if (item.items) return { ...item, items: starlightSidebar(item.items, color) };
    if (item.autogenerate) return { ...item, autogenerate: { ...item.autogenerate, attrs: { 'data-topic': color } } };
    return { ...item, attrs: { 'data-topic': color } };
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
