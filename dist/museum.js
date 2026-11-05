// Data-only question banks for Retro Museum's open quiz engine.
import {normalize,accepts} from './lib.js';
import {schoolLessons} from './curriculum.js';
const contentWords=s=>new Set(normalize(s).split(' ').filter(x=>x.length>3&&!['this','that','they','there','have','with','from','their','does','will','what','been','them','your','into','only','should'].includes(x)));
function overlap(a,b){const x=contentWords(a),y=contentWords(b);return [...x].filter(w=>y.has(w)).length/Math.max(1,Math.min(x.size,y.size));}
export function museumSelections(course){return [{id:'all',title:'All practice',lessons:course.lessons},...['A1','A2','B1','B2','C1','C2'].map(id=>({id,title:id+' practice',lessons:course.lessons.filter(l=>l.level===id)})),...['foundations','2','3','4','5','6','7','8'].map(id=>({id:'school-'+id,title:id==='foundations'?'Foundations':'Grade '+id,lessons:schoolLessons(course,id)}))].filter(x=>x.lessons.length);}
export function createMuseumQuiz(course,selection='all'){
 const chosen=museumSelections(course).find(x=>x.id===selection);if(!chosen)throw Error('Unknown quiz selection.');
 const pool=chosen.lessons.flatMap(l=>l.entries.map(e=>({...e,level:l.level,lesson:l.id}))),seen=new Set(),questions=[];
 for(const entry of pool){
  const key=normalize(entry.text);if(seen.has(key))continue;seen.add(key);
  // Do not quiz an isolated phrase whose translations conflict in the source bank.
  if(pool.some(e=>normalize(e.text)===key&&normalize(e.translation)!==normalize(entry.translation)))continue;
  const used=new Set([normalize(entry.translation)]),wrong=[];
  const candidates=[...pool.filter(e=>e.lesson===entry.lesson),...pool.filter(e=>e.lesson!==entry.lesson)];
  for(const other of candidates){
   const v=normalize(other.translation);
   if(used.has(v)||accepts(other.text,entry,course.languageCode)||accepts(entry.text,other,course.languageCode)||overlap(entry.translation,other.translation)>.25)continue;
   used.add(v);wrong.push(other.translation);if(wrong.length===3)break;
  }
  if(wrong.length!==3)continue;
  const correct=questions.length%4,answers=[...wrong];answers.splice(correct,0,entry.translation);
  questions.push({id:'q'+(questions.length+1),prompt:`What does this mean in English?\n\n${entry.text}`,answers,correct,difficulty:({A1:1,A2:1,B1:2,B2:3,C1:4,C2:4})[entry.level]||1,explanation:`${entry.text} — ${entry.translation}\n${entry.note||''}`});
 }
 if(!questions.length)throw Error('This selection does not yet have enough distinct answers for a four-choice quiz.');
 return {schemaVersion:1,id:`tara-${course.id}-${selection}`.toLowerCase().slice(0,61),title:`Tara! · ${course.language} · ${chosen.title}`,author:(course.author+' · CC BY-SA 4.0').slice(0,100),language:'en',questions};
}
