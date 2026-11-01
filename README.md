# Yuuki Box

AI 学习笔记、动手实验与个人 Agent 工作台。

在线阅读：[box.yuuki.page](https://box.yuuki.page/)

[学习目录](docs/README.md) · [示例](examples/README.md) · [本地运行说明](site/README.md#本地运行)

<details open>
<summary>本地运行：下载、安装、启动</summary>

准备 Node.js 22.22 或更高版本、pnpm 11.14。首次下载并启动：

```bash
git clone https://github.com/yuukiLike/yuuki-box.git
cd yuuki-box
pnpm i
pnpm docs:dev
```

已有仓库时，在仓库根目录从 `pnpm i` 开始；依赖已安装时，直接运行 `pnpm docs:dev`。打开终端打印的地址，默认是 `http://127.0.0.1:4321/`。

</details>

<details id="install-commands">
<summary>命令说明：cd、pnpm i、--frozen-lockfile</summary>

| 命令 | 含义 |
| --- | --- |
| `git clone …` | 把仓库下载到本机 |
| `cd yuuki-box` | 把终端的当前目录切换到仓库根目录 |
| `pnpm i` | `pnpm install` 的简写，安装项目依赖；在本仓库根目录执行时，也会安装文档站的依赖 |
| `pnpm docs:dev` | 运行仓库定义的脚本，启动本地文档站 |

需要严格按仓库已有的锁文件安装时，运行：

```bash
pnpm i --frozen-lockfile
```

`pnpm-lock.yaml` 记录依赖的具体版本。`--frozen-lockfile` 表示按这份记录安装，保持锁文件不变；锁文件缺失或与 `package.json` 的依赖声明不一致时，安装会报错停止。普通 `pnpm i` 允许在需要时更新锁文件。[pnpm 官方说明](https://pnpm.io/cli/install#--frozen-lockfile)

</details>

<details>
<summary>完整首页预览：17 个专题与附录</summary>

点击图片可放大。

[![Yuuki 学习手记完整首页：17 个学习专题与附录](site/public/images/readme-home.png)](site/public/images/readme-home.png)

</details>
