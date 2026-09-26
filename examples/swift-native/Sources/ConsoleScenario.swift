import AppKit
import SwiftUI
import Foundation

@MainActor
final class ConsoleFeed: ObservableObject {
    @Published private(set) var revision = 0
    private(set) var generation = UUID()
    private(set) var baseline = ""
    private(set) var chunks: [String] = []
    private(set) var mode = ScenarioMode.naive

    func begin(baseline: String, mode: ScenarioMode) {
        generation = UUID(); self.baseline = baseline; chunks = []; self.mode = mode
        revision += 1
    }

    func append(_ chunk: String) { chunks.append(chunk); revision += 1 }
}

struct ConsoleMutationReport {
    let generation: UUID
    let writes: Int
    let insertedUTF16: Int
    let documentUTF16: Int
    let milliseconds: Double
    let fingerprint: String?
}

@MainActor
final class ConsoleScenario: ObservableObject {
    let feed = ConsoleFeed()
    @Published private(set) var status = "点击运行载入旧输出，再追加 160 批，每批 4 行。"
    @Published private(set) var running = false
    @Published private(set) var receivedBatches = 0
    @Published private(set) var mutations = 0
    @Published private(set) var insertedUTF16 = 0
    @Published private(set) var displayedUTF16 = 0
    @Published private(set) var lastMutationMS = 0.0
    @Published private(set) var totalMutationMS = 0.0
    @Published private(set) var preparationMS = 0.0
    @Published private(set) var completed: [ScenarioMode: ScenarioCompletion] = [:]
    private var timer: Timer?
    private var nextLine = 0
    private var baselineRows = 0

    func start(mode: ScenarioMode, load: ScenarioLoad) {
        reset()
        let started = scenarioNow()
        let baseline = (0..<load.consoleRows).map(Self.line).joined()
        nextLine = load.consoleRows
        baselineRows = load.consoleRows
        feed.begin(baseline: baseline, mode: mode)
        preparationMS = scenarioMilliseconds(since: started)
        running = true
        status = "输出中：每 25 ms 追加一批；可以向上滚动并选中旧文本。"
        let run = feed.generation
        let timer = Timer(timeInterval: 0.025, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.running, self.feed.generation == run else { return }
                let chunk = (self.nextLine..<(self.nextLine + 4)).map(Self.line).joined()
                self.nextLine += 4
                self.feed.append(chunk)
                self.receivedBatches += 1
                if self.receivedBatches == 160 { self.stop(); self.status = "输入已完成：保留全部旧行与 640 条新增行；视图应用待处理批次后，指标更新。" }
            }
        }
        self.timer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private static func line(_ id: Int) -> String {
        let operations = ["read_file", "search_text", "write_note", "collect_usage"]
        return String(format: "%06d", id) + "  tool=\(operations[id % operations.count]) session=\(id % 37) " +
               "status=complete path=workspace/module-\(id % 53).swift " +
               "output=保留这一行原始工具输出，允许用户选择复制，并继续查看较早的记录。\n"
    }

    func record(_ report: ConsoleMutationReport) {
        guard report.generation == feed.generation, !feed.baseline.isEmpty else { return }
        mutations += report.writes
        insertedUTF16 += report.insertedUTF16
        displayedUTF16 = report.documentUTF16
        lastMutationMS = report.milliseconds
        totalMutationMS += report.milliseconds
        if receivedBatches == 160, let fingerprint = report.fingerprint {
            completed[feed.mode] = ScenarioCompletion(input: "\(baselineRows) 旧行 + 640 新行",
                output: "\(report.documentUTF16) UTF-16",
                fingerprint: fingerprint,
                work: "累计写入 \(insertedUTF16) UTF-16 / \(mutations) 次",
                processing: "累计存储处理 \(scenarioTime(totalMutationMS))")
        }
    }

    func stop() {
        timer?.invalidate(); timer = nil
        if running { status = "已停止，保留全部 \(receivedBatches) 批已接收输出；未通过丢弃旧行换取速度。" }
        running = false
    }

    func reset() {
        timer?.invalidate(); timer = nil
        running = false; receivedBatches = 0; nextLine = 0; baselineRows = 0
        mutations = 0; insertedUTF16 = 0; displayedUTF16 = 0
        lastMutationMS = 0; totalMutationMS = 0; preparationMS = 0
        feed.begin(baseline: "", mode: .naive)
        status = "点击运行载入旧输出，再追加 160 批，每批 4 行。"
    }
}

// Both paths use the same NSTextView, attributes and selection/scroll policy.
// Their actual NSTextStorage mutations differ: full replacement vs append-only.
struct IncrementalConsoleText: NSViewRepresentable {
    let feed: ConsoleFeed
    let revision: Int
    let report: @MainActor (ConsoleMutationReport) -> Void

