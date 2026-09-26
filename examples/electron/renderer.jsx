import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mountWorkbench } from '../shared/web/src/workbench-view.jsx';
import '../react-webview/src/style.css';
import './style.css';
import { ElectronScenes } from './scenes.jsx';

const ROW_HEIGHT = 54;
const VIEW_HEIGHT = 378;
function Replay() {
  const [source, setSource] = useState([]);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [error, setError] = useState('');
  const [update, setUpdate] = useState(null);
  const [updateChoice, setUpdateChoice] = useState('available');
  const [updateBusy, setUpdateBusy] = useState(false);
  const activeRun = useRef(null);
  const viewport = useRef(null);
  const initialRows = (items, count) => Array.from({ length: count }, (_, index) => ({ ...items[index % items.length], id: `history-${index}` }));
  useEffect(() => {
    let mounted = true;
    window.yuuki.fixture().then(items => { if (mounted) { setSource(items); setRows(initialRows(items, 1000)); } }).catch(error => setError(error.message));
    const detach = window.yuuki.onStream(event => {
      if (activeRun.current !== event.runId) return;
      if (event.done) { activeRun.current = null; setRunning(false); return; }
      setRows(previous => [...previous, event.row].slice(-10200));
    });
    return () => { mounted = false; detach(); activeRun.current = null; window.yuuki.stopStream().catch(() => {}); };
  }, []);
  async function stop() { activeRun.current = null; setRunning(false); await window.yuuki.stopStream(); }
  async function load(count) {
    try { await stop(); setRows(initialRows(source, count)); setScrollTop(0); if (viewport.current) viewport.current.scrollTop = 0; }
    catch (error) { setError(error.message); }
  }
  async function start() {
    setError(''); setStarting(true);
    try { activeRun.current = await window.yuuki.startStream(); setRunning(true); }
    catch (error) { setError(error.message); }
    finally { setStarting(false); }
  }
  async function checkUpdate() {
    setError(''); setUpdateBusy(true); setUpdate(null);
    try { setUpdate(await window.yuuki.checkUpdate(updateChoice)); }
    catch (error) { setError(`更新检查：${error.message}`); }
    finally { setUpdateBusy(false); }
  }
  const visible = useMemo(() => filter === 'all' ? rows : rows.filter(row => row.kind === 'tool'), [rows, filter]);
  const startIndex = Math.max(0, Math.min(Math.floor(scrollTop / ROW_HEIGHT) - 3, visible.length - 1));
  const subset = visible.slice(startIndex, startIndex + Math.ceil(VIEW_HEIGHT / ROW_HEIGHT) + 7);
  return <section className="electron-replay">
    <h2>本地事件回放 · Electron 主进程 timer → IPC → React</h2>
    <div className="commands"><button disabled={!source.length || starting} onClick={() => load(1000)}>1,000 条</button><button disabled={!source.length || starting} onClick={() => load(10000)}>10,000 条</button><button onClick={() => { setFilter(filter === 'all' ? 'tool' : 'all'); setScrollTop(0); if (viewport.current) viewport.current.scrollTop = 0; }}>{filter === 'all' ? '全部事件' : '仅工具'}</button><button disabled={!source.length || starting} onClick={() => (running ? stop() : start()).catch(error => setError(error.message))}>{starting ? '启动中' : running ? '停止输出' : '开始输出'}</button></div>
    <div className="status">{visible.length.toLocaleString()} / {rows.length.toLocaleString()} 条 · DOM {subset.length} 行</div>
    <div className="viewport" ref={viewport} onScroll={event => setScrollTop(event.currentTarget.scrollTop)} role="list" aria-label="任务事件"><div style={{ height: visible.length * ROW_HEIGHT, position: 'relative' }}>{subset.map((row, index) => <div className="replay-row" role="listitem" key={row.id} style={{ top: (startIndex + index) * ROW_HEIGHT, height: ROW_HEIGHT }}><span className="kind">{row.kind === 'tool' ? 'TOOL' : 'TEXT'}</span><span className="row-text">{row.text}</span></div>)}</div></div>
    <h2>本地更新检查 · 当前 0.1.0</h2><div className="commands"><select aria-label="更新案例" value={updateChoice} onChange={event => setUpdateChoice(event.target.value)}><option value="available">发现新版本</option><option value="current">已是最新</option><option value="invalid">无效清单</option></select><button disabled={updateBusy} onClick={checkUpdate}>{updateBusy ? '检查中' : '检查更新'}</button></div>{update && <p className="hint">{update.available ? `发现 ${update.version}` : '没有更高版本'} · {update.notes}</p>}
    {error && <p role="alert">{error}</p>}<p className="hint">每 50 ms 一条，最多 200 条；历史上限 10,200。更新只读取清单，不下载或安装。</p>
  </section>;
}

let receive;
mountWorkbench({
  title: 'Electron + React',
  subtitle: 'Chromium / ReactDOM · preload IPC · 独立 Swift Agent runtime',
  Replay,
  Scenes: ElectronScenes,
  subscribe(callback) {
    receive = callback;
    window.yuuki.onAgent(event => receive({ type: 'agent.event', event }));
    window.yuuki.onSpeech(event => receive(event));
  },
  async send(command) {
    try {
      switch (command.type) {
        case 'ready': receive({ type: 'bootstrap', events: await window.yuuki.fixture() }); await window.yuuki.bootstrapAgent(); break;
        case 'agent.command': await window.yuuki.agentCommand(command.command); break;
        case 'speech.start': await window.yuuki.startSpeech(command.file ? { file: command.file } : {}); break;
        case 'speech.stop': await window.yuuki.stopSpeech(); break;
        case 'speech.cancel': await window.yuuki.cancelSpeech(); break;
        default: throw new Error('不支持的界面操作。');
      }
    } catch (error) {
      if (command.type.startsWith('speech.')) { receive({ type: 'speech.error', code: 'host', message: error.message }); receive({ type: 'speech.closed' }); }
      else receive({ type: 'agent.event', event: { type: 'error', message: error.message } });
    }
  }
});
