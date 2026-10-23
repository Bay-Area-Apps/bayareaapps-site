import SwiftUI
import BayAreaCore

struct StudioRootView: View {
    @Bindable var bootstrap: AppBootstrap
    @State private var coordinator = AppCoordinator()
    @State private var ownerSession = OwnerWorkspaceSession()
    @Environment(\.openURL) private var openURL
    var body: some View {
        TabView {
            NavigationStack { OwnerStudioView(session: ownerSession) }
                .tabItem { Label("Studio", systemImage: "briefcase.fill") }
            NavigationStack {
                if let container = bootstrap.container, let catalog = bootstrap.catalog {
                    CatalogView(model: catalog, coordinator: coordinator, savedOnly: false)
                        .modelContainer(container)
                } else {
                    ContentUnavailableView {
                        Label("Portfolio storage unavailable", systemImage: "externaldrive.badge.exclamationmark")
                    } description: {
                        Text(bootstrap.error ?? "Please try again.")
                    } actions: {
                        Button("Try again") { bootstrap.prepare() }
                    }
                }
            }
            .tabItem { Label("My portfolio", systemImage: "square.grid.2x2") }
            NavigationStack { BusinessGuideView(coordinator: coordinator) }
                .tabItem { Label("Business", systemImage: "list.clipboard") }
        }
        .sheet(item: $coordinator.browser) { destination in
            WebsiteBrowser(url: destination.url)
        }
        .alert("This link cannot be opened", isPresented: $coordinator.blockedLink) {
            Button("OK", role: .cancel) { }
        } message: { Text("Only secure websites and email links are supported.") }
    }
}
