use crate::{
    button,
    input::TextInput,
    process::{JsonProcess, ProcessEvent},
    resources,
};
use gpui::{Context, Entity, Task, Window, div, prelude::*, px, rgb};
use serde_json::{Value, json};
use std::path::PathBuf;

pub struct Workbench {
    task: Entity<TextInput>,
    audio_file: Entity<TextInput>,
    fields: Vec<(&'static str, &'static str, Entity<TextInput>)>,
    state: Value,
    notice: String,
    speech_status: String,
    transcript: String,
    exported: String,
    settings_open: bool,
    settings_loaded: bool,
    backend: String,
    busy: bool,
    connected: bool,
    runtime: Option<JsonProcess>,
    runtime_task: Option<Task<()>>,
    speech: Option<JsonProcess>,
    speech_task: Option<Task<()>>,
    pending_prompt: Option<String>,
}

fn value_text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn bundled_executable(app: &str, executable: &str, development: &str) -> PathBuf {
    let directory = resources();
    let bundled = directory.join(format!("{app}.app/Contents/MacOS/{executable}"));
    if bundled.exists() {
        bundled
    } else {
        directory.join(development)
    }
}

impl Workbench {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let task =
            cx.new(|cx| TextInput::new("输入任务，例如：列出工作区文件并总结 README", false, cx));
        let audio_file =
            cx.new(|cx| TextInput::new("可选：音频文件绝对路径；留空使用麦克风", false, cx));
        let fields = [
            ("apiBase", "API 地址", "https://api.deepseek.com"),
            ("model", "模型", "deepseek-flash"),
            (
                "apiKey",
                "替换 API Key（遮罩，保存后清空）",
                "留空保留 Keychain 中已有凭据",
            ),
            ("workspace", "工作区绝对路径", "/Users/you/project"),
            ("maxOutputTokens", "最大输出 token", "2048"),
            ("maxRounds", "最大工具循环轮数", "4"),
            ("whisperCLI", "Whisper CLI 绝对路径", "/path/to/whisper-cli"),
            (
                "whisperModel",
                "Whisper 模型绝对路径",
                "/path/to/ggml-model.bin",
            ),
        ]
        .into_iter()
        .map(|(key, label, placeholder)| {
            (
                key,
                label,
                cx.new(|cx| TextInput::new(placeholder, key == "apiKey", cx)),
            )
        })
        .collect();
        let mut this = Self {
            task,
            audio_file,
            fields,
            state: Value::Null,
            notice: "正在连接本地 Agent runtime…".into(),
            speech_status: "语音未启动；转录后可手动放入任务草稿".into(),
            transcript: String::new(),
            exported: String::new(),
            settings_open: false,
            settings_loaded: false,
            backend: "apple".into(),
            busy: false,
            connected: false,
            runtime: None,
            runtime_task: None,
            speech: None,
            speech_task: None,
            pending_prompt: None,
        };
        cx.on_app_quit(|this, _| {
            this.runtime = None;
            this.runtime_task = None;
            this.speech = None;
            this.speech_task = None;
            async {}
        })
        .detach();
        this.connect(cx);
        this
    }

    fn connect(&mut self, cx: &mut Context<Self>) {
        self.runtime_task = None;
        self.runtime = None;
        self.connected = false;
        self.busy = false;
        let path = bundled_executable(
            "AgentRuntime",
            "agent-runtime",
            "runtime/build/AgentRuntime.app/Contents/MacOS/agent-runtime",
        );
        let (process, events) =
            match JsonProcess::spawn(&path, &["serve".into(), "--route".into(), "gpui".into()]) {
                Ok(result) => result,
                Err(error) => {
                    self.notice = error;
                    cx.notify();
                    return;
                }
            };
        self.runtime = Some(process);
        self.notice = "正在载入本地会话…".into();
        self.runtime_task = Some(cx.spawn(async move |this, cx| {
            while let Ok(event) = events.recv().await {
                let closed = matches!(event, ProcessEvent::Closed);
                if this
                    .update(cx, |this, cx| {
                        this.runtime_event(event, cx);
                        cx.notify();
                    })
                    .is_err()
                {
                    return;
                }
                if closed {
                    return;
                }
            }
        }));
        self.command(json!({"op":"bootstrap"}));
        cx.notify();
    }

    fn command(&mut self, command: Value) -> bool {
        let result = self
            .runtime
            .as_ref()
            .ok_or_else(|| "运行时未连接，请重连".to_string())
            .and_then(|runtime| runtime.send_json(&command));
        if let Err(error) = result {
            self.notice = error;
            false
        } else {
            true
        }
    }

    fn runtime_event(&mut self, event: ProcessEvent, cx: &mut Context<Self>) {
        match event {
            ProcessEvent::Json(event) => match event.get("type").and_then(Value::as_str) {
                Some("state") => {
                    let Some(state) = event.get("state").filter(|state| state.is_object()) else {
                        self.notice = "运行时 state 数据无效".into();
                        return;
                    };
                    self.state = state.clone();
                    self.connected = true;
                    self.busy = state.get("busy").and_then(Value::as_bool).unwrap_or(false);
                    self.notice = value_text(state, "notice");
                    if !self.settings_loaded {
                        let settings = &state["settings"];
                        for (key, _, input) in &self.fields {
                            if *key == "apiKey" {
                                continue;
                            }
                            let value = match &settings[*key] {
                                Value::String(value) => value.clone(),
                                Value::Number(value) => value.to_string(),
                                _ => String::new(),
                            };
                            input.update(cx, |input, cx| input.set_value(&value, cx));
                        }
                        self.backend = value_text(settings, "speechBackend");
                        if self.backend.is_empty() {
                            self.backend = "apple".into();
                        }
                        self.settings_loaded = true;
                    }
                    if let Some(prompt) = self.pending_prompt.as_ref() {
                        let accepted =
                            state["session"]["messages"]
                                .as_array()
                                .is_some_and(|messages| {
                                    messages
                                        .iter()
                                        .rev()
                                        .find(|message| message["role"] == "user")
                                        .is_some_and(|message| message["content"] == *prompt)
                                });
                        if accepted {
                            self.task.update(cx, |input, cx| input.set_value("", cx));
                            self.pending_prompt = None;
                        }
                    }
                }
                Some("delta") => {
                    if event["sessionId"] != self.state["session"]["id"] {
                        return;
                    }
                    let id = value_text(&event, "messageId");
                    let delta = value_text(&event, "text");
                    if let Some(messages) = self.state["session"]["messages"].as_array_mut() {
                        if let Some(message) =
                            messages.iter_mut().find(|message| message["id"] == id)
                        {
                            if let Some(content) = message["content"].as_str() {
                                message["content"] = Value::String(format!("{content}{delta}"));
                            }
                        }
                    }
                }
                Some("error") => {
                    self.notice = format!("错误：{}", value_text(&event, "message"));
                    self.pending_prompt = None;
                    self.busy = self.state["busy"].as_bool().unwrap_or(false);
                }
                Some("export") => {
                    self.exported = value_text(&event, "path");
                    self.notice = "会话 Markdown 已导出到下方路径".into();
                }
                _ => self.notice = "运行时返回未知事件".into(),
            },
            ProcessEvent::Error(error) => self.notice = error,
            ProcessEvent::Closed => {
                self.runtime = None;
                self.connected = false;
                self.busy = false;
                self.notice = format!(
                    "运行时已断开：{}。草稿仍在，可点击重连恢复会话",
                    self.notice
                );
            }
        }
    }

    fn field(&self, key: &str, cx: &Context<Self>) -> String {
        self.fields
            .iter()
            .find(|(name, _, _)| *name == key)
            .map(|(_, _, input)| input.read(cx).value().trim().to_string())
            .unwrap_or_default()
    }

    fn save_settings(&mut self, cx: &mut Context<Self>) {
        if self.busy {
            self.notice = "运行期间不能修改设置，请先取消任务".into();
            cx.notify();
            return;
        }
        let max_tokens = match self.field("maxOutputTokens", cx).parse::<u32>() {
            Ok(value) if (128..=16_384).contains(&value) => value,
            _ => {
                self.notice = "最大输出 token 必须是 128–16384 之间的整数".into();
                cx.notify();
                return;
            }
        };
        let max_rounds = match self.field("maxRounds", cx).parse::<u32>() {
            Ok(value) if (1..=12).contains(&value) => value,
            _ => {
                self.notice = "循环轮数必须是 1–12 之间的整数".into();
                cx.notify();
                return;
            }
        };
        let command = json!({"op":"settings.save", "settings":{
            "apiBase":self.field("apiBase", cx), "model":self.field("model", cx),
            "workspace":self.field("workspace", cx), "maxOutputTokens":max_tokens,
            "maxRounds":max_rounds,"speechBackend":self.backend,
            "whisperCLI":self.field("whisperCLI", cx),"whisperModel":self.field("whisperModel", cx)
        },"apiKey":self.field("apiKey", cx)});
        let sent = self.command(command);
        for (key, _, input) in &self.fields {
            if *key == "apiKey" {
                input.update(cx, |input, cx| input.set_value("", cx));
            }
        }
        if sent {
            self.settings_loaded = false;
            self.notice = "设置已发送；API Key 输入已清空，等待运行时确认".into();
        }
        cx.notify();
    }

    fn start_run(&mut self, cx: &mut Context<Self>) {
        if self.busy {
            return;
        }
        let prompt = self.task.read(cx).value().trim().to_string();
        if prompt.is_empty() {
            self.notice = "先输入任务".into();
            cx.notify();
            return;
        }
        if prompt.len() > 32 * 1024 {
            self.notice = "任务过长，请缩短到 32 KiB 内".into();
            cx.notify();
            return;
        }
        if self.command(json!({"op":"run.start","text":prompt})) {
            self.pending_prompt = Some(prompt);
            self.busy = true;
            self.notice = "任务已提交，等待运行时事件…".into();
        }
        cx.notify();
    }

    fn session_command(&mut self, command: Value, cx: &mut Context<Self>) {
        if self.busy {
            self.notice = "任务运行中，请完成或取消后切换会话".into();
        } else {
            self.exported.clear();
            self.command(command);
        }
        cx.notify();
    }

    fn start_speech(&mut self, cx: &mut Context<Self>) {
        if self.speech.is_some() {
            return;
        }
        let settings = &self.state["settings"];
        let backend = value_text(settings, "speechBackend");
        let backend = if backend.is_empty() {
            "apple".to_string()
        } else {
            backend
        };
        let mut arguments = vec![
            "speech".into(),
            "--locale".into(),
            "zh-CN".into(),
            "--backend".into(),
            backend.clone(),
        ];
        if backend == "whisper" {
            let cli = value_text(settings, "whisperCLI");
            let model = value_text(settings, "whisperModel");
            if cli.is_empty() || model.is_empty() {
                self.speech_status = "Whisper 需要先在设置中保存 CLI 与模型路径".into();
                cx.notify();
                return;
            }
            arguments.extend(["--whisper-cli".into(), cli, "--model".into(), model]);
        }
        let file = self.audio_file.read(cx).value().trim().to_string();
        if !file.is_empty() {
            arguments.extend(["--file".into(), file]);
        }
        let path = bundled_executable(
            "NativeCapabilities",
            "native-capabilities",
            "native/build/NativeCapabilities.app/Contents/MacOS/native-capabilities",
        );
        let (process, events) = match JsonProcess::spawn(&path, &arguments) {
            Ok(result) => result,
            Err(error) => {
                self.speech_status = error;
                cx.notify();
                return;
            }
        };
        self.speech = Some(process);
        self.transcript.clear();
        self.speech_status = format!("正在启动 {backend}；仅此操作可能请求系统权限");
        self.speech_task = Some(cx.spawn(async move |this, cx| {
            while let Ok(event) = events.recv().await {
                let closed = matches!(event, ProcessEvent::Closed);
                if this
                    .update(cx, |this, cx| {
                        match event {
                            ProcessEvent::Json(event) => match event["type"].as_str() {
                                Some("speech.partial") | Some("speech.final") => {
                                    this.transcript = value_text(&event, "text")
                                }
                                Some("speech.state") => {
                                    if !this.speech_status.starts_with("语音错误") {
                                        this.speech_status =
                                            format!("语音状态：{}", value_text(&event, "state"));
                                    }
                                }
                                Some("speech.error") => {
                                    this.speech_status = format!(
                                        "语音错误 [{}]：{}",
                                        value_text(&event, "code"),
                                        value_text(&event, "message")
                                    )
                                }
                                _ => {}
                            },
                            ProcessEvent::Error(error) => {
                                this.speech_status = format!("语音错误：{error}")
                            }
                            ProcessEvent::Closed => {
                                this.speech = None;
                                if !this.speech_status.starts_with("语音错误") {
                                    this.speech_status =
                                        "语音进程已结束；可将转录放入任务草稿".into();
                                }
                            }
                        }
                        cx.notify();
                    })
                    .is_err()
                {
                    return;
                }
                if closed {
                    return;
                }
            }
        }));
        cx.notify();
    }

    fn speech_command(&mut self, command: &str, cx: &mut Context<Self>) {
        if let Some(process) = &self.speech {
            match process.send_line(command.into()) {
                Ok(()) => {
                    self.speech_status = if command == "stop" {
                        "已请求结束录音；正在等待转写完成，可使用取消中断".into()
                    } else {
                        "正在取消语音…".into()
                    }
                }
                Err(error) => self.speech_status = format!("语音错误：{error}"),
            }
        }
        cx.notify();
    }

    fn render_settings(&self, cx: &mut Context<Self>) -> impl IntoElement {
        div().id("agent-settings").flex().flex_col().flex_1().min_h_0().overflow_y_scroll().gap_3().p_3()
            .child("设置保存在本地运行时，API Key 由 macOS Keychain 管理；只有发送任务才会调用模型。")
            .children(self.fields.iter().map(|(_, label, input)| {
                div().flex().flex_col().gap_1().child(div().text_sm().child(*label)).child(input.clone())
            }))
            .child(div().flex().gap_2()
                .child(button("backend-apple", "Apple Speech", self.backend == "apple").on_click(cx.listener(|this, _, _, cx| { this.backend = "apple".into(); cx.notify(); })))
                .child(button("backend-whisper", "本地 Whisper", self.backend == "whisper").on_click(cx.listener(|this, _, _, cx| { this.backend = "whisper".into(); cx.notify(); }))))
            .child(div().flex().gap_2()
                .child(button("save-settings", "保存设置", false).on_click(cx.listener(|this, _, _, cx| this.save_settings(cx))))
                .child(button("remove-key", "移除 Keychain API Key", false).on_click(cx.listener(|this, _, _, cx| {
                    if !this.busy {
                        this.command(json!({"op":"settings.save","clearAPIKey":true}));
                        for (key, _, input) in &this.fields {
                            if *key == "apiKey" { input.update(cx, |input, cx| input.set_value("", cx)); }
                        }
                    } else { this.notice = "运行期间不能删除凭据，请先取消任务".into(); }
                    cx.notify();
                }))))
            .child(div().text_sm().child("Whisper CLI 与模型需自行准备；此应用不会下载模型。保存后语音使用运行时确认的设置。"))
    }

    fn render_conversation(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let messages = self.state["session"]["messages"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let approval = self.state["session"]["pendingApproval"].clone();
        div().flex().flex_col().flex_1().min_h_0().gap_2()
            .child(div().id("conversation").flex().flex_col().flex_1().min_h_0().overflow_y_scroll().gap_3().p_2()
                .when(messages.is_empty(), |view| view.child("新会话。配置凭据和工作区后，在下方输入任务。模型与工具记录会显示在这里。"))
                .children(messages.into_iter().map(|message| {
                    div().flex().flex_col().gap_2().p_3().rounded_md().bg(rgb(0x1b2935))
                        .child(div().text_sm().text_color(rgb(0x88cdb8)).child(format!("{} {} · {}", value_text(&message,"role"), value_text(&message,"name"), value_text(&message,"status"))))
                        .child(div().text_sm().child(value_text(&message,"content")))
                })))
            .when(approval.is_object(), |view| {
                let id_allow = value_text(&approval, "id");
                let id_deny = id_allow.clone();
                view.child(div().flex().flex_col().gap_2().p_3().rounded_md().bg(rgb(0x403529))
                    .child(format!("等待批准：{} · {}", value_text(&approval,"tool"), value_text(&approval,"path")))
                    .child(div().id("approval-preview").max_h(px(130.)).overflow_y_scroll().text_sm().child(value_text(&approval,"preview")))
                    .child(div().flex().gap_2()
                        .child(button("approval-allow", "批准这次写入", false).on_click(cx.listener(move |this, _, _, cx| { this.command(json!({"op":"approval.respond","approvalId":id_allow,"allow":true})); cx.notify(); })))
                        .child(button("approval-deny", "拒绝", false).on_click(cx.listener(move |this, _, _, cx| { this.command(json!({"op":"approval.respond","approvalId":id_deny,"allow":false})); cx.notify(); })))) )
            })
            .child(self.task.clone())
            .child(div().flex().gap_2()
                .child(button("run-start", "发送任务", self.busy).on_click(cx.listener(|this, _, _, cx| this.start_run(cx))))
                .child(button("run-cancel", "取消运行", false).on_click(cx.listener(|this, _, _, cx| { if this.command(json!({"op":"run.cancel"})) { this.notice = "已请求取消，等待运行时确认".into(); } cx.notify(); })))
                .child(button("session-export", "导出 Markdown", false).on_click(cx.listener(|this, _, _, cx| { this.command(json!({"op":"session.export"})); cx.notify(); }))))
    }
}

