import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createModel, visibleRows } from './model.mjs';
import { createAgentModel } from './agent-model.mjs';

let root, model, agent, send, title, subtitle, CustomReplay;
function receive(message) {
  agent.receive(message);
  if (message.type === 'bootstrap' && !model) {
    try { model = createModel(message.events, send); root.render(<App />); }
    catch (error) { root.render(<p role="alert">无法加载事件：{error.message}</p>); }
  } else if (message.type === 'bootstrap.error') root.render(<p role="alert">{message.message}</p>);
  else model?.receive(message);
};

function VirtualList({ rows }) {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 36;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 6);
  const safeStart = Math.min(start, Math.max(0, rows.length - 25));
  const subset = rows.slice(safeStart, safeStart + 35);
  return <div className="list" role="list" aria-label="任务与事件历史" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <div style={{ height: rows.length * rowHeight, position: 'relative' }}><div style={{ position: 'absolute', left: 0, right: 0, top: safeStart * rowHeight }}>
      {subset.map((row) => <div role="listitem" className="entry" key={row.id}><span className="kind">{row.kind === 'tool' ? 'TOOL' : 'TEXT'}</span><span>{row.text}</span></div>)}
    </div></div>
  </div>;
}
function Replay() {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const rows = useMemo(() => visibleRows(state), [state.rows, state.query, state.toolOnly]);
  return <section>
    <h2>本地性能负载 · 不调用模型</h2>
    <div className="commands">
      <button disabled={state.running} onClick={() => model.start()}>开始事件流</button>
      <button disabled={!state.running} onClick={() => model.stop()}>停止</button>
      <button onClick={() => model.toggleLoad()}>{state.history === 1000 ? '切换到 10,000 条' : '切换到 1,000 条'}</button>
      <button onClick={() => model.checkUpdate()}>检查更新</button>
    </div>
    <input aria-label="筛选任务" placeholder="筛选任务 / 日志内容" value={state.query} onChange={(event) => model.filter(event.target.value)} />
    <div className="commands filters"><button disabled={!state.toolOnly} onClick={() => model.showTools(false)}>全部</button><button disabled={state.toolOnly} onClick={() => model.showTools(true)}>仅工具</button></div>
    <div className="status" role="status">{state.status} · {rows.length.toLocaleString()} / {state.rows.length.toLocaleString()} 条 · 固定行高虚拟列表</div>
    <VirtualList rows={rows} /><h2>流式输出</h2><pre>{state.output.slice(-1600)}</pre>
    <h2>软件更新</h2><p className="preserve">{state.update}</p>
  </section>;
}
function Settings({ work }) {
  const password = useRef(null);
  const disabled = !work.runtime || work.runtime.busy;
  const fields = [ ['apiBase', 'API Base URL'], ['model', '模型'], ['maxOutputTokens', '最大输出 token'], ['maxRounds', '最大工具轮数'], ['workspace', '工作目录（绝对路径）'], ['whisperCLI', 'whisper-cli 绝对路径'], ['whisperModel', 'Whisper 模型绝对路径'] ];
  function save(event) {
    event.preventDefault();
    const input = password.current;
    // Uncontrolled password DOM only: never put this value in React state,
    // localStorage, console logs, or session data. Clear immediately after send.
    try { agent.saveSettings(input?.value || ''); }
    finally { if (input) input.value = ''; }
  }
  return <form className="settings" onSubmit={save} autoComplete="off">
    <p className="hint">凭据由本地 runtime 保存到 macOS Keychain；提交后清空此输入框。{work.runtime?.hasAPIKey ? '目前已配置凭据。' : '目前尚未配置凭据。'}</p>
    <label>API Key（留空保持现有值）<input ref={password} type="password" autoComplete="new-password" disabled={disabled} placeholder="仅提交一次，不进入 React 状态或存储" /></label>
    {fields.map(([key, label]) => <label key={key}>{label}<input value={work.settings[key] ?? ''} disabled={disabled} onChange={(event) => agent.setSetting(key, event.target.value)} inputMode={key === 'maxRounds' || key === 'maxOutputTokens' ? 'numeric' : undefined} /></label>)}
    <label>语音后端<select value={work.settings.speechBackend} disabled={disabled} onChange={(event) => agent.setSetting('speechBackend', event.target.value)}><option value="apple">Apple Speech · 设备端</option><option value="whisper">Whisper · 本地 CLI</option></select></label>
    <p className="hint">Whisper 使用你已有的 CLI 和模型，不自动下载。填写可信 API 服务地址；保存后配置作用于后续任务和语音。</p>
    <div className="commands"><button className="primary" type="submit" disabled={disabled}>保存设置</button><button type="button" disabled={disabled} onClick={() => agent.clearKey()}>清除 Keychain 凭据</button></div>
  </form>;
}
function Workbench({ work }) {
  const chat = useRef(null);
  const follow = useRef(true);
  const runtime = work.runtime;
  const session = runtime?.session;
  const busy = Boolean(runtime?.busy || work.submitting);
  const approval = session?.pendingApproval;
  useEffect(() => { follow.current = true; }, [session?.id]);
  useEffect(() => { if (chat.current && follow.current) chat.current.scrollTop = chat.current.scrollHeight; }, [session?.id, session?.messages?.length, session?.messages?.at(-1)?.content?.length]);
  return <section>
    <div className="session-bar"><select aria-label="选择会话" disabled={!runtime || busy} value={session?.id || ''} onChange={(event) => agent.selectSession(event.target.value)}>{(runtime?.sessions || []).map((item) => <option value={item.id} key={item.id}>{item.title} · {item.status}</option>)}</select><button disabled={!runtime || busy} onClick={() => agent.newSession()}>新建会话</button><button disabled={!runtime || busy} onClick={() => agent.exportSession()}>导出 Markdown</button></div>
    <div className="status">状态：{session?.status || '未连接'} · token {session?.usage?.totalTokens || 0} · 请求 {session?.usage?.requests || 0} · {runtime?.hasAPIKey ? '已配置凭据' : '请先在设置中配置 API Key'}</div>
    <div className="chat" ref={chat} aria-label="对话与工具结果" onScroll={(event) => { const view = event.currentTarget; follow.current = view.scrollHeight - view.scrollTop - view.clientHeight < 60; }}>
      {!session?.messages?.length && <p className="hint">输入任务开始。模型回复、工具调用与结果会显示在这里。</p>}
      {session?.messages?.map((message) => <article key={message.id} className={`message ${message.role}`}><div className="message-label">{message.role}{message.name ? ` · ${message.name}` : ''} · {message.status}</div><div className="message-content">{message.content || (message.status === 'streaming' ? '等待输出…' : '')}</div></article>)}
    </div>
    {approval && <aside className="approval"><h2>请求授权：{approval.tool}</h2><p>{approval.path}</p><pre>{approval.preview}</pre><div className="commands"><button onClick={() => agent.approve(true)}>允许此操作</button><button onClick={() => agent.approve(false)}>拒绝</button></div></aside>}
    <label className="draft-label">任务草稿<textarea rows={4} placeholder="给 Agent 一项明确任务…" value={work.draft} disabled={busy} onChange={(event) => agent.setDraft(event.target.value)} /></label>
    <div className="commands"><button className="primary" disabled={!runtime || busy || !work.draft.trim()} onClick={() => agent.start()}>发送任务</button><button disabled={!busy} onClick={() => agent.cancel()}>取消任务</button></div>
    <div className="voice"><h2>语音 · {runtime?.settings?.speechBackend || 'apple'}</h2><input aria-label="音频文件路径" placeholder="可选音频文件绝对路径；留空使用麦克风" value={work.audioFile} disabled={work.speechActive} onChange={(event) => agent.setAudioFile(event.target.value)} /><div className="commands"><button disabled={work.speechActive} onClick={() => agent.startSpeech()}>开始语音 / 识别文件</button><button disabled={!work.speechActive} onClick={() => agent.stopSpeech()}>停止录音并转写</button><button disabled={!work.speechActive} onClick={() => agent.cancelSpeech()}>取消识别</button><button disabled={!work.transcript || busy} onClick={() => agent.useTranscript()}>用作任务草稿</button></div><p className="hint" role="status">{work.speechStatus}</p><pre>{work.transcript || '识别结果将显示在这里，不会自动发送给模型。'}</pre></div>
    {work.exportPath && <p className="hint preserve">导出文件：{work.exportPath}</p>}
  </section>;
}
function App() {
  const work = useSyncExternalStore(agent.subscribe, agent.getSnapshot);
  return <main>
    <header><div className="eyebrow">APPLE AGENT WORKBENCH</div><h1>{title}</h1><p>{subtitle}</p></header>
    <nav className="commands" aria-label="工作台模式">{[['agent', 'Agent 工作台'], ['settings', '设置'], ['replay', '回放与更新']].map(([id, title]) => <button key={id} className={work.mode === id ? 'primary' : ''} disabled={work.mode === id} onClick={() => agent.setMode(id)}>{title}</button>)}</nav>
    <div className="notice" role="status">{work.notice}</div>
    {work.mode === 'agent' ? <Workbench work={work} /> : work.mode === 'settings' ? <Settings work={work} /> : CustomReplay ? <CustomReplay /> : <Replay />}
  </main>;
}
export function mountWorkbench(transport) {
  send = transport.send;
  title = transport.title;
  subtitle = transport.subtitle;
  CustomReplay = transport.Replay || null;
  root = createRoot(document.getElementById('root'));
  agent = createAgentModel(send);
  transport.subscribe(receive);
  root.render(<p>正在连接原生宿主…</p>);
  send({ type: 'ready' });
}
