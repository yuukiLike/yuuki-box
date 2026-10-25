# Yuuki Blender MCP

使用 TypeScript、官方 MCP SDK 和 Zod，通过本机 Blender 创建毫米尺寸模型，检查网格并导出 STL。工具：`create_model`、`inspect_model`、`export_stl`。

在仓库根目录执行；需要 Node.js 22.22+、pnpm 11.14 和可运行的 Blender：

```bash
pnpm --dir examples/blender-mcp install --frozen-lockfile
pnpm --dir examples/blender-mcp check
pnpm --dir examples/blender-mcp demo
```

演示保留 `.artifacts/` 中的 `.blend`、PNG 与 STL，终端打印实际路径。日常 MCP 输出默认放在 `~/.yuuki/blender/`；`YUUKI_BLENDER_DIR` 可指定其他绝对路径，`BLENDER_BIN` 可指定 Blender 可执行文件。客户端直接启动编译后的 `dist/src/stdio.js`，保留整个目录和 `worker.py`。

教程与接入方式：[第二个 MCP：让参数变成模型](../../docs/ai-from-scaling/05-blender-mcp.md)。对照俯视与剖面图修改尺寸，再核对输出。几何检查通过后仍需在切片软件核对尺寸、壁厚和支撑；本例没有发送打印任务。
