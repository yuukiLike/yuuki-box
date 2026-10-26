import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { locationSchema, type Location } from './config.js';
import { findWindows, makeReport, reportSchema, windowInputSchema, windowsSchema } from './forecast.js';
import { WeatherKit } from './weatherkit.js';

async function result(run: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await run();
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : '天气工具执行失败。' }] };
  }
}

export function createServer(weather: WeatherKit, locations: Location[]): McpServer {
  const server = new McpServer({ name: 'yuuki-weatherkit', version: '1.0.0' }, {
    instructions: '先用 list_locations 确认地点，不猜坐标。天气结果必须注明数据时间与地点时区；fixture 是人工样本。展示真实天气时保留 source.attribution 中的官方 Apple Weather 标识和法律来源链接。找出门时段时使用用户条件，不因没有匹配而自行放宽；这是数值筛选，不是户外安全保证。',
  });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
  const locate = (name: string) => {
    const location = locations.find(item => item.name === name);
    if (!location) throw new Error('未配置该地点。先调用 list_locations，或编辑地点文件后重启服务；不要猜测坐标。');
    return location;
  };

  server.registerTool('list_locations', {
    description: '列出已配置的常用地点、坐标和时区。这里不会自动定位用户，也不执行城市名搜索。',
    inputSchema: z.strictObject({}),
    outputSchema: z.object({ locations: z.array(locationSchema) }),
    annotations: { ...readOnly, openWorldHint: false },
  }, async () => result(async () => ({ locations })));

  server.registerTool('get_weather', {
    description: '查询常用地点的当前天气、未来逐小时和逐日预报。摄氏度、km/h、百分比；必须报告数据时间、是否缓存、Apple Weather 标识和来源链接。fixture 是人工样本，不能当成当前天气。',
    inputSchema: z.strictObject({
      location: z.string().min(1).describe('list_locations 返回的名称。'),
      hours: z.number().int().min(1).max(72).default(24),
      days: z.number().int().min(1).max(10).default(3),
      refresh: z.boolean().default(false).describe('true 绕过本服务缓存，会消耗 WeatherKit 请求。'),
    }),
    outputSchema: reportSchema,
    annotations: readOnly,
  }, async ({ location: name, hours, days, refresh }, context) => result(async () => {
    const location = locate(name);
    const snapshot = await weather.get(location, refresh, context.mcpReq.signal);
    return makeReport(snapshot, location, weather.now(), hours, days);
  }));

  server.registerTool('find_outdoor_windows', {
    description: '按降雨概率、风速、体感温度、UV、白天和当地时间筛选连续出门时段，返回每小时依据。默认筛选未来 72 小时内的整小时。不是运动安全评估，不含预警或空气质量。保留来源署名。',
    inputSchema: windowInputSchema,
    outputSchema: windowsSchema,
    annotations: readOnly,
  }, async (criteria, context) => result(async () => {
    const location = locate(criteria.location);
    const snapshot = await weather.get(location, criteria.refresh, context.mcpReq.signal);
    return findWindows(makeReport(snapshot, location, weather.now(), 73, 10), criteria);
  }));
  return server;
}
