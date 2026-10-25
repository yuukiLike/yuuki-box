import { pathToFileURL } from 'node:url';

// 独立进程只负责执行一份默认导出的断言函数。校验/超时/保存由父进程负责。
const [, , testPath, target] = process.argv;
try {
  if (!testPath || !target) throw new Error('缺少检查脚本或目标目录。');
  const module: unknown = await import(pathToFileURL(testPath).href);
  if (typeof module !== 'object' || module === null || !('default' in module) || typeof module.default !== 'function') {
    throw new Error('检查脚本必须默认导出 function(target: string)。');
  }
  await Reflect.apply(module.default, undefined, [target]);
  console.log('YUUKI_CHECK ' + JSON.stringify({ outcome: 'passed', detail: '断言函数正常完成。' }));
} catch (error) {
  const assertion = error instanceof Error && 'code' in error && error.code === 'ERR_ASSERTION';
  const outcome = assertion ? 'assertion_failed' : 'error';
  const detail = error instanceof Error ? error.message.slice(0, 2000) : '检查抛出了非 Error 值。';
  console.log('YUUKI_CHECK ' + JSON.stringify({ outcome, detail }));
  process.exitCode = 1;
}
