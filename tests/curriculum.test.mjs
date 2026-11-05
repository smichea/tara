import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CEFR_LEVELS,courseLevels,lessonQueue} from '../dist/curriculum.js';
import {validateCourse,freshProgress,safeProgress,finishSession} from '../dist/lib.js';
const course=JSON.parse(await readFile(new URL('../dist/courses/fil-en.json',import.meta.url)));
test('the extended course has lessons at all six practice targets with substantial exercises',()=>{
 assert.deepEqual(validateCourse(course),[]);assert.deepEqual(courseLevels(course).map(l=>l.id),CEFR_LEVELS.map(l=>l.id));
 assert.equal(course.lessons.length,124);assert.equal(course.lessons.flatMap(l=>l.entries).length,576);
 for(const l of course.lessons.slice(12)){assert(l.reading.questions.length>=2);assert(l.reading.text.length>100);assert(l.task.checklist.length>=3);assert(l.tip.length>70);}
});
test('malformed levels, comprehension answers and empty expression prompts are rejected',()=>{
 const c=structuredClone(course);c.lessons[12].level='C3';assert(validateCourse(c).some(x=>x.includes('level must')));
 c.lessons[12].level='A1';c.lessons[12].reading.questions[0].answer=99;assert(validateCourse(c).some(x=>x.includes('answer index')));
 c.lessons[12].task.prompt='';assert(validateCourse(c).some(x=>x.includes('Expression tasks')));
});
test('lesson queues include reading questions without pretending they are vocabulary cards',()=>{
 const lesson=course.lessons.find(l=>l.level==='C1');const queue=lessonQueue(lesson);
 assert.equal(queue.filter(q=>q.type==='comprehension').length,lesson.reading.questions.length);
 const answers=queue.map(q=>({...q,correct:true}));const r=finishSession(freshProgress(),course,lesson.id,answers);
 assert.equal(Object.keys(r.progress.cards).length,lesson.entries.length);assert.equal(r.accuracy,100);
});
test('backups preserve saved writing and restore old progress without a writing field',()=>{
 const p=freshProgress();p.writing['fil-en:c1-academic']={text:'May ibang wastong paraan ng pagpapahayag.',updated:Date.now()};assert.deepEqual(safeProgress(p),p);
 const old=structuredClone(p);delete old.writing;assert.deepEqual(safeProgress(old).writing,{});
 p.writing['fil-en:c1-academic'].text='x'.repeat(6001);assert.throws(()=>safeProgress(p));
});
test('new course data retains the original progress keys',()=>{
 const ids=['say-hello','introduce-yourself','getting-unstuck','friends','food','ordering','school','home','feelings','getting-around','small-talk','learning'];
 assert.deepEqual(course.lessons.slice(0,12).map(l=>l.id),ids);
 for(const l of course.lessons.slice(0,12))assert.deepEqual(l.entries.map(e=>e.id),[1,2,3,4].map(i=>`${l.id}-${i}`));
});

test('the school pathway includes Grade 1 prerequisites and every earlier grade through Grade 8',async()=>{
 const {schoolStages,schoolLessons}=await import('../dist/curriculum.js');
 assert.deepEqual(schoolStages(course).map(s=>s.id),['foundations','2','3','4','5','6','7','8']);
 assert.equal(schoolLessons(course,'foundations').length,8);
 for(const grade of [2,3,4,5,6,7,8]){const lessons=schoolLessons(course,String(grade));assert.equal(lessons.length,grade===8?16:8);assert.deepEqual([...new Set(lessons.map(l=>l.school.quarter))],[1,2,3,4]);for(const l of lessons){assert(l.school.source.startsWith('https://'));assert(l.reading&&l.task);}}
});
test('invalid school mapping and unsafe reading citations are rejected',()=>{
 const c=structuredClone(course),l=c.lessons.find(l=>l.school);l.school.grade=1;assert(validateCourse(c).some(e=>e.includes('School references')));l.school.grade=8;l.reading.source='javascript:alert(1)';assert(validateCourse(c).some(e=>e.includes('HTTPS URL')));
});
