const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');

const keysWithin = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
const string = (value, max = 4096, empty = false) => typeof value === 'string' && (empty || value.length > 0) && Buffer.byteLength(value) <= max && !value.includes('\0');
function valid(command) {
  if (!keysWithin(command, ['op', 'settings', 'apiKey', 'clearAPIKey', 'sessionId', 'text', 'approvalId', 'allow'])) return false;
  const exact = allowed => keysWithin(command, ['op', ...allowed]) && Object.keys(command).length === allowed.length + 1;
  switch (command.op) {
    case 'bootstrap': case 'session.new': case 'session.export': case 'run.cancel': return exact([]);
    case 'session.select': return exact(['sessionId']) && string(command.sessionId, 128);
    case 'run.start': return exact(['text']) && string(command.text, 32000);
    case 'approval.respond': return exact(['approvalId', 'allow']) && string(command.approvalId, 128) && typeof command.allow === 'boolean';
    case 'settings.save': {
      if (!keysWithin(command, ['op', 'settings', 'apiKey', 'clearAPIKey'])) return false;
      if (command.apiKey !== undefined && !string(command.apiKey, 8192, true)) return false;
      if (command.clearAPIKey !== undefined && typeof command.clearAPIKey !== 'boolean') return false;
      if (command.settings !== undefined) {
        if (!keysWithin(command.settings, ['apiBase', 'model', 'maxOutputTokens', 'maxRounds', 'workspace', 'speechBackend', 'whisperCLI', 'whisperModel'])) return false;
        for (const [key, value] of Object.entries(command.settings)) {
          if (key === 'maxOutputTokens' || key === 'maxRounds') { if (!Number.isSafeInteger(value) || value < 1) return false; }
          else if (!string(value, 4096, true)) return false;
        }
      }
      return true;
    }
    default: return false;
  }
}

class RuntimeClient {
  constructor(executable, onEvent) { this.executable = executable; this.onEvent = onEvent; this.process = null; this.buffer = ''; this.stopping = false; this.settings = {}; }
  error(message) { this.onEvent({ type: 'error', message }); }
  start() {
    if (this.process) return;
    if (!existsSync(this.executable)) { this.error('Agent runtime 缺失，请重新构建应用。'); return; }
    const child = spawn(this.executable, ['serve', '--route', 'electron'], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.process = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      this.buffer += chunk;
      while (this.buffer.includes('\n')) {
        const end = this.buffer.indexOf('\n');
        const line = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 1);
        try {
          if (Buffer.byteLength(line) > 2_097_152) throw new Error();
          const event = JSON.parse(line);
          if (!['state', 'delta', 'error', 'export'].includes(event.type)) throw new Error();
          if (event.type === 'state') this.settings = event.state.settings || {};
          this.onEvent(event);
        } catch { this.error('Agent runtime 返回无效响应。'); this.shutdown(); return; }
      }
      if (Buffer.byteLength(this.buffer) > 2_097_152) { this.error('Agent runtime 响应超过 2 MiB。'); this.shutdown(); }
    });
    child.stdin.on('error', () => { if (!this.stopping) this.error('Agent runtime 输入连接已中断。'); });
    child.on('error', () => this.error('Agent runtime 启动失败。'));
    child.on('close', code => { if (this.process === child) this.process = null; if (!this.stopping) this.error(`Agent runtime 已退出 (${code})，请重新打开应用。`); });
  }
  send(command) {
    if (!valid(command)) throw new Error('无效的 Agent 操作或参数。');
    const line = JSON.stringify(command);
    if (Buffer.byteLength(line) > 131072) throw new Error('Agent 操作超过长度限制。');
    if (!this.process || this.process.exitCode !== null || this.process.stdin.destroyed) throw new Error('Agent runtime 未连接。');
    this.process.stdin.write(line + '\n');
    return { submitted: true };
  }
  shutdown() {
    this.stopping = true;
    if (this.process && !this.process.stdin.destroyed && !this.process.stdin.writableEnded) this.process.stdin.end('{"op":"run.cancel"}\n');
  }
}
module.exports = { RuntimeClient };
