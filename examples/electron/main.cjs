const { app, BrowserWindow, ipcMain, session } = require('electron');
const { readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { RuntimeClient } = require('./runtime-client.cjs');
const { SceneController } = require('./scene-controller.cjs');

const version = '0.1.0';
const resources = app.isPackaged ? process.resourcesPath : join(__dirname, '..', 'shared');
const helper = app.isPackaged
  ? join(resources, 'NativeCapabilities.app', 'Contents', 'MacOS', 'native-capabilities')
  : join(resources, 'native', 'build', 'NativeCapabilities.app', 'Contents', 'MacOS', 'native-capabilities');
const documentURL = pathToFileURL(join(__dirname, 'dist', 'index.html')).href;
let window;
let timer;
let generation = 0;
let speech;
let sceneQuitPending = false;
let sceneQuitReady = false;
const runtimeExecutable = app.isPackaged
  ? join(resources, 'AgentRuntime.app', 'Contents', 'MacOS', 'agent-runtime')
  : join(resources, 'runtime', 'build', 'AgentRuntime.app', 'Contents', 'MacOS', 'agent-runtime');
const runtime = new RuntimeClient(runtimeExecutable, event => send('agent-event', event));
const scenes = new SceneController(event => send('scene-event', event));

function send(channel, value) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, value);
}

function authorize(event) {
  if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== documentURL) {
    throw new Error('Only the local main document can call this capability.');
  }
}

async function fixture() {
  const rows = JSON.parse(await readFile(join(resources, 'fixtures', 'events.json'), 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10000 || rows.some(row => !Number.isInteger(row.id) || !['message', 'tool'].includes(row.kind) || typeof row.text !== 'string')) {
    throw new Error('Invalid event fixture.');
  }
  return rows;
}

function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Version must be major.minor.patch.');
  const parts = value.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) throw new Error('Version component is too large.');
  return parts;
}

async function checkUpdate(choice) {
  const names = { available: 'update.json', current: 'update-current.json', invalid: 'update-invalid.json' };
  if (!Object.hasOwn(names, choice)) throw new Error('Unknown update fixture.');
  const bytes = await readFile(join(resources, 'fixtures', names[choice]));
  if (bytes.length > 65536) throw new Error('Update manifest exceeds 64 KiB.');
  const value = JSON.parse(bytes.toString('utf8'));
  if (value.schemaVersion !== 1 || typeof value.notes !== 'string' || value.notes.length > 10000 || typeof value.url !== 'string') throw new Error('Invalid update manifest.');
  const url = new URL(value.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Update URL must use HTTPS without credentials.');
  const current = parseVersion(version);
  const next = parseVersion(value.version);
  let newer = false;
  for (let i = 0; i < 3; i++) {
    if (next[i] === current[i]) continue;
    newer = next[i] > current[i];
    break;
  }
  return { ...value, currentVersion: version, available: newer, source: 'bundled fixture; no download or installation' };
}

function stopStream() {
  clearInterval(timer);
  timer = undefined;
}

function stopSpeech() {
  if (!speech || speech.exitCode !== null) return;
  const child = speech;
  child.stdin.write('stop\n');
  // Whisper finishes recording, then runs local inference. No stop deadline.
}

function cancelSpeech() {
  if (speech && speech.exitCode === null) speech.stdin.write('cancel\n');
}

function startSpeech(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'file') || (options.file !== undefined && (typeof options.file !== 'string' || Buffer.byteLength(options.file) > 4096 || options.file.includes('\0')))) throw new Error('Invalid speech options.');
  if (speech) throw new Error('Speech is already running or stopping.');
  if (!existsSync(helper)) throw new Error('Build the shared native helper first.');
  const backend = runtime.settings.speechBackend || 'apple';
  if (!['apple', 'whisper'].includes(backend)) throw new Error('Unknown speech backend.');
  const args = ['speech', '--locale', 'zh-CN', '--backend', backend];
  if (backend === 'whisper') args.push('--whisper-cli', runtime.settings.whisperCLI || '', '--model', runtime.settings.whisperModel || '');
  if (options.file) args.push('--file', options.file);
  const speechEnvironment = { ...process.env };
  delete speechEnvironment.DEEPSEEK_API_KEY;
  const child = spawn(helper, args, { stdio: ['pipe', 'pipe', 'pipe'], env: speechEnvironment });
  speech = child;
  let buffered = '';
  let diagnostic = '';
  let reportedError = false;
  let final = false;
  child.stdin.on('error', error => {
    if (error.code !== 'EPIPE') send('speech-event', { type: 'speech.error', code: 'stdin', message: error.message });
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffered += chunk;
    if (Buffer.byteLength(buffered) > 65536) {
      reportedError = true;
      send('speech-event', { type: 'speech.error', code: 'protocol_limit', message: 'Speech event exceeded 64 KiB.' });
      child.kill('SIGTERM');
      return;
    }
    while (buffered.includes('\n')) {
      const end = buffered.indexOf('\n');
      const line = buffered.slice(0, end);
      buffered = buffered.slice(end + 1);
      if (!line.trim()) continue;
      try {
        const value = JSON.parse(line);
        if (!['speech.state', 'speech.partial', 'speech.final', 'speech.error'].includes(value.type)) throw new Error('Unknown speech event.');
        if ((value.type === 'speech.partial' || value.type === 'speech.final') && typeof value.text !== 'string') throw new Error('Missing transcript.');
        if (value.type === 'speech.error') reportedError = true;
        if (value.type === 'speech.final') final = true;
        send('speech-event', value);
      } catch (error) {
        reportedError = true;
        send('speech-event', { type: 'speech.error', code: 'protocol', message: error.message });
        child.kill('SIGTERM');
      }
    }
  });
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-2000); });
  child.on('error', error => {
    reportedError = true;
    send('speech-event', { type: 'speech.error', code: 'spawn', message: error.message });
  });
  child.on('close', (code, signal) => {
    if (speech === child) speech = undefined;
    if (code !== 0 && !reportedError) send('speech-event', { type: 'speech.error', code: 'exit', message: diagnostic || `Helper ended: ${signal || code}` });
    send('speech-event', { type: 'speech.closed', final });
  });
  return { started: true };
}

