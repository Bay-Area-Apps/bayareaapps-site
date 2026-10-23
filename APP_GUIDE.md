# Bay Area Apps — app and website guide

> Current app source is preserved on `codex/source-snapshot-2026-10-23`. The default branch contains this guide and website overview; use the snapshot for current app code.

Source review updated October 23, 2026. This guide describes the current owner app and its connected website. Recorded test and installation results below come from the existing project documentation; preparing this guide did not rerun the app, deploy services, or create a customer record.

## What this product does

Bay Area Apps is the public website and private business workspace for Bay Area Apps LLC. A prospective client uses the website to explore the portfolio and request a project. The owner uses the iPhone or Mac app to review that inquiry, agree a proposal, manage milestones and messages, review payment information, and record the handoff.

The app opens **Studio**, the private owner workspace. **My portfolio** provides the public catalog, search, category filters, sharing, and device-local saved projects. **Business** explains the service menu and the inquiry-to-handoff process. Clients use the website and their private project link; customer records live in the authenticated backend.

## Repository and website

| Resource | Canonical location |
| --- | --- |
| App, website and business service repository | [jmal9767/bayareaapps-site](https://github.com/jmal9767/bayareaapps-site) |
| Public website | [bayareaapps.com](https://bayareaapps.com/) |
| Project inquiry form | [Start a project](https://bayareaapps.com/start/) |
| Owner workspace | [Bay Area Apps Studio](https://bayareaapps-studio.bayareaapps-paws.workers.dev/admin) |
| Client portal service | `https://bayareaapps-studio.bayareaapps-paws.workers.dev/client/` — an individual private link is required |

The repository owns the native app, public business website, portfolio catalog, and Studio backend together. Its `paws-whiskers/` and `petassist-local/` pages are customer-facing pages for separate Paws & Whiskers services; the active combined Paws & Whiskers owner app belongs to [Paws-and-Whiskers-Visit](https://github.com/jmal9767/Paws-and-Whiskers-Visit).

## How a client project moves through the business

1. The client submits the form at `/start/`. A successful request returns a private project link. The client saves that link to return to their project; the service does not send an automatic email.
2. Studio displays the inquiry. The owner reviews its contact details, idea, budget and timing, then prepares a proposal with scope, price, timing and terms.
3. The client opens the saved private link and approves the current proposal. A stale proposal version is rejected so an older screen cannot approve changed terms. Approval does not collect payment.
4. The owner tracks milestones, status and messages. Both sides read the same project through their respective authenticated views.
5. The owner may share a verified business invoice/request link and record payment notes. The payment provider remains the source for the amount, recipient and actual payment status. Completion follows the agreed review and handoff.

The owner's dashboard provides Today, Inquiries, Projects and Payments views, search and status filtering. Its summaries cover the latest 200 inquiries returned by the API. Foreground summaries refresh every 30 seconds while visible and online and when the page returns or reconnects. Refresh preserves open project details and drafts. An expired session pauses updates and offers sign-in reload. There are no background or push alerts.

## Access, private links and payment boundaries

Owner access uses the existing Cloudflare Access email-code sign-in. The backend verifies the signed owner identity on every protected owner route; selecting a screen or storing a local session does not grant server access. The app embeds a persistent owner WebKit session separate from the public portfolio browser's nonpersistent store.

Each client project has a random private-link token. The database stores its hash. Anyone holding the link can access that project, so clients should keep it private. After verifying the client's identity, the owner can replace a compromised or lost link; the replacement revokes the old link immediately and is shown once for manual sharing. No recovery email is sent.

The portal accepts approved HTTPS payment-provider links and labels payment notes as owner-recorded. It does not create transactions, collect card details, issue refunds, or automatically prove that a payment cleared. Proposal approval, project completion and payment are separate events.

## Source map

| Path | Responsibility |
| --- | --- |
| Root HTML pages, `assets/`, `catalog.json` | Public website, portfolio, service information and inquiry entry |
| `start/` | Client inquiry form |
| `apple-app/App/` | SwiftUI app, navigation, owner workspace browser, public catalog and business guide |
| `apple-app/Sources/BayAreaCore/` | Catalog and owner URL policies, models, networking and cache logic |
| `apple-app/Tests/` | Host-side Swift core tests |
| `apple-app/project.yml` | XcodeGen definition for iPhone and native Mac targets |
| `script/build_and_run.sh` | Mac build, safe replacement of installed app, launch and verification |
| `business-backend/worker.mjs` | Worker API, authorization, validation and D1 operations |
| `business-backend/ui.mjs` | Private owner dashboard and client portal UI |
| `business-backend/schema.sql` | D1 schema |
| `business-backend/wrangler.jsonc` | Existing Worker, D1 and Access configuration |
| `tests/`, `business-backend/test.mjs` | Website, Studio and API regression fixtures |
| `.github/workflows/` | Website checks and unsigned Apple compilation |

## Build and verify

Native development requires Xcode 26 or later and XcodeGen. The app targets iOS 18+ and macOS 15+. Generate the Xcode project from its checked-in specification rather than hand-editing generated project files:

```sh
cd apple-app
xcodegen generate
open BayAreaApps.xcodeproj
```

From the repository root, `./script/build_and_run.sh --verify` builds, verifies, installs and opens the Mac app. It backs up the existing installed app under ignored `.build-artifacts/backups/`. Running the build/install command does not run the test suites.

Relevant checks, run independently:

```sh
npm ci --prefix tests
node --test business-backend/test.mjs
node --test tests/studio.test.cjs
node tests/visits-schedule-helpers.test.cjs
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

Use Node 24 for backend tests because they use built-in SQLite. Host tests and simulator compilation do not establish physical-device behavior. See [the native README](apple-app/README.md) for the separate installation-only iPhone procedure and signing requirements.

## Deployment

The public site's custom domain is recorded in `CNAME`. Publish through the repository's existing website hosting configuration and verify the deployed pages and catalog. Native builds do not publish website changes.

Studio is a separate Cloudflare Worker with D1 storage and Cloudflare Access. Its source and configuration are in `business-backend/`. The recorded October 23 deployment used an authenticated modules upload; future credentialed deployment can use Wrangler with `wrangler.jsonc`. Preserve the existing database, Access issuer/audience, owner policy and bindings. Review schema changes against the existing database before applying them. Keep management tokens and customer private links outside source control.

After a Studio-only update, **Reload studio** loads the deployed code without reinstalling the native app. A backend source commit, native build, and deployed Worker are distinct deliverables.

## Recorded status and remaining checks

The October 23 source record documents version **1.1 (2)** built, signed, installed and inspected on this Mac, with ten Swift core tests passing. The iPhone installation and installed version were separately verified; the agent did not launch, operate or test the physical phone. The owner later reported successful sign-in inside the app.

The recorded Studio deployment at `2026-10-23T14:56:47Z` matched the local Worker/UI modules on readback. Its record reports 29 backend tests and 42 combined backend/website/web-app tests passing, health/client pages returning 200, and owner routes redirecting to the existing Cloudflare Access login. Those checks did not create a production inquiry or payment.

An authenticated production project lifecycle remains to be independently exercised. Owner-reported sign-in, local fixtures, public health checks, installation and unsigned compilation each establish different things. Read [apple-app/README.md](apple-app/README.md) and [business-backend/README.md](business-backend/README.md) for the detailed evidence and older records; the dated current section takes precedence over earlier source-handoff limitations.

## Repository organization completed 2026-10-23

Current local application and backend source, including unfinished development changes, is preserved on [`codex/source-snapshot-2026-10-23`](https://github.com/jmal9767/bayareaapps-site/tree/codex/source-snapshot-2026-10-23). This snapshot retains existing branches and does not establish a new tested release. Use the snapshot for the source paths described above; default-branch source may be older. The project information website is https://bayareaapps.com/.
