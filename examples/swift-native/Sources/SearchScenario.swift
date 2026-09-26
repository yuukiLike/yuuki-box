import SwiftUI
import Foundation

private struct SearchDocument: Sendable {
    let id: Int
    let path: String
    let text: String
}

private struct IndexedSearchDocument: Sendable {
    let source: SearchDocument
    let path: String
    let text: String
}

struct ScenarioSearchHit: Identifiable, Sendable {
    let id: Int
    let path: String
    let text: String
    let score: Int
}

private struct SearchIndexOutcome: Sendable {
    var index: [IndexedSearchDocument]
    let normalizedRows: Int
    let milliseconds: Double
    let cancelled: Bool
}

private struct SearchQueryOutcome: Sendable {
    let hits: [ScenarioSearchHit]
    let matches: Int
    let scannedRows: Int
    let milliseconds: Double
    let cancelled: Bool
}

// Both modes call the same normalization, scoring and stable tie-break functions.
// Only where/when this work happens differs.
private enum WorkspaceSearchAlgorithm {
    static func documents(count: Int) -> [SearchDocument] {
        let modules = ["Agent", "Tools", "Speech", "Approval", "Persistence", "Providers", "Sessions", "UI"]
        let messages = [
            "ERROR tool read_file timed out. Agent cancel requested; child process exited and partial output was retained.",
            "INFO model stream completed. Assistant output includes a plan, file references and known token usage.",
            "WARN write_note approval waiting. Full preview is available; no workspace file has been modified.",
            "INFO Whisper small audio transcription finished. Local model returned text; recording file removed.",
            "ERROR network request failed. Retry policy exhausted; model usage is unknown and the run is interrupted.",
            "INFO session restored from local journal. Completed tools stay completed; unknown side effects need review."
        ]
        return (0..<count).map { id in
            SearchDocument(id: id,
                path: "Workspace/\(modules[id % modules.count])/Café-\(id % 59)/run-\(id).log",
                text: "[event \(id)] \(messages[id % messages.count]) 工作区记录：保留输入与结果，等待下一条任务。 " +
                      "Trace session=\(id % 71), stage=\(modules[(id / 7) % modules.count]), source=Résumé-\(id % 23). " +
                      "The event belongs to one session and includes an explicit completion status.")
        }
    }

    static func normalize(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: Locale(identifier: "en_US_POSIX"))
    }

    static func buildIndex(_ documents: [SearchDocument], cancellable: Bool) -> SearchIndexOutcome {
        let started = scenarioNow()
        var index: [IndexedSearchDocument] = []
        index.reserveCapacity(documents.count)
        for (offset, document) in documents.enumerated() {
            if cancellable, offset % 64 == 0, Task.isCancelled {
                return SearchIndexOutcome(index: [], normalizedRows: index.count, milliseconds: scenarioMilliseconds(since: started), cancelled: true)
            }
            index.append(IndexedSearchDocument(source: document, path: normalize(document.path), text: normalize(document.text)))
        }
        return SearchIndexOutcome(index: index, normalizedRows: index.count, milliseconds: scenarioMilliseconds(since: started), cancelled: false)
    }

    static func rank(_ index: [IndexedSearchDocument], query: String, cancellable: Bool) -> SearchQueryOutcome {
        let started = scenarioNow()
        let terms = normalize(query).split(whereSeparator: { $0.isWhitespace }).prefix(8).map(String.init)
        var hits: [ScenarioSearchHit] = []
        var scanned = 0
        for document in index {
            if cancellable, scanned % 64 == 0, Task.isCancelled {
                return SearchQueryOutcome(hits: [], matches: 0, scannedRows: scanned, milliseconds: scenarioMilliseconds(since: started), cancelled: true)
            }
            scanned += 1
            guard let score = score(document, terms: terms) else { continue }
            hits.append(ScenarioSearchHit(id: document.source.id, path: document.source.path, text: document.source.text, score: score))
        }
        // Exact same deterministic ranking for both modes, including empty query.
        hits.sort { $0.score == $1.score ? $0.id < $1.id : $0.score > $1.score }
        if cancellable, Task.isCancelled {
            return SearchQueryOutcome(hits: [], matches: 0, scannedRows: scanned, milliseconds: scenarioMilliseconds(since: started), cancelled: true)
        }
        return SearchQueryOutcome(hits: Array(hits.prefix(100)), matches: hits.count, scannedRows: scanned, milliseconds: scenarioMilliseconds(since: started), cancelled: false)
    }

    private static func score(_ document: IndexedSearchDocument, terms: [String]) -> Int? {
        var total = 0
        for term in terms {
            let pathMatch = document.path.contains(term)
            guard pathMatch || document.text.contains(term) else { return nil }
            if pathMatch { total += 20 }
            if document.text.hasPrefix(term) { total += 10 }
            var cursor = document.text.startIndex
            while let range = document.text.range(of: term, range: cursor..<document.text.endIndex) {
                total += 2
                cursor = range.upperBound
            }
        }
        return total
    }
}

