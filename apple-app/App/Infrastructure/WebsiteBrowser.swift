import SwiftUI
import WebKit
import Observation
import BayAreaCore

@MainActor @Observable
final class BrowserState {
    var loading = true
    var error: String?
    var reloadID = UUID()
}

struct WebsiteBrowser: View {
    let url: URL
    @State private var state = BrowserState()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    var body: some View {
        NavigationStack {
            ZStack {
                SiteWebView(url: url, state: state, openExternal: { openURL($0) })
                    .id(state.reloadID)
                if state.loading { ProgressView("Opening website…").padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)) }
                if let error = state.error {
                    ContentUnavailableView {
                        Label("Unable to open page", systemImage: "wifi.exclamationmark")
                    } description: { Text(error) } actions: {
                        Button("Try again") { state.error = nil; state.loading = true; state.reloadID = UUID() }
                        Button("Open in browser") { openURL(url) }
                    }
                    .background(Theme.background)
                }
            }
            .navigationTitle("Bay Area Apps")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                ToolbarItemGroup(placement: .primaryAction) {
                    Button { state.error = nil; state.loading = true; state.reloadID = UUID() } label: { Label("Reload website", systemImage: "arrow.clockwise") }
                    Button { openURL(url) } label: { Label("Open in browser", systemImage: "arrow.up.right.square") }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 700, minHeight: 620)
        #endif
    }
}

@MainActor
struct SiteWebView {
    let url: URL
    let state: BrowserState
    let openExternal: (URL) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(state: state, openExternal: openExternal) }

    func makeWebView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        let request = URLRequest(url: url, timeoutInterval: 25)
        // Deny all third-party network resources. Only same-origin scripts run.
        // Payments and account authentication open in the system browser.
        let rules = #"[{"trigger":{"url-filter":".*"},"action":{"type":"block"}},{"trigger":{"url-filter":"^https://bayareaapps\\.com/"},"action":{"type":"ignore-previous-rules"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "BayAreaAppsFirstPartyOnly-v1", encodedContentRuleList: rules) { ruleList, error in
            if let ruleList {
                view.configuration.userContentController.add(ruleList)
                view.load(request)
            } else {
                state.loading = false
                state.error = "The private browsing configuration could not be prepared. Open this page in your browser instead."
            }
        }
        return view
    }

    func updateWebView(_ view: WKWebView, context: Context) {
        // Reload replaces the SwiftUI view identity, rebuilding the privacy rules first.
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let state: BrowserState
        let openExternal: (URL) -> Void
        init(state: BrowserState, openExternal: @escaping (URL) -> Void) {
            self.state = state; self.openExternal = openExternal
        }
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
            state.loading = true; state.error = nil
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) { state.loading = false }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: any Error) { fail(error) }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: any Error) { fail(error) }
        private func fail(_ error: any Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            state.loading = false; state.error = error.localizedDescription
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let destination = navigationAction.request.url else { decisionHandler(.cancel); return }
            switch LinkPolicy.classify(destination) {
            case .website: decisionHandler(.allow)
            case .external:
                decisionHandler(.cancel)
                if navigationAction.navigationType == .linkActivated { openExternal(destination) }
                else if navigationAction.targetFrame?.isMainFrame == true {
                    state.loading = false
                    state.error = "This page needs your browser for secure sign-in or payment. Use Open in browser to continue."
                }
            case .blocked: decisionHandler(.cancel)
            }
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard let destination = navigationAction.request.url, LinkPolicy.classify(destination) != .blocked else { return nil }
            openExternal(destination)
            return nil
        }
    }
}

#if os(macOS)
extension SiteWebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView { makeWebView(context: context) }
    func updateNSView(_ nsView: WKWebView, context: Context) { updateWebView(nsView, context: context) }
}
#else
extension SiteWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { makeWebView(context: context) }
    func updateUIView(_ uiView: WKWebView, context: Context) { updateWebView(uiView, context: context) }
}
#endif
