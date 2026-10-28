# Skills：这件事，下次不用从头教

把反复交代的“拆章节、改导航、查链接、跑构建”存成 Skill，换会话后检验能否复用。

**Skill 是可版本化的任务目录：触发条件、输入输出、步骤与验收。** 同类任务可以复用。

状态：实现建议。目录与字段按 Agent Skills 规范及当前 Claude Code / Codex 文档整理；具体加载行为以你使用的版本为准。资料核对：2026-10-23。

## Skill 由什么组成

```text
.claude/skills/docs-restructure/
├── SKILL.md              # 必需：触发条件与步骤
├── scripts/validate.mjs  # 可选：确定性校验
├── references/checklist.md
└── assets/template.md
```

`SKILL.md` 开头是 YAML frontmatter：

```yaml
---
name: docs-restructure
description: 重构 docs 目录、拆分章节并同步站点导航。当用户要求调整文档结构、侧栏顺序或拆分章节时使用；只改错别字或单篇内容时不要触发。
---
```

规范建议 `name` 使用小写字母和连字符，长度不超过 64 个字符；`description` 不超过 1024 个字符，不要包含 XML 标签。正文建议控制在 500 行以内。[Agent Skills specification](https://agentskills.io/specification)

Claude Code 从 `.claude/skills/<name>/SKILL.md` 读取，Codex 从 `.agents/skills/<name>/SKILL.md` 读取；两者目录不同，`SKILL.md` 的结构可以共用。显式调用分别是 `/skill-name` 与 `$skill-name`，也都可以靠 description 隐式触发。

[![Skill 按名称描述、正文、引用资料三层加载；工具权限另行检查](../../site/public/diagrams/agent-engineering/03-skill-loading.svg)](../../site/public/diagrams/agent-engineering/03-skill-loading.svg)

读图时只追踪一件事：这一步新增了哪些上下文，又为什么现在才需要它。

## 加载是渐进的

1. 启动时只把 `name` 和 `description` 放进上下文。
2. 任务匹配后，才加载 `SKILL.md` 正文。
3. 只有正文明确要求时，才读取 `references/` 或运行 `scripts/`。

按需加载正文，避免所有规则同时占用上下文。

## description 才是触发器

description 要回答三件事：**做什么、什么时候用、什么时候不要用。** 只写“帮助处理文档”会让它在错误的任务上加载。

| 写法 | 问题 |
| --- | --- |
| `帮助处理文档` | 太宽，几乎所有文档任务都会命中 |
| `重构 docs 目录、拆分章节并同步站点导航。当用户要求调整文档结构、侧栏顺序或拆分章节时使用；只改错别字或单篇内容时不要触发。` | 有动作、有触发条件、有负例 |

负例不是装饰。它是你后续测试“该不该加载”的固定用例。

## 正文模板

```markdown
# 文档结构重构

## 什么时候用
- 用户要求拆分章节、调整侧栏顺序或移动文件。
- 需要同步 `docs/README.md` 与 `site/src/lib/navigation.mjs`；站点配置在 `site/astro.config.ts`。

## 输入
- 目标目录、新的章节顺序、需要保留的链接。

## 步骤
1. 列出当前文件与引用。
2. 按学习目标设计导航分组，优先保留已有页面地址。
3. 确需移动文件时，更新相对链接并为旧地址安排兼容路径。
4. 更新站点侧栏与目录表。
5. 运行校验。

## 输出契约
- 说明移动了哪些文件、改了哪些链接。
- 给出校验命令与结果。

## 失败处理
- 链接缺失时停止，不猜测目标。
- 站点构建失败时保留原始文件，不回滚用户改动。

## 验收
- `pnpm --dir site test`
- `pnpm --dir site check`
- `pnpm --dir site build`
```

正文只写任务步骤；通用规则引用项目已有说明。

## 小挑战：把最近重复过的任务教一遍

选一个你最近重复做过、且有明确验收标准的任务。不要为演示造一个 skill。

- **Baseline：** 不带 skill 做 3 次同类任务。
- **With skill：** 带 skill 做 3 次同类任务。
- 记录：是否在正确任务上加载、是否需要补充解释、返工次数、从开始到验收的时间、加载了多少上下文。
- 再跑 2 个负例，确认不会误触发。

## 验收

- 3 次真实任务的结果不差于 baseline，返工次数没有增加。
- 负例不触发 skill。
- 新会话只凭 `SKILL.md` 就能完成，不依赖你上一次对话里的隐含说明。
- skill 的改动可以像代码一样审查和回滚。

## 边界

- **Skill 是说明，不是权限。** 它不能替代审批、路径校验或沙箱；副作用仍要走 Harness 的工具策略。
- **Skill 会过期。** 产品接口、目录结构和命令变化后，旧步骤可能变成错误引导；把版本和核对日期写进正文。
- **Skill 会冲突。** 两个 skill 给出不同步骤时，模型不会自动知道谁优先；description 要尽量互斥，或者明确依赖关系。
- **不要把密钥写进 skill。** 需要凭据时引用环境变量或 Keychain，不要在示例里放真实值。
- **不要自动运行下载来的 skill。** 先读 `SKILL.md` 和 `scripts/`，确认它做什么，再决定是否启用。

## 资料

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [OpenAI Codex Skills](https://developers.openai.com/plugins/build/skills)

返回[上一篇](02-mcp-policy.md) · [总览](README.md) · 下一篇[Skills：校验与渐进加载](04-skills-validation.md)。
