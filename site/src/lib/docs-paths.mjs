import { existsSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { learningStep } from './learning-guide.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const docsRoot = resolve(repositoryRoot, 'docs');
const github = 'https://github.com/yuukiLike/yuuki-box/blob/main/';
const posix = (value) => value.split(sep).join('/');

export function documentId(entry) {
  return entry.replace(/\.(md|mdx)$/i, '').replace(/(^|\/)README$/i, '') || 'guide';
}

export function documentUrl(entry) {
  return `/${documentId(entry).split('/').map(encodeURIComponent).join('/')}/`;
}

// Markdown 保持可在仓库阅读；只在网站渲染时改写目标地址。
export function resolveDocumentLink(target, sourceFile) {
  if (!target || target.startsWith('#') || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) return target;
  // 当前检出的绝对路径也需要转换；保留站内 URL 和已有的 macOS 路径处理。
  const inCheckout = target.startsWith(repositoryRoot) || target.startsWith(encodeURI(repositoryRoot));
  if (target.startsWith('/') && !target.startsWith('/Users/') && !inCheckout) return target;

  const [, pathname, suffix = ''] = target.match(/^([^?#]*)(.*)$/);
  const decoded = decodeURIComponent(pathname);
  const line = decoded.match(/:(\d+)$/);
  const filename = decoded.replace(/:\d+$/, '');
  const absolute = resolve(dirname(sourceFile), filename);
  const fromRepo = posix(relative(repositoryRoot, absolute));
  const fromDocs = posix(relative(docsRoot, absolute));

  if (fromRepo.startsWith('../')) return null;
  if (fromRepo.startsWith('site/public/')) {
    return '/' + fromRepo.slice('site/public/'.length).split('/').map(encodeURIComponent).join('/') + suffix;
  }
  if (!fromDocs.startsWith('../') && /\.(md|mdx)$/i.test(filename) && existsSync(absolute)) {
    return documentUrl(fromDocs) + suffix;
  }
  if (!fromDocs.startsWith('../') && fromDocs.includes('/labs/') && /\.(mjs|ts|wat)$/.test(filename)) {
    return '/source/' + fromDocs.split('/').map(encodeURIComponent).join('/') + suffix;
  }
  if (fromRepo.startsWith('site/src/pages/') && filename.endsWith('.astro')) {
    const route = fromRepo.slice('site/src/pages/'.length).replace(/\.astro$/, '').replace(/(^|\/)index$/, '');
    return '/' + (route ? route + '/' : '') + suffix;
  }
  const location = line ? `#L${line[1]}` : suffix;
  const url = github + fromRepo.split('/').map(encodeURIComponent).join('/');
  return extname(filename) ? url + location : url.replace('/blob/', '/tree/') + location;
}

export default function repositoryMarkdown() {
  return (tree, file) => {
    const sourceFile = file.path;
    if (!sourceFile || relative(docsRoot, sourceFile).startsWith('..')) return;
    const firstHeading = tree.children.findIndex((node) => node.type === 'heading' && node.depth === 1);
    if (firstHeading >= 0) tree.children.splice(firstHeading, 1);

    const step = learningStep(documentId(posix(relative(docsRoot, sourceFile))));
    if (step) {
      const text = (node) => node.value ?? (node.children ?? []).map(text).join('');
      const start = tree.children.findIndex((node) => node.type === 'heading'
        && (step.section ? text(node) === step.section : node.depth === 2));
      tree.children.splice(Math.max(0, start), 0, { type: 'html', value: '<span id="learning-step-start"></span>' });
    }

    function visit(node) {
      if (node.type === 'image' && node.url) {
        const rewritten = resolveDocumentLink(node.url, sourceFile);
        // Public assets have a stable site URL; leave other images to Astro's asset pipeline.
        if (rewritten?.startsWith('/')) node.url = rewritten;
      }
      if ((node.type === 'link' || node.type === 'definition') && node.url) {
        const rewritten = resolveDocumentLink(node.url, sourceFile);
        if (rewritten === null) {
          // 其他本机 checkout 的路径保留为文字，避免形成网站里的无效路由。
          node.type = 'inlineCode';
          node.value = `${node.children?.map((child) => child.value ?? '').join('') || '本机源码'} · ${node.url}`;
          delete node.url;
          delete node.children;
        } else node.url = rewritten;
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