impl Render for Workbench {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let sessions = self.state["sessions"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let selected = value_text(&self.state["session"], "id");
        let key_state = self.state["hasAPIKey"].as_bool().unwrap_or(false);
        let usage = &self.state["session"]["usage"];
        div()
            .flex()
            .flex_col()
            .size_full()
            .gap_2()
            .p_3()
            .bg(rgb(0x111a22))
            .text_color(rgb(0xe4ebee))
            .child(
                div()
                    .flex()
                    .gap_2()
                    .child(
                        button("show-chat", "Agent", !self.settings_open).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.settings_open = false;
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        button("show-settings", "设置", self.settings_open).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.settings_open = true;
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        button("runtime-reconnect", "重连运行时", false).on_click(cx.listener(
                            |this, _, _, cx| {
                                if !this.busy {
                                    this.connect(cx);
                                }
                            },
                        )),
                    )
                    .child(div().text_sm().child(format!(
                        "{} · Key {} · {}",
                        if self.connected {
                            "已连接"
                        } else {
                            "未连接"
                        },
                        if key_state { "已配置" } else { "未配置" },
                        value_text(&self.state["settings"], "model")
                    ))),
            )
            .child(div().text_sm().child(self.notice.clone()))
            .when(!self.exported.is_empty(), |view| {
                view.child(
                    div()
                        .text_sm()
                        .text_color(rgb(0x88cdb8))
                        .child(format!("导出：{}", self.exported)),
                )
            })
            .child(
                div()
                    .flex()
                    .flex_1()
                    .min_h_0()
                    .gap_3()
                    .child(
                        div()
                            .w(px(200.))
                            .flex_shrink_0()
                            .flex()
                            .flex_col()
                            .gap_2()
                            .child(button("session-new", "新会话", false).on_click(cx.listener(
                                |this, _, _, cx| {
                                    this.session_command(json!({"op":"session.new"}), cx)
                                },
                            )))
                            .child(div().id("sessions").flex_1().overflow_y_scroll().children(
                                sessions.into_iter().map(|session| {
                                    let id = value_text(&session, "id");
                                    let is_selected = selected == id;
                                    div()
                                        .id(gpui::SharedString::from(id.clone()))
                                        .p_2()
                                        .mb_1()
                                        .rounded_md()
                                        .cursor_pointer()
                                        .bg(rgb(if is_selected { 0x284959 } else { 0x1a2834 }))
                                        .child(div().text_sm().child(value_text(&session, "title")))
                                        .child(
                                            div().text_xs().child(value_text(&session, "status")),
                                        )
                                        .on_click(cx.listener(move |this, _, _, cx| {
                                            this.session_command(
                                                json!({"op":"session.select","sessionId":id}),
                                                cx,
                                            )
                                        }))
                                }),
                            )),
                    )
                    .child(if self.settings_open {
                        self.render_settings(cx).into_any_element()
                    } else {
                        self.render_conversation(cx).into_any_element()
                    }),
            )
            .child(div().text_xs().child(format!(
                "用量：输入 {} / 输出 {} / 请求 {} / 未报告请求 {}",
                usage["promptTokens"],
                usage["completionTokens"],
                usage["requests"],
                usage["unreportedRequests"]
            )))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .p_2()
                    .border_t_1()
                    .border_color(rgb(0x31414e))
                    .child(self.audio_file.clone())
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .child(
                                button("voice-start", "开始语音 / 识别文件", self.speech.is_some())
                                    .on_click(cx.listener(|this, _, _, cx| this.start_speech(cx))),
                            )
                            .child(button("voice-stop", "结束录音并转写", false).on_click(
                                cx.listener(|this, _, _, cx| this.speech_command("stop", cx)),
                            ))
                            .child(button("voice-cancel", "取消语音", false).on_click(
                                cx.listener(|this, _, _, cx| this.speech_command("cancel", cx)),
                            ))
                            .child(button("voice-use", "转录放入任务", false).on_click(
                                cx.listener(|this, _, _, cx| {
                                    if !this.transcript.is_empty() {
                                        this.task.update(cx, |input, cx| {
                                            input.set_value(&this.transcript, cx)
                                        });
                                        this.settings_open = false;
                                    }
                                    cx.notify();
                                }),
                            )),
                    )
                    .child(div().text_xs().child(self.speech_status.clone()))
                    .child(
                        div()
                            .id("speech-text")
                            .max_h(px(70.))
                            .overflow_y_scroll()
                            .text_sm()
                            .child(self.transcript.clone()),
                    ),
            )
    }
}
