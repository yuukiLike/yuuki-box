import Foundation
import AVFoundation
import Speech
import Darwin

// One JSON object per line. stdout is reserved for protocol events.
struct Event: Codable {
    var type: String
    var state: String? = nil
    var text: String? = nil
    var code: String? = nil
    var message: String? = nil
}

// A parent that closes its output pipe is no longer able to own this session.
var onProtocolDisconnect: (() -> Void)?

func emit(_ event: Event) {
    do {
        var data = try JSONEncoder().encode(event)
        data.append(0x0a)
        try FileHandle.standardOutput.write(contentsOf: data)
    } catch {
        if let onProtocolDisconnect { DispatchQueue.main.async(execute: onProtocolDisconnect) }
        else {
            try? FileHandle.standardError.write(contentsOf: Data("Cannot write protocol event: \(error)\n".utf8))
            exit(70)
        }
    }
}

struct Options {
    let command: String
    var locale = "zh-CN"
    var file: String?
    var allowNetwork = false
    var backend = "apple"
    var whisperCLI: String? = ProcessInfo.processInfo.environment["YUUKI_WHISPER_CLI"]
    var model: String? = ProcessInfo.processInfo.environment["YUUKI_WHISPER_MODEL"]

    init(_ args: [String]) throws {
        guard let command = args.first, ["speech", "probe", "--self-test"].contains(command) else {
            throw Failure("arguments", "Usage: native-capabilities probe | --self-test | speech [--backend apple|whisper] [--locale zh-CN] [--file PATH] [--whisper-cli PATH] [--model PATH] [--allow-network]")
        }
        self.command = command
        var index = 1
        while index < args.count {
            let flag = args[index]
            guard command == "speech" else { throw Failure("arguments", "\(command) does not accept options") }
            switch flag {
            case "--locale", "--file", "--backend", "--whisper-cli", "--model":
                guard index + 1 < args.count, !args[index + 1].hasPrefix("--"), !args[index + 1].isEmpty else {
                    throw Failure("arguments", "Missing value for \(flag)")
                }
                index += 1
                switch flag {
                case "--locale": locale = args[index]
                case "--file": file = args[index]
                case "--backend": backend = args[index]
                case "--whisper-cli": whisperCLI = args[index]
                default: model = args[index]
                }
            case "--allow-network": allowNetwork = true
            default: throw Failure("arguments", "Unknown option: \(flag)")
            }
            index += 1
        }
        guard ["apple", "whisper"].contains(backend) else { throw Failure("arguments", "--backend must be apple or whisper") }
        guard backend != "whisper" || !allowNetwork else { throw Failure("arguments", "--allow-network applies only to the Apple backend; Whisper uses local files and never falls back to a network service") }
    }
}

struct Failure: Error {
    let code: String
    let message: String
    init(_ code: String, _ message: String) { self.code = code; self.message = message }
}

final class SpeechSession {
    let options: Options
    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var signals: [DispatchSourceSignal] = []
    private var tapInstalled = false
    private var finished = false
    private var stopping = false
    private var lastText = ""
    private var emittedFinal = false

    init(_ options: Options) { self.options = options }

