// Local translation checker (Opus-MT on ONNX Runtime Web). Runs entirely in
// this worker; answers never leave the device.
import {createTokenizer} from './tokenizer.js';
import {createMarian} from './marian.js';
import {shapeLike,decide} from './grading.js';
let model,ort,root;
async function bytes(names,expected,sha256){
 const chunks=[];let size=0;
 for(const name of names){const response=await fetch(new URL(name,root));if(!response.ok)throw Error('The translation checker download is incomplete.');const part=new Uint8Array(await response.arrayBuffer());chunks.push(part);size+=part.length;}
 if(size!==expected)throw Error('A translation checker file has an unexpected size.');
 const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}
 if(sha256){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',out)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==sha256)throw Error('A translation checker file failed verification.');}
 return out;
}
async function initialize(url,manifest){
 if(model)return;root=new URL(url);
 ort??=await import(new URL('ort.wasm.bundle.min.mjs',root));ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=root.href;ort.env.logLevel='error';
 const runtime=manifest.files.filter(f=>/^ort-wasm-\d\d\.bin$/.test(f.file));
 ort.env.wasm.wasmBinary??=await bytes(runtime.map(f=>f.file),runtime.reduce((n,f)=>n+f.bytes,0));
 const tokenizer=createTokenizer(await (await fetch(new URL(manifest.language+'/tokenizer.json',root))).json()),sessions={};
 for(const part of ['embed','encoder','decoder']){const p=manifest.parts[part];sessions[part]=await ort.InferenceSession.create(await bytes(p.parts,p.bytes,p.sha256),{executionProviders:['wasm'],graphOptimizationLevel:'all'});}
 model=createMarian({ort,tokenizer,...sessions});
}
async function check({direction,prompt,references,answer}){
 if(!model)throw Error('Download the translation checker first.');
 const start=performance.now(),shaped=shapeLike(answer,references[0]);let reading,delta;
 if(direction==='to-target'){
  // What does the learner's sentence say? Then: how well does it explain the prompt, compared with the references?
  reading=await model.translate(answer);const own=await model.score(shaped,prompt);let best=-Infinity;
  for(const reference of references)best=Math.max(best,await model.score(reference,prompt));delta=own-best;
 }else{
  const state=await model.encode(prompt);reading=await model.translate(prompt);const own=await model.score(prompt,shaped,state);let best=-Infinity;
  for(const reference of references)best=Math.max(best,await model.score(prompt,reference,state));delta=own-best;
 }
 return {...decide({direction,delta,reading,prompt,answer,reference:references[0]}),reading,delta:Math.round(delta*100)/100,milliseconds:Math.round(performance.now()-start)};
}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 const {id,type}=data;
 try{let result;if(type==='init'){await initialize(data.root,data.manifest);result={ready:true};}else if(type==='check')result=await check(data);else throw Error('Unknown checker operation.');self.postMessage({id,result});}
 catch(error){self.postMessage({id,error:error.message||'The translation checker failed.'});}
}).catch(()=>{});};
