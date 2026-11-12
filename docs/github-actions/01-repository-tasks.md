---
prev:
  link: /github-actions/00-files-and-commands/
  label: 工作流文件与常用命令
next:
  link: /github-actions/02-orchestration/
  label: 多任务编排与交付
---

# 1 · 事件触发与仓库任务

手动摘要说明工作流能运行。接下来让它读取仓库、执行一个已有命令，并留下结果；再决定哪些事件值得自动触发。

本页是配置说明，示例未执行。已有脚本的行为仍以其实际实现为准。

## 从文档构建开始

本项目的站点位于 `site/`。未来可以用下面的手动工作流安装依赖、构建站点，再上传静态文件供维护者下载。

```yaml
name: Build documentation

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: site/package.json
      - uses: actions/setup-node@v4
        with:
          node-version: '22.22.0'
      - name: 安装依赖
        run: pnpm install --frozen-lockfile
      - name: 构建文档
        run: pnpm docs:build
      - name: 保存站点文件
        uses: actions/upload-artifact@v4
        with:
          name: documentation
          path: site/dist/
          if-no-files-found: error
          retention-days: 3
```

- **检出代码**：runner 不会自动拥有仓库内容，`checkout` 负责取回当前运行对应的代码。
- **准备工具**：pnpm 版本来自项目的 `packageManager`，Node 版本与站点当前要求对应。
- **安装与构建**：`--frozen-lockfile` 按锁文件安装；需更新时，报错停止。当前 `docs:build` 还会运行项目已有的构建结果检查，见[站点脚本](../../site/package.json)。
- **保存产物**：成功后可在运行页下载 `documentation`，保留 3 天。它是构建文件，不等于一个可访问的预览网址。

示例使用主版本标签便于阅读，不代表最新版本推荐。正式启用前核对 Action 维护状态与兼容性，需要固定供应链版本时使用已核对的完整 commit SHA。

## 选择合适的触发事件

- **`workflow_dispatch`**：人工点击运行，可接环境、版本等输入。适合先验证流程，以及低频维护任务；工作流须先存在于默认分支。
- **`pull_request`**：PR 创建或更新时检查候选改动，适合构建、格式检查、测试与预览。是否阻止合并还需配置仓库的必需检查规则。
- **`push`**：分支或标签收到提交后运行，适合主分支构建、合并后部署或版本标签打包。
- **`schedule`**：按 cron 定期运行，适合日报、依赖状态和数据快照。任务可能延迟，不能承诺精确到点执行。
- **`release`**：发布版本时触发后续交付，例如准备安装包或同步发布信息。
- **`issues` / `issue_comment`**：接收问题和评论事件，适合整理信息、提醒或受控命令入口；事件出现本身不代表获准执行敏感操作。

前期每种任务只选一个主要入口。若同一提交同时命中 `push` 与 `pull_request`，可能重复构建并累计两次用量。

<details>
<summary>选读：文档变更过滤与定时配置</summary>

下面是可替换前面 `on` 的触发配置片段，不是完整工作流。`main` 按实际默认分支调整。

```yaml
on:
  workflow_dispatch:
  pull_request:
    paths:
      - 'docs/**'
      - 'site/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - '.github/workflows/docs.yml'
```

路径过滤能减少无关运行，但如果把整个过滤后的工作流设为必需检查，被跳过的检查可能一直等待。需要始终返回合并结论时，保留一个总会触发的汇总检查，再在内部决定是否执行构建。

定时任务另用下面的事件片段：

```yaml
on:
  schedule:
    - cron: '17 1 * * *'
```

此写法按 UTC 表达，每天 01:17 UTC，即北京时间 09:17；避开整点只能减少碰到繁忙时段的机会。计划使用默认分支的工作流；公开仓库长期无活动时还可能被平台停用。最低间隔与其他限制以当前平台文档为准。

</details>

## 单个任务已经能完成的事情

- **代码质量**：运行格式、类型、测试或依赖检查，把日志和报告附到运行记录。检查失败是否阻止合并由仓库规则决定。
- **资料维护**：检查 Markdown 链接、生成文档目录、收集版本变化、生成每周更新摘要。外部网站失败需区分临时网络问题与链接失效。
- **版本交付**：整理更新日志、压缩二进制文件、生成校验和、上传 Release 附件或包仓库。写入仓库与发布包需要相应权限。
- **定时数据任务**：从有权访问的 API 读取数据，汇总成 JSON、CSV 或图表，保存到 artifact 或对象存储。持久保存需要明确目的地和保留规则。
- **提醒与整理**：在明确规则下分配标签、提醒维护者、汇总待处理事项。写评论、发消息和修改 Issue 都属于另外的写入动作。

普通 shell、Python 或 Node 程序都可以成为步骤。不必为每件事寻找专门的 Action；需要复杂逻辑时，将脚本放进仓库比把全部代码塞进 YAML 更易维护。

## 失败时先看哪一层

1. **没有出现运行记录**：检查工作流路径、事件、分支、路径过滤与仓库 Actions 设置。手动和定时入口还要确认默认分支上的文件。
2. **一直排队**：检查 runner 是否可用、并发限制和用量设置。排队不等于脚本正在执行。
3. **本地成功，云端失败**：比较操作系统、运行目录、Node/pnpm 版本、锁文件、环境变量和网络条件。
4. **读取成功，写入失败**：检查 `permissions`、分支保护、fork PR 的权限限制与所用凭据的范围。
5. **运行成功，却找不到文件**：确认上传步骤执行、路径正确、产物尚未过期。日志中的成功不代表文件已经部署到网站。

能稳定解释一次任务的输入与输出后，再用[多任务编排](02-orchestration.md)拆分并行与交付阶段。
