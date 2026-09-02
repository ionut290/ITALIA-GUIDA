const CACHE = "varga-tour-v14";
const CORE = [
  "/", "/manifest.webmanifest", "/favicon.svg",
  "/images/ai/piazza-maggiore-rinascimento.jpg",
  "/images/ai/bologna-torri-medievali.jpg",
  "/images/ai/san-luca-portico-storico.jpg",
  "/images/ai/nettuno-cinquecento.jpg",
  "/images/ai/santo-stefano-medievale.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || caches.match("/")),
      ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_OFFLINE_PACK") return;
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await Promise.allSettled(CORE.map((url) => cache.add(url)));
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    pages.forEach((client) => client.postMessage({ type: "OFFLINE_PACK_READY" }));
  }));
});
