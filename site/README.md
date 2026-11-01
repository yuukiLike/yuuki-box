# Yuuki Astro 文档站

以 Astro 与 Starlight 浏览仓库的学习资料，按学习目标组织十七个专题：MCP 入门、AI 搭子（同行者）、模型基础、模型推理与 KV Cache、Agent 工程、MCP 项目实战、远程 MCP 与授权、AI 开发实践、应用通信、前端性能、语音交互、AI 探索、架构研究、项目设计与计划、云端 Codex、Windows 本地 AI、阅读同步。MCP 入门排在首页与侧栏的第一个专题；「AI 搭子（同行者）」以「Side by Side」为标语，探索一起思考和做事，排在第二，当前优先实践 Issue 自动化。四小时路线和前端与 AI 联读指南单独串联相关专题；阅读同步作为最后一课，用两张 SVG 分别说明开发者如何开发、使用者如何跨设备同步。

## 本地运行

使用 Node.js 22.22 或更高版本，以及项目声明的 pnpm 11.14。

在仓库根目录执行：

```bash
pnpm i
pnpm docs:dev
```

<details>
<summary>命令说明</summary>

| 命令 | 用途 |
| --- | --- |
| `pnpm i` | 安装依赖 |
| `pnpm docs:dev` | 启动文档站 |

