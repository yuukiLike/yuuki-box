import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

type Waiting = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  detachAbort: () => void;
};

// 只服务于本课程的 stdio、数字 id、单条响应子集，不是完整 JSON-RPC 库。
export function connectNotes() {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./note-server.ts', import.meta.url))], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const pending = new Map<number, Waiting>();
  let nextId = 1;
  let available = true;
  let lateResponses = 0;
  const input = createInterface({ input: child.stdout, crlfDelay: Infinity });

  function take(id: number) {
    const waiting = pending.get(id);
    if (!waiting) return;
    pending.delete(id);
    clearTimeout(waiting.timer);
    waiting.detachAbort();
    return waiting;
  }
  function fail(error: Error) {
    available = false;
    for (const id of pending.keys()) take(id)?.reject(error);
    child.kill();
  }
  child.on('error', fail);
  child.stdin.on('error', fail);
  child.stdout.on('error', fail);
  input.on('error', fail);
  const closed = new Promise<number | null>((resolve) => {
    child.on('close', (code) => {
      available = false;
      for (const id of pending.keys()) take(id)?.reject(new Error('服务进程已退出，调用结果未知'));
      input.close();
      resolve(code);
    });
  });

  input.on('line', (line) => {
    try {
      const message: unknown = JSON.parse(line);
      if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('响应不是对象');
      const response = message as Record<string, unknown>;
      if (response.jsonrpc !== '2.0' || typeof response.id !== 'number'
        || ('result' in response) === ('error' in response)) throw new Error('响应信封无效');
      let error: Error | undefined;
      if ('error' in response) {
        const payload = response.error;
        if (!payload || typeof payload !== 'object' || !('code' in payload) || !('message' in payload)
          || !Number.isInteger(payload.code) || typeof payload.message !== 'string') throw new Error('错误响应无效');
        error = Object.assign(new Error(payload.message), { code: payload.code });
      }
      const waiting = take(response.id);
      if (!waiting) { lateResponses += 1; return; }
      if (error) waiting.reject(error);
      else waiting.resolve(response.result);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });

  function request(method: string, params: object = {}, options: { timeoutMs?: number; signal?: AbortSignal } = {}) {
    const { timeoutMs = 2000, signal } = options;
    if (!available) return Promise.reject(new Error('连接已关闭'));
    if (signal?.aborted) return Promise.reject(new Error('调用已在客户端取消'));
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new Error('timeoutMs 必须大于 0'));
    // 在注册等待项之前序列化，循环引用等错误不会留下悬空 Promise。
    const id = nextId++;
    let line: string;
    try {
      line = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise<unknown>((resolve, reject) => {
      const abort = () => take(id)?.reject(new Error('调用已在客户端取消；服务端可能仍在执行'));
      const timer = setTimeout(() => take(id)?.reject(new Error('等待结果超时；服务端执行情况未知')), timeoutMs);
      pending.set(id, {
        resolve, reject, timer,
        detachAbort: () => signal?.removeEventListener('abort', abort),
      });
      signal?.addEventListener('abort', abort, { once: true });
      // 必须先登记 id；回复可能在下一次事件循环就到达。
      child.stdin.write(line);
    });
  }

  return {
    request,
    notify(method: string, params: object = {}) {
      if (!available) throw new Error('连接已关闭');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    },
    get lateResponses() { return lateResponses; },
    disconnect() {
      available = false;
      child.kill();
    },
    async close() {
      available = false;
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 3000);
      try {
        const code = await closed;
        if (code !== 0) throw new Error(`服务进程退出异常：${code}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
