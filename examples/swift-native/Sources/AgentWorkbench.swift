import AppKit
import SwiftUI
import Foundation
import Darwin

struct AgentSettings: Codable, Equatable {
    var apiBase = "https://api.deepseek.com"
    var model = "deepseek-flash"
    var maxOutputTokens = 2048
    var maxRounds = 4
    var workspace = ""
    var speechBackend = "apple"
    var whisperCLI = ""
    var whisperModel = ""
}

struct AgentSessionSummary: Decodable, Identifiable {
    let id: String
    let title: String
    let updatedAt: String
    let status: String
}

struct AgentMessage: Decodable, Identifiable {
    let id: String
    let role: String
    var content: String
    let status: String
    let name: String?
}

struct AgentUsage: Decodable {
    let promptTokens: Int
    let completionTokens: Int
    let totalTokens: Int
    let requests: Int
    let unreportedRequests: Int
}

struct AgentApproval: Decodable, Identifiable {
    let id: String
    let tool: String
    let path: String
    let preview: String
}

struct AgentSession: Decodable, Identifiable {
    let id: String
    let title: String
    let status: String
    var messages: [AgentMessage]
    let usage: AgentUsage
    let pendingApproval: AgentApproval?
}

struct AgentRuntimeState: Decodable {
    let settings: AgentSettings
    let hasAPIKey: Bool
    let busy: Bool
    let notice: String
    let sessions: [AgentSessionSummary]
    var session: AgentSession?
}

struct RuntimeEnvelope: Decodable {
    let type: String
    let state: AgentRuntimeState?
    let sessionId: String?
    let messageId: String?
    let text: String?
    let message: String?
    let path: String?
}

struct VoiceEnvelope: Decodable {
    let type: String
    let state: String?
    let text: String?
    let code: String?
    let message: String?
}

// One owner, one child process. Stdin stays open until explicit shutdown.
// The reader preserves event ordering and never logs protocol payloads or keys.
@MainActor
final class JSONLChild {
    private var process: Process?
    private var input: Pipe?
    private let maxLineBytes = 2 * 1024 * 1024
    var isRunning: Bool { process?.isRunning ?? false }

    func launch(executable: URL, arguments: [String],
                onLine: @escaping @MainActor (Data) -> Void,
                onFailure: @escaping @MainActor (String) -> Void,
                onExit: @escaping @MainActor (Int32) -> Void) throws {
        guard process == nil else { throw ExampleError("该子进程已经启动") }
        guard FileManager.default.isExecutableFile(atPath: executable.path) else { throw ExampleError("运行组件缺失，请重新构建应用：\(executable.lastPathComponent)") }
        let process = Process(), input = Pipe(), output = Pipe()
        process.executableURL = executable; process.arguments = arguments
        process.standardInput = input; process.standardOutput = output
        // Runtime errors travel as safe JSONL events; credentials are never logged.
        process.standardError = FileHandle.nullDevice
        try process.run()
        self.process = process; self.input = input
        let limit = maxLineBytes
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            var pending = Data()
            var protocolFailed = false
            while true {
                let chunk = output.fileHandleForReading.availableData
                if chunk.isEmpty { break }
                if protocolFailed { continue }
                pending.append(chunk)
                while let newline = pending.firstIndex(of: 0x0a) {
                    let line = Data(pending[..<newline]); pending.removeSubrange(...newline)
                    if line.count > limit {
                        protocolFailed = true
                        DispatchQueue.main.async { onFailure("子进程单条消息超过 2 MiB 上限"); self?.shutdown() }
                        break
                    }
                    if !line.isEmpty { DispatchQueue.main.async { onLine(line) } }
                }
                if !protocolFailed, pending.count > limit {
                    protocolFailed = true
                    DispatchQueue.main.async { onFailure("子进程输出没有在 2 MiB 内结束一条消息"); self?.shutdown() }
                }
            }
            if !protocolFailed, !pending.isEmpty {
                DispatchQueue.main.async { onFailure("子进程输出了未完整结束的 JSONL 消息") }
            }
            process.waitUntilExit()
            let status = process.terminationStatus
            DispatchQueue.main.async { onExit(status) }
        }
    }

    func send(_ value: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: value)
        guard data.count <= maxLineBytes else { throw ExampleError("命令超过 2 MiB 上限") }
        try write(data + Data([0x0a]))
    }

    func sendLine(_ line: String) throws { try write(Data((line + "\n").utf8)) }

    private func write(_ data: Data) throws {
        guard let process, process.isRunning, let input else { throw ExampleError("运行组件未连接") }
        try input.fileHandleForWriting.write(contentsOf: data)
    }

    func shutdown() {
        try? input?.fileHandleForWriting.close()
        input = nil
        guard let process, process.isRunning else { return }
        process.terminate()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            if process.isRunning { kill(process.processIdentifier, SIGKILL) }
        }
    }
}