`--frozen-lockfile`：按锁文件安装；需更新时，报错停止。[官方说明](https://pnpm.io/cli/install#--frozen-lockfile)

</details>

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
pnpm --dir site check:functions
pnpm --dir site build
```

正式构建会刷新 Markdown 渲染缓存，并检查页面引用的静态资源是否存在，避免旧缓存保留已失效的代码块样式路径，导致代码高亮和复制按钮丢失。

## Apple 账号同步（可选）

课程目录末尾的[最后一课：Apple 登录与阅读同步](../docs/learning/apple-reading-sync.md)提供两种 SVG 视角：开发者如何串起本地进度、账号认证、接口与部署；使用者如何登录并在两台设备间同步。以下保留维护者配置步骤。

所有文档都可直接阅读，阅读进度默认保存在当前浏览器，无需登录。Apple 登录仅用于可选的跨设备同步；未登录时不会上传进度，未配置云同步或同步暂时不可用时也可继续阅读和记录本地进度。

需要跨设备同步时，主动打开顶部导航栏中、专注阅读按钮旁的「阅读同步」，选择 Apple 登录。窄屏时显示云朵图标，展开面板位于导航栏下方。登录后把本地记录移入当前账号的缓存并上传，其他设备在本站登录同一 Apple 账号即可共享进度。多设备合并时保留较高百分比，不会因回看或离线设备上传而倒退。

滚动停止后自动上传，页面在前台时每 30 秒获取云端更新，重新聚焦或联网时也会检查同步。断网时保留本地记录并显示待重试状态。各 Apple 账号使用独立缓存，退出后恢复匿名记录；退出只结束当前设备的站内会话。站内会话有效期为 7 天，过期需重新登录。

### 先准备 Apple 登录

以下配置仅供站点维护者启用可选的跨设备同步，普通阅读和本地进度记录不依赖这组配置。

Apple 官方当前要求：网页登录关联一个已在 App Store 中、启用了 Sign in with Apple 的 App，并为网站配置 Services ID。还需要 Apple Developer 账号中相应的配置权限。只有普通 Apple 账号或开启 iCloud，无法启用这项网站能力。如果还没有对应 App，需先满足这一接入条件。[Apple 环境配置](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)

在 Apple Developer 的 **Certificates, Identifiers & Profiles** 中完成以下配置：

1. 在已有的主 App ID 上启用 **Sign in with Apple**。
2. 创建网站的 **Services ID**，例如 `com.example.docs.web`，启用 Sign in with Apple，并关联上述主 App ID。
3. 在 **Domains and Subdomains** 填入正式网站域名，例如 `docs.example.com`；在 **Return URLs** 填入 `https://docs.example.com/api/reading/callback`。此处没有末尾斜杠，必须与代码回调地址一致。
4. 创建启用了 Sign in with Apple 的 **Key** 并关联同一主 App ID，下载 `.p8` 私钥，记下 **Key ID** 和开发者账号的 **Team ID**。私钥只配置在后端，不提交到仓库，也不粘贴到聊天中。

这里的域名和 ID 都是示例，需要替换为自己的实际值。Apple 回调要求 HTTPS 域名，不支持 IP 或 `localhost`。本实现只请求稳定的用户标识，不请求姓名或邮箱，使用授权码回调和服务端验证来建立站内会话。[网页登录配置步骤](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web)、[授权请求参数](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.)

### 配置 Cloudflare Pages 与数据库

以下命令在仓库根目录运行，把 `your-pages-project` 替换为现有 Pages 项目名。已有项目先下载配置，并保留已有的绑定与环境变量：

```bash
pnpm --dir site exec wrangler pages download config your-pages-project
pnpm --dir site exec wrangler d1 create yuuki-reading
```

将 `site/wrangler.example.jsonc` 中的 `d1_databases`、兼容日期和 `nodejs_compat` 配置合并到下载的 Wrangler 配置中，填入创建数据库时返回的真实 `database_id`。数据库绑定名必须是 `READING_DB`。新项目可把示例复制为 `site/wrangler.jsonc`，再修改项目名和数据库 ID。不要把示例里的全零 ID 部署到线上。Pages 的配置文件会成为部署设置来源，应保留项目现有配置。[Pages 配置规则](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

在配置文件的 `vars` 中设置以下非敏感值：

| 变量 | 填写内容 |
| --- | --- |
| `SITE_ORIGIN` | 固定的正式源地址，例如 `https://docs.example.com`，末尾不加 `/` |
| `APPLE_SERVICE_ID` | 网站的 Services ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_KEY_ID` | `.p8` 对应的 Key ID |

创建表并配置两个后端 Secret：

```bash
pnpm --dir site exec wrangler d1 migrations apply yuuki-reading --remote
pnpm --dir site exec wrangler pages secret put APPLE_PRIVATE_KEY --project-name your-pages-project < /absolute/path/to/AuthKey_YOUR_KEY_ID.p8
pnpm --dir site exec wrangler pages secret put SESSION_SECRET --project-name your-pages-project
```

`SESSION_SECRET` 使用独立的随机值，例如在自己的终端运行 `openssl rand -base64 32` 后，将结果粘贴到上面命令的私密输入提示中。不要把 Secret 写入 `vars`。`.p8` 内容可以保留真实换行，也可以使用字面量 `\n`。

配置完成后再发布：

```bash
pnpm docs:deploy --project-name your-pages-project --branch main
```

页面仍由 Astro 静态生成；`site/public/_routes.json` 只让 `/api/reading/*` 调用 Functions，正文和静态资源继续直接提供。`site/functions/api/reading/[action].ts` 由 Wrangler 随 Pages 部署为服务端接口，D1 保存进度和经过哈希的会话令牌。Apple 账号使用稳定用户标识的摘要关联，不保存 Apple 密码、姓名、邮箱或 Apple access/refresh token。配置或数据库绑定缺失时，接口明确返回未启用，页面保持本地记录。

### 验收与本地开发

发布后先在正式域名顶部导航栏打开「阅读同步」，应看到「通过 Apple 登录」。在第一台设备登录并阅读某篇文章，再用另一台设备登录同一 Apple 账号，打开同一文章，确认进度合并；用不同 Apple 账号登录应有各自独立记录。关闭网络后继续阅读，再联网，确认待同步进度补传。未完成这些真实账号验证前，只能确认代码和模拟登录流程已通过验证。

`pnpm docs:dev` 和 Astro preview 仅提供内容页面，不运行 Pages Functions，此时显示云同步未启用。需要本地 Functions 时，准备 `site/wrangler.jsonc`，按 `site/.dev.vars.example` 创建未跟踪的 `.dev.vars`，执行：

```bash
pnpm --dir site exec wrangler d1 migrations apply yuuki-reading --local
pnpm docs:build
pnpm --dir site exec wrangler pages dev dist
```

本地无法直接完成 Apple 的真实域名回调；认证、进度合并、账号隔离和失败恢复由测试中的模拟 Apple 响应覆盖。预览域名与 `SITE_ORIGIN` 不同时禁用云同步，避免把正式登录配置用于其他域名。修改示例中的绑定或变量名后运行 `pnpm --dir site types:reading`，重新生成绑定类型。

## 内容维护

- 正文继续编辑仓库 `docs/**/*.md`；一级标题用作页面标题，正文渲染时去掉重复的一级标题。
- 正文先给结论与必要操作；延伸问答用默认收起的 `<details class="qa">`，补充资料用 `<details>`。折叠行用常规字重、细分隔线，绿色与浅蓝色只点缀箭头和展开标题；展开后的文字也应精简。
- `src/content.config.ts` 基于 Astro glob loader 直接读取这些文件，保留原生文件监听与内容处理。
- `src/lib/docs-paths.mjs` 将 Markdown 相对链接转换为站内路由；源码链接指向仓库，教学脚本由静态 source 路由提供。其他本机 checkout 的绝对路径显示为文字。
- 导图等静态资源放在 `public/`；Markdown 使用指向 `site/public/` 的仓库相对路径，站点会将图片与原图链接一起转换为公开资源路径。
- `src/lib/navigation.mjs` 统一维护阅读顺序、具体标题、主题标签、专题颜色与总览描述；`astro.config.ts` 将其接入 Starlight，并监听导航文件触发配置重载。使用 TypeScript 配置让 Astro 经 Vite 重新加载导航依赖，避免开发服务只刷新正文标签却保留旧分组。首页、阅读页标题与页内大纲展示主题标签；侧栏使用同一阅读顺序，显示标题和阅读进度。浏览器实验在 `src/pages/labs`，小型交互组件在 `src/components`。
- 导航按学习目标分类：MCP 入门作为第一个专题，「AI 搭子（同行者）」排在第二，Issue 自动化是其中优先实践的章节，原有教程继续使用 `docs/issue-garden/` 路由。模型基础、MCP 项目实战、KV Cache、远程授权工程与项目设计各自独立，Harness 入门归入 Agent 工程。Agent 分为入门、运行控制、MCP、Skills、Computer Use 五段；前端性能保留查找缓存、浏览器计算与界面响应三段。三个浏览器实验各自放回对应专题。
- 跨专题导读在首页介绍和侧栏顶部提供入口，专题卡片只列本专题内容。调整分组不移动已有 Markdown 文件和路由；正文中的前置要求、选读说明与下一步建议同步维护。
- `README.md` 对应 `/guide/`，子目录的 `README.md` 对应该目录；其他 Markdown 文件名保留在路由中。

浏览器实验只运行本地数据、容量公式和微型 Wasm 模块，不下载 AI 模型。历史文档保留原来的验证范围。

## 轻量展示

首页保留完整目录；只有首页显示“继续阅读”图标，且仅在存在未完成任务时出现。文章不再重复提示回到上一任务。

文档与交互实验的“本章目标”默认折叠，展开后可开始或完成任务。当前任务及章节位置保存在本地；完成后收起，不自动分配下一章。任务不参与 Apple 阅读同步，正文进度与前后篇导航继续独立工作。

正文每篇只选少量短语强调：`<mark class="key">` 标动作与结论，`<mark class="caution">` 标限制与易错点。两类使用颜色和浅底色，适配深浅主题；下划线只用于可点击链接，代码块与整段文字不染色。

首页与侧栏最底部保留“附录”分组。[OpenAI API 模型分类与选型](../docs/appendix/openai-api-models.md)按用途提供速查、模型分析与停用计划，作为课程之后的查阅材料。

阅读页自动记录正文的浏览进度，无需手动标记：正文进入视口后显示「阅读过」及百分比，浏览到正文末尾后显示「阅读完毕」。状态紧跟文章标题，以小图标和文字呈现，窄屏空间不足时换到标题下一行；正文末尾、首页章节和侧栏也同步显示状态。百分比按正文到达的最远位置计算，回看前文不会倒退；跳转到末尾也会记为阅读完毕，折叠内容以当前展开状态计算。这表示浏览进度，不判断是否理解内容。状态按文档地址保存在当前浏览器，刷新、页面跳转后保留，同一站点的标签页也会同步；配置并登录 Apple 账号后，还会跨浏览器和设备同步，配置步骤见上文。浏览器无法保存时会提示，本页仍可记录。首页目录和错误页面不计入阅读进度。

默认开启「专注阅读」（原「轻量模式」）：首页展示每个专题的具体描述、可点击的主题标签和一个入口，章节按需展开；阅读页收起右侧大纲，保留搜索和页内目录入口。顶栏的「专注阅读」按钮控制章节详情和页内大纲，选择保存在当前浏览器中，并沿用原有偏好；浏览器禁用存储时，本页仍可切换。导航和标题采用中性文字；首页和阅读页保留翠绿、天蓝、粉色、金黄与橙色的胶囊标签，使用浅色底和细描边，侧栏显示标题和阅读进度。首页收紧页头与专题间距，目录标题和标签按可用宽度同行排列。专题颜色也用于首页分隔线，同时适配深浅主题。

桌面左上角、站点名称旁有无边框的课程目录图标，独立控制原有左侧栏，展开后正文为其让出空间。目录默认收起，切换「专注阅读」或点击正文不会改变目录状态；再次点击图标或在目录内按 Esc 可收起。展开时聚焦当前章节，Esc 收起后焦点回到图标。目录状态不写入存储，页面跳转或跨过桌面断点时重置。专题分组默认收起，Starlight 自动展开当前页所在的分支；首页卡片仍可分别展开。侧栏链接和分组标题保持单行，过长时省略，悬停显示完整名称；部分课程使用单独的短导航名，首页及文章仍保留完整标题。

不运行 JavaScript 时，章节仍可通过原生折叠控件展开。导航分类与源码路径分别维护：Issue 夜班教程位于 `docs/issue-garden/`，有公开使用记录的案例位于 `docs/ai-practices/`，Agent 工程实验位于 `docs/agent-engineering/`，头脑风暴构想位于 `docs/ai-ideas/`。正文保留各自的证据与验证状态；工作流示例保留在文档中，站点不会自动启用 GitHub 自动化。
