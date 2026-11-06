// 오프라인에서도 열리게 하는 서비스 워커.
// 온라인이면 항상 새 파일을 받고(업데이트 바로 반영), 오프라인이면 저장해 둔 파일을 씀.
// 같은 주소(kkonoo.github.io)의 다른 앱과 캐시 저장소를 같이 쓰므로 이름을 다르게, 남의 캐시는 지우지 않기
const CACHE = 'equip-hub-v1';
const SHELL = [
  './', 'index.html', 'admin.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/equipment.js', 'js/sync.js', 'js/firebase-config.js', /* 새 js 파일은 여기에 꼭 추가 */
  'icons/app-192.png', 'icons/app-512.png', 'icons/app-maskable-192.png', 'icons/app-maskable-512.png',
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { cacheName: CACHE }))
  );
});
