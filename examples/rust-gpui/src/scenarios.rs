use crate::{button, input::TextInput, model, resources};
use gpui::{Context, Entity, Task, Window, div, prelude::*, px, rgb, uniform_list};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    ops::Range,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    time::{Duration, Instant},
};

#[derive(Clone, Copy, PartialEq)]
enum Scene {
    Rows,
    Stream,
    Artifact,
}

#[derive(Clone, Deserialize, Serialize)]
struct Record {
    id: usize,
    tool: String,
    path: String,
    text: String,
}

fn input_records(count: usize) -> Result<Arc<Vec<String>>, String> {
    let path = resources().join("fixtures/events.json");
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > 1024 * 1024 || count > 10_000 {
        return Err("场景输入限制：fixture ≤1 MiB，文档 ≤10,000 条".into());
    }
    let fixture = model::read_fixture(&path)?;
    (0..count)
        .map(|index| {
            let source = &fixture[index % fixture.len()];
            serde_json::to_string(&Record {
                id: index + 1,
                tool: if source.is_tool() {
                    "read_file"
                } else {
                    "assistant"
                }
                .into(),
                path: format!("src/modules/module-{:05}.rs", index),
                text: source.text.chars().take(512).collect(),
            })
            .map_err(|error| error.to_string())
        })
        .collect::<Result<Vec<_>, _>>()
        .map(Arc::new)
}

fn prepare_history(raw: &[String]) -> Result<Vec<String>, String> {
    raw.iter()
        .map(|line| {
            let record: Record = serde_json::from_str(line).map_err(|error| error.to_string())?;
            Ok(format!(
                "{:05}  {}  {}  {}",
                record.id, record.tool, record.path, record.text
            ))
        })
        .collect()
}

fn fingerprint<'a>(parts: impl IntoIterator<Item = &'a str>) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for part in parts {
        for byte in part.bytes().chain(std::iter::once(0)) {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    }
    format!("{hash:016x}")
}

fn row(text: String) -> impl IntoElement {
    div()
        .h(px(30.))
        .px_2()
        .flex()
        .items_center()
        .border_b_1()
        .border_color(rgb(0x283743))
        .child(div().truncate().text_sm().child(text))
}

struct HistoryView {
    rows: Arc<Vec<String>>,
}
impl Render for HistoryView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        uniform_list(
            "prepared-history",
            self.rows.len(),
            cx.processor(|this, range: Range<usize>, _, _| {
                range
                    .filter_map(|index| this.rows.get(index))
                    .map(|text| row(text.clone()))
                    .collect::<Vec<_>>()
            }),
        )
        .size_full()
    }
}

struct ActiveStream {
    text: String,
    chunks: usize,
    total: usize,
    parsed: usize,
    prepare_ms: f64,
    global_updates: usize,
    active_updates: usize,
    message: String,
}
impl ActiveStream {
    fn empty() -> Self {
        Self {
            text: String::new(),
            chunks: 0,
            total: 0,
            parsed: 0,
            prepare_ms: 0.,
            global_updates: 0,
            active_updates: 0,
            message: "未开始".into(),
        }
    }
}
impl Render for ActiveStream {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .gap_1()
            .p_2()
            .bg(rgb(0x1b2d39))
            .child(div().text_xs().child(format!(
                "{} · 片段 {}/{} · 实际 JSON 解析 {} 条 · 解析/格式化累计 {:.2} ms",
                self.message, self.chunks, self.total, self.parsed, self.prepare_ms
            )))
            .child(div().text_xs().child(format!(
                "片段处理中主动 notify：父级 {} / 活跃 Entity {}（不是帧数）",
                self.global_updates, self.active_updates
            )))
            .child(
                div()
                    .id("active-text")
                    .h(px(90.))
                    .overflow_y_scroll()
                    .text_sm()
                    .child(self.text.clone()),
            )
    }
}

struct IndexSummary {
    documents: usize,
    bytes: usize,
    occurrences: usize,
    entries: Vec<(String, usize)>,
    fingerprint: String,
}

struct CompletedRun {
    scene: Scene,
    optimized: bool,
    count: usize,
    input: String,
    output: String,
}
struct IndexOutcome {
    result: Result<IndexSummary, String>,
    processed: usize,
    milliseconds: f64,
    cancelled: bool,
}

