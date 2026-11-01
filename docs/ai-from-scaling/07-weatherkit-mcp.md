# Apple 天气 MCP：从查询天气到安排出门

把 WeatherKit 接进 MCP，查询真实天气，再按你的条件筛选出门时段。结果保留时间、单位与判断依据。

配套实现：[examples/weatherkit-mcp](../../examples/weatherkit-mcp/README.md)。需要 Node.js ≥ 22.22、pnpm 11.14。离线部分不需要 Apple 密钥；真实查询需要有效的 Apple Developer Program 会员与网络。

分三次做：样本与规则约 20 分钟，Apple 配置约 20–30 分钟，最后接入客户端。没有密钥可先做前两节。

## 先确定它能帮你做什么

| 你的问题 | 工具提供的事实 | 由谁决定 |
| --- | --- | --- |
| 今天出门要不要带伞？ | 当前天气和未来几小时的降雨概率 | 模型结合你出门的时间解释；概率不保证一定下或不下 |
| 今天找两小时散步，别太热、风别太大 | 连续两小时逐项满足阈值的时段，以及每小时原始数值 | 本地函数执行筛选，模型转述理由 |
| 周末去另一个城市，温差大吗？ | 两个配置地点的逐日最高/最低温和降雨概率 | 模型对照相同日期的数据 |

三个工具：`list_locations`、`get_weather`、`find_outdoor_windows`。只查询你配置的地点。**Apple 提供天气，你设阈值，本地函数筛选时段。**

## 1. 跑通离线样本，先看一份有用的结果

在仓库根目录执行：

```bash
pnpm install:weatherkit-mcp
pnpm demo:weatherkit-mcp
```

**你要看到：**

```text
[离线演示] 人工样本：上海 2026-10-26 08:30；不访问 Apple，不代表真实天气。
[MCP] tools/list → list_locations, get_weather, find_outdoor_windows
[天气] mode=fixture | cacheHit=false | 22°C
[时段] cacheHit=true | 时区=Asia/Shanghai
2026-10-26 11:00 起 2 小时 | 最大降雨概率 10%
2026-10-26 14:00 起 2 小时 | 最大降雨概率 10%
2026-10-26 16:00 起 2 小时 | 最大降雨概率 10%
```

这是人工样本，不能用于今天的安排。`demo.ts` 通过内存传输执行 MCP 调用，用样本替换 HTTP 响应，没有模型参与；真实入口不支持替换。

打开 [demo.ts](../../examples/weatherkit-mcp/src/demo.ts)，找到对 `find_outdoor_windows` 的调用。它传入的是：

```json
{
  "location": "上海",
  "date": "2026-10-26",
  "durationHours": 2
}
```

默认规则还包括：降雨概率不超过 30%、风速不超过 20 km/h、体感温度在 5–32°C、UV 不超过 5、只选白天、活动在当地 07:00–22:00 内。它们是本项目的默认偏好，可以修改。

核对地点、时区、连续时长与 `mode=fixture`。

## 2. 改一个条件，理解“有用”来自哪里

在刚才的调用参数中加入：

```ts
maxRainChancePercent: 90,
```

重新运行 `pnpm demo:weatherkit-mcp`。

结果应为 09:00、11:00、13:00、15:00 起的四个两小时时段。10:00 与 13:00 的 80% 降雨概率现在被接纳；18:00 后仍因夜间被排除。

再设 `maxWindKph: 0`，保持两小时。样本风速 12 km/h，因此返回空时段：有预报，但没有匹配。

打开 [forecast.ts](../../examples/weatherkit-mcp/src/forecast.ts)，找 `findWindows()`：

1. 只考虑当前时间之后、未来 72 小时范围内的整小时。
2. 用地点时区检查当地日期和活动时间段。
3. 检查每小时的降雨、风速、体感、UV 和 daylight。
4. 比较时间戳，确认每两个小时真的相邻。
5. 返回最多五个最早、互不重叠的时段，并保留逐小时依据。

**亲手检查一处边界：** 在 [fixtures/weather.ts](../../examples/weatherkit-mcp/fixtures/weather.ts) 里制造一个缺失小时，或把某小时的 `daylight` 改成 `undefined`。缺口不能拼成连续时段；要求白天时，未知值不能当作 `true`。修改样本以后先观察 `demo`；运行正式测试前恢复练习改动，因为测试使用同一份基准样本。

**MCP 负责调用，业务规则决定筛选结果。**

## 3. 准备你的 Apple 配置

