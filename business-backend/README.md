# Bay Area Apps Studio

Updated 2026-10-23: https://bayareaapps-studio.bayareaapps-paws.workers.dev

Owner workspace `/admin`: Cloudflare Access email code restricted to info@bayareaapps.com. Worker independently verifies RSA signature, issuer, audience, expiry, issue/not-before times and exact owner email on every owner route. No password/bootstrap secret in source. Client portal `/client/#token=...`: save returned private link. Random 256-bit token is stored only as SHA-256 in D1. Anyone possessing the private link can access the project. No expiry; contact owner if lost/compromised. After verifying client identity, the owner can replace a lost link in the workspace, immediately revoking the old link. The new link is displayed once for secure manual sharing; no email is sent. Portal removes token from address bar into session storage and offers a save-link action. No ads, analytics, third-party scripts, automatic emails or email notifications. Responses no-store/no-referrer.

## Website inquiry to owner workflow

The live `https://bayareaapps.com/start/` form posts to this backend's `/v1/inquiries`. The app embeds the authenticated `/admin` workspace on the same backend, so a successful website inquiry becomes a new request in Studio. The owner reviews it, prepares a proposal for client portal approval, manages milestones and messages, reviews invoice links and owner-recorded payment notes, and records completion after the agreed handoff. The client saves the private portal link returned by the form to follow the project; automatic email notifications are not enabled.

## API

POST `/v1/inquiries`: JSON `{name,email,company,projectType,budget,timeline,idea,website,consent:true,honeypot:'',requestId:UUID}`. Company and website optional/empty; website must be HTTP(S) if present. Returns 201 `{id,reference,token,portalUrl}`. Duplicate requestId returns 409 without duplicate creation; original token cannot be recovered. Save the successful response/link.

With `Authorization: Bearer TOKEN`: GET `/v1/client`; POST `/v1/client/messages` `{text}`; POST `/v1/client/approve` `{version}`. Approval rejects stale versions with 409 and never charges money.

Owner Access endpoints: GET `/admin/api/inquiries` (latest 200); GET `/admin/api/inquiries/:id`; PATCH `/admin/api/inquiries/:id` `{expectedVersion,status,proposal,milestones:[{title,status}],invoiceUrl,paymentNote}`; POST `/admin/api/inquiries/:id/messages` `{text}`. Proposal changes increment version. Statuses: new, reviewing, proposal, active, on_hold, completed, closed. Milestone statuses: planned, in_progress, done. Owner mutation requires backend same-origin.

The authenticated summary endpoint includes `proposal`, `proposal_version`, `approved_version`, `invoice_url`, and `payment_note`, alongside record identity, contact, request, status, and timestamp fields. It excludes private-link token hashes and request IDs. These fields let the owner dashboard calculate its queues without fetching every project detail.

## Owner dashboard

Today, Inquiries, Projects, and Payments provide search, status filters, record drilldown, refresh, and project editing. Today counts new inquiries, nonempty current proposals awaiting approval, active projects, and saved invoice links. Each count and queue covers only the latest 200 inquiries returned by the API; the interface explains the cap and flags stale records after a failed refresh.

Inquiry summaries refresh automatically every 30 seconds while the workspace is visible and online, and immediately when it becomes visible again or reconnects. Automatic checks preserve open project details and drafts, avoid redrawing unchanged lists, and defer changed list redraws during active input, list focus, or text selection. An expired session pauses checks and offers **Reload to sign in**; transient failures remain retryable. These are foreground updates, with no push or background alerts. In the installed app, tap **Reload studio** once to load this deployed code; no native build or reinstall is required.

Payments can filter invoice links and owner notes. A saved link is a review item, not evidence of an outstanding balance or completed payment. Provider accounts remain the source for amounts and payment status. Detail views retain proposal editing, separate milestone lines, client messages, and confirmed private-link replacement.

Errors: `{error:string}`. 400 invalid, 401 auth, 403 origin, 409 stale/duplicate, 413 size, 415 JSON required, 429 rate. Intake limit 10/hour/IP; portal 180/hour/IP; streamed body cap 16 KiB. Prepared SQL. Public CORS exact bayareaapps.com, www.bayareaapps.com HTTPS and backend self-origin. Originless native calls allowed for public/token endpoints.

## Payments

