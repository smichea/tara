// Main-thread client: rule-based checking always, the local model only when
// downloaded. The model never runs for answers that already match.
import {createTranslationDownloads} from './assets.js';
import {checkWritten} from './grading.js';
export function createTranslationChecker(language,env=globalThis){
 const downloads=createTranslationDownloads(language,env);let worker,ready,next=1;const pending=new Map();
 function call(message){return new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});worker.postMessage({...message,id});});}
 async function start(){
  return ready??=(async()=>{
   const manifest=await downloads.manifest();if(!manifest)throw Error('No translation checker is available for this course yet.');
   worker=new env.Worker(new URL('./engine-worker.js',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};
   worker.onerror=()=>{for(const p of pending.values())p.reject(Error('The translation checker stopped. Reload Tara and retry.'));pending.clear();worker?.terminate();worker=null;ready=null;};
   await call({type:'init',root:downloads.root,manifest});
  })().catch(error=>{worker?.terminate();worker=null;ready=null;throw error;});
 }
 // Returns {status:'correct'|'close'|'model'|'self', ...}.
 async function check({direction,prompt,references,answer,languageCode,useModel=true}){
  const rules=checkWritten(answer,references,direction==='to-target'?languageCode:'en');
  if(rules.status!=='different')return rules;
  if(!useModel||!(await downloads.inspect().catch(()=>({ready:false}))).ready)return {status:'self',reference:references[0]};
  await start();
  return {status:'model',reference:references[0],...await call({type:'check',direction,prompt,references,answer})};
 }
 function stop(){worker?.terminate();worker=null;ready=null;for(const p of pending.values())p.reject(Error('Stopped.'));pending.clear();}
 return {downloads,check,start,stop};
}
