---
prev:
  link: /ai-communication/weather-mcp/05-connect-and-verify/
  label: 天气 MCP 联调验收
---

# MCP 项目实战：工具案例

先完成[最简 demo](../ai-from-scaling/00-minimal-mcp.md)与本地天气，再选择其他案例。<mark class="key">Server 实现工具，应用提供 Client</mark>；真实客户端接入见[Codex 接入](../ai-from-scaling/00-codex-mcp.md)。

各案例独立运行，无需模型训练或 Harness 前置；环境见各篇。

## 按成果选择

| 目标 | 入口 | 额外准备 | 第一份成果 |
| --- | --- | --- | --- |
| 查询天气、筛选出门时段 | [本地 Apple 天气 MCP](../ai-from-scaling/07-weatherkit-mcp.md) | 样本可离线跑；真实查询需要 Apple 配置 | 一份带时间、来源与筛选依据的天气结果 |
| 改尺寸、检查模型并导出 | [Blender MCP](../ai-from-scaling/05-blender-mcp.md) | 本机 Blender | 可编辑模型、预览图与 STL |
| 判断一个 bug 是否修好 | [GitHub MCP](../ai-from-scaling/06-github-lab-mcp.md) | 按原教程准备 GitHub 与本地实验环境 | 同一断言在基线、候选与参考修复中的对照 |
| 选修 · MIDI 排练与琴键 | [钢琴排练台](../ai-from-scaling/07-music-space-mcp.md) | 按教程准备音乐 MCP 与示例 MIDI | 小节定位、独听与 GLB 导出 |
| 选修 · 音频舞台预演 | [舞台预演台](../ai-from-scaling/08-music-photo-mcp.md) | 沿用音乐 MCP，准备图层与音乐 | 可调布局与带声音的舞台短片 |

音乐两篇均为选修，共用服务与时间轴；建议先钢琴排练台，再舞台预演台。

## 两套天气教程怎么选

**本地天气 MCP**：样本练规则 → 配 WeatherKit → 接客户端，适合本地使用。

**[远程天气 MCP](../ai-communication/weather-mcp/README.md)** 增加 Supabase/OAuth 与业务权限，需自行实现部署；<mark class="caution">真实联调未完成</mark>，先看[验证边界](../ai-communication/weather-mcp/README.md#这份教程的验证边界)。

各项目保留验证记录；启动、工具返回、产物正确分别检查。

<div class="heading-alias" id="想继续研究哪一层" aria-hidden="true"></div>

## 延伸方向

- 请求与响应怎样传递：读[应用通信](../ai-communication/README.md)。
- 谁决定何时调用工具：做 [Agent 入门](../ai-from-scaling/03-build-a-harness.md)。
- 如何接入自建执行循环：做[工具源与权限练习](../agent-engineering/README.md)。
- 为什么有 function calling、MCP 与 Skills：选读[工具调用简史](../ai-from-scaling/extra-tool-use-story.md)。

返回[Codex MCP 接入](../ai-from-scaling/00-codex-mcp.md) · [文档目录](../../site/src/pages/index.astro)。
