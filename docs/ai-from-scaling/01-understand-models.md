# 第一小时 从缩放定律理解模型

从预测下一个字符开始，理解训练、上下文和工具各改变什么。

[课程总览](README.md) · [MCP 开场](00-minimal-mcp.md)。学习 50 分钟，休息 10 分钟。

## 前十分钟 缩放定律里的误差是什么

训练语言模型时，可以调整参数规模、数据量和计算量。

2020 年的研究发现：在其研究范围内，交叉熵损失随参数、数据和训练计算量呈近似幂律变化，可用于估计增加投入的收益。[Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361)

| 名称 | 先用一句话理解 | 在后面的实验里对应什么 |
| --- | --- | --- |
| 参数 | 训练能够调整的数字 | 用来给下一字符打分的分数表 |
| 数据 | 模型用来练习的样本 | 27 句训练短句 |
| 计算 | 完成预测与参数更新所做的工作 | 遍历训练样本并反复更新 |
| 损失 loss | 模型给正确答案的概率有多低 | 每个位置的负对数概率，再取平均 |

下降的是**预测误差**，不直接保证任务成功，也不能无限外推。

Chinchilla 进一步指出：固定计算预算下，应搭配参数规模与数据量，不能只增大模型。[Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)

<details class="qa">
<summary>同一批短句重复训练十次，增加了什么？</summary>

增加训练计算，没有增加独立数据；两者要分别计量。

</details>

## 第十到二十五分钟 模型怎样学会预测

从一句话开始：

```text
小猫吃鱼。
```

实验把每个字符当作一个 token，方便读出目标。真实模型的 token 也可能是词的一部分或其他片段。

如果模型只看前一个字，训练样本里就包括：

```text
输入 小 → 目标 猫
输入 猫 → 目标 吃
输入 吃 → 目标 鱼
```

模型为词表中的每个候选字符给出一个分数。softmax 把分数变为一组总和为 1 的概率；训练则检查模型给正确字符分配了多少概率。

如果“鱼”的概率为 0.1，这次损失为 `-ln(0.1)`，约 2.30；概率升到 0.8，损失约为 0.22。正确答案的概率越高，这次损失越小。

梯度给出参数调整方向，训练反复执行：

```text
输入片段 → 预测分数 → 概率 → 和目标比较 → 更新参数
```

**参数更新就是训练发生的地方。** 核对训练 loss、验证 loss 和生成文本；训练集表现只说明对这些样本的拟合。

## 第二十五到三十五分钟 上下文与 Transformer

现在给模型两段输入：

```text
小猫吃____
小鸟吃____
```

只看“吃”，模型无法区分两段输入；看见“猫吃”和“鸟吃”，才可能给出不同概率。

逐一给文字组合建表会迅速膨胀。Transformer 通过共享参数学习表示，用 Attention 组合不同位置的信息，再逐层处理。[Attention Is All You Need](https://arxiv.org/abs/1706.03762)

自回归语言模型使用因果限制：预测一个位置时，只能利用允许看到的前文。训练可以并行处理多个位置，但不能让后文答案泄漏进该位置的输入。

Q/K/V 的数值过程见[Attention 图解](../kv-cache/02-attention-and-kv.md)。

## 第三十五到四十五分钟 从预测能力到可用的助手

预测包含知识、代码和解题过程的文本，可以学到用于多种任务的规律。GPT-3 展示了用指令和少量示例完成任务，执行时无需更新参数。[Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165)

这是实验观察；各项能力如何形成，仍需研究。

示范数据、反馈与奖励进一步塑造回答行为。InstructGPT 表明，人类反馈微调能改善指令遵循。[Training Language Models to Follow Instructions with Human Feedback](https://arxiv.org/abs/2203.02155)

推理时增加步骤、尝试和检查，也可能改善表现；收益取决于模型、任务与计算方式。[Learning to Reason with LLMs](https://openai.com/index/learning-to-reason-with-llms/)

| 你采取的动作 | 直接改变什么 |
| --- | --- |
| 训练或微调 | 模型参数 |
| 补充背景、例子与要求 | 本次输入的上下文 |
| 分配更多推理计算 | 本次解决任务的计算过程 |
| 提供一个工具 | 程序允许模型请求的外部能力 |

普通的一次对话请求不更新模型参数。若产品另外保存记忆或把反馈用于后续训练，那是额外机制。

## 最后五分钟 从模型走到 Harness

工具调用把动作表达为结构化请求，例如：

```json
{"name":"calculate_total","arguments":{"people":20,"perPerson":35,"venue":80,"budget":800}}
```

程序验证参数、执行函数、返回结果，模型再继续；模型提出调用，客户端实际执行。[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)

这段执行机制就是 Harness。后两章会实现循环、审批与错误处理。

休息前，试答三题：

<details class="qa">
<summary>loss 下降，就代表任务一定成功吗？</summary>

不一定。loss 衡量预测误差，具体任务仍要单独验收。

</details>

<details class="qa">
<summary>补背景和训练，分别改变什么？</summary>

补背景改变本次上下文；训练更新模型参数。

</details>

<details class="qa">
<summary>谁执行保存，怎样证明保存成功？</summary>

Harness 调用工具。核对工具结果和实际文件。

</details>

下一步：[第二小时 训练一个小语言模型](02-train-a-model.md)。
