import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

// 启动与业务分开；导入 server.ts 不会启动进程或占用 stdout。
serveStdio(createServer, { onerror: (error) => console.error(error.message) });
console.error('[服务] yuuki-continue 已启动 | transport=stdio');
