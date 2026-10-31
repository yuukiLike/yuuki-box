# Computer Use：模型怎样看界面、做动作、检查结果

**Computer Use 把图形界面接进 Agent 的工具循环：模型根据观察提出动作，外部程序执行，再把新的界面状态交回模型。** 模型能力、工具接口、浏览器连接和操作系统权限各有职责；换一个模型不会自动补齐其他部分。

这组知识点按四篇阅读，也可以直接跳到你遇到的问题：

| 顺序 | 入口 | 读完能解释什么 |
| --- | --- | --- |
| 1 | 本篇：执行原理 | 截图、AX、DOM、CDP 分别在哪一层；一次点击怎样发生 |
| 2 | [Codex 与 cua_repl](cua-repl.md) | JavaScript 在哪里运行，变量怎样保留，桌面与浏览器怎样连接 |
| 3 | [同类工具对照](computer-use-ecosystem.md) | Claude、Gemini、Playwright MCP、Browser Use、Stagehand 与 UI-TARS 各提供什么 |
| 4 | [理解误区与自测](computer-use-misconceptions.md) | 为什么能看见却不能操作，调用成功却没完成，重试可能重复提交 |

资料核对：**2026-10-31**。公开产品事实附官方来源；`cua_repl` 的细节来自本次会话实际返回的工具说明。图和架构拆解是教学归纳，不代表厂商未公开的内部源码。本次只读取了连接清单与接口说明，没有执行桌面点击、安装扩展或调用付费模型做实验。

## 一次“把标题改为周计划”怎样完成

[![Computer Use 闭环：模型提出动作，Harness 检查，驱动操作应用，再把截图或结构化状态送回模型](../../site/public/diagrams/agent-engineering/computer-use-loop.svg)](../../site/public/diagrams/agent-engineering/computer-use-loop.svg)

假设目标是一份已经打开的测试文档，用户要求把标题改为“周计划”：

1. **观察。** 宿主读取目标窗口的截图或界面结构，模型才知道标题输入框在哪里、当前写着什么。
2. **定位。** 模型把“标题”对应到一个元素引用、定位器或坐标。这一步通常叫 grounding，即把意图落到具体界面目标。
3. **提出动作。** 输出可能是一个结构化工具调用，也可能是一小段操作界面的代码。
4. **执行。** Harness 检查目标与权限，驱动程序输入文字。操作系统或浏览器处理真实事件。
5. **核对。** 重新读取界面，确认标题真的变了。若任务要求保存，还要确认保存状态，而不是停在输入完成。

