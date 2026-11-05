import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
try{
 await page.goto(new URL('pronunciation-review/',base).href);await page.waitForFunction(()=>document.querySelectorAll('audio').length===12);
 const metadata=await page.locator('audio').first().evaluate(a=>new Promise((resolve,reject)=>{a.onloadedmetadata=()=>resolve({duration:a.duration});a.onerror=()=>reject(Error('Audio did not decode'));a.load();}));
 assert(metadata.duration>0);
 await page.getByRole('textbox',{name:'Public reviewer name or pseudonym'}).fill('Browser QA fixture');
 for(let i=0;i<4;i++)await page.getByRole('checkbox').nth(i).check();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export review manifest'}).click();const result=JSON.parse(await readFile(await (await download).path()));
 assert.equal(result.items.filter(x=>x.review.status==='approved').length,1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/pronunciation-review-mobile.png',fullPage:true,animations:'disabled'});
 await page.goto(base+'#community');await page.getByRole('link',{name:'Listen to and review the pronunciation pilot'}).waitFor();await page.getByRole('link',{name:'AGPL v3 or later',exact:true}).waitFor();
 const course=await (await page.request.get(new URL('courses/fil-en.json',base).href)).json();assert(course.audioVoiceApprovals.some(a=>a.scope==='voice-pilot'));assert(course.lessons.every(l=>l.entries.every(e=>e.audio&&e.audioReview.scope==='voice-pilot')));
 assert.deepEqual(errors,[]);console.log('Pilot review QA passed: 12 clips, MP3 decoding, mobile layout, per-clip export, AGPL/source link and explicit voice-pilot approval metadata.');
}finally{await browser.close();}
