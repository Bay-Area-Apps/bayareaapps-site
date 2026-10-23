import SwiftUI
import BayAreaCore

struct OwnerStudioView: View {
    @Bindable var session: OwnerWorkspaceSession
    @Environment(\.openURL) private var openURL
    @State private var confirmClear = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 16) {
                BrandMark()
                Spacer(minLength: 0)
                Label("OWNER", systemImage: "lock.fill")
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.gold)
            }
            .padding(.horizontal, 24).padding(.vertical, 16)
            Divider()
            ZStack {
                if session.clearing {
                    Theme.background
                } else {
                    OwnerWebView(session: session).id(session.generation)
                }
                if let error = session.error {
                    ContentUnavailableView {
                        Label("Your studio couldn’t connect", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Reload studio") { session.reload() }.buttonStyle(.borderedProminent)
                        Link("Open in browser", destination: OwnerWorkspace.home)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.background)
                }
                if session.loading || session.clearing {
                    ProgressView(session.clearing ? "Clearing sign-in…" : "Connecting to your studio…")
                        .padding(20).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                }
            }
            Divider()
            HStack {
                Label(session.isSigningIn ? "Sign in with \(OwnerWorkspace.accountEmail)" : "Connected to your private business workspace", systemImage: "lock.shield")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20).padding(.vertical, 10)
        }
        .background(Theme.background)
        .navigationTitle("My studio")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button { session.reload() } label: { Label("Reload studio", systemImage: "arrow.clockwise") }
                    .disabled(session.clearing)
                Menu {
                    Link("Open studio in browser", destination: OwnerWorkspace.home)
                    Button("Clear sign-in on this device", role: .destructive) { confirmClear = true }
                } label: { Label("Studio options", systemImage: "ellipsis.circle") }
            }
        }
        .onAppear { session.openExternal = { openURL($0) } }
        .onDisappear { session.resolveDialog(false) }
        .confirmationDialog("Clear business sign-in on this device?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear sign-in", role: .destructive) { session.clearSignIn() }
        } message: {
            Text("You’ll need your business email code to sign in again here. Your projects stay in your online workspace. Sessions on other devices stay signed in.")
        }
        .alert(session.dialog?.host ?? "Your studio", isPresented: Binding(
            get: { session.dialog != nil },
            set: { _ in } // The explicit buttons resolve the WebKit callback exactly once.
        ), presenting: session.dialog) { dialog in
            if dialog.requiresConfirmation {
                Button("Cancel", role: .cancel) { session.resolveDialog(false) }
                Button("Continue") { session.resolveDialog(true) }
            } else {
                Button("OK") { session.resolveDialog(true) }
            }
        } message: { dialog in Text(dialog.message) }
    }
}
