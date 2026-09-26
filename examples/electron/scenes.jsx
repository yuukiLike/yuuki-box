import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './scenes.css';
import { fingerprintSeed, fingerprintRecord } from './scene-fingerprint.cjs';

const number = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const descriptions = {
  ipc: {
    title: 'E1 · 多工具并行事件 / IPC 边界',
    bad: '每条工具进度单独跨进程，renderer 每条发布状态。同样的数据会反复触发序列化、IPC 回调和 React 更新。',
    good: '200 条组成一批再跨进程，合并一次发布。两边都保留所有逻辑事件，使用相同的 200 条确认窗口；不会丢终态来换速度。',
    observe: '开始后在探针中打字。比较真实 IPC 数据消息数、JSON 字节、接收计数和指纹；小数据量可能看不出体感差异。',
    cost: '批量协议要维护确认窗口、终态、取消与过期 runId。此例保留最终计数和最近 20 条展示；生产 Harness 还要把完整事件写入存储。',
  },
  cpu: {
    title: 'E2 · 大型工具产物 / 主进程与 Worker',
    bad: 'Electron main 同步构造、解析并索引工具产物。renderer 的文本框可能仍能打字，但发送到 main 的 ping、取消和其他控制请求会排队。',
    good: '完全相同的索引函数交给 Node worker_threads。main 继续响应控制 IPC，取消时终止独立 Worker。小任务可能因 Worker 启动而更慢。',
    observe: '运行时观察 150 ms 控制探针的最大 RTT，并尝试取消。朴素路径可能计算完才收到取消；界面会明确报告。',
    cost: '新增 Worker 入口、消息错误、退出和终止生命周期；数据传输也有成本。本例 Worker 自己生成输入，只回传摘要，不能代表巨大结果跨线程复制的成本。',
  },
  dom: {
    title: 'E3 · 长工具卡片时间线 / Chromium DOM',
    bad: '为整个历史创建完整 React 卡片和 DOM，滚动更新时重新协调整棵卡片树。长任务的 DOM、样式和布局工作随历史增长。',
    good: '固定 112 px 行高，只挂载视口与缓冲区，并 memo 稳定卡片；逻辑历史和过滤结果完全相同。',
    observe: '加载后滚动、筛选错误、输入探针。比较实际挂载卡片/DOM 节点数与首次提交耗时。此处提交耗时不含 GPU 绘制。',
    cost: '固定行高会截断长输出；跨未挂载行的系统文本选择和查找受限。真实 Markdown、展开卡片和可访问性需要更成熟的虚拟列表策略。',
  },
};

function Comparison({ results }) {
  if (!results.naive && !results.optimized) return <p className="scene-note">尚无本次运行记录。先用相同规模分别运行两种实现；这里只比较当前机器上的结果。</p>;
  return <table className="scene-comparison"><thead><tr><th>实现</th><th>规模</th><th>实际结果</th></tr></thead><tbody>{['naive', 'optimized'].map(mode => <tr key={mode}><td>{mode === 'naive' ? '朴素' : '优化'}</td><td>{results[mode] ? number(results[mode].count) : '待运行'}</td><td>{results[mode]?.summary || '—'}</td></tr>)}</tbody></table>;
}

