// The private Sites copy uses public vendor URLs. Populate them from local
// pinned bytes, then prove worker module imports/inference work with no network.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto(process.env.TARA_BASE_URL||'http://127.0.0.1:4173/');
 const root=await page.evaluate(async()=>{
  await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));
  const {createSpeakingDownloads}=await import('./pronunciation/assets.js');
  const baseURI='https://tara-filipino-marco.manaty.chatgpt.site/';
  const env={caches,crypto,navigator,document:{baseURI},fetch:(value,options)=>{const url=new URL(value);let local;if(url.origin==='https://smichea.github.io')local=new URL(url.pathname.slice('/tara/'.length),location.href);else local=new URL(url.pathname.slice(1),location.href);return fetch(local,options);}};
  const manager=createSpeakingDownloads(env);await manager.download();if(!(await manager.inspect()).ready)throw Error('Download incomplete');return manager.root;
 });
 assert.equal(root,'https://smichea.github.io/tara/pronunciation/vendor/');await context.setOffline(true);
 const result=await page.evaluate(async root=>{
  const worker=new Worker('./pronunciation/engine-worker.js',{type:'module'}),pending=new Map();let id=0;
  worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}};worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));};
  const call=(type,args={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});worker.postMessage({id,type,...args});});
  try{await call('init',{root});const plan=await call('plan',{text:'grille',language:'fr'}),synth=await call('synthesize',{phones:plan.expected,language:'fr'});return {phones:plan.expected.map(p=>p.phone).join(''),samples:synth.pcm.length};}finally{worker.terminate();}
 },root);
 assert.equal(result.phones,'gʁij');assert(result.samples>1000);console.log('Private speaking-library QA passed: verified shared URLs, offline cross-origin module/WASM/data imports, French phonemizer and phoneme-driven synthesis.');
}finally{await browser.close();}
