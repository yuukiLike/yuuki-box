import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

serveStdio(createServer, { onerror: error => console.error(error.message) });
console.error('Yuuki Blender MCP 已启动，等待 stdio 请求。');
