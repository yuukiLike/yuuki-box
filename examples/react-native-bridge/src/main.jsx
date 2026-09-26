import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import Reconciler from 'react-reconciler';
import fs from 'node:fs';
import readline from 'node:readline';
import { createModel, visibleRows } from '../../shared/web/src/model.mjs';
import { createAgentModel, transcriptText } from '../../shared/web/src/agent-model.mjs';
import { createNativeScenes, nativeSceneDescriptions } from './scene-model.mjs';
import { createBridgeTransport } from './bridge-transport.mjs';

// This is a real React host renderer. React calls this host config when it commits
// host nodes; the Swift process receives its serializable tree over JSONL.
const container = { children: [] };
const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const bridge = createBridgeTransport();
function serializable(node) {
  const props = Object.fromEntries(Object.entries(node.props).filter(([key, value]) => key !== 'children' && typeof value !== 'function'));
  return { type: node.type, props, children: node.children.map(serializable) };
}
function commitTree() {
  const tree = container.children.map(serializable);
  const scene = scenes.getSnapshot();
  const active = agent.getSnapshot().mode === 'scenes';
  bridge.commit(tree, { patch: active && scene.scene === 'snapshot' && scene.variant === 'optimized', run: active ? `${scene.scene}/${scene.variant}/${scene.run}` : 'app' });
}
const host = {
  now: Date.now, isPrimaryRenderer: true, supportsMutation: true, supportsPersistence: false, supportsHydration: false,
  getRootHostContext: () => ({}), getChildHostContext: (context) => context,
  getPublicInstance: (instance) => instance, prepareForCommit: () => null, resetAfterCommit: commitTree,
  createInstance: (type, props) => ({ type, props, children: [] }),
  appendInitialChild: (parent, child) => parent.children.push(child),
  finalizeInitialChildren: () => false, prepareUpdate: () => true,
  shouldSetTextContent: () => false,
  createTextInstance: (text) => ({ type: 'Text', props: { text }, children: [] }),
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  appendChild: (parent, child) => parent.children.push(child),
  appendChildToContainer: (parent, child) => parent.children.push(child),
  insertBefore: (parent, child, before) => parent.children.splice(parent.children.indexOf(before), 0, child),
  insertInContainerBefore: (parent, child, before) => parent.children.splice(parent.children.indexOf(before), 0, child),
  removeChild: (parent, child) => { parent.children.splice(parent.children.indexOf(child), 1); },
  removeChildFromContainer: (parent, child) => { parent.children.splice(parent.children.indexOf(child), 1); },
  commitUpdate: (instance, _payload, _type, _old, props) => { instance.props = props; },
  commitTextUpdate: (instance, _old, text) => { instance.props.text = text; },
  resetTextContent: () => {}, clearContainer: (parent) => { parent.children = []; },
  getCurrentEventPriority: () => 16, detachDeletedInstance: () => {},
};
const renderer = Reconciler(host);
const root = renderer.createContainer(container, 0, null, false, null, '', (error) => { process.stderr.write(String(error)); }, null);
const fixturePath = process.argv.find((argument) => argument.endsWith('events.json'));
if (!fixturePath) throw new Error('Expected path to events.json');
const nativeCommand = (command) => send({ type: 'native', command });
const model = createModel(JSON.parse(fs.readFileSync(fixturePath, 'utf8')), nativeCommand);
const agent = createAgentModel(nativeCommand);
const scenes = createNativeScenes();

