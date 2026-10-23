# Bay Area Apps

The website and the owner's business app for Bay Area Apps LLC, based on [bayareaapps.com](https://bayareaapps.com). The app opens the private Studio first so the owner can run client work: review inquiries, prepare proposals, manage projects and milestones, exchange client messages, and review payment requests and notes.

The public portfolio is a secondary part of the app. The Business screen provides the website's service menu and a reference for the inquiry-to-handoff workflow.

Clients send project inquiries through [bayareaapps.com/start/](https://bayareaapps.com/start/). Those requests appear in the app's Studio for review, proposals and client approval, milestones and messages, payment review, and eventual handoff.

Tap **Reload studio** once to load the deployed automatic updates; no app reinstall is needed. Studio then checks for new requests every 30 seconds while visible and online, and when you return or reconnect. These updates preserve open project drafts; they do not send background or push alerts.

- [Native iPhone and Mac app](apple-app/README.md): SwiftUI shell, authenticated Studio, public portfolio, and business reference.
- [Business backend](business-backend/README.md): Cloudflare Worker, D1 project records, Cloudflare Access owner sign-in, and private client portal.
- Public website: root HTML pages, `assets/`, and `catalog.json`.

Build, install, and open the Mac app from the repository root:

```sh
./script/build_and_run.sh --verify
```

The Codex Run action uses the same script. It builds before changing the installed app, saves the previous app in `.build-artifacts/backups/`, installs to `~/Applications/Bay Area Apps.app`, and opens that exact copy. Default runs do not run tests. See the native app README for requirements, separate checks, and physical iPhone installation instructions.

Version 1.1 (2) was built, installed, and inspected on this Mac on October 23, 2026. The owner dashboard was deployed to the existing business backend. The iPhone app was also installed and its version verified without agent-run phone app launch or tests. The owner subsequently reported successful sign-in within the app. The linked READMEs distinguish that report from independent checks and record remaining workflow verification.