function RemoteScene({ scene, mode, onResult }) {
  const presets = scene === 'ipc' ? [2000, 10000, 30000] : [20000, 80000, 200000];
  const [count, setCount] = useState(presets[0]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('未开始');
  const [progress, setProgress] = useState({ received: 0, checksum: 0, callbacks: 0, publications: 0, rows: [] });
  const [result, setResult] = useState(null);
  const [ping, setPing] = useState({ samples: 0, last: 0, max: 0, waiting: false });
  const active = useRef(null);
  const running = useRef(false);
  const totals = useRef(null);
  const report = useRef(onResult);
  report.current = onResult;
  const pingTotals = useRef({ samples: 0, last: 0, max: 0 });

  useEffect(() => {
    const detach = window.yuuki.onScene(event => {
      if (event.runId !== active.current?.runId) return;
      if (event.type === 'records') {
        const state = totals.current;
        state.callbacks++;
        state.received += event.records.length;
        for (const row of event.records) state.checksum = fingerprintRecord(state.checksum, row);
        state.rows = [...state.rows, ...event.records].slice(-20);
        state.publications++;
        setProgress({ ...state });
        if (event.checkpoint) window.yuuki.acknowledgeScene({ runId: event.runId, checkpoint: event.checkpoint }).catch(error => { setStatus(error.message); running.current = false; setBusy(false); void window.yuuki.stopScene(event.runId); });
        return;
      }
      running.current = false;
      setBusy(false);
      if (event.type === 'result') {
        const config = active.current;
        const matched = scene !== 'ipc' || (event.result.count === totals.current.received && event.result.checksum === totals.current.checksum);
        setResult({ ...event.result, elapsedMs: event.elapsedMs, matched });
        setStatus(matched ? '完成；可用同一规模切换另一实现对照' : '结果不一致：不可用于比较');
        report.current(config.mode, { count: config.count, summary: scene === 'ipc'
          ? `${number(event.result.messages)} 条 IPC · ${number(event.result.payloadBytes)} JSON bytes · ${number(event.elapsedMs)} ms · 指纹 ${event.result.checksum}${matched ? ' / 接收一致' : ' / 不一致'}`
          : `${number(event.result.computeMs)} ms 计算 / ${number(event.elapsedMs)} ms 主进程计时（含调度/Worker 启动） · 指纹 ${event.result.checksum}` });
      } else if (event.type === 'cancelled') setStatus(`已取消；已发送 ${number(event.received)} 条工具事件（CPU 场景无中途索引计数）`);
      else setStatus(`错误：${event.message}`);
    });
    return () => { detach(); running.current = false; const id = active.current?.runId; active.current = null; if (id) void window.yuuki.stopScene(id).catch(() => {}); };
  }, [scene]);

  async function probe() {
    const id = active.current?.runId;
    if (!id || !running.current || pingTotals.current.pending) return;
    pingTotals.current.pending = true;
    const started = performance.now();
    setPing(previous => ({ ...previous, waiting: true }));
    try {
      await window.yuuki.pingScene();
      if (active.current?.runId !== id) return;
      const rtt = performance.now() - started;
      const prior = pingTotals.current;
      pingTotals.current = { samples: prior.samples + 1, last: rtt, max: Math.max(prior.max, rtt), pending: false };
      setPing({ ...pingTotals.current, waiting: false });
    } catch (error) { if (active.current?.runId === id) { setStatus(`探针失败：${error.message}`); setPing(previous => ({ ...previous, waiting: false })); } }
    finally { if (active.current?.runId === id) pingTotals.current.pending = false; }
  }

  useEffect(() => {
    if (!busy) return;
    // One outstanding request: the probe cannot itself flood a blocked main.
    const timer = setInterval(probe, 150);
    return () => clearInterval(timer);
  }, [busy]);

  async function start() {
    const runId = crypto.randomUUID();
    active.current = { runId, mode, count };
    running.current = true;
    totals.current = { received: 0, checksum: fingerprintSeed, callbacks: 0, publications: 0, rows: [] };
    pingTotals.current = { samples: 0, last: 0, max: 0, pending: false };
    setProgress({ ...totals.current }); setResult(null); setPing({ samples: 0, last: 0, max: 0, waiting: false });
    setBusy(true); setStatus('运行中；可输入探针或发送取消');
    try { await window.yuuki.startScene({ scene, mode, count, runId }); }
    catch (error) { if (active.current?.runId === runId) { running.current = false; setBusy(false); setStatus(error.message); } }
  }

  async function stop() {
    const id = active.current?.runId;
    if (!id) return;
    setStatus('取消请求已发送，等待 main 响应…');
    try {
      const reply = await window.yuuki.stopScene(id);
      if (active.current?.runId !== id) return;
      if (!reply.stopped) setStatus('main 收到取消时任务已经结束；这次取消未能中断工作。');
    } catch (error) { setStatus(error.message); }
  }

  async function reset() {
    const id = active.current?.runId;
    active.current = null; running.current = false;
    if (id) await window.yuuki.stopScene(id).catch(() => {});
    setBusy(false); setResult(null); setProgress({ received: 0, checksum: 0, callbacks: 0, publications: 0, rows: [] }); setPing({ samples: 0, last: 0, max: 0, waiting: false }); setStatus('已清空本次显示；下方对照记录保留');
  }

  return <>
    <div className="scene-controls"><label>规模 <select disabled={busy} value={count} onChange={event => setCount(Number(event.target.value))}>{presets.map(n => <option key={n} value={n}>{number(n)} {scene === 'ipc' ? '个事件' : '条产物记录'}</option>)}</select></label><button disabled={busy} onClick={start}>运行当前实现</button><button disabled={!busy} onClick={stop}>取消</button><button disabled={busy} onClick={reset}>清空显示</button><button disabled={!busy} onClick={probe}>控制 IPC 探针</button></div>
    <p role="status">{status}</p>
    <div className="scene-metrics"><span>IPC 探针 {ping.waiting ? '等待 main…' : `${number(ping.last)} ms`}</span><span>最大 RTT {number(ping.max)} ms</span><span>完成样本 {ping.samples}</span></div>
    <p className="scene-note">RTT 包含两端事件循环、传输与回调等待；不是纯 IPC 延迟。任务短于采样周期时可为 0 个样本。场景切换会取消旧任务；已排队的旧 runId 事件会被忽略。</p>
    {scene === 'ipc' && <><div className="scene-metrics"><span>收到 {number(progress.received)} / {number(count)}</span><span>数据回调 {number(progress.callbacks)}</span><span>状态发布 {number(progress.publications)}（非 React commit 数）</span><span>接收指纹 {progress.checksum}</span></div><pre className="scene-output">{progress.rows.map(row => `${row.id} ${row.tool} ${row.status} ${row.text}`).join('\n') || '最近 20 条工具事件将在此显示'}</pre></>}
    {result && <div className="scene-result"><strong>{scene === 'ipc' ? (result.matched ? '发送与接收计数、指纹一致' : '结果不一致') : `索引完成：${number(result.count)} 条 · ${number(result.terms)} 个去重词项`}</strong><p>主进程计时 {number(result.elapsedMs)} ms · 指纹 {result.checksum}</p>{scene === 'ipc' ? <p>{number(result.messages)} 条数据 IPC · {number(result.payloadBytes)} JSON bytes。确认控制 IPC 每 200 条一次，不计入数据消息指标。</p> : <><p>计算 {number(result.computeMs)} ms · 产物 UTF-8 {number(result.sourceBytes)} bytes；Worker 启动计入总耗时。</p><pre>{result.top.map(row => `${row.score} ${row.path}`).join('\n')}</pre></>}</div>}
  </>;
}

const HEIGHT = 112, VIEW = 448, BUFFER = 4;
function Card({ row }) {
  return <article data-tool-card className="scene-card"><header><strong>{row.tool}</strong><span>#{row.id} · {row.status}</span><span>session {row.id % 31}</span></header><p>{row.text}</p><code>{row.path}</code><footer><span>输入已校验</span><span>证据保留</span><span>approval: local fixture</span></footer></article>;
}
const CachedCard = memo(Card);
function Timeline({ mode, onResult }) {
  const [count, setCount] = useState(1000);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [scroll, setScroll] = useState(0);
  const [metrics, setMetrics] = useState({ mounted: 0, nodes: 0, ms: null });
  const viewport = useRef(null);
  const start = useRef(null);
  const filtered = useMemo(() => filter === 'all' ? rows : rows.filter(row => row.status === 'error'), [rows, filter]);
  const first = Math.max(0, Math.min(filtered.length - 1, Math.floor(scroll / HEIGHT) - BUFFER));
  const subset = mode === 'optimized' ? filtered.slice(first, first + Math.ceil(VIEW / HEIGHT) + BUFFER * 2) : filtered;
  const fingerprint = useMemo(() => filtered.reduce(fingerprintRecord, fingerprintSeed), [filtered]);

  useLayoutEffect(() => {
    const mounted = viewport.current.querySelectorAll('[data-tool-card]').length;
    const nodes = viewport.current.querySelectorAll('*').length;
    const elapsed = start.current === null ? null : performance.now() - start.current;
    setMetrics(previous => ({ mounted, nodes, ms: elapsed ?? previous.ms }));
    if (elapsed !== null && rows.length) onResult(mode, { count: rows.length, summary: `${number(mounted)} 挂载卡片 / ${number(nodes)} DOM 节点 · 首次提交 ${number(elapsed)} ms · 全历史指纹 ${rows.reduce(fingerprintRecord, fingerprintSeed)}` });
    start.current = null;
  }, [rows, filter, mode, first]);

  function load() {
    start.current = performance.now();
    setFilter('all'); setScroll(0); viewport.current.scrollTop = 0;
    setRows(Array.from({ length: count }, (_, id) => ({ id, tool: ['read_file', 'search', 'build', 'write_note'][id % 4], status: id % 17 === 0 ? 'error' : 'complete', text: `工具输出 ${id}：读取工作区、收集错误与证据，提交给下一轮 Agent。固定内容用于比较等价历史。`, path: `workspace/project-${id % 64}/src/module-${id}.ts` })));
  }

  return <>
    <div className="scene-controls"><label>规模 <select value={count} onChange={event => setCount(Number(event.target.value))}>{[1000, 3000, 6000].map(n => <option key={n} value={n}>{number(n)} 张卡片</option>)}</select></label><button onClick={load}>加载当前实现</button><button onClick={() => { setRows([]); setScroll(0); start.current = null; setMetrics({ mounted: 0, nodes: 0, ms: null }); }}>清空场景</button><label>过滤 <select value={filter} onChange={event => { setFilter(event.target.value); setScroll(0); viewport.current.scrollTop = 0; }}><option value="all">全部</option><option value="error">仅错误</option></select></label></div>
    <div className="scene-metrics"><span>逻辑卡片 {number(filtered.length)}</span><span>实际挂载 {number(metrics.mounted)}</span><span>视口后代 DOM {number(metrics.nodes)}</span><span>过滤后指纹 {fingerprint}</span><span>首次提交 {metrics.ms === null ? '未运行' : `${number(metrics.ms)} ms`}</span></div>
    <div className="scene-timeline" ref={viewport} onScroll={event => setScroll(event.currentTarget.scrollTop)} aria-label="工具卡片历史" tabIndex={0}>
      {mode === 'optimized' ? <div style={{ height: filtered.length * HEIGHT, position: 'relative' }}>{subset.map((row, i) => <div key={row.id} style={{ position: 'absolute', top: (first + i) * HEIGHT, left: 0, right: 0, height: HEIGHT }}><CachedCard row={row}/></div>)}</div> : subset.map(row => <Card key={row.id} row={row}/>)}
    </div>
    <p className="scene-note">首次提交从点击开始，包含确定性数据生成与 React DOM 提交，不含后续浏览器绘制。同步全量提交期间无法中途取消；完成后可清空。两种模式都限制为最多 6,000 张，不会自动增加负载。</p>
  </>;
}

export function ElectronScenes() {
  const [scene, setScene] = useState('ipc');
  const [mode, setMode] = useState('naive');
  const [probeText, setProbeText] = useState('');
  const [results, setResults] = useState({});
  const description = descriptions[scene];
  function record(lane, result) { setResults(previous => ({ ...previous, [scene]: { ...previous[scene], [lane]: result } })); }
  return <section className="electron-scenes">
    <h2>Electron · 场景实验</h2><p>每个对照使用同样的输入与有界工作量。“朴素”是可定位的实现选择；实验不等于 Electron 与其他框架的性能排名。</p>
    <div className="scene-controls"><label>场景 <select value={scene} onChange={event => setScene(event.target.value)}><option value="ipc">E1 多工具 IPC</option><option value="cpu">E2 工具产物索引</option><option value="dom">E3 长卡片时间线</option></select></label><label>实现 <select value={mode} onChange={event => setMode(event.target.value)}><option value="naive">朴素 / terrible 路径</option><option value="optimized">优化路径</option></select></label></div>
    <h3>{description.title}</h3><div className="scene-explanation"><p><b>朴素：</b>{description.bad}</p><p><b>优化：</b>{description.good}</p><p><b>如何感受：</b>{description.observe}</p><p><b>维护代价：</b>{description.cost}</p></div>
    <label className="scene-probe">交互探针 · 负载中持续打字、选字或使用中文输入法<input value={probeText} onChange={event => setProbeText(event.target.value)} placeholder="例如：工具还在运行，我能否顺畅修正下一条指令？"/></label>
    {scene === 'dom' ? <Timeline key={`${scene}-${mode}`} mode={mode} onResult={record}/> : <RemoteScene key={`${scene}-${mode}`} scene={scene} mode={mode} onResult={record}/>}
    <Comparison results={results[scene] || {}}/>
    <p className="scene-note">两行规模不同时不能直接比较。E1/E3 指纹覆盖按序排列的完整记录，32 位非密码学滚动计算仍可能碰撞，不是等价证明。计数与耗时在你点击运行后采集；本工程未预填实测分数，也不将这些值称为 FPS。实验不调用模型、不访问你的工作区文件。</p>
  </section>;
}
