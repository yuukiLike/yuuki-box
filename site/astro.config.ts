import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import repositoryMarkdown from './src/lib/docs-paths.mjs';
import { starlightSidebar } from './src/lib/navigation.mjs';

export default defineConfig({
  trailingSlash: 'always',
  markdown: { processor: unified({ remarkPlugins: [repositoryMarkdown] }) },
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [
    {
      name: 'yuuki-navigation',
      hooks: {
        'astro:config:setup': ({ addWatchFile }) => {
          // 分组在配置加载时生成，变更后要与页面中的标签一起刷新。
          addWatchFile(new URL('./src/lib/navigation.mjs', import.meta.url));
        },
      },
    },
    starlight({
      title: 'Yuuki 学习手记',
      credits: false,
      disable404Route: true,
      description: '从 MCP 入门接着做工具实战，按需学习远程授权；另可选择模型基础、Agent 工程、AI 开发、应用通信、前端性能与语音交互。',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/yuukiLike/yuuki-box' }],
      customCss: ['./src/styles/custom.css'],
      components: {
        Header: './src/components/ContentHeader.astro',
        PageTitle: './src/components/PageTitle.astro',
        Footer: './src/components/ReadingFooter.astro',
        TwoColumnContent: './src/components/ReadingFrame.astro',
        PageSidebar: '@astrojs/starlight/components/TableOfContents.astro',
      },
      markdown: { processedDirs: ['../docs'] },
      expressiveCode: { themes: ['github-dark', 'github-light'], styleOverrides: { borderRadius: '0.6rem' } },
      sidebar: starlightSidebar(),
    }),
  ],
});
