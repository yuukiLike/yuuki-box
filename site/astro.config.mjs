import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import repositoryMarkdown from './src/lib/docs-paths.mjs';

export default defineConfig({
  trailingSlash: 'always',
  markdown: { processor: unified({ remarkPlugins: [repositoryMarkdown] }) },
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [
    starlight({
      title: 'Yuuki 学习手记',
      credits: false,
      disable404Route: true,
      description: '让 AI 接手开发，亲手搭 Agent，玩懂缓存、渲染、WebAssembly 和语音。挑一个好奇的问题，动手做出结果。',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/yuukiLike/yuuki-box' }],
      customCss: ['./src/styles/custom.css'],
      components: {
        Header: './src/components/ContentHeader.astro',
        TwoColumnContent: './src/components/ReadingFrame.astro',
        PageSidebar: '@astrojs/starlight/components/TableOfContents.astro',
      },
      markdown: { processedDirs: ['../docs'] },
      expressiveCode: { themes: ['github-dark', 'github-light'], styleOverrides: { borderRadius: '0.6rem' } },
      sidebar: [
        { label: '文档目录', link: '/' },
        {
          label: '从 MCP 到模型与 Harness',
          items: [
            { slug: 'ai-from-scaling/00-minimal-mcp', label: '看懂一次 MCP 工具调用' },
            { slug: 'ai-from-scaling/07-weatherkit-mcp', label: 'Apple 天气：查询天气、安排出门' },
            { slug: 'ai-from-scaling', label: '开场与四小时主线安排' },
            { slug: 'ai-from-scaling/01-understand-models', label: '1 · 理解模型怎样学习' },
            { slug: 'ai-from-scaling/02-train-a-model', label: '2 · 训练一个小语言模型' },
            { slug: 'ai-from-scaling/03-build-a-harness', label: '3 · 搭建工具调用循环' },
            { slug: 'ai-from-scaling/04-experiments', label: '4 · 接真实模型并做对照' },
            { slug: 'ai-from-scaling/05-blender-mcp', label: 'Blender：让参数变成模型' },
            { slug: 'ai-from-scaling/06-github-lab-mcp', label: 'GitHub：证明一次修复有效' },
            {
              label: '末章选修：音乐 MCP',
              collapsed: true,
              items: [
                { slug: 'ai-from-scaling/07-music-space-mcp', label: '选修 1：声部之结' },
                { slug: 'ai-from-scaling/08-music-photo-mcp', label: '选修 2：光之剧场' },
              ],
            },
          ],
        },
        {
          label: '让 AI 接手开发',
          items: [
            { slug: 'ai-practices', label: '挑一件真活：六种开发实践' },
            { slug: 'ai-practices/your-workflow', label: '少盯几轮：改造你的工作流' },
            {
              label: '接任务、追故障、做迁移',
              items: [
                { slug: 'ai-practices/02-issue-to-pr', label: '交出一张 Issue，接回一份 PR' },
                { slug: 'ai-practices/03-error-to-fix', label: '带着错误现场去破案' },
                { slug: 'ai-practices/06-code-migration', label: '给升级划条线，再让 AI 动手' },
              ],
            },
            {
              label: '审 PR、补测试、修漏洞',
              items: [
                { slug: 'ai-practices/01-coderabbit-review', label: '请 CodeRabbit 来挑一次刺' },
                { slug: 'ai-practices/05-test-generation', label: '写一条真能抓住 bug 的测试' },
                { slug: 'ai-practices/04-security-autofix', label: '追着一条安全告警修到底' },
              ],
            },
            {
              label: '跟做：把 Issue 交给夜班',
              items: [
                { slug: 'issue-garden', label: '白天记 Issue，夜里长出 PR' },
                { slug: 'issue-garden/01-first-scan', label: '第一班：让 Issue 自己来报到' },
                { slug: 'issue-garden/02-first-repair', label: '搭一次班，修掉一个小问题' },
                { slug: 'issue-garden/03-night-shift', label: '交班：让流程接着跑' },
              ],
            },
          ],
        },
        {
          label: '亲手搭 Agent',
          items: [
            { slug: 'agent-engineering', label: '从会聊天，到能把活干完' },
            {
              label: '先管稳运行 · Harness',
              items: [
                { slug: 'agent-engineering/05-harness-vertical-slice', label: '按下取消，然后故意让它崩一次' },
                { slug: 'agent-engineering/06-context-and-report', label: '查清这次慢在哪、贵在哪' },
                { slug: 'agent-engineering/07-scenario-regression', label: '把故障搬进自己的演练场' },
              ],
            },
            {
              label: '再接外部工具 · MCP',
              items: [
                { slug: 'agent-engineering/01-mcp-tool-source', label: '把外部工具接进 Harness' },
                { slug: 'agent-engineering/02-mcp-policy', label: '决定哪些工具可以执行' },
              ],
            },
            {
              label: '教它复用流程 · Skills',
              items: [
                { slug: 'agent-engineering/03-skills-structure', label: '这件事，下次不用从头教' },
                { slug: 'agent-engineering/04-skills-validation', label: '给「做完了」出一道验收题' },
              ],
            },
            { slug: 'architecture/mac-local-harness', label: '完整设计：Mac 本地 Harness' },
          ],
        },
        {
          label: '前端 × AI 实验室',
          items: [
            { slug: 'learning/ai-frontend-intersections', label: '挑个问题，开一场小实验' },
            {
              label: 'AI 应用通信：从 RPC、SSE 到 Agent 工具调用',
              items: [
                { slug: 'ai-communication', label: '课程入口：今天只学一课' },
                { slug: 'ai-communication/01-rpc', label: '1 · 请另一个程序读笔记' },
                { slug: 'ai-communication/02-json-rpc', label: '2 · 让回答找到对应请求' },
                { slug: 'ai-communication/03-sse', label: '3 · 一边接收，一边显示' },
                { slug: 'ai-communication/04-mcp', label: '4 · 看清 MCP 的发现与调用' },
                { slug: 'ai-communication/05-failure', label: '5 · 停止等待后，对方还在做吗' },
                { slug: 'ai-communication/06-yuuki', label: '6 · 回到自己的代码' },
                {
                  label: '实战 · Supabase × Apple 天气 MCP',
                  items: [
                    { slug: 'ai-communication/weather-mcp', label: '入口 · 从连接到查询' },
                    { slug: 'ai-communication/weather-mcp/01-user-journey', label: '1 · 用户点击连接以后' },
                    { slug: 'ai-communication/weather-mcp/02-supabase-auth', label: '2 · Supabase 登录与权限' },
                    { slug: 'ai-communication/weather-mcp/03-apple-weatherkit', label: '3 · 向 Apple 查询天气' },
                    { slug: 'ai-communication/weather-mcp/04-mcp-server', label: '4 · 封装成 MCP 工具' },
                    { slug: 'ai-communication/weather-mcp/05-connect-and-verify', label: '5 · 连接 Codex 与验收' },
                  ],
                },
              ],
            },
            {
              label: '查找与缓存：少做重复功',
              items: [
                { slug: 'frontend-foundations', label: '从一万条消息里找出那一条' },
                { slug: 'frontend-foundations/keys-and-maps', label: 'key、Object、Map 与 WeakMap' },
                { slug: 'frontend-foundations/cache-cost', label: '缓存省下了什么，又留下了什么' },
                { label: '动手：数组与 Map 查找', link: '/labs/lookup/' },
              ],
            },
            {
              label: 'KV Cache：原理与 Agent 应用',
              items: [
                { slug: 'kv-cache', label: '动手拆开 KV Cache' },
                { slug: 'kv-cache/00-first-request', label: '1 · 一条消息怎样到达模型' },
                { slug: 'kv-cache/01-from-frontend', label: '2 · 追加一项，哪些可以不重算' },
                { slug: 'kv-cache/02-attention-and-kv', label: '3 · 看图认识 Q/K/V' },
                { slug: 'kv-cache/00-why-so-large', label: '插一站 · KV 为什么占空间' },
                { slug: 'kv-cache/03-prefix-cache-and-yuuki', label: '4 · DeepSeek 怎样报告命中' },
                { slug: 'kv-cache/04-deepseek-harness', label: '5 · Harness 怎样组织请求' },
                { slug: 'kv-cache/05-pi', label: '6 · Pi 怎样翻译用量' },
                { slug: 'kv-cache/06-study-map', label: '回查 · 词汇、知识地图与实验' },
                { label: '动手：KV 内存计算器', link: '/labs/kv-memory/' },
              ],
            },
            {
              label: '浏览器计算：Wasm 与 Worker',
              items: [
                { slug: 'wasm', label: '让 JavaScript 请来一位 Wasm 外援' },
                { slug: 'wasm/workers-and-memory', label: 'Worker、内存与数据搬运' },
                { slug: 'wasm/browser-ai', label: 'Wasm、WebGPU 与模型运行时' },
                { label: '动手：JavaScript 调用 Wasm', link: '/labs/wasm-bridge/' },
              ],
            },
            {
              label: '界面响应：追踪每次更新',
              items: [
                { slug: 'learning/rendering-performance', label: '抓住让界面卡住的那一步' },
                { slug: 'learning/harness-scenario-lab', label: '五条路线，十五次性能拆招' },
              ],
            },
          ],
        },
        {
          label: '让 Yuuki 听见和开口',
          items: [
            { slug: 'tts', label: '给 Yuuki 装上耳朵和嘴巴' },
            { slug: 'tts/让-Yuuki-开口说第一句话', label: '第一句话，就从这里开始' },
            { slug: 'architecture/ai-and-speech-foundation', label: '把模型、转写与语音接起来' },
          ],
        },
        {
          label: '试试下一种 AI 玩法',
          items: [
            { slug: 'ai-ideas', label: '给下一个好点子找块试验田' },
            { slug: 'ai-ideas/01-ideas-map', label: '摊开人机协作的构想地图' },
            { slug: 'ai-ideas/02-five-new-directions', label: '五个方向，挑一个开玩' },
          ],
        },
        {
          label: '读架构，选路线',
          items: [
            { slug: 'guide', label: '全站路线与项目状态' },
            // 外部 glob 的 filePath 相对 site 根目录；自动目录需使用同一前缀。
            { label: '研究资料', items: [{ autogenerate: { directory: '../docs/research' } }] },
            {
              label: '设计深读',
              items: [
                { label: '简单、组合与复杂性', items: [{ autogenerate: { directory: '../docs/deep/2026-09-26-simplicity-composition-complexity' } }] },
                { label: 'Zed、Rust 与 PI-Desktop', items: [{ autogenerate: { directory: '../docs/deep/2026-09-26-zed-pi-rust' } }] },
              ],
            },
            { slug: 'architecture/technology-assessment', label: '技术评估工具提案' },
            { label: '实施计划', items: [{ autogenerate: { directory: '../docs/plan' } }] },
          ],
        },
      ],
    }),
  ],
});
