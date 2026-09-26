# Deep 调查：Zed、Rust 与 PI-Desktop 的搭配

调查日期：**2026-09-26**。这轮在[前期产品调研](../../research/zed-raycast-warp.md)基础上，直接研究本地 Zed 和 PI-Desktop，回答为什么采用 Rust、各模块如何配合，以及哪些设计适合带回 Yuuki Box。

**核心发现：Zed 把 Rust 用成贯穿 UI、文本与后台任务的一套应用体系；PI 把 Rust 用成混合架构中的系统与数据核心。** 共同点是对性能、资源和边界的控制，搭配方式由产品目标决定。收益需要数据结构、增量更新、任务生命周期和协议一起兑现。

## 阅读顺序

| 文档 | 读完能回答的问题 |
|---|---|
| [01 · 为什么 Rust](01-why-rust.md) | 作者实际动机是什么？源码支持哪些收益与代价？附 Raycast/Warp 对照 |
| [02 · Zed 架构与调用链](02-zed-architecture.md) | crate 怎样分工？打开文件、输入、解析与绘制如何连接？GPUI/LSP/Wasm 如何配合？ |
| [03 · PI-Desktop 实例](03-pi-desktop.md) | Electron、Rust、Node 谁拥有状态？prompt、工具与持久化如何跨进程？怎样提炼极简骨架？ |
| [04 · Yuuki Box 搭配与验证](04-yuuki-box.md) | 如何接上已有五条 MVP？接下来读哪些代码，用什么负载验证？ |

先看 01 和 03 可以快速理解选型；想深入 Rust GUI、文本与异步架构，再完整阅读 02。04 是研究建议，不替用户确定最终技术栈。

后续调查：[简单、组合、复杂性](../2026-09-26-simplicity-composition-complexity/README.md)沿用本轮源码证据，加入 Raycast、Warp、Grok Build 的具体组合机制，并对照 Yuuki 新增的共享 runtime 与语音实现。两轮的本地项目状态不同，应分别按各自的观察日期和验证范围阅读。

## 关键结论

1. **crate 数量表达模块组织。** Zed 根清单有 253 个显式 workspace member，其中 246 个在 `crates/`；该目录实际有 248 份 manifest。这些既不是独立进程数，也不等于数百个团队各自推荐 Rust。
2. **Zed 的关键组合是快照与增量工作。** SumTree/Rope 提供结构共享，text/language 管版本与语法，MultiBuffer/Editor 管片段及显示变换，GPUI 管实体、事件、任务和画面。
3. **GPUI 的版本和平台差异必须记录。** 当前 checkout 已拆平台 crate：macOS 接 Metal，Linux Wayland/X11 接 wgpu，Windows 接 Direct3D 11。它与本项目 crates.io GPUI 0.2.2 不能仅按版本文本混用 API。
4. **PI 的整体实现已经超出极简规模。** 它只有一个 Rust crate，但 apps/packages 下有 11 个直接应用/库包。最值得提炼的是四个责任角色，以及 Main 分别连接 Rust host 和 Node Agent 的两条 sidecar 通道。
5. **PI 明确选择混合生态。** ADR 选择 Rust 做系统宿主，同时保留 Electron UI 与 pi 的 TypeScript/provider 层。当前桌面 Agent 用 Electron 自带 Node；普通 Desktop 会话正文为 JSONL，SQLite 保存索引，native Pi 会话另有路径。
6. **可以继续认真学习 Rust。** 现有证据不足以要求 Yuuki 的 UI、Agent 和所有 Apple 能力都统一到 Rust，也没有证明某条路线实测性能最佳。

