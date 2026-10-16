const CACHE_NAME = "gameshot-public-shell-v2";
const ROOT_SHELL = ["/", "/offline.html"];
const NEVER_CACHE_PATH = /^(?:\/api(?:\/|$)|\/(?:auth|oauth)(?:\/|$)|\/(?:checkout|pro|history|exports?|user-images?)(?:\/|$))/i;
const IMMUTABLE_ASSET = /^(?:\/_expo\/static\/(?:css|js|fonts?)\/.+-[a-f0-9]{12,}\.(?:css|js|woff2?|ttf|otf)|\/assets\/.+\.[a-f0-9]{12,}\.(?:png|jpe?g|webp|gif|svg|woff2?|ttf|otf))$/i;

function isCacheableImmutableAsset(request, url) {
  return request.method === "GET" && IMMUTABLE_ASSET.test(url.pathname);
}

function isRootShellNavigation(request, url) {
  return request.method === "GET" && request.mode === "navigate" && url.pathname === "/";
}

function offlinePage() {
  return caches.match("/offline.html");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ROOT_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("gameshot-public-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    request.method !== "GET" ||
    NEVER_CACHE_PATH.test(url.pathname)
  ) {
    return;
  }

  if (isRootShellNavigation(request, url)) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok && response.type !== "opaque") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)));
      }
      return response;
    }).catch(() => caches.match("/").then((cached) => cached || offlinePage())));
    return;
  }

  if (isCacheableImmutableAsset(request, url)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response.ok || response.type === "opaque") return response;
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      return response;
    })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlinePage()));
  }
});
