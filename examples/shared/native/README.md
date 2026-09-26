# Apple Speech 与本地 Whisper 能力桥

这是五条路线共用的真实语音 helper：Apple Speech / AVFoundation 提供系统识别；Whisper 后端使用 AVFoundation 录音和转换，再调用你配置的本地 whisper.cpp CLI。它不是语音模拟器，不包含或自动下载 Whisper 可执行文件/模型，不调用云端 Whisper，也不会静默切换后端。

## 构建

在仓库根目录执行：

```sh
bash examples/shared/native/build.sh
```

输出：

```text
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities
```

只依赖 Command Line Tools 中的 Swift、macOS SDK 和系统框架。默认以本机架构编译，最低部署目标 macOS 14；使用 Swift 5 语言兼容模式。脚本进行 ad-hoc 签名，供本地学习使用。这不等于 Developer ID 签名、公证、稳定发布身份或 App Store 沙箱。

## 本地 Whisper small

统一调用：

```text
native-capabilities speech [--backend apple|whisper] [--locale zh-CN]
  [--file /absolute/path/audio.m4a]
  [--whisper-cli /absolute/path/whisper-cli]
  [--model /absolute/path/ggml-small.bin]
```

默认后端仍为 `apple`。Whisper 的 CLI 与模型路径优先使用显式参数，未提供时分别读取 `YUUKI_WHISPER_CLI`、`YUUKI_WHISPER_MODEL`。两者必须是已存在的绝对文件路径；允许指向普通文件的符号链接，不展开 `~`、shell 表达式，不从 PATH 猜测位置。CLI 必须可执行，模型必须可读，所有这些检查都发生在申请麦克风之前。