@MainActor
final class SearchScenario: ObservableObject {
    @Published var query = "error"
    @Published private(set) var results: [ScenarioSearchHit] = []
    @Published private(set) var status = "点击运行建立内存工作区，然后每次修改查询都会实际检索。"
    @Published private(set) var acceptingQueries = false
    @Published private(set) var indexing = false
    @Published private(set) var queryRunning = false
    @Published private(set) var normalizedRows = 0
    @Published private(set) var scannedRows = 0
    @Published private(set) var requests = 0
    @Published private(set) var publishedQueries = 0
    @Published private(set) var cancellationRequests = 0
    @Published private(set) var discardedCompletions = 0
    @Published private(set) var matchedRows = 0
    @Published private(set) var lastProcessingMS = 0.0
    @Published private(set) var indexProcessingMS = 0.0
    @Published private(set) var dataPreparationMS = 0.0
    @Published private(set) var completed: [ScenarioMode: ScenarioCompletion] = [:]
    private var documents: [SearchDocument] = []
    private var cachedIndex: [IndexedSearchDocument] = []
    private var indexTask: Task<SearchIndexOutcome, Never>?
    private var queryTask: Task<SearchQueryOutcome, Never>?
    private var generation = 0
    private var runID = UUID()
    private var mode = ScenarioMode.naive

    func start(mode: ScenarioMode, load: ScenarioLoad) {
        reset()
        self.mode = mode
        let started = scenarioNow()
        documents = WorkspaceSearchAlgorithm.documents(count: load.searchRows)
        dataPreparationMS = scenarioMilliseconds(since: started)
        acceptingQueries = true
        if mode == .naive { queryChanged(); return }
        status = "后台建立归一化索引；仍可修改查询，索引完成后使用最新输入。"
        indexing = true
        let documents = self.documents
        let run = runID
        let work = Task.detached(priority: .userInitiated) {
            WorkspaceSearchAlgorithm.buildIndex(documents, cancellable: true)
        }
        indexTask = work
        Task { [weak self] in
            let outcome = await work.value
            guard let self, self.runID == run else { return }
            self.indexTask = nil; self.indexing = false
            self.normalizedRows += outcome.normalizedRows
            self.indexProcessingMS += outcome.milliseconds
            guard self.acceptingQueries, !outcome.cancelled else { self.discardedCompletions += 1; return }
            self.cachedIndex = outcome.index
            self.queryChanged()
        }
    }

    func queryChanged() {
        guard acceptingQueries, !indexing else { return }
        requests += 1
        generation += 1
        // A shared maximum keeps both paths bounded; UI input itself is preserved.
        let input = String(query.prefix(96))
        switch mode {
        case .naive: normalizeAndRankOnMainActor(input)
        case .optimized: rankCachedIndexInBackground(input)
        }
    }

    private func normalizeAndRankOnMainActor(_ input: String) {
        // This is intentionally the straightforward synchronous implementation:
        // normalize the source afresh and compute complete ranking per input.
        queryRunning = true
        let started = scenarioNow()
        let index = WorkspaceSearchAlgorithm.buildIndex(documents, cancellable: false)
        let outcome = WorkspaceSearchAlgorithm.rank(index.index, query: input, cancellable: false)
        normalizedRows += index.normalizedRows
        scannedRows += outcome.scannedRows
        indexProcessingMS += index.milliseconds
        lastProcessingMS = scenarioMilliseconds(since: started)
        apply(outcome, input: input)
    }

    private func rankCachedIndexInBackground(_ input: String) {
        if let queryTask { queryTask.cancel(); cancellationRequests += 1 }
        let index = cachedIndex
        let run = runID, request = generation
        queryRunning = true
        status = "后台检索第 \(request) 代输入；旧结果暂时保留，完成后替换。"
        let work = Task.detached(priority: .userInitiated) {
            WorkspaceSearchAlgorithm.rank(index, query: input, cancellable: true)
        }
        queryTask = work
        Task { [weak self] in
            let outcome = await work.value
            guard let self, self.runID == run else { return }
            self.scannedRows += outcome.scannedRows
            guard self.acceptingQueries, self.generation == request, !outcome.cancelled else {
                self.discardedCompletions += 1
                return
            }
            self.queryTask = nil
            self.lastProcessingMS = outcome.milliseconds
            self.apply(outcome, input: input)
        }
    }

