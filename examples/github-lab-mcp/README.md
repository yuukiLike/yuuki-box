# GitHub 实验员 MCP

用 TypeScript、官方 MCP SDK、Octokit 与 Zod，把开源修复变成可以验证、复盘的实验。搜索项目，寻找已合并的小型修复，先读旧代码和原始 Issue，写回归断言，尝试修复，最后打开官方补丁做对照。

完整跟做：[GitHub MCP：证明一次修复有效](../../docs/ai-from-scaling/06-github-lab-mcp.md)。对照三版本结果图，补一条断言，再核对测试与源码指纹。

`tools/list` 发现的是服务提供的工具，`discover_projects` 执行的是 GitHub 仓库搜索。MCP 传递请求与结果；实验代码负责保存工作树、执行断言并给出判定。`experimentId` 是定位这些本地文件的业务编号，恢复实验依赖同一数据目录。

## 跑一次真实实验

需要 Node.js ≥ 22.22、pnpm 11.14 和 Git，网络可以访问 GitHub。无需模型 key 或 GitHub token 即可读取公开资料；匿名 API 额度不足时可以通过环境变量 `GITHUB_TOKEN` 使用自己的只读凭据。

```bash
pnpm --dir examples/github-lab-mcp install --frozen-lockfile
pnpm --dir examples/github-lab-mcp check
pnpm --dir examples/github-lab-mcp demo
```

演示固定使用 [developit/mitt #124](https://github.com/developit/mitt/pull/124)，只下载两份固定提交，不安装远端依赖、不运行远端 package scripts。示例自己提供 TypeScript 断言和候选修改；不调用模型。通过 MCP 接入 AI 客户端以后，阅读、编写测试与修改候选由宿主 Agent 完成。

演示预期：`baseline: assertion_failed → candidate: passed → reference: passed`。终端打印 `candidate/` 与 `report.md` 的真实路径。`.artifacts/` 内保存完整实验，不进入 Git；重复运行演示会恢复同一个示例并替换其回归脚本。自己做实验时使用默认数据目录或单独设置 `YUUKI_GITHUB_LAB_DIR`，避免把自己的候选与固定演示混用。

## 工具

| 工具 | 行为 |
| --- | --- |
| `discover_projects` | 按关键词和语言发现公开项目，默认 TS；结合已做实验、反馈和兴趣 topic 排序、去重 |
| `find_experiments` | 寻找已合并的修复 PR，默认不返回正文或补丁 |
| `prepare_experiment` | 检查任务大小，固定共同祖先和 PR head，准备简报、基线与候选工作树；重复请求恢复原实验 |
| `read_source` | 分页读取候选源码，附完整文件指纹 |
| `set_regression_test` | 保存默认导出断言函数的 TypeScript ESM 脚本 |
| `run_check` | 对基线、候选或参考版本运行同一断言，保存日志、状态与版本指纹 |
| `reveal_solution` | 做过基线和候选尝试后显式取回参考版本和补丁 |
| `get_experiment` | 根据真实回执刷新 Markdown 报告；测试或候选源码改变会使旧成功失效 |
| `save_feedback` | 保存 interested / skip / done 与 topic，影响下一轮发现 |

服务器只使用 GitHub GET 接口。调度和模型推理由宿主提供；当前没有定时任务、账户互动或 MCP App 界面。

## 接入 stdio 客户端

先执行 `pnpm --dir examples/github-lab-mcp build`。客户端使用本机 Node 可执行文件启动 `examples/github-lab-mcp/dist/src/stdio.js`。例如在仓库根目录运行：

```bash
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/github-lab-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-github-lab -- "$MCP_NODE" "$MCP_SERVER"
```

注册命令依据 [Claude Code 的本地 stdio MCP 文档](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。本次验证了示例客户端，没有修改你的宿主配置。

默认数据目录为 `~/.yuuki/github-lab`。可以通过客户端环境设置绝对路径 `YUUKI_GITHUB_LAB_DIR`；token 只从 `GITHUB_TOKEN` 读取，不写进实验文件，不传给 Git 或检查进程。`YUUKI_GITHUB_API_URL` 仅允许公共 GitHub API 或无凭据的 `http://127.0.0.1:<port>` 测试服务。

## 执行边界

`run_check` 只启动本机 Node，不接受 shell 命令。它使用 10 秒超时、128 MiB V8 堆限制和 64 KiB 总日志上限；只授予检查脚本及目标目录的读取权限，不授予文件写入、创建子进程、Worker 或 native addon 权限。子进程环境不继承 token、`NODE_OPTIONS` 或模型凭据。普通断言失败、运行错误、超时和取消是不同结果。

**这适用于已经检查过的小型源码实验。Node 权限模型不防御恶意代码，也不限制网络；独立 Git 工作树不是操作系统沙箱。** 依据 [Node 24 的权限说明](https://github.com/nodejs/node/blob/v24.15.0/doc/api/permissions.md)。不要把任意搜索结果直接交给 `run_check`。任务准备只获取代码，执行由单独的工具调用触发。

当前任务范围：未归档的公开仓库，GitHub 元数据大小 ≤ 50,000 KB，PR 已合并、改动 ≤ 12 个文件、提交 ≤ 20 个。检查时目标须 ≤ 10,000 个文件、50 MiB 且不含符号链接；仓库的 `.git` 元数据不计入源码指纹。Git 每次最多等待 45 秒，单次网络 API 最多 15 秒；不自动重试。API 权限或限额失败会明确报错。

默认隐藏指协议响应和简报不返回官方补丁；内部 `experiment.json` 仍保存参考 SHA，PR 标题、Issue 和 GitHub 链接也可能提供线索。它是学习流程，不能用来证明模型没有见过答案。

## 读代码

- `src/contracts.ts`：Zod 契约及推导出的 TS 类型。
- `src/github.ts`：Octokit 只读搜索、PR 和版本定位。
- `src/lab.ts`：独立工作树、持久化、指纹和实验判定。
- `src/process.ts`、`src/check-worker.ts`：进程生命周期、权限与断言结果。
- `src/server.ts`、`src/stdio.ts`：MCP 工具注册和协议启动。
- `src/client.ts`、`src/demo.ts`：真实 stdio 客户端和固定公开案例。

测试使用本地临时 Git 仓库与模拟 API，不依赖在线搜索、账号或付费模型。另有 `demo` 验证真实 GitHub 和完整 MCP 调用链。
