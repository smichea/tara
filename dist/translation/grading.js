// Translation-answer checking. Deterministic checks always run first; the
// optional local model only adds evidence for answers that differ from every
// reference, and its verdicts are labelled as uncertain.
import {normalize,accepts} from '../lib.js';

export function editDistance(a,b){
 a=[...a];b=[...b];let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(previous[j]+1,row[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=row;}
 return previous[b.length];
}
// Accents are meaningful in course answers but a missing accent is a near miss.
const plain=text=>normalize(text).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/['’-]/g,' ').replace(/\s+/g,' ').trim();
const withoutParticles=(text,languageCode)=>/^(fil|tl)(-|$)/i.test(languageCode)?text.split(' ').filter(w=>w!=='po'&&w!=='ho').join(' '):text;

// Rule-based result: exact/accepted, near miss (accents, punctuation or a small
// typo), or different. `references` holds the expected answer first.
export function checkWritten(answer,references,languageCode=''){
 const list=references.filter(Boolean);
 if(accepts(answer,{text:list[0],accepted:list.slice(1)},languageCode))return {status:'correct',reference:list[0]};
 const bare=plain(answer),actual=withoutParticles(bare,languageCode);let best=null;
 for(const reference of list){
  const full=plain(reference),expected=withoutParticles(full,languageCode);
  if(bare===full)return {status:'close',reference,reason:'accents'};
  if(actual===expected)return {status:'close',reference,reason:'politeness'};
  const distance=editDistance(actual,expected),allowed=expected.length<8?1:expected.length<20?2:3;
  // Typos stay inside words: the same number of words, each nearly identical.
  const a=actual.split(' '),e=expected.split(' ');
  if(distance<=allowed&&a.length===e.length&&a.every((w,i)=>w===e[i]||editDistance(w,e[i])<=Math.max(1,Math.floor(e[i].length/4))&&w.length>2))
   if(!best||distance<best.distance)best={status:'close',reference,reason:'spelling',distance};
 }
 return best||{status:'different',reference:list[0]};
}

// English meaning words, for comparing a model reading with an expected meaning.
const CONTRACTIONS=[[/\bcan't\b/g,'can not'],[/\bwon't\b/g,'will not'],[/n't\b/g,' not'],[/'m\b/g,' am'],[/'re\b/g,' are'],[/'ll\b/g,' will'],[/'ve\b/g,' have'],[/'d\b/g,' would'],[/'s\b/g,'']];
const STOP=new Set('a an the is am are was were be been being to of in on at for by with and or but so it its this that these those there here do does did i me my you your we our they their he him his she her please just very really now then too also some any one s'.split(' '));
const NEGATION=new Set(['not','no','never','nothing','nobody','none','without']);
export function meaningWords(text){
 let t=String(text).normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
 for(const [pattern,value] of CONTRACTIONS)t=t.replace(pattern,value);
 const words=t.replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
 return {negated:words.some(w=>NEGATION.has(w)),pronouns:words.filter(w=>/^(i|me|my|you|your|we|our|us|they|their|them|he|him|his|she|her)$/.test(w)),
  content:[...new Set(words.filter(w=>!STOP.has(w)&&!NEGATION.has(w)).map(stem))],numbers:words.filter(w=>/^\d+$/.test(w))};
}
function stem(word){return word.length>4?word.replace(/(ing|ed|es|s)$/,''):word;}
export function compareMeaning(reading,expected){
 const a=meaningWords(reading),e=meaningWords(expected);
 const shared=e.content.filter(w=>a.content.includes(w)).length;
 return {negation:a.negated!==e.negated,numbers:a.numbers.join()!==e.numbers.join()&&(a.numbers.length>0||e.numbers.length>0),
  overlap:e.content.length?shared/e.content.length:1,extra:a.content.filter(w=>!e.content.includes(w)).length,missing:e.content.filter(w=>!a.content.includes(w))};
}
// Give a typed answer the reference's capital and final punctuation, so model
// scores compare meaning rather than how carefully the sentence was finished.
export function shapeLike(answer,reference){
 let text=String(answer).trim().replace(/\s+/g,' ');const end=/[.!?。！？]+$/.exec(String(reference).trim())?.[0];
 if(/^\p{Lu}/u.test(reference)&&/^\p{Ll}/u.test(text))text=text[0].toLocaleUpperCase()+text.slice(1);
 if(end&&!/[.!?。！？]$/.test(text))text+=(/\s[?!]$/.test(reference)?' ':'')+end;
 return text;
}

// Model thresholds were calibrated on tests/fixtures/translation-eval.json: mean
// per-token log-probability of the answer minus that of the best reference.
export const LIKELY=-0.6,UNLIKELY=-1;
export function decide({direction,delta,reading,prompt,answer,reference}){
 const conflict=direction==='to-target'?compareMeaning(reading,prompt):compareMeaning(answer,reference);
 if(conflict.negation)return {verdict:'unlikely',why:'negation'};
 if(conflict.numbers)return {verdict:'unlikely',why:'number'};
 // A reading that shares no meaning word with the prompt may be a model failure.
 if(delta>=LIKELY&&!(direction==='to-target'&&conflict.overlap===0))return {verdict:'likely'};
 if(delta<=UNLIKELY)return {verdict:'unlikely',why:'meaning'};
 return {verdict:'unsure'};
}
