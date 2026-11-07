import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reverseCourse,reversible,englishVariants} from '../dist/reverse.js';
import {validateCourse,accepts} from '../dist/lib.js';
import {createSpeechPlayer,synthesizes} from '../dist/speech.js';
const load=async id=>JSON.parse(await readFile(new URL(`../dist/courses/${id}.json`,import.meta.url)));

test('every English-taught course yields a valid English course for its speakers',async()=>{
 for(const id of ['fil-en','fr-en']){
  const source=await load(id),r=reverseCourse(source);
  assert(reversible(source));assert(!reversible(r),'A reverse course is never reversed again');
  assert.deepEqual(validateCourse(r),[]);assert.equal(r.languageCode,'en');assert.equal(r.fromCode,source.languageCode);
  assert.equal(r.id,`en-from-${source.languageCode}`);assert.equal(r.learnerId,r.id,'Progress is separate from the original learner');
  assert.deepEqual(r.derivedFrom,{courseId:source.id,author:source.author,license:source.license});
  const original=new Map(source.lessons.flatMap(l=>l.entries).map(e=>[e.id,e]));
  for(const e of r.lessons.flatMap(l=>l.entries)){const o=original.get(e.id);assert.equal(e.text,o.translation);assert.equal(e.translation,o.text);for(const k of ['audio','audioReview','glosses','note'])assert.equal(e[k],undefined);}
  for(const l of r.lessons)for(const k of ['task','tip','reading','school','foundation'])assert.equal(l[k],undefined);
 }
});
test('Filipino school-curriculum lessons are not turned into English lessons',async()=>{
 const source=await load('fil-en'),r=reverseCourse(source),kept=new Set(r.lessons.map(l=>l.id));
 for(const l of source.lessons)assert.equal(kept.has(l.id),!l.school&&!l.foundation,l.id);
 assert(r.lessons.length>=40);
 assert(r.lessons.some(l=>l.goal==='Recognize common instructions in English.'));
});
test('English contractions are accepted both ways',()=>{
 assert.deepEqual(englishVariants('I’m doing well.'),['I am doing well.']);
 assert.deepEqual(englishVariants('It is two o’clock.'),["It's two o'clock."]);
 assert.deepEqual(englishVariants('I can’t come.'),['I cannot come.','I can not come.']);
 assert.deepEqual(englishVariants('Thank you!'),[]);
 const entry={text:'I do not have paper.',accepted:englishVariants('I do not have paper.')};
 assert(accepts("I don't have paper",entry,'en'));assert(accepts('i do not have paper',entry,'en'));assert(!accepts('I have paper',entry,'en'));
});
test('browser speech is used for English only, never for Filipino or French',()=>{
 const spoken=[];class SpeechSynthesisUtterance{constructor(text){this.text=text;}}
 const env={speechSynthesis:{speak:u=>spoken.push(u),cancel(){},getVoices:()=>[{lang:'en-US',localService:true,name:'Local'}]},SpeechSynthesisUtterance},errors=[];
 const player=createSpeechPlayer(env,{onError:e=>errors.push(e)});
 assert(synthesizes('en',env));assert(!synthesizes('fil',env));assert(!synthesizes('fr',env));
 assert(player.speak({text:'How are you?'},'en',.8));assert.equal(spoken[0].text,'How are you?');assert.equal(spoken[0].lang,'en-US');assert.equal(spoken[0].rate,.8);assert.equal(spoken[0].voice.name,'Local');
 assert(!player.speak({text:'Kumusta ka?'},'fil'));assert(!player.speak({text:'Bonjour'},'fr'));assert.equal(spoken.length,1);assert.deepEqual(errors,['unreviewed','unreviewed']);
});