    private func apply(_ outcome: SearchQueryOutcome, input: String) {
        results = outcome.hits; matchedRows = outcome.matches
        publishedQueries += 1; queryRunning = false
        completed[mode] = ScenarioCompletion(input: "\(documents.count) 条 / 查询 \(input)",
            output: "匹配 \(outcome.matches) / 展示 \(outcome.hits.count)",
            fingerprint: scenarioFingerprint([String(outcome.matches)] + outcome.hits.map { "\($0.id)|\($0.score)|\($0.path)|\($0.text)" }),
            work: "累计归一化 \(normalizedRows) 行 / 发布 \(publishedQueries) 次",
            processing: "最近查询 \(scenarioTime(lastProcessingMS))")
        status = "完成：匹配 \(outcome.matches) 条，按分数与稳定 ID 展示前 100 条。"
    }

    func stop() {
        generation += 1
        if let indexTask { indexTask.cancel(); cancellationRequests += 1 }
        if let queryTask { queryTask.cancel(); cancellationRequests += 1 }
        indexTask = nil; queryTask = nil
        if acceptingQueries { status = "已停止。继续编辑不会发起检索；点击运行重新建立这一轮。" }
        acceptingQueries = false; indexing = false; queryRunning = false
    }

    func reset() {
        stop(); runID = UUID(); generation = 0
        documents = []; cachedIndex = []; results = []
        normalizedRows = 0; scannedRows = 0; requests = 0; publishedQueries = 0
        cancellationRequests = 0; discardedCompletions = 0; matchedRows = 0
        lastProcessingMS = 0; indexProcessingMS = 0; dataPreparationMS = 0
        status = "点击运行建立内存工作区，然后每次修改查询都会实际检索。"
        // Keep the query, just as the shared response probe keeps its text.
    }
}

struct SearchScenarioView: View {
    @ObservedObject var model: SearchScenario
    let mode: ScenarioMode
    let load: ScenarioLoad
    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("Harness 情境：在长运行日志中查找 error、cancel、approval 或 Café 路径，同时保留下一条指令输入。").font(.headline)
            Text(mode == .naive
                 ? "朴素路径：每次输入变化，都在 MainActor 对 \(load.searchRows) 条记录做 Unicode 归一化、匹配、计分和排序。"
                 : "优化路径：后台预建归一化索引；每次查询在 detached task 计分排序，旧任务请求取消，generation 守卫拒绝过期结果。")
                .font(.caption).foregroundStyle(.secondary)
            TextField("查询：例如 error、agent cancel、cafe、approval", text: $model.query)
                .textFieldStyle(.roundedBorder).onChange(of: model.query) { _, _ in model.queryChanged() }
            Text("相同规则：忽略大小写 / 重音 / 全角差异；最多处理前 96 个字符、8 个词；所有词均需匹配；同分按 ID 排序。")
                .font(.caption2).foregroundStyle(.secondary)
            HStack {
                ScenarioMetric(title: "累计归一化 / 扫描行", value: "\(model.normalizedRows) / \(model.scannedRows)")
                ScenarioMetric(title: "请求 / 结果发布", value: "\(model.requests) / \(model.publishedQueries)")
                ScenarioMetric(title: "取消请求 / 丢弃完成", value: "\(model.cancellationRequests) / \(model.discardedCompletions)")
                ScenarioMetric(title: "最近查询处理", value: scenarioTime(model.lastProcessingMS))
            }.padding(10).background(Color.primary.opacity(0.035))
            Text("数据生成 \(scenarioTime(model.dataPreparationMS)) · 归一化累计 \(scenarioTime(model.indexProcessingMS))；优化模式的最近查询不含一次性建索引时间。")
                .font(.caption2).foregroundStyle(.secondary)
            List(model.results) { hit in
                VStack(alignment: .leading, spacing: 5) {
                    HStack { Text(hit.path).font(.caption.monospaced()).foregroundStyle(.secondary); Spacer(); Text("score \(hit.score)").font(.caption2.monospaced()) }
                    Text(hit.text).font(.system(size: 12)).textSelection(.enabled)
                }.padding(.vertical, 5)
            }.listStyle(.plain).border(Color.primary.opacity(0.12))
            Text(model.status).font(.caption).foregroundStyle(.secondary)
            Text("取舍：缓存占用额外内存，工作区变动需要失效策略；后台任务需要取消与结果身份检查。不是把同步函数标记 async 就能离开主线程。")
                .font(.caption2).foregroundStyle(.secondary)
            ScenarioComparison(values: model.completed)
        }
    }
}