@MainActor
final class AgentWorkbench: ObservableObject {
    @Published var state: AgentRuntimeState?
    @Published var draft = ""
    @Published var settings = AgentSettings()
    @Published var apiKeyDraft = ""
    @Published var settingsPresented = false
    @Published var connected = false
    @Published var notice = "正在连接本地 Agent Runtime…"
    @Published var lastError: String?
    @Published var exportPath: String?
    @Published var submitting = false
    @Published var savingSettings = false
    @Published var approvalSubmitting = false
    @Published var speechRunning = false
    @Published var speechState = "stopped"
    @Published var speechStatus = "语音未启动"
    @Published var transcript = ""
    private var runtime: JSONLChild?
    private var voice: JSONLChild?
    private var voiceID: UUID?
    private var voiceHadError = false
    private var voiceCancelled = false
    private var drafts: [String: String] = [:]
    private var pendingSubmission: (sessionID: String, text: String, previousCount: Int)?
    private var awaitingSettingsReplacement = false
    private var closing = false

    var busy: Bool { state?.busy ?? false }
    var blocksNavigation: Bool { busy || submitting || savingSettings }
    var ready: Bool { connected && state != nil }
    var canSend: Bool { ready && !blocksNavigation && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    var sessionID: String? { state?.session?.id }

    init() { connect() }

    func connect() {
        guard runtime == nil, !closing else { return }
        if let id = sessionID { drafts[id] = draft }
        state = nil; pendingSubmission = nil; submitting = false
        notice = "正在连接本地 Agent Runtime…"; lastError = nil
        let child = JSONLChild(); runtime = child
        let executable = Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/AgentRuntime.app/Contents/MacOS/agent-runtime")
        do {
            try child.launch(executable: executable, arguments: ["serve", "--route", "swift"], onLine: { [weak self, weak child] data in
                guard let self, self.runtime === child else { return }; self.receiveRuntime(data)
            }, onFailure: { [weak self, weak child] message in
                guard let self, self.runtime === child else { return }; self.lastError = message
            }, onExit: { [weak self, weak child] status in
                guard let self, self.runtime === child else { return }
                self.connected = false; self.runtime = nil; self.submitting = false; self.savingSettings = false
                if !self.closing { self.notice = "本地 Runtime 已退出（\(status)）；可重新连接" }
            })
            connected = true
            try child.send(["op": "bootstrap"])
        } catch {
            child.shutdown(); runtime = nil; connected = false
            lastError = error.localizedDescription; notice = "本地 Runtime 启动失败"
        }
    }

    private func receiveRuntime(_ data: Data) {
        do {
            let event = try JSONDecoder().decode(RuntimeEnvelope.self, from: data)
            switch event.type {
            case "state":
                guard let incoming = event.state else { throw ExampleError("state 事件缺少状态") }
                let oldID = state?.session?.id
                let newID = incoming.session?.id
                if oldID != newID {
                    if let oldID { drafts[oldID] = draft }
                    draft = newID.flatMap { drafts[$0] } ?? ""
                    exportPath = nil
                }
                if let pending = pendingSubmission, let session = incoming.session,
                   pending.sessionID == session.id, session.messages.count > pending.previousCount,
                   session.messages.dropFirst(pending.previousCount).contains(where: { $0.role == "user" && $0.content == pending.text }) {
                    if draft == pending.text { draft = ""; drafts[session.id] = "" }
                    pendingSubmission = nil; submitting = false
                }
                if incoming.busy { submitting = false }
                if !settingsPresented || awaitingSettingsReplacement { settings = incoming.settings }
                savingSettings = false
                awaitingSettingsReplacement = false
                approvalSubmitting = false
                state = incoming; notice = incoming.notice
            case "delta":
                guard event.sessionId == state?.session?.id, let messageID = event.messageId,
                      let index = state?.session?.messages.firstIndex(where: { $0.id == messageID }), let text = event.text else { return }
                let current = state?.session?.messages[index].content.utf8.count ?? 0
                guard current + text.utf8.count <= 4 * 1024 * 1024 else {
                    lastError = "单条消息超过本地显示上限，已请求取消"; cancelRun(); return
                }
                state?.session?.messages[index].content += text
            case "error":
                lastError = event.message ?? "Runtime 返回未知错误"
                submitting = false; savingSettings = false; pendingSubmission = nil
                awaitingSettingsReplacement = false
                approvalSubmitting = false
            case "export":
                guard let path = event.path, path.hasPrefix("/") else { throw ExampleError("导出结果缺少有效文件路径") }
                exportPath = path; notice = "会话已导出到本地 Markdown"
            default: throw ExampleError("不支持的 Runtime 事件")
            }
        } catch {
            lastError = "无法读取本地 Runtime 协议：\(error.localizedDescription)"
        }
    }

    @discardableResult private func send(_ command: [String: Any]) -> Bool {
        guard let runtime, connected else { lastError = "本地 Runtime 未连接"; return false }
        do { try runtime.send(command); return true }
        catch { lastError = error.localizedDescription; return false }
    }

    func startRun() {
        guard canSend, let session = state?.session else { return }
        draft = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        lastError = nil; submitting = true
        pendingSubmission = (session.id, draft, session.messages.count)
        if !send(["op": "run.start", "text": draft]) { submitting = false; pendingSubmission = nil }
    }

    func cancelRun() { if send(["op": "run.cancel"]) { notice = "已请求取消，等待当前操作结束…" } }
    func newSession() { guard !blocksNavigation else { return }; _ = send(["op": "session.new"]) }
    func selectSession(_ id: String) {
        guard !blocksNavigation, id != sessionID else { return }
        _ = send(["op": "session.select", "sessionId": id])
    }
    func exportSession() { _ = send(["op": "session.export"]) }
    func answerApproval(_ approval: AgentApproval, allow: Bool) {
        guard !approvalSubmitting else { return }
        approvalSubmitting = true
        if !send(["op": "approval.respond", "approvalId": approval.id, "allow": allow]) { approvalSubmitting = false }
    }

    func openSettings() {
        guard !blocksNavigation else { return }
        if let saved = state?.settings { settings = saved }
        apiKeyDraft = ""; settingsPresented = true
    }

    func saveSettings() {
        guard !blocksNavigation else { return }
        defer { apiKeyDraft = "" }
        do {
            let data = try JSONEncoder().encode(settings)
            guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ExampleError("配置编码失败") }
            savingSettings = true; awaitingSettingsReplacement = true; lastError = nil
            var command: [String: Any] = ["op": "settings.save", "settings": value]
            if !apiKeyDraft.isEmpty { command["apiKey"] = apiKeyDraft }
            if !send(command) { savingSettings = false; awaitingSettingsReplacement = false }
        } catch { savingSettings = false; awaitingSettingsReplacement = false; lastError = error.localizedDescription }
    }

