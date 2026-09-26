import AppKit
import SwiftUI
import Foundation
import Darwin

struct ReplayEvent: Codable, Identifiable {
    let id: Int
    let kind: String
    let text: String
}

struct UpdateManifest: Decodable {
    let schemaVersion: Int
    let version: String
    let notes: String
    let url: String

    func validate() throws -> URL {
        guard schemaVersion == 1 else { throw ExampleError("Unsupported update schema") }
        _ = try versionParts(version)
        guard let link = URL(string: url), link.scheme == "https", link.host != nil else {
            throw ExampleError("Release URL must use HTTPS")
        }
        return link
    }
}

struct ExampleError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

func versionParts(_ version: String) throws -> [Int] {
    let parts = version.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 3, parts.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) }),
          parts.allSatisfy({ Int($0) != nil }) else { throw ExampleError("Expected a numeric major.minor.patch version") }
    return parts.compactMap { Int($0) }
}

func fixtureURL(_ name: String) throws -> URL {
    guard let resources = Bundle.main.resourceURL else { throw ExampleError("Bundle resources are missing; run build.sh") }
    return resources.appendingPathComponent("fixtures").appendingPathComponent(name)
}

func loadEvents() throws -> [ReplayEvent] {
    let events = try JSONDecoder().decode([ReplayEvent].self, from: Data(contentsOf: fixtureURL("events.json")))
    guard !events.isEmpty, events.allSatisfy({ ["message", "tool"].contains($0.kind) }) else {
        throw ExampleError("Event fixture must contain message/tool events")
    }
    return events
}

@MainActor
final class Workbench: ObservableObject {
    @Published var input = "查看工作区并给出下一步建议"
    @Published var selectedTask = "工作区探索"
    @Published var rows: [ReplayEvent] = []
    @Published var status = "准备就绪 · 固定事件回放"
    @Published var isRunning = false
    @Published var historyCount = 1000
    @Published var toolsOnly = false
    @Published var updateStatus = "当前版本 0.1.0 · 默认检查本地清单"
    @Published var updateLink: URL?
    @Published var checkingUpdate = false
    private var timer: Timer?
    private var baseEvents: [ReplayEvent] = []
    private var streamed = 0
    private var nextID = 0
    private var replayGeneration = 0


    init() { loadHistory() }

    var visibleRows: [ReplayEvent] { toolsOnly ? rows.filter { $0.kind == "tool" } : rows }

    func loadHistory() {
        stopReplay()
        do {
            baseEvents = try loadEvents()
            rows = (0..<historyCount).map { index in
                let base = baseEvents[index % baseEvents.count]
                return ReplayEvent(id: index, kind: base.kind, text: base.text)
            }
            nextID = historyCount
            status = "已加载 \(historyCount) 条历史事件"
        } catch { status = "加载失败：\(error.localizedDescription)" }
    }

