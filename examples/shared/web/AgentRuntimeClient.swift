import Foundation
import CoreFoundation

// Fixed executable + allowlisted protocol. Renderers never submit shell commands.
final class AgentRuntimeClient {
    private var process: Process?
    private var input: FileHandle?
    private var output: FileHandle?
    private var buffer = Data()
    private var stopping = false
    var onEvent: (([String: Any]) -> Void)?
    private let resources: URL
    private let route: String

    init(resources: URL, route: String) { self.resources = resources; self.route = route }

    func start() {
        guard process == nil else { return }
        let executable = resources.appendingPathComponent("AgentRuntime.app/Contents/MacOS/agent-runtime")
        guard FileManager.default.isExecutableFile(atPath: executable.path) else { fail("Agent runtime 缺失，请重新构建应用。"); return }
        let child = Process(), stdin = Pipe(), stdout = Pipe()
        child.executableURL = executable
        child.arguments = ["serve", "--route", route]
        child.standardInput = stdin
        child.standardOutput = stdout
        child.standardError = FileHandle.nullDevice
        input = stdin.fileHandleForWriting
        output = stdout.fileHandleForReading
        process = child
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receive(data) }
        }
        child.terminationHandler = { [weak self] child in
            DispatchQueue.main.async {
                guard let self, self.process === child else { return }
                self.output?.readabilityHandler = nil
                self.output = nil; self.input = nil; self.process = nil
                if !self.stopping { self.fail("Agent runtime 已退出 (\(child.terminationStatus))。重新打开应用后可恢复已保存会话。") }
            }
        }
        do { try child.run(); send(["op": "bootstrap"]) }
        catch { process = nil; input = nil; output?.readabilityHandler = nil; output = nil; fail("无法启动 Agent runtime：\(error.localizedDescription)") }
    }

    func send(_ command: [String: Any]) {
        guard valid(command), let data = try? JSONSerialization.data(withJSONObject: command), data.count <= 131_072 else { fail("拒绝无效的 Agent 操作或参数。"); return }
        guard let process, process.isRunning, let input else { fail("Agent runtime 未连接，请重新打开应用。"); return }
        do { try input.write(contentsOf: data + Data([10])) }
        catch { fail("Agent runtime 连接已中断。") }
    }

    private func valid(_ command: [String: Any]) -> Bool {
        guard let op = command["op"] as? String else { return false }
        let keys = Set(command.keys)
        switch op {
        case "bootstrap", "session.new", "session.export", "run.cancel": return keys == ["op"]
        case "session.select": return keys == ["op", "sessionId"] && bounded(command["sessionId"], limit: 128)
        case "run.start": return keys == ["op", "text"] && bounded(command["text"], limit: 32_000)
        case "approval.respond": return keys == ["op", "approvalId", "allow"] && bounded(command["approvalId"], limit: 128) && isBoolean(command["allow"])
        case "settings.save":
            guard keys.isSubset(of: ["op", "settings", "apiKey", "clearAPIKey"]) else { return false }
            if let key = command["apiKey"], !bounded(key, limit: 8192, allowEmpty: true) { return false }
            if let clear = command["clearAPIKey"], !isBoolean(clear) { return false }
            if let raw = command["settings"] {
                guard let settings = raw as? [String: Any], Set(settings.keys).isSubset(of: ["apiBase", "model", "maxOutputTokens", "maxRounds", "workspace", "speechBackend", "whisperCLI", "whisperModel"]) else { return false }
                for (key, value) in settings {
                    if key == "maxOutputTokens" || key == "maxRounds" {
                        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.rounded() == number.doubleValue, number.intValue > 0 else { return false }
                    } else if !bounded(value, limit: 4096, allowEmpty: true) { return false }
                }
            }
            return true
        default: return false
        }
    }

    private func bounded(_ value: Any?, limit: Int, allowEmpty: Bool = false) -> Bool {
        guard let text = value as? String else { return false }
        return (allowEmpty || !text.isEmpty) && text.utf8.count <= limit && !text.contains("\0")
    }
    private func isBoolean(_ value: Any?) -> Bool {
        guard let value = value as? NSNumber else { return false }
        return CFGetTypeID(value) == CFBooleanGetTypeID()
    }
    private func receive(_ data: Data) {
        buffer.append(data)
        while let end = buffer.firstIndex(of: 10) {
            let line = buffer.prefix(upTo: end)
            buffer.removeSubrange(...end)
            guard line.count <= 2_097_152,
                  let event = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  let type = event["type"] as? String,
                  ["state", "delta", "error", "export"].contains(type) else { fail("Agent runtime 返回了无效响应。"); shutdown(); return }
            onEvent?(event)
        }
        if buffer.count > 2_097_152 { fail("Agent runtime 响应超过 2 MiB 限制。"); shutdown() }
    }
    private func fail(_ message: String) { onEvent?(["type": "error", "message": message]) }
    func shutdown() {
        stopping = true
        try? input?.write(contentsOf: Data("{\"op\":\"run.cancel\"}\n".utf8))
        try? input?.close()
        input = nil
        output?.readabilityHandler = nil
        if let child = process {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { if child.isRunning { child.terminate() } }
        }
    }
}