    func clearKey() {
        guard !blocksNavigation else { return }
        apiKeyDraft = ""; savingSettings = true
        if !send(["op": "settings.save", "clearAPIKey": true]) { savingSettings = false }
    }

    func chooseWorkspace() {
        let panel = NSOpenPanel(); panel.canChooseFiles = false; panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false; panel.prompt = "选择工作区"
        if panel.runModal() == .OK, let url = panel.url { settings.workspace = url.path }
    }

    func chooseWhisperFile(isModel: Bool) {
        let panel = NSOpenPanel(); panel.canChooseFiles = true; panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false; panel.prompt = isModel ? "选择模型" : "选择 whisper-cli"
        if panel.runModal() == .OK, let url = panel.url {
            if isModel { settings.whisperModel = url.path } else { settings.whisperCLI = url.path }
        }
    }

    func chooseAudio() {
        guard !speechRunning else { return }
        let panel = NSOpenPanel(); panel.canChooseFiles = true; panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false; panel.prompt = "转写音频"
        if panel.runModal() == .OK, let url = panel.url { startSpeech(file: url.path) }
    }

    func startSpeech(file: String? = nil) {
        guard voice == nil, let settings = state?.settings else { return }
        let child = JSONLChild(), id = UUID()
        let executable = Bundle.main.bundleURL.appendingPathComponent("Contents/Helpers/NativeCapabilities.app/Contents/MacOS/native-capabilities")
        var arguments = ["speech", "--backend", settings.speechBackend, "--locale", "zh-CN"]
        if settings.speechBackend == "whisper" {
            if !settings.whisperCLI.isEmpty { arguments += ["--whisper-cli", settings.whisperCLI] }
            if !settings.whisperModel.isEmpty { arguments += ["--model", settings.whisperModel] }
        }
        if let file { arguments += ["--file", file] }
        voice = child; voiceID = id; voiceHadError = false; voiceCancelled = false
        speechRunning = true; speechState = "starting"; transcript = ""
        speechStatus = file == nil ? "正在准备语音…" : "正在准备音频转写…"
        do {
            try child.launch(executable: executable, arguments: arguments, onLine: { [weak self] data in
                guard let self, self.voiceID == id else { return }
                self.receiveVoice(data)
            }, onFailure: { [weak self] message in
                guard let self, self.voiceID == id else { return }
                self.voiceHadError = true; self.speechStatus = message
            }, onExit: { [weak self] status in
                guard let self, self.voiceID == id else { return }
                self.voice = nil; self.voiceID = nil; self.speechRunning = false; self.speechState = "stopped"
                if !self.voiceHadError {
                    self.speechStatus = self.voiceCancelled ? "语音已取消；已显示文本仅为未确认草稿" : (status == 0 ? "语音已结束，可确认转写并采用为草稿" : "语音进程退出（\(status)）")
                }
            })
        } catch {
            child.shutdown(); voice = nil; voiceID = nil; speechRunning = false; speechState = "stopped"
            speechStatus = error.localizedDescription
        }
    }

