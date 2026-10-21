import assert from 'node:assert/strict';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import repositoryMarkdown, { documentId, documentUrl, docsRoot, repositoryRoot, resolveDocumentLink } from '../src/lib/docs-paths.mjs';

const source = resolve(docsRoot, 'kv-cache/README.md');

test('all repository Markdown files have distinct routes, including directory README pages', () => {
  const files = [...globSync('**/*.md', { cwd: docsRoot })];
  assert.ok(files.length > 30);
  assert.equal(new Set(files.map(documentId)).size, files.length);
  assert.equal(documentId('README.md'), 'guide');
  assert.equal(documentId('kv-cache/README.md'), 'kv-cache');
  assert.equal(documentId('wasm/README.md'), 'wasm');
});

test('Markdown links preserve anchors and Chinese paths', () => {
  assert.equal(resolveDocumentLink('02-attention-and-kv.md#prefill', source), '/kv-cache/02-attention-and-kv/#prefill');
  assert.equal(resolveDocumentLink('../README.md', source), '/guide/');
  assert.equal(documentUrl('tts/让-Yuuki-开口说第一句话.md'), '/tts/%E8%AE%A9-Yuuki-%E5%BC%80%E5%8F%A3%E8%AF%B4%E7%AC%AC%E4%B8%80%E5%8F%A5%E8%AF%9D/');
});

test('lab pages and downloadable sources point to local built routes', () => {
  assert.equal(resolveDocumentLink('../../site/src/pages/labs/kv-memory.astro', source), '/labs/kv-memory/');
  assert.equal(resolveDocumentLink('../../site/src/pages/index.astro', source), '/');
  assert.equal(resolveDocumentLink('labs/prefix-cache.mjs', source), '/source/kv-cache/labs/prefix-cache.mjs');
});

test('repository code links preserve line numbers and other local checkouts remain non-links', () => {
  const file = resolve(repositoryRoot, 'examples/shared/runtime/Sources/main.swift');
  assert.equal(resolveDocumentLink(`${file}:356`, source), 'https://github.com/yuukiLike/yuuki-box/blob/main/examples/shared/runtime/Sources/main.swift#L356');
  assert.equal(resolveDocumentLink('/Users/chp/explore/zed/crates/gpui/src/lib.rs:5', source), null);
  assert.equal(resolveDocumentLink('https://example.com/a', source), 'https://example.com/a');
});

test('public diagram images and their full-size links share a local URL while other images keep their source', () => {
  const document = resolve(docsRoot, 'issue-garden/04-ideas-map.md');
  const target = '../../site/public/diagrams/issue-garden-map.svg';
  assert.equal(resolveDocumentLink(target, document), '/diagrams/issue-garden-map.svg');
  const tree = { type: 'root', children: [
    { type: 'image', url: target, alt: '两项已有设想与五个新方向' },
    { type: 'image', url: 'local-image.png', alt: '交给 Astro 处理的图片' },
    { type: 'image', url: 'https://example.com/image.png', alt: '远程图片' },
  ] };
  repositoryMarkdown()(tree, { path: document });
  assert.equal(tree.children[0].url, '/diagrams/issue-garden-map.svg');
  assert.equal(tree.children[0].alt, '两项已有设想与五个新方向');
  assert.equal(tree.children[1].url, 'local-image.png');
  assert.equal(tree.children[2].url, 'https://example.com/image.png');
});

test('rendering removes the source H1 once and rewrites links without editing the Markdown source', () => {
  const tree = { type: 'root', children: [
    { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Title' }] },
    { type: 'paragraph', children: [{ type: 'link', url: '../README.md', children: [{ type: 'text', value: '导航' }] }] },
  ] };
  repositoryMarkdown()(tree, { path: source });
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].children[0].url, '/guide/');
});
