# Help Line website deployment

The client website is published directly from `paws-whiskers/` in this repository at https://bayareaapps.com/paws-whiskers/. The company homepage already links there. GitHub Pages publishes `main`.

The approved website resources come from the Vet-Assistant-Help-Line repository static site build (`node scripts/build-site.mjs`). Keep the relative asset tree intact when syncing. Owner credentials are never included in this repository.

New website requests use `https://vet-helpline-development.bayareaapps-paws.workers.dev`, the relay used by the current owner app. Its verified private conversation receipt stays at `https://paws-whiskers-care-line.bayareaapps-paws.workers.dev/conversation.html`. That page uses the same current relay.

Existing private links at `paws-whiskers/conversation.html` and the older `paws-whiskers-care-line.dkjmmz6whh.workers.dev` domain retain the older `vet-helpline-development.dkjmmz6whh.workers.dev` relay. These relays have separate conversation storage. Keep the company conversation page and its API origin unchanged for those existing links; this intake routing change does not migrate their records or make them accessible in the current owner app. Do not redirect current private receipts into the legacy company conversation page.

The Help Line service worker is scoped to this directory and only removes its own `paws-whiskers-help-line-` caches. Never clear every cache on the shared company origin. Private conversations and API responses are not cached.

Existing guide, sponsorship, and website/privacy/contact pages remain available. Service privacy terms are published separately at `privacy.html`; the website/sponsor notice remains at `privacy/`. Home Visits and company-wide resources remain independent.
