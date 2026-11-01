# 1 · 用 for-safe 发出第一条云端任务

**先读 `for-safe` 的 README 与目录，交回有文件依据的小结。**

![新版 Codex Cloud 的操作顺序：选择 Cloud 并创建环境，检查设置后 Publish，再开始新任务](../../site/public/diagrams/codex-cloud-first-task.svg)

按 ① → ② → ③ 取得首份只读结果即可。

## ① 把需要读的文件放进 GitHub

准备有 Cloud 权限的账号与授权仓库，规格先推到目标分支；**本机未推送文件不会自动进入云端。** [官方说明](https://learn.chatgpt.com/docs/pricing)

首轮只需规格；没有代码时明确无安装、构建、测试命令。

## ② 创建并发布环境

在 [Codex 网页入口](https://chatgpt.com/codex)或桌面端的新任务中，依次选择：

**Work in → Cloud → Select environment → Create environment**

选择仓库、完成连接，点 **Get started**；也可从 **Settings → Codex Cloud → Environments** 进入。 [官方操作说明与界面示意](https://learn.chatgpt.com/docs/environments/cloud-environments#create-and-publish-an-environment)

在环境准备对话里直接说：

```text
这个仓库是 for-safe，目前处于规格阶段。
先读取实际文件，确认是否已有可执行代码、依赖清单和测试命令。
若只有文档，只准备读取和检索文档所需的环境。
不要创建应用骨架、猜测安装命令，或声称已有测试通过。
报告找到的仓库、分支/提交、可用命令与缺失条件。
```

确认仓库正确、无未处理失败，再保存并 **Publish**；看到 **Environment published** 后 **Start a new task**。<mark class="caution">保存草稿不等于发布</mark>。 [保存与发布的区别](https://learn.chatgpt.com/docs/environments/cloud-environments#create-and-publish-an-environment)

<details class="qa">
<summary>以后有代码了，依赖和测试怎么配置？</summary>

按清单、锁文件确认并执行命令。安装写 **Install script**，启动与就绪检查写 **Start skill**，验收约定写 `AGENTS.md`。

依赖变化后验证并 **Republish**，用新任务复查；已有任务保留状态，后台刷新不重跑安装与启动。 [安装与启动](https://learn.chatgpt.com/docs/environments/cloud-environments#customize-installation-and-startup)

</details>

## ③ 复制这条任务

确认当前选中了 **Cloud** 和刚发布的环境，发送：

```text
阅读 for-safe 的 README 和实际目录。
本轮只分析，不修改文件，不创建 PR。

只交回三项：
1. 这个项目想做什么，用一句话说明，附文件路径依据。
2. 是否找到可执行代码和测试命令；没找到就明确写“未找到”。
3. 推荐一个最小的下一步，写明做到什么就完成。

列出本次实际读过的文件。没有执行测试就写“未运行测试”。
先交回这份小结，等我决定下一项任务。
```

核对**三项小结**中的一个文件引用，与原文相符即完成；实现留待下一轮。

<details>
<summary>下一次再做：实现、验收与故障排查</summary>

## ④ 进入实现时，一次交一个小任务

进入实现阶段后，每轮只交一个小任务，例如：

```text
本轮允许实现一个离线切片：权限拒绝、扫描成功但无设备、
能力不支持、未知/过期结果，应保留为可区分的结果。
先以仓库现有契约为准；若契约尚未定义，先指出缺口，不自行定稿。

只改这个切片所需的最少文件，不连接 Wi-Fi、蓝牙或 macOS API。
用样本测试这些状态不会互相误判，不修改验收条件来迎合实现。
执行仓库已有的相关检查；缺少工具或套件时如实报告。

交付改动摘要、diff、实际执行的命令与结果、未验证项。
保留给我审阅，不合并。
```

检查结果只抓三件事：

1. **改对了吗？** diff 是否只包含约定的切片，是否改动了原本的验收标准。
2. **真跑了吗？** 命令、退出结果和失败原因是否可查；「未运行」不能算通过。
3. **还差什么？** 把代码改动带回本地或通过 PR 分支检出，在 Mac 补做原生与设备验证，再决定合并。

交接示例：**「云端样本测试通过；真实权限、无线开关与休眠恢复未验证。」**

<details class="qa">
<summary>卡在联网、密钥或找不到仓库时怎么办？</summary>

| 现象 | 先检查 |
| --- | --- |
| 找不到仓库或规格 | GitHub 连接是否获准访问该仓库；文件是否已推送；任务实际读取的是哪个提交 |
| 安装依赖失败 | 先看具体错误。新版可开放 Package managers 或额外域名，保存、验证后重新发布 |
| 关掉全网开关，仍然能访问某些站点 | **Enable all public internet access** 关闭后，显式允许的域名仍可访问 |
| 需要调用私有 API | 在环境配置中选择变量或 HTTP secrets；允许联网本身不会提供凭证。本次文档任务不需要业务密钥 |

**Network／HTTP secret** 在允许的 HTTPS 目标经代理替换，准备与任务阶段都可用；与直接环境变量不同，勿套用 Legacy setup-only 规则。 [联网与密钥](https://learn.chatgpt.com/docs/environments/cloud-environments#configure-environment-variables-and-network-secrets)

</details>

<details class="qa">
<summary>能在云端替我点应用、验收界面、一直跑服务吗？</summary>

本次核对时 Cloud 无内置 computer／browser use；项目命令行浏览器测试需另行实测。 [当前限制](https://learn.chatgpt.com/docs/environments/cloud-environments)

服务启动不等于部署，也不会接管本机屏幕、权限或无线设备。

</details>

</details>

<details>
<summary>以后再看：社区案例与历史截图</summary>

[社区案例截图](02-community.md#screenshots)保留了真实历史界面，并标明 Legacy。

</details>
