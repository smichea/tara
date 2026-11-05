import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const course=JSON.parse(await readFile(new URL('../dist/courses/fil-en.json',import.meta.url)));
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'C1',exact:true}).click();assert.equal(await page.locator('.lesson').count(),course.lessons.filter(l=>l.level==='C1').length);
 await page.reload();await page.getByRole('button',{name:'C1',exact:true,pressed:true}).waitFor();
 const lesson=course.lessons.find(l=>l.id==='c1-implication');await page.locator('.lesson[data-action=start][data-id=c1-implication]').click();
 for(let i=0;i<6;i++)await page.getByRole('button',{name:i===5?'Read in context':'Got it',exact:i!==5}).click();
 assert((await page.locator('.passage-text').innerText()).includes('tagapangasiwa'));
 await page.getByRole('button',{name:'Let’s practise'}).click();
 let turns=0;
 while(!await page.getByRole('heading',{name:'Your turn to express an idea.'}).count()){
  if(++turns>20)throw new Error('Extended lesson did not reach expression');
  const title=await page.locator('.session-title').innerText(),prompt=await page.locator('.question-prompt').innerText();
  if(title==='Read for meaning.'){
   const q=lesson.reading.questions.find(q=>q.prompt===prompt);assert(q);await page.locator('.choice').filter({hasText:q.options[q.answer]}).click();
  }else if(title==='What does this mean?'){
   const e=lesson.entries.find(e=>e.text===prompt);assert(e);await page.locator('.choice').filter({hasText:e.translation}).click();
  }else{
   const e=lesson.entries.find(e=>e.translation===prompt);assert(e);
   if(title==='Build the phrase.')for(const word of e.text.split(/\s+/))await page.locator('.token-bank').getByRole('button',{name:word,exact:true}).filter({visible:true}).first().click();
   else await page.locator('#answer-input').fill(e.text);
  }
  await page.getByRole('button',{name:'Check answer'}).click();assert.equal(await page.locator('.feedback.bad').count(),0);await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 const response='May pag-aalinlangan ang tagapangasiwa. Hindi nito pinatutunayan ang masamang layon.';
 await page.getByLabel('Your response in Filipino').fill(response);await page.getByRole('button',{name:'Save & compare'}).click();
 assert((await page.locator('.reading-card').innerText()).includes('One possible response'));
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1')));assert.equal(stored.writing['fil-en:c1-implication'].text,response);
 assert(!stored.lessons['fil-en:c1-implication']);
 await page.getByRole('button',{name:'Finish lesson'}).click();await page.getByRole('button',{name:'Back to your path'}).click();
 assert.equal(await page.locator('.lesson.done').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/curriculum-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'Community',exact:true}).click();await page.getByRole('button',{name:'Improve this course'}).click();await page.getByLabel('Your attribution / contributor name').fill('QA contributor');
 await page.selectOption('#editor-lesson-picker',String(course.lessons.indexOf(lesson)));
 await page.getByLabel('Lesson title',{exact:true}).fill('Read a cautious response');
 await page.getByRole('button',{name:'Export JSON'}).click();
 // Validate by reading the saved draft as well: editing one lesson must preserve hidden lessons.
 const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-draft-v1')));assert.equal(draft.lessons.length,course.lessons.length);assert.equal(draft.lessons[0].entries[0].text,'Kumusta ka?');assert.equal(draft.lessons.find(l=>l.id===lesson.id).reading.text,lesson.reading.text);
 await page.getByRole('link',{name:'Learn',exact:true}).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await page.context().setOffline(true);await page.reload();await page.getByRole('button',{name:'C1',exact:true,pressed:true}).waitFor();assert.equal(await page.locator('.lesson.done').count(),1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1')).writing['fil-en:c1-implication'].text),response);
 assert.deepEqual(errors,[]);console.log('Curriculum browser QA passed: level persistence, full C1 reading/comprehension/expression lesson, saved writing, no false vocabulary cards, paged editor preservation, mobile and offline.');
}finally{await browser.close();}