fn build_artifact_index(
    raw: &[String],
    cancel: &AtomicBool,
    progress: &AtomicUsize,
) -> IndexOutcome {
    let started = Instant::now();
    let mut terms = BTreeMap::<String, usize>::new();
    let mut processed = 0;
    let mut bytes = 0;
    let mut occurrences = 0;
    let result = (|| {
        for line in raw {
            if cancel.load(Ordering::Relaxed) {
                return Err("已在文档边界取消".to_string());
            }
            let record: Record = serde_json::from_str(line).map_err(|error| error.to_string())?;
            bytes += line.len();
            for source in [&record.path, &record.tool, &record.text] {
                for word in source
                    .split(|character: char| !character.is_alphanumeric() && character != '_')
                    .filter(|word| !word.is_empty())
                {
                    *terms.entry(word.to_lowercase()).or_default() += 1;
                    occurrences += 1;
                }
            }
            processed += 1;
            progress.store(processed, Ordering::Relaxed);
        }
        let entries: Vec<_> = terms.into_iter().collect();
        let encoded: Vec<String> = entries
            .iter()
            .map(|(term, count)| format!("{term}:{count}"))
            .collect();
        let metadata = format!("documents:{processed};bytes:{bytes};occurrences:{occurrences}");
        let hash = fingerprint(
            std::iter::once(metadata.as_str()).chain(encoded.iter().map(String::as_str)),
        );
        Ok(IndexSummary {
            documents: processed,
            bytes,
            occurrences,
            entries,
            fingerprint: hash,
        })
    })();
    IndexOutcome {
        result,
        processed,
        milliseconds: started.elapsed().as_secs_f64() * 1000.,
        cancelled: cancel.load(Ordering::Relaxed),
    }
}

pub struct Scenarios {
    scene: Scene,
    optimized: bool,
    count: usize,
    probe: Entity<TextInput>,
    raw: Arc<Vec<String>>,
    rows: Arc<Vec<String>>,
    history: Entity<HistoryView>,
    active: Entity<ActiveStream>,
    input_ms: f64,
    input_hash: String,
    output_hash: String,
    notice: String,
    row_range: Range<usize>,
    constructed: usize,
    construction_ms: f64,
    stream_task: Option<Task<()>>,
    stream_running: bool,
    generation: u64,
    job_inflight: bool,
    job_cancel: Arc<AtomicBool>,
    job_progress: Arc<AtomicUsize>,
    job_task: Option<Task<()>>,
    progress_task: Option<Task<()>>,
    displayed_progress: usize,
    discarded: usize,
    job_ms: f64,
    index: Option<IndexSummary>,
    completed: Vec<CompletedRun>,
}

impl Scenarios {
    pub fn new(cx: &mut Context<Self>) -> Self {
        cx.on_app_quit(|this: &mut Self, _| {
            this.job_cancel.store(true, Ordering::Relaxed);
            this.stream_task = None;
            async {}
        })
        .detach();
        Self {
            scene: Scene::Rows,
            optimized: false,
            count: 1000,
            probe: cx.new(|cx| {
                TextInput::new(
                    "负载中在此打字、选字、粘贴；保留同一个 GPUI 输入 Entity",
                    false,
                    cx,
                )
            }),
            raw: Arc::new(Vec::new()),
            rows: Arc::new(Vec::new()),
            history: cx.new(|_| HistoryView {
                rows: Arc::new(Vec::new()),
            }),
            active: cx.new(|_| ActiveStream::empty()),
            input_ms: 0.,
            input_hash: String::new(),
            output_hash: String::new(),
            notice: "选择一个场景、模式和输入规模，再开始。无需 API Key 或模型。".into(),
            row_range: 0..0,
            constructed: 0,
            construction_ms: 0.,
            stream_task: None,
            stream_running: false,
            generation: 0,
            job_inflight: false,
            job_cancel: Arc::new(AtomicBool::new(false)),
            job_progress: Arc::new(AtomicUsize::new(0)),
            job_task: None,
            progress_task: None,
            displayed_progress: 0,
            discarded: 0,
            job_ms: 0.,
            index: None,
            completed: Vec::new(),
        }
    }

    pub fn stop(&mut self, cx: &mut Context<Self>) {
        let was_streaming = self.stream_running;
        self.generation += 1;
        self.stream_task = None;
        self.stream_running = false;
        self.job_cancel.store(true, Ordering::Relaxed);
        if was_streaming {
            self.active.update(cx, |active, cx| {
                active.message = "已停止（保留部分文本，不算完整结果）".into();
                cx.notify();
            });
        }
        self.notice = if self.job_inflight {
            "已请求协作取消；等待当前文档结束。过期结果不会覆盖新页面。".into()
        } else {
            "已停止持续工作，当前输出保留；静态列表没有后台任务。".into()
        };
        cx.notify();
    }

