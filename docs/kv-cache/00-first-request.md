# 消息请求与模型输入

[专题入口](README.md) · [下一站 前端数组与前缀](01-from-frontend.md)

本篇只区分<mark class="key">客户端消息与服务端 KV</mark>的位置；先读两组消息数组，数值表示按需展开。

<div class="heading-alias" id="第一步先看你认识的消息数组" aria-hidden="true"></div>

## 1. 客户端消息数组

客户端消息示例：

```js
const messages = [
  { role: 'system', content: '请用中文简短回答。' },
  { role: 'user', content: '什么是缓存？' },
];
```

`role` 是角色，`content` 是内容；这里 `system` 放规则，`user` 放用户输入。

此时仍是 JavaScript 数据，转成 JSON 发出只是请求的一步。

[![客户端保存并提交 messages；模型服务计算和管理 KV，再把回答与 usage 返回客户端](../../site/public/diagrams/kv-cache/02-request-journey.svg)](../../site/public/diagrams/kv-cache/02-request-journey.svg)

消息数组在客户端，托管模型 KV 在服务端。

<div class="heading-alias" id="第二步下一轮仍然把需要的历史发过去" aria-hidden="true"></div>

## 2. 后续请求中的历史

模型返回回答后，客户端构造后续消息：

```js
const nextMessages = [
  ...messages,
  { role: 'assistant', content: '缓存会保留可复用的结果。' },
  { role: 'user', content: '那它为什么会失效？' },
];
```

`assistant` 是先前回答；新数组保留了原消息的文字与顺序。

**上下文**是本次实际发送的内容；例中为规则、旧问答与新问题，浏览器其他记录不自动进入请求。

Yuuki 的 Chat Completions 路径发送完整 `system + history`；服务端缓存减计算，不能补回未发送的历史。[请求入口](../../examples/shared/runtime/Sources/main.swift:351)

<details>
<summary>选读：文字进入模型后的数值表示</summary>

<div class="heading-alias" id="第三步文字进入模型后会变成数字" aria-hidden="true"></div>

## 3. 文本到数值表示

基本术语：

- **token**：模型处理序列中的一个单位；不固定等于一个字或一个单词。
- **向量**：可表示为数字数组，例如 `[0.2, -0.1]`。

[![角色与文字经聊天模板、分词变为 token ID，再转成数字向量，经模型各层产生 Q/K/V；数字仅作示意](../../site/public/diagrams/kv-cache/03-token-vector.svg)](../../site/public/diagrams/kv-cache/03-token-vector.svg)

ID 与数组仅示意；实际角色边界和控制标记随模型而变。[聊天模板](https://huggingface.co/docs/transformers/en/chat_templating)

模型各层产生数值状态，KV Cache 保存其中可复用的 K/V；后续以累计和说明复用条件。

</details>

<div class="heading-alias" id="这一站完成了" aria-hidden="true"></div>

## 完成条件

区分应用保存的消息与模型服务保存的推理缓存。

后续：[前端数组与前缀复用](01-from-frontend.md)。

<details>
<summary>四种消息角色，以及 JSON 与模型输入的区别</summary>

| 角色 | 这个教程里的用途 |
| --- | --- |
| `system` | 整体规则与约束 |
| `user` | 用户输入 |
| `assistant` | 模型回答，也可能包含工具调用请求 |
| `tool` | 工具真正执行后返回的结果，需对应此前的调用 |

JSON 是传输格式，消息还要按模板转成 token 序列；两者不能等同。研究缓存需同时看内容、顺序、模板与配置。[模板原理](https://huggingface.co/docs/transformers/en/chat_templating)

其他接口的角色、字段与历史管理可能不同；数组仅说明本专题的 Chat Completions 路径。

</details>
