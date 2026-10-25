import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

// 原创合成语料。整句分开训练和验证；两边有意共享短片段。
export function createCorpus() {
  const subjects = [
    ['小猫', ['吃鱼', '喝水', '在睡', '看月']],
    ['小鸟', ['吃虫', '喝水', '在飞', '看云']],
    ['小狗', ['吃肉', '喝水', '在跑', '看门']],
  ];
  const prefixes = ['', '今天', '我看见'];
  const train = [];
  const validation = [];
  for (const [subjectIndex, [subject, actions]] of subjects.entries()) {
    for (const [actionIndex, action] of actions.entries()) {
      for (const [prefixIndex, prefix] of prefixes.entries()) {
        const sentence = `${prefix}${subject}${action}。`;
        const destination = (subjectIndex + actionIndex + prefixIndex) % 4 === 0 ? validation : train;
        destination.push(sentence);
      }
    }
  }
  return { train, validation };
}

export function createModel(sentences, context) {
  if (![1, 2].includes(context)) throw new Error('context 只能是 1 或 2。');
  const vocabulary = ['<边界>', ...new Set(sentences.flatMap((sentence) => Array.from(sentence)))];
  const rowCount = vocabulary.length ** context;
  return {
    context,
    vocabulary,
    // 每种上下文对应一行可训练分数，初始全为 0，所以初始概率相同。
    weights: Array.from({ length: rowCount }, () => Array(vocabulary.length).fill(0)),
  };
}

export function encode(model, text) {
  return Array.from(text, (character) => {
    const id = model.vocabulary.indexOf(character);
    if (id < 0) throw new Error(`词表里没有字符：${character}`);
    return id;
  });
}

export function contextRow(model, history) {
  return Array(model.context).fill(0).concat(history).slice(-model.context)
    .reduce((row, id) => row * model.vocabulary.length + id, 0);
}

export function createExamples(model, sentences) {
  return sentences.flatMap((sentence) => {
    const history = [];
    return [...encode(model, sentence), 0].map((target) => {
      const example = { row: contextRow(model, history), target };
      history.push(target);
      return example;
    });
  });
}

export function softmax(scores) {
  const maximum = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maximum));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

export function loss(model, examples) {
  return examples.reduce((sum, { row, target }) => {
    const probabilities = softmax(model.weights[row]);
    return sum - Math.log(Math.max(probabilities[target], Number.MIN_VALUE));
  }, 0) / examples.length;
}

export function trainStep(model, { row, target }, rate) {
  const probabilities = softmax(model.weights[row]);
  for (let id = 0; id < probabilities.length; id += 1) {
    // softmax + 交叉熵对每个分数的导数：预测概率 - 正确答案指示值。
    const gradient = probabilities[id] - Number(id === target);
    model.weights[row][id] -= rate * gradient;
  }
}

export function randomGenerator(seed = 42) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export function generate(model, prefix, random = randomGenerator(), limit = 50) {
  const history = encode(model, prefix);
  let text = prefix;
  for (let index = 0; index < limit; index += 1) {
    const probabilities = softmax(model.weights[contextRow(model, history)]);
    let draw = random();
    let next = probabilities.length - 1;
    for (const [id, probability] of probabilities.entries()) {
      draw -= probability;
      if (draw < 0) { next = id; break; }
    }
    if (next === 0) break;
    history.push(next);
    text += model.vocabulary[next];
  }
  return text;
}

function checkSavedModel(model) {
  if (!model || ![1, 2].includes(model.context) || !Array.isArray(model.vocabulary)
    || model.vocabulary[0] !== '<边界>' || model.vocabulary.length > 100
    || !model.vocabulary.every((token) => typeof token === 'string')
    || new Set(model.vocabulary).size !== model.vocabulary.length
    || !Array.isArray(model.weights) || model.weights.length !== model.vocabulary.length ** model.context
    || !model.weights.every((row) => Array.isArray(row) && row.length === model.vocabulary.length
      && row.every(Number.isFinite))) throw new Error('模型文件的词表或参数格式不正确。');
  return model;
}

function main() {
  const { values } = parseArgs({ options: {
    context: { type: 'string', default: '1' },
    epochs: { type: 'string' },
    rate: { type: 'string', default: '0.15' },
    save: { type: 'string' },
    load: { type: 'string' },
  } });
  if (values.load && (values.epochs || values.save)) throw new Error('--load 用于单独加载生成，请与训练、保存命令分开。');
  const epochs = Number(values.epochs ?? (values.load ? 0 : 120));
  const rate = Number(values.rate);
  if (!Number.isInteger(epochs) || epochs < 0 || epochs > 2000) throw new Error('epochs 应为 0 到 2000 的整数。');
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) throw new Error('rate 应大于 0 且不超过 1。');

  const corpus = createCorpus();
  const model = values.load
    ? checkSavedModel(JSON.parse(readFileSync(values.load, 'utf8')))
    : createModel(corpus.train, Number(values.context));
  const train = createExamples(model, corpus.train);
  const validation = createExamples(model, corpus.validation);
  console.log(`上下文 ${model.context} 字；词表 ${model.vocabulary.length}；参数 ${model.weights.length * model.vocabulary.length}`);
  console.log(`训练 ${corpus.train.length} 句；验证 ${corpus.validation.length} 句；每轮 ${train.length} 次更新`);
  const report = (epoch) => console.log(`epoch ${epoch}: train=${loss(model, train).toFixed(4)}, validation=${loss(model, validation).toFixed(4)}`);
  report(0);
  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    for (const example of train) trainStep(model, example, rate);
    if (epoch % 30 === 0 || epoch === epochs) report(epoch);
  }

  for (const prefix of ['小猫吃', '小鸟吃', '小狗吃']) {
    const probabilities = softmax(model.weights[contextRow(model, encode(model, prefix))]);
    const top = probabilities.map((probability, id) => [model.vocabulary[id], probability])
      .sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(`${prefix} → ${top.map(([token, p]) => `${token} ${(p * 100).toFixed(1)}%`).join('，')}`);
  }
  const random = randomGenerator();
  for (let index = 0; index < 4; index += 1) console.log(`生成：${generate(model, '小', random)}`);
  if (values.save) {
    writeFileSync(values.save, JSON.stringify(model), { flag: 'wx' });
    console.log(`已保存到 ${values.save}；已有文件会拒绝覆盖。`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