    fn reset(&mut self, cx: &mut Context<Self>) {
        self.stop(cx);
        self.raw = Arc::new(Vec::new());
        self.rows = Arc::new(Vec::new());
        self.history.update(cx, |history, cx| {
            history.rows = Arc::new(Vec::new());
            cx.notify();
        });
        self.active.update(cx, |active, cx| {
            *active = ActiveStream::empty();
            cx.notify();
        });
        self.index = None;
        self.input_hash.clear();
        self.output_hash.clear();
        self.constructed = 0;
        self.row_range = 0..0;
        self.construction_ms = 0.;
        self.input_ms = 0.;
        self.job_ms = 0.;
        self.displayed_progress = 0;
        self.notice = if self.job_inflight {
            "页面已重置；旧 generation 正在退出，完成后可再次开始。".into()
        } else {
            "已重置，输入探针保留。".into()
        };
        cx.notify();
    }

    fn change_scene(&mut self, scene: Scene, cx: &mut Context<Self>) {
        self.reset(cx);
        self.scene = scene;
        cx.notify();
    }
    fn change_mode(&mut self, optimized: bool, cx: &mut Context<Self>) {
        self.reset(cx);
        self.optimized = optimized;
        cx.notify();
    }
    fn change_count(&mut self, count: usize, cx: &mut Context<Self>) {
        self.reset(cx);
        self.count = count;
        cx.notify();
    }

    fn record_completion(&mut self) {
        self.completed.retain(|run| {
            !(run.scene == self.scene && run.optimized == self.optimized && run.count == self.count)
        });
        self.completed.push(CompletedRun {
            scene: self.scene,
            optimized: self.optimized,
            count: self.count,
            input: self.input_hash.clone(),
            output: self.output_hash.clone(),
        });
    }

    fn comparison(&self) -> String {
        let naive = self
            .completed
            .iter()
            .find(|run| run.scene == self.scene && !run.optimized && run.count == self.count);
        let optimized = self
            .completed
            .iter()
            .find(|run| run.scene == self.scene && run.optimized && run.count == self.count);
        match (naive, optimized) {
            (Some(a), Some(b)) if a.input != b.input => {
                "最近完整运行的输入指纹不同，不比较结果。".into()
            }
            (Some(a), Some(b)) => format!(
                "最近完整运行：朴素 {} / 优化 {} → {}（非密码学指纹，不是完整正确性证明）",
                a.output,
                b.output,
                if a.output == b.output {
                    "结果指纹一致"
                } else {
                    "结果指纹不同，需要检查实现"
                }
            ),
            _ => "完整结果对照：请分别运行同一规模的朴素与优化模式；停止的部分结果不参与对照。"
                .into(),
        }
    }

    fn run(&mut self, cx: &mut Context<Self>) {
        if self.job_inflight {
            self.notice = "仍有一个后台作业退出中；结果槽只有一个，不再堆积新作业。".into();
            cx.notify();
            return;
        }
        self.reset(cx);
        let started = Instant::now();
        let raw = match input_records(self.count) {
            Ok(raw) => raw,
            Err(error) => {
                self.notice = error;
                cx.notify();
                return;
            }
        };
        self.input_hash = fingerprint(raw.iter().map(String::as_str));
        self.input_ms = started.elapsed().as_secs_f64() * 1000.;
        self.raw = raw;
        self.generation += 1;
        match self.scene {
            Scene::Rows => match prepare_history(&self.raw) {
                Ok(rows) => {
                    self.output_hash = fingerprint(rows.iter().map(String::as_str));
                    self.record_completion();
                    self.rows = Arc::new(rows);
                    self.notice = "已加载。滚动列表，观察实际元素构建范围；可点“刷新统计”读取最新一次构建快照。".into();
                }
                Err(error) => self.notice = error,
            },
            Scene::Stream => self.run_stream(cx),
            Scene::Artifact => self.run_artifact(cx),
        }
        cx.notify();
    }

