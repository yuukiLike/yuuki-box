import Foundation
import AppKit

final class ListView: NSScrollView, NSTableViewDataSource, NSTableViewDelegate {
    var rows: [[String: Any]] = []
    private let table = NSTableView()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("event"))
        table.addTableColumn(column)
        table.headerView = nil
        table.rowHeight = 32
        table.intercellSpacing = .zero
        table.usesAlternatingRowBackgroundColors = true
        table.dataSource = self
        table.delegate = self
        hasVerticalScroller = true
        borderType = .bezelBorder
        documentView = table
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: 285).isActive = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    func update(_ rows: [[String: Any]]) { self.rows = rows; table.reloadData() }
    func numberOfRows(in tableView: NSTableView) -> Int { rows.count }
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let identifier = NSUserInterfaceItemIdentifier("event-cell")
        let label = tableView.makeView(withIdentifier: identifier, owner: self) as? NSTextField ?? NSTextField(labelWithString: "")
        label.identifier = identifier
        label.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        label.lineBreakMode = .byTruncatingTail
        label.stringValue = "\(rows[row]["kind"] as? String == "tool" ? "TOOL" : "TEXT")   \(rows[row]["text"] as? String ?? "")"
        return label
    }
}

final class FlippedView: NSView { override var isFlipped: Bool { true } }

