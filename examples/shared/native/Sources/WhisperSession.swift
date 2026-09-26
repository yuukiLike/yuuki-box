import Foundation
import AVFoundation
import Darwin

// Conversion runs off the main thread so stdin cancellation remains responsive.
private final class CancellationFlag {
    private let lock = NSLock()
    private var value = false
    func cancel() { lock.lock(); value = true; lock.unlock() }
    var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return value }
}

// Retain a small diagnostic tail while bounding total child-process output.
private final class BoundedCapture {
    private let lock = NSLock()
    private var tail = Data()
    private var count = 0
    private var overflowReported = false
    func append(_ data: Data) -> Bool {
        lock.lock(); defer { lock.unlock() }
        count += data.count
        tail.append(data)
        if tail.count > 16384 { tail.removeFirst(tail.count - 16384) }
        if count > 524288, !overflowReported { overflowReported = true; return true }
        return false
    }
    var text: String {
        lock.lock(); defer { lock.unlock() }
        return String(decoding: tail, as: UTF8.self)
    }
}

final class WhisperSession: NSObject, AVAudioRecorderDelegate {
    private enum Phase { case preparing, recording, normalizing, transcribing, finished }
    private let options: Options
    private var phase = Phase.preparing
    private var signals: [DispatchSourceSignal] = []
    private var cliURL: URL?
    private var modelURL: URL?
    private var language = "zh"
    private var temporaryDirectory: URL?
    private var recorder: AVAudioRecorder?
    private var recordingLimit: DispatchWorkItem?
    private var inferenceLimit: DispatchWorkItem?
    private var conversionInProgress = false
    private let cancellation = CancellationFlag()
    private var worker: Process?
    private var workerOutput: Pipe?
    private var workerError: Pipe?
    private let stdoutCapture = BoundedCapture()
    private let stderrCapture = BoundedCapture()
    private var pendingExit: Int32?

    init(_ options: Options) { self.options = options }

    func start() {
        onProtocolDisconnect = { [weak self] in self?.cancel() }
        installControls()
        do {
            // Validate configuration before requesting microphone access.
            cliURL = try configuredFile(options.whisperCLI, name: "whisper-cli", executable: true)
            modelURL = try configuredFile(options.model, name: "model", executable: false)
            let requested = options.locale.lowercased().split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init) ?? ""
            guard requested == "auto" || (2...3).contains(requested.count) && requested.utf8.allSatisfy({ (97...122).contains($0) }) else {
                throw Failure("whisper_locale", "Use a locale such as zh-CN, en-US, or auto; it is mapped to whisper-cli's language code.")
            }
            language = requested
            if let name = modelURL?.lastPathComponent.lowercased(), name.contains(".en."), language != "en", language != "auto" {
                throw Failure("whisper_model_language", "The selected .en model is English-only. Select a multilingual model such as ggml-small.bin for \(options.locale).")
            }
            if let file = options.file { try validateAudioFile(URL(fileURLWithPath: file)) }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("yuuki-whisper-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
            temporaryDirectory = directory
            if let file = options.file { normalizeAndTranscribe(URL(fileURLWithPath: file)) }
            else { requestMicrophone() }
        } catch let error as Failure { fail(error.code, error.message) }
        catch { fail("whisper_setup", error.localizedDescription) }
    }

