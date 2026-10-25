import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

serveStdio(createServer, { onerror: error => console.error(error.message) });
console.error('Yuuki Music Space MCP 已启动。');
