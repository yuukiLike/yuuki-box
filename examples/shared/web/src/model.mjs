export const VERSION = '0.1.0';

export function validateEvents(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10000) throw new Error('Invalid event fixture');
  return value.map((event) => {
    if (!Number.isSafeInteger(event.id) || !['message', 'tool'].includes(event.kind) || typeof event.text !== 'string' || event.text.length > 20000) throw new Error('Invalid event');
    return event;
  });
}

export function inspectUpdate(value, current = VERSION) {
  const versionParts = (version) => {
    if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Expected x.y.z version');
    const parts = version.split('.').map(Number);
    if (parts.some((part) => !Number.isSafeInteger(part))) throw new Error('Version is too large');
    return parts;
  };
  if (!value || value.schemaVersion !== 1 || typeof value.notes !== 'string' || value.notes.length > 20000) throw new Error('Invalid update manifest');
  let link;
  try { link = new URL(value.url); } catch { throw new Error('Invalid release URL'); }
  if (link.protocol !== 'https:' || link.username || link.password) throw new Error('Release URL must use HTTPS without credentials');
  const remote = versionParts(value.version);
  const local = versionParts(current);
  const difference = remote.map((part, index) => part - local[index]).find((part) => part !== 0) ?? 0;
  return `${difference > 0 ? '发现新版本' : '当前已是最新版本'} · ${value.version}\n${value.notes}\n${value.url}\n只读取本地清单；尚未实现下载、签名校验与安装。`;
}

export function createModel(events, nativeCommand) {
  events = validateEvents(events);
  let timer = null;
  let cursor = 0;
  let nextID = 100000;
  let listeners = new Set();
  let state = { rows: [], query: '', toolOnly: false, running: false, output: '点击「开始事件流」，回放相同的本地事件。', status: '就绪 · 固定事件流，无模型网络请求', update: '当前版本 0.1.0 · 尚未检查更新', speech: '语音未启动 · 默认仅使用设备端识别', speechActive: false, history: 1000 };
  const publish = (changes) => { state = { ...state, ...changes }; for (const listener of listeners) listener(); };
  const loadHistory = (count) => {
    const rows = Array.from({ length: count }, (_, index) => ({ id: index + 1, kind: events[index % events.length].kind, text: `历史 ${index + 1} · ${events[index % events.length].text}` }));
    publish({ rows, history: count, status: `已载入 ${count.toLocaleString()} 条历史事件` });
  };
  loadHistory(1000);
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      if (timer) return;
      cursor = 0;
      publish({ running: true, output: '', status: '事件流运行中 · 每 50 ms 一个事件' });
      timer = setInterval(() => {
        const event = events[cursor++ % events.length];
        const output = (state.output + (state.output ? '\n' : '') + event.text).slice(-16000);
        publish({ rows: [...state.rows, { ...event, id: nextID++ }].slice(-10200), output });
        if (cursor >= 200) this.stop('固定事件流已完成（200 条）');
      }, 50);
    },
    stop(message = '已停止事件流') { if (timer) clearInterval(timer); timer = null; publish({ running: false, status: message }); },
    filter(query) { publish({ query: String(query).slice(0, 500) }); },
    showTools(toolOnly) { publish({ toolOnly }); },
    toggleLoad() { this.stop(); loadHistory(state.history === 1000 ? 10000 : 1000); },
    checkUpdate() { nativeCommand({ type: 'update.check' }); },
    toggleSpeech() {
      if (state.speechActive) nativeCommand({ type: 'speech.stop' });
      else { publish({ speechActive: true, speech: '正在启动语音，请处理系统授权…' }); nativeCommand({ type: 'speech.start', locale: 'zh-CN' }); }
    },
    receive(event) {
      if (!event || typeof event.type !== 'string') return;
      if (event.type === 'update.result') {
        try { publish({ update: inspectUpdate(event.manifest) }); } catch (error) { publish({ update: `更新检查失败：${error.message}` }); }
      }
      if (event.type === 'update.error') publish({ update: `更新检查失败：${event.message}` });
      if (event.type === 'speech.partial' || event.type === 'speech.final') publish({ speech: `${event.type === 'speech.final' ? '识别结果' : '识别中'}：${event.text}` });
      if (event.type === 'speech.state') publish({ speechActive: event.state === 'listening', speech: event.state === 'listening' ? '正在聆听（设备端）…' : state.speech.includes('正在启动') ? '语音已停止' : state.speech });
      if (event.type === 'speech.error') publish({ speechActive: false, speech: `语音不可用 [${event.code}]：${event.message}` });
    },
    dispose() { if (timer) clearInterval(timer); listeners.clear(); }
  };
}

export function visibleRows(state) {
  const query = state.query.trim().toLocaleLowerCase();
  if (!query && !state.toolOnly) return state.rows;
  return state.rows.filter((row) => (!state.toolOnly || row.kind === 'tool') && (!query || row.text.toLocaleLowerCase().includes(query) || row.kind.includes(query)));
}
