#!/usr/bin/env python3
"""Build "Chess - The Club Table".

Edit src/shell.html (markup, CSS, UI logic) and src/core.js (engine + AI), then:

    python3 build.py

which regenerates, from one source:
    chess.html                  single self-contained file (icons inlined)
    index.html                  same file, served at the repo root
    chess-pwa/chess-pwa/        installable PWA (manifest + service worker)
    dist/chess-pwa.zip          the same folder, zipped, for handing over

Tests:  node tests/openings.js     every book line is legal in the engine
        node tests/e2e.js          full browser suite (needs playwright-core)
"""
import base64, json, os, shutil, zipfile

VERSION = '2.1.0'
R = os.path.dirname(os.path.abspath(__file__))   # repo root
REPO = R

def rd(p, mode='r'):
    kw = {} if mode == 'rb' else {'encoding': 'utf-8'}
    return open(os.path.join(R, p), mode, **kw).read()

def b64(p):
    return base64.b64encode(rd(p, 'rb')).decode()

shell = rd('src/shell.html')
core = rd('src/core.js')
assert '</script' not in core

icon192, icon512 = b64('assets/icon-192.png'), b64('assets/icon-512.png')
fav, apple = b64('assets/favicon-32.png'), b64('assets/apple-touch-icon.png')

MANIFEST = {
    "id": "./", "name": "Chess — The Club Table", "short_name": "Chess",
    "description": "Single-player chess against the computer.",
    "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#171210", "theme_color": "#171210",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}

HEAD_SINGLE = f'''<meta name="theme-color" content="#171210">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Chess">
<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,{fav}">
<link rel="apple-touch-icon" href="data:image/png;base64,{apple}">'''

HEAD_PWA = '''<meta name="theme-color" content="#171210">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Chess">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'''

inline_manifest = dict(MANIFEST)
inline_manifest['icons'] = [
    {"src": "data:image/png;base64," + icon192, "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "data:image/png;base64," + icon512, "sizes": "512x512", "type": "image/png", "purpose": "any"},
]
PWA_JS_SINGLE = '''/* single-file build: best-effort standalone manifest when served over http(s) */
try{
  if(/^https?:$/.test(location.protocol) && !document.querySelector('link[rel=manifest]')){
    const man = %s;
    man.start_url = location.href.split('#')[0]; man.scope = location.href.split('#')[0].replace(/[^/]*$/, ''); man.id = man.start_url;
    const l = document.createElement('link'); l.rel = 'manifest';
    l.href = URL.createObjectURL(new Blob([JSON.stringify(man)], {type:'application/manifest+json'}));
    document.head.appendChild(l);
  }
}catch(e){}''' % json.dumps(inline_manifest)

PWA_JS = '''/* PWA: offline cache via service worker */
try{ if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); }); }catch(e){}'''

SW = '''/* Chess service worker v%(v)s */
const CACHE = 'gambit-chess-%(v)s';
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
  if(/fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)){   // fonts: stale-while-revalidate
    e.respondWith(caches.open(CACHE).then(function(c){ return c.match(req).then(function(r){
      const net = fetch(req).then(function(n){ c.put(req, n.clone()); return n; }).catch(function(){ return r; });
      return r || net; }); }));
  }
});
''' % {'v': VERSION}

README_TXT = f'''Chess — The Club Table  v{VERSION}  (installable app folder)

1. Upload this whole folder to any HTTPS static host (GitHub Pages, Netlify Drop, Cloudflare Pages...).
2. On your Android phone open the page in Chrome. Delete any old Chess shortcut from your home screen first.
3. Chrome menu (three dots) > "Install app" (or tap the "Install app" button at the bottom of the game).
   It then opens full screen as its own app, with the queen icon, and your game + W/L record are kept.
'''


def assemble(head, pwa_js):
    out = (shell.replace('{{HEAD_PWA}}', head)
                .replace('{{CORE}}', core)
                .replace('{{PWA_JS}}', pwa_js)
                .replace('{{VERSION}}', VERSION))
    assert '{{' not in out, [l for l in out.split('\n') if '{{' in l][:3]
    return out


single = assemble(HEAD_SINGLE, PWA_JS_SINGLE)
pwa_html = assemble(HEAD_PWA, PWA_JS)

# ---------- dist ----------
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
open(os.path.join(R, 'dist/chess.html'), 'w', encoding='utf-8').write(single)
pwa = os.path.join(R, 'dist/pwa')
shutil.rmtree(pwa, ignore_errors=True)
os.makedirs(pwa + '/icons')
for n in ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png']:
    shutil.copy(os.path.join(R, 'assets', n), pwa + '/icons/' + n)
open(pwa + '/index.html', 'w', encoding='utf-8').write(pwa_html)
open(pwa + '/manifest.webmanifest', 'w', encoding='utf-8').write(json.dumps(MANIFEST, indent=2, ensure_ascii=False))
open(pwa + '/sw.js', 'w', encoding='utf-8').write(SW)
open(pwa + '/README.txt', 'w', encoding='utf-8').write(README_TXT)

zp = os.path.join(R, 'dist/chess-pwa.zip')
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, fs in os.walk(pwa):
        for f in fs:
            full = os.path.join(root, f)
            z.write(full, 'chess-pwa/' + os.path.relpath(full, pwa))

# ---------- into the git repo, keeping its existing layout ----------
if os.path.isdir(REPO):
    open(os.path.join(REPO, 'chess.html'), 'w', encoding='utf-8').write(single)
    open(os.path.join(REPO, 'index.html'), 'w', encoding='utf-8').write(single)
    rp = os.path.join(REPO, 'chess-pwa/chess-pwa')
    os.makedirs(rp + '/icons', exist_ok=True)
    open(rp + '/index.html', 'w', encoding='utf-8').write(pwa_html)
    open(rp + '/manifest.webmanifest', 'w', encoding='utf-8').write(json.dumps(MANIFEST, indent=2, ensure_ascii=False))
    open(rp + '/sw.js', 'w', encoding='utf-8').write(SW)
    open(rp + '/README.txt', 'w', encoding='utf-8').write(README_TXT)
    for n in ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png']:
        shutil.copy(os.path.join(R, 'assets', n), rp + '/icons/' + n)

print('built v%s | single %d bytes | zip %d bytes' % (VERSION, len(single), os.path.getsize(zp)))
