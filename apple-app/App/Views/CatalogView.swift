import SwiftUI
import SwiftData
import BayAreaCore

struct CatalogView: View {
    @Bindable var model: CatalogViewModel
    @Bindable var coordinator: AppCoordinator
    let savedOnly: Bool
    @Environment(\.modelContext) private var context
    @Environment(\.openURL) private var openURL
    @Query private var favorites: [Favorite]
    @State private var query = ""
    @State private var category: Project.Category?
    @State private var storageError: String?

    private var favoriteIDs: Set<String> { Set(favorites.map(\.projectID)) }
    private var visibleProjects: [Project] {
        model.snapshot?.catalog.filtered(category: category, query: query, favorites: savedOnly ? favoriteIDs : nil) ?? []
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                BrandMark()
                VStack(alignment: .leading, spacing: 8) {
                    Text(savedOnly ? "Your saved projects." : "Ideas made useful.")
                        .font(.largeTitle.bold()).foregroundStyle(Theme.text)
                    Text(savedOnly ? "Keep the projects you want to revisit close by. Favorites stay on this device." : "Explore our apps, websites, games, and practical tools.")
                        .foregroundStyle(.secondary)
                }
                Picker("Project category", selection: $category) {
                    Text("All projects").tag(Optional<Project.Category>.none)
                    ForEach(Project.Category.allCases, id: \.self) { item in
                        Text(item.rawValue).tag(Optional(item))
                    }
                }
                .pickerStyle(.menu)

                if model.isLoading && model.snapshot == nil {
                    ProgressView("Loading projects…").frame(maxWidth: .infinity).padding(32)
                } else if model.snapshot == nil, let error = model.error {
                    ContentUnavailableView {
                        Label("Projects unavailable", systemImage: "wifi.exclamationmark")
                    } description: { Text(error) } actions: {
                        Button("Try again") { Task { await model.refresh() } }.buttonStyle(.borderedProminent)
                    }
                } else {
                    if model.isUsingSavedCopy {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Showing saved project information", systemImage: "wifi.slash")
                            Text(model.error ?? "Unable to refresh right now.").font(.caption)
                            Button("Try again") { Task { await model.refresh() } }
                        }
                        .padding().frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                    }
                    if visibleProjects.isEmpty {
                        ContentUnavailableView(savedOnly ? "No saved projects match" : "No projects match", systemImage: savedOnly ? "bookmark" : "magnifyingglass", description: Text(savedOnly ? "Save a project from Explore, or change your search and filter." : "Try another search or category."))
                    }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 18)], alignment: .leading, spacing: 18) {
                        ForEach(visibleProjects) { project in
                            ProjectCard(project: project, isSaved: favoriteIDs.contains(project.id), save: { toggle(project) }, open: { url in
                                coordinator.navigate(to: url) { openURL($0) }
                            })
                        }
                    }
                    if let date = model.snapshot?.fetchedAt {
                        Text("Updated \(date.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(24).frame(maxWidth: 1120)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle(savedOnly ? "Saved" : "Explore")
        .searchable(text: $query, prompt: "Search projects")
        .toolbar {
            Button {
                Task { await model.refresh() }
            } label: { Label("Refresh projects", systemImage: "arrow.clockwise") }
                .disabled(model.isLoading)
        }
        .task { await model.loadIfNeeded() }
        .refreshable { await model.refresh() }
        .alert("Couldn't save your change", isPresented: Binding(get: { storageError != nil }, set: { if !$0 { storageError = nil } })) {
            Button("OK", role: .cancel) { storageError = nil }
        } message: { Text(storageError ?? "Please try again.") }
    }
    private func toggle(_ project: Project) {
        if let item = favorites.first(where: { $0.projectID == project.id }) { context.delete(item) }
        else { context.insert(Favorite(projectID: project.id)) }
        do { try context.save() }
        catch { context.rollback(); storageError = error.localizedDescription }
    }
}

private struct ProjectCard: View {
    let project: Project
    let isSaved: Bool
    let save: () -> Void
    let open: (URL) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                Text(project.category.rawValue.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(Theme.gold)
                Spacer()
                Button(action: save) { Image(systemName: isSaved ? "bookmark.fill" : "bookmark") }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(isSaved ? "Remove \(project.name) from saved projects" : "Save \(project.name)")
                    .frame(minWidth: 44, minHeight: 44)
            }
            Text(project.name).font(.title2.bold())
            Text(project.summary).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            Text(project.status.title).font(.caption.weight(.semibold)).foregroundStyle(Theme.gold)
            Spacer(minLength: 8)
            if let url = project.actionURL {
                HStack {
                    Button("Open project") { open(url) }.buttonStyle(.borderedProminent)
                    Spacer()
                    ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") }.labelStyle(.iconOnly)
                        .accessibilityLabel("Share \(project.name)")
                }
            }
        }
        .padding(20).frame(maxWidth: .infinity, minHeight: 260, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
    }
}
