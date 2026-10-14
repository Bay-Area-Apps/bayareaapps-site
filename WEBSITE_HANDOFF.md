# Website handoff — October 4, 2026

The three public pages share Bay Area Apps charcoal (#0e1014), red (#c81e30), and gold (#f2c65b), while preserving distinct layouts:
- / — Bay Area Apps studio and project grid.
- /paws-whiskers/ — Paws & Whiskers Help Line, pet illustrations, editorial support and curved pricing panels. Current prices: Quick $10, Detailed $15, Phone $25, Free Community Support.
- /petassist-local/ — Paws & Whiskers Visit, pet illustrations, appointment form, service pricing and a private client page. The legacy URL remains stable.

Clients use the website. The business owner uses the private iPhone app; no client installation or public provider marketplace is required. Visit requests enter the protected business inbox. Checkout opens after the owner confirms a visit. Client and business messages appear on the private client page. Appointment state and PayPal payment/refund state remain separate.

The Visits page uses fragment-based private access links and contains no advertising or analytics scripts. Keep third-party scripts off this private page. The studio and care-line pages retain the existing AdSense loader and publisher files; these do not confirm ad approval or earnings.

Payment processing uses the existing Cloudflare worker and business PayPal account. Apple Pay availability depends on the client browser and PayPal eligibility. No funds are directed to an Apple account email; payments are processed by the connected business PayPal merchant.

Preserve CNAME, app-ads.txt, ads.txt, privacy links and the existing care-line intake URL. Backend code is in Vet-Assistant-Help-Line/main; private Visits app code is in PetAssist-Local-App/PetAssist-Local (main is a separate app). No operator connection key belongs in website source or Git.

## October 4: text-only preference
The user requested removing all website images. Removed first-party raster artwork, inline SVG artwork, icons, and illustration videos from all three public pages, and removed their asset files. Pet branding uses names, copy, typography and the shared charcoal/red/gold palette. Request forms, private messages, checkout, service prices and navigation remain functional.

### Local distance and location
The Visits website reads its public service area from `/petassist/service-area`. The owner publishes its city/ZIP or public address through the native Business tab; no personal GPS location is automatically shared. Clients may optionally share a one-time browser location while at the visit address, with explicit confirmation; their private page permits removing it. The native app can resolve a written visit address using Apple. Private pages show that client's address/pin and the same server-calculated straight-line distance as the business app; public payment receipts never show those details. Distances are not driving estimates or live tracking. Apple Maps links open on user action; no image or map embed was added. The app embeds this website in a read-only client preview, disabling forms and checkout when its WebKit preview flag is set.

### Client visit progress
The Visits private page follows an Uber-style service flow adapted to a single pet-care business: request received, confirmed, on the way, caring for the pet, completed. Native appointment controls update these existing server statuses; the website refreshes every 30 seconds while visible. Cancellation hides the progress tracker and closes checkout. The current stage is accessible using aria-current and future stages are not shown as completed. Service cards select the request's service; the visit address comes first. “On the way” is a business status, not an ETA or live GPS tracking. Live location sharing requires a separate owner choice and is not implied by this design.

### General-area map
The client website now embeds an interactive OpenStreetMap map of the public service area on both the landing and private visit page. It has no exact-location marker. Only the public area coordinates are sent to the embed; never client pins, addresses or access links. This supersedes the earlier map-link-only description. CSP permits the OpenStreetMap frame and the native preview permits that exact embed as a subframe while keeping main navigation restricted to the business website. Privacy text explains the map provider. The site retains no decorative photos or imagery. The actual area must be chosen by the owner; no location has been guessed.

## Help Line private messages — October 5, 2026
Written care-line services now use private website conversations answered in the owner app. The care-line landing page and service preview reflect that workflow. Clients bookmark their private link and return for replies; no SMS/email notifications are promised. Phone Support remains a separate arranged call. Prices and the business PayPal recipient are unchanged.
## October 5: ride-style Visits booking
The public Visits page at `/petassist-local/` is now a map-first booking screen in the shared charcoal, red, white, and gold palette. Clients enter a visit address, choose Nail Trim ($35), Medication Care ($45), Sample Collection ($55), or Wellness Check ($65), then send a request. The private visit page is the same bottom sheet: progress, messages, and PayPal or Apple Pay only after the business confirms. Payment still uses the Help Line worker checkout. No advertising or analytics was added. The OpenStreetMap frame still receives only the public service area.

## October 5: owner location stays private
Clients never receive the business service-area coordinates, label, map, or distance. The ride screen uses a decorative grid, not a live map. The business app still calculates distance for the owner only. Optional client location sharing still goes to the business and can be removed from the private page.

## October 8, 2026 — Restore service navigation and combined app connections

### Notes / purpose
The owner requested both websites active and connected to one private iPhone/Mac app. This supersedes WEBSITES.md's prior instruction to remove cross-navigation.

### Changes made
Restored company and service links that had become noninteractive span elements. Added the existing account-based Visits portal to the legacy request page without moving records, replacing payment flows, or dropping private-link access. Corrected that page's canonical URL. Both existing service backends are referenced by the new PawsWhiskers Xcode project.

### Validation
Both bayareaapps.com/paws-whiskers/ and /petassist-local/ returned HTTP 200 before these changes. Cloudflare standalone sites and API return HTTP 403 / error 1010 from the execution environment, so live booking, payment and authenticated sync are NOT verified. Native build results and device setup are tracked in the app repository's CHANGELOG.md.

### Remaining work / handoff
Verify GitHub Pages publication after saving. Cloudflare account access is needed to investigate the 1010 block and authorize each owner device. Do not disable authentication or replace the sole business account. Do not claim real client transactions were tested.

### October 8 verification update
GitHub Pages deployment 37873054283 succeeded; both homepage links are live. App service-check run 37873272338 passed all seven read-only public checks from a GitHub runner: both service pages and standalone websites returned 200, Visits API health returned 200, Help Line CORS returned 204, and unauthenticated client-record access correctly returned 401. The earlier Cloudflare 1010 response was specific to this execution network, not proof of a global outage. The Xcode app built and launched on iPhone Simulator and Mac Catalyst in run 37872976295. Physical signing and authenticated account/device connections still require verification; no live client transaction was submitted.

## October 13, 2026 — Website advertising and sponsorship preparation

### Purpose and changes
The owner requested website ad revenue and a sponsor offer, excluding the private owner app. Kept the existing AdSense publisher `ca-pub-4065093972696595` and root `ads.txt`. Added Google's account-verification meta tag to the three landing pages. The company homepage and Help Line public landing page already contained one AdSense loader each.

Added a substantive public Home Visits preparation guide at `/petassist-local/guide/` with the same publisher loader. The original `/petassist-local/` remains the request/private-visit route with its restrictive CSP and no advertising or analytics scripts. The publisher meta tag is inert and does not load ads. Booking forms, visit messages, payments, client JavaScript, Cloudflare services, and the native app were not changed.

Added matching sponsor inquiry pages at `/advertise/`, `/petassist-local/advertise/`, and `/paws-whiskers/advertise/`, linked from each brand's footer. They describe a quoted 30-day public placement and open an email draft to the existing business contact; no message is sent automatically. No active sponsor, fee, traffic, sale, or earnings is fabricated. `SPONSOR_OFFER.md` holds the owner offer, unsent outreach draft, and fulfillment template. Added sponsor privacy disclosures to all three privacy pages and updated the sitemap.

### Validation before publication
Live starting state: all three landing pages and root ads.txt returned HTTP 200. Publisher IDs matched between the two existing ad loaders and ads.txt. Static checks passed for internal file/anchor links, sponsor mailto recipient/subject/body, unique IDs, sitemap XML, and one correct AdSense loader on each public ad-enabled page. Request form and private portal content were compared byte-for-byte with the prior commit; client JavaScript, payment flow, CSP, and ads.txt were unchanged. `git diff --check` passed. No paid ad click, customer submission, charge, or sponsor email was made.

### Google dashboard work still required
The remote browser reached Google's public AdSense page but could not establish a readable signed-in dashboard. Do not call revenue active or account approval complete based on source code. After secure sign-in, verify that the dashboard's publisher is `pub-4065093972696595`; check `bayareaapps.com` under Sites for Ready and ads.txt Authorized; request review only if needed. The pet services are subdirectories of this domain, not separate AdSense site registrations.

Review Auto ads on the actual desktop/mobile previews; use low density and disable intrusive anchor, vignette, side-rail, and intent overlays for the service experience. Use page exclusions for the exact `/petassist-local/` route (not its full prefix, because the guide is public), privacy pages, and sponsor inquiry pages. Fragments cannot be used as Auto ads exclusions. The private Visits page is protected independently by not loading ad code. Do not add any advertising code to Cloudflare intake, checkout, questions, client accounts, private conversations, or the owner app.

Review and publish the applicable European-regulations certified CMP and US state-regulations messages in Google's Privacy & messaging using the existing site privacy URLs. A privacy policy alone is not a CMP. Check any account/identity/tax/payment requirements in the signed-in dashboard; owner-provided information or direct owner completion may be necessary. No new publisher, bank, payee, or account was created or changed.

Official references: https://support.google.com/adsense/answer/7584263 ; https://support.google.com/adsense/answer/9262311 ; https://support.google.com/adsense/answer/13554116 .