    func start() {
        onProtocolDisconnect = { [weak self] in self?.cancel() }
        for number in [SIGTERM, SIGINT] {
            signal(number, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: number, queue: .main)
            source.setEventHandler { [weak self] in self?.cancel() }
            source.resume()
            signals.append(source)
        }
        // A dedicated reader cannot block the main run loop or audio callbacks.
        DispatchQueue.global().async { [weak self] in
            while let line = readLine() {
                let command = line.trimmingCharacters(in: .whitespacesAndNewlines)
                if command == "stop" {
                    DispatchQueue.main.async { self?.stop() }
                } else if command == "cancel" {
                    DispatchQueue.main.async { self?.cancel() }
                    return
                }
            }
            // EOF also means the owning UI disconnected; do not keep recording.
            DispatchQueue.main.async { self?.cancel() }
        }
        if let file = options.file, !FileManager.default.isReadableFile(atPath: file) {
            fail("file_unreadable", "Cannot read audio file: \(file)")
            return
        }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: options.locale)) else {
            fail("locale_unsupported", "Speech recognizer unavailable for \(options.locale)")
            return
        }
        self.recognizer = recognizer
        guard options.allowNetwork || recognizer.supportsOnDeviceRecognition else {
            fail("on_device_unavailable", "On-device recognition is unavailable for \(options.locale). No network fallback was used. Check system language/model availability; use --allow-network only if you intend to allow Apple network recognition.")
            return
        }
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self, !self.finished, !self.stopping else { return }
                guard status == .authorized else {
                    self.fail("speech_permission", "Speech recognition permission denied or restricted (status \(status.rawValue)). Check System Settings → Privacy & Security → Speech Recognition.")
                    return
                }
                if self.options.file != nil { self.recognize() } else { self.requestMicrophone() }
            }
        }
    }

    private func requestMicrophone() {
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] allowed in
            DispatchQueue.main.async {
                guard let self, !self.finished, !self.stopping else { return }
                guard allowed else {
                    self.fail("microphone_permission", "Microphone permission denied. Check System Settings → Privacy & Security → Microphone.")
                    return
                }
                self.recognize()
            }
        }
    }

    private func recognize() {
        guard let recognizer, recognizer.isAvailable else {
            fail("recognizer_unavailable", "Speech recognition is currently unavailable.")
            return
        }
        let recognitionRequest: SFSpeechRecognitionRequest
        if let file = options.file {
            recognitionRequest = SFSpeechURLRecognitionRequest(url: URL(fileURLWithPath: file))
        } else {
            let audioRequest = SFSpeechAudioBufferRecognitionRequest()
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                fail("audio_input_unavailable", "No usable microphone input format.")
                return
            }
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in audioRequest.append(buffer) }
            tapInstalled = true
            recognitionRequest = audioRequest
        }
        recognitionRequest.requiresOnDeviceRecognition = !options.allowNetwork
        recognitionRequest.shouldReportPartialResults = true
        request = recognitionRequest
        task = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, !self.finished else { return }
                if let result {
                    self.lastText = result.bestTranscription.formattedString
                    emit(Event(type: result.isFinal ? "speech.final" : "speech.partial", text: self.lastText))
                    if result.isFinal { self.emittedFinal = true; self.finish(0); return }
                }
                if let error {
                    if self.stopping { self.finish(0) }
                    else { self.fail("recognition_failed", error.localizedDescription) }
                }
            }
        }
        if options.file == nil {
            do { engine.prepare(); try engine.start() }
            catch { fail("audio_start_failed", error.localizedDescription); return }
        }
        emit(Event(type: "speech.state", state: "listening"))
    }

    func stop() {
        guard !finished, !stopping else { return }
        stopping = true
        engine.stop()
        (request as? SFSpeechAudioBufferRecognitionRequest)?.endAudio()
        // Give a microphone request a bounded chance to emit its final result.
        if task == nil || options.file != nil { finish(0); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in self?.finish(0) }
    }

    func cancel() {
        // A disconnected owner must not receive a draft as a completed result.
        emittedFinal = true
        finish(0)
    }

    private func fail(_ code: String, _ message: String) {
        emit(Event(type: "speech.error", code: code, message: message))
        finish(1)
    }

    private func finish(_ status: Int32) {
        guard !finished else { return }
        finished = true
        engine.stop()
        if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        (request as? SFSpeechAudioBufferRecognitionRequest)?.endAudio()
        task?.cancel()
        if status == 0, !emittedFinal, !lastText.isEmpty { emit(Event(type: "speech.final", text: lastText)) }
        emit(Event(type: "speech.state", state: "stopped"))
        exit(status)
    }
}

func selfTest() throws {
    let options = try Options(["speech", "--locale", "en-US", "--file", "/tmp/audio.wav", "--allow-network"])
    guard options.locale == "en-US", options.file == "/tmp/audio.wav", options.allowNetwork else { throw Failure("self_test", "Option parsing failed") }
    for invalid in [[], ["speech", "--file"], ["probe", "--allow-network"], ["speech", "--unknown"]] {
        do { _ = try Options(invalid); throw Failure("self_test", "Invalid arguments accepted") }
        catch let failure as Failure where failure.code == "arguments" { }
    }
    let event = Event(type: "speech.partial", text: "第一行\n第二行\"引号\"")
    let encoded = try JSONEncoder().encode(event)
    let decoded = try JSONDecoder().decode(Event.self, from: encoded)
    guard decoded.text == event.text, !encoded.contains(0x0a) else { throw Failure("self_test", "JSONL encoding failed") }
    emit(Event(type: "self-test", state: "passed", message: "Argument validation and JSONL roundtrip passed; no permissions requested."))
}

signal(SIGPIPE, SIG_IGN)
do {
    let options = try Options(Array(CommandLine.arguments.dropFirst()))
    switch options.command {
    case "--self-test": try selfTest()
    case "probe":
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
        let result: [String: Any] = [
            "type": "speech.capabilities", "locale": "zh-CN",
            "supportsOnDeviceRecognition": recognizer?.supportsOnDeviceRecognition ?? false,
            "available": recognizer?.isAvailable ?? false,
            "speechAuthorization": SFSpeechRecognizer.authorizationStatus().rawValue,
            "microphoneAuthorization": AVCaptureDevice.authorizationStatus(for: .audio).rawValue,
            "permissionsRequested": false
        ]
        var data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]); data.append(0x0a)
        FileHandle.standardOutput.write(data)
    default:
        if options.backend == "whisper" {
            let session = WhisperSession(options)
            session.start()
            withExtendedLifetime(session) { RunLoop.main.run() }
        } else {
            let session = SpeechSession(options)
            session.start()
            withExtendedLifetime(session) { RunLoop.main.run() }
        }
    }
} catch let error as Failure {
    emit(Event(type: "speech.error", code: error.code, message: error.message)); exit(2)
} catch {
    emit(Event(type: "speech.error", code: "unexpected", message: error.localizedDescription)); exit(1)
}