    func startReplay() {
        guard !isRunning, !baseEvents.isEmpty, !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        streamed = 0
        replayGeneration += 1
        let generation = replayGeneration
        isRunning = true
        status = "正在回放 · 可随时取消"
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.replayGeneration == generation else { return }
                self.tick()
            }
        }
        // Keep the replay timer responsive while tracking the scrollbar.
        if let timer { RunLoop.main.add(timer, forMode: .common) }
    }

    private func tick() {
        guard isRunning else { return }
        let event = baseEvents[streamed % baseEvents.count]
        rows.append(ReplayEvent(id: nextID, kind: event.kind, text: event.text))
        nextID += 1
        if rows.count > 10200 { rows.removeFirst(rows.count - 10200) }
        streamed += 1
        if streamed >= 200 {
            stopReplay()
            status = "回放完成 · 新增 200 条事件"
        }
    }

    func stopReplay() {
        timer?.invalidate(); timer = nil
        replayGeneration += 1
        if isRunning { status = "已取消 · 保留 \(streamed) 条已输出事件" }
        isRunning = false
    }

    func checkUpdate() {
        guard !checkingUpdate else { return }
        checkingUpdate = true; updateLink = nil; updateStatus = "检查中…"
        Task {
            defer { checkingUpdate = false }
            do {
                let data: Data
                if let configured = ProcessInfo.processInfo.environment["YUUKI_UPDATE_URL"], !configured.isEmpty {
                    guard let url = URL(string: configured), url.scheme == "https", url.host != nil else {
                        throw ExampleError("YUUKI_UPDATE_URL must be an HTTPS URL")
                    }
                    var request = URLRequest(url: url); request.timeoutInterval = 10
                    let (received, response) = try await URLSession.shared.data(for: request)
                    guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
                        throw ExampleError("Update server returned a non-success response")
                    }
                    guard response.url?.scheme == "https" else { throw ExampleError("Update redirect must remain HTTPS") }
                    data = received
                } else {
                    let fixture = ProcessInfo.processInfo.environment["YUUKI_UPDATE_FIXTURE"] ?? "available"
                    let filename: String
                    switch fixture {
                    case "available": filename = "update.json"
                    case "current": filename = "update-current.json"
                    case "invalid": filename = "update-invalid.json"
                    default: throw ExampleError("YUUKI_UPDATE_FIXTURE must be available, current, or invalid")
                    }
                    data = try Data(contentsOf: fixtureURL(filename))
                }
                guard data.count <= 65536 else { throw ExampleError("Update manifest exceeds 64 KiB") }
                let manifest = try JSONDecoder().decode(UpdateManifest.self, from: data)
                let link = try manifest.validate()
                if try versionParts("0.1.0").lexicographicallyPrecedes(versionParts(manifest.version)) {
                    updateStatus = "可用版本 \(manifest.version)：\(manifest.notes)"
                    updateLink = link
                } else { updateStatus = "已是最新版本 0.1.0" }
            } catch { updateStatus = "检查失败：\(error.localizedDescription)" }
        }
    }

    func shutdown() { stopReplay() }

}

struct WorkbenchView: View {
    @ObservedObject var model: Workbench
    let tasks = ["工作区探索", "界面性能实验", "发布与语音实验"]

