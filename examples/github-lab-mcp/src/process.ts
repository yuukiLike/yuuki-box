import { spawn } from 'node:child_process';

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  termination: 'timeout' | 'cancelled' | 'output_limit' | null;
}

// 不继承 token、NODE_OPTIONS、SSH 配置等；检查进程与 Git 都使用明确环境。
export function processEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LANG: 'C.UTF-8', TZ: 'UTC', NO_COLOR: '1',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '/usr/bin/false',
    GIT_LFS_SKIP_SMUDGE: '1',
  };
}

export async function runProcess(command: string, args: string[], options: {
  cwd: string;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  maxOutputBytes?: number;
}): Promise<ProcessResult> {
  options.signal?.throwIfAborted();
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd, env: processEnvironment(), stdio: ['ignore', 'pipe', 'pipe'], shell: false,
      detached: process.platform !== 'win32',
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let termination: ProcessResult['termination'] = null;
    const stop = (reason: NonNullable<ProcessResult['termination']>) => {
      if (termination !== null) return;
      termination = reason;
      // Git 会启动 HTTPS helper；在 macOS/POSIX 上连同进程组一起停止。
      if (process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    };
    const capture = (chunks: Buffer[], value: Buffer) => {
      const remaining = (options.maxOutputBytes ?? 262_144) - bytes;
      if (remaining > 0) chunks.push(value.subarray(0, remaining));
      bytes += value.length;
      if (bytes > (options.maxOutputBytes ?? 262_144)) stop('output_limit');
    };
    child.stdout.on('data', (value: Buffer) => capture(stdout, value));
    child.stderr.on('data', (value: Buffer) => capture(stderr, value));
    const onAbort = () => stop('cancelled');
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs ?? 45_000);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', exitCode => {
      cleanup();
      resolve({ exitCode, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'), termination });
    });
  });
}

export async function git(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
  const result = await runProcess('git', [
    '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-c', 'credential.helper=', '-c', 'submodule.recurse=false',
    '-c', 'init.templateDir=', ...args,
  ], { cwd, signal });
  if (result.termination || result.exitCode !== 0) {
    throw new Error(`Git ${result.termination ?? `退出码 ${result.exitCode}`}：${result.stderr.slice(0, 1500)}`);
  }
  return result.stdout;
}
