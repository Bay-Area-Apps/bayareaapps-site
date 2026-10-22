# Bay Area Apps — October 22, 2026

The redesigned website keeps the black, red, white, and gold identity and combines a public project catalog with custom development inquiries. Existing pet-service and catering pages remain separate.

## Operating the studio

Open https://bayareaapps.com/studio/ and continue to the owner workspace. Cloudflare Access sends a one-time sign-in code to the business email account. This interactive owner sign-in still needs to be exercised by the owner. Check the workspace for new inquiries; automatic notification emails are not configured.

Clients submit an inquiry at /start/ and receive a private project link. They must save that link. Anyone holding the link can view that project, send messages, and approve its current proposal. The owner can update proposals, milestones and status, reply, and attach a provider invoice link. Private areas contain no advertising scripts.

Use an existing business PayPal, Venmo, or Cash App invoice/request link in the workspace. Apple Pay may be available through an eligible PayPal checkout; it is not a separate activated integration. Invoice links do not prove payment. Payment notes are explicitly owner-recorded and must be checked against the payment provider. No Stripe integration was added, no charge made, and no payment account activated.

## Advertising

The public Resources section supports the existing AdSense publisher code; ads.txt is preserved. AdSense approval and revenue are not verified. Sponsorship inquiries use the same structured inquiry flow. No paid ad campaign or spending was started. Promotional connections identified include Meta advertising and the Bay Area Apps Facebook page; social publishing setup is separate.

## Apple applications

Source and local build/install scripts are in apple-app/. The companion has native iPhone and Mac interfaces, public project browsing, local saved projects, service information, and browser entry points to client and owner workspaces.

GitHub Actions run 39863649757 did not execute any build steps: GitHub reports the account is locked due to a billing issue. Swift/Xcode are unavailable in this Linux session. Native compilation and runtime behavior therefore remain unverified. No native app has been installed by this task. The current Codex environment connection list is empty, so this session cannot reach the user's Mac or iPhone. Existing installations from earlier threads are not evidence of a current connection.

Resume installation in the connected Mac environment, build both schemes, run automated checks on Mac/simulator, then use the supplied installation scripts. Do not run tests or UI automation on the physical phone. Do not publish to App Store or TestFlight.

## Verification

Backend: ten local Node tests pass; live synthetic inquiry, private portal, messages, proposal-version approval, access redirect and cleanup verified. No customer data or payment was used. See business-backend/README.md.

The existing visits helper regression suite passes. The older visits DOM booking suite currently fails against the deliberately paused public Visits page because its booking controls are absent; those existing pages were not changed by this redesign.

Website: nine focused tests pass, plus browser verification of navigation, category filtering, required-field validation, and private client entry. Source published to the existing repository; hosting deployment is checked separately.
