# key Map 与前端的查找结构

[学习入口](README.md) · [下一篇 缓存的成本](cache-cost.md)

假设你有一万条消息，收到一条带着 `messageId` 的增量更新。第一个问题是：怎样找到要更新的对象？第二个问题才是：找到之后，要重新计算或渲染什么？

## 数组查找和索引各做什么

```js
const rows = [
  { id: 1, text: '你好' },
  { id: 2, text: '继续回答' },
];

const foundByScan = rows.find(row => row.id === 2);
const byId = new Map(rows.map(row => [row.id, row]));
const foundByIndex = byId.get(2);

console.log(foundByScan === foundByIndex); // true
```

第一条路径按顺序检查条件；第二条先为整批数据建立索引，再按 ID 查找。是否值得建索引，取决于数据规模、查询次数和后续更新成本。[浏览器实验](../../site/src/pages/labs/lookup.astro)可以直接观察这两条路径。

Map 规范要求平均访问时间相对元素数量为次线性，并没有要求所有引擎、所有操作都是严格的常数时间；实现可以采用哈希表或其他结构。[MDN Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)

## Object Map WeakMap 怎样选择

| 结构 | 容易理解的使用场景 | 需要考虑什么 |
| --- | --- | --- |
| Object | 一份有字段含义的记录，例如 `{ id, title, status }` | 属性键和原型语义；动态字典可考虑 `Object.create(null)` |
| Map | 动态索引、经常增删、需要直接读取 `size` 的键值集合 | 索引构建、键的相等规则、容量与更新同步 |
| WeakMap | 给已有对象附加跟随其生命周期的元数据 | 不能枚举所有条目，不能把它当作可观测容量的 LRU |

普通对象的属性键使用字符串或 Symbol；Map 可以直接使用任意值作为键。对象类型的键按身份比较，两个字段相同的新对象也不是同一个键。[MDN Map 的对象比较](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#objects_vs._maps)

```js
const key = { id: 1 };
const cache = new Map([[key, '已解析']]);
console.log(cache.get(key));       // 已解析
console.log(cache.get({ id: 1 })); // undefined
```

WeakMap 的弱键不会仅因这层关联而阻止对象键被回收；它支持对象以及符合条件的 Symbol 键。对象何时回收由运行时决定，WeakMap 也没有枚举条目和查询 `size` 的接口。[MDN WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

例如可以给消息对象关联一次解析结果；当应用不再引用这个消息对象时，弱关联允许相关生命周期结束。若需要明确限制“最多保留 128 项”，应使用可管理的缓存结构。

## 同样叫 key 作用可能不同

| 名称 | 用来解决什么问题 |
| --- | --- |
| 消息 ID | 标识业务实体 |
| React 列表的 `key` | 让 React 在插入、删除和重排后对应原来的列表项 |
| Map 的键 | 定位某个存储的值 |
| 计算缓存的键 | 判断能否复用一次派生计算 |
| Attention 的 Key | 与 Query 做数值运算，计算读取 Value 的权重 |

React 列表 key 要在同级列表项间唯一，并保持稳定；用它建立项与组件的对应关系。它不会为你建立业务 Map，也不能代替对计算依赖的检查。[React 列表 key](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)

模型里的 Key 是向量，具体计算见[因果 Attention](../kv-cache/02-attention-and-kv.md)。前端字典查找与 Attention 读取可以分别从身份和依赖来理解。

## 缓存键需要表达哪个版本的结果

`message.id` 能定位同一条消息，但流式消息的文字还在变化。如果缓存的是解析结果，可以明确记录内容版本和解析器版本：

```js
const cacheKey = JSON.stringify([
  message.id,
  message.contentVersion,
  parserVersion,
]);
```

这里用固定数组表达一组明确依赖。具体项目可以直接保存对象与版本，或者分层索引；重点是让“这是同一条消息”和“这次结果仍然有效”分别可判断。

## 用 Map 理解一个有容量的缓存

Map 保留插入顺序，可以用删除再插入表达最近一次访问。下面是一份只展示容量与访问顺序的教学片段：

```js
const cache = new Map();
const capacity = 128;

function remember(key, value) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > capacity) cache.delete(cache.keys().next().value);
}

function read(key) {
  if (!cache.has(key)) return { hit: false };
  const value = cache.get(key);
  remember(key, value);
  return { hit: true, value };
}
```

这个片段可以表达最近最少使用的淘汰顺序；内容版本、错误结果是否缓存，以及何时整体清空，仍是调用方需要明确的规则。淘汰解决空间上限，失效解决结果正确性，两者应一起考虑。

先预测一次访问序列：容量为 2，依次写入 A、B，读取 A，再写入 C。被淘汰的是 B。接着读[缓存的成本](cache-cost.md)，看看多保存一份索引还影响了什么。
