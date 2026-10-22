# Bay Area Apps Studio

Deployed 2026-10-22: https://bayareaapps-studio.bayareaapps-paws.workers.dev

Owner workspace `/admin`: Cloudflare Access email code restricted to info@bayareaapps.com. Worker independently verifies RSA signature, issuer, audience, expiry, issue/not-before times and exact owner email on every owner route. No password/bootstrap secret in source. Client portal `/client/#token=...`: save returned private link. Random 256-bit token is stored only as SHA-256 in D1. Anyone possessing the private link can access the project. No expiry; contact owner if lost/compromised. After verifying client identity, the owner can replace a lost link in the workspace, immediately revoking the old link. The new link is displayed once for secure manual sharing; no email is sent. Portal removes token from address bar into session storage and offers a save-link action. No ads, analytics, third-party scripts, automatic emails or email notifications. Responses no-store/no-referrer.

## API

POST `/v1/inquiries`: JSON `{name,email,company,projectType,budget,timeline,idea,website,consent:true,honeypot:'',requestId:UUID}`. Company and website optional/empty; website must be HTTP(S) if present. Returns 201 `{id,reference,token,portalUrl}`. Duplicate requestId returns 409 without duplicate creation; original token cannot be recovered. Save the successful response/link.

With `Authorization: Bearer TOKEN`: GET `/v1/client`; POST `/v1/client/messages` `{text}`; POST `/v1/client/approve` `{version}`. Approval rejects stale versions with 409 and never charges money.

Owner Access endpoints: GET `/admin/api/inquiries` (latest 200); GET `/admin/api/inquiries/:id`; PATCH `/admin/api/inquiries/:id` `{expectedVersion,status,proposal,milestones:[{title,status}],invoiceUrl,paymentNote}`; POST `/admin/api/inquiries/:id/messages` `{text}`. Proposal changes increment version. Statuses: new, reviewing, proposal, active, on_hold, completed, closed. Milestone statuses: planned, in_progress, done. Owner mutation requires backend same-origin.

Errors: `{error:string}`. 400 invalid, 401 auth, 403 origin, 409 stale/duplicate, 413 size, 415 JSON required, 429 rate. Intake limit 10/hour/IP; portal 180/hour/IP; streamed body cap 16 KiB. Prepared SQL. Public CORS exact bayareaapps.com, www.bayareaapps.com HTTPS and backend self-origin. Originless native calls allowed for public/token endpoints.

## Payments

Owner supplies verified business invoice/request HTTPS URL on approved PayPal, Venmo or Cash App domain. Owner verifies recipient/amount/account before sharing. Portal never creates transactions, collects card details, processes refunds or automatically confirms payment. Notes explicitly say owner-recorded and not provider-verified. Apple Pay depends on external provider support. Stripe is not used. No invoice/live payment link or transaction was created.

## Resources

Account `e00cb966783a570c515e5e854d9780b0`; Worker `bayareaapps-studio`, previews disabled; D1 `bayareaapps-studio`, ID `616b15af-f539-4b81-bf4d-708c66fd5a6d`; Access organization `bayareaapps-studio.cloudflareaccess.com`; Access app `7326ce4b-9c43-4496-80f6-691f2013c94c` protects `/admin` and descendants; OTP provider `a8f1a256-0e88-41b6-a803-1ed9ceb4213b`; owner policy `276c0344-4aa9-48f1-9cc8-64bc4f2719ad`. These IDs/audience are configuration, not credentials. No paid subscription purchased. No bayareaapps.com zone in this account, hence workers.dev. Existing workers/databases untouched.

Deployment uses schema.sql, worker.mjs, ui.mjs and wrangler.jsonc. Deployed via authenticated Cloudflare API multipart modules upload and D1 schema query. Future credentialed deployments can use Wrangler. Never add API tokens to source.

## Verification

`node --test business-backend/test.mjs` from repo root, Node 24 built-in SQLite. Ten tests passed: durable lifecycle, hashing, duplicates, origins/auth, payment URLs, streaming limit, real RSA JWT signature/claims, consent/honeypot, rate limit and private page headers/no tracking.

Live: health 200; client UI 200; owner UI 302 to Access login; synthetic intake 201, project 200, message 200, stale approval 409, current approval 200 and persisted version 2. Synthetic proposal seeded via authenticated D1 solely for check; synthetic inquiry/messages deleted, remaining count zero. No email codes requested or payment attempted. Interactive owner OTP login/post-login UI still require owner acceptance testing; signed-token tests cover server verifier.

Owner recovery: POST `/admin/api/inquiries/:id/access-link` with `{identityVerified:true}` requires the same Access JWT and same-origin protections as other owner mutations. Returns `{portalUrl,oldLinkRevoked:true}`. The new random token replaces the stored hash; old client links immediately return 401. UI requires explicit identity-verification/revocation confirmation and provides a copy-link action. Tests cover unauthenticated refusal, missing confirmation refusal, and old/new token validity.
