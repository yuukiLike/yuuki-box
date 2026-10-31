# 同类工具：Claude、Gemini、Playwright MCP 与浏览器 Agent

**比较这类工具，先问它交付了哪一层：模型能力、动作接口、执行框架，还是包含环境与权限的完整产品。** 名字都带 Agent 或 Computer Use，不代表可以互相替换。

本篇核对于 **2026-10-31**，只比较公开文档能确认的机制，不做未经同条件测试的性能排名。回看[共同执行原理](computer-use.md)与 [Codex 的 cua_repl](cua-repl.md)。

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

上表按下列各节的一手资料归纳。它不是可用模型、平台、版本、付费套餐或工具成员数量的完整清单。

## OpenAI：产品入口与开发者接法分开理解

桌面产品已经提供入口发现、应用批准与 UI 操作；本次会话由 `cua_repl` 暴露相关能力。开发者使用 Responses API 时，还要提供动作执行、截图回传和环境生命周期。两者都能实现 Computer Use，工程责任却不同。[桌面 Computer Use](https://learn.chatgpt.com/docs/computer-use)、[Responses 接入指南](https://developers.openai.com/api/docs/guides/tools-computer-use)

这也解释了为什么“我的模型支持 Computer Use”和“当前会话已经连上我的 Chrome”是两条独立判断。

## Anthropic：桌面工具、网页工具和 Chrome 产品

Claude 的 Computer Use API 将截图与输入操作定义为客户端工具调用，接入程序执行并回传结果。Browser Use API 则提供网页结构、元素和标签页等语义，并可结合截图；不需要为每个网页任务准备完整桌面。[Computer Use 工具](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)、[Browser Use 工具](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool)

Claude in Chrome 是面向使用者的扩展产品。官方列出的权限用途包括：通过 `scripting` 读取页面内容，通过 `debugger` 控制点击、输入和截图。它能与 Claude Code 等入口配合，但不是“把 Computer Use API key 填进 Chrome 就自动得到”的同一个接口。[Claude in Chrome](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)

值得借鉴的设计是**按环境选择工具粒度**：桌面需要通用图形操作；网页可以利用额外语义。不能把某一代桌面模型采用的纯截图方式，推广成该厂商所有浏览器产品永远只看像素。

## Google：模型动作仍需执行器翻译

Gemini 的公开接法同样把模型与客户端执行环境分开。模型根据截图生成动作，客户端执行、获取新观察，再继续循环。它的动作坐标契约也提醒我们：不同供应商的数据格式不应直接混用，应由适配层转换到目标环境的坐标空间。[Gemini Computer Use](https://ai.google.dev/gemini-api/docs/computer-use)

迁移这类能力时，真正要核对的是动作 schema、坐标、调用 ID、结果回传、停止条件和权限处理。只替换模型名称，通常不能让原来的驱动自动兼容另一家协议。

## Playwright MCP：给模型一组浏览器工具

Playwright MCP 的主要路线是把浏览器可访问性快照交给模型，模型再用元素引用操作页面。这条路线可以让不具备图像输入能力的模型参与网页操作；需要检查视觉时，截图仍有用途。[Playwright MCP](https://github.com/microsoft/playwright-mcp)

它主要补的是**工具层**。MCP 负责接入协议，Playwright 负责浏览器操作，外部 Agent 负责选工具和推进任务。安装它并不会把 Playwright 本身变成会规划任务的语言模型。

Playwright 的自动等待会检查元素是否满足可点击等条件；它不能保证模型选中的“删除”按钮就是用户想删的那条记录。工程可靠性与语义正确性要分别验证。[Playwright actionability](https://playwright.dev/docs/actionability)

## Browser Use 与 Stagehand：组织代码和模型的方式不同

Browser Use 的开源库提供 `Agent`，可接不同模型，并配置浏览器、步骤和输出；视觉是否加入也有独立选项。它的云产品另行区分“把任务交给托管 Agent”和“只取得一个浏览器连接”。[开源入口](https://docs.browser-use.com/open-source/quickstart)、[Agent 参数](https://docs.browser-use.com/open-source/customize/agent/all-parameters)、[云产品入口](https://docs.browser-use.com/cloud/quickstart)

Stagehand 提供自然语言动作、结构化提取、可用动作观察，也提供 Playwright 风格的页面 API，允许开发者在同一份程序中决定哪些步骤使用模型。[Stagehand 概览](https://docs.stagehand.dev/v4/first-steps/introduction)、[浏览器连接](https://docs.stagehand.dev/v4/configuration/browser)

教学上可以这样区分：Browser Use 的 `Agent` 入口适合研究一个任务如何循环推进；Stagehand 的 primitives 适合研究怎样把模型嵌进已有流程。这是阅读角度，不是两者互斥的能力边界。

例如“进入固定后台 → 找到新改版后的筛选器 → 提取五条记录”，固定导航与数据校验可以写成代码，识别改版后的控件交给模型。这里的 AI 价值集中在有歧义的步骤，不必每次机械点击都重新推理。

## UI-TARS：看清模型训练和桌面应用的边界

UI-TARS 的公开工程同时提供模型信息、动作解析示例，以及指向独立桌面项目的入口。以公开的 UI-TARS-1.5 为例，项目说明了视觉语言模型与强化学习方向，也提供把模型输出转换为动作的后处理代码。[UI-TARS 官方仓库](https://github.com/bytedance/UI-TARS)

它适合回答“除了把 API 包起来，GUI Agent 本身还训练了什么能力”。但下载模型权重，只完成了推理侧的一部分；截图、输入、权限、窗口绑定、记录与验证仍要由工程系统提供。也不能把某个公开版本的训练方式当作其他闭源产品的已知实现。

## 这些方案究竟新增了什么

下面是基于上述接口的工程归纳：

| 层 | 新增价值 | 仍然要解决的问题 |
| --- | --- | --- |
| 模型 | 更好的界面理解、目标定位、动作选择与失败纠正 | 对真实任务的理解仍可能错误 |
| 工具与框架 | 把截图、页面结构、输入和执行结果接成可调用能力 | 连接、状态失效、权限与错误传播 |
| 产品 | 把环境、登录、审批、任务记录和用户接管组织起来 | 可用性受平台、账户、策略与当前连接限制 |

传统自动化已经有“点击”和“输入”。AI 带来的关键变化之一，是让运行时根据自然语言和当前界面选择下一步。与此同时，稳定的固定流程依然值得保留为明确代码；加入模型后仍需要可验证的完成条件。

<details class="qa">
<summary>看到一个新产品演示，怎样判断它是不是同一种能力？</summary>

依次找五个答案：模型拿到的是图像还是结构？动作由什么程序执行？环境在本机还是云端？谁保存会话与登录态？谁核对业务结果？

“它成功订了一次票”只能证明那次演示的路径。没有公开文档或源码时，无法仅凭演示确定是否使用 DOM、浏览器扩展、远程桌面、业务 API，或它们的组合。

</details>

下一篇：[常见理解误区与自测](computer-use-misconceptions.md)。
