import SwiftUI
import WebKit
import Observation
import BayAreaCore

@MainActor @Observable
final class OwnerWorkspaceSession: NSObject, WKNavigationDelegate, WKUIDelegate {
    struct Dialog: Identifiable {
        let id = UUID()
        let message: String
        let host: String
        let requiresConfirmation: Bool
        let completion: (Bool) -> Void
    }

    @ObservationIgnored private let dataStore = WKWebsiteDataStore(forIdentifier: OwnerWorkspace.dataStoreID)
    @ObservationIgnored var openExternal: ((URL) -> Void)?
    private(set) var webView: WKWebView
    private(set) var generation = UUID()
    private(set) var loading = true
    private(set) var clearing = false
    private(set) var isSigningIn = true
    private(set) var error: String?
    var dialog: Dialog?

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore(forIdentifier: OwnerWorkspace.dataStoreID)
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        configureAndLoad()
    }

    private func configureAndLoad() {
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: OwnerWorkspace.home, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
    }

    func reload() {
        guard !clearing else { return }
        error = nil
        loading = true
        // Start at the protected route so an expired Access session redirects to sign-in.
        let destination = webView.url.flatMap { url in
            url.host == OwnerWorkspace.origin.host ? url : nil
        } ?? OwnerWorkspace.home
        webView.load(URLRequest(url: destination, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
    }

    func clearSignIn() {
        guard !clearing else { return }
        clearing = true
        webView.stopLoading()
        resolveDialog(false)
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        // This is a local profile reset; it does not revoke other devices' sessions.
        dataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { [weak self] in
            guard let self else { return }
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = self.dataStore
            self.webView = WKWebView(frame: .zero, configuration: configuration)
            self.generation = UUID()
            self.error = nil
            self.isSigningIn = true
            self.loading = true
            self.clearing = false
            self.configureAndLoad()
        }
    }

    func resolveDialog(_ approved: Bool) {
        let pending = dialog
        dialog = nil
        pending?.completion(approved)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
        loading = true
        error = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
        loading = false
        isSigningIn = webView.url?.host != OwnerWorkspace.origin.host
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: any Error) { fail(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: any Error) { fail(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loading = false
        error = "The studio page stopped responding. Reload to reconnect to your work."
        resolveDialog(false)
    }

    private func fail(_ failure: any Error) {
        guard (failure as NSError).code != NSURLErrorCancelled else { return }
        loading = false
        error = failure.localizedDescription
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard !clearing else { decisionHandler(.cancel); return }
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        switch OwnerWorkspace.classify(url) {
        case .workspace:
            if action.targetFrame == nil {
                decisionHandler(.cancel)
                webView.load(action.request)
            } else {
                decisionHandler(.allow)
            }
        case .external:
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated { openExternal?(url) }
            else if action.targetFrame?.isMainFrame != false {
                loading = false
                error = "This sign-in method needs a browser. Use Open in browser, or reload and use the business email code."
            }
        case .blocked:
            decisionHandler(.cancel)
            if action.targetFrame?.isMainFrame != false {
                loading = false
                error = "This page tried to open an unsupported address. Reload your studio to continue."
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // Main-frame navigation policy handles new-window requests in the current view
        // or sends deliberately tapped public/payment links to the system browser.
        nil
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        resolveDialog(false)
        dialog = Dialog(message: message, host: frame.request.url?.host ?? "Your studio",
                        requiresConfirmation: true, completion: completionHandler)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
        resolveDialog(false)
        dialog = Dialog(message: message, host: frame.request.url?.host ?? "Your studio",
                        requiresConfirmation: false, completion: { _ in completionHandler() })
    }
}

@MainActor
struct OwnerWebView {
    let session: OwnerWorkspaceSession
}

#if os(macOS)
extension OwnerWebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView { session.webView }
    func updateNSView(_ nsView: WKWebView, context: Context) { }
}
#else
extension OwnerWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { session.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) { }
}
#endif
