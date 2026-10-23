import SwiftUI

struct BusinessGuideView: View {
    @Bindable var coordinator: AppCoordinator
    @Environment(\.openURL) private var openURL
    private let services: [(String, String, String)] = [
        ("iphone", "Custom iPhone apps", "Apps for a client’s business, customers, or a useful everyday task."),
        ("globe", "Business websites", "Service websites, portfolios, landing pages, and companion sites."),
        ("rectangle.3.group", "Design & prototypes", "Screen designs and working previews to agree on the first version."),
        ("briefcase", "Business systems", "Inquiry forms, booking requests, dashboards, and private client workspaces."),
        ("function", "Tools & shortcuts", "Calculators, Apple Shortcuts, and automations for repeated tasks."),
        ("wrench.and.screwdriver", "Care & improvements", "Updates, maintenance, interface fixes, and new features.")
    ]
    private let steps: [(String, String)] = [
        ("Review the inquiry", "Clarify the client’s goal, users, budget, timing, and first useful version."),
        ("Prepare the proposal", "Write the scope, deliverables, price, deposit, milestones, revisions, ownership, and support terms."),
        ("Agree before building", "Get approval for the current proposal. Arrange the agreed deposit and verify it in your business account."),
        ("Build & review", "Update milestones, keep client conversations in the project, and review changes against the agreed scope."),
        ("Deliver & support", "Check the deliverables, arrange the remaining payment, hand over the agreed files and accounts, and record ongoing support.")
    ]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                BrandMark()
                VStack(alignment: .leading, spacing: 10) {
                    Text("Your studio. Your business.").font(.largeTitle.bold())
                    Text("Build useful apps and websites for paying clients, and showcase the projects you own.")
                        .font(.title3).foregroundStyle(.secondary)
                }
                section("Your services") {
                    ForEach(services, id: \.1) { symbol, title, detail in
                        HStack(alignment: .top, spacing: 16) {
                            Image(systemName: symbol).font(.title2).foregroundStyle(Theme.gold)
                                .frame(width: 32).accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(title).font(.headline)
                                Text(detail).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Text("Games and AI features are quoted individually after reviewing the scope and ongoing service costs.")
                        .font(.callout).foregroundStyle(.secondary)
                }
                section("From inquiry to handoff") {
                    ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .top, spacing: 16) {
                            Text(String(format: "%02d", index + 1)).font(.headline.monospacedDigit())
                                .foregroundStyle(Theme.gold).frame(width: 32)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(step.0).font(.headline)
                                Text(step.1).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                section("Getting paid") {
                    Text("Use verified business payment requests for PayPal, Venmo, or Cash App. Apple Pay is available when the payment provider supports it.")
                    Text("Add the payment request to the client’s project in Studio. Verify the money in the provider account before recording a payment note. Dashboard invoice counts are follow-up reminders, not confirmed balances.")
                        .foregroundStyle(.secondary)
                }
                section("Bring clients to your studio") {
                    Text("Your public website explains the services, showcases your projects, and accepts new inquiries. Share the inquiry page when someone wants to hire you.")
                        .foregroundStyle(.secondary)
                    if let url = URL(string: "https://bayareaapps.com/start/") {
                        ShareLink(item: url) { Label("Share project inquiry page", systemImage: "square.and.arrow.up") }
                            .buttonStyle(.borderedProminent)
                    }
                    Button("View public website") {
                        if let url = URL(string: "https://bayareaapps.com/") {
                            coordinator.navigate(to: url) { openURL($0) }
                        }
                    }
                    Text("Public resources and sponsorships can support additional revenue. Advertising approval and earnings are managed separately from client work.")
                        .font(.callout).foregroundStyle(.secondary)
                }
                Text("Bay Area Apps LLC · info@bayareaapps.com").font(.caption).foregroundStyle(.secondary)
            }
            .padding(24).frame(maxWidth: 860).frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Business")
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            Text(title).font(.title2.bold())
            content()
        }
        .padding(24).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
    }
}
