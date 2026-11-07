// Explicit, verified download of the optional translation checker. Files are
// kept in their own durable cache so app updates never delete them.
import {SHARED_MEDIA_ROOT} from '../media.js';
export const TRANSLATION_CACHE='tara-translation-v1';
const FILE=/^(?:[a-z]{2,3}\/)?[a-z0-9][a-z0-9.-]*\.(mjs|json|txt|bin)$/i;
export function translationAssetRoot(base){const url=new URL(base);return new URL('translation/vendor/',url.hostname==='tara-filipino-marco.manaty.chatgpt.site'?SHARED_MEDIA_ROOT:url).href;}
export function validManifest(m,language){
 const l=m?.languages?.[language];
 return !!l&&Array.isArray(l.files)&&l.files.length>0&&l.files.length<=80&&l.files.every(f=>FILE.test(f.file)&&!f.file.includes('..')&&/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=100e6&&typeof f.type==='string')
  &&l.bytes===l.files.reduce((n,f)=>n+f.bytes,0)&&['embed','encoder','decoder'].every(p=>Array.isArray(l.parts?.[p]?.parts)&&l.parts[p].parts.every(name=>l.files.some(f=>f.file===name))&&/^[a-f0-9]{64}$/.test(l.parts[p].sha256)&&Number.isSafeInteger(l.parts[p].bytes));
}
export function createTranslationDownloads(language,env=globalThis){
 const base=env.document?.baseURI||env.location?.href,root=translationAssetRoot(base);let manifestPromise;
 const supported=!!env.caches&&!!env.crypto?.subtle&&!!env.navigator?.serviceWorker&&typeof env.Worker==='function';
 async function manifest(){return manifestPromise??=env.fetch(new URL('./translation/assets.json',base)).then(async r=>{if(!r.ok)throw Error('The translation checker list is unavailable.');const m=await r.json();if(!m.languages?.[language])return null;if(!validManifest(m,language))throw Error('Invalid translation checker list.');return m.languages[language];}).catch(e=>{manifestPromise=null;throw e;});}
 async function inspect(){
  const m=await manifest();if(!m)return {available:false,ready:false,supported};
  if(!supported)return {available:true,ready:false,supported:false,bytes:m.bytes};
  // Inspecting never creates the cache, so a removed checker leaves nothing behind.
  if(!(await env.caches.has(TRANSLATION_CACHE)))return {available:true,ready:false,supported:true,bytes:m.bytes,storedBytes:0,model:m.model};
  const cache=await env.caches.open(TRANSLATION_CACHE);let storedBytes=0;
  for(const f of m.files){const r=await cache.match(new URL(f.file,root));if(r?.headers.get('X-Tara-SHA256')===f.sha256)storedBytes+=f.bytes;}
  return {available:true,ready:storedBytes===m.bytes,supported:true,bytes:m.bytes,storedBytes,model:m.model};
 }
 async function download({signal,onProgress=()=>{}}={}){
  if(!supported)throw Error('The translation checker needs HTTPS and browser storage.');
  const m=await manifest();if(!m)throw Error('No translation checker is available for this course yet.');
  const cache=await env.caches.open(TRANSLATION_CACHE);let done=0;
  for(const file of m.files){
   if(signal?.aborted)throw new DOMException('Download cancelled.','AbortError');
   const url=new URL(file.file,root).href,existing=await cache.match(url);
   if(existing?.headers.get('X-Tara-SHA256')===file.sha256){done+=file.bytes;onProgress({done,total:m.bytes});continue;}
   const response=await env.fetch(url,{cache:'no-store',mode:'cors',signal});if(!response.ok)throw Error('A checker file could not be downloaded. Reconnect and retry.');
   const reader=response.body?.getReader();let data;
   if(reader){const chunks=[];let size=0;for(;;){const {done:ended,value}=await reader.read();if(ended)break;size+=value.length;if(size>file.bytes){await reader.cancel();throw Error('A checker file has an unexpected size.');}chunks.push(value);onProgress({done:done+size,total:m.bytes});}data=new Uint8Array(size);let offset=0;for(const part of chunks){data.set(part,offset);offset+=part.length;}}
   else data=new Uint8Array(await response.arrayBuffer());
   if(data.length!==file.bytes)throw Error('The checker download was incomplete. Retry to finish it.');
   const digest=Array.from(new Uint8Array(await env.crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==file.sha256)throw Error('A checker file failed verification. Reload Tara and retry.');
   if(signal?.aborted)throw new DOMException('Download cancelled.','AbortError');
   try{await cache.put(url,new Response(data,{headers:{'Content-Type':file.type,'Content-Length':String(data.length),'X-Tara-SHA256':file.sha256}}));}
   catch(error){throw Error(error.name==='QuotaExceededError'?'Not enough device storage. Free some space and retry.':'The browser could not keep the translation checker. Check its storage settings.');}
   done+=file.bytes;onProgress({done,total:m.bytes});
  }
  return inspect();
 }
 async function remove(){
  // Remove only this language; the shared runtime stays if another language uses it.
  const m=await manifest();if(!supported||!m)return false;const cache=await env.caches.open(TRANSLATION_CACHE);
  for(const f of m.files)if(f.file.startsWith(language+'/'))await cache.delete(new URL(f.file,root).href);
  if((await cache.keys()).every(r=>!/\/translation\/vendor\/[a-z]{2,3}\//.test(r.url)))await env.caches.delete(TRANSLATION_CACHE);
  return true;
 }
 return {manifest,inspect,download,remove,root,supported};
}
