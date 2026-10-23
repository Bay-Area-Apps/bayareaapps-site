import Foundation
import Testing
@testable import BayAreaCore

@Test func catalogRejectsDuplicateIdentifiers() throws {
    let record = #"{"id":"one","name":"One","category":"Website","summary":"Useful","status":"available"}"#
    let data = Data("{\"projects\":[\(record),\(record)]}".utf8)
    #expect(throws: (any Error).self) { try Catalog.decode(data) }
}

@Test func pausedProjectsDoNotOfferLaunchActions() throws {
    let project = Project(id: "paused", name: "Visits", category: .website, summary: "Visits", status: .paused, url: try #require(URL(string: "https://bayareaapps.com/petassist-local/")))
    #expect(project.actionURL == nil)
}

@Test func filtersCombineSearchCategoryAndFavorites() {
    let catalog = Catalog(projects: [
        Project(id: "one", name: "Paws", category: .website, summary: "Pet care", status: .available, url: nil),
        Project(id: "two", name: "Game", category: .game, summary: "Pet adventure", status: .development, url: nil)
    ])
    #expect(catalog.filtered(category: .website, query: " PET ", favorites: ["one"]).map(\.id) == ["one"])
    #expect(catalog.filtered(category: .game, query: "Pet", favorites: ["one"]).isEmpty)
}

@Test(arguments: ["javascript:alert(1)", "http://bayareaapps.com/", "file:///etc/passwd", "https://user:password@bayareaapps.com/", "https://bayareaapps.com:8080/"])
func unsafeLinksAreBlocked(_ input: String) throws {
    #expect(LinkPolicy.classify(try #require(URL(string: input))) == .blocked)
}

@Test(arguments: ["https://bayareaapps.com/studio/", "https://bayareaapps.com/client/", "https://bayareaapps.com/start/", "https://www.paypal.com/", "https://bayareaapps.com.evil.example/"])
func privateAndExternalLinksLeaveEmbeddedBrowser(_ input: String) throws {
    #expect(LinkPolicy.classify(try #require(URL(string: input))) == .external)
}

@Test func ownPublicWebsiteStaysEmbedded() throws {
    #expect(LinkPolicy.classify(try #require(URL(string: "https://bayareaapps.com/projects/"))) == .website)
}

@Test(arguments: [
    "https://bayareaapps-studio.bayareaapps-paws.workers.dev/admin#view=overview",
    "https://bayareaapps-studio.bayareaapps-paws.workers.dev/cdn-cgi/access/authorized",
    "https://bayareaapps-studio.cloudflareaccess.com/cdn-cgi/access/login"
])
func ownerSessionKeepsAuthenticationOnTrustedHosts(_ input: String) throws {
    #expect(OwnerWorkspace.classify(try #require(URL(string: input))) == .workspace)
}

@Test(arguments: [
    "https://bayareaapps-studio.cloudflareaccess.com.evil.example/login",
    "https://bayareaapps-studio.bayareaapps-paws.workers.dev.evil.example/admin",
    "https://www.paypal.com/invoice/one",
    "https://bayareaapps.com/",
    "mailto:info@bayareaapps.com"
])
func ownerSessionSendsPublicAndPaymentLinksOutside(_ input: String) throws {
    #expect(OwnerWorkspace.classify(try #require(URL(string: input))) == .external)
}

@Test(arguments: [
    "http://bayareaapps-studio.bayareaapps-paws.workers.dev/admin",
    "https://user:password@bayareaapps-studio.cloudflareaccess.com/login",
    "https://bayareaapps-studio.bayareaapps-paws.workers.dev:8080/admin",
    "javascript:alert(1)", "file:///etc/passwd"
])
func ownerSessionBlocksUnsafeAddresses(_ input: String) throws {
    #expect(OwnerWorkspace.classify(try #require(URL(string: input))) == .blocked)
}

@Test func cachedCatalogSurvivesServiceRecreation() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let file = directory.appendingPathComponent("catalog.json")
    let saved = CatalogSnapshot(catalog: Catalog(projects: []), fetchedAt: Date(timeIntervalSince1970: 1))
    try JSONEncoder().encode(saved).write(to: file)
    let service = WebsiteCatalogService(endpoint: try #require(URL(string: "https://bayareaapps.com/catalog.json")), cacheURL: file)
    let restored = await service.cached()
    #expect(restored?.fetchedAt == saved.fetchedAt)
}
