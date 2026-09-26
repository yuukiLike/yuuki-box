mod input;
mod model;
mod process;
mod scenarios;
mod workbench;

use gpui::{
    App, Application, Bounds, Context, Div, Entity, Stateful, Task, Window, WindowBounds,
    WindowOptions, div, prelude::*, px, rgb, size, uniform_list,
};
use model::{Event, HISTORY_LIMIT, STREAM_LIMIT};
use std::{path::PathBuf, time::Duration};

struct AgentBox {
    fixture: Vec<Event>,
    events: Vec<Event>,
    visible: Vec<usize>,
    only_tools: bool,
    streaming: bool,
    streamed: usize,
    history_count: usize,
    next_id: usize,
    status: String,
    update_status: String,
    ticker: Option<Task<()>>,
}

fn resources() -> PathBuf {
    if let Ok(executable) = std::env::current_exe() {
        if let Some(contents) = executable.parent().and_then(|parent| parent.parent()) {
            let directory = contents.join("Resources");
            if directory.join("fixtures/events.json").exists() {
                return directory;
            }
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../shared")
}

impl AgentBox {
    fn new() -> Self {
        let (fixture, status) = match model::read_fixture(&resources().join("fixtures/events.json"))
        {
            Ok(events) => (events, "就绪 · 模拟流每 50 ms 一条，每次最多 200 条".into()),
            Err(error) => (Vec::new(), format!("Fixture 读取失败：{error}")),
        };
        let mut this = Self {
            fixture,
            events: Vec::new(),
            visible: Vec::new(),
            only_tools: false,
            streaming: false,
            streamed: 0,
            history_count: 1000,
            next_id: 1,
            status,
            update_status: "更新实验：读取本地共享 manifest；不下载、不安装".into(),
            ticker: None,
        };
        this.load_history(1000);
        this
    }

    fn load_history(&mut self, count: usize) {
        self.streaming = false;
        self.streamed = 0;
        self.history_count = count;
        self.events = model::history(&self.fixture, count);
        self.next_id = self.events.len() + 1;
        self.reindex();
    }

    fn reindex(&mut self) {
        self.visible = self
            .events
            .iter()
            .enumerate()
            .filter_map(|(index, event)| (!self.only_tools || event.is_tool()).then_some(index))
            .collect();
    }

    fn start_stream(&mut self, cx: &mut Context<Self>) {
        if self.fixture.is_empty() {
            self.status = "缺少有效 fixture，无法启动模拟流".into();
            cx.notify();
            return;
        }
        self.streamed = 0;
        self.streaming = true;
        self.status = "流式回放中 · 可滚动、切换过滤或立即停止".into();
        self.start_ticker(cx);
        cx.notify();
    }

    fn start_ticker(&mut self, cx: &mut Context<Self>) {
        self.ticker = Some(cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor()
                    .timer(Duration::from_millis(50))
                    .await;
                let active = this.update(cx, |this, cx| {
                    this.tick();
                    cx.notify();
                    this.streaming
                });
                if !matches!(active, Ok(true)) {
                    break;
                }
            }
        }));
    }

    fn tick(&mut self) {
        if self.streaming {
            if let Some(template) = self.fixture.get(self.streamed % self.fixture.len().max(1)) {
                let mut event = template.clone();
                event.id = self.next_id;
                event.text = format!("[stream {}] {}", self.streamed + 1, event.text);
                self.next_id += 1;
                self.streamed += 1;
                self.events.push(event);
                if self.events.len() > HISTORY_LIMIT {
                    self.events.remove(0);
                    self.reindex();
                } else if self
                    .events
                    .last()
                    .is_some_and(|event| !self.only_tools || event.is_tool())
                {
                    self.visible.push(self.events.len() - 1);
                }
                if self.streamed >= STREAM_LIMIT {
                    self.streaming = false;
                    self.status = "本次 200 条回放完成".into();
                }
            }
        }
    }

    fn check_update(&mut self, cx: &mut Context<Self>) {
        let selection = match std::env::var("YUUKI_UPDATE_FIXTURE") {
            Ok(value) => Ok(value),
            Err(std::env::VarError::NotPresent) => Ok("available".to_string()),
            Err(error) => Err(format!("YUUKI_UPDATE_FIXTURE 无效：{error}")),
        };
        let result = selection
            .and_then(|selection| {
                let filename = match selection.as_str() {
                    "available" => "update.json",
                    "current" => "update-current.json",
                    "invalid" => "update-invalid.json",
                    _ => {
                        return Err(
                            "YUUKI_UPDATE_FIXTURE 仅接受 available、current、invalid".into()
                        );
                    }
                };
                std::fs::read_to_string(resources().join("fixtures").join(filename))
                    .map_err(|error| error.to_string())
            })
            .and_then(|json| model::validate_update(&json, env!("CARGO_PKG_VERSION")));
        self.update_status = match result {
            Ok(Some(update)) => format!(
                "发现 {} · {}\n{}\n仅展示清单；未执行下载、签名验证或安装。",
                update.version, update.notes, update.url
            ),
            Ok(None) => "当前版本已是最新版本（相对于本地 manifest）".into(),
            Err(error) => format!("检查更新失败：{error}"),
        };
        cx.notify();
    }
}

