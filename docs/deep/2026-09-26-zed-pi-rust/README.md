# Deep 调查：Zed、Rust 与 PI-Desktop 的搭配

调查：**2026-09-26**。承接[前期调研](../../research/zed-raycast-warp.md)，读本地 Zed、PI-Desktop，研究 Rust 动机、模块配合和 Yuuki 适用性。

<mark class="key">Zed 用 Rust 贯穿应用，PI 用 Rust 稳定宿主</mark>。收益靠数据结构、增量更新、生命周期和协议兑现，搭配取决于产品目标。

## 阅读顺序

| 文档 | 读完能回答的问题 |
|---|---|
| [01 · 为什么 Rust](01-why-rust.md) | 作者实际动机是什么？源码支持哪些收益与代价？附 Raycast/Warp 对照 |
| [02 · Zed 架构与调用链](02-zed-architecture.md) | crate 怎样分工？打开文件、输入、解析与绘制如何连接？GPUI/LSP/Wasm 如何配合？ |
| [03 · PI-Desktop 实例](03-pi-desktop.md) | Electron、Rust、Node 谁拥有状态？prompt、工具与持久化如何跨进程？怎样提炼极简骨架？ |
| [04 · Yuuki Box 搭配与验证](04-yuuki-box.md) | 如何接上已有五条 MVP？接下来读哪些代码，用什么负载验证？ |

选型先读 01、03，GUI/文本/异步深入读 02；04 仅为建议，不作最终选型。

后续[简单、组合、复杂性](../2026-09-26-simplicity-composition-complexity/README.md)沿用证据，加入 Raycast/Warp/Grok 机制及 Yuuki 新 runtime/语音。两轮状态不同，按各自日期和验证范围阅读。

## 关键结论

1. **crate 不等于进程。** Zed 有 253 个显式 member，246 个在 `crates/`，该目录共 248 份 manifest；不能视为独立团队的 Rust 推荐。
2. **Zed 依靠快照与增量。** SumTree/Rope 共享结构，text/language 管版本语法，MultiBuffer/Editor 管片段显示，GPUI 管实体、事件、任务与画面。
3. **GPUI 需区分版本/平台。** 此 checkout：macOS→Metal，Linux Wayland/X11→wgpu，Windows→Direct3D 11；不能因同名 0.2.2 与 crates.io 版混用 API。
4. **PI 并非小型实现。** 一个 Rust crate、11 个直接应用/库包；可提炼四个角色及 Main→Rust host、Main→Node Agent 两条通道。
5. **PI 选择混合生态。** Rust 宿主保留 Electron UI、pi TypeScript/provider；Agent 用 Electron Node，Desktop 正文存 JSONL、索引存 SQLite，native Pi 另有路径。
6. **Rust 仍需实验验证。** 尚无全 Rust 选型或某路线性能最佳的证据。

源码/ADR 锚点见各章；历史动机见[团队访谈](https://zed.dev/blog/we-have-to-start-over)、[GPUI 重写](https://zed.dev/blog/why-the-big-rewrite)。

## 版本与证据边界

| 对象 | 调查基线 | 如何解释 |
|---|---|---|
| Zed | 本地 checkout；HEAD `7ea077c78b865d17854cee812bb775dbe64a925a`；工作树干净 | 结论绑定该快照；[固定提交入口](https://github.com/zed-industries/zed/tree/7ea077c78b865d17854cee812bb775dbe64a925a) |
| PI-Desktop | 本地工作树；HEAD `e0d142ba56ced0c1d76eba8ab2a96c07959ad4e6`；44 项已暂存变动 | 研究当时工作树，不能把全部观察归到纯 HEAD；未修改这些变动 |
| Yuuki Box | 当前 docs 与 examples；调查时未初始化 Git | 新建调查资料并增加导航，未建立仓库或提交 |
| 外部资料 | 本轮打开的官方工程文章 | 用于历史动机；文章年代/更新日期与当前源码分别记录 |

源码、manifest、ADR、官方陈述为事实；收益/适用性为推断；未运行行为/性能待验证。ADR 意图与当前源码有差异时注明。

Zed 引用固定提交，Yuuki 用相对路径。PI 仅保留本地定位，无公开链接或 staged 补丁，不能仅靠 HEAD 重建。

## 深度和限制

静态扫描 Zed 根成员和 manifests，深入打开文件、输入/语法/LSP、命令面板、PI prompt、PI 持久化五条链；另查 GPUI 平台、Agent/扩展、PI 取消/重启与远端路径，非全量审计。

两仓库只读，<mark class="caution">未运行、构建或测性能</mark>，也未下载依赖、调用模型。历史性能注释不算本轮测量；Raycast/Warp 仅核对动机。

## 可复查的清单

- [inventory.json](inventory.json)：255 个 Zed manifest（253 成员+2 额外），依赖边及 kind/target/optional/features、SHA-256，两仓库 commit/status，PI 包与 Rust workspace。
- [collect_inventory.py](collect_inventory.py)：Python 3.11+ 只读标准库脚本；记录声明，不运行 Cargo 或解析最终 features。

在根目录生成另一份快照，保留归档：

```bash
python3 docs/deep/2026-09-26-zed-pi-rust/collect_inventory.py \
  --zed /path/to/zed \
  --pi /path/to/PI-Desktop \
  --out /tmp/yuuki-zed-pi-inventory.json
```

需 `python3/git/rg`，替换为可读工作树路径。默认覆盖原清单；保留历史须指定新 `--out`。

`path` 定位本地包，`package` 记声明名/alias，target/dev/build 分列；声明边不等于 macOS release 实际依赖。

## 本轮核对记录

以下为 2026-09-26 记录，不覆盖后续图解、导航和链接调整。

- 已查 217 个本地链接、行号和围栏；核心源码/ADR 另经定点复核，路径存在不证明语义正确。
- 重跑清单仅时间不同；253/248/255、PI 14 份 manifest 数量断言通过。
- Zed HEAD/干净状态未变；PI HEAD/44 项暂存与记录一致。
- 未运行应用/性能测试或 Mermaid 渲染器；仅验证文档与静态清单。
