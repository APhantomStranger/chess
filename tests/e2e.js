const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const DIR = process.argv[2] || '.';                       // what to serve: repo root by default
const VER = require('fs').readFileSync('build.py','utf8').match(/VERSION = '([^']+)'/)[1];
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ok  ',m);} else {fail++;console.log('  FAIL',m);} };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const srv = spawn('python3',['-m','http.server','8765','--directory',DIR],{stdio:'ignore'}); await sleep(800);
  const APP_URL='http://localhost:8765/index.html';
  const b = await chromium.launch({executablePath:EXE, args:['--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
  const errs=[];
  let p;
  const newPage=async()=>{const pg=await ctx.newPage(); pg.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)}); await pg.goto(APP_URL); await pg.waitForTimeout(600); return pg;};
  p = await newPage();
  const ev=(f,a)=>p.evaluate(f,a);
  const idx=n=>(8-(+n[1]))*8+'abcdefgh'.indexOf(n[0]);
  const sq=i=>`.sq[data-i="${i}"]`;
  const waitAI=async()=>{ await p.waitForFunction(()=>!aiThinking && !inputLock,null,{timeout:30000}); await p.waitForTimeout(950); };
  const mv=async(a,c)=>{ await p.click(sq(idx(a))); await p.click(sq(idx(c))); await waitAI(); };

  console.log('[boot]');
  ok(await ev(()=>document.querySelectorAll('.piece').length)===32,'32 pieces');
  ok((await ev(()=>document.querySelector('.ver').textContent))===VER,`version ${VER} shown`);
  await ev(()=>{ const d=document.getElementById('difficulty'); d.value='1'; d.dispatchEvent(new Event('change')); });

  console.log('[slower opponent]');
  const t0 = Date.now();
  await p.click(sq(idx('e2'))); await p.click(sq(idx('e4')));
  await p.waitForTimeout(400);
  ok(await ev(()=>aiThinking)===true,'computer shows "thinking" after your move');
  ok(await ev(()=>history.length)===1,'computer has NOT moved 400ms in');
  await p.waitForFunction(()=>history.length>=2,null,{timeout:30000});
  const dt = Date.now()-t0;
  ok(dt>=1900,`computer waited ${dt}ms before replying (>=1900)`);
  ok(await ev(()=>document.querySelector('.pieces').classList.contains('slow')),'computer move uses the slow glide');
  const dur = await ev(()=>getComputedStyle(document.querySelector('.piece')).transitionDuration);
  ok(parseFloat(dur)>=0.6,`piece transition during computer move = ${dur}`);
  await waitAI();
  await p.click(sq(idx('d2'))); await p.click(sq(idx('d4'))); await p.waitForTimeout(120);
  ok(!(await ev(()=>document.querySelector('.pieces').classList.contains('slow'))),'your own move stays quick');
  await waitAI();

  console.log('[longer opening lines]');
  await p.click('#guideSwitch');
  await p.selectOption('#openingSel','scotch');
  ok((await ev(()=>getOpening().tokens.length))===20,'Scotch line is 20 plies');
  ok((await ev(()=>OPENINGS.every(o=>o.tokens.length>=16))),'every line is at least 16 plies');
  ok((await ev(()=>OPENINGS.every(o=>o.history&&o.when&&o.idea&&o.eco))),'every opening has history/when/idea/eco');
  await p.click('#btnNew'); await p.waitForTimeout(400);
  const barTxt = await ev(()=>document.getElementById('guideBarTxt').textContent);
  ok(/step 1 of 10/.test(barTxt),'guide counts 10 of your moves: '+barTxt.slice(0,46));

  console.log('[history & theory]');
  ok(await ev(()=>document.getElementById('theoryOverlay').classList.contains('show'))===false,'theory modal starts closed');
  await p.click('#btnTheory'); await p.waitForTimeout(250);
  ok(await ev(()=>document.getElementById('theoryOverlay').classList.contains('show')),'button opens the theory modal');
  const tt = await ev(()=>({t:document.getElementById('theoryTitle').textContent, e:document.getElementById('theoryEyebrow').textContent, b:document.getElementById('theoryBody').textContent}));
  ok(tt.t==='Scotch Game','title is the selected opening');
  ok(/ECO C44/.test(tt.e),'eyebrow shows ECO code: '+tt.e);
  ok(/History/.test(tt.b)&&/When to play it/.test(tt.b)&&/The idea behind it/.test(tt.b),'all three sections present');
  ok(/Edinburgh/.test(tt.b),'history text rendered');
  ok(/1\. e4 e5/.test(tt.b),'numbered move list rendered');
  await p.screenshot({path:'shot_theory.png'});
  await p.keyboard.press('n'); await p.waitForTimeout(250);
  ok(await ev(()=>document.getElementById('theoryOverlay').classList.contains('show')),'keyboard shortcuts ignored while modal is open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok(!(await ev(()=>document.getElementById('theoryOverlay').classList.contains('show'))),'Escape closes it');
  await p.click('#btnTheory'); await p.waitForTimeout(200); await p.click('#theoryClose'); await p.waitForTimeout(200);
  ok(!(await ev(()=>document.getElementById('theoryOverlay').classList.contains('show'))),'Close button works');
  await p.selectOption('#openingSel','french'); await p.click('#btnTheory'); await p.waitForTimeout(250);
  ok((await ev(()=>document.getElementById('theoryTitle').textContent))==='French Defense','modal follows the dropdown');
  ok((await ev(()=>document.getElementById('theoryEyebrow').textContent)).includes('Black defense'),'French labelled a Black defense');
  await p.click('#theoryClose');

  console.log('[guide still plays the book]');
  await p.selectOption('#openingSel','italian'); await p.click('#btnNew'); await p.waitForTimeout(400);
  await mv('e2','e4');
  ok(await ev(()=>history[1].san)==='e5','computer followed the book');
  ok(await ev(()=>document.querySelectorAll('.gm.from').length)===1,'next book move highlighted');
  await mv('g1','f3'); await mv('f1','c4');
  ok(await ev(()=>history.map(h=>h.san).join(' '))==='e4 e5 Nf3 Nc6 Bc4 Bc5','book line tracked 6 plies in');

  console.log('[regressions]');
  ok((await ev(()=>document.getElementById('undoTxt').textContent))==='Undo · 1 left','undo label');
  await p.click('#btnUndo'); await p.waitForTimeout(500);
  ok((await ev(()=>document.getElementById('undoTxt').textContent))==='Undo · used','one undo per game still enforced');
  ok(await ev(()=>document.getElementById('btnUndo').disabled),'undo now disabled');
  await p.click('#btnNew'); await p.waitForTimeout(300);
  await ev(()=>{ endGame('win','by checkmate',true); closeEnd(); newGame(); });
  await p.waitForTimeout(200);
  await p.close(); p = await newPage();
  ok((await ev(()=>document.getElementById('stW').textContent))==='1','W/L record survived a relaunch');
  if(await ev(()=>document.getElementById('resumeOverlay').classList.contains('show'))) await p.click('#resumeNo');
  await p.waitForTimeout(300);
  ok(await ev(()=>guideOn)===true && await ev(()=>openingId)==='italian','guide + opening preference remembered');

  console.log('[capture: slow glide + last-capture strip]');
  await p.selectOption('#openingSel','scotch'); await p.click('#btnNew'); await p.waitForTimeout(400);
  await mv('e2','e4'); await mv('g1','f3'); await mv('d2','d4');
  ok((await ev(()=>document.getElementById('lastCapTxt').textContent)).includes('Computer took your pawn on d4'),'last-capture strip after the computer captures');
  ok(await ev(()=>document.querySelectorAll('.piece').length)===31,'captured piece removed after the slow glide finishes');

  console.log('[pwa + layout]');
  const man = await (await fetch('http://localhost:8765/manifest.webmanifest')).json();
  ok(man.display==='standalone','manifest still standalone');
  const sw = await (await fetch('http://localhost:8765/sw.js')).text();
  ok(sw.includes('gambit-chess-'+VER),`service worker cache is gambit-chess-${VER}`);
  await p.evaluate(()=>navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(600);
  ok(await ev(()=>!!navigator.serviceWorker.controller),'service worker controls the page');
  const cdp = await ctx.newCDPSession(p);
  try{ const r = await cdp.send('Page.getInstallabilityErrors'); ok(r.installabilityErrors.length===0,'no installability errors '+JSON.stringify(r.installabilityErrors)); }catch(e){ console.log('  (installability API n/a)'); }
  console.log('[root install + old location]');
  const rootHtml = await (await fetch('http://localhost:8765/index.html')).text();
  ok(/<link rel="manifest" href="manifest\.webmanifest">/.test(rootHtml),'root index.html links the manifest');
  ok(/serviceWorker/.test(rootHtml),'root index.html registers the service worker');
  ok((await fetch('http://localhost:8765/icons/icon-512.png')).ok,'root icons served');
  ok((await fetch('http://localhost:8765/chess.html')).ok,'single-file chess.html still at the root');
  const oldPg = await ctx.newPage();
  await oldPg.goto('http://localhost:8765/chess-pwa/chess-pwa/index.html');
  await oldPg.waitForURL(u=>u.pathname.replace(/index\.html$/,'').endsWith('/'),{timeout:10000}).catch(()=>{});
  await oldPg.waitForTimeout(600);
  const landed = new URL(oldPg.url()).pathname;
  ok(landed==='/' || landed==='/index.html',`old location redirects to the root (landed on ${landed})`);
  ok(await oldPg.evaluate(()=>document.querySelectorAll('.piece').length)===32,'and the game loads there');
  await oldPg.close();
  const retire = await (await fetch('http://localhost:8765/chess-pwa/chess-pwa/sw.js')).text();
  ok(/registration\.unregister\(\)/.test(retire),'old service worker retires itself');
  ok(!/caches\.delete/.test(retire),'old service worker does not clear the shared cache storage');

  for(const [w,h] of [[360,740],[412,915],[1280,900]]){
    const pg = await ctx.newPage(); await pg.setViewportSize({width:w,height:h}); await pg.goto(APP_URL); await pg.waitForTimeout(500);
    const m = await pg.evaluate(()=>({b:Math.round(document.getElementById('board').getBoundingClientRect().width),sw:document.documentElement.scrollWidth,vw:innerWidth}));
    ok(m.sw<=m.vw && m.b>=Math.min(w-30,300),`${w}x${h}: board ${m.b}px, no horizontal scroll`); await pg.close();
  }
  ok(errs.length===0,'no page errors '+errs.join('|'));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); srv.kill(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
