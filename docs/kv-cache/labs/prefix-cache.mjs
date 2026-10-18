import assert from 'node:assert/strict';

// 前端练习：每一项保存「到这里为止的累计值」。这里还没有 Attention。
function updatePrefixCache(previous, inputs, scale) {
  let reused = 0;
  if (previous?.scale === scale) {
    while (
      reused < previous.inputs.length &&
      reused < inputs.length &&
      previous.inputs[reused] === inputs[reused]
    ) {
      reused += 1;
    }
  }

  const totals = previous?.totals.slice(0, reused) ?? [];
  let total = totals.at(-1) ?? 0;
  for (let index = reused; index < inputs.length; index += 1) {
    total += inputs[index] * scale;
    totals.push(total);
  }

  return {
    inputs: [...inputs],
    scale,
    totals,
    reused,
    computed: inputs.length - reused,
  };
}

const scenarios = [
  { label: '首次计算', inputs: [3, 5, 2], scale: 1, reused: 0 },
  { label: '末尾追加', inputs: [3, 5, 2, 4], scale: 1, reused: 3 },
  { label: '输入不变', inputs: [3, 5, 2, 4], scale: 1, reused: 4 },
  { label: '修改第 2 项', inputs: [3, 8, 2, 4], scale: 1, reused: 1 },
  { label: '截短序列', inputs: [3, 8], scale: 1, reused: 2 },
  { label: '计算配置改变', inputs: [3, 8], scale: 2, reused: 0 },
  { label: '清空', inputs: [], scale: 2, reused: 0 },
];

let cache;
const rows = [];
for (const scenario of scenarios) {
  cache = updatePrefixCache(cache, scenario.inputs, scenario.scale);

  // 独立地从头求每一项的前缀和，确认复用不会改变结果。
  const expected = scenario.inputs.map((_, index, inputs) =>
    inputs.slice(0, index + 1).reduce((sum, value) => sum + value, 0) * scenario.scale,
  );
  assert.deepEqual(cache.totals, expected);
  assert.equal(cache.reused, scenario.reused);

  rows.push({
    场景: scenario.label,
    输入: JSON.stringify(cache.inputs),
    倍率: cache.scale,
    复用项数: cache.reused,
    新算项数: cache.computed,
    累计结果: JSON.stringify(cache.totals),
  });
}

console.table(rows);
console.log('全部结果与从头计算一致。计数表示派生项数，不表示耗时。');
