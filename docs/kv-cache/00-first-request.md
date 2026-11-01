# 第一站：你发出一条消息，模型收到了什么？

[专题入口](README.md) · [下一站 前端数组与前缀](01-from-frontend.md)

先分清<mark class="key">消息是什么、KV 在哪里</mark>；术语按需展开。

## 第一步：先看你认识的消息数组

聊天页面里可以有这样一份数据：

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

## 第二步：下一轮，仍然把需要的历史发过去

模型回答之后，你可以组织下一轮消息：

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

## 第三步：文字进入模型后，会变成数字

先认两个新词就够了：

- **token**：模型处理序列中的一个单位；不固定等于一个字或一个单词。
- **向量**：这里先把它看成一个数字数组，例如 `[0.2, -0.1]`。

[![角色与文字经聊天模板、分词变为 token ID，再转成数字向量，经模型各层产生 Q/K/V；数字仅作示意](../../site/public/diagrams/kv-cache/03-token-vector.svg)](../../site/public/diagrams/kv-cache/03-token-vector.svg)

ID 与数组仅示意；实际角色边界和控制标记随模型而变。[聊天模板](https://huggingface.co/docs/transformers/en/chat_templating)

模型各层产生可复用数字状态，KV Cache 保存其中的 K/V。下一站先用累计和理解旧结果复用。

## 这一站完成了

分清“应用保存消息、模型服务保存推理缓存”，就可停下。

下次直接从[前端数组：追加一项，哪些结果还有效](01-from-frontend.md)开始。

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
