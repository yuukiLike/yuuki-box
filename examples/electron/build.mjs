import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Parse main-process sources without executing Electron or scene workloads.
for (const file of ['main.cjs', 'preload.cjs', 'runtime-client.cjs', 'scene-controller.cjs', 'scene-worker.cjs', 'scene-work.cjs', 'scene-fingerprint.cjs']) {
  execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
}
await mkdir(join(root, 'dist'), { recursive: true });
await build({ entryPoints: [join(root, 'renderer.jsx')], bundle: true, outfile: join(root, 'dist', 'renderer.js'), platform: 'browser', minify: true, alias: { react: join(root, 'node_modules/react'), 'react-dom': join(root, 'node_modules/react-dom') }, nodePaths: [join(root, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' } });
await cp(join(root, 'index.html'), join(root, 'dist', 'index.html'));
if (process.argv.includes('--renderer-only')) { console.log('Built Electron renderer only.'); process.exit(0); }
const native = join(root, '..', 'shared', 'native', 'build', 'NativeCapabilities.app');
const runtime = join(root, '..', 'shared', 'runtime', 'build', 'AgentRuntime.app');
try { await access(join(native, 'Contents', 'MacOS', 'native-capabilities')); }
catch { throw new Error('Build examples/shared/native/build.sh first. Renderer bundle was generated.'); }
if (process.platform !== 'darwin') throw new Error('This packaging example targets macOS.');
const electronBinary = require('electron');
const electronApp = dirname(dirname(dirname(electronBinary)));
const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
const output = join(root, 'build', `YuukiElectron-${timestamp}.app`);
await mkdir(dirname(output), { recursive: true });
await cp(electronApp, output, { recursive: true, verbatimSymlinks: true });
const contents = join(output, 'Contents');
const resources = join(contents, 'Resources');
const code = join(resources, 'app');
await mkdir(code, { recursive: true });
for (const file of ['main.cjs', 'preload.cjs', 'runtime-client.cjs', 'scene-controller.cjs', 'scene-worker.cjs', 'scene-work.cjs', 'scene-fingerprint.cjs']) await cp(join(root, file), join(code, file));
await cp(join(root, 'dist'), join(code, 'dist'), { recursive: true });
await writeFile(join(code, 'package.json'), JSON.stringify({ name: 'yuuki-electron-example', version: '0.1.0', main: 'main.cjs' }, null, 2));
await cp(join(root, '..', 'shared', 'fixtures'), join(resources, 'fixtures'), { recursive: true });
await cp(native, join(resources, 'NativeCapabilities.app'), { recursive: true });
await cp(runtime, join(resources, 'AgentRuntime.app'), { recursive: true });
const plist = join(contents, 'Info.plist');
const set = (key, type, value) => {
  try { execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], { stdio: 'pipe' }); }
  catch { execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} ${type} ${value}`, plist], { stdio: 'pipe' }); }
};
set('CFBundleIdentifier', 'string', 'dev.yuuki.examples.electron');
set('CFBundleName', 'string', 'YuukiElectron');
set('CFBundleDisplayName', 'string', 'Yuuki · Electron');
set('CFBundleShortVersionString', 'string', '0.1.0');
set('CFBundleVersion', 'string', '1');
set('NSMicrophoneUsageDescription', 'string', 'Only records when you click Start Speech in the local example.');
set('NSSpeechRecognitionUsageDescription', 'string', 'Transcribes your speech for the local architecture experiment.');
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', output], { stdio: 'inherit' });
await writeFile(join(root, 'build', 'latest-path.txt'), `${output}\n`);
console.log(`Built ${output}\nNo GUI, speech permission, or update installation was exercised.`);
