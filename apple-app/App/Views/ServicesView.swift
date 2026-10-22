import SwiftUI

struct ServicesView: View {
    @Bindable var coordinator: AppCoordinator
    @Environment(\.openURL) private var openURL
    private let services: [(String, String, String)] = [
        ("iphone", "Custom iPhone apps", "Focused apps built around a business, service, or everyday task."),
        ("globe", "Business websites", "Service websites, portfolios, landing pages, and app companion sites."),
        ("rectangle.3.group", "Design & prototypes", "Screen designs and interactive previews to shape an idea before a full build."),
        ("briefcase", "Business tools", "Inquiry forms, booking requests, dashboards, and client portals."),
        ("function", "Calculators & shortcuts", "Focused calculators, Apple Shortcuts, and simple workflow automation."),
        ("wrench.and.screwdriver", "Updates & maintenance", "Feature improvements, interface fixes, and website upkeep.")
    ]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                BrandMark()
                Text("Let’s build something for you.").font(.largeTitle.bold())
                Text("Tell us what you want to achieve. We’ll review the requirements before confirming scope, price, or timing.")
                    .foregroundStyle(.secondary)
                ForEach(services, id: \.1) { symbol, title, detail in
                    HStack(alignment: .top, spacing: 18) {
                        Image(systemName: symbol).font(.title2).foregroundStyle(Theme.gold).frame(width: 32)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 8) {
                            Text(title).font(.headline)
                            Text(detail).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                }
                Text("Game prototypes and AI features are reviewed individually to match the work to a realistic scope.")
                    .font(.callout).foregroundStyle(.secondary)
                Button("Start a project") {
                    if let url = URL(string: "https://bayareaapps.com/start/") {
                        coordinator.navigate(to: url) { openURL($0) }
                    }
                }
                .buttonStyle(.borderedProminent).controlSize(.large)
                Text("Free inquiry. No payment required to tell us about your idea.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(24).frame(maxWidth: 820).frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Services")
    }
}

struct WorkspaceView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                BrandMark()
                Image(systemName: "briefcase.fill").font(.system(size: 46)).foregroundStyle(Theme.gold).accessibilityHidden(true)
                Text("Your business workspace.").font(.largeTitle.bold())
                Text("Open the private studio to manage website inquiries and project work. Your browser handles the workspace’s secure sign-in.")
                    .foregroundStyle(.secondary)
                if let url = URL(string: "https://bayareaapps.com/studio/") {
                    Link(destination: url) { Label("Open private studio", systemImage: "arrow.up.right.square") }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                }
                VStack(alignment: .leading, spacing: 12) {
                    Label("Private business information stays in the authenticated workspace.", systemImage: "lock")
                    Label("No customer records are stored in this app.", systemImage: "person.crop.circle.badge.checkmark")
                    Label("Payment availability is shown on each approved proposal or invoice.", systemImage: "creditcard")
                }
                .font(.callout).padding(20).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                Divider()
                Text("Business contact").font(.headline)
                if let email = URL(string: "mailto:info@bayareaapps.com") {
                    Link("info@bayareaapps.com", destination: email)
                }
                if let privacy = URL(string: "https://bayareaapps.com/privacy/") {
                    Link("Website privacy policy", destination: privacy)
                }
                Text("Saved projects are stored on this device. Public project information is cached so you can revisit it offline. This app does not include advertising or analytics SDKs.")
                    .font(.caption).foregroundStyle(.secondary)
                Text("© Bay Area Apps LLC").font(.caption).foregroundStyle(.secondary)
            }
            .padding(24).frame(maxWidth: 820).frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Workspace")
    }
}
