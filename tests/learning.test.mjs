import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,accepts,validateCourse,freshProgress,safeProgress,scheduleCard,finishSession,streak,localDay,shuffle,forkCourse} from '../dist/lib.js';
const course=JSON.parse(await readFile(new URL('../dist/courses/fil-en.json',import.meta.url)));
const entry=course.lessons[0].entries[0];
test('original starter lessons remain available before the extended course',()=>{assert.deepEqual(validateCourse(course),[]);assert.equal(course.lessons[0].id,'say-hello');assert.equal(course.lessons[11].id,'learning');assert.equal(course.lessons.slice(0,12).flatMap(l=>l.entries).length,48);});
test('typing accepts punctuation, case, spacing and declared variants; preserves meaningful accents',()=>{assert(accepts('  KUMUSTA ka! ',entry));assert(accepts('Kamusta ka?',entry));assert(!accepts('Kumusta ako',entry));assert.equal(normalize('你好！'),'你好');assert.notEqual(normalize('si'),normalize('sí'));});
test('new languages and non-Latin scripts need no engine changes',()=>{const c=structuredClone(course);c.id='ja-en';c.language='Japanese';c.languageCode='ja';c.lessons[0].entries[0].text='こんにちは';assert.deepEqual(validateCourse(c),[]);});
test('invalid and duplicate IDs are rejected',()=>{const c=structuredClone(course);c.lessons[1].entries[0].id=entry.id;assert(validateCourse(c).some(x=>x.includes('duplicate')));c.id='../escape';assert(validateCourse(c).some(x=>x.includes('Course id')));});
test('remote or traversing audio paths are rejected',()=>{for(const audio of ['https://tracker.invalid/a.mp3','audio/../secret.mp3','//tracker.invalid/a.mp3','audio/a.svg']){const c=structuredClone(course);c.lessons[0].entries[0].audio=audio;assert(validateCourse(c).length);}});
test('reviewed status requires named reviewers',()=>{const c=structuredClone(course);c.status='reviewed';assert(validateCourse(c).some(x=>x.includes('reviewers')));c.reviewers=['Fluent speaker'];assert.deepEqual(validateCourse(c),[]);});
test('review interval grows and a mistake resets it',()=>{const now=1000000;let card=scheduleCard(null,true,now);assert.equal(card.due,now+86400000);card=scheduleCard(card,true,now);assert.equal(card.due,now+3*86400000);card=scheduleCard(card,false,now);assert.equal(card.due,now+600000);assert.equal(card.successes,0);assert.equal(card.mistakes,1);});
test('XP cannot be farmed by replaying the same lesson on the same day',()=>{const date=new Date(2026,10,5,12);const first=finishSession(freshProgress(),course,'say-hello',[{entry,correct:true}],date);assert.equal(first.xp,60);const again=finishSession(first.progress,course,'say-hello',[{entry,correct:true}],date);assert.equal(again.xp,0);assert.equal(again.progress.xp,60);assert.equal(Object.keys(again.progress.lessons).length,1);});
test('a successful retry keeps the missed phrase scheduled soon',()=>{const now=new Date(2026,10,5,12);const r=finishSession(freshProgress(),course,'say-hello',[{entry,correct:false},{entry,correct:true}],now);assert.equal(r.accuracy,50);assert.equal(r.progress.cards[`fil-en:${entry.id}`].due,now.getTime()+600000);});
test('review sessions never mark a lesson complete',()=>{const r=finishSession(freshProgress(),course,'review',[{entry,correct:true}]);assert.deepEqual(r.progress.lessons,{});});
test('streak includes yesterday until today is completed and handles date rollover',()=>{const now=new Date(2026,0,1,13);assert.equal(streak({'2025-12-30':1,'2025-12-31':1},now),2);assert.equal(streak({'2025-12-31':1,'2026-01-01':1},now),2);assert.equal(streak({'2025-12-30':1},now),0);assert.equal(localDay(now),'2026-01-01');});
test('streak remains consecutive across European daylight saving boundaries',()=>{const now=new Date(2026,9,26,12);assert.equal(streak({'2026-10-24':1,'2026-10-25':1,'2026-10-26':1},now),3);});
test('backups round-trip but reject corrupt or prototype-bearing input',()=>{const p=finishSession(freshProgress(),course,'say-hello',[{entry,correct:true}]).progress;assert.deepEqual(safeProgress(p),p);assert.throws(()=>safeProgress({...p,xp:-1}));assert.throws(()=>safeProgress({...p,cards:{x:{due:1,successes:999,mistakes:0}}}));assert.throws(()=>safeProgress(JSON.parse('{"version":1,"xp":0,"lessons":{},"cards":{},"activity":{},"awards":{"__proto__":true}}')));});
test('shuffling repeated tokens preserves each token identity',()=>{const items=[{id:0,text:'ba'},{id:1,text:'ba'},{id:2,text:'ka'}];assert.deepEqual(shuffle(items,()=>0).map(t=>t.id).sort(),[0,1,2]);assert.deepEqual(items.map(t=>t.id),[0,1,2]);});

test('forks of community edits retain all upstream credits and reset review status',()=>{
 const first=forkCourse(course);first.author='Second contributor';first.status='reviewed';first.reviewers=['Reviewer'];
 const second=forkCourse(first);second.author='Third contributor';
 assert.deepEqual(second.attributions.map(a=>a.author),['Tara contributors','Second contributor']);
 assert.equal(second.status,'draft');assert.deepEqual(second.reviewers,[]);assert.deepEqual(validateCourse(second),[]);
});
test('Thank you accepts salamat po, respectful and common equivalent formulations',()=>{
 const thanks=course.lessons[0].entries.find(e=>e.text==='Salamat!');
 for(const value of ['salamat po','SALAMAT, PO!','salamat ho','maraming salamat','maraming salamat po'])assert(accepts(value,thanks,'fil'),value);
 for(const value of ['hindi salamat','salamat ako','salamat po po','salamat hindi'])assert(!accepts(value,thanks,'fil'),value);
});
test('optional Filipino politeness is language-specific and does not erase a required respectful form',()=>{
 assert(accepts('Hindi ko po maintindihan.',{text:'Hindi ko maintindihan.'},'fil'));
 assert(!accepts('po thank you',{text:'Thank you'},'en'));
 assert(!accepts('Salamat',{text:'Salamat po.'},'fil'));
 assert(accepts('salamat ho',{text:'Salamat!'},'tl-PH'));
});
test('declared equivalent sentence structures and expanded contractions are accepted',()=>{
 const name=course.lessons.find(l=>l.id==='introduce-yourself').entries[0];
 assert(accepts('Marco ang pangalan ko',name,'fil'));
 const doing=course.lessons.find(l=>l.id==='small-talk').entries[0];
 assert(accepts('Ano ang ginagawa mo?',doing,'fil'));
 assert(!accepts('Ano ang ginagawa ko?',doing,'fil'));
});
