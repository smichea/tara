// SentencePiece unigram tokenizer for Opus-MT (Marian) vocabularies exported by
// scripts/prepare-translation-assets.py. Pure functions, shared by worker and tests.
const SPACE='\u2581';
export function normalize(text){
 // nmt_nfkc: NFKC, control characters removed, runs of whitespace collapsed.
 return String(text).normalize('NFKC').replace(/[\u200B\u3000]/g,' ').replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F\uFEFF]/g,'').replace(/\s+/g,' ').trim();
}
export function createUnigram(pieces){
 const index=new Map();let min=0,maxLength=1;
 pieces.forEach(([piece,score,special],id)=>{if(special)return;index.set(piece,{id,score});min=Math.min(min,score);maxLength=Math.max(maxLength,[...piece].length);});
 const unknownScore=min-10;
 return function encode(text){
  const chars=[...(SPACE+normalize(text).replace(/ /g,SPACE))],n=chars.length;
  if(n===1)return [];
  const best=new Array(n+1).fill(-Infinity),back=new Array(n+1);best[0]=0;
  for(let start=0;start<n;start++){
   if(best[start]===-Infinity)continue;let piece='';
   for(let end=start+1;end<=Math.min(n,start+maxLength);end++){
    piece+=chars[end-1];const hit=index.get(piece);
    if(hit){const score=best[start]+hit.score;if(score>best[end]){best[end]=score;back[end]={start,piece};}}
   }
   // As in SentencePiece, a character no piece starts with becomes <unk>.
   if(!index.has(chars[start])){const score=best[start]+unknownScore;if(score>best[start+1]){best[start+1]=score;back[start+1]={start,piece:chars[start]};}}
  }
  const out=[];for(let i=n;i>0;i=back[i].start)out.push(back[i].piece);return out.reverse();
 };
}
export function createTokenizer(data){
 const source=createUnigram(data.source),target=createUnigram(data.target),ids=new Map(Object.entries(data.vocab)),words=[];
 for(const [piece,id] of ids)words[id]=piece;
 const toIds=pieces=>pieces.map(p=>ids.has(p)?ids.get(p):data.unk);
 return {
  eos:data.eos,pad:data.pad,start:data.start,unk:data.unk,size:words.length,
  encodeSource:text=>[...toIds(source(text)),data.eos],
  encodeTarget:text=>[...toIds(target(text)),data.eos],
  decode:list=>list.filter(id=>id!==data.eos&&id!==data.pad).map(id=>words[id]??'').join('').replace(new RegExp(SPACE,'g'),' ').trim()
 };
}
