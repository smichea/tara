// Real ZIPA/WASM inference and capture, using a prerecorded synthetic French fixture.
// This verifies execution and UI, not human pronunciation accuracy or phone performance.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const temporary=await mkdtemp(join(tmpdir(),'tara-speaking-qa-'));
let fixture=process.env.TARA_SPEECH_FIXTURE;
if(!fixture){fixture=join(temporary,'bonjour.wav');const course=JSON.parse(await readFile(new URL('../dist/courses/fr-en.json',import.meta.url)));execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',new URL('../dist/'+course.lessons[0].entries[0].audio,import.meta.url).pathname,'-af','adelay=400,apad=pad_dur=5','-ar','48000','-ac','1',fixture]);}
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+fixture]});
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
try{
 const context=await browser.newContext({permissions:['microphone'],viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],vendor=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/pronunciation/vendor/'))vendor.push(r.url());});
 await page.addInitScript(()=>{const start=AudioBufferSourceNode.prototype.start;window.speakingPlayback=[];AudioBufferSourceNode.prototype.start=function(...args){window.speakingPlayback.push({sampleRate:this.buffer?.sampleRate,length:this.buffer?.length,args});return start.apply(this,args);};});
 await page.goto(base);await page.locator('#course-select').selectOption('fr-en');await page.getByRole('button',{name:'Let’s do this'}).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 assert.equal(vendor.length,0,'Installation must not fetch any speaking tool');
 await page.getByRole('button',{name:'Practise saying Bonjour !',exact:true}).click();
 await page.getByRole('button',{name:'Download speaking tools',exact:true}).waitFor();assert.equal(vendor.length,0,'Opening the microphone modal must not download tools');
 await page.getByRole('button',{name:'Download speaking tools',exact:true}).click();await page.getByRole('button',{name:'Start speaking',exact:true}).waitFor({state:'visible',timeout:90000});
 await page.waitForFunction(()=>!document.querySelector('[data-speaking="record"]')?.disabled,{timeout:90000});
 assert(vendor.some(url=>url.endsWith('zipa-00.bin')));await page.waitForTimeout(2000);
 await page.getByRole('button',{name:'Start speaking',exact:true}).click();await page.getByRole('button',{name:'Stop & compare',exact:true}).waitFor();
 await page.waitForTimeout(2800);await page.getByRole('button',{name:'Stop & compare',exact:true}).click();await page.getByRole('button',{name:'Try again',exact:true}).waitFor({timeout:45000});
 assert((await page.locator('.speaking-heard').allTextContents()).join('').trim().length>0);assert.equal(await page.locator('.speaking-ipa').count(),0);
 const before=await page.evaluate(()=>speakingPlayback.length);await page.locator('.speaking-original').first().click();await page.waitForTimeout(150);await page.locator('.speaking-heard:not([disabled])').first().click();await page.waitForFunction(n=>speakingPlayback.length>=n+2,before);await page.getByRole('button',{name:'My voice',exact:true}).first().click();
 await page.waitForFunction(n=>speakingPlayback.length>=n+3,before);const playback=await page.evaluate(n=>speakingPlayback.slice(n),before);assert(playback.some(p=>p.sampleRate===22050),'The AI reconstruction must be synthesized, not the raw microphone audio');
 const content=await page.locator('.speaking-results').innerText();assert(!/[ʁʒɔɑ]/u.test(content),'IPA must remain absent from the ordinary UI');
 await page.getByLabel('Advanced: show phonetic details').check();assert(await page.locator('.speaking-ipa').count()>0);await page.getByLabel('Advanced: show phonetic details').uncheck();
 assert(await page.evaluate(()=>document.querySelector('.speaking-dialog').scrollWidth<=document.querySelector('.speaking-dialog').clientWidth+1));
 await page.screenshot({path:new URL('../artifacts/speaking-mobile.png',import.meta.url).pathname,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Close speaking practice'}).click();assert(await page.evaluate(()=>!document.querySelector('dialog.speaking-dialog').open));
 const stored=await page.evaluate(async()=>{const cache=await caches.open('tara-speaking-v1');return (await cache.keys()).length;});assert(stored>=8);
 // Reload as a new app instance, with the network disabled. No second model download.
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Let’s do this'}).click();await page.getByRole('button',{name:'Practise saying Bonjour !',exact:true}).click();
 await page.getByRole('button',{name:'Start speaking',exact:true}).waitFor({timeout:90000});await page.waitForFunction(()=>!document.querySelector('[data-speaking="record"]')?.disabled,{timeout:90000});
 assert.equal(await page.getByRole('button',{name:'Download speaking tools',exact:true}).count(),0);await page.waitForTimeout(1500);await page.getByRole('button',{name:'Start speaking',exact:true}).click();await page.getByRole('button',{name:'Stop & compare',exact:true}).waitFor();await page.waitForTimeout(2200);await page.getByRole('button',{name:'Stop & compare',exact:true}).click();await page.getByRole('button',{name:'Try again',exact:true}).waitFor({timeout:45000});assert(await page.locator('.speaking-heard').count()>0);
 await page.getByRole('button',{name:'Close speaking practice'}).click();await context.setOffline(false);
 await page.getByRole('button',{name:'Leave lesson'}).click();await page.locator('#dialog').getByRole('button',{name:'Continue'}).click();await page.locator('#course-select').selectOption('fil-en');await page.getByRole('button',{name:'Let’s do this'}).click();await page.getByRole('button',{name:'Practise saying Kumusta ka?',exact:true}).click();await page.getByRole('button',{name:'Start speaking',exact:true}).waitFor({timeout:30000});assert.equal(await page.getByRole('button',{name:'Download speaking tools',exact:true}).count(),0);
 await page.getByRole('button',{name:'Remove downloaded speaking tools',exact:true}).click();await page.getByRole('button',{name:'Download speaking tools',exact:true}).waitFor();assert(await page.evaluate(()=>!!localStorage.getItem('tara-selected')));assert.equal(await page.evaluate(()=>document.querySelectorAll('.speaking-ipa').length),0);
 assert.deepEqual(errors,[]);console.log('Speaking browser QA passed: explicit modal download, real ZIPA/WASM inference, microphone capture, three distinct playbacks, default-hidden IPA, mobile layout, offline reload/reuse, both courses and model removal.');
}finally{await browser.close();await rm(temporary,{recursive:true,force:true});}
