import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {phones,tagalogPhones,letterSpans,makePlan,compare,decodeCTC,synthesisInput} from '../dist/pronunciation/phonetics.js';
import {createSpeakingDownloads,SPEAKING_CACHE,speakingAssetRoot} from '../dist/pronunciation/assets.js';

test('phonetic comparison reports the letters in grille, not IPA, and tolerates declared Tagalog allophones',()=>{
 const plan=makePlan('grille','fr',()=>"ɡ_ʁ_ˈi_j"),heard=['g','ʁ','i','l'].map((phone,i)=>({phone,start:i/10,end:(i+1)/10,confidence:.9}));
 const result=compare(plan,heard).words[0];assert.equal(result.readable,'gril');assert.equal(result.status,'retry');assert.deepEqual(result.changes,[{start:3,end:5}]);
 assert.deepEqual(phones('ʒ_ə-m_a_p_ˈɛ_l'),['ʒ','ə','m','a','p','ɛ','l']);
 const fil=makePlan('ngayon','fil',()=>{throw Error('No foreign-language fallback');});
 const actual=['ŋ','ɐ','j','ɔ','n'].map((phone,i)=>({phone,start:i/10,end:(i+1)/10,confidence:.8}));assert.equal(compare(fil,actual).words[0].status,'close');
 assert.deepEqual(tagalogPhones('mga'),['m','a','ŋ','a']);assert.deepEqual(tagalogPhones('ng'),['n','a','ŋ']);assert.deepEqual(letterSpans('bonjour',['b','ɔ̃','ʒ','u','ʁ'],'fr')[1],{start:1,end:3});
});
test('the recogniser can abstain when it mishears the model; silence and uncertain words are never marked successful',()=>{
 const plan=makePlan('bonjour','fr',()=>"b_ɔ̃_ʒ_ˈu_ʁ");plan.reliability=[false];
 const heard=['b','ɑ̃','ʒ','u','ʁ'].map((phone,i)=>({phone,start:i/10,end:(i+1)/10,confidence:.9}));assert.equal(compare(plan,heard).words[0].status,'uncertain');assert.deepEqual(compare(plan,[]).words[0].changes.length>0,true);assert.equal(compare(plan,[]).words[0].status,'uncertain');
 const row=(best)=>Array.from({length:7},(_,i)=>i===best?5:-5),logits=new Float32Array([row(4),row(4),row(0),row(4),row(5),row(6)].flat());
 const result=decodeCTC(logits,[1,6,7],{4:'a',5:'ɛ',6:'̃'},.6,6);assert.equal(result.map(p=>p.phone).join(''),'aaɛ̃');assert(result[0].confidence>.9);
 assert.equal(synthesisInput(['g','ʁ','i','l'],'fr'),'[[gril]]');assert.equal(synthesisInput(['g','ʁ','i','j'],'fr'),'[[grij]]');
});
class Cache{data=new Map();async match(url){return this.data.get(String(url))?.clone();}async put(url,response){this.data.set(String(url),response.clone());}}
function fixture(){const stores=new Map(),requests=[],data=new TextEncoder().encode('local speech model'),digest=webcrypto.subtle.digest('SHA-256',data);return {stores,requests,data,digest};}
test('speaking tools require an explicit download, survive new instances and removal preserves lessons',async()=>{
 const {stores,requests,data,digest}=fixture(),sha256=Buffer.from(await digest).toString('hex');const manifest={bytes:data.length,files:[{file:'model.onnx',bytes:data.length,sha256,type:'application/octet-stream'}]};
 const env={document:{baseURI:'https://example.test/tara/'},navigator:{serviceWorker:{}},crypto:webcrypto,caches:{open:async key=>{if(!stores.has(key))stores.set(key,new Cache());return stores.get(key);},delete:async key=>stores.delete(key)},fetch:async url=>{requests.push(String(url));return String(url).endsWith('assets.json')?Response.json(manifest):new Response(data);}};
 stores.set('tara-lesson-v1-fil',new Cache());
 const first=createSpeakingDownloads(env);assert.equal((await first.inspect()).ready,false);assert.equal(requests.length,1);assert(!requests.some(u=>u.includes('model.onnx')));
 await first.download();assert((await first.inspect()).ready);assert(stores.has(SPEAKING_CACHE));const modelRequests=requests.filter(u=>u.includes('model.onnx')).length;
 const second=createSpeakingDownloads(env);assert((await second.inspect()).ready);await second.download();assert.equal(requests.filter(u=>u.includes('model.onnx')).length,modelRequests);
 await second.remove();assert(stores.has('tara-lesson-v1-fil'));assert.equal((await first.inspect()).ready,false);
 assert.equal(speakingAssetRoot('https://tara-filipino-marco.manaty.chatgpt.site/'),'https://smichea.github.io/tara/pronunciation/vendor/');assert.equal(speakingAssetRoot('https://example.test/tara/'),'https://example.test/tara/pronunciation/vendor/');
});
test('a corrupt or cancelled speaking download never becomes ready',async()=>{
 const bytes=new TextEncoder().encode('wrong'),good=new TextEncoder().encode('right'),sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',good)).toString('hex'),cache=new Cache();
 const manifest={bytes:good.length,files:[{file:'model.onnx',bytes:good.length,sha256,type:'application/octet-stream'}]},env={document:{baseURI:'https://test.invalid/'},navigator:{serviceWorker:{}},crypto:webcrypto,caches:{open:async()=>cache},fetch:async url=>String(url).endsWith('assets.json')?Response.json(manifest):new Response(bytes)};
 const manager=createSpeakingDownloads(env);await assert.rejects(manager.download(),/verification/);assert.equal((await manager.inspect()).ready,false);
 const controller=new AbortController();controller.abort();await assert.rejects(manager.download({signal:controller.signal}),{name:'AbortError'});assert.equal((await manager.inspect()).ready,false);
});
test('shipped optional speaking files match the pinned manifest',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../dist/pronunciation/assets.json',import.meta.url)));for(const file of manifest.files){const bytes=await readFile(new URL('../dist/pronunciation/vendor/'+file.file,import.meta.url));assert.equal(bytes.length,file.bytes,file.file);assert.equal(Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex'),file.sha256,file.file);}
});
