import {SHARED_MEDIA_ROOT} from '../media.js';
export const SPEAKING_CACHE='tara-speaking-v1';
export function speakingAssetRoot(base){const url=new URL(base);return new URL('pronunciation/vendor/',url.hostname==='tara-filipino-marco.manaty.chatgpt.site'?SHARED_MEDIA_ROOT:url).href;}
export function createSpeakingDownloads(env=globalThis){
 const base=env.document?.baseURI||env.location?.href,root=speakingAssetRoot(base);let manifestPromise;
 const supported=!!env.caches&&!!env.crypto?.subtle&&!!env.navigator?.serviceWorker;
 async function manifest(){return manifestPromise??=env.fetch(new URL('./pronunciation/assets.json',base)).then(async r=>{if(!r.ok)throw Error('Speaking download list is unavailable.');const m=await r.json();if(!Array.isArray(m.files)||!m.files.length||m.files.length>64||m.files.some(f=>!/^[a-z0-9][a-z0-9.-]*\.(mjs|js|wasm|data|txt|onnx|bin)$/i.test(f.file)||!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>100e6)||m.bytes!==m.files.reduce((n,f)=>n+f.bytes,0))throw Error('Invalid speaking download list.');return m;}).catch(e=>{manifestPromise=null;throw e;});}
 async function inspect(){
  const m=await manifest();if(!supported)return {ready:false,supported:false,bytes:m.bytes};
  const cache=await env.caches.open(SPEAKING_CACHE);let storedBytes=0;
  for(const f of m.files){const r=await cache.match(new URL(f.file,root));if(r?.headers.get('X-Tara-SHA256')===f.sha256)storedBytes+=f.bytes;}
  return {ready:storedBytes===m.bytes,supported:true,bytes:m.bytes,storedBytes};
 }
 async function download({signal,onProgress=()=>{}}={}){
  if(!supported)throw Error('Speaking downloads need HTTPS and browser storage.');
  const m=await manifest(),cache=await env.caches.open(SPEAKING_CACHE);let done=0;
  for(const file of m.files){
   if(signal?.aborted)throw new DOMException('Download cancelled.','AbortError');
   const url=new URL(file.file,root).href,existing=await cache.match(url);
   if(existing?.headers.get('X-Tara-SHA256')===file.sha256){done+=file.bytes;onProgress({done,total:m.bytes});continue;}
   const response=await env.fetch(url,{cache:'no-store',mode:'cors',signal});if(!response.ok)throw Error('A speaking tool could not be downloaded. Reconnect and retry.');
   const reader=response.body?.getReader();let data;
   if(reader){const chunks=[];let size=0;for(;;){const {done:ended,value}=await reader.read();if(ended)break;size+=value.length;if(size>file.bytes){await reader.cancel();throw Error('A speaking file has an unexpected size.');}chunks.push(value);onProgress({done:done+size,total:m.bytes});}data=new Uint8Array(size);let offset=0;for(const part of chunks){data.set(part,offset);offset+=part.length;}}
   else data=new Uint8Array(await response.arrayBuffer());
   if(data.length!==file.bytes)throw Error('The speaking download was incomplete. Retry to finish it.');
   const digest=Array.from(new Uint8Array(await env.crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==file.sha256)throw Error('A speaking file failed verification. Reload Tara and retry.');
   if(signal?.aborted)throw new DOMException('Download cancelled.','AbortError');
   try{await cache.put(url,new Response(data,{headers:{'Content-Type':file.type,'Content-Length':String(data.length),'X-Tara-SHA256':file.sha256}}));}
   catch(error){throw Error(error.name==='QuotaExceededError'?'Not enough device storage. Free some space and retry.':'The browser could not keep the speaking tools. Check its storage settings.');}
   done+=file.bytes;onProgress({done,total:m.bytes});
  }
  return inspect();
 }
 async function remove(){return supported&&env.caches.delete(SPEAKING_CACHE);}
 return {manifest,inspect,download,remove,root,supported};
}
