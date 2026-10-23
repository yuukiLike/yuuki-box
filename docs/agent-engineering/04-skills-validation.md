# Skills：给「做完了」出一道验收题

Skill 写好了，AI 也说“链接都检查过了”。现在悄悄放进一个坏链接，看看它的检查到底能不能抓住。让一个故意出错的样本被准确指出来，这一刻比一句“已完成”踏实得多。

**让模型解释结果，让脚本判断结果。** 自然语言步骤能指导模型，但不能证明输出正确；确定性的检查必须由代码完成。

状态：实现建议。脚本示例是通用片段，未加入本仓库的检查流程。资料核对：2026-10-23。

## 为什么需要脚本

一个 skill 说“检查链接是否有效”，模型可能只看了几个链接就说“已检查”。这不是模型故意撒谎，而是自然语言没有强制它遍历全部输入。

把机械判断交给脚本：

| 判断 | 适合谁做 |
| --- | --- |
| 文件是否存在、链接是否可解析 | 脚本 |
| 测试是否通过、构建是否成功 | 脚本 |
| 输出是否符合固定结构 | 脚本 |
| 改动是否符合用户意图 | 模型 + 人 |
| 体验是否可接受 | 人 |

## 校验脚本的契约

一个可复用的 skill 脚本至少满足：

- **确定性：** 相同输入得到相同退出码，不依赖网络、时钟或随机数。
- **有边界：** 只读指定目录，不修改源文件；临时文件放在系统临时目录并清理。
- **可解释：** 失败时输出 `文件:行号` 和具体原因，不只打印“失败”。
- **可组合：** 支持 `--json` 或稳定的文本格式，方便人和 CI 读取。
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

这个片段只检查相对链接。实际 skill 可以再检查标题、必需章节、生成的 diff 或测试结果。

## 负例 fixture

只准备“正确输入”不够。至少放一个故意坏的 fixture：

```text
tests/fixtures/docs-restructure/
├── good.md
└── bad-missing-link.md   # 应让脚本失败
```

验收时同时确认：

- `good.md` 通过；
- `bad-missing-link.md` 失败；
- 错误信息指向正确的文件和链接。

如果脚本对坏输入也返回成功，它不能作为验收证据。

## 接进自己的 Harness

如果你在自己的 runtime 里支持 skill，不要把所有正文预加载。按渐进披露实现：

1. **扫描目录**：只读取 `name`、`description`、路径和版本。
2. **注入元数据**：把 name + description 放进系统提示或工具表。
3. **`load_skill(name)`**：命中后返回 `SKILL.md` 正文和可用资源列表。
4. **`read_skill_file(name, path)`**：只允许读取该 skill 目录内的文件，拒绝 `..` 和绝对路径。
5. **`run_skill_script(name, script, args)`**：通过现有工具策略执行，记录退出码和输出摘要；不要自动执行。
6. **记录**：在 `run.report` 中写明本次加载了哪个 skill、版本或 hash、运行了哪个脚本。

`load_skill` 的结果是上下文，不是权限。skill 里写“直接删除旧文件”，仍然要经过 Harness 的删除工具和审批。

## 小挑战：把坏样本藏进新会话

1. 给一个真实 skill 加上 `scripts/validate` 和一个坏 fixture。
2. 在新会话里只凭 `SKILL.md` 完成任务。
3. 故意让输出缺少一个必需章节，确认脚本失败并指出位置。
4. 在 Harness 中确认：启动时只加载元数据；`load_skill` 之后正文才出现；`run.report` 有记录。

## 验收

- 新会话可以端到端执行，不依赖上一条对话。
- 坏 fixture 稳定失败，好 fixture 稳定通过。
- 脚本无网络依赖、可重复执行、不修改源文件。
- skill 目录外的文件无法通过 `read_skill_file` 读取。
- 脚本执行有审批或策略记录，输出进入 artifact 或日志。

## 边界

- **脚本以你的权限运行。** 它不是沙箱；执行前要读代码，必要时用只读挂载或独立用户。
- **不要自动运行下载来的 skill。** 先审查 `SKILL.md`、`scripts/` 和依赖，再启用。
- **校验通过不等于任务完成。** 脚本只能证明它检查的那部分；体验、意图和取舍仍要人判断。
- **脚本也会过时。** 命令、路径和依赖变化后，负例可能失效；把校验脚本和 skill 一起版本化。
- **不要把真实凭据放进 fixture。** 用占位符和临时目录。

返回[上一篇](03-skills-structure.md) · [总览](README.md) · 深入[Mac 本地 Harness 完整设计](../architecture/mac-local-harness.md)。