    private func configuredFile(_ path: String?, name: String, executable: Bool) throws -> URL {
        let flag = name == "model" ? "--model / YUUKI_WHISPER_MODEL" : "--whisper-cli / YUUKI_WHISPER_CLI"
        guard let path, !path.isEmpty else {
            throw Failure("whisper_configuration", "Missing \(name). Set \(flag) to an existing local file. Nothing will be downloaded.")
        }
        guard path.hasPrefix("/") else { throw Failure("whisper_path", "\(name) must be an absolute path; shell expressions and ~ are not expanded.") }
        let url = URL(fileURLWithPath: path).resolvingSymlinksInPath()
        guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey]), values.isRegularFile == true else {
            throw Failure("whisper_path", "\(name) is not an existing regular file: \(path)")
        }
        guard FileManager.default.isReadableFile(atPath: url.path), !executable || FileManager.default.isExecutableFile(atPath: url.path) else {
            throw Failure("whisper_path", "\(name) is not readable\(executable ? " and executable" : ""): \(path)")
        }
        return url
    }

    private func installControls() {
        for number in [SIGTERM, SIGINT] {
            signal(number, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: number, queue: .main)
            source.setEventHandler { [weak self] in self?.cancel() }
            source.resume(); signals.append(source)
        }
        DispatchQueue.global().async { [weak self] in
            while let line = readLine() {
                switch line.trimmingCharacters(in: .whitespacesAndNewlines) {
                case "stop": DispatchQueue.main.async { self?.stop() }
                case "cancel": DispatchQueue.main.async { self?.cancel() }; return
                default: break
                }
            }
            // Closing the owning UI must never start expensive inference.
            DispatchQueue.main.async { self?.cancel() }
        }
    }

    private func requestMicrophone() {
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] allowed in
            DispatchQueue.main.async {
                guard let self, self.pendingExit == nil, self.phase == .preparing else { return }
                guard allowed else { self.fail("microphone_permission", "Microphone permission denied. Check System Settings → Privacy & Security → Microphone."); return }
                self.beginRecording()
            }
        }
    }

    private func beginRecording() {
        guard let directory = temporaryDirectory else { fail("whisper_setup", "Temporary audio directory is missing."); return }
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16000.0,
            AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false
        ]
        do {
            let recorder = try AVAudioRecorder(url: directory.appendingPathComponent("recording.wav"), settings: settings)
            recorder.delegate = self
            guard recorder.prepareToRecord(), recorder.record() else { throw Failure("audio_start_failed", "Could not start microphone recording.") }
            self.recorder = recorder
            phase = .recording
            emit(Event(type: "speech.state", state: "recording", message: "Whisper records locally, then transcribes when stopped. Recording limit: 120 seconds."))
            let limit = DispatchWorkItem { [weak self] in
                guard let self, self.phase == .recording else { return }
                self.stop()
            }
            recordingLimit = limit
            DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: limit)
        } catch let error as Failure { fail(error.code, error.message) }
        catch { fail("audio_start_failed", error.localizedDescription) }
    }

    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        DispatchQueue.main.async { [weak self] in self?.fail("audio_recording_failed", error?.localizedDescription ?? "Audio recording failed.") }
    }

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        guard phase == .recording, pendingExit == nil else { return }
        fail("audio_recording_interrupted", "Microphone recording ended unexpectedly\(flag ? "" : " with an audio error"). Start a new recording.")
    }

    func stop() {
        guard pendingExit == nil, phase != .finished else { return }
        guard phase == .recording, let recorder else {
            if phase == .preparing { cancel() }
            // An additional stop does not launch another transcription.
            return
        }
        let duration = recorder.currentTime
        phase = .normalizing
        recordingLimit?.cancel(); recordingLimit = nil
        recorder.stop(); self.recorder = nil
        guard duration >= 0.15 else { fail("audio_too_short", "Recording is too short to transcribe. Record at least 150 ms."); return }
        normalizeAndTranscribe(recorder.url)
    }

    func cancel() { finish(0) }

    private func validateAudioFile(_ url: URL) throws {
        guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]), values.isRegularFile == true,
              FileManager.default.isReadableFile(atPath: url.path) else { throw Failure("file_unreadable", "Cannot read audio file: \(url.path)") }
        guard (values.fileSize ?? 0) > 0, (values.fileSize ?? 0) <= 268435456 else {
            throw Failure("audio_size_limit", "Audio input must be nonempty and no larger than 256 MiB.")
        }
    }

    private func normalizeAndTranscribe(_ input: URL) {
        guard pendingExit == nil, let directory = temporaryDirectory else { return }
        phase = .normalizing; conversionInProgress = true
        emit(Event(type: "speech.state", state: "transcribing", message: "Preparing 16 kHz mono PCM audio, then running the local whisper-cli."))
        let output = directory.appendingPathComponent("input.wav")
        let cancellation = self.cancellation
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let result: Result<Void, Error>
            do { try Self.normalize(input, to: output, cancellation: cancellation); result = .success(()) }
            catch { result = .failure(error) }
            DispatchQueue.main.async {
                guard let self else { return }
                self.conversionInProgress = false
                if let status = self.pendingExit { self.finish(status); return }
                switch result {
                case .success: self.launchWhisper(output)
                case .failure(let error as Failure): self.fail(error.code, error.message)
                case .failure(let error): self.fail("audio_conversion_failed", "Cannot decode or convert this audio with AVFoundation: \(error.localizedDescription)")
                }
            }
        }
    }

    private static func normalize(_ inputURL: URL, to outputURL: URL, cancellation: CancellationFlag) throws {
        let file = try AVAudioFile(forReading: inputURL)
        let format = file.processingFormat
        let duration = Double(file.length) / format.sampleRate
        guard duration.isFinite, duration > 0, duration <= 600, (1...8).contains(format.channelCount) else {
            throw Failure("audio_duration_limit", "Audio must have 1–8 channels and a duration greater than zero and no longer than 10 minutes.")
        }
        guard let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16000, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: format, to: target),
              let input = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4096),
              let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: 4096) else {
            throw Failure("audio_conversion_failed", "Cannot create a 16 kHz mono audio converter for this input.")
        }
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16000.0, AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false
        ]
        let destination = try AVAudioFile(forWriting: outputURL, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        let deadline = Date().addingTimeInterval(45)
        var inputEnded = false
        var inputError: Error?
        var written: AVAudioFramePosition = 0
        while true {
            if cancellation.isCancelled { throw Failure("cancelled", "Audio conversion was cancelled.") }
            guard Date() < deadline else { throw Failure("audio_conversion_timeout", "Audio normalization exceeded 45 seconds.") }
            output.frameLength = 0
            var conversionError: NSError?
            let status = converter.convert(to: output, error: &conversionError) { requested, status in
                if inputEnded { status.pointee = .endOfStream; return nil }
                do {
                    try file.read(into: input, frameCount: min(requested, input.frameCapacity))
                    if input.frameLength == 0 { inputEnded = true; status.pointee = .endOfStream; return nil }
                    status.pointee = .haveData; return input
                } catch { inputError = error; inputEnded = true; status.pointee = .endOfStream; return nil }
            }
            if let inputError { throw inputError }
            if let conversionError { throw conversionError }
            if output.frameLength > 0 {
                written += AVAudioFramePosition(output.frameLength)
                guard written <= 16000 * 600 else { throw Failure("audio_duration_limit", "Decoded audio exceeds 10 minutes.") }
                try destination.write(from: output)
            }
            switch status {
            case .endOfStream:
                guard written > 0 else { throw Failure("audio_empty", "The input contains no decoded audio samples.") }
                return
            case .error: throw Failure("audio_conversion_failed", "Audio converter returned an error.")
            case .haveData, .inputRanDry: continue
            @unknown default: throw Failure("audio_conversion_failed", "Unknown audio converter result.")
            }
        }
    }

    private func launchWhisper(_ audio: URL) {
        guard pendingExit == nil, let cliURL, let modelURL, let directory = temporaryDirectory else { return }
        let process = Process(), output = Pipe(), error = Pipe()
        process.executableURL = cliURL
        process.arguments = ["-m", modelURL.path, "-f", audio.path, "-l", language, "-otxt", "-of", directory.appendingPathComponent("transcript").path]
        process.currentDirectoryURL = directory
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = output; process.standardError = error
        worker = process; workerOutput = output; workerError = error
        phase = .transcribing
        capture(output, into: stdoutCapture)
        capture(error, into: stderrCapture)
        process.terminationHandler = { [weak self] child in DispatchQueue.main.async { self?.workerFinished(child) } }
        do { try process.run() }
        catch { fail("whisper_launch_failed", "Cannot launch whisper-cli: \(error.localizedDescription)"); return }
        let limit = DispatchWorkItem { [weak self] in self?.fail("whisper_timeout", "Local transcription exceeded the 10 minute limit.") }
        inferenceLimit = limit
        DispatchQueue.main.asyncAfter(deadline: .now() + 600, execute: limit)
    }

    private func capture(_ pipe: Pipe, into buffer: BoundedCapture) {
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            if buffer.append(data) {
                DispatchQueue.main.async { self?.fail("whisper_output_limit", "whisper-cli exceeded the 512 KiB limit for stdout or stderr.") }
            }
        }
    }

    private func workerFinished(_ process: Process) {
        guard worker === process, phase != .finished else { return }
        inferenceLimit?.cancel(); inferenceLimit = nil
        if let status = pendingExit { finish(status); return }
        guard process.terminationReason == .exit, process.terminationStatus == 0 else {
            let detail = stderrCapture.text.trimmingCharacters(in: .whitespacesAndNewlines)
            fail("whisper_failed", "whisper-cli exited with status \(process.terminationStatus). \(detail)")
            return
        }
        do {
            guard let directory = temporaryDirectory else { throw Failure("whisper_output_missing", "Temporary transcript directory is missing.") }
            let url = directory.appendingPathComponent("transcript.txt")
            guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]), values.isRegularFile == true else {
                throw Failure("whisper_output_missing", "whisper-cli did not produce transcript.txt. Check that this executable supports -otxt and -of.")
            }
            guard (values.fileSize ?? 0) <= 1048576 else { throw Failure("whisper_output_limit", "Transcript exceeds 1 MiB.") }
            let data = try Data(contentsOf: url)
            guard let text = String(data: data, encoding: .utf8) else { throw Failure("whisper_output_encoding", "Transcript is not valid UTF-8.") }
            emit(Event(type: "speech.final", text: text.trimmingCharacters(in: .whitespacesAndNewlines)))
            finish(0)
        } catch let error as Failure { fail(error.code, error.message) }
        catch { fail("whisper_output_failed", error.localizedDescription) }
    }

    private func fail(_ code: String, _ message: String) {
        guard pendingExit == nil, phase != .finished else { return }
        emit(Event(type: "speech.error", code: code, message: message))
        finish(1)
    }

    private func finish(_ status: Int32) {
        guard phase != .finished else { return }
        pendingExit = pendingExit ?? status
        cancellation.cancel()
        recordingLimit?.cancel(); recordingLimit = nil
        inferenceLimit?.cancel(); inferenceLimit = nil
        recorder?.stop(); recorder = nil
        if conversionInProgress { return } // Conversion acknowledges cancellation before its files are removed.
        if let worker, worker.isRunning {
            worker.terminate()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                guard let self, self.worker === worker, worker.isRunning else { return }
                kill(worker.processIdentifier, SIGKILL)
            }
            return
        }
        phase = .finished
        workerOutput?.fileHandleForReading.readabilityHandler = nil
        workerError?.fileHandleForReading.readabilityHandler = nil
        var exitStatus = pendingExit ?? status
        if let directory = temporaryDirectory {
            do { try FileManager.default.removeItem(at: directory) }
            catch {
                emit(Event(type: "speech.error", code: "temporary_cleanup_failed", message: "Could not remove temporary speech files at \(directory.path): \(error.localizedDescription)"))
                exitStatus = 1
            }
        }
        emit(Event(type: "speech.state", state: "stopped"))
        exit(exitStatus)
    }
}
