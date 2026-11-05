// Optional browser QA: TARA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/browser.mjs
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const course=JSON.parse(await readFile(new URL('../dist/courses/fil-en.json',import.meta.url)));
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
await mkdir('artifacts',{recursive:true});
try{
 await page.goto(base);await page.getByRole('heading',{name:'Your next conversation starts here.'}).waitFor();
 assert.equal(await page.locator('.lesson').count(),12);
 await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Let’s do this'}).click();
 for(let i=0;i<4;i++)await page.getByRole('button',{name:i===3?'Let’s practise':'Got it',exact:i!==3}).click();
 let intentionalMistake=false,turns=0;
 while(!await page.getByRole('heading',{name:'One conversation closer.'}).count()){
  if(++turns>20)throw new Error('Lesson did not finish');
  const title=await page.locator('.session-title').innerText();
  const prompt=await page.locator('.question-prompt').innerText();
  if(title==='What does this mean?'){
   const entry=course.lessons[0].entries.find(e=>e.text===prompt);assert(entry);
   if(!intentionalMistake){const choices=page.locator('.choice');for(let i=0;i<await choices.count();i++){if(!(await choices.nth(i).innerText()).includes(entry.translation)){await choices.nth(i).click();break;}}intentionalMistake=true;}
   else await page.getByRole('button').filter({hasText:entry.translation}).click();
  }else{
   const entry=course.lessons[0].entries.find(e=>e.translation===prompt);assert(entry);
   if(title==='Build the phrase.')for(const word of entry.text.split(/\s+/))await page.locator('.token-bank').getByRole('button',{name:word,exact:true}).filter({visible:true}).first().click();
   else await page.locator('#answer-input').fill(entry.text);
  }
  await page.getByRole('button',{name:'Check answer'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1')));
 assert(progress.xp>=50);assert(progress.lessons['fil-en:say-hello']);assert(Object.values(progress.cards).some(c=>c.mistakes===1));
 await page.getByRole('button',{name:'Back to your path'}).click();await page.reload();await page.locator('.lesson.done').waitFor();
 assert.equal(await page.locator('.lesson.done').count(),1);
 await page.getByRole('link',{name:'Community',exact:true}).click();await page.getByRole('button',{name:'Create a course',exact:true}).click();
 await page.getByLabel('Course title',{exact:true}).fill('Japanese first words');
 await page.getByLabel('Course id',{exact:true}).fill('ja-en');
 await page.getByLabel('Learning language',{exact:true}).fill('Japanese');
 await page.getByLabel('Language code',{exact:true}).fill('ja');
 await page.getByLabel('Your attribution / contributor name').fill('QA contributor');
 await page.getByLabel('Lesson title',{exact:true}).fill('Say hello');
 await page.getByLabel('Practical goal',{exact:true}).fill('Greet a friend in Japanese.');
 await page.getByLabel('Learning-language text',{exact:true}).fill('こんにちは');
 await page.getByLabel('Meaning / translation',{exact:true}).fill('Hello');
 await page.getByRole('button',{name:'Try on my device'}).click();await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await page.getByRole('heading',{name:'Say hello You’ve got this.'}).waitFor();
 assert.equal(await page.locator('#course-select').inputValue(),'ja-en');
 await page.getByRole('button',{name:'Let’s do this'}).click();await page.getByRole('button',{name:'Let’s practise'}).click();
 await page.getByRole('button',{name:'Leave lesson'}).click();await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await page.selectOption('#course-select','fil-en');
 await page.getByRole('link',{name:'Phrasebook',exact:true}).click();await page.getByRole('searchbox').fill('rice');assert.equal(await page.locator('.word-row').count(),1);
 await page.getByRole('link',{name:'Community',exact:true}).click();await page.getByRole('button',{name:'Improve this course'}).click();await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await page.getByLabel('Your attribution / contributor name').fill('QA editor');
 const dlPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const dl=await dlPromise;const exported=JSON.parse(await readFile(await dl.path(),'utf8'));assert.equal(exported.derivedFrom.author,'Tara contributors');assert.equal(exported.lessons.length,12);
 await page.getByRole('link',{name:'Learn',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Your next conversation starts here.'}).waitFor();
 assert.equal(await page.locator('.lesson.done').count(),1);
 await context.setOffline(false);
 assert.deepEqual(errors,[]);console.log('Browser QA passed: lesson with error/retry, persistence, new language, editor export and attribution, search, mobile layout, offline reload.');
}finally{await browser.close();}