你购买的 Apple Developer Program 会员包含 WeatherKit 访问权限。Apple 当前公布的包含额度为每个会员每月 50 万次 API 调用，各应用和服务共享这个会员额度；额度和政策以账户及官方页面为准。[WeatherKit 官方说明](https://developer.apple.com/weatherkit/)

### 3.1 注册 Services ID

登录 Apple Developer，进入 **Certificates, Identifiers & Profiles → Identifiers**：

1. 点击新增，选择 **Services IDs**。
2. 填写描述，例如「个人天气 MCP」。
3. 填写唯一标识，例如 `com.yourname.weather-mcp`，完成注册。

记录完整标识，后面作为 `APPLE_SERVICE_ID`。这里使用 REST 服务的 Services ID；不要把 App Store Connect API 的 Issuer ID 填进来。Apple 当前说明所有已注册 Services ID 都可以用于 WeatherKit。[官方操作说明](https://developer.apple.com/help/account/capabilities/create-a-services-identifier-and-private-key-for-weatherkit/)

### 3.2 创建 WeatherKit Key

在同一个后台进入 **Keys**：新增密钥，勾选 **WeatherKit**，注册并下载 `.p8`。记录 **Key ID**，并从开发者会员信息中找到 **Team ID**。Team ID 与 Key ID 都是 10 位标识。

`.p8` 私钥只能下载一次，保存在本机私人目录，例如 `~/.config/yuuki-weatherkit/`；不要粘贴到聊天、课程文件或 Git。后面的配置只填写它的绝对路径。[Apple 密钥创建说明](https://developer.apple.com/help/account/keys/create-a-private-key/)

### 3.3 填写本地配置

进入 `examples/weatherkit-mcp`，首次执行：

```bash
cp -n .env.example .env
cp -n locations.example.json locations.json
```

编辑 `.env`：

```dotenv
APPLE_TEAM_ID=你的10位TeamID
APPLE_KEY_ID=你的10位KeyID
APPLE_SERVICE_ID=com.yourname.weather-mcp
APPLE_PRIVATE_KEY_PATH=/绝对路径/AuthKey_你的KeyID.p8
WEATHERKIT_LOCATIONS_FILE=/绝对路径/yuuki-box/examples/weatherkit-mcp/locations.json
```

把所有占位符替换成自己的值。路径必须是绝对路径；包含空格时使用双引号。将 `.env` 和私钥文件权限设为只有自己可读写，例如对各自路径执行 `chmod 600`。

编辑 `locations.json`。下面的城市中心坐标只用于演示，替换成你要查询的位置：

```json
[
  { "name": "上海", "latitude": 31.2304, "longitude": 121.4737, "timezone": "Asia/Shanghai" },
  { "name": "杭州", "latitude": 30.2741, "longitude": 120.1551, "timezone": "Asia/Shanghai" }
]
```

使用 WGS84 经纬度，纬度在 -90 到 90、经度在 -180 到 180 之间；不同地图坐标系统不能直接混用。名称保持唯一，最多配置 20 个。时区采用 `Asia/Shanghai` 这样的 IANA 名称，旅行地点按当地时区填写。修改地点后重启服务。

核对五项配置：Team ID 是团队，Key ID 是密钥，Service ID 是服务；私钥仅留本机。

## 4. 取回一份真实天气，再解释认证和缓存

回到仓库根目录：

```bash
pnpm demo:weatherkit-mcp:live
```

这里只查工具与地点，**尚未请求 Apple**。继续执行才验证真实认证：

```bash
pnpm demo:weatherkit-mcp:live 上海
```

把「上海」换成实际配置名称。成功时打印真实 JSON。检查：

- `source.mode` 是 `live`，`source.provider` 是 `Apple Weather`。
- `current.asOf` 是当前天气的时间，`source.fetchedAt` 是本服务收到数据的时间；不要混为一谈。
- `hourly[].rainChancePercent` 是 0–100 的百分比；Apple 原字段是 0–1。
- `temperatureC` 和 `feelsLikeC` 是摄氏度，`windKph` 是 km/h；它不是 m/s。
- `daily[].date` 是地点当地日期；`hourly[].start`/`end` 是带时区的 ISO 时间，`localStart` 配合 `location.timezone` 阅读。
- `source.attribution` 包含官方标识和来源链接。

请求字段、单位和时区依据：[天气接口](https://developer.apple.com/documentation/weatherkitrestapi/get-api-v1-weather-_language_-_latitude_-_longitude_)、[逐小时字段](https://developer.apple.com/documentation/weatherkitrestapi/hourweatherconditions)、[数据元信息](https://developer.apple.com/documentation/weatherkitrestapi/metadata)。本例不发送非文档约定的 `units=si` 参数，而是在返回边界明确单位。

### 顺着代码走一次

| 文件 | 这次需要理解的责任 |
| --- | --- |
| [server.ts](../../examples/weatherkit-mcp/src/server.ts) | 注册三个工具；MCP 参数校验成功后执行回调，失败转成 `isError` |
| [config.ts](../../examples/weatherkit-mcp/src/config.ts) | 读取本机配置，使用 `jose` 导入 `.p8` 并签发 JWT |
| [weatherkit.ts](../../examples/weatherkit-mcp/src/weatherkit.ts) | 携带 Bearer 令牌调用 Apple，校验外部 JSON，处理缓存和失败 |
| [forecast.ts](../../examples/weatherkit-mcp/src/forecast.ts) | 统一结果单位和当地日期，计算连续时段 |
| [stdio.ts](../../examples/weatherkit-mcp/src/stdio.ts) | 将服务接到客户端启动的进程标准输入/输出 |

<details class="qa">
<summary>Apple 认证和天气缓存怎样工作？</summary>

JWT 用 `ES256`，头部含 `kid`、`TeamID.ServiceID`，载荷含 `iss/sub/iat/exp`。本例由 `jose` 签名，有效 30 分钟，提前一分钟续签。[Apple 认证](https://developer.apple.com/documentation/weatherkitrestapi/request-authentication-for-weatherkit-rest-api)

同进程的两个天气工具共享内存缓存，最长五分钟且不超过 Apple 失效时间。命中保留原 `fetchedAt`，标记 `cacheHit: true`；`refresh: true` 强制刷新。失败不自动重试，不冒充新数据。

每次 `pnpm demo:weatherkit-mcp:live 上海` 都新建进程，连续两次运行不会共享缓存。

</details>

拿到 `mode=live` 后，核对天气时间、获取时间与缓存状态。没有密钥则留待补做。

## 5. 接入已有客户端，让它帮助安排一天

按照[示例 README 的 Codex 或 Claude Desktop 配置](../../examples/weatherkit-mcp/README.md#接入客户端)，让客户端启动 `dist/src/stdio.js`。使用 Node 绝对路径和 `--env-file`，保留原有 MCP 配置。

先用一个明确任务：

```text
先列出天气 MCP 里已经配置的地点。
查询上海未来六小时的天气，告诉我出门是否需要准备雨具。
指出降雨概率最高的小时，保留数据时间、当地时区和 Apple Weather 来源署名。
如果拿到的是 fixture 或接口失败，明确告诉我，不要据此做今天的安排。
```

再试一次带个人约束的任务：

```text
我想在上海找连续两小时散步。
请在未来三天的白天，按当地 09:00–18:00、降雨概率不超过 20%、
风速不超过 15 km/h、体感 10–28°C、UV 不超过 4 来筛选。
调用 find_outdoor_windows，给我两个候选及每小时依据。
没有匹配就直接说明，不自行放宽条件。
```

最后比较两个地点：

```text
分别查询上海和杭州未来三天的逐日预报。
按相同的当地日期列出最高/最低温和降雨概率，指出哪天温差更大。
标注数据时间与来源，不把某个城市的结果套到另一个城市。
```

模型选择工具并解释结果，本地程序访问 API、执行筛选。同一服务可以复用到不同客户端。

### 检查最终展示，而不只看 JSON

Apple 对天气展示要求保留 Apple Weather 标识与数据来源法律链接。[官方署名要求](https://developer.apple.com/weatherkit/#apple-weather-and-third-party-attribution)

最终回答须显示 `logoLight/logoDark` 对应标识及 `legalUrls` 来源链接；仅隐藏在工具结果中不算通过。纯文本终端无法完成标识展示验收，发布前应在支持的宿主检查。样本标识只是占位。

本例只处理当前、逐小时和逐日天气，没有分钟级降水、天气预警和空气质量。符合散步阈值只是筛选结果，不是户外安全保证；这些边界会随结果返回。

## 6. 故意制造失败，确认它没有编造答案

| 你做的实验 | 应观察到的结果 |
| --- | --- |
| 输入未配置的地点 | 提示先列地点或编辑配置；不请求 Apple |
| 把小时数设为 1000，或把最低体感设得比最高还高 | MCP 输入校验拒绝；不请求 Apple |
| 使用错误的 Key ID / Service ID | Apple 认证失败；不打印私钥或令牌，不返回模拟天气 |
| 暂时断网后用 `refresh: true` 查询 | 明确网络失败；不拿旧缓存冒充新数据 |
| 设置风速阈值 0 | 可能没有匹配，正常返回空时段列表 |
| 选超出未来预报范围的日期 | 报告没有可用覆盖，和“有预报但不匹配”区分 |

遇到 `401/403`，检查会员状态、WeatherKit Key、三个标识和系统时间；遇到 `429`，稍后再试并查看账户用量。工具请求有十秒超时；客户端取消会传递到 HTTP 请求。取消不能撤回已经到达 Apple 的请求，也不保证这次请求未计费。

运行自动化检查：

```bash
pnpm check:weatherkit-mcp
```

检查覆盖 JWT、stdio、输入与上游错误、取消、缓存、单位、时区与预报缺口。使用临时密钥和模拟 HTTP，不证明 Apple 接受了你的账号配置。

## 到这里，怎样判定学会了

你能独立完成三件事：配置一个常用地点并取回真实天气；改变一个阈值并解释时段为什么变化；沿代码指出 MCP、Apple 认证和本地业务判断各自的位置。

课程交付验证记录（2026-10-26）：类型检查、自动化测试与离线演示通过，真实 stdio 发现/地点查询使用临时测试密钥验证。个人 Apple 凭据尚未配置，真实天气请求和最终客户端的署名展示留在第 4、5 步由你验收。

后续按需增加城市搜索、分钟级降雨或预警，先确认地区支持与缺失时的回答。

返回[MCP 项目实战](../mcp-projects/README.md) · 选修[客户端与调用链实验](00-minimal-mcp.md) · 对照[MCP 官方天气教程](https://modelcontextprotocol.io/docs/develop/build-server)。
