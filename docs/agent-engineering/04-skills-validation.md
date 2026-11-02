# Skills：确定性验收与渐进加载

使用坏链接 fixture，验证 Skill 能否准确报告错误。先让好坏样例得到不同结果，再做跨会话复用；自建 Harness 的加载与审批为进阶。

<mark class="key">模型解释，脚本判定</mark>；自然语言步骤不能证明输出正确。

实现建议；脚本片段尚未加入仓库检查。核对：2026-10-23。

## 为什么需要脚本

自然语言要求不能保证遍历全部链接；让脚本检查固定条件。

按判断类型分工：

| 判断 | 适合谁做 |
| --- | --- |
| 文件是否存在、链接是否可解析 | 脚本 |
| 测试是否通过、构建是否成功 | 脚本 |
| 输出是否符合固定结构 | 脚本 |
| 改动是否符合用户意图 | 模型 + 人 |
| 体验是否可接受 | 人 |

[![同一检查器应让好样例通过，并指出坏样例中的具体错误](../../site/public/diagrams/agent-engineering/04-skill-validation.svg)](../../site/public/diagrams/agent-engineering/04-skill-validation.svg)

准备只差一个条件的好坏样例；坏样例也通过时，先修检查器。

## 校验脚本的契约

脚本至少满足：

- **确定性：** 相同输入、相同退出码，不依赖网络、时钟或随机数。
- **有边界：** 只读指定目录；临时文件放系统临时目录并清理。
- **可解释：** 报错包含 `文件:行号` 与原因。
- **可组合：** 支持 `--json` 或稳定文本，供人和 CI 读取。
- **有退出码：** `0` 表示通过，非 `0` 表示失败。

```js
// scripts/validate.mjs
// usage: node scripts/validate.mjs <changed.md>
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = process.argv[2];
const text = readFileSync(file, 'utf8');
const errors = [];
const links = [...text.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)];
for (const [, target] of links) {
  if (/^(https?:|\/|#)/.test(target)) continue;
  if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) {
    errors.push(`${file}: 链接目标不存在: ${target}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`检查通过: ${file}`);
```

片段仅演示简单行内相对链接的失败退出，未解析 AST，也不可靠处理代码、引用式链接、括号或页内锚点。正式校验应复用 Markdown 解析器或构建结果，不能把正则当完整检查器。

## 负例 fixture

至少准备一个坏 fixture：

```text
tests/fixtures/docs-restructure/
├── good.md
└── bad-missing-link.md   # 应让脚本失败
```

验收时同时确认：

- `good.md` 通过；
- `bad-missing-link.md` 失败；
- 错误信息指向正确的文件和链接。

<mark class="caution">坏输入也通过，检查器就无效</mark>。

<div class="heading-alias" id="小挑战把坏样本藏进新会话" aria-hidden="true"></div>

## 跨会话负例实验

1. 给一个真实 skill 加上 `scripts/validate` 和一个坏 fixture。
2. 在新会话里只凭 `SKILL.md` 完成任务。
3. 故意让输出缺少一个必需章节，确认脚本失败并指出位置。
4. 保存脚本退出码与报告，确认好坏样例的结果可重复。

## 验收

- 新会话可以端到端执行，不依赖上一条对话。
- 坏 fixture 稳定失败，好 fixture 稳定通过。
- 脚本无网络依赖、可重复执行、不修改源文件。
- 本轮脚本退出码与输出有记录。

<details>
<summary>进阶：自建 Harness 接入</summary>

<div class="heading-alias" id="接进自己的-harness" aria-hidden="true"></div>

## 接入 Harness

runtime 按需加载 Skill：

1. **扫描目录**：只读取 `name`、`description`、路径和版本。
2. **注入元数据**：把 name + description 放进系统提示或工具表。
3. **`load_skill(name)`**：命中后返回 `SKILL.md` 正文和可用资源列表。
4. **`read_skill_file(name, path)`**：只允许读取该 skill 目录内的文件，拒绝 `..` 和绝对路径。
5. **`run_skill_script(name, script, args)`**：经工具策略执行，记录退出码和摘要；不自动运行。
6. **记录**：在 `run.report` 中写明本次加载了哪个 skill、版本或 hash、运行了哪个脚本。

`load_skill` 只提供上下文；删除仍须经过工具策略与审批。

接入后再验证：启动只加载元数据，`load_skill` 后才出现正文；目录外文件被拒绝，脚本执行有审批或策略记录，结果进入 `run.report`。

</details>

## 边界

- **脚本不是沙箱：** 先读代码，必要时用只读挂载或独立用户。
- **下载后先审查：** 检查 `SKILL.md`、`scripts/` 与依赖，不自动运行。
- **通过仅证明已检查项：** 体验、意图与取舍仍由人判断。
- **同步版本化：** 命令、路径或依赖变化后重查负例。
- **fixture 不含凭据：** 使用占位符与临时目录。

返回[上一篇](03-skills-structure.md) · [总览](README.md) · 下一篇[MCP：外部工具接入 Harness](01-mcp-tool-source.md)。