fn button(id: &'static str, label: &'static str, selected: bool) -> Stateful<Div> {
    div()
        .id(id)
        .px_3()
        .py_2()
        .rounded_md()
        .cursor_pointer()
        .text_sm()
        .bg(rgb(if selected { 0x284959 } else { 0x25303b }))
        .hover(|style| style.bg(rgb(0x355066)))
        .child(label)
}

impl Render for AgentBox {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .size_full()
            .p_5()
            .gap_3()
            .bg(rgb(0x111a22))
            .text_color(rgb(0xe4ebee))
            .font_family(".AppleSystemUIFont")
            .child(div().text_xl().child("Yuuki Lab · Rust + GPUI"))
            .child(
                div()
                    .text_sm()
                    .text_color(rgb(0x9cabb9))
                    .child("GPUI 0.2.2 / Metal / runtime shaders · 应用 0.1.0 · 固定行高虚拟列表"),
            )
            .child(
                div()
                    .flex()
                    .gap_2()
                    .child(
                        button("history-1000", "1,000 条", self.history_count == 1000).on_click(
                            cx.listener(|this, _, _, cx| {
                                this.load_history(1000);
                                this.status = "已加载 1,000 条历史".into();
                                cx.notify();
                            }),
                        ),
                    )
                    .child(
                        button("history-10000", "10,000 条", self.history_count == 10000).on_click(
                            cx.listener(|this, _, _, cx| {
                                this.load_history(10000);
                                this.status = "已加载 10,000 条历史".into();
                                cx.notify();
                            }),
                        ),
                    )
                    .child(
                        button("filter-all", "全部", !self.only_tools).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.only_tools = false;
                                this.reindex();
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        button("filter-tools", "仅工具", self.only_tools).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.only_tools = true;
                                this.reindex();
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        button("start", "开始模拟流", self.streaming)
                            .on_click(cx.listener(|this, _, _, cx| this.start_stream(cx))),
                    )
                    .child(button("stop", "停止模拟流", false).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.streaming = false;
                            this.status = format!("已停止 · 本次 {} 条", this.streamed);
                            cx.notify();
                        },
                    ))),
            )
            .child(div().text_sm().child(format!(
                "{}  ·  总计 {} / 显示 {}",
                self.status,
                self.events.len(),
                self.visible.len()
            )))
            .child(
                div()
                    .flex_1()
                    .min_h(px(100.))
                    .border_1()
                    .border_color(rgb(0x30404d))
                    .rounded_md()
                    .overflow_hidden()
                    .child(
                        uniform_list(
                            "events",
                            self.visible.len(),
                            cx.processor(|this, range: std::ops::Range<usize>, _, _| {
                                range
                                    .filter_map(|index| {
                                        this.visible
                                            .get(index)
                                            .and_then(|source| this.events.get(*source))
                                    })
                                    .map(|event| {
                                        div()
                                            .h(px(32.))
                                            .px_3()
                                            .flex()
                                            .items_center()
                                            .gap_3()
                                            .border_b_1()
                                            .border_color(rgb(0x1d2b36))
                                            .child(
                                                div()
                                                    .w(px(60.))
                                                    .flex_shrink_0()
                                                    .text_sm()
                                                    .text_color(rgb(0x748999))
                                                    .child(format!("{:05}", event.id)),
                                            )
                                            .child(
                                                div()
                                                    .w(px(48.))
                                                    .flex_shrink_0()
                                                    .text_sm()
                                                    .text_color(rgb(if event.is_tool() {
                                                        0x85d1b7
                                                    } else {
                                                        0x9baabc
                                                    }))
                                                    .child(if event.is_tool() {
                                                        "TOOL"
                                                    } else {
                                                        "TEXT"
                                                    }),
                                            )
                                            .child(
                                                div()
                                                    .flex_1()
                                                    .truncate()
                                                    .text_sm()
                                                    .child(event.text.clone()),
                                            )
                                    })
                                    .collect::<Vec<_>>()
                            }),
                        )
                        .h_full()
                        .w_full(),
                    ),
            )
            .child(
                div().flex().gap_2().child(
                    button("update", "检查更新清单", false)
                        .on_click(cx.listener(|this, _, _, cx| this.check_update(cx))),
                ),
            )
            .child(
                div()
                    .text_sm()
                    .text_color(rgb(0xaac0cc))
                    .child(self.update_status.clone()),
            )
    }
}

