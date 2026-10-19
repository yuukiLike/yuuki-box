import { existsSync, globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../dist/', import.meta.url));
const pages = [...globSync('**/*.html', { cwd: output })];
if (!pages.length) throw new Error('没有找到构建页面，请先运行 Astro 构建。');

const missing = new Set();
const assets = new Set();
for (const page of pages) {
  const html = readFileSync(resolve(output, page), 'utf8');
  for (const [, href] of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    if (!href.startsWith('/_astro/')) continue;
    const pathname = decodeURIComponent(href.split(/[?#]/)[0]);
    assets.add(pathname);
    if (!existsSync(resolve(output, `.${pathname}`))) missing.add(`${page}: ${pathname}`);
  }
}

if (missing.size) throw new Error(`构建页面引用了缺失的静态资源：\n${[...missing].join('\n')}`);
console.log(`已验证 ${pages.length} 个页面引用的 ${assets.size} 个静态资源。`);
