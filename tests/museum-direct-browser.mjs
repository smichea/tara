import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const repo=process.env.TARA_MUSEUM_ENGINE;if(!repo)throw Error('Set TARA_MUSEUM_ENGINE to the game-quizz checkout with Tara transfer support.');
const {createGameHost,loadGame}=await import(pathToFileURL(resolve(repo,'node_modules/@manaty/retro-museum-sdk/host.js')));
const {taraRoutes}=await import(pathToFileURL(resolve(repo,'server/tara-transfer.js')));
const {chromium}=await import(process.env.TARA_PLAYWRIGHT_MODULE||'playwright');
const definition=await loadGame(resolve(repo,'dist/game.rmg.json'));let now=1000,host;const clockStart=Date.now();
host=await createGameHost({definitions:[definition],clock:()=>now+Date.now()-clockStart,basePath:'/play',requestHandler:taraRoutes({getHost:()=>host,base:definition.pack,basePath:'/play'})});await new Promise(r=>host.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+host.server.address().port;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[],bodies=[];page.on('pageerror',e=>errors.push(e.message));
 const course=JSON.parse(await readFile('dist/courses/fr-en.json','utf8'));course.id='local-french';course.learnerName='Secret learner name';course.lessons=course.lessons.slice(0,2);const first=course.lessons[0].entries[0];first.text='Bonjour de Tara, les amis !';delete first.glosses;delete first.audio;delete first.audioReview;
 await context.addInitScript(c=>{if(window.top!==window)return;localStorage.setItem('tara-courses-v1',JSON.stringify([c]));localStorage.setItem('tara-selected',JSON.stringify(c.id));localStorage.setItem('tara-progress-v1:carina',JSON.stringify({xp:424,cards:{},lessons:{},activity:{},writing:{}}));},course);
 await page.goto(process.env.TARA_BASE_URL||'http://127.0.0.1:4173/');assert.equal(await page.locator('#course-select').inputValue(),'local-french');await page.getByRole('link',{name:'Play together',exact:true}).click();
 await page.locator('#quiz-selection').selectOption('A1');await page.getByText('Use your own museum host',{exact:true}).click();await page.locator('#museum-host').fill(origin+'/play/');
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Play in Retro Museum',exact:true}).click();const popup=await popupPromise;popup.on('pageerror',e=>errors.push(e.message));
 popup.on('request',r=>{if(r.url().endsWith('/api/tara/rooms'))bodies.push(r.postData());});
 await popup.waitForURL(/\/play\/tara(?:#|$)/);await popup.locator('#preview').waitFor();assert.equal(await popup.evaluate(()=>window.opener),null);
 assert.match(await popup.locator('#quiz-example').innerText(),/Bonjour de Tara, les amis/);assert.equal(await popup.evaluate(()=>location.hash),'');
 await popup.locator('[name="questionCount"]').fill('2');await popup.locator('[name="seconds"]').selectOption('15');await popup.locator('[name="mode"]').selectOption('cooperative');await popup.locator('[name="order"]').selectOption('authored');
 await popup.getByRole('button',{name:'Create our room',exact:false}).click();await popup.waitForURL('**/play/r/*');
 const id=new URL(popup.url()).pathname.split('/').at(-1);assert(/^[a-f0-9]{12}$/.test(id));assert.equal(host.rooms.size,1);assert.equal(host.rooms.get(id).party.options.seconds,15);assert.equal(host.rooms.get(id).party.options.mode,'cooperative');
 assert.equal(bodies.length,1);assert(!bodies[0].includes('Secret learner name'));assert(!bodies[0].includes('"xp"'));assert(!bodies[0].includes('"progress"'));
 assert.deepEqual((await(await fetch(origin+'/play/api/games')).json()).map(g=>g.id),['quizz']);
 await popup.locator('img[alt="QR code"]').waitFor();assert(await popup.locator('img[alt="QR code"]').evaluate(i=>i.complete&&i.naturalWidth>0));
 for(const name of ['Marco','Carina']){const phoneContext=await browser.newContext({viewport:{width:390,height:844}});await phoneContext.addInitScript(n=>{if(window.top!==window)return;localStorage.setItem('museum-player-profile',JSON.stringify({name:n,avatar:null}));},name);const phone=await phoneContext.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(origin+'/play/j/'+id);}
 for(let i=0;i<100&&host.rooms.get(id).party.players.filter(p=>p.connected).length<2;i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(host.rooms.get(id).party.players.filter(p=>p.connected).length,2);now+=100;
 await popup.getByRole('button',{name:'Start game',exact:true}).click();for(let i=0;i<100&&host.rooms.get(id).party.phase==='ready';i++)await new Promise(r=>setTimeout(r,20));now+=4000;host.rooms.get(id).party.tick();
 await popup.frameLocator('.stage iframe').getByText('Bonjour de Tara, les amis !',{exact:false}).waitFor();await popup.screenshot({path:'artifacts/direct-museum-room.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Direct quiz browser QA passed: local draft + exact custom text, one-click Tara popup, no progress transfer, rules retained, mounted host QR, two real phone controllers and catalog isolation.');
}finally{await browser.close();await host.close();}
