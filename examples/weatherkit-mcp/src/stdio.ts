import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { WeatherKit } from './weatherkit.js';

serveStdio(async () => {
  const { locations, getToken } = await loadConfig();
  return createServer(new WeatherKit({ getToken }), locations);
}, { onerror: error => { console.error(error.message); process.exitCode = 1; } });
