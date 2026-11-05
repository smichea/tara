import {createSpeakingDownloads} from './assets.js';
import {MAX_SECONDS,words} from './phonetics.js';
import {audioURL} from '../media.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mic='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
export function createPronunciationPractice({stopModel=()=>{},notify=()=>{}}={}){
 const downloads=createSpeakingDownloads(),dialog=document.createElement('dialog');dialog.className='speaking-dialog';dialog.setAttribute('aria-label','Speaking practice');document.body.append(dialog);
 let worker=null,pending=new Map(),requestId=0,epoch=0,entry,language,plan,comparison,lastHeard=[],audioContext=null,source=null,reference=null,referenceBounds=[],recording=null,recorded=null,partialBusy=false,startingCapture=false,downloading=null,ready=false,loading=false;
 const advancedKey=()=>`tara-speaking-advanced:${language}`;
 function advanced(){try{return JSON.parse(localStorage.getItem(advancedKey()))===true;}catch{return false;}}
 function call(type,args={}){if(!worker)throw Error('Speaking tools are not ready.');return new Promise((resolve,reject)=>{const id=++requestId,timer=setTimeout(()=>{pending.delete(id);reject(Error('This device is taking too long. Try a shorter phrase.'));},180000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,type,...args});});}
 function disposeWorker(){worker?.terminate();worker=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Speaking practice closed.'));}pending.clear();}
 function stopAudio(){if(source){try{source.stop();}catch{}source=null;}}
 function setStatus(text){const el=dialog.querySelector('[data-speaking-status]');if(el)el.textContent=text;}
 function skeleton(content){dialog.innerHTML=`<div class="speaking-header"><span class="pill green">A little speaking practice</span><button class="icon-btn" type="button" data-speaking="close" aria-label="Close speaking practice">✕</button></div><h2>Say it your way.</h2><p class="speaking-target" dir="auto">${esc(entry.text)}</p>${content}`;}
 function controls(){skeleton(`<p class="muted">Listen, say the phrase, then compare. Your voice stays on this device.</p><div class="speaking-tools"><button class="btn secondary" data-speaking="model">▶ Model</button><button class="btn" data-speaking="record" ${loading?'disabled':''}>${mic} Start speaking</button><button class="btn ghost" data-speaking="replay" disabled>▶ My voice</button></div><div class="speaking-meter" aria-hidden="true"><i></i></div><p class="speaking-status" data-speaking-status role="status" aria-live="polite">${loading?'Preparing the local model…':'Ready when you are.'}</p><div class="speaking-results"></div><label class="checkbox-label speaking-advanced"><input type="checkbox" data-speaking="advanced" ${advanced()?'checked':''}>Advanced: show phonetic details</label><p class="field-help">Experimental feedback, not a pronunciation grade. The spelling below is an approximation of sounds recognised by the model. Synthetic reconstructions use a simple robotic voice. Accent and intonation are not assessed.</p><div class="speaking-footer"><button class="text-link" data-speaking="keep" disabled>Save my recording</button><button class="text-link" data-speaking="delete-tools">Remove downloaded speaking tools</button></div>`);}
 async function initialize(){
  if(worker)return;worker=new Worker(new URL('./engine-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){clearTimeout(p.timer);pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}};
  worker.onerror=event=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(event.message||'This browser could not start the speech model.'));}pending.clear();};
  await call('init',{root:downloads.root});
 }
 async function context(){audioContext??=new AudioContext();await audioContext.resume();return audioContext;}
 async function prepare(currentEpoch){
  loading=true;controls();
  try{
   await initialize();const next=await call('plan',{text:entry.text,language});if(currentEpoch!==epoch)return;plan=next;loading=false;controls();
   // Reference timing is optional: a missing recording must never prevent microphone use.
   reference=null;referenceBounds=[];
   if(entry.audio){try{const c=await context(),response=await fetch(audioURL(entry.audio,document.baseURI));if(!response.ok)return;const buffer=await c.decodeAudioData(await response.arrayBuffer());if(currentEpoch!==epoch)return;reference=buffer;
    if(buffer.duration<=MAX_SECONDS&&!recording){const audio=await resampleBuffer(buffer);const timed=await call('reference',{audio,plan});if(currentEpoch===epoch){plan.reliability=timed.reliability;if(timed.similarity>.55)referenceBounds=timed.bounds;}}
   }catch{}}
  }catch(error){if(currentEpoch===epoch){loading=false;disposeWorker();setStatus(error.message+' Close and try again.');}}
 }
 async function open(nextEntry,nextLanguage){
  if(!['fr','fil'].includes(nextLanguage))return;close();const currentEpoch=++epoch;entry=nextEntry;language=nextLanguage;plan=null;comparison=null;lastHeard=[];recorded=null;reference=null;referenceBounds=[];stopModel();
  skeleton('<p data-speaking-status role="status">Checking speaking tools on this device…</p>');dialog.showModal();
  try{
   const state=await downloads.inspect();if(currentEpoch!==epoch)return;ready=state.ready;
   if(ready)await prepare(currentEpoch);
   else skeleton(`<p>Download the speaking tools once, then practise French and Filipino offline. They stay on this device for future sessions.</p><div class="speaking-download"><strong>${(state.bytes/1e6).toFixed(1)} MB</strong><span>ZIPA recognition + local sound reconstruction</span></div><p class="field-help">Nothing is downloaded until you choose Download. Your microphone is requested only when you start speaking.</p><button class="btn" data-speaking="download" ${state.supported?'':'disabled'}>Download speaking tools</button><div data-speaking-progress hidden><progress max="100" value="0" aria-label="Speaking tools download"></progress><p data-speaking-status role="status"></p><button class="btn ghost" data-speaking="cancel-download">Cancel download</button></div>${state.supported?'':'<p>Use a browser with offline storage over HTTPS to enable speaking practice.</p>'}`);
  }catch(error){if(currentEpoch===epoch)setStatus(error.message);}
 }
 async function download(){
  if(downloading)return;const currentEpoch=epoch;downloading=new AbortController();dialog.querySelector('[data-speaking="download"]').disabled=true;dialog.querySelector('[data-speaking-progress]').hidden=false;
  try{await downloads.download({signal:downloading.signal,onProgress:({done,total})=>{if(currentEpoch!==epoch)return;dialog.querySelector('progress').value=done/total*100;setStatus(`${(done/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} MB · ${Math.floor(done/total*100)}%`);}});ready=true;if(currentEpoch===epoch)await prepare(currentEpoch);}
  catch(error){if(currentEpoch===epoch){setStatus(error.name==='AbortError'?'Download paused. Completed files are kept; retry to finish.':error.message);const button=dialog.querySelector('[data-speaking="download"]');if(button){button.disabled=false;button.textContent='Retry download';}}}
  finally{downloading=null;}
 }
 function join(chunks){const all=new Float32Array(chunks.reduce((n,c)=>n+c.length,0));let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.length;}return all;}
 async function resampleBuffer(buffer){if(buffer.sampleRate===16000)return buffer.getChannelData(0).slice();const c=new OfflineAudioContext(1,Math.ceil(buffer.duration*16000),16000),s=c.createBufferSource();s.buffer=buffer;s.connect(c.destination);s.start();return (await c.startRendering()).getChannelData(0).slice();}
 async function samples(rec){const c=audioContext,buffer=c.createBuffer(1,Math.min(rec.count,MAX_SECONDS*rec.rate),rec.rate);let pos=0;for(const chunk of rec.chunks){const part=chunk.subarray(0,buffer.length-pos);buffer.copyToChannel(part,0,pos);pos+=part.length;if(pos>=buffer.length)break;}return {buffer,audio:await resampleBuffer(buffer)};}
 async function startRecording(){
  if(loading||!ready||!plan||startingCapture)return;if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioWorkletNode){setStatus('This browser does not support microphone practice.');return;}
  startingCapture=true;dialog.querySelector('[data-speaking="record"]').disabled=true;
  stopAudio();stopModel();const currentEpoch=epoch;let stream;
  try{
   const c=await context();stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
   if(currentEpoch!==epoch){stream.getTracks().forEach(t=>t.stop());return;}
   await c.audioWorklet.addModule(new URL('./capture-worklet.js',import.meta.url));
   if(currentEpoch!==epoch||document.hidden){stream.getTracks().forEach(t=>t.stop());return;}
   const node=new AudioWorkletNode(c,'tara-capture'),input=c.createMediaStreamSource(stream),gain=c.createGain();gain.gain.value=0;
   const rec={stream,node,input,gain,rate:c.sampleRate,count:0,chunks:[],timer:null,lastPartial:0,maxRms:0,flushed:null};recording=rec;recorded=null;comparison=null;lastHeard=[];renderResults();
   node.port.onmessage=({data})=>{
    if(data?.flushed){rec.flushed?.();return;}if(!(data instanceof Float32Array))return;
    const chunk=data.slice(0,Math.max(0,MAX_SECONDS*rec.rate-rec.count));if(!chunk.length)return;rec.chunks.push(chunk);rec.count+=chunk.length;
    const rms=Math.sqrt(chunk.reduce((n,s)=>n+s*s,0)/chunk.length);rec.maxRms=Math.max(rec.maxRms,rms);const meter=dialog.querySelector('.speaking-meter i');if(meter)meter.style.transform=`scaleX(${Math.min(1,rms*12)})`;
    if(rec.count>=MAX_SECONDS*rec.rate){void finishRecording();return;}
    if(rec.count/rec.rate>=1.2&&performance.now()-rec.lastPartial>1800&&!partialBusy&&rms>.004){rec.lastPartial=performance.now();void analyzePartial(rec,currentEpoch);}
   };
   input.connect(node);node.connect(gain);gain.connect(c.destination);
   const button=dialog.querySelector('[data-speaking="record"]');button.innerHTML='<span aria-hidden="true">■</span> Stop & compare';button.classList.add('recording');setStatus('Listening… take your time. Up to '+MAX_SECONDS+' seconds.');
   rec.timer=setTimeout(()=>void finishRecording(),MAX_SECONDS*1000+1000);
  }catch(error){stream?.getTracks().forEach(t=>t.stop());if(currentEpoch===epoch)setStatus(error.name==='NotAllowedError'?'Microphone access was declined. Allow it in browser settings to practise.':error.name==='NotFoundError'?'No microphone was found.':error.message);}
  finally{if(currentEpoch===epoch){startingCapture=false;const b=dialog.querySelector('[data-speaking="record"]');if(b)b.disabled=false;}}
 }
 async function analyzePartial(rec,currentEpoch){
  partialBusy=true;try{const {audio}=await samples(rec),found=await call('recognize',{audio,plan,partial:true});if(recording===rec&&currentEpoch===epoch){lastHeard=found.heard;comparison=found.comparison;renderResults();}}catch{}finally{partialBusy=false;}
 }
 function disconnect(rec){clearTimeout(rec.timer);rec.stream.getTracks().forEach(t=>t.stop());for(const node of [rec.input,rec.node,rec.gain])try{node.disconnect();}catch{}rec.node.port.onmessage=null;}
 async function finishRecording(){
  const rec=recording;if(!rec)return;recording=null;const currentEpoch=epoch;
  await new Promise(resolve=>{rec.flushed=resolve;rec.node.port.postMessage('flush');setTimeout(resolve,150);});disconnect(rec);
  if(currentEpoch!==epoch||rec.count<400)return;
  const button=dialog.querySelector('[data-speaking="record"]');button.disabled=true;button.classList.remove('recording');button.innerHTML='Analysing…';
  try{
   if(rec.maxRms<.004||rec.count/rec.rate<.35)throw Error('I could not hear you clearly. Move closer and try again.');
   const {buffer,audio}=await samples(rec);recorded=buffer;
   for(const action of ['replay','keep'])dialog.querySelector(`[data-speaking="${action}"]`).disabled=false;
   setStatus('Comparing the sounds on this device…');const found=await call('recognize',{audio,plan,partial:false});if(currentEpoch!==epoch)return;
   lastHeard=found.heard;comparison=found.comparison;renderResults();
   setStatus(found.heard.length?`Tap the words below to compare. Analysis took ${(found.milliseconds/1000).toFixed(1)} s.`:'No clear sounds were recognised. Try again somewhere quieter.');
  }catch(error){if(currentEpoch===epoch)setStatus(error.message);}
  finally{if(currentEpoch===epoch){button.disabled=false;button.innerHTML=mic+' Try again';}}
 }
 function highlighted(word){const spans=word.status==='retry'?word.changes:[];return [...word.text].map((c,i)=>spans.some(s=>i>=s.start&&i<s.end)?`<mark>${esc(c)}</mark>`:esc(c)).join('');}
 function renderResults(){
  const container=dialog.querySelector('.speaking-results');if(!container)return;
  if(!comparison){container.replaceChildren();return;}
  container.innerHTML=`<div class="speaking-labels"><span>Model</span><span>What the AI heard${comparison.partial?' · still listening':''}</span></div><div class="speaking-words">${comparison.words.map((word,i)=>`<div class="speaking-word ${comparison.partial?'provisional':word.status}"><button class="speaking-original" data-speaking="word-model" data-index="${i}" aria-label="Listen to model: ${esc(word.text)}">${highlighted(word)}</button><button class="speaking-heard" data-speaking="word-ai" data-index="${i}" ${!word.heard.length?'disabled':''} aria-label="Listen to AI reconstruction: ${esc(word.readable||'not heard')}">${esc(word.readable||'…')}</button>${!comparison.partial?`<span class="speaking-word-status">${({close:'Sounds close',retry:'Compare',uncertain:'Not clear',pending:'…'})[word.status]}</span><button class="speaking-my-word" data-speaking="word-replay" data-index="${i}" ${!recorded||!word.heard.length?'disabled':''}>My voice</button>`:''}${advanced()?`<div class="speaking-ipa"><span>Target: ${esc(word.phones.join(' '))}</span><span>Heard: ${esc(word.heard.map(p=>p.phone).join(' '))}</span></div>`:''}</div>`).join('')}</div><p class="field-help">Tap a top word for its model; tap the spelling below for a synthetic reconstruction. ${comparison.partial?'The result can change as you finish speaking.':'“My voice” replays your original recording.'}</p>`;
 }
 async function playBuffer(buffer,start=0,end=buffer.duration){if(!buffer||recording)return;stopAudio();stopModel();const c=await context();source=c.createBufferSource();source.buffer=buffer;source.connect(c.destination);source.start(0,Math.max(0,start),Math.max(.02,Math.min(buffer.duration,end)-Math.max(0,start)));}
 async function model(index){if(recording)return;stopAudio();if(reference){const range=index===undefined?null:referenceBounds[index];return playBuffer(reference,range?Math.max(0,range.start-.06):0,range?range.end+.08:reference.duration);}notify('The model recording is unavailable offline. Download this lesson to include it.');}
 async function synthesize(index){if(recording||!comparison?.words[index]?.heard.length)return;setStatus('Reconstructing the recognised sounds…');const currentEpoch=epoch,output=await call('synthesize',{phones:comparison.words[index].heard,language});if(currentEpoch!==epoch)return;const c=await context(),buffer=c.createBuffer(1,output.pcm.length,output.sampleRate);buffer.copyToChannel(output.pcm,0);await playBuffer(buffer);setStatus('Synthetic reconstruction of the recognised sounds.');}
 function wav(buffer){const data=buffer.getChannelData(0),bytes=new ArrayBuffer(44+data.length*2),v=new DataView(bytes),str=(s,o)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};str('RIFF',0);v.setUint32(4,36+data.length*2,true);str('WAVEfmt ',8);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str('data',36);v.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,data[i]))*32767,true);return new Blob([bytes],{type:'audio/wav'});}
 function saveRecording(){if(!recorded)return;const url=URL.createObjectURL(wav(recorded)),a=document.createElement('a');a.href=url;a.download='tara-my-voice.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function close(){epoch++;downloading?.abort();if(recording){disconnect(recording);recording=null;}startingCapture=false;partialBusy=false;loading=false;stopAudio();recorded=null;reference=null;comparison=null;lastHeard=[];disposeWorker();audioContext?.close().catch(()=>{});audioContext=null;if(dialog.open)dialog.close();}
 dialog.addEventListener('cancel',()=>close());
 dialog.addEventListener('click',async event=>{const b=event.target.closest('[data-speaking]');if(!b||b.disabled)return;const type=b.dataset.speaking,index=Number(b.dataset.index);try{
  if(type==='close')close();else if(type==='download')await download();else if(type==='cancel-download')downloading?.abort();
  else if(type==='record'){if(recording)await finishRecording();else await startRecording();}
  else if(type==='model')await model();else if(type==='replay')await playBuffer(recorded);else if(type==='word-model')await model(index);else if(type==='word-ai')await synthesize(index);
  else if(type==='word-replay'){const w=comparison.words[index];await playBuffer(recorded,Math.max(0,w.startTime-.08),w.endTime+.1);}
  else if(type==='advanced'){try{localStorage.setItem(advancedKey(),JSON.stringify(b.checked));}catch{}renderResults();}
  else if(type==='keep')saveRecording();else if(type==='delete-tools'){disposeWorker();ready=false;await downloads.remove();await open(entry,language);}
 }catch(error){setStatus(error.message);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(recording){disconnect(recording);recording=null;}stopAudio();const b=dialog.querySelector('[data-speaking="record"]');if(b){b.disabled=false;b.innerHTML=mic+' Start speaking';b.classList.remove('recording');}if(dialog.open)setStatus('Recording stopped while Tara was in the background. Tap Start speaking to try again.');}});
 window.addEventListener('pagehide',()=>{close();disposeWorker();});
 return {open,close,downloads};
}
