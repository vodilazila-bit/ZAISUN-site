// ZaiSun — Service Worker.
//
// Кешуємо ТІЛЬКИ картинки. Вони не міняються, і саме вони дають вагу сторінки.
//
// Усе інше — index.html, admin.html, data.js, статичні сторінки товарів —
// завжди беремо з мережі. Попередня версія віддавала з кешу будь-який файл
// зі свого домену, тому постійні відвідувачі бачили сайт таким, яким він був
// під час першого візиту: зміни в каталозі й в адмінці до них не доїжджали.
//
// Зміна CACHE_V автоматично стирає всі старі кеші при активації.

const CACHE_V = 'zs-img-v5';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE_V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;           // чужі домени не чіпаємо
  if (!u.pathname.startsWith('/images/')) return;     // усе, крім картинок — мережа
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(r => {
        if (r && r.status === 200) {
          const copy = r.clone();
          caches.open(CACHE_V).then(c => c.put(e.request, copy));
        }
        return r;
      });
    })
  );
});
