const history = Array.from({ length: 1200 }, (_, index) => ({ id: index + 1, kind: index % 4 === 0 ? 'tool' : 'message', text: `Harness history ${index + 1} · search workspace, review result, request approval.` }));
const tokens = Array.from({ length: 180 }, (_, index) => `片段 ${index + 1}：工具结果已核对。\n`);

export function createNativeScenes() {
  let listeners = new Set(), timer = null, flushTimer = null, queued = 0;
  let state = { scene: 'snapshot', variant: 'naive', running: false, run: 0, ticks: 0, received: 0, publications: 0, terminal: '', text: '', tools: [], probe: '', note: 'review-notes.md', decision: 'review', progress: 0 };
  const publish = (changes = {}) => { state = { ...state, ...changes, publications: (changes.publications ?? state.publications) + 1 }; for (const listener of listeners) listener(); };
  const clearTimers = () => { clearInterval(timer); clearTimeout(flushTimer); timer = null; flushTimer = null; };
  const flush = () => { clearTimeout(flushTimer); flushTimer = null; queued = 0; publish(); };
  const finish = (terminal) => {
    clearTimers();
    // Publish the canonical last state and terminal together; never drop the
    // last progress or cancel event merely because a presentation batch is due.
    queued = 0;
    publish({ running: false, terminal });
  };
  return {
    history,
    getSnapshot: () => state,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    set(key, value) { if (['probe', 'note', 'decision'].includes(key)) publish({ [key]: String(value).slice(0, 500) }); },
    choose(scene, variant = state.variant) { clearTimers(); queued = 0; publish({ scene, variant, running: false, ticks: 0, received: 0, publications: -1, terminal: '', text: '', tools: [], progress: 0 }); },
    reset() { clearTimers(); queued = 0; state = { ...state, running: false, ticks: 0, received: 0, publications: -1, terminal: '', text: '', tools: [], progress: 0, probe: '', note: 'review-notes.md', decision: 'review', run: state.run + 1 }; publish(); },
    start() {
      if (state.running) return;
      clearTimers(); queued = 0;
      publish({ running: true, run: state.run + 1, ticks: 0, received: 0, publications: -1, terminal: '', text: '', progress: 0, tools: Array.from({ length: 24 }, (_, index) => ({ id: index + 1, kind: 'tool', progress: 0, text: `tool-${index + 1} · 0%` })) });
      if (state.scene === 'snapshot') {
        timer = setInterval(() => {
          const index = state.ticks;
          publish({ ticks: index + 1, received: state.received + 1, text: state.text + tokens[index] });
          if (index + 1 === tokens.length) finish('completed');
        }, 16);
      } else if (state.scene === 'progress') {
        timer = setInterval(() => {
          // A burst represents independent tool progress notifications. The
          // generator and canonical reductions are identical in both variants.
          for (let offset = 0; offset < 12; offset++) {
            const event = state.received, tool = event % 24, step = Math.floor(event / 24) + 1;
            const tools = state.tools.map((row, index) => index === tool ? { ...row, progress: step * 5, text: `tool-${index + 1} · ${step * 5}%${step === 20 ? ' · completed' : ''}` } : row);
            state = { ...state, tools, received: event + 1, ticks: event + 1 };
            queued++;
            if (state.variant === 'naive') flush();
            else if (!flushTimer) flushTimer = setTimeout(flush, 16);
            if (state.received === 480) { finish('completed'); return; }
          }
        }, 16);
      } else {
        timer = setInterval(() => {
          const progress = state.progress + 1;
          publish({ progress, ticks: progress, received: progress, text: `工具正在准备审批材料 ${progress}/60` });
          if (progress === 60) finish('completed');
        }, 80);
      }
    },
    stop() { if (state.running || queued) finish('cancelled'); },
    dispose() { clearTimers(); listeners.clear(); }
  };
}

export const nativeSceneDescriptions = {
  snapshot: 'N1 · 180 个相同文本增量 + 1,200 条静态历史：朴素每次传完整树；优化按稳定 ID 发属性 patch，Swift 只更新变化控件。',
  progress: 'N2 · 24 个工具 × 20 次进度：朴素每条事件发布 UI；优化合并一个显示批次。模型仍处理全部 480 条，完成/取消立即发布最后状态。',
  identity: 'N3 · 60 次工具进度推动动态审批表单：朴素每次移除并重建其原生控件；优化保留稳定 ID。输入/选择不被代码故意丢弃，观察真实焦点与选区。'
};
