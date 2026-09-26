import Foundation
import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private let resources = Bundle.main.resourceURL!
    private lazy var capabilities = NativeCapabilities(resources: resources)
    private lazy var runtime = AgentRuntimeClient(resources: resources, route: "webview")
    private var entry: URL { resources.appendingPathComponent("web/index.html").standardizedFileURL }

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu(title: "Yuuki React WebView")
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.userContentController.add(self, name: "yuuki")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isInspectable = true
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1060, height: 880), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Yuuki · React + WKWebView"
        window.minSize = NSSize(width: 720, height: 660)
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        capabilities.onEvent = { [weak self] event in self?.send(event) }
        runtime.onEvent = { [weak self] event in
            if let state = event["state"] as? [String: Any], let settings = state["settings"] as? [String: Any] { self?.capabilities.settings = settings }
            self?.send(["type": "agent.event", "event": event])
        }
        webView.loadFileURL(entry, allowingReadAccessTo: resources.appendingPathComponent("web"))
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "yuuki", message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.standardizedFileURL == entry,
              let command = message.body as? [String: Any],
              let type = command["type"] as? String,
              JSONSerialization.isValidJSONObject(command),
              let data = try? JSONSerialization.data(withJSONObject: command), data.count <= 132_096 else { return }
        if type == "ready" {
            guard Set(command.keys) == ["type"] else { return }
            do {
                let data = try Data(contentsOf: resources.appendingPathComponent("events.json"))
                guard data.count <= 4_000_000, let events = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    throw NSError(domain: "Yuuki", code: 1, userInfo: [NSLocalizedDescriptionKey: "无效的事件 fixture"])
                }
                send(["type": "bootstrap", "events": events])
                runtime.start()
                runtime.send(["op": "bootstrap"])
            } catch { send(["type": "bootstrap.error", "message": error.localizedDescription]) }
            return
        }
        if type == "agent.command", Set(command.keys) == ["type", "command"], let action = command["command"] as? [String: Any] {
            runtime.send(action)
            return
        }
        capabilities.handle(command)
    }

    private func send(_ event: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: event), let json = String(data: data, encoding: .utf8) else { return }
        // callAsyncJavaScript passes structured values as arguments; user content
        // never becomes source code. The JSON text is parsed inside a fixed body.
        webView.callAsyncJavaScript("window.yuukiReceive(JSON.parse(payload))", arguments: ["payload": json], in: nil, in: .page) { result in
            if case .failure(let error) = result { fputs("WebView delivery failed: \(error.localizedDescription)\n", stderr) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // The one bundled entry point is the only navigation destination. Update
        // links stay plain text. No external web page receives native capabilities.
        let allowed = navigationAction.targetFrame?.isMainFrame == true && navigationAction.request.url?.standardizedFileURL == entry
        decisionHandler(allowed ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fputs("WebView load failed: \(error.localizedDescription)\n", stderr)
        window.title = "加载失败：\(error.localizedDescription)"
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // Reload re-creates this example's in-memory session. No persistence is claimed.
        capabilities.stopSpeech()
        webView.loadFileURL(entry, allowingReadAccessTo: resources.appendingPathComponent("web"))
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) {
        capabilities.shutdown()
        runtime.shutdown()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "yuuki")
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
