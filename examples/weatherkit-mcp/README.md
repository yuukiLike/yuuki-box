# WeatherKit MCP：把天气用在每天的安排里

配套课程：[Apple 天气 MCP：从查询天气到安排出门](../../docs/ai-from-scaling/07-weatherkit-mcp.md)。

这是本地 stdio MCP 服务，使用 Apple WeatherKit REST API。三个工具分别列出常用地点、查询当前与未来天气、按明确条件筛选连续出门时段。天气数据由 Apple 提供，筛选规则由本项目实现。

## 先运行离线演示

需要 Node.js ≥ 22.22 和 pnpm 11.14。在仓库根目录执行：

```bash
pnpm --dir examples/weatherkit-mcp install --frozen-lockfile
pnpm --dir examples/weatherkit-mcp check
pnpm --dir examples/weatherkit-mcp demo
```

演示是**人工构造的上海 2026-10-26 08:30 样本**，通过 SDK 的内存传输连接 MCP 客户端与服务端。不会请求 Apple，也不调用语言模型；`source.mode` 始终为 `fixture`。运行 `live` 和 `start` 时没有自动切换样本的后备路径。

## 配置真实 WeatherKit

Apple 开发者会员包含 WeatherKit 权限；需要在开发者后台注册 Services ID，创建启用了 WeatherKit 的 Key，并下载 `.p8` 私钥。逐步操作及官方链接见[课程第三步](../../docs/ai-from-scaling/07-weatherkit-mcp.md#3-准备你的-apple-配置)。

首次配置，在本示例目录执行：

```bash
cp -n .env.example .env
cp -n locations.example.json locations.json
```

编辑 `.env`，填写五项：

```dotenv
APPLE_TEAM_ID=你的10位TeamID
APPLE_KEY_ID=你的10位KeyID
APPLE_SERVICE_ID=com.yourname.weather-mcp
APPLE_PRIVATE_KEY_PATH=/绝对路径/AuthKey_你的KeyID.p8
WEATHERKIT_LOCATIONS_FILE=/绝对路径/yuuki-box/examples/weatherkit-mcp/locations.json
```

路径有空格时用双引号包住整个值。`.p8` 保留在本机私人目录，环境变量里只填写路径。不要把私钥内容交给模型或提交到仓库。`.env`、`locations.json` 和本目录下的 `.p8` 已被 Git 忽略。

编辑 `locations.json`：名称必须唯一，经纬度是 WGS84 坐标，时区使用 IANA 名称。示例中的上海和杭州是城市中心演示坐标，不是对你实际位置的判断。可以换成「家附近」「公司」或旅行目的地；这些名称和坐标会通过工具结果提供给客户端。

在仓库根目录执行：

```bash
pnpm --dir examples/weatherkit-mcp live
pnpm --dir examples/weatherkit-mcp live 上海
```

第一条检查配置并通过 stdio 列出地点，**还没请求 Apple**；第二条才查询指定地点的真实天气。成功结果包含 `source.mode: "live"`、数据时间、缓存状态和署名信息。认证失败会明确报错，不返回样本或旧天气。

## 接入客户端

先执行 `pnpm --dir examples/weatherkit-mcp build`。用 `command -v node` 确认 Node 的绝对路径。

Codex 的 `config.toml` 可以新增以下表；替换所有路径，保留已有配置：

```toml
[mcp_servers.weatherkit]
command = "/absolute/path/to/node"
args = ["--env-file=/ABSOLUTE/PATH/yuuki-box/examples/weatherkit-mcp/.env", "/ABSOLUTE/PATH/yuuki-box/examples/weatherkit-mcp/dist/src/stdio.js"]
```

也可以用 CLI 注册：

```bash
codex mcp add weatherkit -- /absolute/path/to/node \
  --env-file=/ABSOLUTE/PATH/yuuki-box/examples/weatherkit-mcp/.env \
  /ABSOLUTE/PATH/yuuki-box/examples/weatherkit-mcp/dist/src/stdio.js
```

依据：[OpenAI 官方 MCP 配置](https://developers.openai.com/codex/mcp)。本示例不会自行修改你的客户端配置。

Claude Desktop 的 `mcpServers` 配置对应如下：

```json
{
  "mcpServers": {
    "weatherkit": {
      "command": "/absolute/path/to/node",
      "args": [
        "--env-file=/ABSOLUTE/PATH/yuuki-box/examples/weatherkit-mcp/.env",
        "/ABSOLUTE/PATH/yuuki-box/examples/weatherkit-mcp/dist/src/stdio.js"
      ]
    }
  }
}
```

把 `weatherkit` 合并到已有 `mcpServers`，按客户端要求重新载入。直接启动 Node，避免包管理器的启动日志混入 stdio 协议。Claude Desktop 配置方式参考 [MCP 官方教程](https://modelcontextprotocol.io/docs/develop/build-server)。

## 工具和实际边界

| 工具 | 输入与行为 |
| --- | --- |
| `list_locations` | 无参数；列出最多 20 个配置地点，不请求 Apple |
| `get_weather` | `location` 必填；`hours` 默认 24，范围 1–72；`days` 默认 3，范围 1–10；`refresh` 默认 false |
| `find_outdoor_windows` | `location` 必填；可选当地 `date`、持续小时数、时间段、降雨/风速/体感温度/UV 阈值；默认只选白天；最多返回 5 个最早且不重叠的连续时段 |

默认阈值是本项目的演示偏好：降雨概率 ≤ 30%、风速 ≤ 20 km/h、体感 5–32°C、UV ≤ 5、当地 07:00–22:00、持续 1 小时。可以在调用中修改，不能把它们描述成 Apple 的运动建议。

每个地点的成功天气结果缓存在内存，最长 5 分钟，且不晚于 Apple 任一数据集的失效时间。两个天气工具共用缓存；每个服务进程独立计数、重启即清空。第一次查询还会读取署名资源；客户端的连续调用不等于每次都请求 Apple。`refresh: true` 绕过天气缓存。失败不自动重试，也不返回失效缓存。

只请求当前、逐小时、逐日三个数据集。没有城市名搜索、分钟级降水、天气预警、空气质量或后台定时通知。`find_outdoor_windows` 返回的是数值筛选结果，缺失小时不拼接，未知 daylight 不当成白天；没有匹配时返回空列表，日期没有预报覆盖时返回错误。

`source.attribution` 包含官方标识资源与法律来源链接，客户端展示天气时应保留并按 Apple 要求呈现。工具返回署名字段不等于客户端已经正确显示；课程提供了最终展示验收步骤。

## 代码入口

- [server.ts](src/server.ts)：三个工具的注册与 MCP 错误边界。
- [config.ts](src/config.ts)：地点配置、私钥读取与 JWT 签名。
- [weatherkit.ts](src/weatherkit.ts)：HTTP、外部数据校验、取消/超时、署名与缓存。
- [forecast.ts](src/forecast.ts)：单位、时区、天气输出和连续时段筛选。
- [stdio.ts](src/stdio.ts)：真实客户端入口；[live.ts](src/live.ts)：通过 stdio 做手动接入检查。
- [demo.ts](src/demo.ts) 和 [人工样本](fixtures/weather.ts)：独立的离线练习。

验证记录：2026-10-26，类型检查、自动化测试和离线 MCP 演示通过；测试生成临时密钥验签，并验证真实 stdio 发现/地点查询。尚未用个人 Apple 凭据请求 WeatherKit，也未在图形客户端验收署名展示。
