// Real partial-content media responses after the learning app controls the page.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist');
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+sep))throw Error('path');const body=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');if(range){const start=Number(range[1]),end=Math.min(Number(range[2]||body.length-1),body.length-1);res.writeHead(206,{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`,'Content-Length':end-start+1});res.end(body.subarray(start,end+1));}else res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.TARA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 const samples=await page.evaluate(async()=>{const m=await(await fetch('pronunciation-review/pilot.json')).json();return Promise.all(m.items.map(async i=>{const r=await fetch('pronunciation-review/'+i.file,{headers:{Range:'bytes=0-1023'}});return {status:r.status,length:(await r.arrayBuffer()).byteLength,range:r.headers.get('Content-Range')};}));});
 assert.equal(samples.length,12);for(const s of samples){assert.equal(s.status,206);assert.equal(s.length,1024);assert.match(s.range,/^bytes 0-1023\//);}
 await page.goto(`http://127.0.0.1:${server.address().port}/pronunciation-review/`);await page.locator('audio').first().waitFor();await page.locator('audio').first().evaluate(a=>{a.insertAdjacentHTML('afterend','<button id="test-play">Play sample</button>');document.querySelector('#test-play').onclick=()=>{window.playPromise=a.play();};});await page.locator('#test-play').click();await page.evaluate(()=>window.playPromise);await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1);assert.equal(await page.locator('audio').first().evaluate(a=>a.error),null);
 console.log('Audio service worker QA passed: 12 real HTTP 206 responses and browser playback under service-worker control.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
