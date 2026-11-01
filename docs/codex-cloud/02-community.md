# 2 · 社区怎么用：后台任务、专门产物与本地验收

**借鉴公开任务分工，按当前文档配置。** 案例是作者自述；`for-safe` 用法是本教程建议。

## 三种可以直接学的做法

| 谁在用 | 公开记录中的做法 | 在 for-safe 上怎么借鉴 |
| --- | --- | --- |
| **Simon Willison** | 2025-09 月报：每天一两次后台任务，检出、安装后交回答案或 PR | 交小型规格调查或离线逻辑，稍后集中审阅 |
| **Neurodesk 项目** | 按已有配方与工具文档生成容器配方，提 PR 后团队审阅、本地测试 | 给契约与示例，只交一份文件，如状态分类样本 |
| **Reddit 用户 waiting4myteeth** | 云端提 PR，本地测试；原对话返修，拉取复查后再合并 | 云端做可移植检查，Mac 验原生、权限与设备；失败交回原任务 |

来源：[Simon 月报](https://feeds.simonwillison.net/newsletters/monthly-2025-09-september/)、[Neurodesk](https://neurodesk.org/developers/neurocontainer-copilot/openai-codex/)、[社区讨论](https://www.reddit.com/r/ChatGPTCoding/comments/1nyd3ny/how_are_people_using_codex_cloud_interested_in/)。后两项为旧界面，仅借鉴工作方式。

旧讨论也报告依赖和 Docker 嵌套成本高；<mark class="key">先跑通最小环境</mark>，再增依赖，不能据此判断新版故障。 [原讨论](https://www.reddit.com/r/ChatGPTCoding/comments/1nyd3ny/how_are_people_using_codex_cloud_interested_in/)

<span id="screenshots"></span>

## 看两张真实界面截图

两图是公开 **Legacy 历史截图**，非本账号结果；新版入口见[上一页](01-for-safe.md)。

### 图 1：先确认环境能准备成功

![OpenAI 官方 Legacy 环境设置截图，含 setup script 和执行日志](../../site/public/images/codex-cloud/legacy-environment-setup.png)

[放大查看](../../site/public/images/codex-cloud/legacy-environment-setup.png)

核对 **setup script** 与终端结果；准备完成不等于项目验收。

来源：[更新记录](https://developers.openai.com/codex/changelog)、[官方原图](https://developers.openai.com/images/codex/changelog/environment_setup.png)。新版改用准备对话、Install script／Start skill、Publish。

<div class="heading-alias" id="图-2任务完成后看它交了什么文件" aria-hidden="true"></div>

### 图 2：任务交付文件

![Neurodesk 的 Codex Legacy 任务结果截图，展示生成的构建配方及改动](../../site/public/images/codex-cloud/legacy-neurodesk-result.png)

[放大查看](../../site/public/images/codex-cloud/legacy-neurodesk-result.png)

看 **Diff** 改动、**Testing** 汇报与 **Create Pull Request** 交付；还需核对运行与真机证据。

来源：[Neurodesk](https://neurodesk.org/developers/neurocontainer-copilot/openai-codex/)、[原图](https://neurodesk.org/developers/recipe_generator/codex-build-yaml.png)。图片未修改仓库名。

<details class="qa">
<summary>看到旧教程时，怎么判断哪些操作要重新查？</summary>

| 旧教程中的词 | 新版应该核对什么 |
| --- | --- |
| setup / maintenance script、容器缓存 | 准备对话、Install script / Start skill、Publish / Republish 与独立任务状态 |
| agent 默认断网 | 当前环境的全网开关、包管理器预设与允许域名 |
| secrets 只用于 setup | 当前的直接环境变量与代理替换型 HTTP secrets |

Code Review、Linear、GitHub 部分入口仍属 Legacy；确认入口后读对应版本文档。 [新版](https://learn.chatgpt.com/docs/environments/cloud-environments)、[Legacy](https://learn.chatgpt.com/docs/environments/cloud-environment)

</details>

<div class="heading-alias" id="你的第一次实验到这里就够了" aria-hidden="true"></div>

## 首轮验证范围

首轮完成 **读规格 → 拆任务 → 查依据**；实现时再加代码、检查、PR、Mac 验收。独立任务可并行，同模块按序整合。

云端提供执行环境；`for-safe` 无线测试条件由本地环境提供并验收。

相关实验见 [AI 探索](../ai-ideas/README.md)与 [Issue 修复、验证和交付](../issue-garden/README.md)。

**已有代码的下一项练习：[for-job 的备份恢复与导出回归 →](03-for-job.md)**；也可选择 [agent-symphony 的事件与回放验证](04-agent-symphony.md)。
