# Yuuki Box：怎样搭配，下一步验证什么

本章仅为<mark class="caution">研究建议，非已定选型</mark>；本轮只增文档与证据，不改应用。

相关：[调查入口](README.md) · [Rust 动机](01-why-rust.md) · [Zed 架构](02-zed-architecture.md) · [PI 实例](03-pi-desktop.md)。

## 1. 接着已有实现学习

已有 [Rust/GPUI、Swift、React 原生桥、WKWebView、Electron 五个 MVP](../../../examples/README.md)。Rust/GPUI 是正式路线，早期“Swift 起步”不代表排除 Rust。

[GPUI 示例](../../../examples/rust-gpui/README.md) 使用 `gpui = "=0.2.2"`、`runtime_shaders`、定高虚拟列表和 Swift 语音 helper。构建/未运行项见 README，本轮未重验。

下一步<mark class="key">追清状态、后台工作与跨进程取消</mark>，再决定独立 Rust core 的职责。

## 2. 三种搭配，各自优化不同问题

| 路线 | 结构 | 适合验证什么 | 必须承担的成本 |
|---|---|---|---|
| Rust + GPUI 主体 | GPUI UI + Rust model/runtime；Apple 能力通过本地适配 | 共享类型和状态、细粒度刷新、后台快照与绘制路径 | GPUI 控件行为、输入法/可访问性、Rust UI 生命周期、平台能力接入 |
| React/Electron + Rust host | Web UI + Electron Main + Rust host；需要时接 Node Agent | 接近 PI 的分工，复用 Web 与供应商生态，独立宿主可用于 headless | 双语言、进程发布、RPC、取消/重启/事件顺序、浏览器运行时成本 |
| Swift UI + Rust core | SwiftUI/AppKit + Rust 领域能力；根据粒度选 FFI 或进程接口 | Apple 交互和系统能力，同时学习可移植核心 | 双语言模型、边界编码、构建/符号/线程规则、错误和资源所有权 |

此表不作性能排名：Zed 支持第一种思路，PI 支持第二种，Apple 设备目标使第三种仍值得保留。

可移植性取决于依赖：纯类型/状态易隔离，GPUI Context、Electron IPC、macOS helper 或进程管理需适配。尚无 iPhone/iPad 示例，不承诺直接复用移动 UI/后台执行。

## 3. 从两个项目分别带走什么

| 需要解决的事 | Zed 可学的方式 | PI 可学的方式 | Yuuki 的最小落点 |
|---|---|---|---|
| UI 更新 | Entity、notify、typed event、增量映射 | React/store 接收结构化事件 | 活动消息更新不反复处理所有历史 |
| 后台工作 | snapshot + background executor + 前台应用结果 | 独立 Agent/host 进程，事件返回 | 结果携带 session/turn 身份，回写前检查是否仍适用 |
| 停止 | Task 所有权、取消信号、弱实体 | turnId、工具 abort、进程清理 | 停止显示、停止工具、结束 turn 各有明确含义 |
| 数据权威 | Project/BufferStore 等持有实体与版本 | Rust 管宿主状态，JSONL 正文 + SQLite 索引 | 每类持久数据指定一个写入者 |
| 故障恢复 | snapshot/operation 与应用服务边界 | outbox、幂等消息 ID、重启与恢复 | 区分已接收、已写盘、已完成 |
| 扩展/模型生态 | provider、Agent、扩展宿主各有接口 | pi-ai/Node 保留供应商支持 | 先用少量模型与工具，再按真实需求增加适配 |

首版不必复制 CRDT、远端配对、插件 SDK 或全套恢复。用户要求自建 loop，PI 复用成熟 pi 仅供参考，不替换该方向。

## 4. 对“极简”的具体定义

极简 Agent 工作台可以有清楚的四个角色：

```text
UI：输入、展示、发取消意图
  ↓ 命令；↑ 结构化事件
会话控制：sessionId / turnId / 状态转换
  ├─ Agent loop：模型请求 → 工具请求 → 结果回填 → 停止判断
  └─ Host：工具执行、权限判定、持久化、进程资源
```

这是责任提案，不是已有模块或四进程要求。Rust/GPUI 可先同进程，按 Node 需求再加协议；先管理已有 Apple Speech helper 跨进程接口。