    final class Coordinator {
        var generation: UUID?
        var appliedChunks = 0
        var revision = -1
        var active = true
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.borderType = .bezelBorder
        let text = NSTextView(usingTextLayoutManager: false)
        text.isEditable = false; text.isSelectable = true
        text.isRichText = false; text.allowsUndo = false
        text.font = .monospacedSystemFont(ofSize: 11.5, weight: .regular)
        text.textColor = .labelColor; text.backgroundColor = .textBackgroundColor
        text.isVerticallyResizable = true; text.isHorizontallyResizable = false
        text.minSize = NSSize(width: 0, height: 0)
        text.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        text.autoresizingMask = [.width]
        text.textContainerInset = NSSize(width: 10, height: 10)
        text.textContainer?.widthTracksTextView = true
        text.textContainer?.containerSize = NSSize(width: scroll.contentSize.width, height: CGFloat.greatestFiniteMagnitude)
        text.layoutManager?.allowsNonContiguousLayout = true
        scroll.documentView = text
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        let coordinator = context.coordinator
        guard coordinator.active, coordinator.revision != revision,
              let text = scroll.documentView as? NSTextView, let storage = text.textStorage else { return }
        let started = scenarioNow()
        let isNewRun = coordinator.generation != feed.generation
        let oldOrigin = scroll.contentView.bounds.origin
        let oldSelection = text.selectedRanges
        let wasAtBottom = oldOrigin.y + scroll.contentView.bounds.height >= text.bounds.height - 24
        let hadSelection = oldSelection.contains { $0.rangeValue.length > 0 }
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: 11.5, weight: .regular),
            .foregroundColor: NSColor.labelColor
        ]
        var written = 0
        var writes = 0
        storage.beginEditing()
        if isNewRun {
            // Initial load is identical for both modes, including all retained data.
            let initial = feed.baseline + feed.chunks.joined()
            storage.setAttributedString(NSAttributedString(string: initial, attributes: attributes))
            written = initial.utf16.count; writes = initial.isEmpty ? 0 : 1
        } else if coordinator.appliedChunks < feed.chunks.count {
            switch feed.mode {
            case .naive:
                let fullText = feed.baseline + feed.chunks.joined()
                storage.setAttributedString(NSAttributedString(string: fullText, attributes: attributes))
                written = fullText.utf16.count; writes = 1
            case .optimized:
                // If SwiftUI coalesces updates, append every missing chunk once.
                let suffix = feed.chunks.dropFirst(coordinator.appliedChunks).joined()
                storage.append(NSAttributedString(string: suffix, attributes: attributes))
                written = suffix.utf16.count; writes = 1
            }
        }
        storage.endEditing()
        if isNewRun {
            text.setSelectedRange(NSRange(location: 0, length: 0))
            scroll.contentView.scroll(to: .zero)
            scroll.reflectScrolledClipView(scroll.contentView)
        } else {
            // Preserve selection and reading position in BOTH implementations so
            // the comparison does not manufacture a worse scroll policy.
            text.selectedRanges = oldSelection.map { value in
                let range = value.rangeValue
                let location = min(range.location, storage.length)
                return NSValue(range: NSRange(location: location, length: min(range.length, storage.length - location)))
            }
            if wasAtBottom, !hadSelection {
                text.scrollRangeToVisible(NSRange(location: storage.length, length: 0))
            } else {
                scroll.contentView.scroll(to: oldOrigin)
                scroll.reflectScrolledClipView(scroll.contentView)
            }
        }
        coordinator.generation = feed.generation
        coordinator.appliedChunks = feed.chunks.count
        coordinator.revision = revision
        let processingMS = scenarioMilliseconds(since: started)
        // Compute the actual displayed text digest only at the end, outside the
        // timed mutation. Do not rescan the whole document on optimized appends.
        let fingerprint = feed.chunks.count == 160 ? scenarioFingerprint([storage.string]) : nil
        let result = ConsoleMutationReport(generation: feed.generation, writes: writes,
            insertedUTF16: written, documentUTF16: storage.length, milliseconds: processingMS, fingerprint: fingerprint)
        // Updating @Published during updateNSView would be an invalid SwiftUI
        // feedback loop. Report on the next main-queue turn; generation filters
        // stale reports after reset, and unchanged revision prevents reapplying.
        DispatchQueue.main.async { if coordinator.active { report(result) } }
    }

    static func dismantleNSView(_ nsView: NSScrollView, coordinator: Coordinator) { coordinator.active = false }
}

struct ConsoleDocumentPanel: View {
    @ObservedObject var feed: ConsoleFeed
    let report: @MainActor (ConsoleMutationReport) -> Void
    var body: some View { IncrementalConsoleText(feed: feed, revision: feed.revision, report: report) }
}

struct ConsoleScenarioView: View {
    @ObservedObject var model: ConsoleScenario
    let mode: ScenarioMode
    let load: ScenarioLoad
    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("Harness 情境：长时间运行的工具持续产生日志，用户向上阅读、选择复制，同时编辑下一条指令。").font(.headline)
            Text(mode == .naive
                 ? "朴素路径：载入 \(load.consoleRows) 条旧行后，每次视图更新拼接全部输出，并 setAttributedString 替换整个文本存储。"
                 : "优化路径：同一 NSTextView 仅加载一次旧行；记录已应用批次，用 NSTextStorage.append 添加所有遗漏的新块。")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                ScenarioMetric(title: "收到的批次", value: "\(model.receivedBatches) / 160")
                ScenarioMetric(title: "实际文本存储写入次数", value: "\(model.mutations)")
                ScenarioMetric(title: "累计写入 UTF-16 / 当前文档", value: "\(model.insertedUTF16) / \(model.displayedUTF16)")
                ScenarioMetric(title: "最近存储处理 / 累计", value: "\(scenarioTime(model.lastMutationMS)) / \(scenarioTime(model.totalMutationMS))")
            }.padding(10).background(Color.primary.opacity(0.035))
            ConsoleDocumentPanel(feed: model.feed, report: model.record)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text(model.status).font(.caption).foregroundStyle(.secondary)
            Text("数据准备 \(scenarioTime(model.preparationMS))。计时包含同步拼接、文本存储变更与滚动恢复，不代表绘制耗时。两种模式都保留所有输出、选区与阅读位置；在底部且无选区才跟随新增内容。")
                .font(.caption2).foregroundStyle(.secondary)
            Text("取舍：增量路径要维护 generation / 已应用游标，重置时清空；TextKit 桥接需要管理文本容器与滚动。它是日志视图，不实现终端 ANSI、PTY 或交互 shell。")
                .font(.caption2).foregroundStyle(.secondary)
            ScenarioComparison(values: model.completed)
        }
    }
}
