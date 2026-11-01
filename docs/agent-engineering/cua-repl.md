# Codex 与 cua_repl：接口、连接与状态

`cua_repl` 是本次会话的 <mark class="key">JavaScript 工具运行环境</mark>：执行代码，经 `cua` 操作应用或浏览器并回传结果。它不是模型，也不是网页控制台自带对象。

前置：[执行原理](computer-use.md)。产品资料核对于 **2026-10-31**；方法名和首次调用规则来自本次工具说明，后续以各次说明为准。

## 四个容易混在一起的名字

| 名字 | 本篇中的含义 |
| --- | --- |
| Computer Use | 通过图形界面观察并执行任务的能力；也用于产品功能名称 |
| CUA | 常见于 Computer-Using Agent 等称呼；具体含义要看来源，不能仅凭缩写判断是哪套产品 |
| `mcp__cua_repl.js` / `cua_repl` | 当前宿主暴露给 Agent 的工具入口与持久 JavaScript 会话 |
| `cua` | 该运行环境预先提供的 API 对象，如 `getState()`、`getApp()`、`getTab()` |

`mcp` 前缀是宿主命名，JavaScript 方法不是 MCP 标准；普通 Node、Chrome 控制台或 API 示例不会自带 `cua`。

公开 API 的 computer tool、自建执行环境与桌面 `cua_repl` 是不同接法。[OpenAI Computer Use API](https://developers.openai.com/api/docs/guides/tools-computer-use)

## JavaScript 到底在哪里运行

当前契约中的调用关系：

```text
模型生成 JavaScript
    ↓
cua_repl 执行代码，持有 app / tab 等绑定
    ↓
cua API 访问被选中的桌面或浏览器入口
    ↓
返回界面状态、截图或错误
```

`app`、`tab` 是目标句柄，不包含完整应用内存或 DOM；仍须调用方法获取观察。

代码默认运行在工具环境，能力由接口与权限决定，不意味着任意文件、网络或系统访问。`await` 等待调用，不证明任务完成。

接口仅确认原生应用、AX、截图和浏览器入口，不揭示宿主进程、语言或驱动源码。

## 先分清桌面应用和浏览器连接

本次工具的 `getState()` 返回的是入口清单：

| 字段 | 能说明什么 | 不能直接说明什么 |
| --- | --- | --- |
| `apps` | 可发现的桌面应用及部分运行信息 | 应用已获授权；Chrome 扩展已接通 |
| `browsers` | 当前可用的浏览器提供方及其标签页 | 所有安装过的浏览器都应出现在这里 |
| `errors` | 哪类清单读取失败 | 失败清单中的实际对象不存在 |

2026-10-31 的清单含 Chrome，但浏览器读取报错；相关字段如下：

```json
{
  "apps": [{ "displayName": "Google Chrome", "id": "com.google.Chrome" }],
  "browsers": [],
  "errors": ["Browsers: Error: The browser access host is unavailable"]
}
```

结论是<mark class="caution">浏览器清单读取失败，连接状态未知</mark>，不能据此断言扩展未安装或 Chrome 未运行。桌面发现与应用授权另行检查。

无读取错误且 `browsers` 为空，才是“当前未发现连接”。未指定目标的已授权桌面任务按清单选原生入口，不猜浏览器 ID。

## 首次调用怎样选入口

以下是本次契约的示意用法，由 Agent 在 `cua_repl` 执行；分支互为替代，不连续运行。

### 没有指定浏览器或标签页

首次只执行一句，读取说明和清单：

```javascript
await cua.getState();
```

下一次再选应用。例如用户指定且清单已确认 TextEdit：

```javascript
let app = await cua.getApp("com.apple.TextEdit");
```

`getApp()` 返回初始状态，也可能启动应用，不只是列清单。

### 用户已经明确指定目标

明确指定目标时，直接按对应规则进入：

| 已知目标 | 本次接口中的入口 |
| --- | --- |
| 标签页 @-mention | `cua.getTab({ mention: tabMentionUrl })`，使用完整引用 |
| 已知 URL 和浏览器 | `cua.getTab({ url }, { browser: browserId })` |
| 已知标签页 ID 和浏览器 | `cua.getTab(tabId, { browser: browserId })` |
| 在指定浏览器新开页面 | `cua.createBrowserTab(browserName, url, options)` |
| 用户指定桌面应用 | `cua.getApp(appNameOrId)` |

`getBrowser()` 选浏览器，`getTab()` 绑定现有页，`createBrowserTab()` 新建页；实际支持范围看提供方返回的文档。

<details class="qa">
<summary>浏览器作为桌面应用，和浏览器专用连接有什么区别？</summary>

`getApp("com.google.Chrome")` 选择原生应用；浏览器连接还可指定 profile、标签页及页面操作，两者范围不同。

内置浏览器使用独立 profile，不自动共享日常标签页和登录态。Browser Use 与开发者 CDP 访问也分开，打开网页不代表能任意读取内部数据。[OpenAI Browser](https://learn.chatgpt.com/docs/browser)

</details>

## 观察与操作要形成一小段闭环

当前原生接口可以读取：

```javascript
await app.getAXState();
```

需要视觉信息时可以读取截图，或同时取得结构与截图：

```javascript
await app.getAXStateAndScreenshot();
```

当前 AX 中 `42` 已确认是标题框时，才可这样操作：

```javascript
// 42 只是示意：必须换成当前观察中确认的目标编号。
await app.setValue(42, "周计划");
await app.getAXState();
```

本次未执行此例；控件是否支持该方法须看实际结果。

当前工具有几条与原理直接相关的约定：

- <mark class="key">编号依赖当前观察</mark>：操作后读取新状态，切窗后重新定位；单独读截图后需重新依赖 AX 编号时，取完整树。
- **AX 可返回差量。** “无变化”不等于“无界面”；完整状态用 `getAXState({ disableDiffing: true })`。
- **方法存在不等于入口支持。** DOM-only 快照可能没有数字编号，应按浏览器文档使用定位器，不套原生输入方法。
- **观察方法自动输出。** `getState()`、`getAXState()` 和截图无需再包 `nodeRepl.write()`；自整理文字用它，额外图片用 `nodeRepl.emitImage()`。

这些是本次运行时约定，并非通用 Computer Use 规范。

## 持久 REPL 保存了什么

REPL（Read–Eval–Print Loop）循环读取、执行和返回结果；本次绑定可跨调用保留，下一轮能继续用 `app`。

| 状态 | 在哪里 | 重置时需要注意什么 |
| --- | --- | --- |
| 模型上下文 | 会话中的任务、观察和历史 | 不保证永远包含旧细节；压缩后的描述也不是实时界面 |
| REPL 变量 | JavaScript 运行环境 | `js_reset` 清除变量和绑定 |
| 应用 / 浏览器状态 | 被操作环境 | 重置 REPL 不会关闭应用、清空标签页或撤销已发生的输入 |
| 持久数据 | 文件、网站服务端、账号等 | 需要通过对应系统检查；不能靠清除聊天或变量回滚 |

变量保留不保证界面未变，重置也不回滚业务。继续 API response 不会自动恢复登录态和运行时变量。[状态保留](https://developers.openai.com/api/docs/guides/tools-computer-use#preserve-state-and-return-observations)

<details class="qa">
<summary>能写 JavaScript，是否就能绕过工具权限？</summary>

不能。脚本受宿主能力和权限检查约束。

系统权限、应用批准、文件与 shell 沙箱分别生效；本次禁止操作 `com.openai.codex`，不能换入口绕过。终端及客户端自身另有自动化限制。[OpenAI 权限说明](https://learn.chatgpt.com/docs/computer-use)

</details>

## 一个适合建立正确认识的任务描述

```text
用 Computer Use 查看我指定的测试应用。
先确认本次可用的入口，说明使用的是桌面应用还是浏览器连接。
读取当前状态，只修改测试文档的标题为“周计划”。
修改后重新观察，告诉我标题是否生效、是否已经保存。
```

说明目标、结果与范围；Agent 按实际状态选择入口、编号和恢复策略。

下一篇：[其他 AI 工具怎样提供同类能力](computer-use-ecosystem.md)。
