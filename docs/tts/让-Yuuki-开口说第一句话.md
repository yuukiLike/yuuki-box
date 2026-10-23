# 让 Yuuki 开口说第一句话

屏幕上的 Yuuki 一直在打字，今天让它真的开口。**先让 Mac 读一句中文，听见声音以后，再把台词换成你自己的。**

想下载全部三个工具，点[给 Yuuki 装上耳朵和嘴巴：安装 + 每个两个用法](README.md)。

TTS 就是「文字变声音」。先收藏这 3 个仓库，今天只玩 edge-tts。

| 顺序 | 仓库 | 能解决的真实问题 | 免费方式 |
|---|---|---|---|
| **今天** | [edge-tts](https://github.com/rany2/edge-tts) | 把文章、AI 回复读出来 | 在线使用，无需 API Key |
| 下一步 | [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 把录音变成文字，做语音输入 | 下载模型后本地运行，适合 Mac |
| 以后 | [silero-vad](https://github.com/snakers4/silero-vad) | 检测人声与静音，辅助切分录音 | 本地运行，免费开源 |

后两个分别负责转写和人声检测，方便以后补齐语音交互。

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

前两行准备独立的 Python 环境并安装工具，后面生成 MP3，再用 Mac 自带播放器播放。

**听到声音，第一次发声就完成了。** 现在只修改 `--text` 后面的文字，给它换句台词：一句开场白、一条任务提醒，或者一句“收工啦”。重新生成并播放，比较短句和长句的听感。参数用法见 [edge-tts 官方说明](https://github.com/rany2/edge-tts#usage)。

记住一点：edge-tts 的声音由微软在线服务生成，需要联网，文字会上传。

未来接入 Yuuki，可以从这条路线开始：

`你说话 → Whisper 转文字 → AI 回复 → edge-tts 读出来`

资料核对日期：2026-10-14。本文是上手练习，命令尚未在本机执行验证。
