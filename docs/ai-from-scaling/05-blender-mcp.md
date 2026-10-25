# 第二个 MCP 做一个能拿在手里的模型

先做一个练琴桌面小托盘：外尺寸 **80 × 50 × 12 mm**，四周和底部各留 3 mm。把它保存为可编辑的 Blender 文件，检查网格，再导出 STL。

这是继[「接着做」](00-minimal-mcp.md)之后的第二个 MCP。接口继续使用 **TypeScript、官方 SDK 与 Zod**；建模由 Blender 自带的 Python API 执行。第一次只跑通一件事，能解释“参数怎样变成模型文件”就可以停。

![实际生成的练琴桌面托盘预览](../../site/public/images/blender-mcp-practice-tray.png)

## 先生成一次

需要 Node.js 22.22 或更高版本、pnpm 11.14，以及本机已经安装的 Blender。本次实际验证使用 macOS 上的 **Blender 5.2.3 LTS**；没有验证其他版本或实际打印机。

在仓库根目录执行：

```bash
pnpm --dir examples/blender-mcp install --frozen-lockfile
pnpm --dir examples/blender-mcp demo
```

演示会启动 MCP 服务，发现工具，依次创建、检查和导出托盘。模型留在 `examples/blender-mcp/.artifacts/`，终端打印实际路径：

```text
发现工具： create_model, inspect_model, export_stl
Blender 文件： …/model.blend
预览图： …/preview.png
尺寸（mm）： 80 × 50 × 12
网格闭合： true
STL 文件： …/model.stl
```

用 Blender 打开打印出的 `model.blend`，就能检查或继续编辑。演示中的参数由代码填写，不请求语言模型；接入聊天客户端后，再由模型把你的描述转成相同的工具参数。

**第一处停点：** 打开 [src/demo.ts](../../examples/blender-mcp/src/demo.ts)，找到两个长方体。大盒子减去向上移的小盒子，就是托盘的内部空间。

## 三个工具，连成一次建模

| 工具 | 输入 | 返回 |
| --- | --- | --- |
| `create_model` | 名称、按顺序合并或挖空的形状 | 新 `modelId`、`.blend` 路径、PNG 预览与网格信息 |
| `inspect_model` | `modelId` | 重新读取 `.blend` 后的尺寸、体积、面数与闭合检查 |
| `export_stl` | `modelId` | 通过闭合检查后的 STL 路径与文件大小 |

第一版支持长方体 `box`、圆柱 `cylinder`、球体 `sphere`。每项都有完整 XYZ 尺寸、中心位置、旋转角度，以及 `add` 或 `subtract`。尺寸和位置使用毫米，旋转使用度；最多 16 项，第一项必须为 `add`。生成的整体模型会移到 Z=0。

下面是托盘的请求；没有填写的旋转默认为零，第一项的操作默认为 `add`：

```json
{
  "name": "practice-tray",
  "parts": [
    { "shape": "box", "size": [80, 50, 12], "position": [0, 0, 6] },
    { "shape": "box", "size": [74, 44, 12], "position": [0, 0, 9], "operation": "subtract" }
  ]
}
```

每次创建都生成新目录，保存 `design.json`、`model.blend` 和 `preview.png`；导出后增加 `model.stl`。调整参数后再次创建，就能对照两份模型。`export_stl` 重复调用会替换对应目录里的旧 STL。

`inspect_model` 与 `export_stl` 每次重新读文件。手动编辑时保留名为 `MCP_Model` 的网格对象；导出只包含这个对象。闭合检查失败时报告错误，已有 STL 保持原样，因此失败后应继续检查 `.blend`，不能把旧导出当成刚才的新结果。

## 顺着一条调用学习 TS

```text
工具参数 → Zod 校验 → TS 工具回调 → 独立 Blender 进程
        → Python API 建模 → 文件与网格信息 → Zod 校验 → 客户端
```

