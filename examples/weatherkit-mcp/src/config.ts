import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';

export const locationSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
    catch { return false; }
  }, '请使用有效的 IANA 时区，例如 Asia/Shanghai。'),
});
export type Location = z.infer<typeof locationSchema>;

export const locationsSchema = z.array(locationSchema).min(1).max(20).refine(
  locations => new Set(locations.map(location => location.name)).size === locations.length,
  '地点名称不能重复。',
);

export async function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_SERVICE_ID', 'APPLE_PRIVATE_KEY_PATH', 'WEATHERKIT_LOCATIONS_FILE'] as const;
  for (const name of required) {
    if (!env[name]?.trim()) throw new Error(`缺少 ${name}，请按 .env.example 配置。`);
  }
  const teamId = env.APPLE_TEAM_ID!;
  const keyId = env.APPLE_KEY_ID!;
  const serviceId = env.APPLE_SERVICE_ID!;
  if (!/^[A-Z0-9]{10}$/.test(teamId) || !/^[A-Z0-9]{10}$/.test(keyId)) {
    throw new Error('APPLE_TEAM_ID 和 APPLE_KEY_ID 应为 10 位大写字母或数字。');
  }
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(serviceId)) {
    throw new Error('APPLE_SERVICE_ID 应为已注册的反向域名式标识。');
  }
  const privateKeyPath = env.APPLE_PRIVATE_KEY_PATH!;
  const locationsPath = env.WEATHERKIT_LOCATIONS_FILE!;
  if (!isAbsolute(privateKeyPath) || !isAbsolute(locationsPath)) {
    throw new Error('私钥和地点文件必须使用绝对路径。');
  }
  let locations: Location[];
  try { locations = locationsSchema.parse(JSON.parse(await readFile(locationsPath, 'utf8'))); }
  catch { throw new Error('地点文件无法读取或格式无效：检查名称唯一、经纬度范围和 IANA 时区。'); }

  let key: CryptoKey;
  try { key = await importPKCS8(await readFile(privateKeyPath, 'utf8'), 'ES256'); }
  catch { throw new Error('无法读取或导入 WeatherKit .p8 私钥，请检查文件路径和 ES256 密钥格式。'); }

  // 缓存认证令牌，而非把私钥交给 MCP 客户端。提前一分钟续签。
  let token = '';
  let expiresAt = 0;
  async function getToken(now: number) {
    const seconds = Math.floor(now / 1000);
    if (token && seconds < expiresAt - 60) return token;
    const expiration = seconds + 1800;
    token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId, id: `${teamId}.${serviceId}` })
      .setIssuer(teamId).setSubject(serviceId).setIssuedAt(seconds).setExpirationTime(expiration)
      .sign(key);
    expiresAt = expiration;
    return token;
  }
  return { locations, getToken };
}
