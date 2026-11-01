import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { RehearsalPiano } from './piano.js';
import { StagePreview } from './stage.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { exportOutputSchema, inspectOutputSchema, modelOutputSchema, musicSchema, previewOutputSchema, sceneOutputSchema, sceneSchema, toolCallSchema, type FrameInfo, type Music, type MusicScene, type ToolCall } from '../src/contracts.js';
import { cueAt, frameAt, positionAt } from '../src/timeline.js';
import { noteName } from '../src/presentation.js';

const parameters = new URLSearchParams(location.search);
const capture = parameters.get('capture') === '1';
document.body.classList.toggle('capture', capture);
function element<Kind extends HTMLElement = HTMLElement>(id: string): Kind {
  const value = document.getElementById(id);
  if (!value) throw new Error(`缺少界面元素 ${id}`);
  return value as Kind;
}
const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value] ?? value));
const message = (text: string) => { element('message').textContent = text; };
const clockText = (time: number) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
async function request(path: string, data?: unknown): Promise<unknown> {
  const response = await fetch(path, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(typeof value === 'object' && value !== null && 'error' in value ? String(value.error) : '请求失败。');
  return value;
}

class Player {
  private context: AudioContext | undefined;
  private buffers = new Map<string, AudioBuffer>();
  private sources: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private analyzer: AnalyserNode | undefined;
  private anchor = 0;
  private offset = 0;
  private running = false;
  constructor(private readonly music: Music) {}
  async enable(): Promise<void> {
    this.context ??= new AudioContext();
    this.analyzer ??= this.context.createAnalyser();
    this.analyzer.fftSize = 256;
    this.analyzer.connect(this.context.destination);
    await this.context.resume();
    if (!this.buffers.size) await Promise.all(this.music.tracks.map(async track => {
      const response = await fetch(`/media/assets/${this.music.assetId}/${track.stem}`);
      if (!response.ok) throw new Error('无法读取声部音频。');
      this.buffers.set(track.id, await this.context!.decodeAudioData(await response.arrayBuffer()));
    }));
  }
  stop(): void { for (const { source, gain } of this.sources) { source.stop(); source.disconnect(); gain.disconnect(); } this.sources = []; this.running = false; }
  sync(scene: MusicScene): void {
    this.stop();
    if (!this.context || this.context.state !== 'running' || !this.analyzer || !scene.transport.playing) return;
    this.offset = positionAt(scene, this.music.duration);
    if (this.offset >= this.music.duration) return;
    this.anchor = this.context.currentTime + 0.025;
    for (const track of this.music.tracks) {
      if (scene.transport.soloTrackIds.length && !scene.transport.soloTrackIds.includes(track.id)) continue;
      const buffer = this.buffers.get(track.id); if (!buffer) continue;
      const source = this.context.createBufferSource(); const gain = this.context.createGain();
      source.buffer = buffer; gain.gain.value = this.music.kind === 'audio' ? 1 : 0.7; source.connect(gain); gain.connect(this.analyzer);
      source.start(this.anchor, Math.min(this.offset, buffer.duration)); this.sources.push({ source, gain });
    }
    this.running = true;
  }
  time(scene: MusicScene): number {
    return this.running && this.context ? Math.min(this.music.duration, this.offset + Math.max(0, this.context.currentTime - this.anchor)) : positionAt(scene, this.music.duration);
  }
  state(): string { return this.context?.state ?? 'not-enabled'; }
  meter(): number {
    if (!this.analyzer) return 0;
    const data = new Uint8Array(this.analyzer.frequencyBinCount); this.analyzer.getByteFrequencyData(data);
    return data.reduce((sum, value) => sum + value, 0) / data.length / 255;
  }
}

class Visualizer {
  onCameraChange: ((camera: MusicScene['camera']) => void) | undefined;
  readonly renderer: THREE.WebGPURenderer;
  readonly world = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  readonly controls: OrbitControls;
  readonly backend: 'webgpu' | 'webgl';
  private readonly pipeline: THREE.RenderPipeline;
  private piano: RehearsalPiano | undefined;
  private theatre: StagePreview | undefined;
  private manualOrbit = false;
  private cameraKey = '';
  private needsResize = true;
  private constructor(private settings: MusicScene, private readonly music: Music, private readonly host: HTMLElement, renderer: THREE.WebGPURenderer) {
    this.renderer = renderer;
    this.backend = 'isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend === true ? 'webgpu' : 'webgl';
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.enablePan = false; this.controls.minDistance = 8; this.controls.maxDistance = 70;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(5); this.controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
    this.controls.minAzimuthAngle = THREE.MathUtils.degToRad(-170); this.controls.maxAzimuthAngle = THREE.MathUtils.degToRad(170);
    this.controls.addEventListener('start', () => { this.manualOrbit = true; });
    this.controls.addEventListener('end', () => {
      const offset = this.camera.position.clone().sub(this.controls.target); const distance = offset.length();
      if (this.manualOrbit && distance > 0) this.onCameraChange?.({
        azimuth: Math.max(-170, Math.min(170, THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)))),
        elevation: Math.max(10, Math.min(85, THREE.MathUtils.radToDeg(Math.asin(offset.y / distance)))),
        distance: Math.max(8, Math.min(70, distance)),
      });
    });
    this.world.background = new THREE.Color('#101922');
    this.world.fog = new THREE.FogExp2('#101922', 0.009);
    this.world.add(new THREE.HemisphereLight(0xd3e3f0, 0x6c5650, 2.1));
    const light = new THREE.DirectionalLight(0xffead4, 3.5); light.position.set(-7, 14, 12); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = -18; light.shadow.camera.right = 18;
    light.shadow.camera.top = 18; light.shadow.camera.bottom = -18; light.shadow.camera.far = 60; light.shadow.normalBias = 0.03;
    this.world.add(light);
    const rim = new THREE.DirectionalLight(0xa0c6ed, 2); rim.position.set(8, 7, -6); this.world.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardNodeMaterial({ color: 0x111923, roughness: 0.75, metalness: 0.15 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.32; ground.receiveShadow = true; this.world.add(ground);
    const scenePass = pass(this.world, this.camera);
    const color = scenePass.getTextureNode('output');
    const glow = bloom(color, 0.22, 0.25, 1.35).setResolutionScale(0.5);
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = color.add(glow);
    host.prepend(renderer.domElement);
    new ResizeObserver(() => { this.needsResize = true; }).observe(host);
  }
  static async create(scene: MusicScene, music: Music, host: HTMLElement): Promise<Visualizer> {
    const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL: parameters.get('backend') === 'webgl' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, capture ? 1 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    await renderer.init();
    const result = new Visualizer(scene, music, host, renderer);
    if (scene.mode === 'photo') { result.theatre = await StagePreview.create(scene); result.world.add(result.theatre.group); }
    if (scene.mode === 'score') { result.piano = new RehearsalPiano(music, scene); result.world.add(result.piano.group); }
    result.update(scene); result.resize();
    return result;
  }
  follow(): void { this.manualOrbit = false; }
  async model(): Promise<ArrayBuffer> { const model = this.piano ?? this.theatre; if (!model) throw new Error('模型尚未准备好。'); return await model.model(); }
  pressedKeys(): number[] { return this.piano?.pressedKeys() ?? []; }
  update(scene: MusicScene): void {
    this.settings = scene;
    const cameraKey = JSON.stringify([scene.camera, scene.presentation]);
    if (cameraKey !== this.cameraKey) this.manualOrbit = false;
    this.cameraKey = cameraKey;
    this.piano?.update(scene); this.theatre?.update(scene); this.controls.enabled = true;
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth); const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  }
  async frame(time: number): Promise<FrameInfo> {
    // Resizing clears the canvas. Apply it immediately before drawing a new frame.
    if (this.needsResize) { this.resize(); this.needsResize = false; }
    const frame = frameAt(this.settings, this.music, time);
    this.piano?.frame(time, frame.audibleTrackIds); this.theatre?.frame(time, frame.energy);
    if (!this.manualOrbit) {
      const cue = this.theatre && this.settings.presentation.view !== 'plan' ? cueAt(this.settings, time) : undefined;
      const azimuth = THREE.MathUtils.degToRad(this.settings.camera.azimuth) + (cue ? cue.pan * this.settings.photo.cameraTravel * 0.12 : 0);
      const elevation = THREE.MathUtils.degToRad(this.settings.camera.elevation);
      const distance = this.settings.camera.distance / (cue ? cue.zoom * this.settings.photo.zoom : 1); const focus = this.piano?.focus() ?? this.theatre?.focus() ?? new THREE.Vector3();
      this.controls.target.copy(focus);
      this.camera.position.copy(focus).add(new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(azimuth) * Math.cos(elevation) * distance));
      this.controls.update();
    }
    this.pipeline.render();
    return { ...frame, backend: this.backend };
  }
}

