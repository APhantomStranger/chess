const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXE='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
(async()=>{
  // serve a parent folder so the app sits at /chess/, exactly like GitHub Pages
  const srv=spawn('python3',['-m','http.server','8767','--directory','/tmp/pagesim'],{stdio:'ignore'}); await sleep(800);
  const ctx=await chromium.launchPersistentContext('/tmp/pwprof2',{executablePath:EXE,args:['--no-sandbox'],viewport:{width:412,height:915}});
  const p=await ctx.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://localhost:8767/chess/'); await p.waitForTimeout(1500);
  await p.evaluate(()=>navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(1200);
  const cdp=await ctx.newCDPSession(p);
  const man=await cdp.send('Page.getAppManifest');
  const err=await cdp.send('Page.getInstallabilityErrors');
  console.log('served at        : /chess/  (GitHub Pages style sub-path)');
  console.log('manifest url     :', man.url);
  console.log('manifest errors  :', JSON.stringify(man.errors));
  console.log('start_url        :', man.parsed && man.parsed.startUrl);
  console.log('installability   :', JSON.stringify(err.installabilityErrors));
  console.log('pieces on board  :', await p.evaluate(()=>document.querySelectorAll('.piece').length));
  console.log('sw controlling   :', await p.evaluate(()=>!!navigator.serviceWorker.controller));
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(900);
  console.log('offline pieces   :', await p.evaluate(()=>document.querySelectorAll('.piece').length));
  await ctx.setOffline(false);
  await p.goto('http://localhost:8767/chess/chess-pwa/chess-pwa/index.html'); await p.waitForTimeout(900);
  console.log('old path lands on:', new (require('url').URL)(p.url()).pathname);
  await ctx.close(); srv.kill();
})();
