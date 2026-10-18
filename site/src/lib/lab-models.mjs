/** @param {{sequences: number, layers: number, tokens: number, kvHeads: number, headDim: number, bytesPerElement: number}} parameters */
export function kvBytes(parameters) {
  if (Object.values(parameters).some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new RangeError('缓存参数必须是正整数。');
  }
  const { sequences, layers, tokens, kvHeads, headDim, bytesPerElement } = parameters;
  const bytes = 2 * sequences * layers * tokens * kvHeads * headDim * bytesPerElement;
  if (!Number.isSafeInteger(bytes)) throw new RangeError('计算结果超出精确整数范围。');
  return bytes;
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  const number = (/** @type {number} */ value) => Number(value.toFixed(2)).toLocaleString('en-US');
  if (bytes >= 1024 ** 3) return `${number(bytes / 1024 ** 3)} GiB`;
  if (bytes >= 1024 ** 2) return `${number(bytes / 1024 ** 2)} MiB`;
  if (bytes >= 1024) return `${number(bytes / 1024)} KiB`;
  return `${bytes} B`;
}

/** @param {number} count @param {number} target */
export function compareLookup(count, target) {
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new RangeError('数据量需为 1 到 10000。');
  if (!Number.isInteger(target) || target < 1 || target > count) throw new RangeError('目标 ID 需位于数据范围内。');
  const rows = Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `消息 ${index + 1}` }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  let comparisons = 0;
  const arrayResult = rows.find((row) => { comparisons += 1; return row.id === target; });
  const mapResult = byId.get(target);
  return { comparisons, indexEntries: byId.size, sameResult: arrayResult === mapResult, name: mapResult?.name };
}
