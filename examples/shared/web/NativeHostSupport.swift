import Foundation
import AppKit

// Shared Swift shell capabilities. Speech arguments come from saved settings;
// executable selection is delegated to the fixed helper, not a shell channel.
final class NativeCapabilities {
    private var speechProcess: Process?
    private var speechInput: FileHandle?
    private var speechOutput: FileHandle?
    private var speechBuffer = Data()
    var onEvent: (([String: Any]) -> Void)?
    var settings: [String: Any] = [:]
    let resources: URL

    init(resources: URL) { self.resources = resources }

    func handle(_ command: [String: Any]) {
        guard let type = command["type"] as? String else { return }
        switch type {
        case "update.check":
            guard Set(command.keys) == ["type"] else { return }
            let scenario = ProcessInfo.processInfo.environment["YUUKI_UPDATE_FIXTURE"] ?? "available"
            let manifests = ["available": "update.json", "current": "update-current.json", "invalid": "update-invalid.json"]
            guard let filename = manifests[scenario] else {
                onEvent?(["type": "update.error", "message": "未知 YUUKI_UPDATE_FIXTURE；仅允许 available、current 或 invalid。"])
                return
            }
            do {
                let data = try Data(contentsOf: resources.appendingPathComponent(filename))
                guard data.count <= 64_000,
                      let manifest = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    throw NSError(domain: "Yuuki", code: 1, userInfo: [NSLocalizedDescriptionKey: "清单不是合法 JSON 对象"])
                }
                onEvent?(["type": "update.result", "manifest": manifest])
            } catch { onEvent?(["type": "update.error", "message": error.localizedDescription]) }
        case "speech.start":
            guard Set(command.keys).isSubset(of: ["type", "locale", "file"]), command["locale"] as? String == "zh-CN" else { rejectSpeech("无效语音参数。"); return }
            if let raw = command["file"], !(raw is String) { rejectSpeech("音频文件路径必须是文本。"); return }
            let file = command["file"] as? String
            guard file == nil || (file!.utf8.count <= 4096 && !file!.contains("\0")) else { rejectSpeech("音频文件路径过长或包含无效字符。"); return }
            startSpeech(file: file)
        case "speech.stop":
            guard Set(command.keys) == ["type"] else { return }
            stopSpeech()
        case "speech.cancel":
            guard Set(command.keys) == ["type"] else { return }
            try? speechInput?.write(contentsOf: Data("cancel\n".utf8))
        default: break
        }
    }

    private func rejectSpeech(_ message: String) {
        onEvent?(["type": "speech.error", "code": "arguments", "message": message])
        if speechProcess == nil { onEvent?(["type": "speech.closed"]) }
    }

    private func startSpeech(file: String?) {
        guard speechProcess == nil else { onEvent?(["type": "speech.error", "code": "busy", "message": "前一次语音尚未退出，请稍候。"]); return }
        let executable = resources.appendingPathComponent("NativeCapabilities.app/Contents/MacOS/native-capabilities")
        guard FileManager.default.isExecutableFile(atPath: executable.path) else {
            onEvent?(["type": "speech.error", "code": "helper_missing", "message": "打包的语音 helper 不存在；重新运行 build.sh。"])
            onEvent?(["type": "speech.closed"])
            return
        }
        let process = Process()
        let input = Pipe(), output = Pipe()
        process.executableURL = executable
        var environment = ProcessInfo.processInfo.environment
        environment.removeValue(forKey: "DEEPSEEK_API_KEY")
        process.environment = environment
        let backend = settings["speechBackend"] as? String ?? "apple"
        guard ["apple", "whisper"].contains(backend) else { onEvent?(["type": "speech.error", "code": "configuration", "message": "未知语音后端"]); onEvent?(["type": "speech.closed"]); return }
        var arguments = ["speech", "--locale", "zh-CN", "--backend", backend]
        if backend == "whisper" {
            arguments += ["--whisper-cli", settings["whisperCLI"] as? String ?? "", "--model", settings["whisperModel"] as? String ?? ""]
        }
        if let file, !file.isEmpty { arguments += ["--file", file] }
        process.arguments = arguments
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.standardError
        speechBuffer = Data()
        speechInput = input.fileHandleForWriting
        speechOutput = output.fileHandleForReading
        speechProcess = process
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receiveSpeech(data) }
        }
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self, self.speechProcess === process else { return }
                self.speechOutput?.readabilityHandler = nil
                self.speechOutput = nil
                self.speechInput = nil
                self.speechProcess = nil
                if process.terminationStatus != 0 {
                    self.onEvent?(["type": "speech.error", "code": "helper_exit", "message": "语音 helper 退出 (\(process.terminationStatus))；检查系统权限与设备端语言可用性。"])
                }
                self.onEvent?(["type": "speech.closed"])
            }
        }
        do { try process.run() }
        catch {
            output.fileHandleForReading.readabilityHandler = nil
            speechProcess = nil; speechInput = nil; speechOutput = nil
            onEvent?(["type": "speech.error", "code": "launch_failed", "message": error.localizedDescription])
            onEvent?(["type": "speech.closed"])
        }
    }

    private func receiveSpeech(_ data: Data) {
        guard !data.isEmpty else { return }
        speechBuffer.append(data)
        guard speechBuffer.count <= 1_000_000 else {
            speechBuffer.removeAll()
            try? speechInput?.write(contentsOf: Data("cancel\n".utf8))
            onEvent?(["type": "speech.error", "code": "invalid_output", "message": "helper 响应超过长度限制"])
            return
        }
        while let newline = speechBuffer.firstIndex(of: 10) {
            let line = speechBuffer.prefix(upTo: newline)
            speechBuffer.removeSubrange(...newline)
            guard let event = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  let type = event["type"] as? String,
                  ["speech.state", "speech.partial", "speech.final", "speech.error"].contains(type) else { continue }
            onEvent?(event)
        }
    }

    func stopSpeech() {
        guard speechProcess != nil else { return }
        try? speechInput?.write(contentsOf: Data("stop\n".utf8))
        // Whisper needs time to transcribe after stop. Cancellation is separate.
    }

    func shutdown() {
        speechOutput?.readabilityHandler = nil
        try? speechInput?.write(contentsOf: Data("cancel\n".utf8))
        try? speechInput?.close()
        if let process = speechProcess, process.isRunning { process.terminate() }
        speechProcess = nil
        speechInput = nil
        speechOutput = nil
    }
}

func installMenu(title: String) {
    let menu = NSMenu()
    let appItem = NSMenuItem()
    menu.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "退出 \(title)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu
    let editItem = NSMenuItem()
    menu.addItem(editItem)
    let edit = NSMenu(title: "编辑")
    edit.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit
    NSApp.mainMenu = menu
}
