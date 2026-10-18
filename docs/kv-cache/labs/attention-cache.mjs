import assert from 'node:assert/strict';

// 教学模型：两层、单头、二维向量，保留因果 Attention、残差与位置输入。
// 使用固定权重，不含训练、分词器、LayerNorm、MLP、输出词表或采样。
const embeddings = {
  A: [1, 0.2], B: [0.1, 1], C: [0.7, -0.4],
  D: [-0.2, 0.9], X: [1.1, 0.6],
};
const layers = [
  {
    q: [[0.8, 0.2], [-0.3, 0.9]],
    k: [[0.6, -0.4], [0.5, 0.7]],
    v: [[1, 0.1], [-0.2, 0.8]],
  },
  {
    q: [[0.7, -0.1], [0.3, 0.9]],
    k: [[0.9, 0.2], [-0.4, 0.6]],
    v: [[0.5, 0.3], [-0.1, 1.1]],
  },
];

const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const project = (input, matrix) => matrix.map((row) => dot(row, input));
const add = (a, b) => a.map((value, index) => value + b[index]);
const counters = () => ({ kvPairs: 0, scorePairs: 0 });
const makeCache = () => ({
  tokens: [],
  layers: layers.map(() => ({ keys: [], values: [] })),
});

function embed(token, position) {
  assert.ok(embeddings[token], `未知的实验 token：${token}`);
  return add(embeddings[token], [position * 0.03, position * -0.02]);
}

function attend(query, keys, values, stats) {
  stats.scorePairs += keys.length;
  const scores = keys.map((key) => dot(query, key) / Math.sqrt(query.length));
  const maximum = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maximum));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return query.map((_, dimension) =>
    values.reduce((sum, value, index) => sum + (exps[index] / total) * value[dimension], 0),
  );
}

// 基线：每一层先投影整个输入序列，再为每个位置计算因果 Attention。
function fullForward(tokens) {
  let hidden = tokens.map(embed);
  const stats = counters();
  const savedLayers = [];
  for (const weights of layers) {
    const queries = hidden.map((input) => project(input, weights.q));
    const keys = hidden.map((input) => project(input, weights.k));
    const values = hidden.map((input) => project(input, weights.v));
    stats.kvPairs += tokens.length;
    savedLayers.push({ keys, values });
    hidden = hidden.map((input, index) => add(input, attend(
      queries[index], keys.slice(0, index + 1), values.slice(0, index + 1), stats,
    )));
  }
  return { output: hidden.at(-1), layers: savedLayers, stats };
}

// 增量路径：只投影新 token；当前 Q 仍然要读取当前层的全部 K/V。
function appendToken(cache, token, stats) {
  let hidden = embed(token, cache.tokens.length);
  for (const [index, weights] of layers.entries()) {
    const query = project(hidden, weights.q);
    const stored = cache.layers[index];
    stored.keys.push(project(hidden, weights.k));
    stored.values.push(project(hidden, weights.v));
    stats.kvPairs += 1;
    hidden = add(hidden, attend(query, stored.keys, stored.values, stats));
  }
  cache.tokens.push(token);
  return hidden;
}

const maximumError = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index])));
function checkResult(cache, output, reference) {
  assert.ok(maximumError(output, reference.output) < 1e-12, '输出与从头计算不一致');
  for (const [layerIndex, stored] of cache.layers.entries()) {
    for (const kind of ['keys', 'values']) {
      assert.equal(stored[kind].length, cache.tokens.length);
      for (const [position, vector] of stored[kind].entries()) {
        assert.ok(maximumError(vector, reference.layers[layerIndex][kind][position]) < 1e-12);
      }
    }
  }
}

const cache = makeCache();
const rows = [];
function compare(label, suffix) {
  const stats = counters();
  let output;
  for (const token of suffix) {
    output = appendToken(cache, token, stats);
    checkResult(cache, output, fullForward(cache.tokens));
  }
  const reference = fullForward(cache.tokens);
  rows.push({
    场景: label,
    序列: cache.tokens.join(' '),
    '从头算 K/V 组': reference.stats.kvPairs,
    '缓存路径新算 K/V 组': stats.kvPairs,
    '从头算 QK 点积': reference.stats.scorePairs,
    '缓存路径 QK 点积': stats.scorePairs,
    最大输出误差: maximumError(output, reference.output),
  });
}

// 为了观察缓存填充，本实验按 token 顺序执行首次输入；真实 Prefill 可并行。
compare('首次输入 A B C', ['A', 'B', 'C']);
compare('处理新 token D', ['D']);

const oldKeyForC = [...cache.layers[1].keys[2]];

// 把 B 改成 X，只保留共同前缀 A。每一层都必须截断。
cache.tokens.length = 1;
for (const stored of cache.layers) {
  stored.keys.length = 1;
  stored.values.length = 1;
}
compare('B 改成 X 后重算后缀', ['X', 'C', 'D']);
assert.ok(maximumError(oldKeyForC, cache.layers[1].keys[2]) > 1e-8);

console.table(rows);
console.log('每步输出和每层 K/V 均与从头计算一致，误差小于 1e-12。');
console.log('C 的 token 和位置相同，但前缀改变使第 2 层的 K 改变。');
console.log('K/V 组按「一个位置 × 一层」计数；QK 点积按查询与键的配对计数。');
