import Foundation

/// The owner's authenticated studio has its own navigation policy and cookie store.
public enum OwnerWorkspace {
    public static let origin = URL(string: "https://bayareaapps-studio.bayareaapps-paws.workers.dev")!
    public static let home = origin.appendingPathComponent("admin")
    public static let accountEmail = "info@bayareaapps.com"
    public static let dataStoreID = UUID(uuidString: "C0BAA735-6D96-488B-9A82-923DB927AA11")!

    public enum Destination: Equatable, Sendable { case workspace, external, blocked }

    public static func classify(_ url: URL) -> Destination {
        guard url.user == nil, url.password == nil else { return .blocked }
        if url.scheme?.lowercased() == "mailto" {
            return url.path.contains("@") ? .external : .blocked
        }
        guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased(),
              !host.isEmpty, url.port == nil || url.port == 443 else { return .blocked }
        if host == origin.host || host == "bayareaapps-studio.cloudflareaccess.com" {
            return .workspace
        }
        return .external
    }
}