    private func receiveVoice(_ data: Data) {
        do {
            let event = try JSONDecoder().decode(VoiceEnvelope.self, from: data)
            switch event.type {
            case "speech.partial", "speech.final": transcript = event.text ?? ""
            case "speech.error": voiceHadError = true; speechStatus = event.message ?? "语音识别失败"
            case "speech.state":
                speechState = event.state ?? "stopped"
                guard !voiceHadError else { return }
                switch speechState {
                case "recording": speechStatus = "本地录音中 · 停止录音后 Whisper 开始转写"
                case "transcribing": speechStatus = "本地 Whisper 转写中 · 可取消"
                case "listening": speechStatus = "Apple Speech 正在识别"
                default: speechStatus = "语音已停止"
                }
            default: throw ExampleError("不支持的语音事件")
            }
        } catch { voiceHadError = true; speechStatus = "语音协议错误：\(error.localizedDescription)" }
    }

    func stopSpeech() {
        do { try voice?.sendLine("stop"); speechStatus = "正在结束录音，等待转写…" }
        catch { speechStatus = error.localizedDescription; voice?.shutdown() }
        // Keep stdin open: Whisper starts inference only after stop.
    }

    func cancelSpeech() {
        voiceCancelled = true
        try? voice?.sendLine("cancel")
        voice?.shutdown()
        speechStatus = "正在取消语音…"
    }

    func useTranscript() { guard !transcript.isEmpty else { return }; draft = transcript }
    func revealExport() { if let exportPath { NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: exportPath)]) } }

    func shutdown() {
        closing = true; apiKeyDraft = ""
        try? voice?.sendLine("cancel"); voice?.shutdown()
        try? runtime?.send(["op": "run.cancel"]); runtime?.shutdown()
    }
}