    fn run_stream(&mut self, cx: &mut Context<Self>) {
        let started = Instant::now();
        let prepared = match prepare_history(&self.raw) {
            Ok(rows) => Arc::new(rows),
            Err(error) => {
                self.notice = error;
                return;
            }
        };
        let prepare_ms = started.elapsed().as_secs_f64() * 1000.;
        self.rows = prepared.clone();
        self.history.update(cx, |history, cx| {
            history.rows = prepared;
            cx.notify();
        });
        let total = if self.count <= 1000 { 128 } else { 512 };
        let final_text = (0..total)
            .map(|index| format!("步骤 {}：已收集工具输出，继续形成摘要。\n", index + 1))
            .collect::<String>();
        let chunks: Vec<String> = final_text
            .split_inclusive('\n')
            .map(str::to_owned)
            .collect();
        let optimized = self.optimized;
        let generation = self.generation;
        self.active.update(cx, |active, cx| {
            *active = ActiveStream::empty();
            active.total = chunks.len();
            active.parsed = self.count;
            active.prepare_ms = prepare_ms;
            active.message = if optimized {
                "缓存历史 / 仅活跃 Entity 更新"
            } else {
                "每个片段重新解析全部历史"
            }
            .into();
            cx.notify();
        });
        self.stream_running = true;
        self.notice = "固定片段按相同顺序消费，片段间基础间隔16ms；处理成本会推迟下一次消费。没有无限生产队列，完成后比较指纹。".into();
        self.stream_task = Some(cx.spawn(async move |this, cx| {
            for fragment in chunks {
                cx.background_executor()
                    .timer(Duration::from_millis(16))
                    .await;
                let should_continue = this.update(cx, |this, cx| {
                    if generation != this.generation || !this.stream_running {
                        return false;
                    }
                    let mut parse_ms = 0.;
                    let mut parsed = 0;
                    if !optimized {
                        let started = Instant::now();
                        match prepare_history(&this.raw) {
                            Ok(rows) => {
                                parse_ms = started.elapsed().as_secs_f64() * 1000.;
                                parsed = rows.len();
                                this.rows = Arc::new(rows);
                                this.history.update(cx, |history, cx| {
                                    history.rows = this.rows.clone();
                                    cx.notify();
                                });
                            }
                            Err(error) => {
                                this.notice = error;
                                this.stream_running = false;
                                cx.notify();
                                return false;
                            }
                        }
                    }
                    this.active.update(cx, |active, cx| {
                        active.text.push_str(&fragment);
                        active.chunks += 1;
                        active.parsed += parsed;
                        active.prepare_ms += parse_ms;
                        active.active_updates += 1;
                        if !optimized {
                            active.global_updates += 1;
                        }
                        cx.notify();
                    });
                    if !optimized {
                        cx.notify();
                    }
                    true
                });
                if !matches!(should_continue, Ok(true)) {
                    return;
                }
            }
            let _ = this.update(cx, |this, cx| {
                if generation != this.generation {
                    return;
                }
                this.stream_running = false;
                let text = this.active.read(cx).text.clone();
                this.output_hash = fingerprint(
                    this.rows
                        .iter()
                        .map(String::as_str)
                        .chain(std::iter::once(text.as_str())),
                );
                this.record_completion();
                this.active.update(cx, |active, cx| {
                    active.message = "完整输入已消费".into();
                    cx.notify();
                });
                this.notice =
                    "片段回放完成；相同规模与 fixture 下，两模式的输出指纹应相同。".into();
                cx.notify();
            });
        }));
    }

