export const defaultSettings = { apiBase: 'https://api.deepseek.com', model: 'deepseek-flash', maxOutputTokens: 2048, maxRounds: 4, workspace: '', speechBackend: 'apple', whisperCLI: '', whisperModel: '' };

// API keys never enter this model. Native controls retain their masked value in
// Swift; WebView submits an uncontrolled password field once and clears it.
export function createAgentModel(send) {
  let listeners = new Set();
  let settingsDirty = false;
  let pendingTask = null;
  let state = { mode: 'agent', draft: '', submitting: false, runtime: null, settings: { ...defaultSettings }, notice: '正在连接本地 Agent runtime…', speechActive: false, speechStatus: '语音未启动', transcript: '', audioFile: '', exportPath: '' };
  const publish = (patch) => { state = { ...state, ...patch }; for (const listener of listeners) listener(); };
  const command = (value) => send({ type: 'agent.command', command: value });
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setMode(mode) { if (['agent', 'settings', 'replay'].includes(mode)) publish({ mode }); },
    setDraft(draft) { publish({ draft: String(draft).slice(0, 32000) }); },
    setAudioFile(audioFile) { publish({ audioFile: String(audioFile).slice(0, 4096) }); },
    setSetting(key, value) { if (!Object.hasOwn(defaultSettings, key)) return; settingsDirty = true; publish({ settings: { ...state.settings, [key]: value } }); },
    saveSettings(apiKey) {
      const settings = { ...state.settings, maxOutputTokens: Number(state.settings.maxOutputTokens), maxRounds: Number(state.settings.maxRounds) };
      if (![settings.maxOutputTokens, settings.maxRounds].every((value) => Number.isInteger(value) && value > 0)) { publish({ notice: '输出 token 和最大轮数必须是正整数。' }); return; }
      command({ op: 'settings.save', settings, ...(typeof apiKey === 'string' ? { apiKey } : {}) });
      settingsDirty = false;
      publish({ notice: '已提交设置，等待 runtime 确认…' });
    },
    clearKey() { command({ op: 'settings.save', clearAPIKey: true }); },
    newSession() { command({ op: 'session.new' }); },
    selectSession(sessionId) { command({ op: 'session.select', sessionId }); },
    start() { if (!state.draft.trim() || state.runtime?.busy || state.submitting) return; pendingTask = state.draft; command({ op: 'run.start', text: state.draft }); publish({ submitting: true, notice: '任务已提交，等待 runtime 接受…' }); },
    cancel() { command({ op: 'run.cancel' }); },
    approve(allow) { const approval = state.runtime?.session?.pendingApproval; if (approval?.id) command({ op: 'approval.respond', approvalId: approval.id, allow }); },
    exportSession() { command({ op: 'session.export' }); },
    startSpeech() { if (state.speechActive) return; publish({ speechActive: true, transcript: '', speechStatus: '正在启动语音…' }); send({ type: 'speech.start', locale: 'zh-CN', ...(state.audioFile.trim() ? { file: state.audioFile.trim() } : {}) }); },
    stopSpeech() { publish({ speechStatus: '正在停止录音；Whisper 将继续转写，请等待…' }); send({ type: 'speech.stop' }); },
    cancelSpeech() { send({ type: 'speech.cancel' }); publish({ speechStatus: '正在取消识别…' }); },
    useTranscript() { if (state.transcript) publish({ draft: state.transcript, mode: 'agent', notice: '识别文字已放入草稿，请检查后发送。' }); },
    receive(event) {
      if (!event || typeof event.type !== 'string') return;
      if (event.type === 'agent.event') {
        const value = event.event;
        if (value.type === 'state' && value.state) {
          const accepted = value.state.busy && pendingTask !== null;
          const draft = accepted && state.draft === pendingTask ? '' : state.draft;
          if (accepted) pendingTask = null;
          publish({ runtime: value.state, submitting: false, draft, notice: value.state.notice || '就绪', ...(!settingsDirty ? { settings: { ...defaultSettings, ...value.state.settings } } : {}) });
        } else if (value.type === 'delta' && state.runtime?.session?.id === value.sessionId) {
          const session = state.runtime.session;
          publish({ runtime: { ...state.runtime, session: { ...session, messages: session.messages.map((message) => message.id === value.messageId ? { ...message, content: message.content + value.text } : message) } } });
        } else if (value.type === 'error') { pendingTask = null; publish({ submitting: false, notice: `错误：${value.message}` }); }
        else if (value.type === 'export') publish({ exportPath: value.path, notice: `已导出：${value.path}` });
      } else if (event.type === 'speech.partial' || event.type === 'speech.final') publish({ transcript: event.text || '', speechStatus: event.type === 'speech.final' ? '转写结果已收到' : '正在识别…' });
      else if (event.type === 'speech.error') publish({ speechStatus: `语音错误 [${event.code}]：${event.message}` });
      else if (event.type === 'speech.state') publish({ speechActive: event.state !== 'stopped', speechStatus: event.state === 'stopped' && state.speechStatus.startsWith('语音错误') ? state.speechStatus : ({ listening: '正在聆听…', recording: 'Whisper 正在录音；点击停止后转写', transcribing: 'Whisper 正在本地转写…', stopped: '语音已结束' })[event.state] || event.state });
      else if (event.type === 'speech.closed') publish({ speechActive: false });
    }
  };
}

export function transcriptText(session) {
  return session?.messages?.map((message) => `【${message.role}${message.name ? ' · ' + message.name : ''} · ${message.status || ''}】\n${message.content || ''}`).join('\n\n') || '输入一项任务开始。工具调用与结果会显示在这里。';
}
