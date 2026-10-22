import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct Project: Codable, Identifiable, Hashable, Sendable {
    public enum Category: String, Codable, CaseIterable, Sendable {
        case website = "Website", app = "App", game = "Game", tool = "Tool"
    }
    public enum Status: String, Codable, Sendable {
        case available, development, paused
        public var title: String {
            switch self {
            case .available: "Available"
            case .development: "In development"
            case .paused: "Temporarily unavailable"
            }
        }
    }
    public let id: String
    public let name: String
    public let category: Category
    public let summary: String
    public let status: Status
    public let url: URL?
    public init(id: String, name: String, category: Category, summary: String, status: Status, url: URL?) {
        self.id = id; self.name = name; self.category = category
        self.summary = summary; self.status = status; self.url = url
    }
    public var actionURL: URL? {
        guard status == .available, let url, LinkPolicy.classify(url) != .blocked else { return nil }
        return url
    }
}

public struct Catalog: Codable, Sendable {
    public let projects: [Project]
    public init(projects: [Project]) { self.projects = projects }
    public static func decode(_ data: Data) throws -> Catalog {
        let catalog = try JSONDecoder().decode(Catalog.self, from: data)
        guard catalog.projects.count <= 500,
              Set(catalog.projects.map(\.id)).count == catalog.projects.count,
              catalog.projects.allSatisfy({ !$0.id.isEmpty && !$0.name.isEmpty }) else {
            throw CatalogError.invalidContent
        }
        return catalog
    }
    public func filtered(category: Project.Category?, query: String, favorites: Set<String>? = nil) -> [Project] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return projects.filter { project in
            (category == nil || category == project.category)
            && (favorites == nil || favorites?.contains(project.id) == true)
            && (term.isEmpty || "\(project.name) \(project.summary)".localizedCaseInsensitiveContains(term))
        }
    }
}

public enum CatalogError: Error, LocalizedError, Sendable {
    case invalidContent, server(Int), noSavedCatalog
    public var errorDescription: String? {
        switch self {
        case .invalidContent: "The project list could not be read. Please try again."
        case .server(let status): "The website returned an error (\(status)). Please try again."
        case .noSavedCatalog: "Connect to the internet to load your project list for the first time."
        }
    }
}

public struct CatalogSnapshot: Codable, Sendable {
    public let catalog: Catalog
    public let fetchedAt: Date
    public init(catalog: Catalog, fetchedAt: Date) { self.catalog = catalog; self.fetchedAt = fetchedAt }
}

public protocol CatalogServing: Sendable {
    func fetch() async throws -> CatalogSnapshot
    func cached() async -> CatalogSnapshot?
}

public actor WebsiteCatalogService: CatalogServing {
    private let endpoint: URL
    private let cacheURL: URL
    private let session: URLSession
    public init(endpoint: URL, cacheURL: URL, session: URLSession = .shared) {
        self.endpoint = endpoint; self.cacheURL = cacheURL; self.session = session
    }
    public func fetch() async throws -> CatalogSnapshot {
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 20
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await session.data(for: request)
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw CatalogError.invalidContent }
        guard http.statusCode == 200 else { throw CatalogError.server(http.statusCode) }
        guard data.count <= 1_048_576 else { throw CatalogError.invalidContent }
        let catalog = try Catalog.decode(data)
        let snapshot = CatalogSnapshot(catalog: catalog, fetchedAt: Date())
        // The catalog is public; failing to cache must not hide a successfully fetched list.
        do {
            try FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(snapshot).write(to: cacheURL, options: .atomic)
        } catch {
            // A fresh network result remains valid when the device has no disk space.
        }
        return snapshot
    }
    public func cached() async -> CatalogSnapshot? {
        guard let data = try? Data(contentsOf: cacheURL), data.count <= 1_048_576,
              let snapshot = try? JSONDecoder().decode(CatalogSnapshot.self, from: data),
              (try? Catalog.decode(JSONEncoder().encode(snapshot.catalog))) != nil else { return nil }
        return snapshot
    }
}
