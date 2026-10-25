import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

function createServer() {
  const server = new McpServer({ name: 'yuuki-budget', version: '1.0.0' });
  server.registerTool('calculate_total', {
    description: '根据人数、每人费用、场地费和预算核算活动花费，金额单位为元。',
    inputSchema: z.object({
      people: z.number().int().min(1).max(1000),
      perPerson: z.number().min(0).max(1e6),
      venue: z.number().min(0).max(1e6),
      budget: z.number().min(0).max(1e6),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ people, perPerson, venue, budget }) => {
    const total = Math.round((people * perPerson + venue) * 100) / 100;
    const result = {
      total,
      remaining: Math.round((budget - total) * 100) / 100,
      withinBudget: total <= budget,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  });
  return server;
}

// SDK 负责协议版本协商与消息分帧；stdout 只留给 MCP 消息。
serveStdio(createServer, { onerror: (error) => console.error(error.message) });
console.error('Yuuki budget MCP 已启动，等待 stdio 请求。');