Owner supplies verified business invoice/request HTTPS URL on approved PayPal, Venmo or Cash App domain. Owner verifies recipient/amount/account before sharing. Portal never creates transactions, collects card details, processes refunds or automatically confirms payment. Notes explicitly say owner-recorded and not provider-verified. Apple Pay depends on external provider support. Stripe is not used. No invoice/live payment link or transaction was created.

## Resources

Account `e00cb966783a570c515e5e854d9780b0`; Worker `bayareaapps-studio`, previews disabled; D1 `bayareaapps-studio`, ID `616b15af-f539-4b81-bf4d-708c66fd5a6d`; Access organization `bayareaapps-studio.cloudflareaccess.com`; Access app `7326ce4b-9c43-4496-80f6-691f2013c94c` protects `/admin` and descendants; OTP provider `a8f1a256-0e88-41b6-a803-1ed9ceb4213b`; owner policy `276c0344-4aa9-48f1-9cc8-64bc4f2719ad`. These IDs/audience are configuration, not credentials. No paid subscription purchased. No bayareaapps.com zone in this account, hence workers.dev. Other workers/databases untouched.

Deployment uses schema.sql, worker.mjs, ui.mjs and wrangler.jsonc. Deployed via authenticated Cloudflare API multipart modules upload and D1 schema query. Future credentialed deployments can use Wrangler. Never add API tokens to source.

## October 23, 2026 deployment and verification

The automatic inquiry summary refresh update was deployed through the Cloudflare API to the existing Worker at `2026-10-23T14:56:47.339281Z`, deployment `eb0b9f2432994f8491f58566f3a1dcaf`. Downloaded production `worker.mjs` and `ui.mjs` matched the local modules exactly after deployment. Existing D1 and owner Access configuration were retained. No production inquiry was created, and no native build, installation, or phone operation was needed for this update.

Agent live checks returned `/health` 200, `/client/` 200, and `/admin` plus `/admin/api/inquiries` 302 to the existing Cloudflare Access issuer. Those checks requested no OTP code and exercised no authenticated production owner workflow or payment. Authenticated dashboard behavior was checked with local fixtures; the native Mac app was inspected through the real embedded Access sign-in page.

The owner subsequently reported successful sign-in within the app. This is owner-reported evidence, separate from the independent routing, source, and fixture checks above. An authenticated production project lifecycle has not been independently exercised. A live configuration audit confirmed that the website inquiry form targets the same backend origin as Studio.

All 29 backend tests and all 42 combined backend, website, and installable web app tests passed. Coverage includes summary API protection, dashboard counts and filters, detail navigation, saving and refreshing, multiline milestones, private-link recovery, automatic update timing and visibility, draft and focus preservation, expired-session pause/reload, and retry after transient HTML errors.

The earlier dashboard and summary API deployment at `2026-10-23T14:28:39Z` was `79822ff9502c48d6b4fc786368f6f31b`. Its production source matched the local modules and its combined suite passed all 34 tests. That original record is superseded by the refresh deployment and checks above.

## Earlier verification

Run `node --test business-backend/test.mjs` from the repo root with Node 24 built-in SQLite. The earlier suite passed twelve tests covering durable lifecycle, hashing, duplicates, origins/auth, payment URLs, streaming limit, real RSA JWT signature/claims, consent/honeypot, rate limit, and private page headers/no tracking.

Live: health 200; client UI 200; owner UI 302 to Access login; synthetic intake 201, project 200, message 200, stale approval 409, current approval 200 and persisted version 2. Synthetic proposal seeded via authenticated D1 solely for check; synthetic inquiry/messages deleted, remaining count zero. No email codes requested or payment attempted. Interactive owner OTP login/post-login UI still require owner acceptance testing; signed-token tests cover server verifier.

Owner recovery: POST `/admin/api/inquiries/:id/access-link` with `{identityVerified:true}` requires the same Access JWT and same-origin protections as other owner mutations. Returns `{portalUrl,oldLinkRevoked:true}`. The new random token replaces the stored hash; old client links immediately return 401. UI requires explicit identity-verification/revocation confirmation and provides a copy-link action. Tests cover unauthenticated refusal, missing confirmation refusal, and old/new token validity.

Generated client and owner inline JavaScript is compiled and executed with project fixtures in JSDOM. Install repository tests dependencies first with `npm ci --prefix tests`; smoke tests use that existing jsdom dependency. A template escape regression was fixed using String.raw so newline escapes survive into browser JavaScript.
