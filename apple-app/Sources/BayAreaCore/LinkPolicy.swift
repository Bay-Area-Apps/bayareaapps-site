import Foundation

public enum LinkPolicy {
    public enum Destination: Equatable, Sendable { case website, external, blocked }
    public static func classify(_ url: URL) -> Destination {
        guard url.user == nil, url.password == nil else { return .blocked }
        if url.scheme?.lowercased() == "mailto" {
            return url.path.contains("@") ? .external : .blocked
        }
        guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased(),
              !host.isEmpty, url.port == nil || url.port == 443 else { return .blocked }
        if host == "bayareaapps.com" {
            // Authentication and private work stay in the system browser.
            let path = url.path.lowercased()
            if path == "/studio" || path.hasPrefix("/studio/") || path == "/client" || path.hasPrefix("/client/") || path == "/start" || path.hasPrefix("/start/") {
                return .external
            }
            return .website
        }
        return .external
    }
}
