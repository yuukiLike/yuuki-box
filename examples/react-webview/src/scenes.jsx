import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { logRows, rawLogs, searchAll, parseBlocks, completedMessages, messageChunks } from './lab-workload.mjs';
import workerSource from '../build/assets/lab-worker-source.mjs';

function Probe() {
  const [value, setValue] = useState('');
  return <label className="lab-probe">输入响应探针（工作期间可继续编辑）<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入文字并观察响应，不参与统计排名" /></label>;
}
function Variant({ value, setValue, disabled = false }) {
  return <label>实现路径<select value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)}><option value="naive">朴素路径</option><option value="optimized">优化路径</option></select></label>;
}

function DOMLogs() {
  const [variant, setVariant] = useState('naive'), [rows, setRows] = useState([]), [top, setTop] = useState(0), [status, setStatus] = useState('idle'), [mounted, setMounted] = useState(0);
  const viewport = useRef(null), timer = useRef(null), running = useRef(false), ticks = useRef(0), nextID = useRef(16001);
  const first = Math.max(0, Math.floor(top / 36) - 5);
  const start = Math.min(first, Math.max(0, rows.length - 25));
  const visible = variant === 'optimized' ? rows.slice(start, start + 30) : rows;
  function stop() { clearInterval(timer.current); timer.current = null; running.current = false; setStatus('cancelled'); }
  function reset() { stop(); setRows([]); setTop(0); setStatus('idle'); ticks.current = 0; if (viewport.current) viewport.current.scrollTop = 0; }
  function run() {
    clearInterval(timer.current); ticks.current = 0; nextID.current = 16001; running.current = true; setStatus('running'); setTop(0); setRows(logRows());
    if (viewport.current) viewport.current.scrollTop = 0;
    timer.current = setInterval(() => {
      const id = nextID.current++;
      ticks.current++;
      setRows((current) => [...current, { id, text: `[tool] append ${id} · completed` }]);
      if (ticks.current === 120) { clearInterval(timer.current); timer.current = null; running.current = false; setStatus('completed'); }
    }, 16);
  }
  useEffect(() => () => clearInterval(timer.current), []);
  useLayoutEffect(() => { setMounted(viewport.current?.querySelectorAll('[data-lab-log]').length || 0); }, [rows, variant, top]);
  return <section className="lab-scene"><h2>W1 · 长日志：全量 DOM / 固定高度窗口</h2><p className="hint">相同 16,000 条历史和 120 次追加。朴素挂载所有日志卡片；优化只挂载视口附近约 30 条。固定 36px 行高，文本和最终记录数相同。</p>
    <Variant value={variant} disabled={running.current} setValue={(value) => { reset(); setVariant(value); }} /><div className="commands"><button disabled={running.current} onClick={run}>运行</button><button disabled={!running.current} onClick={stop}>停止</button><button onClick={reset}>重置</button></div><Probe />
    <p className="lab-metrics">状态 {status} · 数据 {rows.length} 条 · 实际挂载卡片 {mounted} · 已追加 {ticks.current} · 节点数量不是 FPS</p>
    <div className="lab-log-viewport" ref={viewport} onScroll={(event) => setTop(event.currentTarget.scrollTop)}><div style={{ height: rows.length * 36, position: 'relative' }}><div style={variant === 'optimized' ? { position: 'absolute', top: start * 36, left: 0, right: 0 } : undefined}>{visible.map((row) => <div data-lab-log key={row.id} className="lab-log-card">{row.text}</div>)}</div></div></div>
    <p className="hint">首次全量 React/DOM 提交在主线程内无法中途取消；停止会取消后续追加。这就是朴素路径的实际限制。</p>
  </section>;
}