中文应选择多语言 `ggml-small.bin`。`small.en` 是英文专用模型，不能用于中文；常见 `.en.` 文件名会在申请权限前被拦截，任意改名或其他量化文件名的完整校验仍由 CLI 完成。`small` 是模型规模，并非本协议限制；其他兼容模型也可接入。模型格式和变体见 [whisper.cpp 模型文档](https://github.com/ggml-org/whisper.cpp/tree/master/models)。本轮没有下载模型或 CLI。

```sh
# 你准备好可信任的本地 CLI 和 small 模型后，替换这里的占位路径。
# 实时模式先录音，在 stdin 输入 stop 后转写。
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities speech \
  --backend whisper --locale zh-CN \
  --whisper-cli /absolute/path/whisper-cli \
  --model /absolute/path/ggml-small.bin

# 文件模式不会请求麦克风或 Apple Speech 权限。
YUUKI_WHISPER_CLI=/absolute/path/whisper-cli \
YUUKI_WHISPER_MODEL=/absolute/path/ggml-small.bin \
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities speech \
  --backend whisper --locale zh-CN --file /absolute/path/recording.m4a
```

文件模式只支持 AVFoundation 实际能够解码的音频；扩展名不等于编解码器保证。helper 分块转换成 16 kHz、单声道、16-bit PCM WAV，再通过 `Process.arguments` 启动程序，不使用 shell：

```text
whisper-cli -m <model> -f <normalized.wav> -l zh -otxt -of <temporary-base>
```

`zh-CN` / `en-US` 映射到 `zh` / `en`，也接受 `auto`。`-otxt` 生成文本文件，`-of` 指定不含扩展名的路径；这些选项来自 [whisper.cpp 官方 CLI 文档](https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md)。helper 读取生成的 `.txt` 作为最终内容，不把 CLI 日志误当识别文本。Whisper 后端拒绝 `--allow-network`，不自动改用 Apple 识别。

Whisper 输出 `speech.state: recording`，停止录音后为 `transcribing`（含音频转换和推理），然后 `speech.final` 和 `stopped`。文件模式跳过 recording。这是**先录音、后转写**，没有伪造部分转写、VAD 自动断句或长期驻留模型；每轮启动 CLI 并重新加载模型，因此会显现模型加载和首段等待的成本。静音也可能产生空文本或误识别，本例没有为模型结果做语音活动过滤。

### 停止与取消必须分开

| 操作 | Apple | Whisper |
|---|---|---|
| stdin `stop\n` | 停止采集，最多等 2 秒收尾 | 结束录音并开始本地转写；转写期间再次 stop 不重复启动 |
| stdin `cancel\n` | 取消，不提交部分文本为 final | 取消录音、转换或推理，不开始新推理 |
| stdin EOF、SIGTERM、SIGINT | 取消并清理 | 取消并清理，绝不因为 UI 退出而开始推理 |
| stdout 被宿主关闭 | 转入取消 | 转入取消 |

**stop 后应保持 stdin 打开，直到结果返回或明确取消。** `printf 'stop\n' | …` 会紧接着 EOF，表示取消，不能用来等待 Whisper 完成。终端里可输入 stop 后继续保持终端打开；Ctrl-D/Ctrl-C 是取消。Whisper 转写可能超过 3 秒，宿主应展示进度和取消入口，不能沿用 Apple 的短收尾强杀计时。

### Whisper 资源边界

- 录音最多 120 秒，到限自动结束录音并转写；用户取消不转写。
- 输入非空，最多 256 MiB、10 分钟、1–8 声道；转换后样本数量同样限制到 10 分钟。
- 音频分块转换，最多 45 秒；取消时等转换线程退出再删除它正在使用的文件。
- CLI 推理最多 10 分钟；stdout/stderr 各累计最多 512 KiB，各只保留 16 KiB 诊断尾部；结果文本最多 1 MiB。
- 取消或失败先终止 CLI，2 秒仍未退出则发送 SIGKILL，待子进程退出再清理。
- 每轮建立权限 0700 的随机临时目录，录音、规范化音频和结果都在其中。正常完成、可控失败或取消后删除，不持久保存转写历史。

强制 SIGKILL helper、系统崩溃或断电无法执行清理，可能遗留系统临时文件；本例没有后台清扫器。配置的 CLI 是用户信任的本地程序，没有操作系统沙箱。helper 本身不下载或发起网络识别，但不能保证任意用户提供的可执行文件不访问网络。

## Apple 兼容调用与基础协议

以下命令由你主动运行。`speech` 会按需申请权限；集成的应用只有在你点击“开始语音”后才启动它。

```sh
# 不请求权限：返回 zh-CN 支持情况与已有的授权状态。
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities probe

# 不请求权限：参数拒绝与 JSONL 编码的独立检查。
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities --self-test

# 实时麦克风；默认要求端侧识别，绝不静默回退到网络。
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities speech --locale zh-CN

# 已有音频文件；不会打开麦克风，仍可能申请 Speech 权限。
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities speech --locale zh-CN --file /absolute/path/recording.m4a

# 明确允许 Apple 的网络识别。只在你接受该数据路径时使用。
examples/shared/native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities speech --locale zh-CN --allow-network
```

stdout 每行是独立 JSON，诊断使用 stderr：

```json
{"type":"speech.state","state":"listening"}
{"type":"speech.partial","text":"查看工作区"}
{"type":"speech.final","text":"查看工作区并给出下一步建议"}
{"type":"speech.state","state":"stopped"}
```

错误示例：

```json
{"type":"speech.error","code":"on_device_unavailable","message":"..."}
{"type":"speech.state","state":"stopped"}
```

- `probe` 输出 `speech.capabilities`，含 `locale`、`available`、`supportsOnDeviceRecognition`、`speechAuthorization`、`microphoneAuthorization`、`permissionsRequested: false`。授权值是 Apple API 的原始整数；不能把两个 API 的枚举值相互类比。
- Apple 实时识别时，stdin `stop\n` 停止采集并最多等 2 秒收尾；文件模式 stop 取消当前请求。`cancel`、EOF、SIGINT/SIGTERM 取消且不输出草稿 final。完整后端差异见上方表格。
- stdout JSON 字符串中的换行被编码为转义字符。客户端应按字节积累数据，再按换行拆分，不能假设一次读取就是完整事件。
- 失败以非零状态退出。`arguments` 使用 2；权限、设备、识别失败使用 1。
- Apple 路线不落盘原始音频；Whisper 使用并清理临时文件。helper 不持久保存音频、转写历史或日志。
- Apple 默认 `requiresOnDeviceRecognition = true`；语言/设备不支持时明确失败。支持能力不代表此刻模型、设备、授权都可用。
- Apple stop 时若系统未给出 final，会将最后一段 partial 作为 final 发出。这是保留草稿的 UI 约定，不表示系统完成最终校正；明确 cancel 不会这样处理。
- 用户取消退出 0 且无 final；运行失败退出非零并带明确错误。Whisper 与 Apple 沿用相同 JSONL 信封，Whisper 不产生 `speech.partial`。

## 集成边界

每个示例把整个 `NativeCapabilities.app` 复制到自己的 app 中，使用 `Process` / `std::process::Command` / Node `spawn` 运行其 Mach-O 可执行文件，stdin 负责停止，stdout 负责状态和文本。它是进程协议，不是 FFI。不同语言都复用相同识别实现，比较的是接入和 UI 成本，不是识别精度差异。

macOS TCC 的归属可能涉及负责启动的宿主应用。**helper 和宿主都应有 `NSMicrophoneUsageDescription`、`NSSpeechRecognitionUsageDescription`**。从终端运行、从 Finder 打开、重新签名和更换包路径，可能显示不同的授权身份或要求重新授权。不要靠 `probe` 的既有授权值推断完整 App 已得到授权。应由你主动点击语音按钮，在系统弹窗中做出选择。

Whisper 麦克风模式只请求麦克风权限；Whisper 文件模式不请求 Speech 或麦克风权限。Apple 的权限路径保持原有方式。真实模型能力、系统框架能力和权限授权是三个不同条件。

真实分发仍需要稳定 bundle ID、签名身份、必要的 entitlements、目标分发方式对应的沙箱配置，以及用户设备上的验证。这个 helper 没有规避 TCC，也不会自动操作系统权限。若构建时系统拒绝覆盖已使用的 `.app`，请先正常退出相关程序并检查构建进程的 App Management 权限，不要强删签名包来绕过权限。

## 已做与未做

2026-09-26，macOS 27 / arm64，Swift 6.4：

- Apple + Whisper 适配已编译生成 ad-hoc 签名的 helper `.app`。
- 在用户后来允许跳过测试之前，执行过 `--self-test`，结果通过；执行过一次 `probe`，报告 zh-CN 端侧识别能力可用。这些检查没有申请权限或开启麦克风。
- 本次 Whisper 扩展按用户要求只构建，没有下载模型/CLI，没有运行测试、probe、computer-use、真实音频识别或权限弹窗。因此没有 Whisper 兼容性、耗时、精度和资源实测。
- 旧 `probe` 只报告 Apple 能力，旧 `--self-test` 保留基础参数/JSONL 检查；它们不能证明 Whisper 或新版音频路径已经通过验证。

## 进一步阅读

- [Apple：Speech framework](https://developer.apple.com/documentation/speech)
- [Apple：supportsOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition)
- [Apple：requiresOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition)
- [Apple：请求 Speech 授权](https://developer.apple.com/documentation/speech/sfspeechrecognizer/requestauthorization(_:))
- [Apple：麦克风授权](https://developer.apple.com/documentation/avfoundation/avcapturedevice/requestaccess(for:completionhandler:))
