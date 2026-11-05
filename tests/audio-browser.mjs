// Verifies browser TTS requests and storage behavior; this does not assess audible pronunciation.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.TARA_BASE_URL||'http://127.0.0.1:4173/';
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  const synth=new EventTarget();let available=[];
  window.ttsCalls=[];synth.getVoices=()=>available;synth.cancel=()=>{};
  synth.speak=u=>{window.ttsCalls.push({text:u.text,lang:u.lang,rate:u.rate,voice:u.voice?.name||null});};
  window.loadTestVoice=()=>{available=[{name:'Test Tagalog',lang:'tl-PH',localService:true}];synth.dispatchEvent(new Event('voiceschanged'));};
  Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'Let’s do this'}).click();
 const listen=page.getByRole('button',{name:'Listen to Kumusta ka?',exact:true});assert(await listen.isEnabled());
 await listen.click();let calls=await page.evaluate(()=>ttsCalls);assert.equal(calls[0].lang,'fil-PH');assert.equal(calls[0].text,'Kumusta ka?');
 await page.getByRole('button',{name:'Listen slowly to Kumusta ka?',exact:true}).click();calls=await page.evaluate(()=>ttsCalls);assert.equal(calls.at(-1).rate,.65);
 await page.evaluate(()=>loadTestVoice());await listen.click();calls=await page.evaluate(()=>ttsCalls);assert.equal(calls.at(-1).lang,'tl-PH');assert.equal(calls.at(-1).voice,'Test Tagalog');
 await page.getByRole('button',{name:'Leave lesson'}).click();await page.getByRole('dialog').getByRole('button',{name:'Continue'}).click();
 await page.getByRole('link',{name:'Phrasebook',exact:true}).click();await page.getByRole('searchbox').fill('rice');assert.equal(await page.locator('.word-row').count(),1);
 await page.evaluate(()=>loadTestVoice());assert.equal(await page.getByRole('searchbox').inputValue(),'rice');
 await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Save progress on this device'}).click();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1')));assert.equal(stored.version,1);
 await page.reload();await page.getByRole('button',{name:'Save progress on this device'}).waitFor();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('tara-progress-v1'))),stored);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='tara-progress-v1')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,k,v);};});
 await page.getByRole('button',{name:'Save progress on this device'}).click();assert((await page.locator('#toast').innerText()).includes('Storage is unavailable'));
 assert.deepEqual(errors,[]);await context.close();console.log('Browser TTS/storage QA passed: empty and late voice lists, normal/slow playback, lesson and phrasebook controls, search preserved, explicit localStorage save/restore, full-storage failure.');
}finally{await browser.close();}
