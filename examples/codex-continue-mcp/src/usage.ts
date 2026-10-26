import {
  isJSONRPCErrorResponse,
  isJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  type JSONRPCMessage,
} from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

const countsSchema = z.object({
  calls: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  averageDurationMs: z.number().nonnegative(),
  maxDurationMs: z.number().nonnegative(),
  lastCalledAt: z.string().nullable(),
});

export const usageStatsSchema = countsSchema.extend({
  storagePath: z.string(),
  connections: z.number().int().nonnegative(),
  tools: z.array(countsSchema.extend({ name: z.string() })),
  hosts: z.array(countsSchema.extend({
    name: z.string().nullable(),
    version: z.string().nullable(),
    connections: z.number().int().nonnegative(),
  })),
});

const clientInfoSchema = z.object({ name: z.string(), version: z.string() });
type ClientInfo = z.infer<typeof clientInfoSchema>;

// 所有计数从同一份按连接、工具累计的数据求和，不另存容易失配的总计。
const totalsSql = `
  COALESCE(SUM(u.calls), 0) AS calls,
  COALESCE(SUM(u.calls - u.failed), 0) AS succeeded,
  COALESCE(SUM(u.failed), 0) AS failed,
  COALESCE(ROUND(SUM(u.duration_ms) / SUM(u.calls), 2), 0) AS averageDurationMs,
  COALESCE(ROUND(MAX(u.max_duration_ms), 2), 0) AS maxDurationMs,
  MAX(u.last_called_at) AS lastCalledAt
`;

export class UsageStore {
  readonly path: string;
  private database: DatabaseSync | undefined;
  private readonly connectionId = randomUUID();

  constructor(private readonly directory: string) {
    this.path = join(directory, '.usage.sqlite');
  }

  private open(): DatabaseSync {
    if (this.database) return this.database;
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    closeSync(openSync(this.path, 'a', 0o600));
    const database = new DatabaseSync(this.path);
    try {
      // 多个 Host 进程共享文件。锁等待有上限，统计不能无限拖住工具。
      database.exec(`
        PRAGMA busy_timeout = 250;
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY,
          host_name TEXT,
          host_version TEXT,
          connected_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tool_usage (
          connection_id TEXT NOT NULL,
          tool TEXT NOT NULL,
          calls INTEGER NOT NULL,
          failed INTEGER NOT NULL,
          duration_ms REAL NOT NULL,
          max_duration_ms REAL NOT NULL,
          last_called_at TEXT NOT NULL,
          PRIMARY KEY (connection_id, tool)
        );
      `);
    } catch (error) {
      database.close();
      throw error;
    }
    this.database = database;
    return database;
  }

