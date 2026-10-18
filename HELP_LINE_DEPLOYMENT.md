# Help Line website deployment

The client website is published directly from `paws-whiskers/` in this repository at https://bayareaapps.com/paws-whiskers/. The company homepage already links there. GitHub Pages publishes `main`.

The approved website resources come from the Vet-Assistant-Help-Line repository static site build (`node scripts/build-site.mjs`). Keep the relative asset tree intact when syncing. The private client conversation is `paws-whiskers/conversation.html`; it calls the existing Help Line API. Owner credentials are never included in this repository.

The API and currently installed native app retain legacy Worker conversation URLs for compatibility. The old static Worker redirects public page requests to this company subdirectory, preserving the private fragment. Do not change the API URL or native identity just to move the public website.

The Help Line service worker is scoped to this directory and only removes its own `paws-whiskers-help-line-` caches. Never clear every cache on the shared company origin. Private conversations and API responses are not cached.

Existing guide, sponsorship, and website/privacy/contact pages remain available. Service privacy terms are published separately at `privacy.html`; the website/sponsor notice remains at `privacy/`. Home Visits and company-wide resources remain independent.
