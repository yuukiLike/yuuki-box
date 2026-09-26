import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, '../..');
const nativeOut = path.join(examples, 'react-native-bridge/build/assets');
const webOut = path.join(examples, 'react-webview/build/assets');
await Promise.all([mkdir(nativeOut, { recursive: true }), mkdir(webOut, { recursive: true })]);
await build({ entryPoints: [path.join(examples, 'react-native-bridge/src/main.jsx')], outfile: path.join(nativeOut, 'renderer.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node22', nodePaths: [path.join(here, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, sourcemap: true });
await build({ entryPoints: [path.join(examples, 'react-webview/src/main.jsx')], outfile: path.join(webOut, 'app.js'), bundle: true, platform: 'browser', format: 'iife', target: 'safari17', nodePaths: [path.join(here, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, sourcemap: true });
await copyFile(path.join(examples, 'react-webview/src/style.css'), path.join(webOut, 'style.css'));
await writeFile(path.join(webOut, 'index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><title>Yuuki · React + WKWebView</title><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>`);
console.log('Built React reconciler (Node) and ReactDOM (WebKit) bundles.');
