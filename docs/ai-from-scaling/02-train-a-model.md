# 模型基础 2：训练一个字符语言模型

亲手写出预测、误差、参数更新与生成，再比较一个字和两个字上下文。先读[模型基础 1](01-understand-models.md)，或确认自己能区分参数、上下文与训练。

参考实现：[tiny-model.mjs](labs/tiny-model.mjs)。使用 Node.js 22.22 或更高版本，所有命令在仓库根目录运行。内容用 50 分钟，留 10 分钟整理和休息。

## 前五分钟 先看训练之前

执行：

```bash
pnpm demo:tiny-model --epochs 0
```

你会看到词表大小为 24，训练集有 27 句，验证集有 9 句。初始训练与验证 loss 均约为 `3.1781`，也就是 `ln(24)`。所有字符的分数都是 0，softmax 后各占 `1/24`。

此时生成可能立刻停止，也可能输出杂乱字符。

跟改参考实现，或新建 `tiny-model.mjs`。按 `createCorpus → createExamples → softmax → trainStep → generate` 读写，其余先复用。

## 第五到十五分钟 把文本变成样本

`createCorpus()` 用“小猫、小鸟、小狗”、各自的动作，以及“今天、我看见”等前缀生成 36 句原创教学文本。按完整句子分出 27 句训练、9 句验证，验证句不参与参数更新。

两组共享许多短片段，验证只覆盖相似分布，不能说明理解了陌生题材。

每个字符对应一个编号，编号 0 是句子边界。`encode()` 把文本转成编号；每句开始时用边界补齐上下文，句末再预测一次边界，模型就有机会学会结束。

先亲手写这段样本构造，再与参考实现对照：

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

`contextRow()` 把最近一个或两个字符的编号映射为行号；`weights[row]` 保存这一种上下文对全部候选字符的分数。一个字上下文需要 `24 × 24 = 576` 个参数，两个字需要 `24 × 24 × 24 = 13824` 个参数。

这个模型用 one-hot 上下文选分数行，再接 softmax。

## 第十五到二十五分钟 从分数走到学习

先写 softmax。减去最大值不改变结果比例，可以避免大分数直接取指数时溢出。

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

`rate` 是学习率，控制调整幅度。一个 epoch 遍历全部训练样本；本例按固定顺序更新，每个 epoch 共 207 次。

</details>

## 第二十五到三十五分钟 真正训练并检查结果

执行默认的 120 个 epoch：

```bash
pnpm demo:tiny-model --context 1
```

参考实现会每 30 个 epoch 输出一次训练与验证 loss。在 Node.js 24.18.0 下，本课固定数据与配置得到：

| 配置 | 初始训练 loss | 第 120 个 epoch 训练 loss | 第 120 个 epoch 验证 loss |
| --- | --- | --- | --- |
| 看前一个字 | 3.1781 | 0.6448 | 0.6771 |
| 看前两个字 | 3.1781 | 0.4839 | 0.5023 |

先看第一行：loss 下降，但生成仍可能出现“小狗吃鱼”等句子。

因为“小猫吃”和“小狗吃”都只留下“吃”，模型取出同一行分数；多练同样样本也无法区分。

## 第三十五到四十五分钟 改变上下文再生成

执行：

```bash
pnpm demo:tiny-model --context 2
```

现在“猫吃”“鸟吃”“狗吃”对应不同的分数行。在固定配置下，模型给“猫吃”后的“鱼”约 96.9% 的概率，给“鸟吃”后的“虫”约 98.0% 的概率。检查终端里的实际概率，再读生成文本。

生成时程序重复做四件事：取最近的上下文，计算概率，按概率抽取一个字符，把字符追加到历史。遇到边界就结束，最多生成 50 个新字符。生成过程不调用 `trainStep()`。

固定随机种子方便对照，但仍可能抽中低概率错误字符；概率改善不保证每次正确。

扩大上下文也增加了参数与训练工作。这是多个变量的对照，不是缩放定律复现。

## 最后五分钟 保存模型再加载

创建一个临时目录，在同一终端继续执行：

```bash
AI_LAB_DIR=$(mktemp -d)
pnpm demo:tiny-model --context 2 --save "$AI_LAB_DIR/model.json"
pnpm demo:tiny-model --load "$AI_LAB_DIR/model.json"
```

第二条命令训练并保存词表、上下文长度和分数表；第三条命令加载这些参数，报告已有 loss 并生成文本，不再训练。保存采用独占创建，已有文件会被拒绝覆盖。

打开 JSON 指出参数，再在源码中找到语料。参数支持生成，不能按原句检索训练资料。

留三行笔记再休息：

```text
我改变了：
训练与验证结果：
模型仍然会错在：
```

模型基础到这里可以停。想继续研究推理，选读 [Attention 与 KV Cache](../kv-cache/README.md)；沿[四小时路线](README.md)联读，则进入 [Agent 入门：搭建 Harness](03-build-a-harness.md)。
