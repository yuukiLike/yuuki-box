---
prev:
  link: /ai-from-scaling/00-codex-mcp/
  label: 在 Codex 里用自己的 MCP
---

# MCP 项目实战：选一个想做的工具

从[Codex 接入](../ai-from-scaling/00-codex-mcp.md)继续，选一个想做的工具。我们主要编写 Server，Host 与 Client 由现有应用提供；[客户端与调用链实验（选修）](../ai-from-scaling/00-minimal-mcp.md)可跳过。

每项实战都可以独立开始，环境要求见各篇开头；模型训练与 Harness 课程不作为前置。

## 按成果选择

| 想做什么 | 入口 | 额外准备 | 第一份成果 |
| --- | --- | --- | --- |
| 查询天气、筛选出门时段 | [本地 Apple 天气 MCP](../ai-from-scaling/07-weatherkit-mcp.md) | 样本可离线跑；真实查询需要 Apple 配置 | 一份带时间、来源与筛选依据的天气结果 |
| 改尺寸、检查模型并导出 | [Blender MCP](../ai-from-scaling/05-blender-mcp.md) | 本机 Blender | 可编辑模型、预览图与 STL |
| 判断一个 bug 是否修好 | [GitHub MCP](../ai-from-scaling/06-github-lab-mcp.md) | 按原教程准备 GitHub 与本地实验环境 | 同一断言在基线、候选与参考修复中的对照 |
| 将音乐变成可编辑的三维对象 | [声部之结](../ai-from-scaling/07-music-space-mcp.md) | 按教程准备音乐 MCP 与示例 MIDI | 声部分离、时间定位与 GLB 导出 |
| 让照片与音乐组成短片 | [光之剧场](../ai-from-scaling/08-music-photo-mcp.md) | 沿用音乐 MCP，准备图层与音乐 | 一段有声音的舞台短片 |

音乐两篇共用同一个服务与时间轴，建议先读声部之结，再读光之剧场。它们不要求先完成天气、Blender 或 GitHub 实战。

## 两套天气教程怎么选

**本地天气 MCP** 先用样本练习业务规则，再配置 WeatherKit，最后接入已有客户端。适合先做一个自己使用的工具。

**[远程天气 MCP](../ai-communication/weather-mcp/README.md)** 归入紧随实战的「远程 MCP 与授权」专题，增加 Supabase 登录、OAuth、业务权限与远程接入。需要在自己的练习工程中实现和部署；本仓库尚未完成真实 Codex ↔ Supabase ↔ WeatherKit 联调。先看[验证边界](../ai-communication/weather-mcp/README.md#这份教程的验证边界)，再决定是否开始。

其他项目也保留各自的环境与验证记录；能启动工具、工具成功返回和最终产物正确，要分别检查。

## 想继续研究哪一层

- 请求与响应怎样传递：读[应用通信](../ai-communication/README.md)。
- 谁决定何时调用工具：做 [Agent 入门](../ai-from-scaling/03-build-a-harness.md)。
- 怎样把外部 MCP 接进自己的循环：做[工具源与权限练习](../agent-engineering/README.md)。
- 为什么有 function calling、MCP 与 Skills：选读[工具调用简史](../ai-from-scaling/extra-tool-use-story.md)。

返回[MCP 入门](../ai-from-scaling/00-codex-mcp.md) · [文档目录](../../site/src/pages/index.astro)。