function ParsedBlocks({ blocks }) {
  return blocks.map((block, index) => block.kind === 'heading' ? <h3 key={index}>{block.text}</h3> : block.kind === 'code' ? <pre key={index}>{block.text}</pre> : block.kind === 'item' ? <div key={index}>• {block.text}</div> : <p key={index}>{block.text}</p>);
}
function StreamingParse() {
  const [variant, setVariant] = useState('naive'), [state, setState] = useState({ phase: 'idle', messages: [], calls: 0, chars: 0, parseMs: 0, chunks: 0 });
  const timer = useRef(null), run = useRef(null);
  function parse(text, work) { const begin = performance.now(); const blocks = parseBlocks(text); work.parseMs += performance.now() - begin; work.calls++; work.chars += text.length; return blocks; }
  function present(work, phase) {
    const complete = variant === 'optimized' ? work.cache : completedMessages.map((text) => parse(text, work));
    const active = variant === 'optimized' && phase === 'running' ? [{ kind: 'paragraph', text: work.active }] : parse(work.active, work);
    setState({ phase, messages: [...complete, active], calls: work.calls, chars: work.chars, parseMs: work.parseMs, chunks: work.index });
  }
  function stop() { clearInterval(timer.current); timer.current = null; if (run.current) { present(run.current, 'cancelled'); run.current = null; } }
  function reset() { clearInterval(timer.current); timer.current = null; run.current = null; setState({ phase: 'idle', messages: [], calls: 0, chars: 0, parseMs: 0, chunks: 0 }); }
  function start() {
    reset();
    const work = { active: '', index: 0, calls: 0, chars: 0, parseMs: 0, cache: null };
    run.current = work;
    if (variant === 'optimized') work.cache = completedMessages.map((text) => parse(text, work));
    present(work, 'running');
    timer.current = setInterval(() => {
      work.active += messageChunks[work.index++];
      const complete = work.index === messageChunks.length;
      present(work, complete ? 'completed' : 'running');
      if (complete) { clearInterval(timer.current); timer.current = null; run.current = null; }
    }, 16);
  }
  useEffect(() => () => clearInterval(timer.current), []);
  return <section className="lab-scene"><h2>W2 · 流式消息：整段重解析 / 完成块缓存</h2><p className="hint">100 条已完成 Markdown 消息 + 160 个相同增量。朴素每次重新解析全部消息；优化缓存完成块，活动文本先直接显示，完成/取消时解析一次。最后使用同一个解析器和相同正文。</p>
    <Variant value={variant} disabled={state.phase === 'running'} setValue={(value) => { reset(); setVariant(value); }} /><div className="commands"><button disabled={state.phase === 'running'} onClick={start}>运行</button><button disabled={state.phase !== 'running'} onClick={stop}>停止并保留内容</button><button onClick={reset}>重置</button></div><Probe />
    <p className="lab-metrics">{state.phase} · 增量 {state.chunks}/{messageChunks.length} · 实际 parse 调用 {state.calls} · 累计解析字符 {state.chars.toLocaleString()} · 解析函数累计 {state.parseMs.toFixed(2)} ms（非帧率）</p>
    <div className="lab-transcript">{state.messages.map((blocks, index) => <article key={index}><div className="message-label">{index < completedMessages.length ? `完成消息 ${index + 1}` : '活动消息'}</div><ParsedBlocks blocks={blocks} /></article>)}</div>
    <p className="hint">优化路径流式期间保留纯文本，结束后才得到最终格式；缓存也占内存，消息编辑后必须失效。这里的解析器是小型块解析器，不声称完整 Markdown 支持。</p>
  </section>;
}

