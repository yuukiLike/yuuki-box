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
      description: '从前端的 key、Map 与渲染出发，理解缓存、KV Cache、WebAssembly 和 AI 应用。',
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
          label: '01 前端的数据与缓存',
          items: [
            { slug: 'frontend-foundations', label: '从熟悉的问题开始' },
            { slug: 'frontend-foundations/keys-and-maps', label: 'key、Object、Map 与 WeakMap' },
            { slug: 'frontend-foundations/cache-cost', label: '缓存为什么也有成本' },
          ],
        },
        {
          label: '02 从缓存走到 KV',
          items: [
            { slug: 'kv-cache/00-why-so-large', label: '为什么 KV 会这么大' },
            { slug: 'kv-cache/01-from-frontend', label: '从 useMemo 到前缀复用' },
            { slug: 'kv-cache/02-attention-and-kv', label: 'Attention、Prefill 与 Decode' },
            { slug: 'kv-cache/03-prefix-cache-and-yuuki', label: '请求前缀与 DeepSeek' },
            { slug: 'kv-cache', label: '专题与命令行实验' },
          ],
        },
        {
          label: '03 Wasm 与浏览器 AI',
          items: [
            { slug: 'wasm', label: 'Wasm 在哪一层' },
            { slug: 'wasm/workers-and-memory', label: 'Worker、内存与数据搬运' },
            { slug: 'wasm/browser-ai', label: 'Wasm、WebGPU 与模型运行时' },
            { slug: 'learning/ai-frontend-intersections', label: '还可以探索哪些交织点' },
          ],
        },
        {
          label: '浏览器实验',
          items: [
            { label: '数组与 Map 查找', link: '/labs/lookup/' },
            { label: 'KV 内存计算器', link: '/labs/kv-memory/' },
            { label: 'JavaScript 调用 Wasm', link: '/labs/wasm-bridge/' },
          ],
        },
        {
          label: '04 渲染、语音与 Agent',
          items: [
            { slug: 'learning/rendering-performance', label: '渲染与性能' },
            { slug: 'learning/harness-scenario-lab', label: '十五个 Harness 场景' },
            { slug: 'tts', label: '语音工具入门' },
            { slug: 'tts/让-Yuuki-开口说第一句话', label: '第一次发声' },
            { slug: 'architecture/ai-and-speech-foundation', label: '模型与语音基础' },
            { slug: 'architecture/mac-local-harness', label: 'Agent 运行时' },
          ],
        },
        {
          label: '项目与既有研究',
          items: [
            { slug: 'guide', label: '原文档导航与项目状态' },
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
