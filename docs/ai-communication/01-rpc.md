# 第一章：让一次函数调用跨过进程

[目录](README.md) · [下一课](02-json-rpc.md)

让<mark class="key">另一个进程读笔记</mark>并返回结果。

这就是 RPC。本课在本机启动两个进程。

## 先运行

在项目根目录执行：

```bash
node docs/ai-communication/labs/01-rpc.ts
```

最后会看到：

```text
结果： 今天只追踪一次跨进程调用。
确认：两个 PID 不同，请求与响应的 id 相同。
```

## 看图

[![两个进程各有自己的 PID，请求和回答使用同一个 id](../../site/public/diagrams/ai-communication/01-rpc.svg)](../../site/public/diagrams/ai-communication/01-rpc.svg)

先分清两个编号：

| 编号 | 用来认出什么 |
| --- | --- |
| `PID` | 哪个进程 |
| `id` | 哪一次请求 |

PID 区分进程；相同 id 配对请求与回答。

## 到这里就停

能按 id 追踪一次请求和回答即可。

<details>
<summary>代码入口</summary>

先只找两处：

- [01-rpc.ts](labs/01-rpc.ts)：`spawnSync()` 启动另一个进程，并发出请求。
- [note-server.ts](labs/note-server.ts)：按 `message.method` 找到操作，`reply()` 返回结果。

`method` 是操作名，`params` 是参数，`id` 是请求编号；消息采用 JSON-RPC 2.0。[规范](https://www.jsonrpc.org/specification)

`stdin` 写请求，`stdout` 读回答，一行一条 JSON；调试日志走 `stderr`。[Node 文档](https://nodejs.org/docs/latest-v24.x/api/child_process.html)

`spawnSync()` 会阻塞当前进程；本实验限时 3 秒、输出最多 64 KiB。下一课改用异步 `spawn()`。

笔记是服务进程内的固定文字，没有读取用户文件。

</details>

<details>
<summary>试一次错误输入</summary>

把客户端 `name: 'welcome'` 改成 `name: 'missing'` 再运行：服务端返回“笔记不存在”，成功检查应失败；观察后改回。

</details>