final class TextPanel: NSScrollView {
    let text = NSTextView()
    init(height: CGFloat, editable: Bool) {
        super.init(frame: .zero)
        hasVerticalScroller = true
        borderType = .bezelBorder
        text.isEditable = editable
        text.isSelectable = true
        text.isRichText = false
        text.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        text.textContainerInset = NSSize(width: 8, height: 8)
        text.isVerticallyResizable = true
        text.isHorizontallyResizable = false
        text.autoresizingMask = [.width]
        text.textContainer?.widthTracksTextView = true
        documentView = text
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: height).isActive = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    func update(_ value: String) {
        guard text.string != value else { return }
        let follow = text.visibleRect.maxY >= text.bounds.height - 40
        text.string = value
        if follow && !text.isEditable { text.scrollToEndOfDocument(nil) }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSSearchFieldDelegate, NSTextViewDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private let stack = NSStackView()
    private let scroll = NSScrollView()
    private let document = FlippedView()
    private let metrics = NSTextField(wrappingLabelWithString: "正在启动 Node renderer…")
    private var views: [String: NSView] = [:]
    private var nodes: [String: [String: Any]] = [:]
    private var parents: [String: NSStackView] = [:]
    private var rendererProcess: Process?
    private var input: FileHandle?
    private var output: FileHandle?
    private var buffer = Data()
    private var frames = 0
    private var totalBytes = 0
    private var metricRun = ""
    private var controlsUpdated = 0
    private var controlsCreated = 0
    private var controlsRemoved = 0
    private var applyTotal = 0.0
    private let resources = Bundle.main.resourceURL!
    private lazy var capabilities = NativeCapabilities(resources: resources)
    private lazy var runtime = AgentRuntimeClient(resources: resources, route: "react-native")

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu(title: "Yuuki React Native Bridge")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1060, height: 880), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Yuuki · React → AppKit"
        window.minSize = NSSize(width: 860, height: 760)
        window.delegate = self
        let content = NSView()
        window.contentView = content
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.detachesHiddenViews = true
        scroll.hasVerticalScroller = true
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = document
        document.addSubview(stack)
        content.addSubview(scroll)
        metrics.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
        metrics.textColor = .secondaryLabelColor
        metrics.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(metrics)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            scroll.topAnchor.constraint(equalTo: content.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: metrics.topAnchor, constant: -10),
            stack.leadingAnchor.constraint(equalTo: document.leadingAnchor, constant: 24),
            stack.widthAnchor.constraint(equalTo: scroll.contentView.widthAnchor, constant: -48),
            stack.topAnchor.constraint(equalTo: document.topAnchor, constant: 24),
            metrics.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 24),
            metrics.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -14),
            metrics.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -24)
        ])
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        capabilities.onEvent = { [weak self] event in self?.send(["type": "native.event", "event": event]) }
        runtime.onEvent = { [weak self] event in
            if let state = event["state"] as? [String: Any], let settings = state["settings"] as? [String: Any] { self?.capabilities.settings = settings }
            self?.send(["type": "native.event", "event": ["type": "agent.event", "event": event]])
        }
        startRenderer()
        runtime.start()
    }

    private func startRenderer() {
        let process = Process(), inPipe = Pipe(), outPipe = Pipe()
        process.executableURL = resources.appendingPathComponent("node")
        var environment = ProcessInfo.processInfo.environment
        environment.removeValue(forKey: "DEEPSEEK_API_KEY")
        process.environment = environment
        process.arguments = [resources.appendingPathComponent("renderer.cjs").path, resources.appendingPathComponent("events.json").path]
        process.standardInput = inPipe
        process.standardOutput = outPipe
        process.standardError = FileHandle.standardError
        input = inPipe.fileHandleForWriting
        output = outPipe.fileHandleForReading
        rendererProcess = process
        output?.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { handle.readabilityHandler = nil; return }
            // Bound queued pipe data: the Node writer naturally sees pipe
            // backpressure while the main thread applies the last chunk.
            DispatchQueue.main.sync { self?.receive(data) }
        }
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                self?.metrics.stringValue = "Node renderer 已退出 (\(process.terminationStatus)) · 重新打开应用恢复"
                self?.input = nil
            }
        }
        do { try process.run() }
        catch { metrics.stringValue = "无法启动 Node：\(error.localizedDescription)" }
    }

    private func receive(_ data: Data) {
        guard !data.isEmpty else { return }
        buffer.append(data)
        guard buffer.count <= 24_000_000 else {
            buffer.removeAll(); rendererProcess?.terminate()
            metrics.stringValue = "renderer 输出超过安全限制，已停止"
            return
        }
        while let newline = buffer.firstIndex(of: 10) {
            let line = buffer.prefix(upTo: newline)
            buffer.removeSubrange(...newline)
            let started = CFAbsoluteTimeGetCurrent()
            guard let message = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { continue }
            if message["type"] as? String == "native", let command = message["command"] as? [String: Any] {
                if command["type"] as? String == "agent.command", Set(command.keys) == ["type", "command"], var action = command["command"] as? [String: Any] {
                    if action["op"] as? String == "settings.save", action["clearAPIKey"] as? Bool != true, let field = views["apiKey"] as? NSSecureTextField {
                        action["apiKey"] = field.stringValue
                        field.stringValue = ""
                    }
                    runtime.send(action)
                } else { capabilities.handle(command) }
                continue
            }
            let type = message["type"] as? String ?? ""
            guard type == "render" || type == "render.patch" else { continue }
            let bridge = message["bridge"] as? [String: Any] ?? [:]
            let run = bridge["run"] as? String ?? "app"
            if metricRun != run {
                metricRun = run; frames = 0; totalBytes = 0; controlsUpdated = 0; controlsCreated = 0; controlsRemoved = 0; applyTotal = 0
            }
            let updatedBefore = controlsUpdated
            if type == "render", let tree = message["tree"] as? [[String: Any]], let root = tree.first {
                applyChildren(root["children"] as? [[String: Any]] ?? [], to: stack)
            } else if type == "render.patch", let changes = message["changes"] as? [[String: Any]] {
                for change in changes {
                    guard let id = change["id"] as? String, let props = change["props"] as? [String: Any], var node = nodes[id], let parent = parents[id] else { continue }
                    node["props"] = props
                    // A property patch never replays descendants from an old
                    // snapshot; each changed stable ID is applied independently.
                    applyChildren([node], to: parent, recurse: false)
                }
            }
            resizeDocument()
            frames += 1; totalBytes += line.count + 1
            let applyMs = (CFAbsoluteTimeGetCurrent() - started) * 1000
            applyTotal += applyMs
            let responder = window.firstResponder as? NSTextView
            let focusID = responder?.identifier?.rawValue ?? (responder?.delegate as? NSView)?.identifier?.rawValue ?? "非文本控件"
            let selection = responder.map { "\($0.selectedRange().location):\($0.selectedRange().length)" } ?? "—"
            metrics.stringValue = String(format: "%@ · React提交 %d / 发包 %d / 背压合并 %d · 实际 JSON %.1f KB，本轮 %.1f KB\n编码+diff累计 %.2f ms · 解码/应用本次 %.2f ms，累计 %.2f ms · 控件应用 %d（累计 %d）/创建 %d/移除 %d\n最近应用时焦点 %@ · 实际选区 %@ · 以上均是代理指标，不是 FPS", type, bridge["commits"] as? Int ?? 0, frames, bridge["coalesced"] as? Int ?? 0, Double(line.count + 1) / 1024, Double(totalBytes) / 1024, bridge["encodeTotal"] as? Double ?? 0, applyMs, applyTotal, controlsUpdated - updatedBefore, controlsUpdated, controlsCreated, controlsRemoved, focusID, selection)
        }
    }

    // Deliberately small vocabulary. AppKit views are retained by ID so typing
    // keeps first responder across React commits. List rows use NSTableView reuse.
    private func applyChildren(_ children: [[String: Any]], to parent: NSStackView, recurse: Bool = true) {
        for node in children {
            guard let type = node["type"] as? String, let props = node["props"] as? [String: Any], let id = props["id"] as? String else { continue }
            nodes[id] = node
            parents[id] = parent
            controlsUpdated += 1
            let view: NSView
            if let existing = views[id] { view = existing }
            else {
                switch type {
                case "Column":
                    let column = NSStackView(); column.orientation = .vertical; column.alignment = .leading; column.spacing = 8; column.detachesHiddenViews = true; view = column
                case "Row":
                    let row = NSStackView(); row.orientation = .horizontal; row.spacing = 8; view = row
                case "Button":
                    let button = NSButton(title: "", target: self, action: #selector(buttonPressed(_:))); button.bezelStyle = .rounded; view = button
                case "Input":
                    let field = NSSearchField(); field.delegate = self; view = field
                case "Field":
                    let field = NSTextField(); field.delegate = self; view = field
                case "Secure": view = NSSecureTextField()
                case "Select": view = NSPopUpButton(frame: .zero, pullsDown: false)
                case "Editor", "Transcript":
                    let panel = TextPanel(height: CGFloat(props["height"] as? Double ?? 100), editable: type == "Editor")
                    panel.text.identifier = NSUserInterfaceItemIdentifier(id)
                    if type == "Editor" { panel.text.delegate = self }
                    view = panel
                case "List": view = ListView(frame: .zero)
                case "Text":
                    let label = NSTextField(wrappingLabelWithString: ""); label.isSelectable = true
                    label.font = .systemFont(ofSize: props["role"] as? String == "title" ? 25 : 11, weight: props["role"] as? String == "title" ? .semibold : .regular)
                    if props["role"] as? String == "output" { label.maximumNumberOfLines = 5; label.font = .monospacedSystemFont(ofSize: 11, weight: .regular) }
                    view = label
                default: continue
                }
                view.identifier = NSUserInterfaceItemIdentifier(id)
                controlsCreated += 1
                view.translatesAutoresizingMaskIntoConstraints = false
                views[id] = view
                parent.addArrangedSubview(view)
                if parent.orientation == .vertical { view.widthAnchor.constraint(equalTo: parent.widthAnchor).isActive = true }
            }
            view.isHidden = props["hidden"] as? Bool ?? false
            if let select = view as? NSPopUpButton {
                let options = props["options"] as? [[String: String]] ?? []
                let ids = select.itemArray.compactMap { $0.representedObject as? String }
                if ids != options.map({ $0["id"] ?? "" }) || select.itemTitles != options.map({ $0["label"] ?? "" }) {
                    select.removeAllItems()
                    for option in options { select.addItem(withTitle: option["label"] ?? ""); select.lastItem?.representedObject = option["id"] }
                }
                if let index = options.firstIndex(where: { $0["id"] == props["value"] as? String }) { select.selectItem(at: index) }
                select.isEnabled = props["enabled"] as? Bool ?? true
                select.target = self; select.action = #selector(selectionChanged(_:))
            } else if let button = view as? NSButton {
                button.title = props["title"] as? String ?? ""
                button.isEnabled = props["enabled"] as? Bool ?? true
            } else if let secret = view as? NSSecureTextField {
                secret.placeholderString = props["placeholder"] as? String
                secret.isEnabled = props["enabled"] as? Bool ?? true
            } else if ["Input", "Field"].contains(type), let field = view as? NSTextField {
                let value = props["value"] as? String ?? ""
                if field.stringValue != value { field.stringValue = value }
                field.placeholderString = props["placeholder"] as? String
                field.isEnabled = props["enabled"] as? Bool ?? true
            } else if let label = view as? NSTextField { label.stringValue = props["text"] as? String ?? "" }
            else if let panel = view as? TextPanel { panel.text.isEditable = type == "Editor" && (props["enabled"] as? Bool ?? true); panel.update(props["value"] as? String ?? "") }
            else if let list = view as? ListView { list.update(props["items"] as? [[String: Any]] ?? []) }
            else if let row = view as? NSStackView, recurse {
                // N3's naive path actually destroys and reconstructs native
                // form controls. Model text is preserved; focus/selection loss
                // comes from AppKit object lifetime, not simulated dropped keys.
                if props["recreate"] as? Bool == true { removeChildren(from: row) }
                applyChildren(node["children"] as? [[String: Any]] ?? [], to: row)
            }
        }
    }

    private func removeChildren(from parent: NSStackView) {
        for child in parent.arrangedSubviews {
            if let nested = child as? NSStackView { removeChildren(from: nested) }
            if let id = child.identifier?.rawValue { views.removeValue(forKey: id); nodes.removeValue(forKey: id); parents.removeValue(forKey: id) }
            parent.removeArrangedSubview(child)
            child.removeFromSuperview()
            controlsRemoved += 1
        }
    }

    @objc private func buttonPressed(_ button: NSButton) { send(["type": "action", "id": button.identifier?.rawValue ?? ""]) }
    @objc private func selectionChanged(_ select: NSPopUpButton) { send(["type": "action", "id": select.identifier?.rawValue ?? "", "value": select.selectedItem?.representedObject as? String ?? ""]) }
    func controlTextDidChange(_ notification: Notification) {
        guard let field = notification.object as? NSTextField, !(field is NSSecureTextField) else { return }
        send(["type": "action", "id": field.identifier?.rawValue ?? "", "value": field.stringValue])
    }
    func textDidChange(_ notification: Notification) {
        guard let text = notification.object as? NSTextView else { return }
        send(["type": "action", "id": text.identifier?.rawValue ?? "", "value": text.string])
    }
    private func resizeDocument() {
        stack.layoutSubtreeIfNeeded()
        document.frame = NSRect(x: 0, y: 0, width: scroll.contentSize.width, height: max(scroll.contentSize.height, stack.fittingSize.height + 48))
    }
    func windowDidResize(_ notification: Notification) { resizeDocument() }
    private func send(_ message: [String: Any]) {
        guard let input, let data = try? JSONSerialization.data(withJSONObject: message) else { return }
        do { try input.write(contentsOf: data + Data([10])) }
        catch { metrics.stringValue = "桥接写入失败：\(error.localizedDescription)" }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        capabilities.shutdown()
        runtime.shutdown()
        output?.readabilityHandler = nil
        if let process = rendererProcess, process.isRunning { process.terminate() }
    }
}

@main struct Main {
    static func main() {
        signal(SIGPIPE, SIG_IGN)
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}
