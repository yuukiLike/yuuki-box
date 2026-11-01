# 从前端数组到前缀复用

[上一站 一条消息的旅程](00-first-request.md) · [专题入口](README.md) · [下一站 因果 Attention](02-attention-and-kv.md)

三个数值说明<mark class="key">末尾追加后的旧结果复用</mark>。

## 第一步：区分输入和算出来的结果

三个输入及对应累计和：

```js
const inputs = [3, 5, 2];
const totals = [3, 8, 10]; // 3；3 + 5；3 + 5 + 2
```

`inputs` 是输入，`totals` 是派生结果；过滤列表和 Markdown 解析结果也属于派生数据。

末尾追加 `4`，保留旧结果 `3、8、10`，继续计算：

```js
const nextTotal = totals.at(-1) + 4; // 10 + 4 = 14
```

[![累计和对照：追加 4 只增加 14；将中间的 5 改成 8 后，要从修改处重算 11、13、17](../../site/public/diagrams/kv-cache/04-prefix-change.svg)](../../site/public/diagrams/kv-cache/04-prefix-change.svg)

图中绿色保留旧结果，蓝色只算新增部分，即增量计算。

## 第二步：前缀是什么，为什么修改会往后传播

**前缀**就是从开头开始连续相同的一段。旧输入 `[3, 5, 2, 4]` 改成 `[3, 8, 2, 4]`，共同前缀只剩 `[3]`。

输入 `2、4` 未变，但累计值依赖前一项结果，仍须重算。

**失效**是旧结果不再适用；此处从第二项开始，后续数字相同也不能复用。

若位置只依赖自身与前缀，末尾追加就不改变旧位置；模型的条件见[下一站](02-attention-and-kv.md)。

<div class="heading-alias" id="第三步再回头看-usememo" aria-hidden="true"></div>

## 第三步：useMemo 的复用粒度

假设格式化每条消息的函数只依赖该消息的内容：

```jsx
const formatted = useMemo(
  () => messages.map(message => formatMessage(message.content)),
  [messages],
);
```

`[...messages, nextMessage]` 改变依赖引用，React 会重跑计算，不会把 `map` 自动改成只算最后一项。[useMemo](https://react.dev/reference/react/useMemo)

[![useMemo 依赖变化时重新调用整个计算；计算内部若自行保留兼容前缀状态，就可以复用前三项，只新算第四项](../../site/public/diagrams/kv-cache/05-cache-granularity.svg)](../../site/public/diagrams/kv-cache/05-cache-granularity.svg)

上图缓存整个返回值，下图自行复用前缀。React 比较 `Object.is`；模型缓存检查输入与配置，条件不同。

<div class="heading-alias" id="只跑一个小实验" aria-hidden="true"></div>

## 前缀复用实验

在仓库根目录执行：

```bash
node docs/kv-cache/labs/prefix-cache.mjs
```

查“末尾追加”：复用 3、新算 1；再查“修改第 2 项”：仅复用第一项。

<mark class="caution">输入不变，依赖变了也会失效</mark>。下一步：[Q/K/V](02-attention-and-kv.md)。

<details>
<summary>并非所有数组计算都适合前缀复用</summary>

| 计算 | 依赖什么 | 末尾追加 | 修改中间 |
| --- | --- | --- | --- |
| 每项乘以 2 | 只依赖自己 | 只增加新结果 | 只改对应结果 |
| 累计和 | 到当前位置为止的前缀 | 旧结果有效 | 重算受影响后缀 |
| 每项除以整个数组总和 | 依赖所有输入 | 旧结果也可能变化 | 所有结果都可能变化 |

追加不证明有效；消息行、全文布局与引用解析各查依赖。[流式渲染](../learning/rendering-performance.md)

</details>

<details>
<summary>缓存键还要考虑配置；完整实验数据</summary>

规则为 `total = previousTotal + currentInput * scale`；倍率 `scale` 变化，即使输入相同也要失效。

| 操作 | 新输入 | 倍率 | 复用项数 | 新算项数 | 累计结果 |
| --- | --- | --- | --- | --- | --- |
| 首次计算 | `[3, 5, 2]` | 1 | 0 | 3 | `[3, 8, 10]` |
| 末尾追加 | `[3, 5, 2, 4]` | 1 | 3 | 1 | `[3, 8, 10, 14]` |
| 输入不变 | `[3, 5, 2, 4]` | 1 | 4 | 0 | `[3, 8, 10, 14]` |
| 修改第 2 项 | `[3, 8, 2, 4]` | 1 | 1 | 3 | `[3, 11, 13, 17]` |
| 截短序列 | `[3, 8]` | 1 | 2 | 0 | `[3, 11]` |
| 配置改变 | `[3, 8]` | 2 | 0 | 2 | `[6, 22]` |
| 清空 | `[]` | 2 | 0 | 0 | `[]` |

文本缓存还依赖解析选项和版本；布局还依赖宽度、字体、字号。缓存键覆盖实际依赖。

前缀匹配仍需扫描，状态仍占空间；表中派生项数不是加速倍数。

</details>

<details>
<summary>回归练习：遗漏配置依赖</summary>

在[脚本](labs/prefix-cache.mjs)副本中，把 `previous?.scale === scale` 改为仅检查 `previous`。配置变化时旧倍率 1 触发断言；恢复条件后应通过。

也可统一把 `8` 改成 `9`，预测后运行核对；不要删断言迎合结果。

</details>