function register(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    authorize(event);
    return fn(...args);
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, answer) => answer(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  register('fixture', () => fixture());
  register('agent-bootstrap', () => { runtime.start(); return runtime.send({ op: 'bootstrap' }); });
  register('agent-command', command => runtime.send(command));
  register('update-check', choice => checkUpdate(choice));
  register('stream-start', async () => {
    stopStream();
    const id = ++generation;
    const rows = await fixture();
    if (id !== generation) throw new Error('Stream superseded.');
    let index = 0;
    timer = setInterval(() => {
      const row = rows[index % rows.length];
      send('stream-event', { runId: id, row: { ...row, id: `stream-${id}-${index}` } });
      index++;
      if (index >= 200) { stopStream(); send('stream-event', { runId: id, done: true }); }
    }, 50);
    return id;
  });
  register('stream-stop', () => { ++generation; stopStream(); return { stopped: true }; });
  register('speech-start', options => startSpeech(options));
  register('speech-stop', () => { stopSpeech(); return { stopping: true }; });
  register('speech-cancel', () => { cancelSpeech(); return { cancelling: true }; });
  register('scene-start', options => scenes.start(options));
  register('scene-ack', options => scenes.acknowledge(options));
  register('scene-stop', runId => scenes.stop(runId));
  register('scene-ping', () => ({ received: true }));
  window = new BrowserWindow({
    width: 1100, height: 780, minWidth: 850, minHeight: 620, title: 'Yuuki Lab · Electron',
    backgroundColor: '#f4f3ef',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== documentURL) event.preventDefault(); });
  window.on('closed', () => { ++generation; stopStream(); cancelSpeech(); void scenes.close().catch(error => console.error('Scene shutdown:', error.message)); runtime.shutdown(); window = undefined; });
  window.loadURL(documentURL).catch(error => { console.error(error); app.quit(); });
});

app.on('before-quit', event => {
  if (sceneQuitReady) return;
  ++generation;
  stopStream();
  const waitForWorker = Boolean(scenes.active?.worker) || sceneQuitPending;
  const shutdown = scenes.close();
  if (waitForWorker) {
    event.preventDefault();
    if (!sceneQuitPending) {
      sceneQuitPending = true;
      shutdown.then(() => { sceneQuitReady = true; app.quit(); }, error => { console.error('Scene shutdown:', error.message); sceneQuitReady = true; app.quit(); });
    } else void shutdown.catch(error => console.error('Scene shutdown:', error.message));
  } else void shutdown.catch(error => console.error('Scene shutdown:', error.message));
  // The native helper also watches stdin EOF; SIGTERM gives explicit cleanup on quit.
  if (speech) { speech.stdin.end('cancel\n'); speech.kill('SIGTERM'); }
  runtime.shutdown();
});
app.on('window-all-closed', () => app.quit());
