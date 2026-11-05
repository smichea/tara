import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMuseumQuiz,museumSelections} from '../dist/museum.js';
import {normalize,accepts} from '../dist/lib.js';
const course=JSON.parse(await readFile(new URL('../dist/courses/fil-en.json',import.meta.url)));
test('museum exports include each earlier school stage and preserve distinct meanings and attribution',()=>{
 assert.equal(museumSelections(course).length,15);
 for(const selection of museumSelections(course)){
  const bank=createMuseumQuiz(course,selection.id);assert(bank.author.includes('CC BY-SA 4.0'));assert(/^[a-z][a-z0-9-]{2,60}$/.test(bank.id));
  assert.equal(new Set(bank.questions.map(q=>q.prompt)).size,bank.questions.length);
  for(const q of bank.questions){assert.equal(q.answers.length,4);assert.equal(new Set(q.answers.map(normalize)).size,4);assert(q.correct>=0&&q.correct<4);assert(q.prompt.length<=1200);assert(q.explanation.length<=1500);}
 }
 assert.equal(createMuseumQuiz(course,'school-8').questions.length,64);
});
test('published banks and game content match the current editable course',async()=>{
 for(const selection of museumSelections(course)){
  const bank=createMuseumQuiz(course,selection.id),published=JSON.parse(await readFile(new URL('../dist/museum/'+selection.id+'.quiz.json',import.meta.url)));assert.deepEqual(published,bank,'Rebuild the stale bank '+selection.id);
  const pack=JSON.parse(await readFile(new URL('../dist/museum/'+selection.id+'.rmg.json',import.meta.url)));
  const start=pack.engine.indexOf('globalThis.RetroQuizBank=')+'globalThis.RetroQuizBank='.length,end=pack.engine.indexOf(';\n;const __quizCreate=',start),embedded=Object.values(JSON.parse(pack.engine.slice(start,end)))[0];
  const expected=bank.questions.length>100?Array.from({length:100},(_,i)=>bank.questions[Math.floor(i*bank.questions.length/100)]):bank.questions;
  assert.deepEqual(embedded.questions.map(({image,...q})=>q),expected);assert(pack.licenseText.includes('CC BY-SA 4.0'));assert(pack.licenseText.includes('manaty/game-quizz'));
 }
});

test('declared equivalent Filipino answers cannot be offered as conflicting quiz choices',()=>{
 const c=structuredClone(course);c.lessons=[{id:'example',entries:[
  {id:'thanks',text:'Salamat.',translation:'Thank you.',accepted:['Maraming salamat.']},
  {id:'appreciation',text:'Maraming salamat.',translation:'Much appreciated.'},
  ...['Blue chair.','Green garden.','Red table.','Tall tree.'].map((translation,i)=>({id:'x'+i,text:'Ibang pangungusap '+i,translation}))
 ]}];const bank=createMuseumQuiz(c);const q=bank.questions.find(q=>q.prompt.endsWith('Salamat.'));assert(!q.answers.includes('Much appreciated.'));
});
