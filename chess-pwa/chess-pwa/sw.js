/* the app moved to the site root; this worker retires itself */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.registration.unregister()); });
self.addEventListener('fetch', function(){});
