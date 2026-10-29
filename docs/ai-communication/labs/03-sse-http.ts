import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

// 固定历史便于观察补发；真实应用要按任务保存事件，并校验订阅权限。
const history = [
  { id: 1, event: 'delta', data: { text: '你好' } },
  { id: 2, event: 'delta', data: { text: '，' } },
  { id: 3, event: 'delta', data: { text: 'SSE' } },
  { id: 4, event: 'delta', data: { text: '。' } },
  { id: 5, event: 'completed', data: { ok: true } },
];

const page = String.raw`<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SSE：断流后接着读</title>
<style>
  :root { font-family: system-ui, sans-serif; color: #243d30; background: #f6f8f5; }
  body { max-width: 680px; margin: 48px auto; padding: 0 20px; line-height: 1.7; }
  button { font: inherit; padding: 8px 14px; margin: 4px 4px 4px 0; cursor: pointer; }
  button:disabled { cursor: default; }
  pre { padding: 16px; border: 1px solid #a4b8aa; border-radius: 8px; white-space: pre-wrap; }
  #output { min-height: 52px; font-size: 26px; }
</style>
<h1>SSE：断流后接着读</h1>
<p>服务端依次发送 5 条事件。断流模式会在第 2 条后提前结束响应，观察浏览器如何续接。</p>
<button id="normal">正常接收</button>
<button id="drop">模拟断流重连</button>
<button id="stop" disabled>停止接收</button>
<p id="status" role="status">尚未开始</p>
<pre id="output" aria-label="逐步收到的文字"></pre>
<pre id="log" aria-label="连接与事件记录"></pre>
<p>完成时应得到「你好，SSE。」和事件 1 → 2 → 3 → 4 → 5。停止接收会保留已收到的文字。</p>
<script>
  const output = document.querySelector('#output');
  const status = document.querySelector('#status');
  const log = document.querySelector('#log');
  const stop = document.querySelector('#stop');
  let source;

  function start(mode) {
    source?.close();
    output.textContent = '';
    log.textContent = '';
    status.textContent = '正在连接';
    stop.disabled = false;
    let lastId = 0;
    let connections = 0;
    const current = new EventSource('/events?mode=' + mode);
    source = current;
    const record = (text) => { log.textContent += text + '\n'; };
    current.onopen = () => {
      if (source !== current) return;
      status.textContent = '接收中';
      record('第 ' + (++connections) + ' 次连接已打开');
    };
    current.addEventListener('delta', (event) => {
      if (source !== current) return;
      // 本实验约定 ID 为递增整数；SSE 本身没有这项要求。
      const id = Number(event.lastEventId);
      if (id <= lastId) return;
      output.textContent += JSON.parse(event.data).text;
      lastId = id;
      record('id=' + id + ' delta');
    });
    current.addEventListener('completed', (event) => {
      if (source !== current) return;
      record('id=' + event.lastEventId + ' completed');
      status.textContent = '已完成：收到 completed';
      current.close();
      source = undefined;
      stop.disabled = true;
    });
    current.onerror = () => {
      if (source !== current) return;
      if (current.readyState === EventSource.CONNECTING) {
        status.textContent = '连接中断，等待自动重连；尚未完成';
        record('连接中断，已收到 id=' + lastId);
        return;
      }
      status.textContent = '连接已关闭，未收到完成事件';
      source = undefined;
      stop.disabled = true;
    };
  }
  document.querySelector('#normal').onclick = () => start('normal');
  document.querySelector('#drop').onclick = () => start('drop');
  stop.onclick = () => {
    source?.close();
    source = undefined;
    stop.disabled = true;
    status.textContent = '已停止接收；尚未确认完成';
  };
</script>
</html>`;

async function handle(req: IncomingMessage, res: ServerResponse, intervalMs: number) {
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end('Use GET');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
    return;
  }
  if (url.pathname !== '/events') {
    res.writeHead(404).end('Not found');
    return;
  }
  const mode = url.searchParams.get('mode') ?? 'normal';
  const cursor = req.headers['last-event-id'] ?? '0';
  if (!['normal', 'drop'].includes(mode) || typeof cursor !== 'string' || !/^[0-5]$/.test(cursor)) {
    res.writeHead(400).end('Invalid mode or Last-Event-ID (expected 0..5)');
    return;
  }
  const after = Number(cursor);
  if (after === 5) {
    // 让已读到末尾、却没有主动 close() 的客户端停止重连。
    res.writeHead(204).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 500\n\n: connected\n\n');
  const controller = new AbortController();
  const disconnected = () => controller.abort();
  res.once('close', disconnected);
  try {
    for (const entry of history.filter((entry) => entry.id > after)) {
      await delay(intervalMs, undefined, { signal: controller.signal });
      const frame = `id: ${entry.id}\nevent: ${entry.event}\ndata: ${JSON.stringify(entry.data)}\n\n`;
      if (!res.write(frame)) await once(res, 'drain', { signal: controller.signal });
      // 仅第一次请求截断；重连携带的游标决定从哪里补发。
      if (mode === 'drop' && after === 0 && entry.id === 2) break;
    }
    res.end();
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    res.off('close', disconnected);
  }
}

export function createSseServer({ intervalMs = 500 } = {}) {
  return createServer((req, res) => {
    void handle(req, res, intervalMs).catch((error: Error) => {
      console.error(error);
      res.destroy(error);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createSseServer();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address !== 'string') {
      console.log(`打开 http://127.0.0.1:${address.port}，点击“模拟断流重连”。Ctrl+C 退出。`);
    }
  });
}
