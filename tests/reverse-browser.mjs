// English for Filipino and French speakers: generated from the existing courses,
// spoken with browser speech synthesis (stubbed here), with separate progress.
import assert from 'node:assert/strict';
const playwright=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright'),chromium=playwright.chromium||playwright.default.chromium;
const browser=await chromium.launch({headless:true,...(process.env.TARA_CHROMIUM?{executablePath:process.env.TARA_CHROMIUM}:{}),args:['--no-sandbox']});
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{window.spoken=[];class U{constructor(t){this.text=t;}}Object.defineProperty(window,'SpeechSynthesisUtterance',{value:U});Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>{window.spoken.push({text:u.text,lang:u.lang,rate:u.rate});setTimeout(()=>u.onend?.(),10);},cancel(){},getVoices:()=>[]}});});
 await page.goto(base);
 const options=await page.locator('#course-select option').allTextContents();
 assert(options.includes('English - from Filipino'));assert(options.includes('English - from French'));
 await page.locator('#course-select').selectOption('en-from-fil');
 await page.getByRole('button',{name:'Let’s do this'}).click();
 assert.equal((await page.locator('.study-text').innerText()).trim(),'How are you?');assert.match(await page.locator('.study-translation').innerText(),/Kumusta ka\?/);
 await page.getByRole('button',{name:'Listen to How are you?',exact:true}).click();await page.getByRole('button',{name:'Listen slowly to How are you?',exact:true}).click();
 const spoken=await page.evaluate(()=>window.spoken);assert.deepEqual(spoken.map(s=>[s.text,s.lang]),[['How are you?','en-US'],['How are you?','en-US']]);assert.equal(spoken[1].rate,.8);
 assert.equal(await page.locator('.microphone-btn').count(),0);
 // Work through the lesson: every exercise answered with the course answer.
 for(let i=0;i<40&&await page.locator('[data-action="learn-next"]').count();i++)await page.locator('[data-action="learn-next"]').click();
 const lesson=(await page.evaluate(async()=>{const r=await import('./reverse.js');const c=await (await fetch('./courses/fil-en.json')).json();return r.reverseCourse(c).lessons[0].entries;}));
 for(let i=0;i<30;i++){
  if(await page.locator('.result').count())break;
  const title=await page.locator('.session-title').innerText(),prompt=(await page.locator('.question-prompt').innerText()).trim();
  if(title.includes('What does this mean')){const e=lesson.find(x=>x.text===prompt);await page.locator('.choice',{hasText:e.translation}).first().click();}
  else if(title.includes('Build')){const e=lesson.find(x=>x.translation===prompt);for(const w of e.text.split(/\s+/))await page.locator('.token-bank .token:not([disabled])',{hasText:w}).first().click();}
  else{const e=lesson.find(x=>x.translation===prompt);await page.locator('#answer-input').fill((e.accepted?.[0]||e.text).toLowerCase());}
  await page.getByRole('button',{name:'Check answer'}).click();assert.match(await page.locator('.feedback').innerText(),/Nice work!/,`${title}: ${prompt}`);
  await page.getByRole('button',{name:/Continue|Finish/}).click();
 }
 await page.locator('.result').waitFor();
 const keys=await page.evaluate(()=>Object.keys(localStorage));assert(keys.includes('tara-progress-v1:en-from-fil'),'English learner progress is separate');
 const marco=await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1')||'null'));assert(!marco||!marco.lessons?.['fil-en:say-hello'],'Marco’s Filipino progress is untouched');
 await page.getByRole('button',{name:/Back to your path/}).click();
 await page.goto(base+'#downloads');await page.locator('main').waitFor();await page.goto(base+'#words');await page.locator('#word-search').fill('thank');assert((await page.locator('#word-list').innerText()).includes('Thank you'));
 await page.goto(base+'#review');assert.equal(await page.locator('#translation-card').count(),0);
 await page.locator('#course-select').selectOption('en-from-fr');await page.goto(base+'#learn');await page.getByRole('button',{name:'Let’s do this'}).click();assert.equal((await page.locator('.study-text').innerText()).trim(),'Hello!');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:new URL('../artifacts/english-from-filipino.png',import.meta.url).pathname,animations:'disabled'}).catch(()=>{});
 assert.deepEqual(errors,[]);console.log('Reverse-course browser QA passed: English from Filipino and French, English speech synthesis, full lesson, separate progress, phrasebook and downloads.');
}finally{await browser.close();}