  record(client: ClientInfo | undefined, call?: { tool: string; failed: boolean; durationMs: number }): void {
    const database = this.open();
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare(`
        INSERT INTO connections (id, host_name, host_version, connected_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          host_name = COALESCE(connections.host_name, excluded.host_name),
          host_version = COALESCE(connections.host_version, excluded.host_version)
      `).run(this.connectionId, client?.name ?? null, client?.version ?? null, now);
      if (call) {
        database.prepare(`
          INSERT INTO tool_usage VALUES (?, ?, 1, ?, ?, ?, ?)
          ON CONFLICT(connection_id, tool) DO UPDATE SET
            calls = tool_usage.calls + 1,
            failed = tool_usage.failed + excluded.failed,
            duration_ms = tool_usage.duration_ms + excluded.duration_ms,
            max_duration_ms = MAX(tool_usage.max_duration_ms, excluded.max_duration_ms),
            last_called_at = excluded.last_called_at
        `).run(this.connectionId, call.tool, Number(call.failed), call.durationMs, call.durationMs, now);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  read(): z.infer<typeof usageStatsSchema> {
    const database = this.open();
    // 保证总计、按工具和按 Host 的结果来自同一个快照。
    database.exec('BEGIN');
    try {
      const stats = usageStatsSchema.parse({
        storagePath: this.path,
        ...database.prepare('SELECT COUNT(*) AS connections FROM connections').get(),
        ...database.prepare(`SELECT ${totalsSql} FROM tool_usage u`).get(),
        tools: database.prepare(`SELECT u.tool AS name, ${totalsSql} FROM tool_usage u GROUP BY u.tool ORDER BY u.tool`).all(),
        hosts: database.prepare(`
          SELECT c.host_name AS name, c.host_version AS version, COUNT(DISTINCT c.id) AS connections, ${totalsSql}
          FROM connections c LEFT JOIN tool_usage u ON u.connection_id = c.id
          GROUP BY c.host_name, c.host_version ORDER BY c.host_name, c.host_version
        `).all(),
      });
      database.exec('COMMIT');
      return stats;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }
}

// 在公开的传输入口观察请求和响应，SDK 拒绝的参数也能计入失败；不读取或保存工具参数。
export class UsageTransport extends StdioServerTransport {
  private readonly pending = new Map<string | number, { tool?: string; client?: ClientInfo; started: number }>();
  private client: ClientInfo | undefined;
  private recordedClient: ClientInfo | undefined;
  private connected = false;
  private connectionRecorded = false;
  private ended = false;

  constructor(private readonly usage: UsageStore) {
    super();
  }

  override async start(): Promise<void> {
    const receive = this.onmessage;
    this.onmessage = (message) => {
      if (isJSONRPCRequest(message)) {
        const candidate = message.method === 'initialize'
          ? message.params?.clientInfo
          : message.params?._meta?.['io.modelcontextprotocol/clientInfo'];
        const client = clientInfoSchema.safeParse(candidate);
        if (['initialize', 'server/discover', 'tools/list', 'tools/call'].includes(message.method)) {
          const tool = message.method === 'tools/call' && typeof message.params?.name === 'string'
            ? message.params.name : undefined;
          this.pending.set(message.id, {
            ...(tool !== undefined && { tool }),
            ...(client.success && { client: client.data }),
            started: performance.now(),
          });
        }
      } else if (isJSONRPCNotification(message) && message.method === 'notifications/cancelled') {
        const id = message.params?.requestId;
        if (typeof id === 'string' || typeof id === 'number') this.pending.delete(id);
      }
      receive?.(message);
    };
    await super.start();
  }

  override async send(message: JSONRPCMessage): Promise<void> {
    if (!this.ended && (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) && message.id !== undefined) {
      const request = this.pending.get(message.id);
      this.pending.delete(message.id);
      // 初始化/发现的协议错误不算连接成功。仅启动进程也不会产生计数。
      if (request && (this.connected || isJSONRPCResultResponse(message))) {
        this.connected = true;
        if (!this.client && request.client && isJSONRPCResultResponse(message)) this.client = request.client;
        const call = request.tool && request.tool !== 'get_usage_stats' ? {
          tool: request.tool,
          failed: isJSONRPCErrorResponse(message) || message.result.isError === true,
          durationMs: performance.now() - request.started,
        } : undefined;
        if (!this.connectionRecorded || this.recordedClient !== this.client || call) {
          try {
            this.usage.record(this.client, call);
            this.connectionRecorded = true;
            this.recordedClient = this.client;
          } catch (error) {
            const warning = `使用统计未能写入：${error instanceof Error ? error.message : String(error)}`;
            console.error(warning);
            // 统计失败不把已经完成的存取操作改报失败，但调用者能看到缺失的统计。
            if (isJSONRPCResultResponse(message) && Array.isArray(message.result.content)) {
              message.result.content.push({ type: 'text', text: warning });
            }
          }
        }
      }
    }
    await super.send(message);
  }

  override async close(): Promise<void> {
    this.ended = true;
    this.pending.clear();
    try {
      await super.close();
    } finally {
      this.usage.close();
    }
  }
}