    fn run_artifact(&mut self, cx: &mut Context<Self>) {
        self.job_cancel = Arc::new(AtomicBool::new(false));
        self.job_progress = Arc::new(AtomicUsize::new(0));
        self.index = None;
        if !self.optimized {
            let outcome = build_artifact_index(&self.raw, &self.job_cancel, &self.job_progress);
            let success = outcome.result.is_ok();
            self.accept_index(outcome);
            if success {
                self.notice =
                    "主线程索引已结束。在同步函数返回之前，输入与停止事件无法在该线程处理。".into();
            }
            return;
        }
        self.job_inflight = true;
        self.notice = "后台索引进行中；最多一个作业和一个返回结果。可输入、停止或重置。".into();
        let generation = self.generation;
        let raw = self.raw.clone();
        let cancel = self.job_cancel.clone();
        let progress = self.job_progress.clone();
        let job = cx
            .background_executor()
            .spawn(async move { build_artifact_index(&raw, &cancel, &progress) });
        self.job_task = Some(cx.spawn(async move |this, cx| {
            let outcome = job.await;
            let _ = this.update(cx, |this, cx| {
                this.job_inflight = false;
                this.progress_task = None;
                if generation != this.generation {
                    this.discarded += 1;
                    this.notice = format!("旧 generation {} 已退出：处理 {} 条 / {:.2} ms / 协作取消 {}；已拒绝其结果。可再次开始。", generation, outcome.processed, outcome.milliseconds, outcome.cancelled);
                } else {
                    let success = outcome.result.is_ok();
                    this.accept_index(outcome);
                    if success { this.notice = "后台索引完成，结果已在 GPUI 上下文中提交。".into(); }
                }
                cx.notify();
            });
        }));
        self.progress_task = Some(cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor()
                    .timer(Duration::from_millis(40))
                    .await;
                let active = this.update(cx, |this, cx| {
                    if !this.job_inflight {
                        return false;
                    }
                    let progress = this.job_progress.load(Ordering::Relaxed);
                    if progress != this.displayed_progress {
                        this.displayed_progress = progress;
                        cx.notify();
                    }
                    true
                });
                if !matches!(active, Ok(true)) {
                    return;
                }
            }
        }));
    }

    fn accept_index(&mut self, outcome: IndexOutcome) {
        self.job_ms = outcome.milliseconds;
        self.displayed_progress = outcome.processed;
        match outcome.result {
            Ok(index) => {
                self.output_hash = index.fingerprint.clone();
                self.index = Some(index);
                self.record_completion();
            }
            Err(error) => self.notice = error,
        }
    }

    fn render_rows(&mut self, cx: &mut Context<Self>) -> gpui::AnyElement {
        if self.optimized {
            uniform_list(
                "scenario-windowed-rows",
                self.rows.len(),
                cx.processor(|this, range: Range<usize>, _, _| {
                    let started = Instant::now();
                    let elements = range
                        .clone()
                        .filter_map(|index| this.rows.get(index))
                        .map(|text| row(text.clone()))
                        .collect::<Vec<_>>();
                    this.row_range = range;
                    this.constructed = elements.len();
                    this.construction_ms = started.elapsed().as_secs_f64() * 1000.;
                    // GPUI can request a measurement row before the viewport range. Notifying here
                    // would turn instrumentation into a render loop; the refresh control reads the snapshot.
                    elements
                }),
            )
            .size_full()
            .into_any_element()
        } else {
            let started = Instant::now();
            let elements = self
                .rows
                .iter()
                .map(|text| row(text.clone()))
                .collect::<Vec<_>>();
            self.constructed = elements.len();
            self.row_range = 0..self.rows.len();
            self.construction_ms = started.elapsed().as_secs_f64() * 1000.;
            div()
                .id("scenario-eager-rows")
                .size_full()
                .overflow_y_scroll()
                .children(elements)
                .into_any_element()
        }
    }

    fn explanation(&self) -> (&'static str, &'static str) {
        match self.scene {
            Scene::Rows => (
                "工具日志：全量元素 vs 可见范围",
                "朴素模式为每条日志创建 GPUI 元素；优化模式由 uniform_list 请求范围。数据、格式、行高相同。收益在元素/布局工作集；代价是固定行高和滚动状态管理。",
            ),
            Scene::Stream => (
                "文本片段：整段重建 vs 缓存与 Entity 隔离",
                "朴素模式每次追加都从原始 JSON 重建全部历史并通知父级；优化模式缓存历史，只通知活跃输出 Entity。相同文本、片段顺序与16ms基础间隔。成本是明确区分不可变历史与活跃状态。",
            ),
            Scene::Artifact => (
                "工具产物：主线程索引 vs 后台归属",
                "两个模式运行同一个 JSON 解析/词频索引函数。主线程模式阻塞 UI；后台模式经 background_executor 返回结果，有协作取消与 generation 拒绝过期提交。后台不保证总耗时更短。",
            ),
        }
    }
}

