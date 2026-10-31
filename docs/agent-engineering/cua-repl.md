# Codex 与 cua_repl：接口、连接与状态

**`cua_repl` 是本次 Codex 会话用于操作界面的 JavaScript 工具运行环境。** 它接收代码，通过宿主提供的 `cua` API 访问应用或浏览器，再把状态、文字和图片交回模型。它不是模型名称，也不是在网页控制台里自动存在的全局对象。

先读[执行原理](computer-use.md)，再把本篇中的名字放回对应层。公开产品说明核对于 **2026-10-31**；下面精确的方法名与首次调用规则来自本次工具返回的运行时说明，后续会话应以当时说明为准。

## 四个容易混在一起的名字

| 名字 | 本篇中的含义 |
| --- | --- |
| Computer Use | 通过图形界面观察并执行任务的能力；也用于产品功能名称 |
| CUA | 常见于 Computer-Using Agent 等称呼；具体含义要看来源，不能仅凭缩写判断是哪套产品 |
| `mcp__cua_repl.js` / `cua_repl` | 当前宿主暴露给 Agent 的工具入口与持久 JavaScript 会话 |
| `cua` | 该运行环境预先提供的 API 对象，如 `getState()`、`getApp()`、`getTab()` |

工具名带 `mcp` 前缀，只能帮助识别当前宿主中的工具命名；这些 JavaScript 方法不是 MCP 标准方法。也不能把 `await cua.getState()` 直接复制到普通 Node、Chrome 控制台或 OpenAI API 示例里，期待凭空出现同样的宿主能力。