async function main(): Promise<void> {
  const list: unknown = await request('/api/scenes');
  if (!Array.isArray(list)) throw new Error('场景清单不合法。');
  const select = element<HTMLSelectElement>('scene-select');
  for (const item of list) if (typeof item === 'object' && item && 'sceneId' in item && 'title' in item) {
    const option = document.createElement('option'); option.value = String(item.sceneId); option.textContent = String(item.title); select.append(option);
  }
  const sceneId = parameters.get('scene') ?? select.options[0]?.value;
  if (!sceneId) { element('title').textContent = '先创建一个练习场景'; element('description').textContent = '运行 demo，或通过 MCP 导入音乐并创建场景。'; return; }
  select.value = sceneId; select.onchange = () => { location.href = `/?scene=${select.value}`; };
  const snapshot = parameters.get('snapshot');
  const raw: unknown = await request(`/api/scene/${sceneId}${snapshot ? `?snapshot=${snapshot}` : ''}`);
  if (typeof raw !== 'object' || !raw || !('scene' in raw) || !('music' in raw)) throw new Error('场景数据不完整。');
  let scene = sceneSchema.parse(raw.scene); const music = musicSchema.parse(raw.music);
  const visual = await Visualizer.create(scene, music, element('stage')); const player = new Player(music);
  window.addEventListener('pagehide', () => player.stop());
  let forcedTime: number | undefined;
  let lastFrame: FrameInfo = { ...frameAt(scene, music, 0), backend: visual.backend };
  let rendering = false; let ending = false;
  let calls: ToolCall[] = []; let selectedCall = ''; let lastCall = '';
  const seek = element<HTMLInputElement>('seek'); seek.max = String(music.duration);
  element('duration').textContent = clockText(music.duration);
  const score = scene.mode === 'score';
  element('mode-label').textContent = score ? '01 / MIDI REHEARSAL' : '02 / STAGE PREVIEW';
  element('stage-type').textContent = score ? 'MIDI / REHEARSAL PIANO' : 'CONCERT / STAGE PREVIEW';
  element('description').textContent = score ? '定位一小节，独听一个声部，核对亮起的琴键与音名。再调整琴盖或机位，观察 MCP 怎样改变场景。' : '用模型检查屏幕、音箱和灯架的布局。改变间距、高度或机位，再渲染一张预演图。';
  element('track-count').textContent = String(music.tracks.length);
  element('active-unit').textContent = score ? 'PRESSED KEYS' : 'SIGNAL / 100';
  element('score-controls').hidden = !score; element('photo-controls').hidden = score;
  element('depth-source').textContent = '图片与透明图层用于舞台主屏；屏幕、音箱、灯架与阶梯均为独立三维部件。';
  const targetBar = Math.min(8, music.bars.length); const targetTrack = music.tracks[1] ?? music.tracks[0];
  element('task-description').textContent = score ? `定位第 ${targetBar} 小节，只听 ${targetTrack?.name ?? '第一声部'}，再点击播放核对琴键。` : '读取模型对象，把左右音箱间距改为 8，切到俯视图检查布局。';

  function showCall(id: string): void {
    const call = calls.find(item => item.id === id); if (!call) return; selectedCall = id;
    element('call-source').textContent = call.source === 'stdio' ? '外部客户端 · stdio' : '展示页 · InMemoryTransport';
    element('call-request').textContent = JSON.stringify({ method: 'tools/call', params: { name: call.name, arguments: call.arguments } }, null, 2);
    element('call-result').textContent = JSON.stringify({ isError: call.error, structuredContent: call.result }, null, 2);
    const returnedScene = sceneSchema.safeParse(call.result.scene).data;
    element('call-summary').textContent = returnedScene ? call.name === 'set_transport'
      ? `返回 REV ${returnedScene.revision} · ${returnedScene.transport.position.toFixed(2)} 秒 · ${returnedScene.transport.soloTrackIds.join(' / ') || '全部声部'}`
      : returnedScene.mode === 'score' ? `返回 REV ${returnedScene.revision} · 琴盖 ${returnedScene.model.lidAngle}°`
        : `返回 REV ${returnedScene.revision} · 间距 ${returnedScene.model.speakerSpread} · 屏幕 ${returnedScene.model.screenHeight}`
      : call.error ? '工具返回错误' : '结构化结果';
    for (const button of element('calls').querySelectorAll('button')) button.classList.toggle('selected', button.dataset.call === id);
  }
  async function refreshCalls(): Promise<void> {
    const all = toolCallSchema.array().parse(await request('/api/calls'));
    const next = all.filter(call => call.arguments.sceneId === sceneId || call.result.assetId === music.assetId || sceneSchema.safeParse(call.result.scene).data?.sceneId === sceneId).toReversed();
    if (next[0]?.id === lastCall) return;
    calls = next; lastCall = next[0]?.id ?? '';
    element('calls').innerHTML = calls.map(call => `<button data-call="${call.id}" class="${call.error ? 'failed' : ''}">${escape(call.name)}</button>`).join('');
    for (const button of element('calls').querySelectorAll<HTMLButtonElement>('button')) button.onclick = () => showCall(button.dataset.call ?? '');
    showCall(lastCall || selectedCall);
  }
  async function invoke(name: string, args: Record<string, unknown>): Promise<unknown> {
    message(`正在调用 ${name}…`);
    const result = await request('/api/tool', { name, arguments: args }); await refreshCalls(); message(`${name} 已完成。`); return result;
  }
  const drawControls = () => {
    element('title').textContent = scene.title; element('capture-title').textContent = scene.title; element('revision').textContent = `REV ${scene.revision}`;
    element('capture-tracks').textContent = music.tracks.filter(track => !scene.transport.soloTrackIds.length || scene.transport.soloTrackIds.includes(track.id)).map(track => track.name).join(' · ');
    element('tracks').innerHTML = music.tracks.map((track, index) => `<div class="track"><i class="dot" style="background:${scene.colors[index % scene.colors.length]}"></i><div class="track-info"><strong>${escape(track.name)}</strong><small>${track.notes.length ? `${track.notes.length} 个音符 · 基础合成试听` : '完整音频'}</small></div><button class="solo ${scene.transport.soloTrackIds.includes(track.id) ? 'selected' : ''}" data-track="${escape(track.id)}" aria-label="独听 ${escape(track.name)}">独听</button></div>`).join('');
    for (const button of element('tracks').querySelectorAll<HTMLButtonElement>('button')) button.onclick = () => { void setTransport({ soloTrackIds: scene.transport.soloTrackIds.length === 1 && scene.transport.soloTrackIds[0] === button.dataset.track ? [] : [button.dataset.track ?? ''] }).catch(error => message(String(error))); };
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.classList.toggle('selected', button.dataset.view === scene.presentation.view);
    element<HTMLInputElement>('lid').value = String(scene.model.lidAngle); element('lid-value').textContent = `${scene.model.lidAngle}°`;
    element<HTMLInputElement>('guide').checked = scene.model.showGuide; element<HTMLInputElement>('labels').checked = scene.presentation.labels;
    element<HTMLInputElement>('spread').value = String(scene.model.speakerSpread); element('spread-value').textContent = scene.model.speakerSpread.toFixed(1);
    element<HTMLInputElement>('screen-height').value = String(scene.model.screenHeight); element('screen-value').textContent = scene.model.screenHeight.toFixed(1);
    element<HTMLInputElement>('depth').value = String(scene.photo.depthStrength); element<HTMLInputElement>('travel').value = String(scene.photo.cameraTravel);
    element('cues').innerHTML = scene.cues.map((cue, index) => `<button data-cue="${index}">${clockText(cue.time)} / ${escape(cue.label)}</button>`).join('');
    for (const button of element('cues').querySelectorAll<HTMLButtonElement>('button')) button.onclick = () => { const cue = scene.cues[Number(button.dataset.cue)]; if (cue) void setTransport({ time: Math.min(cue.time, music.duration), playing: false }).catch(error => message(String(error))); };
  };
  const apply = (next: MusicScene) => {
    const transportChanged = JSON.stringify(next.transport) !== JSON.stringify(scene.transport);
    scene = next; forcedTime = undefined; visual.update(scene); if (transportChanged) player.sync(scene); drawControls();
  };
  async function setTransport(input: Record<string, unknown>): Promise<void> { apply(sceneOutputSchema.parse(await invoke('set_transport', { sceneId, ...input })).scene); }
  async function patch(input: Record<string, unknown>): Promise<void> {
    apply(sceneOutputSchema.parse(await invoke('update_scene', { sceneId, expectedRevision: scene.revision, ...input })).scene); message('调整已保存。');
  }
  async function inspect() {
    const result = inspectOutputSchema.parse(await invoke('inspect_scene', { sceneId })); apply(result.scene);
    element('objects').innerHTML = result.objects.map(object => `<div class="object"><strong>${escape(object.name)}</strong><code>${escape(object.id)}</code><br>${escape(object.controls.join(' · '))}</div>`).join(''); return result;
  }
  const artifact = (result: { path: string; downloadUrl: string }) => {
    const link = element<HTMLAnchorElement>('artifact-link'); link.href = result.downloadUrl; link.hidden = false;
    message(`已保存：${result.path}`);
  };
  function action(id: string, run: () => Promise<void>): void {
    const button = element<HTMLButtonElement>(id);
    button.onclick = () => { button.disabled = true; void run().catch(error => message(error instanceof Error ? error.message : String(error))).finally(() => { button.disabled = false; }); };
  }
  visual.onCameraChange = camera => { void patch({ camera }).catch(error => message(String(error))); };
  drawControls();
  for (const bar of music.bars.slice(0, 64)) {
    const button = document.createElement('button'); button.textContent = String(bar.number); button.dataset.bar = String(bar.number); button.setAttribute('aria-label', `第 ${bar.number} 小节`);
    button.onclick = () => { void setTransport({ bar: bar.number, playing: false }).catch(error => message(String(error))); }; element('bars').append(button);
  }
  element('repeats').innerHTML = music.repeats.slice(0, 3).map(pattern => `<p>${escape(music.tracks.find(track => track.id === pattern.trackId)?.name ?? '')}：第 ${pattern.bars.join('、')} 小节精确重复</p>`).join('');
  action('inspect', async () => { await inspect(); message('已通过 inspect_scene 读取对象与当前版本。'); });
  action('run-task', async () => {
    await inspect();
    if (score) { await setTransport({ bar: targetBar, playing: false, soloTrackIds: targetTrack ? [targetTrack.id] : [] }); message('定位与独听已完成。点击播放，核对亮起的琴键。'); }
    else { await patch({ model: { speakerSpread: 8 }, presentation: { view: 'plan' } }); message('音箱间距已改为 8，已切换俯视布局。下方可核对实际 MCP 参数。'); }
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.onclick = () => { void patch({ presentation: { view: button.dataset.view } }).catch(error => message(String(error))); };
  element('follow').onclick = () => visual.follow();
  element('all-tracks').onclick = () => { void setTransport({ soloTrackIds: [] }).catch(error => message(String(error))); };
  const range = (id: string, field: string, parent: string) => {
    element<HTMLInputElement>(id).onchange = event => { void patch({ [parent]: { [field]: Number((event.target as HTMLInputElement).value) } }).catch(error => message(String(error))); };
  };
  range('lid', 'lidAngle', 'model'); range('spread', 'speakerSpread', 'model'); range('screen-height', 'screenHeight', 'model'); range('depth', 'depthStrength', 'photo'); range('travel', 'cameraTravel', 'photo');
  element<HTMLInputElement>('guide').onchange = event => { void patch({ model: { showGuide: (event.target as HTMLInputElement).checked } }).catch(error => message(String(error))); };
  element<HTMLInputElement>('labels').onchange = event => { void patch({ presentation: { labels: (event.target as HTMLInputElement).checked } }).catch(error => message(String(error))); };
  action('play', async () => {
    const needsAudio = player.state() !== 'running'; await player.enable(); const time = player.time(scene);
    if (needsAudio && scene.transport.playing && time < music.duration) { player.sync(scene); return; }
    await setTransport({ time: time >= music.duration ? 0 : time, playing: !scene.transport.playing || time >= music.duration });
  });
  seek.oninput = () => { forcedTime = Number(seek.value); };
  seek.onchange = () => { void setTransport({ time: Number(seek.value) }).catch(error => message(String(error))); };
  action('render', async () => { message('正在通过 MCP 渲染预览…'); artifact(previewOutputSchema.parse(await invoke('render_preview', { sceneId, time: player.time(scene) }))); });
  action('model', async () => { message('正在通过 MCP 导出可编辑模型…'); artifact(modelOutputSchema.parse(await invoke('export_model', { sceneId, time: player.time(scene) }))); });
  action('export', async () => {
    message('正在通过 MCP 逐帧生成带声音的短片…'); const duration = Math.min(4, music.duration); const start = Math.min(player.time(scene), Math.max(0, music.duration - duration));
    artifact(exportOutputSchema.parse(await invoke('export_clip', { sceneId, start, duration, fps: 24, width: 960 })));
  });
  action('save', async () => {
    await inspect(); const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `music-scene-${sceneId}.json`; link.click(); URL.revokeObjectURL(url); message('配置已保存。');
  });
  action('show-tools', async () => { element('tools-json').textContent = JSON.stringify(await request('/api/tools'), null, 2); element<HTMLDialogElement>('tools-dialog').showModal(); });
  element('close-tools').onclick = () => element<HTMLDialogElement>('tools-dialog').close();
  element('toggle-console').onclick = () => { const expanded = element('call-console').classList.toggle('expanded'); element('toggle-console').textContent = expanded ? '收起详情' : '展开详情'; };
  const render = async (time: number): Promise<FrameInfo> => {
    const frame = await visual.frame(time); lastFrame = frame; const keys = visual.pressedKeys();
    element('chapter').textContent = cueAt(scene, time).label;
    element('active-count').textContent = String(score ? keys.length : Math.round(frame.energy * 100)).padStart(2, '0');
    element('notes-now').textContent = score ? keys.length ? `当前琴键 / ${keys.map(noteName).join(' · ')}` : '当前休止 / 可按小节定位' : `音箱间距 ${scene.model.speakerSpread.toFixed(1)} / 屏幕高度 ${scene.model.screenHeight.toFixed(1)}`;
    element('time').textContent = clockText(time); seek.value = String(time);
    const playLabel = scene.transport.playing && time < music.duration ? player.state() === 'running' ? '暂停' : '启用声音' : '播放';
    element('play').textContent = playLabel; element('play').setAttribute('aria-label', playLabel === '启用声音' ? playLabel : `${playLabel}音乐`);
    const bar = music.bars.findLast(bar => bar.time <= time); element('bar-label').textContent = bar ? `第 ${bar.number} 小节` : '';
    for (const button of element('bars').querySelectorAll<HTMLButtonElement>('button')) button.classList.toggle('active', button.dataset.bar === String(bar?.number));
    element('meter').style.height = `${Math.max(1, player.meter() * 100)}%`; return frame;
  };
  await render(positionAt(scene, music.duration));
  if (!capture) await inspect();
  window.musicSpace = {
    frame: async time => { forcedTime = time; return await render(time); },
    model: async () => {
      const bytes = new Uint8Array(await visual.model()); let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary);
    },
    snapshot: () => ({ ...lastFrame, audioState: player.state(), meter: player.meter(), pressedKeys: visual.pressedKeys() }),
  };
  if (!capture) {
    const animate = () => {
      requestAnimationFrame(animate); if (rendering) return; rendering = true;
      const time = forcedTime ?? player.time(scene);
      void render(time).catch(error => message(String(error))).finally(() => { rendering = false; });
      if (scene.transport.playing && time >= music.duration && !ending) { ending = true; void setTransport({ time: music.duration, playing: false }).finally(() => { ending = false; }); }
    };
    requestAnimationFrame(animate);
    setInterval(() => { void (async () => {
      const next = sceneSchema.parse(await request(`/api/state/${sceneId}`)); if (next.revision !== scene.revision) apply(next); await refreshCalls();
    })().catch(error => message(String(error))); }, 700);
  }
}
void main().catch(error => { message(error instanceof Error ? error.message : String(error)); element('title').textContent = '场景暂时无法打开'; });
