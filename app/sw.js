'use strict';
const CACHE = 'baa-public-app-v1';
const SHELL = ['/app/','/app/app.css','/app/app.js','/app/manifest.webmanifest','/app/icons/icon-512.png','/app/icons/icon-1024.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('baa-public-app-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only the public app shell is cached. Never intercept private workspaces,
  // forms, payment requests, catalog data, query strings, or third-party traffic.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !SHELL.includes(url.pathname)) return;
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (!response.ok || response.redirected) throw Error('Public app unavailable');
      try { await cache.put(event.request,response.clone()); } catch { /* Online use survives storage failure. */ }
      return response;
    } catch {
      const saved = await cache.match(event.request);
      return saved || new Response('Bay Area Apps is unavailable. Connect to the internet and try again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
