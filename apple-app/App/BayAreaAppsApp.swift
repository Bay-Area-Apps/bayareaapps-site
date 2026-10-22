import SwiftUI
import SwiftData
import Observation
import BayAreaCore

@main
@MainActor
struct BayAreaAppsApp: App {
    @State private var bootstrap = AppBootstrap()
    var body: some Scene {
        WindowGroup {
            Group {
                if let container = bootstrap.container, let catalog = bootstrap.catalog {
                    StudioRootView(catalog: catalog)
                        .modelContainer(container)
                } else {
                    ContentUnavailableView {
                        Label("Unable to open local storage", systemImage: "externaldrive.badge.exclamationmark")
                    } description: {
                        Text(bootstrap.error ?? "Please try opening the app again.")
                    } actions: {
                        Button("Try again") { bootstrap.prepare() }
                    }
                }
            }
            .preferredColorScheme(.dark)
            .tint(Theme.red)
            #if os(macOS)
            .frame(minWidth: 720, minHeight: 580)
            #endif
        }
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
            self.error = "Your saved projects could not be opened. Check available device storage and try again. \(error.localizedDescription)"
        }
    }
}

@Model
final class Favorite {
    @Attribute(.unique) var projectID: String
    var savedAt: Date
    init(projectID: String) { self.projectID = projectID; self.savedAt = Date() }
}
