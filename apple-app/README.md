# Bay Area Apps — the owner's business app

Native SwiftUI app for the owner to run Bay Area Apps LLC, using the business and workflow on [bayareaapps.com](https://bayareaapps.com). It keeps the website's charcoal, red, white, gold, and BA wordmark on iPhone and Mac.

## Owner workflow

- **Studio** is the first screen. Its embedded owner browser opens the live private workspace at `https://bayareaapps-studio.bayareaapps-paws.workers.dev/admin`, protected by Cloudflare Access. The owner uses the existing email sign-in; no password, operator token, or sample customer account is included in the app.
- The workspace is where the owner reviews real inquiries, writes proposals, tracks project status and milestones, exchanges client messages, and records verified business payment links and payment notes. Its dashboard groups work into inquiries, proposals, projects, and payments to review. This dashboard update was deployed to the existing backend on October 23, 2026; future backend source changes require their own deployment.
- **My portfolio** shows the current public catalog from `https://bayareaapps.com/catalog.json`, with search, category filters, available project links, sharing, and device-local saved projects. It retains the last successfully fetched public catalog for offline viewing.
- **Business** provides the service menu and owner reference for agreeing scope, pricing, milestones, review, handoff, and ongoing care, based on the website.

The private workspace remains the source of customer requests, proposals, messages, and payment notes. The native app provides its own persistent owner browser session and navigation. The public portfolio browser uses a separate nonpersistent store. No second customer database or payment processing system is created.

The website inquiry form and the app's Studio use the same business backend:

1. A client submits the project form at `https://bayareaapps.com/start/` and saves the private project link returned after success.
2. The owner reviews the new request in Studio under Today or Inquiries, then records its status and a proposal with scope, price, timing, and terms.
3. The client uses the private portal to review and approve the current proposal. Approval does not make a payment.
4. The owner manages milestones and project messages in Studio; the client sees the same project through the private portal.
5. The owner reviews verified business invoice links and payment notes, then records completion after the agreed review and handoff.

Tap **Reload studio** once to load the latest deployed workspace; no native update or reinstall is needed. Studio checks inquiry summaries every 30 seconds while visible and online, and immediately when you return to the page or reconnect. Automatic checks update the dashboard and lists while preserving open project details and drafts. Unchanged lists stay in place, and changed list redraws wait while an input, list item, or text selection is active. Session expiry pauses checks and offers sign-in reload. There are no background or push alerts.

Payment notes are owner-recorded, not provider-verified. The owner checks recipient, amount, and payment account before sharing a payment request and confirms any received payment with the provider. No invoice or transaction is created by building or installing this app.

## Requirements

- Xcode 26 or later on a Mac compatible with that Xcode release.
- iOS 18 or later for the iPhone target; macOS 15 or later for the native Mac target.
- XcodeGen (`brew install xcodegen`) to generate the project from `project.yml`.
- An Apple development signing team, a paired iPhone, and Developer Mode for physical iPhone installation.

The generated Xcode project is deliberately not hand-authored or committed. Generate it with:

```sh
cd apple-app
xcodegen generate
open BayAreaApps.xcodeproj
```

Two application targets are generated: `BayAreaAppsIOS` and `BayAreaAppsMac`. Each depends on the local `BayAreaCore` Swift package. The composition root injects the website catalog service into a main-actor observable view model. Navigation policy belongs to the coordinator/domain layer. SwiftData owns favorite records.

## Build, install, and open on this Mac

From the repository root:

```sh
./script/build_and_run.sh
# Also confirm the process came from the installed app:
./script/build_and_run.sh --verify
```

The Codex Run action calls the same script. `apple-app/scripts/build-and-install-mac.sh` delegates to it for compatibility.

The script generates the Xcode project, builds the native Mac Release target, verifies its signature, stages the complete app, and then closes only a process running from `~/Applications/Bay Area Apps.app`. It backs up the old app under the repository's ignored `.build-artifacts/backups/` directory before replacement, restores it if the final rename fails, and opens the installed app. A compiler or signing failure leaves the existing installation unchanged. The default build uses local ad-hoc signing and is not a notarized distribution download.

XcodeGen is resolved from `XCODEGEN` when set, from `PATH`, or from the ignored `.build-artifacts/tools/xcodegen/bin/xcodegen` fallback. The fallback must contain the full XcodeGen distribution: both `bin/xcodegen` and `share/xcodegen/SettingPresets/`. Copying the executable alone omits platform settings and can silently generate the wrong target SDK. The script checks fallback resources and verifies that the generated project contains both iPhone and Mac SDK settings before building. Additional modes are `--debug` (LLDB), `--logs` (process logs), and `--telemetry` (bundle-subsystem logs). Default runs do not run tests.

## Separate checks without using a physical phone

```sh
cd apple-app
swift test
xcodegen generate
xcodebuild -project BayAreaApps.xcodeproj -scheme BayAreaAppsMac \
  -destination 'platform=macOS' -derivedDataPath build/mac \
  CODE_SIGNING_ALLOWED=NO build
xcodebuild -project BayAreaApps.xcodeproj -scheme BayAreaAppsIOS \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/ios \
  CODE_SIGNING_ALLOWED=NO build
```

`swift test` exercises catalog validation, filtering, unavailable-project behavior, cached data, and safe URL handling. These are host-side tests; no physical iPhone is used. Xcode/macOS CI results are recorded by the repository workflow, not inferred from static checks.

## Install on the owner's iPhone — installation only

Open Xcode once, sign in to the intended Apple developer account under Settings → Accounts, and select the correct signing team for `BayAreaAppsIOS`. Connect/pair the iPhone, unlock it, trust the Mac, and enable Developer Mode if requested by iOS.

Alternatively, after pairing, obtain the device identifier using `xcrun devicectl list devices` and run:

```sh
cd apple-app
export BAYAREA_DEVELOPMENT_TEAM='YOUR_TEAM_ID'
export BAYAREA_DEVICE_ID='YOUR_PAIRED_DEVICE_ID'
./scripts/install-ios.sh
```

The script builds and installs only. It never runs tests, UI automation, or test data on the physical phone. Signing IDs are provided at runtime and are not committed. Normal local development provisioning may be created or updated by Xcode to install the app.

## Live catalog contract

```json
{
  "projects": [
    {
      "id": "stable-project-id",
      "name": "Project name",
      "category": "Website",
      "summary": "A factual description.",
      "status": "available",
      "url": "https://bayareaapps.com/project/"
    }
  ]
}
```

Categories: `Website`, `App`, `Game`, `Tool`. Status: `available`, `development`, `paused`. URLs are optional and must be absolute HTTPS links; available projects without a usable URL will not offer an Open action. Every ID must be nonempty and unique. Unknown enum values fail visibly rather than inventing availability. The file above is a schema example, not an actual portfolio entry.

## Privacy and security

The native app includes no analytics or advertising SDK. The public portfolio browser uses a nonpersistent data store and a first-party-only resource rule. Private client links, inquiry flows, payment destinations, and other external links open in the system browser. The public browser rejects non-HTTPS destinations except explicit email links, URLs containing credentials, and nonstandard ports.

The owner Studio uses a separate persistent WebKit data store so the owner can stay signed in. Its cookies, session data, and any WebKit cache may remain on the device; they are isolated from the public portfolio browser. Owner and Access navigation is limited to the configured workspace and Cloudflare Access hosts, with other supported links handed to the system browser. The website and backend still enforce access on every private owner route.

The native catalog cache contains public descriptions only. SwiftData saved-project records contain public project IDs and save times only. Customer records remain in the authenticated backend; the native app embeds no passwords, API credentials, or payment-provider secrets. The website and its business services have their own privacy policies.

## Version 1.1 (2) verified October 23, 2026

- Ten Swift core tests passed on this Mac. The final native Mac Release build succeeded through `./script/build_and_run.sh --verify`, installed to `~/Applications/Bay Area Apps.app`, and its process was confirmed at that exact path. Prior app copies were preserved under `.build-artifacts/backups/`.
- Mac accessibility inspection confirmed the in-app Studio showing the real Cloudflare Access email sign-in, My portfolio loading the live catalog, and the Business guide. The Mac app uses one main window. During that inspection, no email code was requested and no authenticated production owner workflow was exercised. Seeing sign-in confirmed the protection and embedded navigation.
- The owner subsequently reported that sign-in within the app worked. This is owner-reported confirmation; an authenticated production project workflow has not been independently exercised.
- The signed iOS device build succeeded as version 1.1 (2), and strict deep signature verification passed. Its scene configuration disables multiple scenes. Reconnecting the iPhone resolved the earlier connection issue. `devicectl` installed `com.bayareaapps.StudioCompanion` successfully (installation database sequence 5860), and an independent installed-app query confirmed version 1.1, build 2. Agent operations on the physical phone were limited to installation and read-only installed-version verification; no app launch, tests, or UI automation were performed as part of those checks.
- The updated dashboard/backend modules were deployed to the existing Cloudflare Worker and downloaded source matched the local modules exactly. The automatic summary refresh update was then deployed at `2026-10-23T14:56:47.339281Z`; all 29 backend tests and all 42 combined backend, website, and installable web app tests passed. Post-deployment checks again matched both source modules exactly and returned health 200, client page 200, and owner page/API 302 to the existing Cloudflare Access issuer. This workspace update required no new native build, installation, or phone operation. No production inquiry or payment was created for these checks. The backend README records deployment details.

The October 22 record below applies to the earlier catalog-focused version 1.0 (1).

## Local installation verified October 22, 2026

- Seven Swift core tests passed on this Mac, and the native Mac Release build succeeded. The signed application is installed and its process was confirmed at `~/Applications/Bay Area Apps.app`.
- The iPhone Debug build succeeded using the existing development team and paired device. Strict deep signature verification passed. `devicectl` confirmed installation of `com.bayareaapps.StudioCompanion`, version 1.0 (1), with installation database sequence 5748.
- The physical iPhone was used for installation only. No phone tests, app launch, or UI automation were performed. After host resources recovered, Mac UI inspection confirmed the live catalog, a search narrowing to Bumper Cars, and the Services screen. The search was cleared afterward; no client inquiry was submitted. Full runtime coverage is not claimed.
- These results superseded the source-handoff limitations for version 1.0 (1). Version 1.1 (2) has its own verification record above.

## Historical verification at source handoff

- Passed: XcodeGen YAML parse, asset JSON validation, entitlement plist parse, all 11 icon dimensions, and Bash syntax checks.
- Swift/Xcode execution is unavailable in the Linux authoring environment. The attempted GitHub Actions run did not start because GitHub reported an account billing lock. There are no compiler logs or executed Swift test results; source review and static checks are the only completed verification.
- Neither the iPhone app nor the Mac app has been installed. No registered remote Mac was available at source handoff; compiling, running host-side tests, and final installation require access to the owner's Mac and paired phone. No phone tests were run.
- Owner login and payment-provider eligibility are owned by the website and must be verified there. This app does not claim those accounts are already connected.

## Source layout

```
App/                 SwiftUI owner app, view models, coordinator, SwiftData, WebKit, assets
Sources/BayAreaCore/  Catalog models, network/cache service, public and owner URL policies
Tests/               Swift Testing domain tests
scripts/             Compatibility Mac helper; iPhone build and installation helpers
project.yml          XcodeGen project specification
Package.swift        Independently testable core package
```

At the repository root, `script/build_and_run.sh` owns the Mac build/install/run workflow and `.codex/environments/environment.toml` connects it to the Codex Run action.
