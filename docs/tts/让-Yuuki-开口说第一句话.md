# TTS 入门：合成并播放中文

使用 Mac <mark class="key">合成并播放中文</mark>，再替换输入文本。

完整安装见[语音工具安装与用法](README.md)。

本课使用 edge-tts 将文字合成为声音。

| 顺序 | 仓库 | 能解决的真实问题 | 免费方式 |
|---|---|---|---|
| **本课** | [edge-tts](https://github.com/rany2/edge-tts) | 把文章、AI 回复读出来 | 在线使用，无需 API Key |
| 下一步 | [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 把录音变成文字，做语音输入 | 下载模型后本地运行，适合 Mac |
| 以后 | [silero-vad](https://github.com/snakers4/silero-vad) | 检测人声与静音，辅助切分录音 | 本地运行，免费开源 |

后两项为扩展练习。

**打开 Mac 终端，依次执行：**

```bash
python3 -m venv /tmp/voice-demo
/tmp/voice-demo/bin/pip install edge-tts

/tmp/voice-demo/bin/edge-tts \
  --voice zh-CN-XiaoxiaoNeural \
  --text "你好，我是 Yuuki。你的任务已经完成。" \
  --write-media /tmp/hello.mp3

afplay /tmp/hello.mp3
```

命令创建独立环境、生成 MP3，再用 Mac 播放。

**验收：音频可正常播放。** 修改 `--text`，重生成并比较长短句听感。参数见 [edge-tts 官方说明](https://github.com/rany2/edge-tts#usage)。

<mark class="caution">文字会上传微软在线服务</mark>，需联网。

Yuuki 语音接入路径：

`语音输入 → Whisper 转写 → AI 回复 → edge-tts 合成`

资料核对日期：2026-10-14。本文是上手练习，命令尚未在本机执行验证。
