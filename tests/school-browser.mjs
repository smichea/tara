import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#school');await page.getByRole('heading',{name:'From first words to Grade 8.'}).waitFor();
 assert.equal(await page.locator('.school-stage').count(),8);assert.equal(await page.locator('.lesson').count(),8);
 for(let g=2;g<=8;g++){await page.locator(`.school-stage[data-id="${g}"]`).click();assert.equal(await page.locator('.lesson').count(),g===8?16:8);assert.equal(await page.locator('.unit-heading').count(),4);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.reload();await page.locator('.school-stage[data-id="8"][aria-pressed=true]').waitFor();
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/school-mobile.png',fullPage:true});
 await page.locator('.school-stage[data-id=foundations]').click();await page.locator('.lesson[data-id=foundation-vowels]').click();
 assert((await page.locator('.study-text').innerText()).includes('A, e, i, o, u.'));assert(await page.getByRole('button',{name:'Listen to A, e, i, o, u.',exact:true}).isEnabled());
 await page.getByRole('button',{name:'Leave lesson'}).click();await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await page.goto(base+'#play');await page.getByRole('heading',{name:'Make it a shared challenge.'}).waitFor();
 await page.selectOption('#quiz-selection','school-8');const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Download questions'}).click();const bank=JSON.parse(await readFile(await (await dl).path()));assert.equal(bank.questions.length,64);assert(bank.questions.every(q=>q.answers.length===4));
 const game=page.waitForEvent('download');await page.getByRole('link',{name:'Download game pack'}).click();const pack=JSON.parse(await readFile(await (await game).path()));assert(pack.engine.includes('RetroQuizBank'));assert(pack.licenseText.includes('CC BY-SA 4.0'));
 await page.reload();await page.locator('#quiz-selection').waitFor();assert.equal(await page.locator('#quiz-selection').inputValue(),'school-8');
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'#school');assert.equal(await page.locator('.hero-art>g').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]);console.log('School/museum browser QA passed: all preceding stages, quarter grouping, persistence, mobile overflow, enabled voice-selected school audio, grade-specific bank/game downloads and reduced motion.');
}finally{await browser.close();}
