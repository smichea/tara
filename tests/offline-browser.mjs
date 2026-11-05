import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
const profile=await mkdtemp(join(tmpdir(),'tara-pwa-'));
const context=await chromium.launchPersistentContext(profile,{viewport:{width:390,height:844},executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#course-select').selectOption('fr-en');await page.getByRole('link',{name:'Settings',exact:true}).click();
 await page.getByRole('link',{name:'Manage downloads'}).click();
 await page.locator('#download-summary').filter({hasText:'0 lessons downloaded'}).waitFor();
 const lesson='carina-carina-day',row=page.locator(`[data-lesson="${lesson}"]`);
 await page.locator('#download-search').fill('Carina’s French day');
 await row.getByRole('button',{name:'Download',exact:true}).waitFor();await row.getByRole('button',{name:'Download',exact:true}).click();
 await row.getByText('Ready offline',{exact:false}).waitFor();
 assert.equal(await page.locator('[data-lesson]').count(),1);
 assert.match(await row.locator('.download-state').innerText(),/Ready offline · .+ · 6 recordings$/);
 await page.locator('#download-search').fill('');
 await page.screenshot({path:'artifacts/downloads-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Browser installation metadata, including the phone icon sizes, is usable.
 const cdp=await context.newCDPSession(page),manifest=await cdp.send('Page.getAppManifest');
 assert.equal(manifest.errors.length,0);assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,[]);const m=JSON.parse(manifest.data);assert.equal(m.display,'standalone');
 for(const size of ['192x192','512x512'])assert(m.icons.some(i=>i.sizes===size&&i.type==='image/png'));
 // Installation prompt is driven by the browser event and by an explicit tap.
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=async()=>{window.promptWasCalled=true;};e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e);});
 await page.getByRole('button',{name:'Install Tara',exact:true}).click();assert(await page.evaluate(()=>window.promptWasCalled));
 // An app-shell update removes only old shell caches, never chosen lessons.
 await page.evaluate(async()=>{const c=await caches.open('tara-shell-obsolete');await c.put('./obsolete',new Response('old shell'));const registration=await navigator.serviceWorker.ready;await registration.unregister();await navigator.serviceWorker.register('./sw.js?test=upgrade',{type:'module'});});
 await page.waitForFunction(async()=>!(await caches.keys()).includes('tara-shell-obsolete'));
 await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('test=upgrade'));
 await page.evaluate(()=>localStorage.setItem('tara-progress-v1:carina',JSON.stringify({xp:73,cards:{},lessons:{},activity:{},writing:{}})));
 await context.setOffline(true);await page.reload();
 await page.locator('#download-summary').filter({hasText:'1 lesson downloaded'}).waitFor();
 await page.locator('#download-search').fill('Carina’s French day');
 await row.getByText('Ready offline',{exact:false}).waitFor();
 // Check all six recordings, including reading + model response, without having played them online.
 const audioCheck=await page.evaluate(async id=>{
  const c=await(await fetch('./courses/fr-en.json')).json(),l=c.lessons.find(l=>l.id===id);
  const {lessonAssets}=await import('./offline.js'),assets=lessonAssets(c,l,document.baseURI).assets;
  const results=[];for(const a of assets){const r=await fetch(a.url,{headers:{Range:'bytes=0-1023'}});results.push({status:r.status,length:(await r.arrayBuffer()).byteLength});}
  return {results,count:assets.length};
 },lesson);
 assert.equal(audioCheck.count,6);for(const r of audioCheck.results){assert.equal(r.status,206);assert.equal(r.length,1024);}
 await row.getByRole('button',{name:'Study',exact:true}).click();
 await page.evaluate(()=>{const NativeAudio=window.Audio;window.Audio=function(...a){const v=new NativeAudio(...a);window.lastOfflineAudio=v;return v;};});
 const firstAudio=page.locator('[data-action="audio"][data-rate="1"]').first();
 await firstAudio.click();await page.waitForFunction(()=>window.lastOfflineAudio?.currentTime>.1);
 assert.equal(await page.evaluate(()=>window.lastOfflineAudio.error),null);
 await page.getByRole('button',{name:'Leave lesson'}).click();await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await page.locator('#download-summary').filter({hasText:'1 lesson downloaded'}).waitFor();
 await page.locator('#download-search').fill('Carina’s French day');
 await row.getByRole('button',{name:'Remove download:',exact:false}).click();
 await page.locator('#download-summary').filter({hasText:'0 lessons downloaded'}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1:carina')).xp),73);
 // Bulk download applies to the filtered lessons, and keeps course libraries separate.
 await context.setOffline(false);await page.locator('#download-search').fill('royal');
 const count=await page.locator('[data-lesson]').count();assert(count>1&&count<10);
 await page.getByRole('button',{name:'Download shown lessons',exact:true}).click();
 await page.locator('#download-summary').filter({hasText:`${count} lessons downloaded`}).waitFor();
 assert.equal(await page.locator('[data-lesson] .download-state').filter({hasText:'Ready offline'}).count(),count);
 await page.locator('#course-select').selectOption('fil-en');await page.locator('#download-search').fill('');
 await page.locator('#download-summary').filter({hasText:`${count} lessons downloaded`}).waitFor();
 assert.equal(await page.locator('[data-lesson] .download-state').filter({hasText:'Ready offline'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Offline PWA browser QA passed: installation metadata/prompt, mobile layout, explicit six-file lesson download, shell-update survival, offline reload + real ranged audio playback, deletion preserving progress, filtered bulk downloads and course isolation.');
}finally{await context.close();await rm(profile,{recursive:true,force:true});}
