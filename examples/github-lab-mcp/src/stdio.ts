import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

serveStdio(createServer, { onerror: error => console.error(error.message) });
console.error('Yuuki GitHub Lab MCP 已启动。');