按复用、独立测试和 UI/平台依赖边界决定是否拆 crate；模仿目录不能复制 Zed 的数据结构与生命周期收益。

## 5. 建议的源码阅读顺序

1. **自己的输入与 Render。** 看 [GPUI MVP main.rs](../../../examples/rust-gpui/src/main.rs:350) 和 `uniform_list`，确认状态、可见索引与 notify 的关系。
2. **自己的流任务。** 看 [start_ticker](../../../examples/rust-gpui/src/main.rs:145)，再对照 Zed [命令面板后台匹配](https://github.com/zed-industries/zed/blob/7ea077c78b865d17854cee812bb775dbe64a925a/crates/command_palette/src/command_palette.rs#L580)。关注线程、Task 的持有者与取消。Zed main 与发布版 GPUI API 不能混用。
3. **自己的平台桥。** 看 [start_speech](../../../examples/rust-gpui/src/main.rs:246)、[stop_speech](../../../examples/rust-gpui/src/main.rs:285) 和 [Swift helper 协议](../../../examples/shared/native/README.md)。关注 stdout 分帧、EOF、停止和退出。
4. **PI 的持久化闭环。** 看 HostProcess[^pi-1] → RPC appendMessage[^pi-2] → append_record[^pi-3]。先理解请求、记录与索引，再读恢复。
5. **Zed 的数据结构。** 按 SumTree → Rope → text::Buffer → language::Buffer 阅读。大量可编辑文本需要这些设计；普通 Agent 日志列表可以先把它们作为算法学习素材。

## 6. 用同一负载验证

以下实验未执行。共用事件 fixture，对齐功能/构建模式；输入法、多行 Markdown、动态高度另建负载，定高单行列表不代表完整聊天。

| 实验 | 记录什么 | 能回答什么 |
|---|---|---|
| 一万条历史 + 固定事件流 | 输入延迟 p50/p95/p99、主线程忙碌段、可见行创建数量 | 虚拟化是否限制更新范围 |
| 输出时切会话/取消 | 取消到停止的时间、旧事件是否写入新会话 | 生命周期与身份检查是否正确 |
| 多行文本逐块追加 | 解析时间、布局次数、滚动位置变化 | 数据处理和渲染是否保持增量 |
| 关闭窗口/子进程异常退出 | pending 请求终止、残留进程、恢复结果 | 隔离是否伴随清理与恢复 |
| 冷/热启动及空闲 | 首窗时间、RSS、CPU/能耗、shader 开关 | runtime_shaders 和打包结构的实际代价 |
| 同类改动增量构建 | 耗时、修改范围、依赖缓存状态 | 学习和迭代成本能否接受 |

记录机器、系统、commit/工作树、fixture、构建模式、冷/热、次数、工具及误差；dev GPUI 不与优化 Swift 排名，功能、文本和布局也须对齐。[比较边界](../../../examples/COMPARISON.md)

两个待测点：满容量后的 `Vec::remove(0)`/索引重建为 O(n)，语音期间 50 ms timer 持续轮询/通知。可对比环形存储和事件送达，尚非已证实故障。[移除事件](../../../examples/rust-gpui/src/main.rs:173)、[ticker](../../../examples/rust-gpui/src/main.rs:145)

## 7. 这次调查支持的范围

继续沿 Rust/GPUI 学习，以 PI 理解混合架构，先掌握状态权威、异步结果、取消和持久化。

最终 UI、独立 host、双存储和移动端仍待实现/测量。保留自建 loop；改用 pi 须另评需求与控制范围，不照收参考项目全架构。

## 本地源码引用说明

PI 引用定位 2026-09-26 本地工作树，无公开链接；含未归入 HEAD 的暂存改动，不能仅凭提交号重建，本次未重验运行行为。

[^pi-1]: `PI-Desktop/packages/host-runtime/src/host-process.ts:94`，来自上述本地调查记录。
[^pi-2]: `PI-Desktop/crates/host-core/src/rpc/mod.rs:2392`，来自上述本地调查记录。
[^pi-3]: `PI-Desktop/crates/host-core/src/sessions.rs:2099`，来自上述本地调查记录。
