import SwiftUI
import SwiftData
import Observation
import BayAreaCore

@main
@MainActor
struct BayAreaAppsApp: App {
    @State private var bootstrap = AppBootstrap()
    var body: some Scene {
        #if os(macOS)
        Window("Bay Area Apps", id: "studio") {
            appContent.frame(minWidth: 720, minHeight: 580)
        }
        #else
        WindowGroup {
            appContent
        }
        #endif
    }

    private var appContent: some View {
        StudioRootView(bootstrap: bootstrap)
            .preferredColorScheme(.dark)
            .tint(Theme.red)
    }
}

@MainActor @Observable
final class AppBootstrap {
    var container: ModelContainer?
    var catalog: CatalogViewModel?
    var error: String?
    init() { prepare() }
    func prepare() {
        do {
            let container = try ModelContainer(for: Favorite.self)
            let cacheDirectory = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            guard let endpoint = URL(string: "https://bayareaapps.com/catalog.json") else {
                throw CatalogError.invalidContent
            }
            let service = WebsiteCatalogService(endpoint: endpoint, cacheURL: cacheDirectory.appendingPathComponent("BayAreaApps/catalog.json"))
            self.container = container
            self.catalog = CatalogViewModel(service: service)
            self.error = nil
        } catch {
            self.error = "Your portfolio’s local storage could not be opened. Check available device storage and try again. \(error.localizedDescription)"
        }
    }
}

@Model
final class Favorite {
    @Attribute(.unique) var projectID: String
    var savedAt: Date
    init(projectID: String) { self.projectID = projectID; self.savedAt = Date() }
}
