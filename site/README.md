# Yuuki Astro 文档站

以 Astro 与 Starlight 浏览仓库的学习资料，包含前端数据结构、KV Cache、WebAssembly，以及已有的渲染、语音与 Agent 研究。

## 本地运行

使用 Node.js 22.22 或更高版本，以及项目声明的 pnpm 11.14。

在仓库根目录执行：

```bash
pnpm i
pnpm docs:dev
```

终端会打印实际预览地址，默认是 `http://127.0.0.1:4321/`。生产构建后的全文搜索可以用 preview 查看：

```bash
pnpm --dir site build
pnpm --dir site preview
```

当前 Astro 的 preview 会管理后台预览进程。查看状态用 `pnpm --dir site exec astro preview status`，停止用 `pnpm --dir site exec astro preview stop`。

## 验证

```bash
pnpm --dir site check
pnpm --dir site test
pnpm --dir site build
```

正式构建会刷新 Markdown 渲染缓存，并检查页面引用的静态资源是否存在，避免旧缓存保留已失效的代码块样式路径，导致代码高亮和复制按钮丢失。

## 内容维护

- 正文继续编辑仓库 `docs/**/*.md`；一级标题用作页面标题，正文渲染时去掉重复的一级标题。
- `src/content.config.ts` 基于 Astro glob loader 直接读取这些文件，保留原生文件监听与内容处理。
- `src/lib/docs-paths.mjs` 将 Markdown 相对链接转换为站内路由；源码链接指向仓库，教学脚本由静态 source 路由提供。其他本机 checkout 的绝对路径显示为文字。
- 导图等静态资源放在 `public/`；Markdown 使用指向 `site/public/` 的仓库相对路径，站点会将图片与原图链接一起转换为公开资源路径。
- `astro.config.mjs` 管理阅读顺序，首页与侧栏使用同一份目录；浏览器实验在 `src/pages/labs`，小型交互组件在 `src/components`。
- `README.md` 对应 `/guide/`，子目录的 `README.md` 对应该目录；其他 Markdown 文件名保留在路由中。

浏览器实验只运行本地数据、容量公式和微型 Wasm 模块，不下载 AI 模型。历史文档保留原来的验证范围。

## 轻量展示

默认开启轻量模式：首页先展示每个专题的一个入口，章节按需展开；阅读页收起侧栏与右侧大纲，保留搜索、返回目录和页内目录入口。顶栏的「轻量模式」按钮可以切回完整展示，选择保存在当前浏览器中；浏览器禁用存储时，本页仍可切换。

不运行 JavaScript 时，章节仍可通过原生折叠控件展开。🍀「Issue 的夜班」教程从只读扫描开始，正文放在 `docs/issue-garden/`；工作流示例保留在文档中，站点不会自动启用 GitHub 自动化。
