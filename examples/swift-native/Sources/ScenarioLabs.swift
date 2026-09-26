import SwiftUI
import Foundation

enum HarnessScene: String, CaseIterable, Identifiable {
    case conversation = "长会话流式排版"
    case search = "工作区日志检索"
    case console = "工具控制台追加"
    var id: Self { self }
}

enum ScenarioMode: String, CaseIterable, Identifiable {
    case naive = "朴素"
    case optimized = "优化"
    var id: Self { self }
}

enum ScenarioLoad: String, CaseIterable, Identifiable {
    case light = "轻"
    case regular = "中"
    case heavy = "重"
    var id: Self { self }
    var historyRows: Int { switch self { case .light: 400; case .regular: 1500; case .heavy: 3000 } }
    var searchRows: Int { switch self { case .light: 3000; case .regular: 12000; case .heavy: 24000 } }
    var consoleRows: Int { switch self { case .light: 600; case .regular: 2400; case .heavy: 4800 } }
}

func scenarioNow() -> UInt64 { DispatchTime.now().uptimeNanoseconds }
func scenarioMilliseconds(since start: UInt64) -> Double { Double(scenarioNow() - start) / 1_000_000 }
func scenarioTime(_ value: Double) -> String { String(format: "%.2f ms", value) }

func scenarioFingerprint(_ pieces: [String]) -> String {
    var value: UInt64 = 14695981039346656037
    for piece in pieces {
        for byte in piece.utf8 { value = (value ^ UInt64(byte)) &* 1099511628211 }
        value = (value ^ 0x0a) &* 1099511628211
    }
    return String(format: "%016llx", value)
}

struct ScenarioCompletion {
    let input: String
    let output: String
    let fingerprint: String
    let work: String
    let processing: String
}

struct ScenarioComparison: View {
    let values: [ScenarioMode: ScenarioCompletion]
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("最近完整结果 · 切换/重置保留 · 只比较相同输入与负载").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 18) {
                ForEach(ScenarioMode.allCases) { mode in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(mode.rawValue).font(.caption.weight(.bold))
                        if let result = values[mode] {
                            Text("\(result.input) → \(result.output)").font(.caption2)
                            Text("\(result.work) · \(result.processing)").font(.caption2).foregroundStyle(.secondary)
                            Text("FNV-1a: \(result.fingerprint)").font(.caption2.monospaced()).textSelection(.enabled)
                        } else { Text("尚未完成这一模式").font(.caption2).foregroundStyle(.secondary) }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            if let naive = values[.naive], let optimized = values[.optimized], naive.input == optimized.input {
                Text(naive.fingerprint == optimized.fingerprint ? "已记录的输出指纹一致；这是非密码学摘要，不是形式化等价证明。" : "输出指纹不同：检查输入或实现，不能据此声称同样结果更快。")
                    .font(.caption2).foregroundStyle(naive.fingerprint == optimized.fingerprint ? Color.secondary : .orange)
            }
        }.padding(10).background(Color.primary.opacity(0.025))
    }
}

struct ScenarioMetric: View {
    let title: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.system(size: 13, weight: .semibold, design: .monospaced))
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

@MainActor
final class ScenarioControls: ObservableObject {
    @Published var scene = HarnessScene.conversation
    @Published var mode = ScenarioMode.naive
    @Published var load = ScenarioLoad.regular
    @Published var probe = ""
}

@MainActor
struct HarnessScenarioView: View {
    @StateObject private var conversation = ConversationScenario()
    @StateObject private var search = SearchScenario()
    @StateObject private var console = ConsoleScenario()
    // ObservableObject works with this CLT SDK without requiring its unavailable
    // external SwiftUI @State macro plug-in.
    @StateObject private var controls = ScenarioControls()
    private var scene: HarnessScene { controls.scene }
    private var mode: ScenarioMode { controls.mode }
    private var load: ScenarioLoad { controls.load }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Harness 场景实验").font(.title2.weight(.semibold))
                    Text("同一输入，两条真实实现路径。只用内存数据，不调用模型、麦克风或磁盘工具。")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Picker("实现", selection: $controls.mode) {
                    ForEach(ScenarioMode.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented).frame(width: 155)
            }
            HStack {
                Picker("场景", selection: $controls.scene) {
                    ForEach(HarnessScene.allCases) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented)
                Picker("负载", selection: $controls.load) {
                    ForEach(ScenarioLoad.allCases) { Text($0.rawValue).tag($0) }
                }.frame(width: 105)
                Button("运行 / 重跑") { run() }.buttonStyle(.borderedProminent)
                Button("停止") { stopAll() }
                Button("重置") { resetAll() }
            }
            TextField("响应探针：运行时持续输入；切换模式、停止和重置都保留这里的内容", text: $controls.probe)
                .textFieldStyle(.roundedBorder).accessibilityIdentifier("scenario-probe")
            Group {
                switch scene {
                case .conversation: ConversationScenarioView(model: conversation, mode: mode, load: load)
                case .search: SearchScenarioView(model: search, mode: mode, load: load)
                case .console: ConsoleScenarioView(model: console, mode: mode, load: load)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Text("指标来自本次真实代码路径的计数与同步处理用时，不是 FPS，也不包含完整显示管线。尚未运行时没有性能结论。")
                .font(.caption2).foregroundStyle(.secondary)
        }.padding(22)
            .onChange(of: scene) { _, _ in resetAll() }
            .onChange(of: mode) { _, _ in resetAll() }
            .onChange(of: load) { _, _ in resetAll() }
            .onDisappear { stopAll() }
    }

