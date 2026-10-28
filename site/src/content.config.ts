import { readFile } from 'node:fs/promises';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { i18nLoader } from '@astrojs/starlight/loaders';
import { documentId, docsRoot } from './lib/docs-paths.mjs';
import { pageMetadata } from './lib/navigation.mjs';

const source = glob({
  base: docsRoot,
  pattern: '**/*.md',
  generateId: ({ entry }) => documentId(entry),
});

// 复用 Astro 的文件监听、内容解析与缓存，不复制一份生成的 Markdown。
const repositoryDocs: Loader = {
  name: 'yuuki-repository-docs',
  async load(context) {
    await source.load({
      ...context,
      async parseData(options) {
        if (!options.filePath) throw new Error(`文档缺少源文件路径：${options.id}`);
        const markdown = await readFile(options.filePath, 'utf8');
        const title = markdown.match(/^#\s+(.+)$/m)?.[1].replace(/[*`]/g, '');
        if (!title) throw new Error(`文档需要一级标题：${options.filePath}`);
        Object.assign(options.data, { title, editUrl: false });
        const metadata = pageMetadata(options.id);
        if (metadata) {
          const sidebar = options.data.sidebar as { attrs?: Record<string, unknown> } | undefined;
          Object.assign(options.data, {
            sidebar: {
              ...sidebar,
              attrs: { ...sidebar?.attrs, 'data-topic': metadata.color, title },
            },
          });
        }
        return context.parseData(options);
      },
    });
  },
};

export const collections = {
  docs: defineCollection({ loader: repositoryDocs, schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