OpenAI 的 Responses Computer Use 文档明确区分模型返回的动作与应用执行动作的责任；其代码执行路线则让应用提供运行环境并返回观察结果。[OpenAI Computer Use](https://developers.openai.com/api/docs/guides/tools-computer-use)

这里有三个不同的“成功”：**模型生成了合法调用 → 驱动执行没有报错 → 用户要求的结果已经成立。** 前两个都不能代替第三个。

## 先分清五层

| 层 | 输入与输出 | 不应混淆的责任 |
| --- | --- | --- |
| 模型 | 任务、观察、历史 → 动作或代码 | 推理和选择动作；并不直接获得操作系统权限 |
| Harness | 模型调用 → 校验、执行、记录、下一轮上下文 | 管理预算、取消、失败与恢复 |
| 工具接口 / 运行时 | 结构化参数或脚本 → 返回值、错误、图片 | 例如 `cua_repl`；规定可调用哪些能力 |
| 驱动与连接 | 元素引用、坐标、文字 → 浏览器或系统操作 | 绑定哪个应用、窗口、标签页、浏览器 profile |
| 被操作环境 | 真实输入 → 页面和应用状态变化 | 持有登录态、文件、焦点、弹窗和业务数据 |

MCP 可以把其中的工具暴露给宿主；Skill 可以说明应该按什么步骤使用它们。两者都不替代驱动和目标环境。可以回看 [MCP 工具源](01-mcp-tool-source.md)与 [Skills 结构](03-skills-structure.md)。

## “看见界面”有三种常见表示

| 表示 | 模型收到什么 | 适合什么 | 缺少什么 |
| --- | --- | --- | --- |
| 截图 / 像素 | 窗口或视口图像 | 位置、颜色、遮挡、图表、画布、自绘控件 | 没有天然的 DOM 节点身份；定位受缩放和画面变化影响 |
| AX / 可访问性树 | 按钮、文本框等角色，以及名称、值、状态 | 根据语义寻找“保存”按钮或标题框 | 完整程度取决于应用；不能完整表达视觉布局 |
| DOM / 页面结构 | 网页元素、属性、文本及工具允许读取的页面信息 | 表单、列表、网页定位与调试 | 不覆盖所有原生应用；也不能直接解释画布内每个对象 |

AX 是 accessibility 的常见缩写。可访问性树通常来自应用或浏览器提供的语义，不能简单理解为“截图 OCR 以后变成的树”。DOM 与 AX 也不是同一棵树：前者组织网页节点，后者表达可访问的交互语义。[Apple AXUIElement API](https://developer.apple.com/documentation/applicationservices/axuielement_h)、[Playwright MCP 快照](https://github.com/microsoft/playwright.dev/blob/main/mcp/snapshots.mdx)

**“我检查过页面”必须带着观察范围理解。** 读到了按钮文字，可以支持“按钮存在”；确认颜色、对齐或遮挡，需要对应的视觉证据。看到一张截图，也不能证明它以外的所有标签页都已检查。

<details class="qa">
<summary>模型怎样从截图生成点击位置？必须先做 OCR 吗？</summary>

可以把视觉路线理解为：图像经过视觉编码，与任务文字和历史一起进入模型；模型生成动作表示，再由程序解析为坐标和输入事件。OCR、元素检测或标号覆盖层都可以参与，但不是所有实现都必须具有的独立步骤。

公开的 UI-TARS 提供了模型输出解析与坐标后处理代码，能看到“模型结果 → 动作结构 → 自动化代码”的边界。它说明 GUI 能力可以专门训练；不能据此推断 Codex、Claude 或 Gemini 内部采用了相同网络、训练数据或解析器。[UI-TARS 模型与后处理](https://github.com/bytedance/UI-TARS)

</details>

## 再往下：谁真正完成点击

**macOS 原生应用路线。** 可访问性客户端可以通过 `AXUIElement` 读取元素属性、设置受支持的值、请求元素执行动作；屏幕捕获则可由 ScreenCaptureKit 等系统能力提供。两种能力解决不同问题，所以“有录屏权限”不推出“能操作控件”。这是公开的系统实现材料，不是对 Codex 使用了哪些具体系统函数的源码确认。[Apple AXUIElement API](https://developer.apple.com/documentation/applicationservices/axuielement_h)、[ScreenCaptureKit 示例](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos)

**浏览器路线。** 驱动可通过浏览器自动化接口定位元素、派发输入和获取截图。CDP（Chrome DevTools Protocol）是 Chromium 的调试协议；Chrome 扩展的 `chrome.debugger` 可以作为它的传输入口，访问受支持的 DOM、Input、Network 等域。CDP 是控制通道，不负责理解用户意图。[Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)

**隔离桌面路线。** 应用也可以运行在虚拟机或容器中的图形环境，由外部程序抓图和发送输入。Claude 的参考环境展示了这种组合：虚拟显示、桌面应用、动作实现与 Agent 循环分别存在。模型服务不会因为收到截图，就自行连接到这台机器。[Claude Computer Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)

上述路线可以组合。一个产品既能操作原生应用，也能通过浏览器专用通道操作网页；不能从“它点了网页按钮”倒推出使用的是哪种驱动。

<details class="qa">
<summary>屏幕坐标、截图像素和网页 CSS 像素为什么不能直接混用？</summary>

截图可能缩放或裁剪，网页有视口与滚动偏移，屏幕还可能有不同的像素密度。假设截图只做了等比缩小，原图宽 1440、输入图宽 720，那么输入图的横坐标 300 对应原图 600；一旦还有裁剪，就要继续加上裁剪原点。

这是简化计算，不能代替具体驱动契约。不同工具也可能使用归一化坐标。执行器必须知道坐标属于哪一张图、哪一个窗口和哪一套尺寸。[OpenAI 截图与分辨率](https://developers.openai.com/api/docs/guides/tools-computer-use-integration#capture-screenshots)

</details>

## 为什么使用“代码执行”入口

下面是两种**概念示意**，不是可以直接调用的通用 API：

```text
结构化动作：模型 → click(元素引用) → 工具结果
代码执行：  模型 → 一段脚本 → 脚本调用界面 API → 工具结果
```

代码入口可以复用对象、做条件判断、整理结果，把一组已知步骤放在一次往返里。它不会让模型在每条 `await` 后自动重新思考：脚本继续执行，模型通常在这一轮结果返回后才作下一次判断。

因此，适合合并的是“在已确认的输入框填值，然后读取状态”这样的短序列。遇到未知弹窗、页面跳转或目标可能变化时，应先返回新观察。减少往返和保留反馈需要同时考虑。

OpenAI 的公开指南同时描述代码执行与结构化 computer actions；这两种交互形式不应被写成谁已经完全取代谁。[OpenAI 代码执行路线](https://developers.openai.com/api/docs/guides/tools-computer-use#use-code-execution)

## 如果给 Yuuki 增加这种能力

下面是与本仓库 Harness 对应的**设计建议，尚未实现**：

| 现有职责 | 增加 GUI 后需要明确什么 |
| --- | --- |
| ToolCall | 操作属于哪个应用、窗口或标签页；依据哪次观察 |
| 执行策略 | 用户授权的目标和操作；驱动自身允许的能力 |
| 工具结果 | 返回值之外，附上执行后的状态或证据引用 |
| 取消与恢复 | 停止后续动作；对已经发生但回执丢失的副作用先核对 |
| 运行报告 | 模型耗时、驱动耗时、等待页面耗时、失败原因分别记录 |

第一步可以只做“读取一个测试窗口的标题与截图”。第二步再加一个可逆动作和独立结果检查。不要因为有了 `click()`，就把一长串网页操作视为已经可靠。

读下一篇：[Codex 与 cua_repl：接口、连接与状态](cua-repl.md)。