    private func run() {
        stopAll()
        switch scene {
        case .conversation: conversation.start(mode: mode, load: load)
        case .search: search.start(mode: mode, load: load)
        case .console: console.start(mode: mode, load: load)
        }
    }

    private func stopAll() { conversation.stop(); search.stop(); console.stop() }
    private func resetAll() { conversation.reset(); search.reset(); console.reset() }
}

struct ConversationSource: Sendable {
    let id: Int
    let role: String
    let markdown: String
}

struct FormattedConversationRow: Identifiable {
    let id: Int
    let role: String
    let text: AttributedString
}

@MainActor
final class ActiveConversationText: ObservableObject {
    @Published var text = AttributedString("")
}

@MainActor
final class ConversationScenario: ObservableObject {
    @Published private(set) var history: [FormattedConversationRow] = []
    @Published private(set) var historyRevision = 0
    @Published private(set) var generation = UUID()
    @Published private(set) var status = "点击运行，建立同一份历史与 180 个流式块。"
    @Published private(set) var running = false
    @Published private(set) var receivedChunks = 0
    @Published private(set) var formattedHistoryRows = 0
    @Published private(set) var activePublishes = 0
    @Published private(set) var lastProcessingMS = 0.0
    @Published private(set) var totalProcessingMS = 0.0
    @Published private(set) var completed: [ScenarioMode: ScenarioCompletion] = [:]
    let active = ActiveConversationText()
    private var source: [ConversationSource] = []
    private var activeMarkdown = ""
    private var unpublishedChunks = 0
    private var timer: Timer?
    private var mode = ScenarioMode.naive
    private let totalChunks = 180

    func start(mode: ScenarioMode, load: ScenarioLoad) {
        reset()
        self.mode = mode
        let started = scenarioNow()
        source = (0..<load.historyRows).map { id in
            ConversationSource(id: id, role: id % 4 == 0 ? "TOOL" : "AGENT", markdown:
                "**步骤 \(id)**：读取 `workspace/module-\(id % 31).swift`，检查 **取消边界**、*状态恢复*与工具结果。\n" +
                "会话保留文件位置 `L\(id % 200 + 1)`、已完成的操作和等待确认的变更；下一次模型请求只需要相关上下文。" +
                "\n结果：`status=complete`，保留 **输入 / 输出 / 用量**，不重复派生已经结束的内容。")
        }
        history = formatHistory(source)
        historyRevision += 1
        formattedHistoryRows = source.count
        lastProcessingMS = scenarioMilliseconds(since: started)
        totalProcessingMS = lastProcessingMS
        running = true
        status = "流入中：每 30 ms 一个确定文本块，共 180 块。"
        let run = generation
        let timer = Timer(timeInterval: 0.03, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.generation == run, self.running else { return }
                self.receiveNextChunk()
            }
        }
        self.timer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func receiveNextChunk() {
        let clauses = ["读取 `Agent` 状态；", "保留已完成消息；", "检查 **工具结果**；", "等待用户确认；", "继续当前任务。\n"]
        activeMarkdown += clauses[receivedChunks % clauses.count]
        receivedChunks += 1
        unpublishedChunks += 1
        switch mode {
        case .naive: reformatAllHistoryAndActive()
        case .optimized:
            // A real batching policy: at most six input chunks per publication.
            // It reduces publishes by accepting coarser intermediate updates.
            if unpublishedChunks >= 6 { publishOnlyActive() }
        }
        if receivedChunks == totalChunks {
            stop()
            let renderedActive = String(active.text.characters)
            completed[mode] = ScenarioCompletion(input: "\(source.count) 历史行 + 180 块",
                output: "正文 \(renderedActive.utf16.count) UTF-16",
                fingerprint: scenarioFingerprint(history.map { String($0.text.characters) } + [renderedActive]),
                work: "历史解析 \(formattedHistoryRows) 行 / 正文发布 \(activePublishes) 次",
                processing: "累计处理 \(scenarioTime(totalProcessingMS))")
            status = "完成：已记录实际格式化输出摘要，切换模式后可对照。"
        }
    }

