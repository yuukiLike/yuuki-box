import { z } from 'zod';
import { locationSchema, type Location } from './config.js';
import { sourceSchema, type Snapshot } from './weatherkit.js';

const hourMs = 3_600_000;
const time = z.iso.datetime({ offset: true });
export const hourSchema = z.object({
  start: time, end: time, localStart: z.string(), conditionCode: z.string(),
  temperatureC: z.number(), feelsLikeC: z.number(), rainChancePercent: z.number(),
  windKph: z.number(), uvIndex: z.number(), daylight: z.boolean().nullable(),
});
export const reportSchema = z.object({
  location: locationSchema, source: sourceSchema, queriedAt: time,
  current: z.object({
    asOf: time, conditionCode: z.string(), temperatureC: z.number(), feelsLikeC: z.number(),
    humidityPercent: z.number(), windKph: z.number(), uvIndex: z.number(),
  }),
  hourly: z.array(hourSchema),
  daily: z.array(z.object({
    date: z.string(), conditionCode: z.string(), minTemperatureC: z.number(), maxTemperatureC: z.number(),
    rainChancePercent: z.number(), maxUvIndex: z.number(), sunrise: time.nullable(), sunset: time.nullable(),
  })),
});
export type Report = z.infer<typeof reportSchema>;

export function localDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
function localMinutes(iso: string, timezone: string) {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
  const [hour, minute] = clock.split(':').map(Number);
  return hour! * 60 + minute!;
}
export function makeReport(snapshot: Snapshot, location: Location, now: number, hours: number, days: number): Report {
  const { weather, source } = snapshot;
  const current = weather.currentWeather;
  // 筛选前不四舍五入，避免把 30.04% 当成满足“至多 30%”。
  const percent = (value: number) => value * 100;
  return {
    location, source, queriedAt: new Date(now).toISOString(),
    current: {
      asOf: current.asOf, conditionCode: current.conditionCode, temperatureC: current.temperature,
      feelsLikeC: current.temperatureApparent, humidityPercent: percent(current.humidity),
      windKph: current.windSpeed, uvIndex: current.uvIndex,
    },
    hourly: weather.forecastHourly.hours
      .filter(hour => Date.parse(hour.forecastStart) + hourMs > now)
      .sort((a, b) => Date.parse(a.forecastStart) - Date.parse(b.forecastStart)).slice(0, hours)
      .map(hour => ({
        start: hour.forecastStart, end: new Date(Date.parse(hour.forecastStart) + hourMs).toISOString(),
        localStart: new Intl.DateTimeFormat('sv-SE', { timeZone: location.timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(hour.forecastStart)),
        conditionCode: hour.conditionCode, temperatureC: hour.temperature, feelsLikeC: hour.temperatureApparent,
        rainChancePercent: percent(hour.precipitationChance), windKph: hour.windSpeed,
        uvIndex: hour.uvIndex, daylight: hour.daylight ?? null,
      })),
    daily: weather.forecastDaily.days.filter(day => Date.parse(day.forecastEnd) > now)
      .sort((a, b) => Date.parse(a.forecastStart) - Date.parse(b.forecastStart)).slice(0, days)
      .map(day => ({
        date: localDate(day.forecastStart, location.timezone), conditionCode: day.conditionCode,
        minTemperatureC: day.temperatureMin, maxTemperatureC: day.temperatureMax,
        rainChancePercent: percent(day.precipitationChance), maxUvIndex: day.maxUvIndex,
        sunrise: day.sunrise ?? null, sunset: day.sunset ?? null,
      })),
  };
}

export const windowInputSchema = z.strictObject({
  location: z.string().min(1).describe('list_locations 返回的地点名称，不猜测坐标。'),
  date: z.iso.date().optional().describe('可选：地点当地日期 YYYY-MM-DD，须位于未来 72 小时预报内。'),
  durationHours: z.number().int().min(1).max(6).default(1),
  startHour: z.number().int().min(0).max(23).default(7).describe('当地允许的开始小时，包含此小时。'),
  endHour: z.number().int().min(1).max(24).default(22).describe('当地结束小时，时段必须在此之前结束，24 表示午夜。'),
  maxRainChancePercent: z.number().min(0).max(100).default(30),
  maxWindKph: z.number().min(0).max(150).default(20),
  minFeelsLikeC: z.number().min(-60).max(60).default(5),
  maxFeelsLikeC: z.number().min(-60).max(60).default(32),
  maxUvIndex: z.number().min(0).max(30).default(5),
  daylightOnly: z.boolean().default(true),
  refresh: z.boolean().default(false),
}).refine(input => input.startHour < input.endHour, 'startHour 必须小于 endHour；跨午夜活动请分两次查询。')
  .refine(input => input.minFeelsLikeC <= input.maxFeelsLikeC, '最低体感温度不能高于最高体感温度。');
export const windowsSchema = z.object({
  location: locationSchema, source: sourceSchema, queriedAt: time,
  criteria: windowInputSchema, checkedHours: z.number(),
  coverage: z.object({ from: time.nullable(), to: time.nullable(), missingDaylightHours: z.number() }),
  windows: z.array(z.object({ start: time, end: time, localStart: z.string(), hours: z.array(hourSchema) })),
  explanation: z.string(),
});

export function findWindows(report: Report, criteria: z.output<typeof windowInputSchema>) {
  const now = Date.parse(report.queriedAt);
  const hours = report.hourly.filter(hour => Date.parse(hour.start) >= now && Date.parse(hour.end) <= now + 72 * hourMs);
  const eligible = criteria.date ? hours.filter(hour => localDate(hour.start, report.location.timezone) === criteria.date) : hours;
  if (!eligible.length) throw new Error('所选日期没有可用的未来整小时预报，请查看 get_weather 的时间范围。');
  const qualifies = (hour: Report['hourly'][number]) => {
    const clock = localMinutes(hour.start, report.location.timezone);
    const endClock = localMinutes(hour.end, report.location.timezone);
    const endsAtMidnight = endClock === 0 && localDate(hour.start, report.location.timezone) !== localDate(hour.end, report.location.timezone);
    return clock >= criteria.startHour * 60 && clock < criteria.endHour * 60
      && (endsAtMidnight ? 1440 : endClock) <= criteria.endHour * 60
      && (endsAtMidnight || endClock >= criteria.startHour * 60)
      && hour.rainChancePercent <= criteria.maxRainChancePercent && hour.windKph <= criteria.maxWindKph
      && hour.feelsLikeC >= criteria.minFeelsLikeC && hour.feelsLikeC <= criteria.maxFeelsLikeC
      && hour.uvIndex <= criteria.maxUvIndex && (!criteria.daylightOnly || hour.daylight === true);
  };
  const windows: z.infer<typeof windowsSchema>['windows'] = [];
  for (let index = 0; index <= eligible.length - criteria.durationHours && windows.length < 5; index++) {
    const slice = eligible.slice(index, index + criteria.durationHours);
    const first = slice[0]!;
    const last = slice.at(-1)!;
    // 时间戳相邻才算连续；缺失一小时不能用数组相邻冒充。
    if (!slice.every((hour, offset) => qualifies(hour) && Date.parse(hour.start) === Date.parse(first.start) + offset * hourMs)) continue;
    if (localDate(first.start, report.location.timezone) !== localDate(last.start, report.location.timezone)) continue;
    windows.push({ start: first.start, end: last.end, localStart: first.localStart, hours: slice });
    index += criteria.durationHours - 1;
  }
  return {
    location: report.location, source: report.source, queriedAt: report.queriedAt, criteria,
    checkedHours: eligible.length,
    coverage: { from: hours[0]?.start ?? null, to: hours.at(-1)?.end ?? null, missingDaylightHours: eligible.filter(hour => hour.daylight === null).length },
    windows,
    explanation: '按所列阈值筛选未来整小时，最多返回 5 个最早且互不重叠的时段。空列表只表示已有预报中没有匹配；未检查天气预警和空气质量，不代表户外活动安全保证。',
  };
}
