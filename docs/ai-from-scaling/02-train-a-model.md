# 第二小时 训练一个小语言模型

这一小时把“预测、计算误差、更新参数、生成文本”做成可以运行的程序。先观察完全没训练的模型，再亲手写出关键函数，最后改变上下文并保存参数。

参考实现：[tiny-model.mjs](labs/tiny-model.mjs)。使用 Node.js 22.22 或更高版本，所有命令在仓库根目录运行。内容用 50 分钟，留 10 分钟整理和休息。

## 前五分钟 先看训练之前

执行：

```bash
node docs/ai-from-scaling/labs/tiny-model.mjs --epochs 0
```

你会看到词表大小为 24，训练集有 27 句，验证集有 9 句。初始训练与验证 loss 均约为 `3.1781`，也就是 `ln(24)`。所有字符的分数都是 0，softmax 后各占 `1/24`。

初始生成可能很快停止，也可能是一串杂乱的字符。我们没有在程序里写“下一步应当生成鱼”，模型现在对所有候选一视同仁。

打开参考实现，新建自己的 `tiny-model.mjs`，也可以先在参考文件里跟改。接下来按 `createCorpus → createExamples → softmax → trainStep → generate` 的顺序读写；命令行解析与文件读写可以先复用。

## 第五到十五分钟 把文本变成样本

`createCorpus()` 用“小猫、小鸟、小狗”、各自的动作，以及“今天、我看见”等前缀生成 36 句原创教学文本。按完整句子分出 27 句训练、9 句验证，验证句不参与参数更新。

两组有意共享大量短片段。这里的验证检查的是相似分布下的短片段组合，不能据此推断模型理解了陌生题材。

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

这里的顺序很重要：先根据历史构造输入，再把当前正确字符加入历史。反过来会把答案放进输入。

`contextRow()` 把最近一个或两个字符的编号映射为行号；`weights[row]` 保存这一种上下文对全部候选字符的分数。一个字上下文需要 `24 × 24 = 576` 个参数，两个字需要 `24 × 24 × 24 = 13824` 个参数。

这是一个以 one-hot 上下文选择分数行、接 softmax 的极简参数模型。第一小时的训练链在这里都能直接找到。

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

这条导数对应 softmax 与交叉熵的组合。假设正确答案的概率是 0.1，它的导数是 `0.1 - 1 = -0.9`；减去负梯度会提高正确答案的分数。其他候选的导数为正，更新会降低它们的分数。

`rate` 是学习率，控制每次调整的幅度。我们在固定顺序下逐个样本更新，是随机梯度下降的逐样本更新形式；实验没有额外打乱顺序。

一个 epoch 表示完整走过一次训练样本。本例每个 epoch 有 207 次参数更新，“120 个 epoch”与“120 次更新”需要分清。

## 第二十五到三十五分钟 真正训练并检查结果

执行默认的 120 个 epoch：

```bash
node docs/ai-from-scaling/labs/tiny-model.mjs --context 1
```

参考实现会每 30 个 epoch 输出一次训练与验证 loss。在 Node.js 24.18.0 下，本课固定数据与配置得到：

| 配置 | 初始训练 loss | 第 120 个 epoch 训练 loss | 第 120 个 epoch 验证 loss |
| --- | --- | --- | --- |
| 看前一个字 | 3.1781 | 0.6448 | 0.6771 |
| 看前两个字 | 3.1781 | 0.4839 | 0.5023 |

先只看第一行。损失下降说明模型对样本中的正确字符分配了更高概率。随后读生成结果，你仍可能看到“小狗吃鱼”或“小猫看见小狗在飞”这样的句子。

找出原因：输入“小猫吃”和“小狗吃”时，模型实际上都只看见“吃”，取出同一行分数。多练习同一批样本，无法从这份输入里区分猫和狗。

## 第三十五到四十五分钟 改变上下文再生成

执行：

```bash
node docs/ai-from-scaling/labs/tiny-model.mjs --context 2
```

现在“猫吃”“鸟吃”“狗吃”对应不同的分数行。在固定配置下，模型给“猫吃”后的“鱼”约 96.9% 的概率，给“鸟吃”后的“虫”约 98.0% 的概率。检查终端里的实际概率，再读生成文本。

生成时程序重复做四件事：取最近的上下文，计算概率，按概率抽取一个字符，把字符追加到历史。遇到边界就结束，最多生成 50 个新字符。生成过程不调用 `trainStep()`。

同一个概率分布可以抽到不同文本。这里使用固定随机种子，便于对照；仍可能抽到低概率错误字符，所以“概率变好”与“每次输出都正确”需要分别观察。

上下文扩大后，参数从 576 增加到 13824，训练工作也随之变化。这项对照帮助你理解输入信息与容量的作用；它同时改变了多个因素，不能作为原论文缩放定律的复现。

## 最后五分钟 保存模型再加载

创建一个临时目录，在同一终端继续执行：

```bash
AI_LAB_DIR=$(mktemp -d)
node docs/ai-from-scaling/labs/tiny-model.mjs --context 2 --save "$AI_LAB_DIR/model.json"
node docs/ai-from-scaling/labs/tiny-model.mjs --load "$AI_LAB_DIR/model.json"
```

第二条命令训练并保存词表、上下文长度和分数表；第三条命令加载这些参数，报告已有 loss 并生成文本，不再训练。保存采用独占创建，已有文件会被拒绝覆盖。

做一次检查：打开 JSON 文件，指出哪部分是学到的参数；再指出训练短句保存在源码的哪里。词表与参数支持模型生成，并不提供按原句查询训练资料的功能。

留三行笔记再休息：

```text
我改变了：
训练与验证结果：
模型仍然会错在：
```

下一步：[第三小时 搭建工具调用 Harness](03-build-a-harness.md)。