    private func reformatAllHistoryAndActive() {
        let started = scenarioNow()
        history = formatHistory(source)
        historyRevision += 1
        formattedHistoryRows += source.count
        active.text = formatMarkdown(activeMarkdown)
        unpublishedChunks = 0
        activePublishes += 1
        recordProcessing(since: started)
    }

    private func publishOnlyActive() {
        guard unpublishedChunks > 0 else { return }
        let started = scenarioNow()
        active.text = formatMarkdown(activeMarkdown)
        unpublishedChunks = 0
        activePublishes += 1
        recordProcessing(since: started)
    }

    private func formatHistory(_ source: [ConversationSource]) -> [FormattedConversationRow] {
        source.map { FormattedConversationRow(id: $0.id, role: $0.role, text: formatMarkdown($0.markdown)) }
    }

    private func formatMarkdown(_ source: String) -> AttributedString {
        (try? AttributedString(markdown: source, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(source)
    }

    private func recordProcessing(since started: UInt64) {
        lastProcessingMS = scenarioMilliseconds(since: started)
        totalProcessingMS += lastProcessingMS
    }

    func stop() {
        timer?.invalidate(); timer = nil
        if mode == .optimized { publishOnlyActive() }
        if running { status = "已停止；保留实际收到的 \(receivedChunks) 个块，并发布最后一批。" }
        running = false
    }

    func reset() {
        timer?.invalidate(); timer = nil
        generation = UUID(); running = false
        source = []; history = []; historyRevision += 1
        activeMarkdown = ""; active.text = AttributedString(""); unpublishedChunks = 0
        receivedChunks = 0; formattedHistoryRows = 0; activePublishes = 0
        lastProcessingMS = 0; totalProcessingMS = 0
        status = "点击运行，建立同一份历史与 180 个流式块。"
    }
}

// The immutable cache revision gives SwiftUI an explicit boundary. Per-chunk
// counters can change without recomputing this history subtree in optimized mode.
struct CachedConversationHistory: View, Equatable {
    let generation: UUID
    let revision: Int
    let rows: [FormattedConversationRow]
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.generation == rhs.generation && lhs.revision == rhs.revision }
    var body: some View {
        List(rows) { row in
            HStack(alignment: .top, spacing: 10) {
                Text("\(row.role) \(row.id)").font(.caption2.monospaced()).foregroundStyle(.secondary).frame(width: 78, alignment: .leading)
                Text(row.text).font(.system(size: 12)).textSelection(.enabled).padding(.vertical, 4)
            }
        }.listStyle(.plain)
    }
}

struct ActiveConversationPanel: View {
    @ObservedObject var model: ActiveConversationText
    var body: some View {
        ScrollView { Text(model.text).font(.system(size: 13)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading).padding(10) }
            .frame(minHeight: 90, maxHeight: 140).background(Color.accentColor.opacity(0.055))
    }
}

struct ConversationScenarioView: View {
    @ObservedObject var model: ConversationScenario
    let mode: ScenarioMode
    let load: ScenarioLoad
    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("Harness 情境：模型继续输出时，用户仍在阅读旧工具结果并编辑下一条指令。").font(.headline)
            Text(mode == .naive
                 ? "朴素路径：每个流式块都重新解析全部 \(load.historyRows) 条 Markdown 历史，再发布当前消息。运行时滚动历史，并在上方探针持续打字。"
                 : "优化路径：历史仅解析一次，以稳定 revision 隔离；当前消息单独观察，每 6 个块合并一次发布（名义上最多约 180 ms）。停止时补齐尾批。")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                ScenarioMetric(title: "收到的块", value: "\(model.receivedChunks) / 180")
                ScenarioMetric(title: "累计解析历史行", value: "\(model.formattedHistoryRows)")
                ScenarioMetric(title: "当前消息发布次数", value: "\(model.activePublishes)")
                ScenarioMetric(title: "最近处理 / 累计", value: "\(scenarioTime(model.lastProcessingMS)) / \(scenarioTime(model.totalProcessingMS))")
            }.padding(10).background(Color.primary.opacity(0.035))
            CachedConversationHistory(generation: model.generation, revision: model.historyRevision, rows: model.history)
                .equatable().border(Color.primary.opacity(0.12))
            Text("当前 assistant 消息").font(.caption.weight(.semibold))
            ActiveConversationPanel(model: model.active)
            Text(model.status).font(.caption).foregroundStyle(.secondary)
            Text("取舍：缓存需要明确失效规则；批量发布会降低中间文字更新频率。相同最终文本不代表逐块出现时间相同。")
                .font(.caption2).foregroundStyle(.secondary)
            ScenarioComparison(values: model.completed)
        }
    }
}
