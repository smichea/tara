import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createOfflineLibrary,lessonAssets,audioRangeResponse} from '../dist/offline.js';
const sample=new TextEncoder().encode('stored audio transport fixture');
const hash=createHash('sha256').update(sample).digest('hex');
function entry(id,text){return {id,text,audio:`audio/fr/${id}.mp3`,audioReview:{status:'approved',text,sha256:hash,reviewer:'Fixture reviewer',reviewedAt:'2026-11-05',checks:{pronunciation:true,stress:true,naturalness:true,completeness:true}}};}
function fixture(){
 const lesson={id:'first',title:'A whole lesson',entries:[entry('one','Bonjour !')],reading:entry('reading','Un petit texte.'),task:{...entry('model','Je parle français.'),text:undefined,model:'Je parle français.'}};
 const course={id:'fr-en',lessons:[lesson]},maps=new Map();let fetches=0,failPut=false;
 function cache(name){if(!maps.has(name))maps.set(name,new Map());const m=maps.get(name);return {async match(k){return m.get(typeof k==='string'?k:k.url)?.clone();},async put(k,r){if(failPut)throw new DOMException('full','QuotaExceededError');m.set(typeof k==='string'?k:k.url,r.clone());},async keys(){return [...m.keys()].map(k=>new Request(k));},async delete(k){return m.delete(typeof k==='string'?k:k.url);}};}
 const caches={async has(n){return maps.has(n);},async open(n){return cache(n);},async keys(){return [...maps.keys()];},async delete(n){return maps.delete(n);},async match(k){for(const n of maps.keys()){const r=await cache(n).match(k);if(r)return r;}}};
 const env={caches,document:{baseURI:'https://example.com/tara/'},navigator:{serviceWorker:{}},crypto:webcrypto,async fetch(){fetches++;return new Response(sample,{headers:{'Content-Type':'audio/mpeg'}});}};
 return {course,lesson,env,library:createOfflineLibrary(env),fetches:()=>fetches,setQuotaFailure:value=>{failPut=value;}};
}
test('lesson downloads include verified phrase, reading and expression model audio; survive a new app instance',async()=>{
 const f=fixture();assert.equal(lessonAssets(f.course,f.lesson,f.env.document.baseURI).assets.length,3);
 await f.library.download(f.course,f.lesson);assert.equal(f.fetches(),3);
 const state=await createOfflineLibrary(f.env).inspect(f.course,f.lesson);assert.equal(state.state,'ready');assert.equal(state.assets.length,3);assert.equal(state.bytes,sample.length*3);
 assert.deepEqual(await f.library.summary(),{count:1,bytes:sample.length*3});
});
test('cancelled and quota-failed downloads never claim readiness; resume reuses already verified audio',async()=>{
 const f=fixture(),controller=new AbortController();
 await assert.rejects(f.library.download(f.course,f.lesson,{signal:controller.signal,onProgress:p=>{if(p.done===1)controller.abort();}}),{name:'AbortError'});
 assert.equal((await f.library.inspect(f.course,f.lesson)).state,'incomplete');assert.equal((await f.library.summary()).count,0);
 await f.library.download(f.course,f.lesson);assert.equal(f.fetches(),3);assert.equal((await f.library.inspect(f.course,f.lesson)).state,'ready');
 const g=fixture();g.setQuotaFailure(true);await assert.rejects(g.library.download(g.course,g.lesson),{name:'QuotaExceededError'});assert.equal((await g.library.inspect(g.course,g.lesson)).state,'incomplete');
});
test('corrupt or revised recordings cannot produce a complete offline lesson',async()=>{
 const f=fixture();f.env.fetch=async()=>new Response('wrong bytes');await assert.rejects(f.library.download(f.course,f.lesson),/recording has changed/);assert.equal((await f.library.inspect(f.course,f.lesson)).state,'incomplete');
 const g=fixture();await g.library.download(g.course,g.lesson);g.lesson.entries[0].audioReview.sha256='0'.repeat(64);assert.equal((await g.library.inspect(g.course,g.lesson)).state,'outdated');
});
test('removing one lesson preserves another download sharing the same recording',async()=>{
 const f=fixture(),second={...f.lesson,id:'second'};await f.library.download(f.course,f.lesson);await f.library.download(f.course,second);assert.equal(f.fetches(),3);
 await f.library.remove(f.course,f.lesson);assert.equal((await f.library.inspect(f.course,f.lesson)).state,'absent');assert.equal((await f.library.inspect(f.course,second)).state,'ready');
});
test('downloaded audio serves valid full, open-ended, suffix and unsatisfiable byte ranges',async()=>{
 for(const [range,status,expected] of [['bytes=1-3',206,'tor'],['bytes=7-',206,'audio transport fixture'],['bytes=-7',206,'fixture'],['bytes=999-',416,'']]){
  const r=await audioRangeResponse(new Request('https://example.com/a.mp3',{headers:{Range:range}}),new Response(sample));assert.equal(r.status,status);assert.equal(await r.text(),expected);assert(r.headers.has('Content-Range'));
 }
});
