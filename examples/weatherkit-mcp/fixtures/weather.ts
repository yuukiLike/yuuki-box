import type { Location } from '../src/config.js';

// 人工构造的教学数据，不是 Apple 返回的天气；固定在上海 2026-10-26 08:30。
export const fixtureNow = Date.parse('2026-10-26T00:30:00Z');
export const fixtureLocation: Location = { name: '上海', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai' };
export function fixtureWeather() {
  const metadata = {
    attributionURL: 'https://weatherkit.apple.com/legal-attribution.html',
    readTime: new Date(fixtureNow).toISOString(), expireTime: new Date(fixtureNow + 3_600_000).toISOString(), units: 'm',
  };
  const conditions = { conditionCode: 'PartlyCloudy', temperature: 22, temperatureApparent: 23, humidity: 0.65, windSpeed: 12, uvIndex: 3 };
  return {
    currentWeather: { metadata, asOf: new Date(fixtureNow).toISOString(), ...conditions },
    forecastHourly: {
      metadata,
      hours: Array.from({ length: 73 }, (_, index) => ({
        forecastStart: new Date(fixtureNow - 30 * 60_000 + index * 3_600_000).toISOString(),
        ...conditions,
        // 10 点和 13 点降雨概率高，把连续时段切开，供阈值练习使用。
        precipitationChance: index % 24 === 2 || index % 24 === 5 ? 0.8 : 0.1,
        daylight: (index + 8) % 24 >= 7 && (index + 8) % 24 < 18,
      })),
    },
    forecastDaily: {
      metadata,
      days: Array.from({ length: 10 }, (_, index) => ({
        forecastStart: new Date(Date.parse('2026-10-25T16:00:00Z') + index * 86_400_000).toISOString(),
        forecastEnd: new Date(Date.parse('2026-10-26T16:00:00Z') + index * 86_400_000).toISOString(),
        conditionCode: 'PartlyCloudy', temperatureMin: 18, temperatureMax: 25, precipitationChance: 0.8, maxUvIndex: 4,
      })),
    },
  };
}
export const fixtureAttribution = {
  serviceName: 'Apple Weather',
  'logoLight@2x': '/fixture/apple-weather-light.png',
  'logoDark@2x': '/fixture/apple-weather-dark.png',
};
export const fixtureFetch: typeof fetch = async input => {
  const url = new URL(String(input));
  return Response.json(url.pathname.startsWith('/attribution/') ? fixtureAttribution : fixtureWeather());
};