各项结论在对应章节都有源码/ADR 锚点。历史动机另由一手文章核对：[Zed 团队访谈](https://zed.dev/blog/we-have-to-start-over)、[GPUI 重写](https://zed.dev/blog/why-the-big-rewrite)。

## 版本与证据边界

| 对象 | 调查基线 | 如何解释 |
|---|---|---|
| Zed | `/Users/chp/explore/zed`；HEAD `7ea077c78b865d17854cee812bb775dbe64a925a`；工作树干净 | 结论绑定本地快照；[固定提交入口](https://github.com/zed-industries/zed/tree/7ea077c78b865d17854cee812bb775dbe64a925a) |
| PI-Desktop | `/Users/chp/codex/PI-Desktop`；HEAD `e0d142ba56ced0c1d76eba8ab2a96c07959ad4e6`；44 项已暂存变动 | 研究当时工作树，不能把全部观察归到纯 HEAD；未修改这些变动 |
| Yuuki Box | 当前 docs 与 examples；调查时未初始化 Git | 新建调查资料并增加导航，未建立仓库或提交 |
| 外部资料 | 本轮打开的官方工程文章 | 用于历史动机；文章年代/更新日期与当前源码分别记录 |

**事实** 指直接看到的源码、manifest、ADR 或官方陈述；**推断/建议** 指收益分析与 Yuuki 适用性判断；**待验证** 指未运行的行为或性能。ADR 表达意图，源码表达当前实现，二者有差异时会指出。

本地绝对路径和行号适合在这台机器跳转；仓库移动或修改后需结合 symbol 与 commit 查找。PI 的 staged 改动没有导出为补丁，不能仅凭 HEAD 完整重建本次状态。

## 深度和限制

完整静态扫描 Zed 的根成员与 `crates/` manifests；深入打开文件、输入/语法/LSP、命令面板后台匹配、PI prompt、PI 消息持久化五条主链。另核对 GPUI 运行时与平台边界、Zed Agent 模型层/扩展宿主、PI 工具取消/重启及可选远端路径。没有逐行审计全部 crate 或所有权限分支。

两个参考仓库均只读。未启动应用、下载依赖、编译整个 Zed、调用模型或执行性能基准。没有新增 FPS、延迟、内存或能耗测量；源码中的历史性能注释不作为本次测量。Raycast/Warp 仅补充一手动机，未进行同深度源码调查。

## 可复查的清单

- [inventory.json](inventory.json)：Zed 255 个 manifest 记录，即 253 个显式成员加 2 个额外 manifest；本地依赖边及其 kind/target/optional/features、manifest SHA-256；两仓库 commit/status；PI package manifests 和 Rust workspace。
- [collect_inventory.py](collect_inventory.py)：Python 3.11+ 标准库脚本，只读取参考仓库。记录静态声明关系，没有运行 Cargo 或解析最终启用 features。

项目根目录执行下面的命令可生成**另一份**当前快照，保留本次归档：

```bash
python3 docs/deep/2026-09-26-zed-pi-rust/collect_inventory.py \
  --zed /Users/chp/explore/zed \
  --pi /Users/chp/codex/PI-Desktop \
  --out /tmp/yuuki-zed-pi-inventory.json
```

需有 `python3`、`git`、`rg`，两个输入路径需为可读 Git 工作树。目录改变时传入新的参数。默认输出会覆盖脚本旁的 `inventory.json`，保留历史证据时请指定新的 `--out`。

`path` 是本地包关系的定位依据；`package` 记录依赖声明名/alias，target/dev/build 边仍单列。全部声明边不能被当作当前 macOS release 的实际依赖。

## 本轮核对记录

- 五篇文档的 217 个本地链接已检查目标存在；带行号的链接已检查范围，Markdown 代码围栏已检查配对。源码/ADR 的核心结论另经人工定点阅读与交叉复核；路径存在不代表语义自动正确。
- 上面的采集命令已实际重跑，两份清单除采集时间外一致；253/248/255 与 PI 14 份 package manifest 的数量断言通过。
- 收尾时 Zed HEAD 与干净状态未变；PI HEAD 与 44 项暂存状态匹配采集记录。
- 没有运行应用测试、性能测试或 Mermaid 渲染器。本轮验证针对文档事实、路径和静态清单，不将其写成运行行为验收。