function App() {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const work = useSyncExternalStore(agent.subscribe, agent.getSnapshot);
  const lab = useSyncExternalStore(scenes.subscribe, scenes.getSnapshot);
  useEffect(() => { if (work.mode !== 'scenes') scenes.stop(); }, [work.mode]);
  const runtime = work.runtime;
  const busy = Boolean(runtime?.busy || work.submitting);
  const connected = Boolean(runtime);
  const session = runtime?.session;
  const approval = session?.pendingApproval;
  const rows = useMemo(() => visibleRows(state), [state.rows, state.query, state.toolOnly]);
  const settings = [
    ['apiBase', 'API Base URL'], ['model', '模型'], ['maxOutputTokens', '最大输出 token'], ['maxRounds', '最大工具轮数'],
    ['workspace', '工作目录（绝对路径）'], ['whisperCLI', 'whisper-cli 绝对路径'], ['whisperModel', 'Whisper 模型绝对路径']
  ];
  return <Column id="root">
    <Text id="title" text="Yuuki · React → 原生控件" role="title" />
    <Text id="subtitle" text="React reconciler → JSONL → AppKit · 独立 Swift Agent runtime" />
    <Row id="modes">
      <Button id="mode-agent" title="Agent 工作台" enabled={work.mode !== 'agent'} onPress={() => agent.setMode('agent')} />
      <Button id="mode-settings" title="设置" enabled={work.mode !== 'settings'} onPress={() => agent.setMode('settings')} />
      <Button id="mode-replay" title="回放与更新" enabled={work.mode !== 'replay'} onPress={() => agent.setMode('replay')} />
      <Button id="mode-scenes" title="场景实验" enabled={work.mode !== 'scenes'} onPress={() => agent.setMode('scenes')} />
    </Row>
    <Text id="notice" text={work.notice} />
    <Column id="scene-pane" hidden={work.mode !== 'scenes'}>
      <Text id="scene-heading" text="Harness 场景实验 · 原生桥 · 无模型 / 文件 / 麦克风调用" />
      <Select id="scene-select" value={lab.scene} options={[{ id: 'snapshot', label: 'N1 · 全树快照 / 节点属性 patch' }, { id: 'progress', label: 'N2 · 多工具进度逐条 / 合批' }, { id: 'identity', label: 'N3 · 动态表单重建 / 原生控件复用' }]} onChange={(value) => scenes.choose(value)} />
      <Select id="scene-variant" value={lab.variant} options={[{ id: 'naive', label: '朴素路径' }, { id: 'optimized', label: '优化路径' }]} onChange={(value) => scenes.choose(lab.scene, value)} />
      <Text id="scene-description" text={nativeSceneDescriptions[lab.scene]} />
      <Row id="scene-actions">
        <Button id="scene-run" title="运行相同输入" enabled={!lab.running} onPress={() => scenes.start()} />
        <Button id="scene-stop" title="停止并保留最后状态" enabled={lab.running} onPress={() => scenes.stop()} />
        <Button id="scene-reset" title="重置" onPress={() => scenes.reset()} />
      </Row>
      <Text id="scene-counts" text={`收到事件 ${lab.received} · 模型发布 ${lab.publications} · 状态 ${lab.running ? 'running' : lab.terminal || 'idle'} · 下方宿主指标来自实际包与控件操作，不是 FPS`} />
      <Text id="scene-probe-label" text="工作期间继续输入，观察响应；此探针位于审批表单之外" />
      <Field id="scene-probe" value={lab.probe} placeholder="输入响应探针" onChange={(value) => scenes.set('probe', value)} />
      <Column id="scene-snapshot" hidden={lab.scene !== 'snapshot'}>
        <List id="scene-static-history" items={work.mode === 'scenes' && lab.scene === 'snapshot' ? scenes.history : []} />
        <Transcript id="scene-token-output" value={lab.text} height={100} />
      </Column>
      <Column id="scene-tools" hidden={lab.scene !== 'progress'}>
        <List id="scene-progress-list" items={lab.tools} />
      </Column>
      <Column id="scene-identity" hidden={lab.scene !== 'identity'}>
        <Text id="scene-identity-progress" text={`工具状态：${lab.progress}/60。运行中点击下面文本框并选择内容，观察真实焦点/选区变化。`} />
        <Column id="scene-approval-form" recreate={work.mode === 'scenes' && lab.scene === 'identity' && lab.variant === 'naive'}>
          <Text id="scene-note-label" text="待创建笔记的标题（只模拟表单，不写文件）" />
          <Field id="scene-note" value={lab.note} onChange={(value) => scenes.set('note', value)} />
          <Select id="scene-decision" value={lab.decision} options={[{ id: 'review', label: '待审阅' }, { id: 'allow', label: '允许（仅演示）' }, { id: 'deny', label: '拒绝（仅演示）' }]} onChange={(value) => scenes.set('decision', value)} />
        </Column>
        <Text id="scene-draft-state" text={`模型保存的标题：${lab.note} · 选择：${lab.decision}。没有故意删除输入；差异来自真实控件生命周期。`} />
      </Column>
    </Column>
    <Column id="agent-pane" hidden={work.mode !== 'agent'}>
      <Row id="session-actions">
        <Button id="session-new" title="新建会话" enabled={connected && !busy} onPress={() => agent.newSession()} />
        <Button id="session-export" title="导出 Markdown" enabled={connected && !busy} onPress={() => agent.exportSession()} />
      </Row>
      <Select id="session-select" options={(runtime?.sessions || []).map((item) => ({ id: item.id, label: `${item.title} · ${item.status}` }))} value={session?.id || ''} enabled={!busy} onChange={(id) => agent.selectSession(id)} />
      <Text id="agent-state" text={`状态：${session?.status || '未连接'} · token ${session?.usage?.totalTokens || 0} · 请求 ${session?.usage?.requests || 0} · ${runtime?.hasAPIKey ? '已配置凭据' : '请先在设置中配置 API Key'}`} />
      <Transcript id="chat" value={transcriptText(session)} height={310} />
      <Column id="approval-pane" hidden={!approval}>
        <Text id="approval-title" text={`工具请求授权：${approval?.tool || ''} · ${approval?.path || ''}`} />
        <Transcript id="approval-preview" value={approval?.preview || ''} height={100} />
        <Row id="approval-actions">
          <Button id="approve" title="允许此操作" enabled={Boolean(approval)} onPress={() => agent.approve(true)} />
          <Button id="deny" title="拒绝" enabled={Boolean(approval)} onPress={() => agent.approve(false)} />
        </Row>
      </Column>
      <Text id="draft-label" text="任务草稿（语音文字不会自动发送）" />
      <Editor id="draft" value={work.draft} height={90} enabled={!busy} onChange={(text) => agent.setDraft(text)} />
      <Row id="run-actions">
        <Button id="run-start" title="发送任务" enabled={connected && !busy && Boolean(work.draft.trim())} onPress={() => agent.start()} />
        <Button id="run-cancel" title="取消任务" enabled={busy} onPress={() => agent.cancel()} />
      </Row>
      <Text id="voice-label" text={`语音后端：${runtime?.settings?.speechBackend || 'apple'} · 设置保存后生效`} />
      <Field id="audio-file" value={work.audioFile} placeholder="可选音频文件绝对路径；留空使用麦克风" onChange={(value) => agent.setAudioFile(value)} />
      <Row id="voice-actions">
        <Button id="voice-start" title="开始语音 / 识别文件" enabled={!work.speechActive} onPress={() => agent.startSpeech()} />
        <Button id="voice-stop" title="停止录音并转写" enabled={work.speechActive} onPress={() => agent.stopSpeech()} />
        <Button id="voice-cancel" title="取消识别" enabled={work.speechActive} onPress={() => agent.cancelSpeech()} />
        <Button id="voice-use" title="用作任务草稿" enabled={Boolean(work.transcript) && !busy} onPress={() => agent.useTranscript()} />
      </Row>
      <Text id="voice-status" text={work.speechStatus} />
      <Transcript id="voice-transcript" value={work.transcript || '识别结果将显示在这里。'} height={80} />
    </Column>
    <Column id="settings-pane" hidden={work.mode !== 'settings'}>
      <Text id="settings-intro" text="API Key 由原生密码框直接交给 runtime，保存在 macOS Keychain；不会进入 React / Node 状态。" />
      <Text id="api-key-label" text={runtime?.hasAPIKey ? '替换 API Key（留空保持现有值）' : 'API Key'} />
      <Secure id="apiKey" placeholder="API Key · 仅提交一次，之后清空" enabled={!busy} />
      {settings.map(([key, label]) => <Column key={key} id={`setting-${key}`}>
        <Text id={`label-${key}`} text={label} />
        <Field id={`field-${key}`} value={String(work.settings[key] ?? '')} enabled={!busy} onChange={(value) => agent.setSetting(key, value)} />
      </Column>)}
      <Text id="speech-backend-label" text="语音后端" />
      <Select id="speech-backend" options={[{ id: 'apple', label: 'Apple Speech · 设备端' }, { id: 'whisper', label: 'Whisper · 本地 CLI' }]} value={work.settings.speechBackend} enabled={!busy} onChange={(value) => agent.setSetting('speechBackend', value)} />
      <Row id="settings-actions">
        <Button id="settings-save" title="保存设置" enabled={connected && !busy} onPress={() => agent.saveSettings()} />
        <Button id="settings-clear-key" title="清除 Keychain 凭据" enabled={connected && !busy} onPress={() => agent.clearKey()} />
      </Row>
      <Text id="settings-help" text="Whisper 路径指向你已安装的 CLI 与模型；此应用不会下载模型。更换 API 地址会改变任务的网络目的地，请填写可信服务。" />
    </Column>
    <Column id="replay-pane" hidden={work.mode !== 'replay'}>
      <Text id="replay-title" text="本地性能负载 · 不调用模型" />
      <Row id="commands">
        <Button id="start" title="开始事件流" enabled={!state.running} onPress={() => model.start()} />
        <Button id="stop" title="停止" enabled={state.running} onPress={() => model.stop()} />
        <Button id="load" title={state.history === 1000 ? '切换到 10,000 条' : '切换到 1,000 条'} onPress={() => model.toggleLoad()} />
        <Button id="update" title="检查更新" onPress={() => model.checkUpdate()} />
      </Row>
      <Input id="filter" value={state.query} placeholder="筛选任务 / 日志内容" onChange={(value) => model.filter(value)} />
      <Row id="filters">
        <Button id="all" title="全部" enabled={state.toolOnly} onPress={() => model.showTools(false)} />
        <Button id="tools" title="仅工具" enabled={!state.toolOnly} onPress={() => model.showTools(true)} />
      </Row>
      <Text id="status" text={`${state.status} · ${rows.length.toLocaleString()} / ${state.rows.length.toLocaleString()} 条`} />
      <List id="history" items={work.mode === 'replay' ? rows : []} />
      <Text id="output-title" text="流式输出（显示末尾）" />
      <Transcript id="output" value={state.output.slice(-1600)} height={100} />
      <Text id="update-result" text={state.update} />
    </Column>
  </Column>;
}
const Column = 'Column', Row = 'Row', Text = 'Text', Button = 'Button', Input = 'Input', List = 'List';
const Field = 'Field', Secure = 'Secure', Select = 'Select', Editor = 'Editor', Transcript = 'Transcript';
renderer.updateContainer(<App />, root, null, null);

function findByID(nodes, id) {
  for (const node of nodes) {
    if (node.props.id === id) return node;
    const child = findByID(node.children, id);
    if (child) return child;
  }
}
const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (line.length > 2_200_000) return;
  try {
    const message = JSON.parse(line);
    if (message.type === 'action' && typeof message.id === 'string') {
      const node = findByID(container.children, message.id);
      if (node?.type === 'Button' && node.props.enabled !== false) node.props.onPress?.();
      if (['Input', 'Field', 'Select', 'Editor'].includes(node?.type) && node.props.enabled !== false && typeof message.value === 'string') node.props.onChange?.(message.value.slice(0, 32000));
    } else if (message.type === 'native.event') { model.receive(message.event); agent.receive(message.event); }
    else if (message.type === 'shutdown') { model.dispose(); scenes.dispose(); process.exit(0); }
  } catch (error) { process.stderr.write(`Input rejected: ${error.message}\n`); }
});
input.on('close', () => { model.dispose(); scenes.dispose(); process.exit(0); });