struct AgentWorkbenchView: View {
    @ObservedObject var model: AgentWorkbench
    var body: some View {
        HSplitView {
            VStack(alignment: .leading, spacing: 12) {
                HStack { Text("会话").font(.headline); Spacer(); Button { model.newSession() } label: { Image(systemName: "plus") }.disabled(!model.ready || model.blocksNavigation) }
                List(selection: Binding<String?>(get: { model.sessionID }, set: { if let id = $0 { model.selectSession(id) } })) {
                    ForEach(model.state?.sessions ?? []) { session in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(session.title).lineLimit(2)
                            Text(session.status).font(.caption2).foregroundStyle(.secondary)
                        }.padding(.vertical, 4).tag(session.id)
                    }
                }.listStyle(.sidebar).disabled(model.blocksNavigation)
                Text("SwiftUI · 本地 Harness\n会话由此路线独立保存").font(.caption).foregroundStyle(.secondary)
            }.padding(16).frame(minWidth: 195, idealWidth: 225, maxWidth: 285)

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.state?.session?.title ?? "Agent 工作台").font(.title2.weight(.semibold))
                        Text(model.notice).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    }
                    Spacer()
                    if !model.connected { Button("重新连接") { model.connect() } }
                    Button("导出会话") { model.exportSession() }.disabled(!model.ready || model.busy)
                    Button("设置") { model.openSettings() }.disabled(!model.ready || model.blocksNavigation)
                }
                if let error = model.lastError {
                    HStack(alignment: .top) { Text(error).foregroundStyle(.red).textSelection(.enabled); Spacer(); Button("关闭") { model.lastError = nil } }
                        .font(.caption).padding(10).background(.red.opacity(0.07)).clipShape(RoundedRectangle(cornerRadius: 8))
                }
                if model.state?.hasAPIKey == false {
                    Text("先在设置中保存 API Key、模型与工作区，再发送真实任务。").font(.caption).foregroundStyle(.secondary)
                }
                List(model.state?.session?.messages ?? []) { message in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(message.name ?? message.role.uppercased()).font(.caption.weight(.bold))
                                .foregroundStyle(message.role == "tool" ? .orange : .secondary)
                            Spacer(); Text(message.status).font(.caption2).foregroundStyle(.tertiary)
                        }
                        Text(message.content.isEmpty && message.status == "streaming" ? "等待模型输出…" : message.content)
                            .font(message.role == "tool" ? .system(size: 12, design: .monospaced) : .system(size: 14))
                            .textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                    }.padding(.vertical, 10)
                }.listStyle(.plain).border(Color.primary.opacity(0.10))

                if let approval = model.state?.session?.pendingApproval {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("允许工具写入这份笔记？").font(.headline)
                        Text("\(approval.tool) → \(approval.path)").font(.caption.monospaced()).textSelection(.enabled)
                        ScrollView { Text(approval.preview).font(.system(size: 12, design: .monospaced)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading).padding(10) }
                            .frame(minHeight: 95, maxHeight: 190).background(Color.primary.opacity(0.04))
                        HStack {
                            Text("以上为完整写入预览，可滚动查看。").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Button("拒绝") { model.answerApproval(approval, allow: false) }.disabled(model.approvalSubmitting || !model.connected)
                            Button("允许写入") { model.answerApproval(approval, allow: true) }.disabled(model.approvalSubmitting || !model.connected).buttonStyle(.borderedProminent)
                        }
                    }.padding(12).background(.orange.opacity(0.07)).clipShape(RoundedRectangle(cornerRadius: 9))
                }

                VStack(alignment: .leading, spacing: 8) {
                    TextEditor(text: $model.draft).font(.system(size: 14)).frame(minHeight: 72, maxHeight: 105)
                        .padding(5).overlay(RoundedRectangle(cornerRadius: 7).stroke(Color.primary.opacity(0.16)))
                    HStack {
                        if let usage = model.state?.session?.usage {
                            Text("\(usage.requests) 次请求 · \(usage.totalTokens) tokens\(usage.unreportedRequests > 0 ? " · \(usage.unreportedRequests) 次用量未知" : "")")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("取消任务") { model.cancelRun() }.disabled(!model.busy && !model.submitting)
                        Button("发送任务") { model.startRun() }.disabled(!model.canSend).buttonStyle(.borderedProminent)
                            .keyboardShortcut(.return, modifiers: .command)
                    }
                }
                VoiceControls(model: model)
                if let path = model.exportPath {
                    HStack { Text("已导出：\(path)").font(.caption2).lineLimit(1); Button("在 Finder 中显示") { model.revealExport() }.font(.caption) }
                }
            }.padding(20).frame(minWidth: 730, minHeight: 690)
        }.sheet(isPresented: $model.settingsPresented) { AgentSettingsView(model: model) }
    }
}

