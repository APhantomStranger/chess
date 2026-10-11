/* Chess service worker v2.0.0 */
const CACHE = 'gambit-chess-2.0.0';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
self.addEventListener('install', function(e){ e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); })); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k.indexOf('gambit-chess-')===0 && k!==CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);
  if(req.mode==='navigate'){                         // network first, fall back to the cached app
    e.respondWith(fetch(req).then(function(r){ const cp=r.clone(); caches.open(CACHE).then(function(c){ c.put('index.html', cp); }); return r; })
      .catch(function(){ return caches.match('index.html').then(function(r){ return r || caches.match('./'); }); }));
    return;
  }
  if(url.origin===location.origin){                  // cache first for our own files
    e.respondWith(caches.match(req).then(function(r){ return r || fetch(req).then(function(n){ const cp=n.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }); return n; }); }));
    return;
  }
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){   // fonts: stale-while-revalidate
    e.respondWith(caches.open(CACHE).then(function(c){ return c.match(req).then(function(r){
      const net = fetch(req).then(function(n){ c.put(req, n.clone()); return n; }).catch(function(){ return r; });
      return r || net; }); }));
  }
});
