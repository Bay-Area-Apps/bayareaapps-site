import Foundation
import Observation
import BayAreaCore

@MainActor @Observable
final class CatalogViewModel {
    private let service: any CatalogServing
    private var hasLoaded = false
    var snapshot: CatalogSnapshot?
    var isLoading = false
    var error: String?
    var isUsingSavedCopy = false
    init(service: any CatalogServing) { self.service = service }
    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await refresh()
    }
    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        if snapshot == nil { snapshot = await service.cached() }
        do {
            snapshot = try await service.fetch()
            isUsingSavedCopy = false
            error = nil
            hasLoaded = true
        } catch is CancellationError {
            // A canceled view task can retry when the screen becomes visible again.
        } catch {
            isUsingSavedCopy = snapshot != nil
            self.error = error.localizedDescription
        }
    }
}

@MainActor @Observable
final class AppCoordinator {
    struct BrowserDestination: Identifiable { let id = UUID(); let url: URL }
    var browser: BrowserDestination?
    var blockedLink = false
    func navigate(to url: URL, openExternal: (URL) -> Void) {
        switch LinkPolicy.classify(url) {
        case .website: browser = BrowserDestination(url: url)
        case .external: openExternal(url)
        case .blocked: blockedLink = true
        }
    }
}
