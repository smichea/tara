import {audioURL} from './media.js';
// Stored audio: per-clip review or an explicitly approved voice pilot. No browser synthesis.
export const AUDIO_PATH=/^audio\/[a-zA-Z0-9/_-]+\.(mp3|ogg|wav)$/;
export function isReviewedAudio(entry){
 const r=entry?.audioReview;
 return AUDIO_PATH.test(entry?.audio||'')&&r?.text===entry.text&&r?.status==='approved'&&typeof r.reviewer==='string'&&r.reviewer.trim().length>0&&/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt||'')&&/^[a-f0-9]{64}$/.test(r.sha256||'')&&['pronunciation','stress','naturalness','completeness'].every(k=>r.checks?.[k]===true);
}
export function isPlayableAudio(entry,approvals=[]){
 if(isReviewedAudio(entry))return true;
 const r=entry?.audioReview;
 if(!AUDIO_PATH.test(entry?.audio||'')||r?.text!==entry.text||r?.status!=='pilot-approved'||r.scope!=='voice-pilot'||r.synthetic!==true||!/^[a-f0-9]{64}$/.test(r.sha256||'')||!/^[a-f0-9]{64}$/.test(r.recipeHash||''))return false;
 const french=entry.audio.startsWith('audio/fr/');
 return Array.isArray(approvals)&&approvals.some(a=>a?.id===r.voiceApproval&&a.status!=='rejected'&&a.scope===r.scope&&a.recipeHash===r.recipeHash&&a.provider==='openai'&&a.model==='gpt-4o-mini-tts'&&a.voice==='marin'&&(french?(a.language==='fr'&&a.sampleCount===3):((!a.language||a.language==='fil')&&a.sampleCount===12))&&typeof a.reviewer==='string'&&a.reviewer.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(a.approvedAt||'')&&/^[a-f0-9]{64}$/.test(a.pilotManifestSha256||''));
}
export function createSpeechPlayer(env=globalThis,{onError=()=>{},getVoiceApprovals=()=>[]}={}){
 let active=null;
 function stop(){if(active){const old=active;active=null;old.pause();old.removeAttribute?.('src');old.load?.();}}
 return {
  supported:typeof env.Audio==='function',stop,
  speak(entry,_language,rate=1){
   if(!isPlayableAudio(entry,getVoiceApprovals())){onError('unreviewed');return false;}
   if(typeof env.Audio!=='function'){onError('unsupported');return false;}
   stop();
   const audio=new env.Audio(audioURL(entry.audio,env.document?.baseURI||env.location?.href));active=audio;audio.crossOrigin='anonymous';
   audio.playbackRate=Number.isFinite(rate)?Math.max(.65,Math.min(1.2,rate)):1;
   audio.preservesPitch=true;
   audio.onended=()=>{if(active===audio)active=null;};
   audio.onerror=()=>{if(active===audio){active=null;onError('unavailable');}};
   try{const promise=audio.play();promise?.catch(()=>{if(active===audio){active=null;onError('unavailable');}});return true;}catch{active=null;onError('unavailable');return false;}
  },destroy:stop
 };
}