    var body: some View {
        HSplitView {
            VStack(alignment: .leading, spacing: 18) {
                Text("YUUKI BOX").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                Text("Swift 原生").font(.title2.weight(.semibold))
                Text("SwiftUI + AppKit").font(.caption).foregroundStyle(.secondary)
                Divider()
                ForEach(tasks, id: \.self) { task in
                    Button { model.selectedTask = task } label: {
                        HStack { Image(systemName: "square.stack"); Text(task); Spacer() }
                            .padding(9).background(model.selectedTask == task ? Color.accentColor.opacity(0.15) : .clear)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                    }.buttonStyle(.plain)
                }
                Spacer()
                Text("0.1.0 · 本地路线实验\n固定输出，不调用模型").font(.caption).foregroundStyle(.secondary)
            }.padding(20).frame(minWidth: 205, idealWidth: 225, maxWidth: 260)

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.selectedTask).font(.title2.weight(.semibold))
                        Text(model.status).font(.caption).foregroundStyle(.secondary).accessibilityIdentifier("replay-status")
                    }
                    Spacer()
                    Picker("事件", selection: $model.toolsOnly) {
                        Text("全部").tag(false); Text("工具").tag(true)
                    }.pickerStyle(.segmented).frame(width: 115)
                    Picker("历史", selection: $model.historyCount) {
                        Text("1,000 条").tag(1000); Text("10,000 条").tag(10000)
                    }.frame(width: 160).onChange(of: model.historyCount) { _, _ in model.loadHistory() }
                    Text("\(model.rows.count) 事件").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                }
                List(model.visibleRows) { event in
                    HStack(alignment: .top, spacing: 12) {
                        Text(event.kind == "tool" ? "TOOL" : "AGENT")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(event.kind == "tool" ? .orange : .secondary).frame(width: 44, alignment: .leading)
                        Text(event.text).font(.system(size: 13)).textSelection(.enabled)
                        Spacer(minLength: 8)
                        Text("\(event.id)").font(.caption2.monospaced()).foregroundStyle(.tertiary)
                    }.padding(.vertical, 5)
                }.listStyle(.plain).border(Color.primary.opacity(0.1))
                HStack {
                    TextField("输入一项任务", text: $model.input).textFieldStyle(.roundedBorder)
                        .onSubmit { model.startReplay() }.accessibilityIdentifier("task-input")
                    Button("开始") { model.startReplay() }.disabled(model.isRunning || model.input.isEmpty)
                        .keyboardShortcut(.return, modifiers: .command)
                    Button("取消") { model.stopReplay() }.disabled(!model.isRunning)
                }
                Divider()
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text("软件更新").font(.headline)
                            Button("检查更新") { model.checkUpdate() }.disabled(model.checkingUpdate)
                        }
                        Text(model.updateStatus).font(.caption).foregroundStyle(.secondary).lineLimit(3)
                        if let link = model.updateLink { Link("打开版本说明 ↗", destination: link).font(.caption) }
                    }.frame(maxWidth: .infinity, alignment: .leading)

                }
            }.padding(22).frame(minWidth: 660, minHeight: 580)
        }.frame(minWidth: 920, minHeight: 650)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    var model: Workbench?
    var agent: AgentWorkbench?
    func applicationDidFinishLaunching(_ notification: Notification) {
        let model = Workbench(); self.model = model
        let agent = AgentWorkbench(); self.agent = agent
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1220, height: 900),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Yuuki Box · Swift Native"
        window.contentView = NSHostingView(rootView: RootWorkbenchView(agent: agent, lab: model))
        window.center(); window.makeKeyAndOrderFront(nil); self.window = window
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { model?.shutdown(); agent?.shutdown() }
}

func selfTest() throws {
    let events = try loadEvents()
    guard !events.isEmpty else { throw ExampleError("Empty replay fixture") }
    let manifest = try JSONDecoder().decode(UpdateManifest.self, from: Data(contentsOf: fixtureURL("update.json")))
    _ = try manifest.validate()
    guard try versionParts("0.1.9").lexicographicallyPrecedes(versionParts("0.2.0")),
          try !versionParts("1.0.0").lexicographicallyPrecedes(versionParts("0.2.0")) else { throw ExampleError("Version order failed") }
    for version in ["0.1", "1.a.0", "1.0.0-beta", "-1.2.3", "1..2"] {
        do { _ = try versionParts(version); throw ExampleError("Invalid version accepted: \(version)") }
        catch let error as ExampleError where error.message == "Expected a numeric major.minor.patch version" { }
    }
    do {
        _ = try UpdateManifest(schemaVersion: 1, version: "1.0.0", notes: "", url: "file:///tmp/app").validate()
        throw ExampleError("Unsafe release URL accepted")
    } catch let error as ExampleError where error.message == "Release URL must use HTTPS" { }
    print("PASS: \(events.count) fixture events; manifest validation; numeric version ordering; invalid version/URL rejection. No microphone or network access.")
}

signal(SIGPIPE, SIG_IGN)
if CommandLine.arguments.contains("--self-test") {
    do { try selfTest() } catch { fputs("FAIL: \(error.localizedDescription)\n", stderr); exit(1) }
} else {
    MainActor.assumeIsolated {
    let application = NSApplication.shared
    application.setActivationPolicy(.regular)
    let delegate = AppDelegate(); application.delegate = delegate
    let menu = NSMenu(), appMenu = NSMenu(), rootItem = NSMenuItem()
    appMenu.addItem(withTitle: "Quit Yuuki Box", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    rootItem.submenu = appMenu; menu.addItem(rootItem)
    let edit = NSMenu(title: "Edit"), editItem = NSMenuItem()
    edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
    edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit; menu.addItem(editItem); application.mainMenu = menu
    application.run()
    }
}
