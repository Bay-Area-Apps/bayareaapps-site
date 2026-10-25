const CACHE_PREFIX = "paws-whiskers-help-line-";
const CACHE = CACHE_PREFIX + "customer-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./website.css?v=20261025.customer1",
  "./website.js?v=20261025.customer1",
  "./conversation.css?v=20261017.2",
  "./assets/help-line-pets.png",
  "./assets/help-line-pets-illustration.png",
  "./privacy.html",
  "./terms.html",
  "./manifest.webmanifest",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || !ASSETS.some(asset => new URL(asset, self.location).pathname === url.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && !res.headers.get("Cache-Control")?.includes("no-store")) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
