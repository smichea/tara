// Real Opus-MT/WASM inference in the browser: explicit download, rule-based and
// model-assisted feedback, self-assessment without the model, offline reuse and removal.
// This verifies execution and UI, not linguistic accuracy (see translation-model.mjs).
import assert from 'node:assert/strict';
const playwright=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright'),chromium=playwright.chromium||playwright.default.chromium;
const browser=await chromium.launch({headless:true,...(process.env.TARA_CHROMIUM?{executablePath:process.env.TARA_CHROMIUM}:{}),args:['--no-sandbox']});
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
const entries={'How are you?':'Kumusta ka?','I’m doing well.':'Mabuti naman.','And you?':'Ikaw?','Thank you!':'Salamat!'};
const english=Object.fromEntries(Object.entries(entries).map(([en,fil])=>[fil,en]));
async function question(page){
 const title=await page.locator('.session-title').innerText(),prompt=(await page.locator('.question-prompt').innerText()).trim();
 return {toTarget:title.includes('Filipino'),prompt};
}
async function answer(page,text){await page.locator('#answer-input').fill(text);await page.getByRole('button',{name:'Check answer'}).click();await page.locator('.feedback').waitFor({timeout:120000});return page.locator('.feedback').innerText();}
async function next(page){await page.getByRole('button',{name:'Continue'}).click();}
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],vendor=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/translation/vendor/'))vendor.push(r.url());});
 await page.goto(base);
 await page.evaluate(()=>{const now=Date.now(),cards={};for(let i=1;i<=4;i++)cards[`fil-en:say-hello-${i}`]={successes:1,due:now+864e5,mistakes:0};localStorage.setItem('tara-selected',JSON.stringify('fil-en'));localStorage.setItem('tara-progress-v1',JSON.stringify({version:1,xp:50,lessons:{'fil-en:say-hello':{accuracy:100,completed:'2026-11-01'}},cards,activity:{},awards:{},writing:{}}));});
 await page.goto(base+'#review');await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 const download=page.getByRole('button',{name:/Download offline checker \(\d+(\.\d)? MB\)/});await download.waitFor();assert.equal(vendor.length,0,'Nothing is downloaded before the learner asks');

 // Without the model: exact answers are checked, other wordings are self-assessed.
 await page.getByRole('button',{name:'Start translating'}).click();
 let q=await question(page),text=await answer(page,q.toTarget?entries[q.prompt]:english[q.prompt]);assert.match(text,/Nice work!/);await next(page);
 q=await question(page);text=await answer(page,q.toTarget?'Paalam':'Goodbye');assert.match(text,/Compare with the course answer/);
 assert(await page.getByRole('button',{name:'Continue'}).isDisabled(),'Self-assessment is required before continuing');
 await page.getByRole('button',{name:'Not this time'}).click();assert.match(await page.locator('.feedback').innerText(),/Counted for another try/);
 await page.getByRole('button',{name:'Leave lesson'}).click();await page.locator('#dialog').getByRole('button',{name:/Leave|Continue/}).first().click();
 assert.equal(vendor.length,0);

 // Explicit download, verified and cached.
 await page.goto(base+'#review');await download.click();await page.getByText('Offline checker ready').first().waitFor({timeout:240000});
 assert(vendor.some(u=>u.endsWith('fil/decoder-00.bin')));
 const stored=await page.evaluate(async()=>(await (await caches.open('tara-translation-v1')).keys()).length);assert(stored>=20);

 async function modelRound(){
  await page.getByRole('button',{name:'Start translating'}).click();
  // A matching answer never needs the model.
  let q=await question(page),t=await answer(page,(q.toTarget?entries[q.prompt]:english[q.prompt]).toLowerCase().replace(/[.!?]/g,''));assert.match(t,/Nice work!/);await next(page);
  q=await question(page);t=await answer(page,q.toTarget?'Paalam na po':'See you tomorrow');
  assert.match(t,/Not quite, it seems|That works!|Compare with the course answer/);assert.match(t,/reads your sentence as|own reading/,'The local model produced a reading');
  if(/Not quite/.test(t)){await page.getByRole('button',{name:'I meant the same, count it'}).click();assert.match(await page.locator('.feedback').innerText(),/Counted as right/);}
  if(/Compare with the course answer/.test(t))await page.getByRole('button',{name:'Not this time'}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal scrolling on a phone');
  await page.screenshot({path:new URL('../artifacts/translation-mobile.png',import.meta.url).pathname,fullPage:true,animations:'disabled'}).catch(()=>{});
  await page.getByRole('button',{name:'Leave lesson'}).click();await page.locator('#dialog').getByRole('button',{name:/Leave|Continue/}).first().click();
 }
 await modelRound();

 // A new app instance without network reuses the stored model.
 await context.setOffline(true);vendor.length=0;await page.goto(base+'#review');await page.getByText('Offline checker ready').first().waitFor();
 await modelRound();await context.setOffline(false);

 await page.goto(base+'#review');await page.getByRole('button',{name:'Remove checker'}).click();await download.waitFor();
 // Translation practice is for the Filipino course only.
 await page.locator('#course-select').selectOption('fr-en');await page.goto(base+'#review');await page.locator('.card').first().waitFor();assert.equal(await page.locator('#translation-card').count(),0);
 await page.locator('#course-select').selectOption('fil-en');await page.goto(base+'#review');await download.waitFor();
 assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('tara-translation-v1')),false);
 assert.deepEqual(errors,[]);console.log('Translation browser QA passed: explicit download, rule-based and self-assessed answers, local model feedback, override, offline reuse, phone layout and removal; absent from the French course.');
}finally{await browser.close();}
