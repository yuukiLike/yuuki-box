# 云端电脑实测：CPU、内存、Shell 与多对话

2026-11-01，`yuuki-box` 云环境实测；<mark class="caution">仅代表本次实例</mark>。

| 项目 | 配置 |
| --- | --- |
| 系统 | Debian 13.6，x86_64 |
| CPU | 4 vCPU 配额，可见 5 个逻辑 CPU |
| 内存 | 上限 32 GiB |
| 磁盘 | 约 63 GiB，当时可用约 59.7 GiB |

<div class="heading-alias" id="在自己的对话里复查" aria-hidden="true"></div>

## 环境资源复查

```text
只读查询 CPU 配额、内存上限、磁盘和项目 Git 状态。
返回实际结果，无法查询的项目标为未知。
```

<details class="qa">
<summary>能直接用 Shell 或 SSH 吗？</summary>

可以让 Agent 执行 Shell；本次未验证直接 SSH，需平台提供连接入口。
</details>

<details class="qa">
<summary>两个对话会共用电脑吗？</summary>

独立任务有各自状态；分别查询 `environment_id`，相同才是同一实例。
</details>

<details class="qa">
<summary>开着窗口就会一直占资源、计费吗？</summary>

窗口数量不能说明运行或计费状态；本次未测挂起与回收时间，查看[平台规则](https://learn.chatgpt.com/docs/environments/cloud-environments)。
</details>

<details class="qa">
<summary>初始化握手超时怎么办？</summary>

先查环境状态，再运行 `pwd`；命令成功后继续项目检查。
</details>

下一步：[for-job：云端检查与导出回归](03-for-job.md)。
