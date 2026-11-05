import {readFile, readdir, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateCourse} from '../dist/lib.js';
const dir=resolve('dist/courses');
const registry=JSON.parse(await readFile(resolve(dir,'index.json'),'utf8'));
if(!Array.isArray(registry)||!registry.length)throw new Error('Register at least one course.');
const ids=new Set(),files=new Set();let entries=0,lessons=0;
for(const item of registry){
 if(!/^[a-z0-9-]+\.json$/.test(item.file))throw new Error('Unsafe course file path.');
 if(ids.has(item.id)||files.has(item.file))throw new Error('Duplicate course registration.');
 ids.add(item.id);files.add(item.file);
 const course=JSON.parse(await readFile(resolve(dir,item.file),'utf8'));
 const errors=validateCourse(course);
 if(course.id!==item.id)errors.push('Registry id does not match course id.');
 for(const lesson of course.lessons||[])for(const entry of lesson.entries||[]){
  if(entry.audio){try{await stat(resolve('dist',entry.audio));}catch{errors.push(`Missing audio: ${entry.audio}`);}}
 }
 if(errors.length)throw new Error(`${item.file}:\n${errors.join('\n')}`);
 entries+=course.lessons.reduce((n,l)=>n+l.entries.length,0);lessons+=course.lessons.length;
}
for(const file of await readdir(dir))if(file.endsWith('.json')&&file!=='index.json'&&!files.has(file))throw new Error(`Unregistered course: ${file}`);
console.log(`Validated ${registry.length} course(s), ${lessons} lessons, ${entries} entries.`);
