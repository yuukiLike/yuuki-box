# Yuuki Box

AI 学习笔记、动手实验与个人 Agent 工作台。

[在线阅读](https://box.yuuki.page/) · [学习目录](docs/README.md) · [示例](examples/README.md)

## 环境

| 工具 | 版本 |
| --- | --- |
| Node.js | ≥ 22.22.0 |
| pnpm | 11.14.0 |

## 本地运行

在仓库根目录执行：

```bash
pnpm i
pnpm docs:dev
```

默认地址：<http://127.0.0.1:4321/>。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm i --frozen-lockfile` | 按锁文件安装依赖 |
| `pnpm docs:build` | 构建文档站 |
| `pnpm --dir site check` | 检查文档站类型 |
| `pnpm run` | 查看全部脚本 |

详细配置见[文档站说明](site/README.md)。