| 文件 | 先看哪一处 |
| --- | --- |
| [src/contracts.ts](../../examples/blender-mcp/src/contracts.ts) | 用 schema 推导 `ModelInput`，并声明真实输出的结构 |
| [src/server.ts](../../examples/blender-mcp/src/server.ts) | 三个 `registerTool()` 怎样接入业务行为 |
| [src/blender.ts](../../examples/blender-mcp/src/blender.ts) | 用 `execFile()` 启动程序，通过 JSON 文件传参，再校验返回数据 |
| [worker.py](../../examples/blender-mcp/worker.py) | `bpy` 创建形状，布尔运算合并或挖空，`bmesh` 检查几何 |
| [src/client.ts](../../examples/blender-mcp/src/client.ts) | 连接和关闭、工具错误、输出校验与调用超时 |
| [src/stdio.ts](../../examples/blender-mcp/src/stdio.ts) | 独立启动入口，stdout 只发送协议消息 |

MCP 协议层和进程调度使用 TS；Python 文件是 Blender 执行的业务代码。调用方只能提交声明式形状数据，工具没有执行任意代码的参数。Blender 每次在独立后台进程中运行，文件是下一次操作的接续点。

编译器配置沿用第一个 MCP 的 `strict`、`NodeNext`、索引与可选字段检查。外部 JSON 先作为 `unknown` 接收，再通过 Zod；捕获到的错误先检查类型，再读取消息。代码里使用 `import type` 区分类型与实际导入。

一次 Blender 进程最多运行 90 秒，MCP 客户端等待上限为 100 秒；取消信号传给子进程。创建失败会清理本次新目录，并报告错误。

继续改一处参数，再执行：

```bash
pnpm --dir examples/blender-mcp check
pnpm --dir examples/blender-mcp demo
```

`check` 包含类型检查、编译和真实 Blender 测试，需要本机 Blender 能正常启动。测试直接解析 STL，检查毫米尺寸、闭合边与挖空体积，并故意破坏 `.blend` 的一个面，确认再次导出会被拒绝。

## 接到日常客户端

日常生成的模型默认保存到 `~/.yuuki/blender/`。设置 `YUUKI_BLENDER_DIR` 为其他绝对路径，可以改变输出位置。`BLENDER_BIN` 可以指定可执行文件；未指定时优先使用 macOS 的 `/Applications/Blender.app/Contents/MacOS/Blender`，该路径不存在时使用 PATH 中的 `blender`。

如果已安装 Claude Code，在仓库根目录执行：

```bash
pnpm --dir examples/blender-mcp build
MCP_NODE=$(command -v node)
MCP_SERVER="$PWD/examples/blender-mcp/dist/src/stdio.js"
claude mcp add --transport stdio yuuki-blender -- "$MCP_NODE" "$MCP_SERVER"
claude mcp get yuuki-blender
```

整个示例目录需要一起保留，包括 `worker.py`。实际连接后，在 `/mcp` 检查工具，再试着说：

```text
用 yuuki-blender 做一个 80×50×12 毫米的桌面托盘，底和四周各留 3 毫米。
先创建并展示预览，再检查网格；闭合检查通过后导出 STL。
```

客户端注册写法来自 [Claude Code 官方文档](https://code.claude.com/docs/en/mcp#option-3-add-a-local-stdio-server)。本次验证了仓库里的 MCP 客户端，没有修改或验证你的 Claude Code 配置。

## 从 STL 到实物还差什么

STL 不携带单位；本例保留毫米数值，切片时按毫米解释。闭合检查只检查网格的非流形边、零面积面与非零体积，不能代替壁厚、悬空、支撑、材料和实际打印验收。将 STL 放进你使用的切片软件，先核对外尺寸，再检查切片预览。

本次没有连接打印机或发送打印任务。生成模型和实际打印是两个需要分别验证的步骤。

接口资料：[Blender Python API](https://docs.blender.org/api/5.2/info_overview.html) · [布尔运算](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/booleans.html) · [STL 导出源码中的单位处理](https://github.com/blender/blender/blob/main/source/blender/io/stl/exporter/stl_export.cc)。

返回[课程总览](README.md) · [第一个 MCP](00-minimal-mcp.md)。第三个 music-eyes MCP 的用途，留到本例完成后再讨论。
