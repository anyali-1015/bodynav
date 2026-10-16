/* 薄肌比例导航 · Service Worker
   页面（index.html）网络优先：在线时总是拿到最新版，离线时用缓存。
   其余资源（3D 网格、动作照片、MediaPipe、three.js、字体）缓存优先：第一次用到时存下来，之后离线也能打开。
   改了 index.html 以外的资源（body.mesh.wasm、ex/、mp/、图标）时，把 VERSION 加一，旧缓存会在下次打开时清掉。 */
const VERSION = 'v1';
const CACHE = 'bodynav-' + VERSION;
const SHELL = [
  './',
  'manifest.webmanifest',
  'body.mesh.wasm',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bodynav-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  // 只缓存正常响应（跨域 CDN 的 opaque 响应也收下）
  if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => put(req, res))
        .catch(() => caches.match(req).then(r => r || caches.match('./')))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
});
