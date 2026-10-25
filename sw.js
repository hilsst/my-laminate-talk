// My Laminate Talk offline cache. Page: network first (updates arrive), everything else: cache first.
const VER = "mlt-b8bd328764";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "ort/ort.min.js", "ort/ort-wasm-simd.wasm", "tts/phonemizer.js", "tts/voice.json", "tts/voice0.wasm", "tts/voice1.wasm",
  "audio/common.json", "vendor/supabase.mjs"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mlt-") && k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.endsWith("supabase.co")) return;
  const isPage = req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith("/index.html"));
  if (isPage) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VER).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  const cacheable = url.origin === location.origin || url.hostname === "esm.sh" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(VER).then(x => x.put(req, c)); }
    return r;
  })));
});
