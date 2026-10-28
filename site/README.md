# Yuuki Astro 文档站

以 Astro 与 Starlight 浏览仓库的学习资料，按具体内容组织为七条路线：MCP 接入与模型训练、AI 修复与质量检查、Agent 运行控制与工具接入、前端通信与缓存计算、语音合成与转写、AI 探索方案、Mac 架构研究。最前面的 MCP 开场提供可运行的本地服务、客户端和官方案例入口。

## 本地运行

使用 Node.js 22.22 或更高版本，以及项目声明的 pnpm 11.14。

在仓库根目录执行：

```bash
pnpm i
pnpm --dir site i
pnpm docs:dev
```

终端会打印实际预览地址，默认是 `http://127.0.0.1:4321/`。生产构建后的全文搜索可以用 preview 查看：

```bash
pnpm docs:build
pnpm --dir site preview
```

当前 Astro 的 preview 会管理后台预览进程。查看状态用 `pnpm --dir site exec astro preview status`，停止用 `pnpm --dir site exec astro preview stop`。

## 部署到 Cloudflare Pages

在仓库根目录执行，首次使用先登录 Cloudflare：

```bash
pnpm --dir site exec wrangler login
pnpm docs:deploy
```

首次部署按提示选择或创建 Pages 项目。`docs:deploy` 会先构建文档并校验静态资源，成功后通过 `wrangler pages deploy dist` 上传 `site/dist/`；构建或校验失败时停止，不会发起上传。这是 Cloudflare Pages 的 [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) 方式。

也可以显式指定项目和分支：

```bash
pnpm docs:deploy --project-name your-pages-project --branch main
```

将 `your-pages-project` 替换为实际的 Pages 项目名。分支应与 Pages 项目的生产分支一致；其他分支会创建预览部署。不传 `--branch` 时，Wrangler 使用当前 Git 分支。

如果通过 Pages 控制台连接 Git 仓库自动部署，使用以下[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)：

| 设置 | 值 |
| --- | --- |
| 根目录 | `site` |
| 构建命令 | `pnpm build` |
| 构建输出目录 | `dist` |
| 环境变量 `NODE_VERSION` | `24.18.0` |
| 环境变量 `PNPM_VERSION` | `11.14.0` |

Pages 会在 `site/` 自动安装依赖，再执行构建命令。Node.js 与 pnpm 的版本通过 Pages [构建环境变量](https://developers.cloudflare.com/pages/configuration/build-image/) 设置。

## 验证

```bash
pnpm --dir site check
pnpm --dir site test
pnpm --dir site build
```

正式构建会刷新 Markdown 渲染缓存，并检查页面引用的静态资源是否存在，避免旧缓存保留已失效的代码块样式路径，导致代码高亮和复制按钮丢失。

## 内容维护

- 正文继续编辑仓库 `docs/**/*.md`；一级标题用作页面标题，正文渲染时去掉重复的一级标题。
- 正文先给结论与必要操作；延伸问答用默认收起的 `<details class="qa">`，补充资料用 `<details>`。折叠行用常规字重、细分隔线，绿色与浅蓝色只点缀箭头和展开标题；展开后的文字也应精简。
- `src/content.config.ts` 基于 Astro glob loader 直接读取这些文件，保留原生文件监听与内容处理。
- `src/lib/docs-paths.mjs` 将 Markdown 相对链接转换为站内路由；源码链接指向仓库，教学脚本由静态 source 路由提供。其他本机 checkout 的绝对路径显示为文字。
- 导图等静态资源放在 `public/`；Markdown 使用指向 `site/public/` 的仓库相对路径，站点会将图片与原图链接一起转换为公开资源路径。
- `src/lib/navigation.mjs` 统一维护阅读顺序、具体标题、主题标签、专题颜色与总览描述；`astro.config.mjs` 将其接入 Starlight。首页、阅读页标题与页内大纲展示主题标签；侧栏使用同一阅读顺序，只显示标题。浏览器实验在 `src/pages/labs`，小型交互组件在 `src/components`。
- 导航按任务分类：开发实践下分任务交付、质量检查与 Issue 夜班；Agent 下按 Harness、MCP、Skills 的建设顺序组织；前端实验下分查找与缓存、模型缓存、浏览器计算、界面响应。三个浏览器实验各自放回对应专题。
- `README.md` 对应 `/guide/`，子目录的 `README.md` 对应该目录；其他 Markdown 文件名保留在路由中。

浏览器实验只运行本地数据、容量公式和微型 Wasm 模块，不下载 AI 模型。历史文档保留原来的验证范围。

## 轻量展示

默认开启轻量模式：首页展示每个专题的具体描述、可点击的主题标签和一个入口，章节按需展开；收起章节后仍能看到主题细节并通过标签直达。阅读页收起侧栏与右侧大纲，保留搜索、返回目录和页内目录入口。顶栏的「轻量模式」按钮可以切回完整展示，选择保存在当前浏览器中；浏览器禁用存储时，本页仍可切换。导航和标题采用中性文字；首页和阅读页保留翠绿、天蓝、粉色、金黄与橙色的胶囊标签，使用浅色底和细描边，侧栏只显示标题。首页收紧页头与专题间距，目录标题和标签按可用宽度同行排列。专题颜色也用于首页分隔线，同时适配深浅主题。

桌面端轻量模式下，页面左边缘有低对比度的目录图标按钮，点击可展开原有侧栏，正文为侧栏让出空间。按钮随侧栏移到右边缘，可再次点击收起；点击正文不会关闭目录。展开时聚焦当前章节，在目录内按 Esc 收起后焦点回到按钮。开关状态不写入存储，页面跳转、切换展示模式或跨过桌面断点时会重置。

不运行 JavaScript 时，章节仍可通过原生折叠控件展开。导航分类与源码路径分别维护：Issue 夜班教程位于 `docs/issue-garden/`，有公开使用记录的案例位于 `docs/ai-practices/`，Agent 工程实验位于 `docs/agent-engineering/`，头脑风暴构想位于 `docs/ai-ideas/`。正文保留各自的证据与验证状态；工作流示例保留在文档中，站点不会自动启用 GitHub 自动化。
