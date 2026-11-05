import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createMuseumQuiz,museumSelections} from '../dist/museum.js';
const repo=resolve(process.argv[2]||'.museum/game-quizz'),pinned='dd6c058631c96e6c4525b7802caaf713049dc981';
if(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim()!==pinned)throw Error('Use the pinned public quiz engine revision '+pinned);
const {validateQuiz}=await import(pathToFileURL(resolve(repo,'server/schema.js')));
const {packageQuiz}=await import(pathToFileURL(resolve(repo,'server/package-quiz.js')));
const {validateIsolated}=await import(pathToFileURL(resolve(repo,'node_modules/@manaty/retro-museum-sdk/validate.js')));
const base=JSON.parse(await readFile(resolve(repo,'dist/game.rmg.json'))),course=JSON.parse(await readFile('dist/courses/fil-en.json'));
const out=resolve('dist/museum');await mkdir(out,{recursive:true});
for(const selection of museumSelections(course)){
 const bank=createMuseumQuiz(course,selection.id);validateQuiz(bank);
 const packagedBank={...bank,questions:bank.questions.length>100?Array.from({length:100},(_,i)=>bank.questions[Math.floor(i*bank.questions.length/100)]):bank.questions};
 const pack=packageQuiz(base,packagedBank,{questionCount:Math.min(10,bank.questions.length),mode:'ranking',seconds:30});
 pack.licenseText=(pack.licenseText||'')+'\n\nTara course content: '+course.author+' · CC BY-SA 4.0\nhttps://creativecommons.org/licenses/by-sa/4.0/\nhttps://github.com/smichea/tara\nDraft course content awaiting fluent-speaker review.\nQuiz engine: https://github.com/manaty/game-quizz/tree/'+pinned+' (MIT).';
 const file=resolve(out,selection.id+'.rmg.json');await writeFile(file,JSON.stringify(pack)+'\n');
 const report=await validateIsolated(file);if(report.status!=='passed')throw Error(selection.id+': '+JSON.stringify(report));
 await writeFile(resolve(out,selection.id+'.quiz.json'),JSON.stringify(bank,null,2)+'\n');
 console.log(selection.title+': '+bank.questions.length+' questions; SDK validation passed.');
}