struct Shell {
    page: u8,
    scenarios: Entity<scenarios::Scenarios>,
    workbench: Entity<workbench::Workbench>,
    replay: Entity<AgentBox>,
}

impl Render for Shell {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .size_full()
            .bg(rgb(0x111a22))
            .text_color(rgb(0xe4ebee))
            .child(
                div()
                    .flex()
                    .gap_2()
                    .p_3()
                    .child(
                        button("mode-agent", "Agent 工作台", self.page == 0).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.page = 0;
                                this.scenarios
                                    .update(cx, |scenarios, cx| scenarios.stop(cx));
                                this.replay.update(cx, |replay, cx| {
                                    replay.streaming = false;
                                    replay.ticker = None;
                                    cx.notify();
                                });
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        button("mode-replay", "渲染 / 更新实验", self.page == 1).on_click(
                            cx.listener(|this, _, _, cx| {
                                this.page = 1;
                                this.scenarios
                                    .update(cx, |scenarios, cx| scenarios.stop(cx));
                                cx.notify();
                            }),
                        ),
                    )
                    .child(
                        button("mode-scenarios", "场景实验", self.page == 2).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.page = 2;
                                this.replay.update(cx, |replay, cx| {
                                    replay.streaming = false;
                                    replay.ticker = None;
                                    cx.notify();
                                });
                                cx.notify();
                            },
                        )),
                    )
                    .child(div().text_sm().child("Rust + GPUI · 本地 Agent Runtime")),
            )
            .child(div().flex_1().min_h_0().child(match self.page {
                0 => self.workbench.clone().into_any_element(),
                1 => self.replay.clone().into_any_element(),
                _ => self.scenarios.clone().into_any_element(),
            }))
    }
}

fn main() {
    Application::new().run(|cx: &mut App| {
        input::bind_keys(cx);
        cx.on_window_closed(|cx| {
            if cx.windows().is_empty() {
                cx.quit();
            }
        })
        .detach();
        let bounds = Bounds::centered(None, size(px(1200.), px(900.)), cx);
        let result = cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                ..Default::default()
            },
            |_, cx| {
                let workbench = cx.new(workbench::Workbench::new);
                let replay = cx.new(|cx| {
                    cx.on_app_quit(|this: &mut AgentBox, _| {
                        this.streaming = false;
                        this.ticker = None;
                        async {}
                    })
                    .detach();
                    AgentBox::new()
                });
                let scenarios = cx.new(scenarios::Scenarios::new);
                cx.new(|_| Shell {
                    page: 0,
                    scenarios,
                    workbench,
                    replay,
                })
            },
        );
        if let Err(error) = result {
            eprintln!("Unable to open GPUI window: {error}");
            cx.quit();
            return;
        }
        cx.activate(true);
    });
}
