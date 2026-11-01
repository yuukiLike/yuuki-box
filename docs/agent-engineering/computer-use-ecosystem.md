# 同类工具：Claude、Gemini、Playwright MCP 与浏览器 Agent

先看工具<mark class="key">交付了哪一层</mark>：模型、动作接口、框架，还是包含环境与权限的产品。

核对：**2026-10-31**。仅比较公开机制，未做性能排名。前置：[共同原理](computer-use.md)、[cua_repl](cua-repl.md)。

## 一张对照表

| 方案 | 交付的主要东西 | 观察 / 动作方式 | 执行环境由谁提供 |
| --- | --- | --- | --- |
| Codex / ChatGPT 桌面 Computer Use | 产品中的工具、连接和访问控制 | 当前 `cua_repl` 可接原生应用与浏览器；支持方式由入口说明决定 | 桌面宿主连接用户授权的环境 |
| OpenAI Responses Computer Use | API 动作契约及接入指导 | 结构化 computer actions；也有代码执行接法 | 在这些接法中，由接入方运行浏览器或桌面 |
| Claude Computer Use API | 桌面动作工具集 | 截图、坐标、鼠标和键盘 | 接入方执行调用、返回结果 |
| Claude Browser Use API / Claude in Chrome | 前者是网页工具集；后者是扩展产品 | 页面结构、截图与网页交互；具体接口不同 | 前者由接入方提供；后者接用户 Chrome |
| Gemini Computer Use API | 模型可生成的 UI 动作及工具契约 | 截图 → 动作 → 新截图 | 接入方实现执行端；环境能力按模型文档核对 |
| Microsoft Playwright MCP | 把浏览器操作暴露为 MCP 工具 | 以结构化可访问性快照与元素引用为主要交互依据 | MCP server 连接或启动浏览器；模型由宿主选择 |
| Browser Use | 开源浏览器 Agent 库；另有云 Agent 与浏览器基础设施 | 组织模型、页面信息、可选视觉与浏览器操作 | 可本地运行，也可使用其云产品 |
| Stagehand | 可以嵌入代码的浏览器自动化框架 | `act` / `extract` / `observe` 与确定性页面操作混用 | 按配置连接本地或远程浏览器 |
| UI-TARS | GUI 方向的视觉语言模型及相关开源工程 | 从视觉输入生成动作，再解析和执行 | 需要另配推理与执行环境；桌面项目是另一个组成部分 |

表格据下列一手资料归纳，不是版本、平台或套餐的完整清单。

## OpenAI：产品入口与开发者接法分开理解

桌面产品提供发现、批准和操作入口，本次为 `cua_repl`；接 Responses API 则须自行执行动作、回传截图、管理环境。[桌面 Computer Use](https://learn.chatgpt.com/docs/computer-use)、[Responses 接入](https://developers.openai.com/api/docs/guides/tools-computer-use)

<mark class="caution">模型支持，不代表当前浏览器已连接</mark>。

## Anthropic：桌面工具、网页工具和 Chrome 产品

Computer Use API 由客户端执行截图和输入；Browser Use API 提供结构、元素、标签页和截图，可用于不需要完整桌面的网页任务。[Computer Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)、[Browser Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool)

Claude in Chrome 是扩展产品，以 `scripting` 读页面、`debugger` 控制输入和截图，可配合 Claude Code；不是往 Chrome 填入 Computer Use API key 即可获得的接口。[Claude in Chrome](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)

按环境选工具粒度：桌面用通用图形动作，网页可利用语义；某代桌面模型的截图路线不代表全部产品。

## Google：模型动作仍需执行器翻译

Gemini 按截图生成动作，客户端执行并返回新观察。接入时由适配层转换动作与坐标，不能直接混用供应商格式。[Gemini Computer Use](https://ai.google.dev/gemini-api/docs/computer-use)

迁移须核对 schema、坐标、调用 ID、回传、停止与权限；只换模型名不够。

## Playwright MCP：给模型一组浏览器工具

Playwright MCP 主要以可访问性快照和元素引用操作页面，无图像输入的模型也可参与；视觉检查仍需截图。[Playwright MCP](https://github.com/microsoft/playwright-mcp)

它补工具层：MCP 负责接入，Playwright 执行浏览器动作，外部 Agent 规划任务。

自动等待检查可点击等条件，不检查是否选中了用户想删的记录；动作条件和意图须分别验证。[Playwright actionability](https://playwright.dev/docs/actionability)

## Browser Use 与 Stagehand：组织代码和模型的方式不同

Browser Use 的 `Agent` 可配模型、浏览器、步骤、输出和视觉；云产品区分托管 Agent 与单独浏览器连接。[开源入口](https://docs.browser-use.com/open-source/quickstart)、[参数](https://docs.browser-use.com/open-source/customize/agent/all-parameters)、[云入口](https://docs.browser-use.com/cloud/quickstart)

Stagehand 将自然语言动作、结构化提取、动作观察与 Playwright 风格 API 混用，由程序决定哪些步骤交给模型。[概览](https://docs.stagehand.dev/v4/first-steps/introduction)、[连接](https://docs.stagehand.dev/v4/configuration/browser)

学习时可用 Browser Use 看任务循环，用 Stagehand 看模型嵌入流程；这是阅读角度，不是互斥边界。

例如后台导航和数据校验写成代码，只让模型识别改版后的筛选器，不必每次点击都推理。

## UI-TARS：看清模型训练和桌面应用的边界

UI-TARS 提供模型、动作解析和独立桌面项目入口；UI-TARS-1.5 公开了视觉语言模型、强化学习与动作后处理。[官方仓库](https://github.com/bytedance/UI-TARS)

它适合研究 GUI 专项训练。下载权重后仍需截图、输入、权限、窗口绑定、记录和验证；不能据此推断闭源产品的训练方式。

## 这些方案究竟新增了什么

下面是基于上述接口的工程归纳：

| 层 | 新增价值 | 仍然要解决的问题 |
| --- | --- | --- |
| 模型 | 更好的界面理解、目标定位、动作选择与失败纠正 | 对真实任务的理解仍可能错误 |
| 工具与框架 | 把截图、页面结构、输入和执行结果接成可调用能力 | 连接、状态失效、权限与错误传播 |
| 产品 | 把环境、登录、审批、任务记录和用户接管组织起来 | 可用性受平台、账户、策略与当前连接限制 |

AI 让运行时按语言和界面选下一步；稳定流程仍宜保留为代码，并定义可验证的完成条件。

<details class="qa">
<summary>看到一个新产品演示，怎样判断它是不是同一种能力？</summary>

看五项：图像或结构、执行程序、本机或云端、会话与登录态、业务验收。

一次订票成功只证明那条路径；无文档或源码，无法确定用了 DOM、扩展、远程桌面还是业务 API。

</details>

下一篇：[常见理解误区与自测](computer-use-misconceptions.md)。
