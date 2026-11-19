/* Public chapters and immutable Next assets only. Admin routes always go to the network. */
const shell = "nightfolio-shell-v2";
const prefix = "nightfolio-chapter-v2:";
const maximumChapters = 3;
const saving = new Map();

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith("nightfolio-") && key !== shell && !key.startsWith(prefix)) await caches.delete(key);
  }
  await self.clients.claim();
})()));

function navigationKey(url) {
  return url.origin + url.pathname;
}

function isChapter(url) {
  return /^\/read\/[a-z0-9-]+\/[a-z0-9-]+$/.test(url.pathname);
}

function isArtwork(url) {
  return /^\/api\/art\/[a-f0-9-]+\/(?:full|thumb)$/.test(url.pathname);
}

function isBundle(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

async function saveBundles(cache, html, entries = []) {
  const page = await html.clone().text();
  const bundles = new Set([...entries, ...Array.from(page.matchAll(/"(\/_next\/static\/[^"\s]+\.(?:js|css)(?:\?[^"]*)?)"/g), (m) => m[1])]);
  await Promise.all([...bundles].map(async (item) => {
    const asset = new URL(item, self.location.origin);
    if (!isBundle(asset) || await cache.match(asset.href)) return;
    const response = await fetch(asset.href);
    if (response.ok) await cache.put(asset.href, response);
  }));
}

async function saveOfflineEntryPoints(cache) {
  return Promise.all(["/", "/shelf"].map(async (path) => {
    const address = self.location.origin + path;
    if (await cache.match(address)) return;
    const html = await fetch(address, { credentials: "omit" });
    if (!html.ok || !html.headers.get("content-type")?.includes("text/html")) return;
    await saveBundles(cache, html);
    await cache.put(address, html);
  }));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isBundle(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(shell);
      const cached = await cache.match(request);
      if (cached) return cached;
      const result = await fetch(request);
      if (result.ok) await cache.put(request, result.clone()).catch(() => {});
      return result;
    })());
  } else if (request.mode === "navigate" && (isChapter(url) || ["/", "/shelf"].includes(url.pathname))) {
    event.respondWith((async () => {
      try {
        const result = await fetch(request);
        if (result.ok && !isChapter(url)) {
          const cache = await caches.open(shell);
          await cache.put(navigationKey(url), result.clone()).catch(() => {});
        }
        return result;
      } catch {
        return await caches.match(navigationKey(url)) ?? Response.error();
      }
    })());
  } else if (isArtwork(url)) {
    event.respondWith(fetch(request).catch(async () => await caches.match(navigationKey(url)) ?? Response.error()));
  }
});

async function saveChapter({ path, revision, artwork, entries }) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || !isChapter(url) || artwork.length > 251) return false;
  const key = prefix + url.pathname + ":" + Number(revision);
  if (saving.has(key)) return saving.get(key);
  const save = (async () => {
    const cache = await caches.open(key);
    const documentUrl = navigationKey(url);
    const existing = await cache.match(documentUrl);
    const images = artwork.map((item) => new URL(item, self.location.origin)).filter((item) =>
      item.origin === self.location.origin && isArtwork(item));
    if (existing && (await cache.keys()).length === new Set(artwork).size + 1) return true;
    const html = await fetch(documentUrl, { credentials: "omit" });
    if (!html.ok || !html.headers.get("content-type")?.includes("text/html")) return false;

    const staticCache = await caches.open(shell);
    await saveBundles(staticCache, html, entries);
    const entryPoints = saveOfflineEntryPoints(staticCache).catch(() => {});

    let index = 0;
    const transfer = async () => {
      while (index < images.length) {
        const src = navigationKey(images[index++]);
        if (await cache.match(src)) continue;
        const response = await fetch(src, { mode: "cors", credentials: "omit", priority: "low" });
        if (!response.ok || !response.headers.get("Content-Type")?.startsWith("image/")) throw new Error("Artwork unavailable");
        const image = await response.blob();
        await cache.put(src, new Response(image, { headers: { "Content-Type": image.type } }));
      }
    };
    await Promise.all([transfer(), transfer(), transfer()]);
    await entryPoints;
    await cache.put(documentUrl, html);
    const other = (await caches.keys()).filter((name) => name.startsWith(prefix) && name !== key && !saving.has(name));
    const versions = other.filter((name) => name.startsWith(prefix + url.pathname + ":"));
    const older = other.filter((name) => !versions.includes(name));
    await Promise.all([...versions, ...older.slice(0, Math.max(0, older.length - maximumChapters + 1))]
      .map((name) => caches.delete(name)));
    return true;
  })().catch(() => false).finally(() => saving.delete(key));
  saving.set(key, save);
  return save;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "chapter" && event.ports[0]) {
    event.waitUntil(saveChapter(event.data).then((ok) => event.ports[0].postMessage({ ok })));
  }
});
