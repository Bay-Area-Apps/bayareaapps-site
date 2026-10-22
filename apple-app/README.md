# Bay Area Apps — iPhone and Mac companion

Native SwiftUI companion for the Bay Area Apps website. The same charcoal, red, white, gold, and BA wordmark appear on both platforms.

## Included experience

- Browse the current catalog from `https://bayareaapps.com/catalog.json` with category filters and search.
- Save favorite project identifiers locally using SwiftData. Favorites are device-local, not cloud-synced.
- Revisit the last successfully fetched public catalog offline, with a saved-copy notice and timestamp.
- View the service menu and open the website's project inquiry flow.
- Open public Bay Area Apps pages in an embedded browser that blocks third-party resources, including advertising and tracking scripts.
- Open project inquiries, private client links, payment destinations, and the owner studio in the system browser. The owner studio uses the website's actual authentication; the app neither embeds credentials nor invents customer records.
- Share available project URLs. Paused and in-development projects have no launch action.
- Dedicated loading, empty, failure, retry, and local-save error states.

The app is a native catalog and business-workspace entry point, not a second customer database. Customer requests, proposals, messages, and payment status belong to the live website workspace. No App Store submission, distribution certificate, or App Store Connect action is part of this delivery.

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

## Build and test without using a phone

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

## Install on this Mac

```sh
cd apple-app
./scripts/build-and-install-mac.sh
```

The script builds locally with ad-hoc signing, runs the Swift package tests on the Mac, installs to `~/Applications/Bay Area Apps.app`, and opens it. It refuses to overwrite an existing application. This is a local development installation, not a notarized distribution download.

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

The native app includes no analytics or advertising SDK. Its embedded browser uses a nonpersistent data store and a first-party-only resource rule. It opens private `/studio/`, `/client/`, and inquiry `/start/` paths in the system browser so authentication and payment flows retain the website's security controls. The browser rejects non-HTTPS destinations except explicit email links, as well as URLs containing credentials or nonstandard ports. Third-party HTTPS navigation is sent to the system browser.

The catalog cache contains public descriptions only. SwiftData records contain project IDs and save times only. No account passwords, operator keys, payment credentials, or customer messages are stored in the app. The website and its business services have their own privacy policies.

## Verification at source handoff

- Passed: XcodeGen YAML parse, asset JSON validation, entitlement plist parse, all 11 icon dimensions, and Bash syntax checks.
- Swift/Xcode execution is unavailable in the Linux authoring environment. The attempted GitHub Actions run did not start because GitHub reported an account billing lock. There are no compiler logs or executed Swift test results; source review and static checks are the only completed verification.
- Neither the iPhone app nor the Mac app has been installed. No registered remote Mac was available at source handoff; compiling, running host-side tests, and final installation require access to the owner's Mac and paired phone. No phone tests were run.
- Owner login and payment-provider eligibility are owned by the website and must be verified there. This app does not claim those accounts are already connected.

## Source layout

```
App/                 SwiftUI app, view models, coordinator, SwiftData, WebKit, assets
Sources/BayAreaCore/  Catalog models, network/cache service, URL policy
Tests/               Swift Testing domain tests
scripts/             Local build and installation helpers
project.yml          XcodeGen project specification
Package.swift        Independently testable core package
```
