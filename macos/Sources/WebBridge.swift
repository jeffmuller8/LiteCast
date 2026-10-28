import AppKit
import WebKit

/// Hosts the web app and connects it to the native player and sign-in. The page talks to it
/// through `window.LiteCastMac` (defined below), which src/lib/native-bridge.ts wraps so the
/// web code sees the same plugin shape as in the Android app.
final class WebBridge: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let webView: WKWebView
    let audio = AudioPlayer()
    let auth: AuthBridge
    private let site: URL

    private static let bridgeScript = """
    (() => {
      if (window.LiteCastMac) return;
      const listeners = new Map();
      window.LiteCastMac = {
        platform: "macos",
        plugins: ["LiteCastAudio", "LiteCastAuth"],
        call(plugin, method, args) {
          return window.webkit.messageHandlers.litecast.postMessage({ plugin, method, args: args || {} });
        },
        addListener(plugin, event, fn) {
          const key = plugin + ":" + event;
          if (!listeners.has(key)) listeners.set(key, new Set());
          listeners.get(key).add(fn);
          return { remove: () => listeners.get(key).delete(fn) };
        },
        _emit(plugin, event, data) {
          const set = listeners.get(plugin + ":" + event);
          if (set) set.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
        },
      };
    })();
    """

    init(site: URL) {
        self.site = site
        auth = AuthBridge(site: site)

        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.applicationNameForUserAgent = "LiteCastMac/0.1"
        let controller = config.userContentController
        controller.addUserScript(WKUserScript(source: Self.bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        super.init()
        controller.addScriptMessageHandler(self, contentWorld: .page, name: "litecast")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        audio.emit = { [weak self] event, data in self?.emit(plugin: "LiteCastAudio", event: event, data: data) }
    }

    func loadSite() {
        webView.load(URLRequest(url: site))
    }

    private func isAppPage(_ url: URL?) -> Bool {
        url?.scheme == site.scheme && url?.host == site.host && url?.port == site.port
    }

    // MARK: Page → native

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        // Only the app's own pages get the bridge
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == site.scheme, origin.host == site.host,
              origin.port == (site.port ?? 0)
        else {
            replyHandler(nil, "Not allowed")
            return
        }
        guard let body = message.body as? [String: Any],
              let plugin = body["plugin"] as? String,
              let method = body["method"] as? String
        else {
            replyHandler(nil, "Malformed call")
            return
        }
        let args = body["args"] as? [String: Any] ?? [:]

        switch plugin {
        case "LiteCastAudio":
            audio.handle(method: method, args: args, reply: replyHandler)
        case "LiteCastAuth":
            auth.handle(method: method, args: args, reply: replyHandler)
        default:
            replyHandler(nil, "Unknown plugin \(plugin)")
        }
    }

    // MARK: Native → page

    private func emit(plugin: String, event: String, data: [String: Any]) {
        guard let json = try? JSONSerialization.data(withJSONObject: [plugin, event, data]),
              let args = String(data: json, encoding: .utf8)
        else { return }
        webView.evaluateJavaScript("window.LiteCastMac && window.LiteCastMac._emit(...\(args))")
    }

    // MARK: Navigation

    // The app's pages stay in the window; other links open in the default browser
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // Settings → Export saves an OPML file through a download link
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        let url = navigationAction.request.url
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if !isMainFrame || isAppPage(url) || url?.scheme == "about" || url?.scheme == "blob" || url?.scheme == "data" {
            decisionHandler(.allow)
            return
        }
        if let url, ["http", "https", "mailto"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return completionHandler(nil) }
            // The panel already asked about replacing; WKDownload won't write over an existing file
            try? FileManager.default.removeItem(at: url)
            completionHandler(url)
        }
    }

    // target="_blank" links and window.open
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isAppPage(url) {
                webView.load(URLRequest(url: url))
            } else {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    // Offline or the site is down: show a short message with a retry
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        if nsError.code == NSURLErrorCancelled { return }
        let html = """
        <html><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:#09090b;color:#fafafa;font-family:-apple-system,sans-serif;text-align:center;padding:16px">
        <p>LiteCast couldn't reach the internet.</p>
        <p><a href="\(site.absoluteString)" style="color:#38bdf8">Try again</a></p></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // The file picker for Settings → Import OPML
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.begin { completionHandler($0 == .OK ? panel.urls : nil) }
    }
}
