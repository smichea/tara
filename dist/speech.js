// Playback of stored, human-reviewed recordings only. No browser synthesis.
export const AUDIO_PATH=/^audio\/[a-zA-Z0-9/_-]+\.(mp3|ogg|wav)$/;
export function isReviewedAudio(entry){
 const r=entry?.audioReview;
 return AUDIO_PATH.test(entry?.audio||'')&&r?.text===entry.text&&r?.status==='approved'&&typeof r.reviewer==='string'&&r.reviewer.trim().length>0&&/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt||'')&&/^[a-f0-9]{64}$/.test(r.sha256||'')&&['pronunciation','stress','naturalness','completeness'].every(k=>r.checks?.[k]===true);
}
export function createSpeechPlayer(env=globalThis,{onError=()=>{}}={}){
 let active=null;
 function stop(){if(active){const old=active;active=null;old.pause();old.removeAttribute?.('src');old.load?.();}}
 return {
  supported:typeof env.Audio==='function',stop,
  speak(entry,_language,rate=1){
   if(!isReviewedAudio(entry)){onError('unreviewed');return false;}
   if(typeof env.Audio!=='function'){onError('unsupported');return false;}
   stop();
   const audio=new env.Audio(new URL(entry.audio,env.document?.baseURI||env.location?.href).href);active=audio;
   audio.playbackRate=Number.isFinite(rate)?Math.max(.65,Math.min(1.2,rate)):1;
   audio.preservesPitch=true;
   audio.onended=()=>{if(active===audio)active=null;};
   audio.onerror=()=>{if(active===audio){active=null;onError('unavailable');}};
   try{const promise=audio.play();promise?.catch(()=>{if(active===audio){active=null;onError('unavailable');}});return true;}catch{active=null;onError('unavailable');return false;}
  },destroy:stop
 };
}
