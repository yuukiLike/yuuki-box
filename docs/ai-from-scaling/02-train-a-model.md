# 模型基础 2：训练一个字符语言模型

写预测、误差、更新与生成，比较一字和两字上下文。先读[模型基础 1](01-understand-models.md)，分清参数、上下文与训练。

参考实现：[tiny-model.mjs](labs/tiny-model.mjs)。Node.js ≥22.22，在仓库根目录运行；学习 50 分钟，整理休息 10 分钟。

## 前五分钟 先看训练之前

执行：

```bash
pnpm demo:tiny-model --epochs 0
```

词表 24 字，训练 27 句、验证 9 句。初始分数均为 0，字符概率为 `1/24`，训练与验证 loss 均约 `ln(24) = 3.1781`。

此时生成可能立刻停止，也可能输出杂乱字符。

跟改参考实现，或新建 `tiny-model.mjs`。按 `createCorpus → createExamples → softmax → trainStep → generate` 读写，其余先复用。

## 第五到十五分钟 把文本变成样本

`createCorpus()` 用动物、动作与前缀生成 36 句教学文本，按完整句子分成训练 27 句、验证 9 句；验证句不更新参数。

两组共享短片段，<mark class="caution">验证仅覆盖相似分布</mark>。

`encode()` 将字符编号，0 表示边界：句首补齐上下文，句末预测边界，让模型学会结束。

先写样本构造，再对照实现：

```js
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
```

先构造输入，再加入当前答案；顺序反过来会泄漏答案。

`contextRow()` 用最近一或两字选择 `weights[row]`，行内是候选字符分数；参数量分别为 `24² = 576` 和 `24³ = 13824`。

这个模型用 one-hot 上下文选分数行，再接 softmax。

## 第十五到二十五分钟 从分数走到学习

先写 softmax：减去最大值可防指数溢出，不改变概率比例。

```js
export function softmax(scores) {
  const maximum = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maximum));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}
```

再写一次参数更新：

```js
export function trainStep(model, { row, target }, rate) {
  const probabilities = softmax(model.weights[row]);
  for (let id = 0; id < probabilities.length; id += 1) {
    const gradient = probabilities[id] - Number(id === target);
    model.weights[row][id] -= rate * gradient;
  }
}
```

<details class="qa">
<summary>为什么这样更新分数？rate 和 epoch 是什么？</summary>

正确答案概率为 0.1 时，梯度为 `0.1 - 1 = -0.9`。减去它会提高正确答案分数，其他候选分数则降低。

`rate` 控制调整幅度；一个 epoch 遍历训练样本，本例固定顺序更新 207 次。

</details>

## 第二十五到三十五分钟 真正训练并检查结果

执行默认的 120 个 epoch：

```bash
pnpm demo:tiny-model --context 1
```

每 30 个 epoch 输出训练与验证 loss。Node.js 24.18.0、固定配置下：

| 配置 | 初始训练 loss | 第 120 个 epoch 训练 loss | 第 120 个 epoch 验证 loss |
| --- | --- | --- | --- |
| 看前一个字 | 3.1781 | 0.6448 | 0.6771 |
| 看前两个字 | 3.1781 | 0.4839 | 0.5023 |

先看第一行：loss 下降，但生成仍可能出现“小狗吃鱼”等句子。

两句话都只留下“吃”，取出同一行分数；重复训练也无法区分。

## 第三十五到四十五分钟 改变上下文再生成

执行：

```bash
pnpm demo:tiny-model --context 2
```

现在三种上下文对应不同分数行。固定配置下，“猫吃”后“鱼”约占 96.9%，“鸟吃”后“虫”约占 98.0%；先核对终端概率，再读生成文本。

生成循环：取上下文 → 算概率 → 抽字符 → 追加历史；遇边界结束，最多 50 字，<mark class="key">生成不调用训练</mark>。

固定种子便于对照，仍可能抽中低概率错误字符。

扩大上下文也增加了参数与训练工作。这是多个变量的对照，不是缩放定律复现。

## 最后五分钟 保存模型再加载

创建一个临时目录，在同一终端继续执行：

```bash
AI_LAB_DIR=$(mktemp -d)
pnpm demo:tiny-model --context 2 --save "$AI_LAB_DIR/model.json"
pnpm demo:tiny-model --load "$AI_LAB_DIR/model.json"
```

第二条训练并保存词表、上下文长度和分数表；第三条加载后只报告 loss、生成文本。已有文件拒绝覆盖。

打开 JSON 指出参数，再在源码中找到语料。参数支持生成，不能按原句检索训练资料。

记录三项结果：

```text
我改变了：
训练与验证结果：
模型仍然会错在：
```

推理机制可选读 [Attention 与 KV Cache](../kv-cache/README.md)；沿[四小时路线](README.md)联读，则进入 [Agent 入门：搭建 Harness](03-build-a-harness.md)。
