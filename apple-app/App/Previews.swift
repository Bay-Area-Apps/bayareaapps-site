#if DEBUG
import SwiftUI
import SwiftData
import BayAreaCore

private actor PreviewCatalogService: CatalogServing {
    func fetch() async throws -> CatalogSnapshot {
        CatalogSnapshot(catalog: Catalog(projects: [
            Project(id: "preview-help-line", name: "Paws & Whiskers Help Line", category: .website,
                    summary: "Everyday dog-and-cat care guidance.", status: .available,
                    url: URL(string: "https://bayareaapps.com/paws-whiskers/")),
            Project(id: "preview-game", name: "Bumper Cars", category: .game,
                    summary: "A development preview of an arcade game project.", status: .development, url: nil)
        ]), fetchedAt: Date())
    }
    func cached() async -> CatalogSnapshot? { nil }
}

#Preview("Native studio — preview data") {
    CatalogView(model: CatalogViewModel(service: PreviewCatalogService()), coordinator: AppCoordinator(), savedOnly: false)
        .modelContainer(for: Favorite.self, inMemory: true)
        .preferredColorScheme(.dark)
        .tint(Theme.red)
}
#endif
