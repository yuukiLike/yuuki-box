---
prev:
  link: /learning/apple-reading-sync/
  label: 阅读同步：使用流程与实现
next:
  link: /github-actions/00-files-and-commands/
  label: 工作流文件与常用命令
---

# GitHub Actions：从一次运行到自动化系统

GitHub Actions 可以在提交代码、打开 PR、到达计划时间或收到外部请求时，分配机器执行程序，再保存结果或调用其他服务。除了构建与测试，还能做文档发布、定时报告、多平台打包、部署审批，以及连接 AI、云服务和内部系统。

<mark class="key">工作流决定何时执行、执行什么，以及结果交给谁</mark>。复杂能力来自脚本、现成 Action 与外部 API 的组合。

本专题编写于 **2026-11-12**，文件、命令与教学图补充于 **2026-11-13**。内容依据已有知识，未联网核对最新功能或价格，未运行示例、测试或部署。YAML 仅放在文档中；本次没有启用仓库工作流。费用中的历史额度与假设单价见[额度与费用](04-costs.md)。

## 先看一次最小运行

下面的示例只在手动触发时生成一份运行摘要，不需要检出代码或配置密钥。若以后启用，把它保存为仓库中的 `.github/workflows/hello.yml`，合入默认分支，再从 **Actions → Hello workflow → Run workflow** 发起运行。

```yaml
name: Hello workflow

on:
  workflow_dispatch:

permissions: {}

jobs:
  hello:
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      - name: 生成摘要
        env:
          REPOSITORY: ${{ github.repository }}
        run: |
          printf '## 第一份工作流报告\n' >> "$GITHUB_STEP_SUMMARY"
          printf '仓库：%s\n' "$REPOSITORY" >> "$GITHUB_STEP_SUMMARY"
```

预期结果：运行页出现一个 `hello` job，步骤日志显示执行情况，Summary 中展示仓库名。这说明任务已被安排到一台 runner 上；尚未包含代码构建、发布或 AI 调用。

`permissions: {}` 关闭这个任务不需要的 `GITHUB_TOKEN` 权限；`timeout-minutes` 限制 job 时长。`ubuntu-latest` 是会随平台更新的 Linux 镜像标签，正式流程需要考虑环境变化。

## 六个必要概念

- **Workflow（工作流）**：放在 `.github/workflows/` 下的 YAML 文件，定义触发方式与任务。
- **Event（事件）**：手动按钮、push、PR、定时计划等入口。
- **Job（任务）**：一组在某个 runner 上执行的步骤。多个 job 默认可并行，也可以设置先后依赖。
- **Runner（执行机器）**：GitHub 提供的机器，或自行维护的机器；机器类型影响能力、隔离和费用。
- **Step（步骤）**：同一 job 内依次执行的操作。`run` 执行命令，`uses` 调用已有 Action。
- **Action（可复用组件）**：例如检出代码、安装运行环境、上传文件。它会在任务权限范围内执行代码，需核对来源与版本。

每个工作流的一次执行称为 **workflow run**；同一事件可以触发多个工作流，一个 run 可以包含多个 job。<mark class="key">计费需要累计各个 job 使用的机器时间</mark>，不能只看整个 run 从开始到结束经过几分钟。

## 从简单到复杂能做什么

1. **生成一份结果**：手动输出运行摘要、目录清单或版本信息。先理解输入、命令与日志。
2. **读写工作流文件**：[工作流文件与常用命令](00-files-and-commands.md)解释 YAML 层级、常用字段，以及用 `gh` 启动、查看和处理运行。
3. **响应仓库事件**：[事件触发与仓库任务](01-repository-tasks.md)涵盖 PR 检查、文档构建、每日报告和版本发布。
4. **组织多个任务**：[多任务编排与交付](02-orchestration.md)介绍依赖关系、矩阵、缓存、产物、复用和部署审批。
5. **连接多个系统**：[跨系统自动化](03-systems.md)讨论外部事件、云端身份、自托管机器和 AI 任务；复杂实现按需选读。
6. **决定能运行多少**：[额度与费用](04-costs.md)区分免费权益、分钟、存储和外部服务账单，并给出估算方法。

阅读不需要先完成前面的 AI 课程。理解基础 Git 操作与终端命令即可；初次尝试前先查费用页中的[费用来源](04-costs.md#费用来自哪里)。

## 放到 Yuuki Box 可以怎样用

- **最小起点：文档构建报告。** PR 更新文档后生成站点文件，维护者下载查看；正式发布仍是独立步骤。
- **下一层：学习资料维护。** 定时汇总失效链接、依赖变化和待更新资料，生成报告，交给维护者判断。
- **交付层：发布站点与示例。** 站点部署到托管平台；Mac、Windows、Linux 示例分别打包，附上版本与校验信息。
- **系统层：连接现有 Issue 方案。** 由 Actions 安排已获授权的任务，把候选修改交给隔离验证和人工验收，详见[Issue 自动化完整方案](../issue-garden/README.md#workflow)。

以上是可选方向，不表示这些自动化已经配置。先从一个输入明确、输出可查看的短任务开始，再增加触发事件和外部服务。

<details>
<summary>补充资料：官方入口</summary>

以下为后续查阅入口，本次未联网核验。

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [工作流语法](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [触发工作流的事件](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)

</details>