function WorkerSearch() {
  const [variant, setVariant] = useState('naive'), [query, setQuery] = useState('approval'), [state, setState] = useState({ phase: 'idle', result: null, jobs: 0, cancelled: 0, ignored: 0, computeMs: 0, elapsedMs: 0 });
  const worker = useRef(null), workerURL = useRef(null), rows = useRef([]), generation = useRef(0), started = useRef(0), mounted = useRef(true), configured = useRef(false);
  const counts = useRef({ jobs: 0, cancelled: 0, ignored: 0 });
  const cancelledGeneration = useRef(null);
  function dispose() { worker.current?.terminate(); worker.current = null; if (workerURL.current) URL.revokeObjectURL(workerURL.current); workerURL.current = null; configured.current = false; }
  useEffect(() => () => { mounted.current = false; dispose(); }, []);
  function setupWorker() {
    if (worker.current) return;
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    workerURL.current = url;
    worker.current = new Worker(url);
    worker.current.onmessage = ({ data }) => {
      if (!mounted.current) return;
      if (data.type === 'ready') { if (workerURL.current) URL.revokeObjectURL(workerURL.current); workerURL.current = null; return; }
      if (data.type === 'cancelled') {
        counts.current.cancelled++;
        setState((current) => ({ ...current, ...counts.current, ...(data.id === cancelledGeneration.current ? { phase: 'cancelled (partial)', result: data.result, computeMs: data.computeMs, elapsedMs: performance.now() - started.current } : {}) }));
        return;
      }
      if (data.type !== 'result') return;
      if (data.id !== generation.current) { counts.current.ignored++; setState((current) => ({ ...current, ...counts.current })); return; }
      setState({ phase: 'completed', result: data.result, ...counts.current, computeMs: data.computeMs, elapsedMs: performance.now() - started.current });
    };
    worker.current.onerror = (event) => { generation.current++; setState((current) => ({ ...current, phase: `worker error: ${event.message}` })); dispose(); };
    worker.current.postMessage({ type: 'init', rows: rows.current });
  }
  function search(value = query) {
    if (!rows.current.length) rows.current = rawLogs();
    configured.current = true;
    cancelledGeneration.current = null;
    const id = ++generation.current;
    counts.current.jobs++;
    started.current = performance.now();
    setState((current) => ({ ...current, phase: 'running', ...counts.current }));
    if (variant === 'naive') {
      const begin = performance.now(), result = searchAll(rows.current, value), computeMs = performance.now() - begin;
      setState({ phase: 'completed', result, ...counts.current, computeMs, elapsedMs: performance.now() - started.current });
    } else {
      try { setupWorker(); worker.current.postMessage({ type: 'search', id, query: value }); }
      catch (error) { setState((current) => ({ ...current, phase: `worker unavailable: ${error.message}` })); dispose(); }
    }
  }
  function stop() { cancelledGeneration.current = generation.current; generation.current++; worker.current?.postMessage({ type: 'cancel' }); setState((current) => ({ ...current, phase: 'cancelled' })); }
  function reset() { generation.current++; cancelledGeneration.current = null; dispose(); rows.current = []; counts.current = { jobs: 0, cancelled: 0, ignored: 0 }; setState({ phase: 'idle', result: null, ...counts.current, computeMs: 0, elapsedMs: 0 }); }
  return <section className="lab-scene"><h2>W3 · 日志搜索：Web 主线程 / 本地 WebWorker</h2><p className="hint">同一份 24,000 条 JSON 日志、同一个解析/过滤函数。运行后修改关键词会再次搜索。Worker 分块处理，在块间响应取消；generation 只接纳最新结果。没有网络或工作区读取。</p>
    <Variant value={variant} setValue={(value) => { reset(); setVariant(value); }} /><label>搜索关键词<input value={query} onChange={(event) => { setQuery(event.target.value); if (configured.current) search(event.target.value); }} /></label><div className="commands"><button onClick={() => search()}>运行 / 再次搜索</button><button disabled={state.phase !== 'running'} onClick={stop}>取消当前 generation</button><button onClick={reset}>重置</button></div><Probe />
    <p className="lab-metrics">{state.phase} · 请求 {state.jobs} · Worker 已取消 {state.cancelled} · 丢弃旧结果 {state.ignored}<br />实际计算 {state.computeMs.toFixed(2)} ms · 端到端返回 {state.elapsedMs.toFixed(2)} ms · 扫描 {state.result?.scanned || 0} · 匹配 {state.result?.count || 0} · 匹配 ID 和 {state.result?.checksum || 0}</p>
    <pre className="lab-search-result">{state.result?.preview.map((row) => row.text).join('\n') || '结果最多展示前 60 条；总数和匹配 ID 和覆盖完整结果。'}</pre><p className="hint">两路径的最终匹配数、ID 和及顺序可对照。主线程同步计算不能中途取消；Worker 多了初始化、数据克隆、调度与协议成本。端到端返回不含屏幕呈现，也不是 FPS。</p>
  </section>;
}

export function WebScenes() {
  const [scene, setScene] = useState('dom');
  return <section><h2>Harness 场景实验 · WKWebView</h2><p className="hint">所有输入都由本地确定性数据生成，不调用模型、麦克风或工作区工具。每项都有不同的真实朴素/优化实现，未预填任何性能结果。</p><select aria-label="选择场景" value={scene} onChange={(event) => setScene(event.target.value)}><option value="dom">W1 · 长日志 DOM</option><option value="parse">W2 · 流式解析与缓存</option><option value="worker">W3 · 主线程与 WebWorker</option></select>{scene === 'dom' ? <DOMLogs /> : scene === 'parse' ? <StreamingParse /> : <WorkerSearch />}</section>;
}
