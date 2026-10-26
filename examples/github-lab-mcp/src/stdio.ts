import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

serveStdio(createServer, { onerror: error => console.error(error.message) });
console.error('[服务] yuuki-github-lab 已启动 | transport=stdio');
