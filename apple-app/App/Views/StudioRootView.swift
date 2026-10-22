import SwiftUI
import BayAreaCore

struct StudioRootView: View {
    @State var catalog: CatalogViewModel
    @State private var coordinator = AppCoordinator()
    @Environment(\.openURL) private var openURL
    var body: some View {
        TabView {
            NavigationStack { CatalogView(model: catalog, coordinator: coordinator, savedOnly: false) }
                .tabItem { Label("Explore", systemImage: "square.grid.2x2") }
            NavigationStack { CatalogView(model: catalog, coordinator: coordinator, savedOnly: true) }
                .tabItem { Label("Saved", systemImage: "bookmark") }
            NavigationStack { ServicesView(coordinator: coordinator) }
                .tabItem { Label("Services", systemImage: "hammer") }
            NavigationStack { WorkspaceView() }
                .tabItem { Label("Workspace", systemImage: "briefcase") }
        }
        .sheet(item: $coordinator.browser) { destination in
            WebsiteBrowser(url: destination.url)
        }
        .alert("This link cannot be opened", isPresented: $coordinator.blockedLink) {
            Button("OK", role: .cancel) { }
        } message: { Text("Only secure websites and email links are supported.") }
    }
}
