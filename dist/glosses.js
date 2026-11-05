// Glosses belong to a particular word occurrence, not a global dictionary.
const WORDS=/[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;
export function wordTokens(text){return [...String(text??'').matchAll(WORDS)].map(m=>({text:m[0],index:m.index}));}
export function validGlosses(entry){const words=wordTokens(entry.text);return Array.isArray(entry.glosses)&&words.length>0&&entry.glosses.length===words.length&&entry.glosses.every((g,i)=>g&&g.text===words[i].text&&typeof g.meaning==='string'&&g.meaning.trim().length>0&&g.meaning.length<=240);}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function glossedText(entry){if(!validGlosses(entry))return esc(entry.text);let cursor=0;const html=wordTokens(entry.text).map((w,i)=>{const before=entry.text.slice(cursor,w.index);cursor=w.index+w.text.length;return `${esc(before)}<button type="button" class="gloss-word" data-gloss="${esc(entry.glosses[i].meaning)}" aria-label="${esc(w.text)}: show meaning in this sentence">${esc(w.text)}</button>`;}).join('');return html+esc(entry.text.slice(cursor));}
export function installWordGlosses(doc=document){
 const tip=doc.createElement('div');tip.id='word-gloss-tooltip';tip.className='word-gloss-tooltip';tip.role='tooltip';tip.hidden=true;doc.body.append(tip);let active=null,pinned=false;
 function close(){active?.removeAttribute('aria-describedby');active?.classList.remove('gloss-active');active=null;pinned=false;tip.hidden=true;}
 function show(button,pin=false){if(pinned&&!pin)return;close();active=button;pinned=pin;const word=doc.createElement('strong'),meaning=doc.createElement('span'),context=doc.createElement('small');word.textContent=button.textContent;meaning.textContent=button.dataset.gloss;context.textContent='Meaning in this sentence';tip.replaceChildren(context,word,meaning);tip.hidden=false;button.setAttribute('aria-describedby',tip.id);button.classList.add('gloss-active');const box=button.getBoundingClientRect(),size=tip.getBoundingClientRect(),win=doc.defaultView;tip.style.left=`${Math.max(12,Math.min(box.left+box.width/2-size.width/2,win.innerWidth-size.width-12))}px`;tip.style.top=`${Math.max(12,box.top-size.height-12>=12?box.top-size.height-12:Math.min(box.bottom+12,win.innerHeight-size.height-12))}px`;}
 doc.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const b=e.target.closest('.gloss-word');if(b&&b!==active)show(b);});
 doc.addEventListener('pointerout',e=>{if(!pinned&&active===e.target.closest('.gloss-word')&&!active?.contains(e.relatedTarget))close();});
 doc.addEventListener('focusin',e=>{const b=e.target.closest('.gloss-word');if(b)show(b);});
 doc.addEventListener('focusout',()=>{if(!pinned)close();});
 doc.addEventListener('click',e=>{const b=e.target.closest('.gloss-word');if(b){if(active===b&&pinned)close();else show(b,true);}else close();});
 doc.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 doc.defaultView.addEventListener('scroll',close,{passive:true,capture:true});doc.defaultView.addEventListener('resize',close);return {close};
}
