import {loadFbank} from './fbank.js';
import {MAX_SECONDS,decodeCTC,makePlan,compare,synthesisInput,align,phones} from './phonetics.js';
let ort,session,extract,espeak,voice,tokens,root;
async function reassemble(prefix,count,expectedBytes){
 const chunks=[];let bytes=0;
 for(let i=0;i<count;i++){const response=await fetch(new URL(`${prefix}-${String(i).padStart(2,'0')}.bin`,root));if(!response.ok)throw Error('The speaking download is incomplete.');const part=new Uint8Array(await response.arrayBuffer());chunks.push(part);bytes+=part.length;}
 if(bytes!==expectedBytes)throw Error('A speaking tool has an unexpected size.');
 const result=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
async function initialize(url){
 if(session)return;root=new URL(url);
 ort=await import(new URL('ort.wasm.bundle.min.mjs',root));ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=root.href;ort.env.logLevel='error';
 ort.env.wasm.wasmBinary=await reassemble('ort-wasm',3,12303130);
 // Small, independently cached parts keep interrupted downloads resumable and
 // avoid oversized Git objects. Reconstruction produces the exact pinned ONNX.
 const model=await reassemble('zipa',17,70677672);
 session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 extract=await loadFbank(new URL('fbank.wasm',root));tokens={};
 const text=await (await fetch(new URL('tokens.txt',root))).text();for(const line of text.trim().split('\n')){const [token,id]=line.trim().split(/\s+/);tokens[Number(id)]=token;}
 const factory=(await import(new URL('espeak-ng.js',root))).default;espeak=await factory({print:()=>{},printErr:()=>{}});voice=new espeak.eSpeakNGWorker();
}
function phonemize(text){
 if(voice.set_voice('','fr',0,0,0)!==0)throw Error('The French phonetic dictionary is unavailable.');
 const pointer=voice.convert_to_phonemes(text,true).ptr;let end=pointer;while(espeak.HEAPU8[end])end++;
 try{return new TextDecoder().decode(espeak.HEAPU8.subarray(pointer,end));}finally{espeak._free(pointer);}
}
async function recognize(audio){
 if(!session)throw Error('Download speaking tools first.');if(!(audio instanceof Float32Array)||audio.length>16000*MAX_SECONDS||audio.length<400)throw Error('Use a short recording of up to '+MAX_SECONDS+' seconds.');
 const start=performance.now(),features=extract(audio),outputs=await session.run({x:new ort.Tensor('float32',features.data,[1,features.frames,80]),x_lens:new ort.Tensor('int64',BigInt64Array.of(BigInt(features.frames)),[1])});
 const logits=outputs.log_probs||outputs.logits||Object.values(outputs).find(t=>t.dims.length===3);if(!logits)throw Error('The speech model returned no sounds.');
 const length=outputs.log_probs_len||outputs.log_probs_lens||outputs.y_lens||Object.values(outputs).find(t=>t.dims.length===1);
 return {heard:decodeCTC(logits.data,logits.dims,tokens,audio.length/16000,length?.data?.[0]),milliseconds:Math.round(performance.now()-start)};
}
function synthesize(sequence,language){
 // These are phoneme instructions, not a text spelling that could be autocorrected.
 // eSpeak has no Tagalog voice: its Indonesian table supplies shared phonetic sounds.
 if(voice.set_voice('',language==='fil'?'id':'fr',0,0,0)!==0)throw Error('The local sound synthesizer is unavailable.');
 voice.set_rate(150);const chunks=[],produced=[];voice.synthesize(synthesisInput(sequence,language),(pcm,events)=>{chunks.push(pcm);for(const event of events)if(event.type==='phoneme'&&event.id)produced.push(...phones(event.id));return false;});
 if(align(sequence,produced,language).similarity<.85)throw Error('The local synthesizer could not reproduce these sounds faithfully. Use My voice to compare.');
 const pcm=new Float32Array(chunks.reduce((n,p)=>n+p.length,0));let offset=0;for(const chunk of chunks){for(let i=0;i<chunk.length;i++)pcm[offset+i]=chunk[i]/32768;offset+=chunk.length;}return {pcm,sampleRate:22050};
}
// Serial execution avoids concurrent inference and phonemizer state changes.
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 const {id,type}=data;try{
  let result;
  if(type==='init'){await initialize(data.root);result={ready:true};}
  else if(type==='plan')result=makePlan(data.text,data.language,phonemize);
  else if(type==='recognize'){const found=await recognize(data.audio);result={...found,comparison:data.plan?compare(data.plan,found.heard,{partial:data.partial}):null};}
  else if(type==='synthesize')result=synthesize(data.phones,data.language);
  else if(type==='reference'){
   const found=await recognize(data.audio),alignment=align(data.plan.expected,found.heard,data.plan.language),bounds=data.plan.words.map(()=>null);
   for(const step of alignment.steps)if(step.expected!==null&&step.heard!==null){const index=data.plan.expected[step.expected].word,event=found.heard[step.heard];bounds[index]=bounds[index]?{start:Math.min(bounds[index].start,event.start),end:Math.max(bounds[index].end,event.end)}:{start:event.start,end:event.end};}
   const assessed=compare(data.plan,found.heard);result={bounds,similarity:alignment.similarity,reliability:assessed.words.map(w=>w.status==='close')};
  }else throw Error('Unknown speaking operation.');
  self.postMessage({id,result},result?.pcm?[result.pcm.buffer]:[]);
 }catch(error){self.postMessage({id,error:error.message||'Speaking analysis failed.'});}
 }).catch(()=>{});};