OpenAI 的公开 API 文档另有 computer tool 和自建代码执行环境的接法；它们与桌面产品中现成的 `cua_repl` 不能直接画等号。[OpenAI Computer Use API](https://developers.openai.com/api/docs/guides/tools-computer-use)

## JavaScript 到底在哪里运行

从当前接口契约可以确认的调用关系是：

```text
模型生成 JavaScript
    ↓
cua_repl 执行代码，持有 app / tab 等绑定
    ↓
cua API 访问被选中的桌面或浏览器入口
    ↓
返回界面状态、截图或错误
```

`app`、`tab` 可以理解为操作目标的句柄。拿到句柄不等于把整份应用内存或浏览器 DOM 搬进模型；后续仍要调用支持的方法获取观察。

**这段代码的默认作用域是工具运行环境。** 它不是页面里的 JavaScript，也不能根据名字推断能访问任意文件、网络或系统 API。实际能力由工具说明与权限决定。`await` 表示等待异步调用完成，不表示已经满足用户的任务目标。

接口能证明这里有原生应用、AX、截图和浏览器入口；仅凭接口无法确定闭源宿主内部的进程布局、实现语言或每个方法使用的驱动。本文不把“可能通过某种系统 API 实现”写成“Codex 源码就是这样”。

## 先分清桌面应用和浏览器连接

本次工具的 `getState()` 返回的是入口清单：

| 字段 | 能说明什么 | 不能直接说明什么 |
| --- | --- | --- |
| `apps` | 可发现的桌面应用及部分运行信息 | 应用已获授权；Chrome 扩展已接通 |
| `browsers` | 当前可用的浏览器提供方及其标签页 | 所有安装过的浏览器都应出现在这里 |
| `errors` | 哪类清单读取失败 | 失败清单中的实际对象不存在 |

2026-10-31 这次读取中，桌面清单包含 Chrome；浏览器清单为空，同时报告了以下错误。下面只保留与判断有关的字段：

```json
{
  "apps": [{ "displayName": "Google Chrome", "id": "com.google.Chrome" }],
  "browsers": [],
  "errors": ["Browsers: Error: The browser access host is unavailable"]
}
```

正确结论是：**这次浏览器入口清单没有成功读出，不能确认浏览器连接状态。** 它没有证明“扩展未安装”，也没有证明“Chrome 没运行”。桌面清单仍可作为桌面路线的发现依据；是否允许使用该应用，还要由目标选择与权限检查决定。

如果 `browsers` 为空且没有相关读取错误，结论才是“当前未发现浏览器连接”。这时对普通、未指定目标的已授权桌面任务，应按清单选择原生应用入口，而不是猜一个浏览器 ID 连续试错。

## 首次调用怎样选入口

这些是**本次工具契约的示意用法**，代码在 `cua_repl` 内由 Agent 执行。各分支是替代关系，不应整段连续运行。

### 没有指定浏览器或标签页

首次只执行下面这一句，先读返回的说明和清单：

```javascript
await cua.getState();
```

如果任务目标是清单中的 macOS 应用，下一次才选应用。例如用户确实要求操作 TextEdit，而且已从清单确认目标时：

```javascript
let app = await cua.getApp("com.apple.TextEdit");
```

`getApp()` 会返回初始界面状态；应用未运行时也可能被启动。因此它与“只列出应用”不是同一个动作。

### 用户已经明确指定目标

明确的浏览器或标签页请求，应直接遵循对应入口规则，不必先做全局清单读取：

| 已知目标 | 本次接口中的入口 |
| --- | --- |
| 标签页 @-mention | `cua.getTab({ mention: tabMentionUrl })`，使用完整引用 |
| 已知 URL 和浏览器 | `cua.getTab({ url }, { browser: browserId })` |
| 已知标签页 ID 和浏览器 | `cua.getTab(tabId, { browser: browserId })` |
| 在指定浏览器新开页面 | `cua.createBrowserTab(browserName, url, options)` |
| 用户指定桌面应用 | `cua.getApp(appNameOrId)` |

`getBrowser()` 只选择浏览器，不会新建标签页；`getTab()` 绑定现有页；`createBrowserTab()` 才是创建。具体提供方支持哪些操作，继续读它返回的文档，不能把方法名当作所有入口都可用的保证。

<details class="qa">
<summary>浏览器作为桌面应用，和浏览器专用连接有什么区别？</summary>

`getApp("com.google.Chrome")` 选择的是原生应用入口；浏览器连接还可表达 profile、标签页与页面级操作。两者可能通向同一个 Chrome，但对象范围和操作方式不同。

内置浏览器则使用独立 profile，不会自动共享你平时 Chrome 的标签页和登录态。官方浏览器文档还把普通 Browser Use 与受控的开发者 CDP 访问分开，不能因为能打开网页就推断能随意读取浏览器内部数据。[OpenAI Browser 文档](https://learn.chatgpt.com/docs/browser)

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

假设刚返回的 AX 状态中，编号 `42` 明确对应用户要求修改的标题输入框，下面才是一个动作示例：

```javascript
// 42 只是示意：必须换成当前观察中确认的目标编号。
await app.setValue(42, "周计划");
await app.getAXState();
```

这个例子展示调用顺序，本次没有执行。方法是否适用于该控件，要看实际返回的能力和结果。

当前工具有几条与原理直接相关的约定：

- **元素编号依赖当前观察。** 操作后读取新状态；用户切换窗口或标签页后重新定位。截图单独读取后，若要重新依赖 AX 编号，应获取完整树。
- **AX 可能返回差量。** “没有变化”不等于“没有界面”。需要完整上下文时可用 `getAXState({ disableDiffing: true })`。
- **有方法名不等于该入口能执行。** DOM-only 标签页可能返回没有数字编号的 DOM 快照，原生输入包装方法会拒绝；应使用该浏览器文档提供的定位器接口。
- **观察方法会自动输出。** `getState()`、`getAXState()`、截图等已展示结果，无需再包一层 `nodeRepl.write()`；自行整理的文字用 `nodeRepl.write()`，额外图片用 `nodeRepl.emitImage()`。

这些细节来自本次运行时说明，而不是对所有名为 Computer Use 的产品的统一规定。

## 持久 REPL 保存了什么

REPL 是 Read–Eval–Print Loop：接收代码、执行、返回结果，再继续。当前 `cua_repl` 的 JavaScript 绑定可跨工具调用保留，所以后一轮可以继续使用前一轮的 `app`。

| 状态 | 在哪里 | 重置时需要注意什么 |
| --- | --- | --- |
| 模型上下文 | 会话中的任务、观察和历史 | 不保证永远包含旧细节；压缩后的描述也不是实时界面 |
| REPL 变量 | JavaScript 运行环境 | `js_reset` 清除变量和绑定 |
| 应用 / 浏览器状态 | 被操作环境 | 重置 REPL 不会关闭应用、清空标签页或撤销已发生的输入 |
| 持久数据 | 文件、网站服务端、账号等 | 需要通过对应系统检查；不能靠清除聊天或变量回滚 |

因此“变量还在”不等于“界面没变”；“重新开始工具会话”也不等于“重新开始业务事务”。OpenAI API 文档同样区分对话状态与执行环境：继续一个 response，不会自动恢复浏览器登录态和运行时变量。[状态保留说明](https://developers.openai.com/api/docs/guides/tools-computer-use#preserve-state-and-return-observations)

<details class="qa">
<summary>能写 JavaScript，是否就能绕过工具权限？</summary>

不能这样理解。脚本能调用什么，取决于宿主暴露的能力与权限检查；代码表达能力和系统授权是两回事。

公开产品文档区分操作系统权限、应用批准以及文件和 shell 的沙箱规则，并明确限制自动化终端和客户端自身。当前会话也不允许通过 Computer Use 操作 `com.openai.codex`；遇到该限制不能换入口绕过去。[OpenAI Computer Use 权限说明](https://learn.chatgpt.com/docs/computer-use)

</details>

## 一个适合建立正确认识的任务描述

```text
用 Computer Use 查看我指定的测试应用。
先确认本次可用的入口，说明使用的是桌面应用还是浏览器连接。
读取当前状态，只修改测试文档的标题为“周计划”。
修改后重新观察，告诉我标题是否生效、是否已经保存。
```

这里的重点是给出目标、可核对的结果与范围。接口选择、元素编号与恢复策略应由 Agent 根据实际状态完成。

下一篇：[其他 AI 工具怎样提供同类能力](computer-use-ecosystem.md)。