impl Render for Scenarios {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let content =
            match self.scene {
                Scene::Rows => self.render_rows(cx),
                Scene::Stream => div()
                    .flex()
                    .flex_col()
                    .size_full()
                    .gap_2()
                    .child(div().flex_1().min_h_0().child(self.history.clone()))
                    .child(self.active.clone())
                    .into_any_element(),
                Scene::Artifact => {
                    let summary = self
                        .index
                        .as_ref()
                        .map(|index| {
                            format!(
                                "完整结果：{} 文档 / {} 输入字节 / {} 词出现次数 / {} 不同词",
                                index.documents,
                                index.bytes,
                                index.occurrences,
                                index.entries.len()
                            )
                        })
                        .unwrap_or_else(|| "尚无完整索引结果".into());
                    let entries = self
                        .index
                        .as_ref()
                        .map(|index| {
                            index
                                .entries
                                .iter()
                                .take(60)
                                .map(|(word, count)| format!("{word} → {count}"))
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    div()
                        .id("index-results")
                        .size_full()
                        .overflow_y_scroll()
                        .child(summary)
                        .child(div().text_xs().child(
                            "下面展示按词排序的前60项；输出指纹覆盖完整索引，未在UI丢弃结果。",
                        ))
                        .children(
                            entries
                                .into_iter()
                                .map(|entry| div().text_sm().child(entry)),
                        )
                        .into_any_element()
                }
            };
        let (title, explanation) = self.explanation();
        div().flex().flex_col().size_full().p_3().gap_2().bg(rgb(0x111a22)).text_color(rgb(0xe4ebee))
            .child(div().flex().gap_2()
                .child(button("scene-rows", "① 工具长日志", self.scene==Scene::Rows).on_click(cx.listener(|this,_,_,cx| this.change_scene(Scene::Rows,cx))))
                .child(button("scene-stream", "② 活跃文本流", self.scene==Scene::Stream).on_click(cx.listener(|this,_,_,cx| this.change_scene(Scene::Stream,cx))))
                .child(button("scene-artifact", "③ 产物索引", self.scene==Scene::Artifact).on_click(cx.listener(|this,_,_,cx| this.change_scene(Scene::Artifact,cx)))))
            .child(div().text_lg().child(title)).child(div().text_sm().child(explanation))
            .child(div().flex().gap_2()
                .child(button("mode-naive", "朴素", !self.optimized).on_click(cx.listener(|this,_,_,cx| this.change_mode(false,cx))))
                .child(button("mode-optimized", "优化", self.optimized).on_click(cx.listener(|this,_,_,cx| this.change_mode(true,cx))))
                .child(button("preset-small", "1,000条", self.count==1000).on_click(cx.listener(|this,_,_,cx| this.change_count(1000,cx))))
                .child(button("preset-medium", "5,000条", self.count==5000).on_click(cx.listener(|this,_,_,cx| this.change_count(5000,cx))))
                .child(button("preset-large", "10,000条", self.count==10000).on_click(cx.listener(|this,_,_,cx| this.change_count(10000,cx))))
                .child(button("scenario-run", "开始", self.stream_running||self.job_inflight).on_click(cx.listener(|this,_,_,cx| this.run(cx))))
                .child(button("scenario-stop", "停止", false).on_click(cx.listener(|this,_,_,cx| this.stop(cx))))
                .child(button("scenario-reset", "重置", false).on_click(cx.listener(|this,_,_,cx| this.reset(cx)))))
            .child(self.probe.clone())
            .child(div().text_xs().text_color(rgb(0x9ab3c4)).child("输入探针不自动记录延迟。自行感受输入、选字和选择；没有FPS、卡顿或跨框架胜负结论。"))
            .child(div().text_sm().child(self.notice.clone()))
            .child(div().text_xs().child(format!("输入准备 {:.2} ms · 输入指纹 {} · 完整结果指纹 {}", self.input_ms, if self.input_hash.is_empty(){"—"}else{&self.input_hash}, if self.output_hash.is_empty(){"—"}else{&self.output_hash})))
            .child(div().text_xs().text_color(rgb(0x88cdb8)).child(self.comparison()))
            .when(self.scene==Scene::Rows, |view| view.child(div().flex().gap_2()
                .child(div().text_xs().child(format!("最近构建 {} 个行元素 / 数据 {} 条 · 请求范围 {:?} · 仅元素创建 {:.3} ms",self.constructed,self.rows.len(),self.row_range,self.construction_ms)))
                .child(button("refresh-metrics", "刷新统计", false).on_click(cx.listener(|_,_,_,cx| cx.notify())))))
            .when(self.scene==Scene::Artifact, |view| view.child(div().text_xs().child(format!("generation {} · 在途作业 {}/1 · 单个返回结果 · 已处理 {} · 索引工作 {:.2} ms · 过期结果拒绝 {} 次",self.generation,usize::from(self.job_inflight),self.displayed_progress,self.job_ms,self.discarded))))
            .child(div().flex_1().min_h(px(140.)).border_1().border_color(rgb(0x30404d)).rounded_md().overflow_hidden().child(content))
            .child(div().text_xs().child("维护取舍：GPUI 输入/焦点需自己维护；共享原生桥仍独立存在。本页计时是代码区间耗时，不是屏幕呈现时间。源码与下一步见路线 README 的“场景实验”。"))
    }
}
