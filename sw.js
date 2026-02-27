// Robust PWA Service Worker for GitHub Pages
// - caches core files
// - DOES NOT fail installation if one asset 404s
// - cleans up old caches
// - serves cache-first with network fallback

const CACHE = "zeit-pwa-20260227-1";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",

  // Icons (these SHOULD exist; if not, install still succeeds)
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",

  // Optional: if you later add it, it will be cached
  "./favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Important: Promise.allSettled makes install robust.
    // Even if one request fails (404), the service worker still installs.
    await Promise.allSettled(
      ASSETS.map(async (url) => {
        try {
          // Use Request with cache: 'reload' to avoid stale HTTP cache
          await cache.add(new Request(url, { cache: "reload" }));
        } catch (err) {
          // Ignore single asset failures
        }
      })
    );

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Remove old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));

    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
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
      // Offline fallback: give cached index.html for navigation requests
      if (req.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});