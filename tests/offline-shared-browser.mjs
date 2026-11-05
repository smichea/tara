// The private deployment downloads its recordings from the shared public library.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:4173/');
 const urls=await page.evaluate(async()=>{
  await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));
  const {createOfflineLibrary,lessonAssets}=await import('./offline.js');
  const c=await(await fetch('./courses/fr-en.json')).json(),lesson=c.lessons.at(-1);
  const baseURI='https://tara-filipino-marco.manaty.chatgpt.site/';
  const env={caches,crypto,navigator,document:{baseURI},fetch:fetch.bind(window)};
  const library=createOfflineLibrary(env);await library.download(c,lesson);
  if((await library.inspect(c,lesson)).state!=='ready')throw Error('Download incomplete');
  return lessonAssets(c,lesson,baseURI).assets.map(a=>a.url);
 });
 assert.equal(urls.length,6);assert(urls.every(u=>u.startsWith('https://smichea.github.io/tara/audio/fr/')));
 await context.setOffline(true);
 const responses=await page.evaluate(async urls=>Promise.all(urls.map(async url=>{const r=await fetch(url,{headers:{Range:'bytes=0-511'}});return {status:r.status,length:(await r.arrayBuffer()).byteLength};})),urls);
 for(const r of responses){assert.equal(r.status,206);assert.equal(r.length,512);}
 console.log('Private-library downloads QA passed: all six real French recordings verified over CORS and served as offline byte ranges.');
}finally{await browser.close();}
