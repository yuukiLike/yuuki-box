import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ScoreWeave } from './weave.js';
import { PhotoTheatre } from './theatre.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { musicSchema, sceneSchema, type FrameInfo, type Music, type MusicScene } from '../src/contracts.js';
import { cueAt, frameAt, positionAt } from '../src/timeline.js';

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
  private weave: ScoreWeave | undefined;
  private theatre: PhotoTheatre | undefined;
  private manualOrbit = false;
  private scoreKey = '';
  private cameraKey = '';
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
    this.world.background = new THREE.Color('#05090f');
    if (settings.mode === 'score') {
      this.world.fog = new THREE.FogExp2('#05090f', 0.012);
      this.world.add(new THREE.HemisphereLight(0xb8d8ee, 0x273342, 2));
      const light = new THREE.DirectionalLight(0xffe3c2, 4); light.position.set(3, 12, 8); this.world.add(light);
    }
    const scenePass = pass(this.world, this.camera);
    const color = scenePass.getTextureNode('output');
    const glow = bloom(color, settings.mode === 'score' ? 0.65 : 0.3, 0.3, 1.1).setResolutionScale(0.5);
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = color.add(glow);
    host.prepend(renderer.domElement);
    new ResizeObserver(() => this.resize()).observe(host);
  }
  static async create(scene: MusicScene, music: Music, host: HTMLElement): Promise<Visualizer> {
    const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL: parameters.get('backend') === 'webgl' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, capture ? 1 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    await renderer.init();
    const result = new Visualizer(scene, music, host, renderer);
    if (scene.mode === 'photo') { result.theatre = await PhotoTheatre.create(scene); result.world.add(result.theatre.group); }
    result.update(scene); result.resize();
    return result;
  }
  follow(): void { this.manualOrbit = false; }
  async model(): Promise<ArrayBuffer> { if (!this.weave) throw new Error('GLB 导出只适用于声部之结。'); return await this.weave.model(); }
  update(scene: MusicScene): void {
    this.settings = scene;
    const cameraKey = JSON.stringify(scene.camera);
    if (cameraKey !== this.cameraKey) this.manualOrbit = false;
    this.cameraKey = cameraKey;
    const key = JSON.stringify([scene.score, scene.colors]);
    if (scene.mode === 'score' && key !== this.scoreKey) {
      if (this.weave) { this.world.remove(this.weave.group); this.weave.dispose(); }
      this.weave = new ScoreWeave(this.music, scene); this.world.add(this.weave.group); this.scoreKey = key;
    }
    this.theatre?.update(scene); this.controls.enabled = scene.mode === 'score';
  }
  private resize(): void {
    const width = Math.max(1, this.host.clientWidth); const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  }
  async frame(time: number): Promise<FrameInfo> {
    const frame = frameAt(this.settings, this.music, time);
    if (this.weave) {
      this.weave.frame(time, frame.audibleTrackIds);
      if (!this.manualOrbit) {
        const azimuth = THREE.MathUtils.degToRad(this.settings.camera.azimuth); const elevation = THREE.MathUtils.degToRad(this.settings.camera.elevation);
        const distance = this.settings.camera.distance; const focus = this.weave.focus();
        this.controls.target.copy(focus);
        this.camera.position.copy(focus).add(new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(azimuth) * Math.cos(elevation) * distance));
        this.controls.update();
      }
    }
    this.theatre?.frame(time, frame.energy, this.camera);
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
  if (!sceneId) { element('title').textContent = '先开一场音乐实验'; element('description').textContent = '运行 demo，或让 MCP 导入 MIDI / 音频并创建场景。'; return; }
  select.value = sceneId; select.onchange = () => { location.href = `/?scene=${select.value}`; };
  const snapshot = parameters.get('snapshot');
  const raw: unknown = await request(`/api/scene/${sceneId}${snapshot ? `?snapshot=${snapshot}` : ''}`);
  if (typeof raw !== 'object' || !raw || !('scene' in raw) || !('music' in raw)) throw new Error('场景数据不完整。');
  let scene = sceneSchema.parse(raw.scene); const music = musicSchema.parse(raw.music);
  const visual = await Visualizer.create(scene, music, element('stage'));
  const player = new Player(music);
  window.addEventListener('pagehide', () => player.stop());
  let forcedTime: number | undefined;
  let lastFrame: FrameInfo = { ...frameAt(scene, music, 0), backend: visual.backend };
  let rendering = false;
  let ending = false;
  const seek = element<HTMLInputElement>('seek'); seek.max = String(music.duration);
  element('duration').textContent = clockText(music.duration);
  element('mode-label').textContent = scene.mode === 'score' ? '01 / PHRASE KNOT' : '02 / LIGHT THEATRE';
  element('description').textContent = scene.mode === 'score' ? '把一段音乐折成一个结。环绕光带，听一条声部进入、让位，再从另一处归来。' : '穿过丝绸与黄铜，走进音乐指挥的剧场。段落改变镜头，声音点亮舞台。';
  element('track-count').textContent = String(music.tracks.length);
  element('active-unit').textContent = scene.mode === 'score' ? 'ACTIVE NOTES' : 'SIGNAL / 100';
  element('score-controls').hidden = scene.mode !== 'score'; element('photo-controls').hidden = scene.mode !== 'photo';
  element('depth-source').textContent = scene.depthSource === 'layers' ? '背景、黄铜拱门与丝绸是独立透明图层，分布在三个深度。' : scene.depthSource === 'provided' ? '使用导入的深度图：白色近，黑色远。' : '采用手工纵向深度。';
  const drawControls = () => {
    element('title').textContent = scene.title; element('capture-title').textContent = scene.title;
    element('capture-tracks').textContent = music.tracks.filter(track => !scene.transport.soloTrackIds.length || scene.transport.soloTrackIds.includes(track.id)).map(track => track.name).join(' · ');
    element('tracks').innerHTML = music.tracks.map((track, index) => `<div class="track"><i class="dot" style="background:${scene.colors[index % scene.colors.length]}"></i><div class="track-info"><strong>${escape(track.name)}</strong><small>${track.notes.length ? `${track.notes.length} 个音符 · 合成试听` : '音频原曲'}</small></div><button class="solo ${scene.transport.soloTrackIds.includes(track.id) ? 'selected' : ''}" data-track="${escape(track.id)}" aria-label="独听 ${escape(track.name)}">独听</button></div>`).join('');
    for (const button of element('tracks').querySelectorAll<HTMLButtonElement>('button')) button.onclick = () => { void setTransport({ soloTrackIds: scene.transport.soloTrackIds.length === 1 && scene.transport.soloTrackIds[0] === button.dataset.track ? [] : [button.dataset.track ?? ''] }).catch(error => message(String(error))); };
    element<HTMLInputElement>('depth').value = String(scene.photo.depthStrength); element<HTMLInputElement>('travel').value = String(scene.photo.cameraTravel);
    element('cues').innerHTML = scene.cues.map((cue, index) => `<button data-cue="${index}">${clockText(cue.time)} / ${escape(cue.label)}</button>`).join('');
    for (const button of element('cues').querySelectorAll<HTMLButtonElement>('button')) button.onclick = () => { const cue = scene.cues[Number(button.dataset.cue)]; if (cue) void setTransport({ time: Math.min(cue.time, music.duration), playing: false }).catch(error => message(String(error))); };
  };
  const apply = (next: MusicScene) => {
    const transportChanged = JSON.stringify(next.transport) !== JSON.stringify(scene.transport);
    scene = next; forcedTime = undefined; visual.update(scene); if (transportChanged) player.sync(scene); drawControls();
  };
  async function setTransport(input: Record<string, unknown>): Promise<void> { apply(sceneSchema.parse(await request('/api/transport', { sceneId, ...input }))); }
  async function patch(input: Record<string, unknown>): Promise<void> { apply(sceneSchema.parse(await request('/api/update', { sceneId, expectedRevision: scene.revision, ...input }))); message('调整已保存。'); }
  visual.onCameraChange = camera => { void patch({ camera }).catch(error => message(String(error))); };
  drawControls();
  for (const bar of music.bars.slice(0, 64)) {
    const button = document.createElement('button'); button.textContent = String(bar.number); button.dataset.bar = String(bar.number); button.setAttribute('aria-label', `第 ${bar.number} 小节`);
    button.onclick = () => { void setTransport({ bar: bar.number, playing: false }).catch(error => message(String(error))); }; element('bars').append(button);
  }
  element('repeats').innerHTML = music.repeats.slice(0, 5).map(pattern => `<p>${escape(music.tracks.find(track => track.id === pattern.trackId)?.name ?? '')}：第 ${pattern.bars.join('、')} 小节重复</p>`).join('');
  element('follow').onclick = () => visual.follow();
  element('model').onclick = () => { void (async () => {
    const data = await visual.model(); const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
    const link = document.createElement('a'); link.href = url; link.download = 'phrase-knot.glb'; link.click(); URL.revokeObjectURL(url);
    message('三维模型已保存，可在 Blender 中继续编辑。');
  })().catch(error => message(String(error))); };
  element('all-tracks').onclick = () => { void setTransport({ soloTrackIds: [] }).catch(error => message(String(error))); };
  element('play').onclick = () => { void (async () => {
    const needsAudio = player.state() !== 'running';
    await player.enable();
    const time = player.time(scene);
    if (needsAudio && scene.transport.playing && time < music.duration) { player.sync(scene); return; }
    await setTransport({ time: time >= music.duration ? 0 : time, playing: !scene.transport.playing || time >= music.duration });
  })().catch(error => message(String(error))); };
  seek.oninput = () => { forcedTime = Number(seek.value); };
  seek.onchange = () => { void setTransport({ time: Number(seek.value) }).catch(error => message(String(error))); };
  element<HTMLInputElement>('depth').onchange = event => { void patch({ photo: { depthStrength: Number((event.target as HTMLInputElement).value) } }).catch(error => message(String(error))); };
  element<HTMLInputElement>('travel').onchange = event => { void patch({ photo: { cameraTravel: Number((event.target as HTMLInputElement).value) } }).catch(error => message(String(error))); };
  element('save').onclick = () => {
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `music-scene-${sceneId}.json`; link.click(); URL.revokeObjectURL(url);
    message('配置已保存。原始素材保留在本地音乐库。');
  };
  element('export').onclick = () => { void (async () => {
    const button = element<HTMLButtonElement>('export'); button.disabled = true; message('正在逐帧生成带声音的短片…');
    try {
      const start = Math.min(player.time(scene), Math.max(0, music.duration - 4));
      const result = await request('/api/export', { sceneId, start, duration: Math.min(4, music.duration), fps: 24, width: 960 });
      message(typeof result === 'object' && result && 'path' in result ? `已保存：${String(result.path)}` : '导出完成。');
    } finally { button.disabled = false; }
  })().catch(error => message(String(error))); };
  const render = async (time: number): Promise<FrameInfo> => {
    const frame = await visual.frame(time); lastFrame = frame;
    element('chapter').textContent = cueAt(scene, time).label;
    element('active-count').textContent = String(scene.mode === 'score' ? frame.activeNotes : Math.round(frame.energy * 100)).padStart(2, '0');
    element('time').textContent = clockText(time); seek.value = String(time);
    const playLabel = scene.transport.playing && time < music.duration ? player.state() === 'running' ? '暂停' : '启用声音' : '播放';
    element('play').textContent = playLabel;
    element('play').setAttribute('aria-label', playLabel === '启用声音' ? playLabel : `${playLabel}音乐`);
    const bar = music.bars.findLast(bar => bar.time <= time); element('bar-label').textContent = bar ? `第 ${bar.number} 小节` : '';
    for (const button of element('bars').querySelectorAll<HTMLButtonElement>('button')) button.classList.toggle('active', button.dataset.bar === String(bar?.number));
    element('meter').style.height = `${Math.max(1, player.meter() * 100)}%`;
    return frame;
  };
  await render(0);
  window.musicSpace = {
    frame: async time => { forcedTime = time; return await render(time); },
    model: async () => {
      const bytes = new Uint8Array(await visual.model()); let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    },
    snapshot: () => ({ ...lastFrame, audioState: player.state(), meter: player.meter() }),
  };
  if (!capture) {
    const animate = () => {
      requestAnimationFrame(animate);
      if (rendering) return;
      rendering = true;
      const time = forcedTime ?? player.time(scene);
      void render(time).catch(error => message(String(error))).finally(() => { rendering = false; });
      if (scene.transport.playing && time >= music.duration && !ending) {
        ending = true; void setTransport({ time: music.duration, playing: false }).finally(() => { ending = false; });
      }
    };
    requestAnimationFrame(animate);
    setInterval(() => { void (async () => {
      const next = sceneSchema.parse(await request(`/api/state/${sceneId}`));
      if (next.revision !== scene.revision) apply(next);
    })().catch(error => message(String(error))); }, 500);
  }
}
void main().catch(error => { message(error instanceof Error ? error.message : String(error)); element('title').textContent = '场景暂时无法打开'; });
