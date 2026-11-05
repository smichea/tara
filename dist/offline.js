import {audioURL} from './media.js';
import {isPlayableAudio} from './speech.js';

// User downloads have a separate, stable cache; shell updates never remove them.
export const LESSON_CACHE_PREFIX='tara-lesson-v1-';
const safeId=/^[a-z][a-z0-9-]{0,63}$/;
export function lessonCacheName(course,lesson){
 if(!safeId.test(course.id)||!safeId.test(lesson.id))throw new Error('Invalid lesson identity.');
 return LESSON_CACHE_PREFIX+course.id+':'+lesson.id;
}
export function lessonAssets(course,lesson,base){
 const entries=[...lesson.entries,...(lesson.reading?[lesson.reading]:[]),...(lesson.task?[{...lesson.task,text:lesson.task.model}]:[])];
 const available=entries.filter(e=>isPlayableAudio(e,course.audioVoiceApprovals));
 const assets=[...new Map(available.map(e=>[audioURL(e.audio,base),{url:audioURL(e.audio,base),sha256:e.audioReview.sha256}])).values()];
 return {assets,missing:entries.length-available.length};
}
function metaURL(base){return new URL('./.tara-offline-lesson',base).href;}
function abortError(){return new DOMException('Download cancelled.','AbortError');}
export function createOfflineLibrary(env=globalThis){
 const base=env.document?.baseURI||env.location?.href;
 const supported=!!env.caches&&!!env.navigator?.serviceWorker&&!!env.crypto?.subtle;
 async function inspect(course,lesson){
  if(!supported)return {state:'unsupported',bytes:0};
  const name=lessonCacheName(course,lesson);
  if(!(await env.caches.has(name)))return {state:'absent',bytes:0};
  const cache=await env.caches.open(name),response=await cache.match(metaURL(base));
  if(!response)return {state:'incomplete',bytes:0};
  const meta=await response.json(),{assets}=lessonAssets(course,lesson,base);
  const current=JSON.stringify(assets)===JSON.stringify(meta.assets);
  const complete=current&&(await Promise.all(assets.map(async a=>(await cache.match(a.url))?.status===200))).every(Boolean);
  return {...meta,state:complete?'ready':'outdated'};
 }
 async function download(course,lesson,{signal,onProgress=()=>{}}={}){
  if(!supported)throw new Error('Downloads need a supported browser over HTTPS.');
  const {assets,missing}=lessonAssets(course,lesson,base),name=lessonCacheName(course,lesson);
  const cache=await env.caches.open(name);let bytes=0,done=0;
  for(const asset of assets){
   if(signal?.aborted)throw abortError();
   onProgress({done,total:assets.length,bytes});
   let response=await env.caches.match(asset.url);
   if(!response||response.status!==200)response=await env.fetch(asset.url,{cache:'no-store',mode:'cors',signal});
   if(!response.ok||response.status!==200||response.redirected)throw new Error('A recording could not be downloaded. Connect and try again.');
   const data=await response.arrayBuffer();
   const sha=Array.from(new Uint8Array(await env.crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
   if(sha!==asset.sha256)throw new Error('A recording has changed. Reload Tara before retrying this download.');
   if(signal?.aborted)throw abortError();
   await cache.put(asset.url,new Response(data,{headers:{'Content-Type':response.headers.get('Content-Type')||'audio/mpeg','Content-Length':String(data.byteLength)}}));
   bytes+=data.byteLength;done++;onProgress({done,total:assets.length,bytes});
  }
  if(signal?.aborted)throw abortError();
  const meta={courseId:course.id,lessonId:lesson.id,title:lesson.title,assets,missing,bytes,downloadedAt:new Date().toISOString()};
  // Commit completion last. Interrupted downloads can be resumed but never appear ready.
  await cache.put(metaURL(base),new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json'}}));
  const keep=new Set([metaURL(base),...assets.map(a=>a.url)]);
  for(const key of await cache.keys())if(!keep.has(key.url))await cache.delete(key);
  return meta;
 }
 async function remove(course,lesson){return supported&&env.caches.delete(lessonCacheName(course,lesson));}
 async function summary(){
  if(!supported)return {count:0,bytes:0};
  let count=0,bytes=0;
  for(const name of await env.caches.keys())if(name.startsWith(LESSON_CACHE_PREFIX)){
   const cache=await env.caches.open(name),response=await cache.match(metaURL(base));
   if(response){const m=await response.json();count++;bytes+=m.bytes||0;}
  }
  return {count,bytes};
 }
 return {supported,inspect,download,remove,summary};
}

// A cached full MP3 must also support the byte-range requests used on phones.
export async function audioRangeResponse(request,response){
 const range=request.headers.get('Range');
 if(!range||response.status!==200)return response;
 const match=/^bytes=(\d*)-(\d*)$/.exec(range);
 if(!match||(!match[1]&&!match[2]))return response;
 const data=await response.arrayBuffer(),length=data.byteLength;
 let start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
 let end=match[1]?(match[2]?Math.min(Number(match[2]),length-1):length-1):length-1;
 const headers=new Headers(response.headers);headers.set('Accept-Ranges','bytes');
 if(start>=length||end<start){headers.set('Content-Range',`bytes */${length}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
 headers.set('Content-Range',`bytes ${start}-${end}/${length}`);headers.set('Content-Length',String(end-start+1));
 return new Response(data.slice(start,end+1),{status:206,headers});
}
