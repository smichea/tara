// Phonetic symbols are internal data. Ordinary UI renders only spelling and letter spans.
export const MAX_SECONDS=16;
const WORDS=/[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;
export function words(text){return [...text.matchAll(WORDS)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));}
export function phones(ipa){
 const out=[];
 for(const c of String(ipa).replace(/\([a-z-]+\)/g,'').normalize('NFD')){
  if(/[ˈˌːˑ_\s.‿|\-()]/u.test(c))continue;
  if(/\p{M}/u.test(c)){if(out.length&&c==='̃')out[out.length-1]+=c;continue;}
  if(c==='͡'||c==='ʰ'||c==='ʲ'||c==='ʷ')continue;
  out.push(c==='ɡ'?'g':c);
 }
 return out;
}
export function canonical(p,language){
 p=p.replace(/ɡ/g,'g').normalize('NFD');
 if(language==='fil')return ({'ɐ':'a','ɑ':'a','ɛ':'e','ɪ':'i','ɔ':'o','ʊ':'u','ɾ':'r','ɹ':'r'})[p]||p;
 return p;
}
export function align(expected,heard,language='fr'){
 const a=expected.map(p=>canonical(typeof p==='string'?p:p.phone,language)),b=heard.map(p=>canonical(typeof p==='string'?p:p.phone,language));
 const cols=b.length+1,cost=new Float32Array((a.length+1)*cols),back=new Uint8Array(cost.length);
 for(let i=1;i<=a.length;i++){cost[i*cols]=i;back[i*cols]=1;}
 for(let j=1;j<=b.length;j++){cost[j]=j;back[j]=2;}
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  const k=i*cols+j,sub=cost[k-cols-1]+(a[i-1]===b[j-1]?0:1),del=cost[k-cols]+1,ins=cost[k-1]+1;
  cost[k]=Math.min(sub,del,ins);back[k]=sub<=del&&sub<=ins?0:del<=ins?1:2;
 }
 let i=a.length,j=b.length;const steps=[];
 while(i||j){const move=back[i*cols+j];if(i&&j&&move===0){steps.push({expected:--i,heard:--j,same:a[i]===b[j]});}else if(i&&(move===1||!j)){steps.push({expected:--i,heard:null,same:false});}else{steps.push({expected:null,heard:--j,same:false});}}
 return {steps:steps.reverse(),distance:cost[a.length*cols+b.length],similarity:Math.max(0,1-cost[a.length*cols+b.length]/Math.max(a.length,b.length,1))};
}
const FR={
 eau:['o'],ain:['ɛ̃'],ein:['ɛ̃'],oin:['wɛ̃'],œu:['œ','ø'],oeu:['œ','ø'],ch:['ʃ','k'],ph:['f'],th:['t'],gn:['ɲ','nj'],ou:['u','w'],oi:['wa'],au:['o'],ai:['ɛ','e'],ei:['ɛ'],eu:['ø','œ'],an:['ɑ̃','an'],am:['ɑ̃','am'],en:['ɑ̃','ɛn','ən'],em:['ɑ̃','ɛm'],on:['ɔ̃','ɔn'],om:['ɔ̃','ɔm'],in:['ɛ̃','in'],im:['ɛ̃','im'],un:['œ̃','ɛ̃','yn'],um:['œ̃','ɔm'],qu:['k'],gu:['g','gy'],ll:['j','l'],ss:['s'],
 a:['a','ɑ'],à:['a'],â:['a','ɑ'],b:['b'],c:['k','s'],ç:['s'],d:['d',''],e:['ə','ɛ','e',''],é:['e'],è:['ɛ'],ê:['ɛ'],ë:['ɛ','ə'],f:['f'],g:['g','ʒ'],h:[''],i:['i','j'],î:['i'],ï:['i'],j:['ʒ'],k:['k'],l:['l'],m:['m'],n:['n'],o:['o','ɔ'],ô:['o'],p:['p',''],q:['k'],r:['ʁ','r'],s:['s','z',''],t:['t','s',''],u:['y','ɥ'],û:['y'],ù:['y'],v:['v'],w:['w','v'],x:['ks','gz','s','z',''],y:['i','j'],z:['z',''],"'":[''],"’":[''],'-':['']
};
const FIL={ng:['ŋ'],mga:['maŋa'],a:['a','ɐ'],b:['b'],c:['k','s'],d:['d'],e:['e','ɛ'],f:['f'],g:['g'],h:['h'],i:['i','j'],j:['dʒ','ʒ','h'],k:['k'],l:['l'],m:['m'],n:['n'],ñ:['nj','ɲ'],o:['o','ɔ'],p:['p'],q:['k'],r:['r','ɾ'],s:['s'],t:['t'],u:['u','w'],v:['v','b'],w:['w'],x:['ks'],y:['j','i'],z:['z','s'],"'":['ʔ',''],"’":['ʔ',''],'-':['','ʔ']};
export function tagalogPhones(word){
 const lower=word.toLowerCase();if(lower==='ng')return ['n','a','ŋ'];if(lower==='mga')return ['m','a','ŋ','a'];
 const out=[];for(let i=0;i<lower.length;){const g=lower.slice(i,i+2)==='ng'?'ng':lower[i];out.push(...phones(FIL[g]?.[0]||g));i+=g.length;}return out;
}
// Dynamic programming keeps offsets in the original word, including silent letters.
// Unknown spellings remain a whole-word hint rather than inventing precise alignment.
export function letterSpans(word,expected,language){
 const table=language==='fil'?FIL:FR,n=word.length,m=expected.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(null));dp[0][0]={cost:0};
 for(let i=0;i<n;i++)for(let j=0;j<=m;j++)if(dp[i][j])for(let len=1;len<=Math.min(3,n-i);len++){
  const key=word.slice(i,i+len).toLowerCase().normalize('NFC'),variants=table[key];if(!variants&&len>1)continue;
  for(const variant of variants||[expected[j]||'']){
   const ps=phones(variant),end=j+ps.length;if(end>m)continue;
   const mismatch=ps.reduce((sum,p,k)=>sum+(canonical(p,language)===canonical(expected[j+k],language)?0:2),0),cost=dp[i][j].cost+mismatch+(variants?0:2)+.01;
   if(!dp[i+len][end]||cost<dp[i+len][end].cost)dp[i+len][end]={cost,prev:[i,j],start:i,end:i+len,first:j,last:end};
  }
 }
 if(!dp[n][m]||dp[n][m].cost>Math.max(2,m*.8))return expected.map(()=>({start:0,end:n}));
 const spans=Array(m);let i=n,j=m;while(i||j){const node=dp[i][j];for(let k=node.first;k<node.last;k++)spans[k]={start:node.start,end:node.end};[i,j]=node.prev;}return spans;
}
const READ_FR={g:'g','ʁ':'r',r:'r','ɾ':'r','ɹ':'r',a:'a','ɑ':'a','ɐ':'a',e:'é','ɛ':'è','ə':'e',i:'i','ɪ':'i',o:'o','ɔ':'o',u:'ou','ʊ':'ou',y:'u','ʏ':'u','ø':'eu','œ':'eu','ɑ̃':'an','ã':'an','ɔ̃':'on','ɛ̃':'in','œ̃':'un','ʃ':'ch','ʒ':'j','ɲ':'gn','ŋ':'ng',j:'y','ɥ':'u',w:'ou',b:'b',d:'d',f:'f',h:'h',k:'c',l:'l',m:'m',n:'n',p:'p',s:'s',t:'t',v:'v',z:'z','ʔ':''};
const READ_FIL={...READ_FR,e:'e','ɛ':'e','ə':'a',u:'u','ʊ':'u',y:'yu',j:'y',w:'w',k:'k','ʁ':'r','ʃ':'sy','ʒ':'dy','ɲ':'ny','ɑ̃':'an','ɔ̃':'on','ɛ̃':'en'};
export function readable(sequence,language){const map=language==='fil'?READ_FIL:READ_FR;return sequence.map(p=>map[canonical(typeof p==='string'?p:p.phone,language)]??'·').join('');}
const MNEMONIC={g:'g','ʁ':'R',r:'r','ɾ':'*','ɹ':'r\\',a:'a','ɑ':'A:','ɐ':'a',e:'e','ɛ':'E','ə':'@',i:'i','ɪ':'I',o:'o','ɔ':'O',u:'u','ʊ':'U',y:'y','ʏ':'Y','ø':'Y','œ':'W','ɑ̃':'A~','ã':'a~','ɔ̃':'O~','ɛ̃':'E~','œ̃':'W~','ʃ':'S','ʒ':'Z','ɲ':'J','ŋ':'N',j:'j','ɥ':'H',w:'w',b:'b',d:'d',f:'f',h:'h',k:'k',l:'l',m:'m',n:'n',p:'p',s:'s',t:'t',v:'v',z:'z','ʔ':'?','θ':'T','ð':'D','x':'x','ç':'C'};
export function synthesisInput(sequence,language){return '[['+sequence.map(p=>{const phone=canonical(typeof p==='string'?p:p.phone,language);if(!MNEMONIC[phone])throw Error('Some recognised sounds cannot yet be reconstructed. Use My voice to listen to the original.');return language==='fr'&&phone==='ʁ'?'r':language==='fr'&&phone==='r'?'R':phone==='ø'?'2':MNEMONIC[phone];}).join('')+']]';}
export function decodeCTC(data,dims,tokens,duration,validLength){
 const [rows,size]=dims.slice(-2),count=Math.min(rows,Number(validLength)||rows),raw=[];let previous=-1;
 for(let i=0;i<count;i++){
  let best=0,max=-Infinity;for(let k=0;k<size;k++)if(data[i*size+k]>max){max=data[i*size+k];best=k;}
  let sum=0;for(let k=0;k<size;k++)sum+=Math.exp(data[i*size+k]-max);const confidence=1/sum,token=tokens[best];
  if(best>3&&token){if(best===previous&&raw.length){raw.at(-1).end=(i+1)*duration/count;raw.at(-1).confidence=Math.max(raw.at(-1).confidence,confidence);}else raw.push({phone:token==='ɡ'?'g':token,start:i*duration/count,end:(i+1)*duration/count,confidence});}
  previous=best;
 }
 const result=[];for(const event of raw){if(/^[\p{M}ːʰʲʷ]+$/u.test(event.phone)){if(result.length&&event.phone==='̃'){result.at(-1).phone+='̃';result.at(-1).end=event.end;}continue;}result.push(event);}return result;
}
export function makePlan(text,language,phonemize){
 const tokens=words(text),context=language==='fr'?phonemize(text).trim().split(/\s+/):[];
 const plan=tokens.map((w,i)=>{const expected=language==='fil'?tagalogPhones(w.text):phones(context.length===tokens.length?context[i]:phonemize(w.text));return {...w,phones:expected,spans:letterSpans(w.text,expected,language)};});
 const expected=plan.flatMap((w,word)=>w.phones.map((phone,i)=>({phone,word,span:w.spans[i]})));return {text,language,words:plan,expected};
}
export function compare(plan,heard,{partial=false}={}){
 const alignment=align(plan.expected,heard,plan.language),groups=plan.words.map(w=>({...w,heard:[],changes:[],matches:0,startTime:null,endTime:null}));let word=0;
 for(const step of alignment.steps){
  const target=step.expected===null?null:plan.expected[step.expected];if(target)word=target.word;const group=groups[word];if(!group)continue;
  if(step.heard!==null){const event=heard[step.heard];group.heard.push(event);group.startTime=group.startTime===null?event.start:Math.min(group.startTime,event.start);group.endTime=Math.max(group.endTime||0,event.end);}
  if(step.same)group.matches++;else if(target)group.changes.push(target.span);else if(step.heard!==null)group.changes.push({start:0,end:group.text.length});
 }
 for(const [index,group] of groups.entries()){group.confidence=group.heard.reduce((n,p)=>n+p.confidence,0)/Math.max(1,group.heard.length);group.status=!group.heard.length?(partial?'pending':'uncertain'):group.confidence<.35||plan.reliability?.[index]===false?'uncertain':group.matches===group.phones.length&&group.heard.length===group.phones.length?'close':'retry';group.readable=group.status==='close'?group.text:readable(group.heard,plan.language);}
 return {words:groups,similarity:alignment.similarity,partial,phoneCount:heard.length};
}
