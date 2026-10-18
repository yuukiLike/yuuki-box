// 对应的 WAT：
// (module (func (export "add") (param i32 i32) (result i32)
//   local.get 0 local.get 1 i32.add))
// 这是一个完整的小模块，无需下载编译器或模型。
const bytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
]);

export async function createAdder() {
  const { instance } = await WebAssembly.instantiate(bytes);
  const add = instance.exports.add;
  if (typeof add !== 'function') throw new Error('Wasm 模块没有导出 add。');
  return (/** @type {number} */ a, /** @type {number} */ b) => {
    for (const value of [a, b]) {
      if (!Number.isInteger(value) || value < -(2 ** 31) || value > 2 ** 31 - 1) {
        throw new RangeError('请输入 32 位有符号整数。');
      }
    }
    return /** @type {number} */ (add(a, b));
  };
}
