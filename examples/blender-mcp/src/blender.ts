import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { modelInfoSchema, type ModelInfo, type ModelInput } from './contracts.js';

const executeFile = promisify(execFile);
const macBlender = '/Applications/Blender.app/Contents/MacOS/Blender';

type BlenderJob =
  | { action: 'create'; directory: string; design: ModelInput }
  | { action: 'inspect' | 'export'; directory: string };

export async function runBlender(job: BlenderJob, signal: AbortSignal): Promise<ModelInfo> {
  const binary = process.env.BLENDER_BIN ?? (existsSync(macBlender) ? macBlender : 'blender');
  // 从编译后的 dist/src/blender.js 定位仓库里的 Python 执行器。
  const worker = fileURLToPath(new URL('../../worker.py', import.meta.url));
  const temporary = await mkdtemp(join(tmpdir(), 'yuuki-blender-job-'));
  const requestPath = join(temporary, 'request.json');
  const responsePath = join(temporary, 'response.json');
  try {
    await writeFile(requestPath, JSON.stringify(job), { mode: 0o600 });
    await executeFile(binary, [
      '--background', '--factory-startup', '--disable-autoexec', '--threads', '2',
      '--python-exit-code', '1', '--python', worker, '--', requestPath, responsePath,
    ], { signal, timeout: 90_000, killSignal: 'SIGKILL', maxBuffer: 512 * 1024 });
    const response: unknown = JSON.parse(await readFile(responsePath, 'utf8'));
    const failure = z.strictObject({ error: z.string() }).safeParse(response);
    if (failure.success) throw new Error(failure.data.error);
    return modelInfoSchema.parse(response);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
