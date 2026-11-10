const BASE = "/personal-planner/";
const CACHE = "personal-planner-shell-v1";
const PAGES = [BASE, `${BASE}test/`, `${BASE}scenarios/`, `${BASE}import/`, `${BASE}completed/`];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const assets = new Set([`${BASE}manifest.webmanifest`, `${BASE}icon-192.png`, `${BASE}icon-512.png`, `${BASE}fonts/Vazirmatn-VariableFont_wght.ttf`]);
    await Promise.all(PAGES.map(async page => {
      try {
        const response = await fetch(page, { cache: "reload" });
        if (!response.ok) return;
        await cache.put(page, response.clone());
        const html = await response.text();
        for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
          const url = new URL(match[1], self.location.origin);
          if (url.origin === self.location.origin && url.pathname.startsWith(BASE) && url.pathname.includes("/_next/")) assets.add(url.href);
        }
      } catch { /* Offline installation can retry on the next online visit. */ }
    }));
    await Promise.all([...assets].map(async url => { try { await cache.add(url); } catch { /* Optional asset */ } }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith("personal-planner-shell-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try { const response = await fetch(request); if(response.ok) await cache.put(request,response.clone()); return response; }
      catch { return await cache.match(request) || await cache.match(url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`) || await cache.match(BASE) || Response.error(); }
    })());
  } else {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try { const response = await fetch(request); if(response.ok) await cache.put(request,response.clone()); return response; }
      catch { return Response.error(); }
    })());
  }
});
