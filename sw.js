// Zeit PWA Service Worker (robust, SVG-first, caches favicon)
// - Install never fails if one asset 404s
// - Cleans old caches
// - Cache-first for same-origin, network fallback
// - Offline fallback to index.html for navigations

const CACHE = "zeit-pwa-20260227-svg-2";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Do not fail the whole install if a single file fails (404, etc.)
    await Promise.allSettled(
      ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" })))
    );

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    // Cache-first
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);

      // Cache successful same-origin responses
      const url = new URL(req.url);
      if (res && res.ok && url.origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone()).catch(() => {});
      }

      return res;
    } catch (err) {
      // Offline fallback for page navigations
      if (req.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});