struct VoiceControls: View {
    @ObservedObject var model: AgentWorkbench
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(model.state?.settings.speechBackend == "whisper" ? "Whisper 本地语音" : "Apple 语音").font(.caption.weight(.semibold))
                Button("开始录音") { model.startSpeech() }.disabled(!model.ready || model.speechRunning)
                Button("音频文件…") { model.chooseAudio() }.disabled(!model.ready || model.speechRunning)
                if model.speechRunning {
                    if ["recording", "listening", "starting"].contains(model.speechState) {
                        Button("停止并转写") { model.stopSpeech() }
                    }
                    Button("取消语音") { model.cancelSpeech() }
                }
                Spacer()
                Button("将转写替换草稿") { model.useTranscript() }.disabled(model.transcript.isEmpty || model.speechRunning)
            }.font(.caption)
            Text(model.speechStatus).font(.caption2).foregroundStyle(.secondary).textSelection(.enabled)
            if !model.transcript.isEmpty {
                ScrollView { Text(model.transcript).font(.caption).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading) }
                    .frame(maxHeight: 75).padding(7).background(Color.primary.opacity(0.035))
            }
        }.padding(.top, 5)
    }
}

struct AgentSettingsView: View {
    @ObservedObject var model: AgentWorkbench
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("连接与本地能力").font(.title2.weight(.semibold))
            Form {
                Section("模型") {
                    TextField("API Base", text: $model.settings.apiBase)
                    TextField("模型名称", text: $model.settings.model)
                    SecureField("替换 API Key（留空保留现有）", text: $model.apiKeyDraft)
                    HStack {
                        Text(model.state?.hasAPIKey == true ? "凭据已配置；由 Runtime 读取 Keychain / 环境变量" : "尚未配置凭据")
                            .font(.caption).foregroundStyle(.secondary)
                        Spacer(); Button("清除保存的 Key") { model.clearKey() }.disabled(model.blocksNavigation)
                    }
                    Stepper("最大输出：\(model.settings.maxOutputTokens) tokens", value: $model.settings.maxOutputTokens, in: 256...32768, step: 256)
                    Stepper("工具循环上限：\(model.settings.maxRounds)", value: $model.settings.maxRounds, in: 1...12)
                }
                Section("工作区") {
                    HStack { TextField("本地工作目录", text: $model.settings.workspace); Button("选择…") { model.chooseWorkspace() } }
                    Text("目录范围与写入策略由 Runtime 再次校验；笔记写入需要你在会话中批准。").font(.caption).foregroundStyle(.secondary)
                }
                Section("语音") {
                    Picker("识别后端", selection: $model.settings.speechBackend) { Text("Apple Speech · 端侧").tag("apple"); Text("Whisper · 本地 CLI").tag("whisper") }
                    HStack { TextField("whisper-cli 绝对路径", text: $model.settings.whisperCLI); Button("选择…") { model.chooseWhisperFile(isModel: false) } }
                    HStack { TextField("Whisper 模型绝对路径", text: $model.settings.whisperModel); Button("选择…") { model.chooseWhisperFile(isModel: true) } }
                    Text("中文选择多语言 small 模型。Whisper 先录音后转写；本应用不会下载 CLI 或模型。保存后供下一次语音使用。")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }.formStyle(.grouped)
            if let error = model.lastError { Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
            HStack {
                Text("API Key 只作为瞬时输入发送，不写入 UI 的配置文件或日志。").font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Button("关闭") { model.apiKeyDraft = ""; model.settingsPresented = false }
                Button(model.savingSettings ? "保存中…" : "保存设置") { model.saveSettings() }.disabled(model.blocksNavigation)
                    .buttonStyle(.borderedProminent)
            }
        }.padding(22).frame(width: 700, height: 720)
            .onDisappear { model.apiKeyDraft = "" }
    }
}

struct RootWorkbenchView: View {
    @ObservedObject var agent: AgentWorkbench
    @ObservedObject var lab: Workbench
    var body: some View {
        TabView {
            AgentWorkbenchView(model: agent).tabItem { Label("Agent 工作台", systemImage: "bubble.left.and.bubble.right") }
            WorkbenchView(model: lab).tabItem { Label("回放与更新实验", systemImage: "waveform.path") }
        }.frame(minWidth: 1020, minHeight: 790)
    }
}
