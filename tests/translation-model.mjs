// Runs the shipped INT8 checker in Node (same ONNX Runtime Web build as the
// browser) over hand-written learner answers. Guards the calibration: a wrong
// answer must never be auto-accepted, and most answers must get a clear verdict.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTokenizer} from '../dist/translation/tokenizer.js';
import {createMarian} from '../dist/translation/marian.js';
import {checkWritten,decide,shapeLike} from '../dist/translation/grading.js';
const vendor=new URL('../dist/translation/vendor/',import.meta.url),manifest=JSON.parse(await readFile(new URL('../dist/translation/assets.json',import.meta.url)));
const ort=await import(new URL('ort.wasm.bundle.min.mjs',vendor));
const join=async names=>new Uint8Array(Buffer.concat(await Promise.all(names.map(n=>readFile(new URL(n,vendor))))));
const fixture=JSON.parse(await readFile(new URL('./fixtures/translation-eval.json',import.meta.url)));
ort.env.wasm.numThreads=1;ort.env.logLevel='error';ort.env.wasm.wasmBinary=await join(['ort-wasm-00.bin','ort-wasm-01.bin','ort-wasm-02.bin']);
const tally={};let wrongAccepted=[],rightRejected=[];
for(const [language,l] of Object.entries(manifest.languages)){
 const sessions={};for(const part of ['embed','encoder','decoder'])sessions[part]=await ort.InferenceSession.create(await join(l.parts[part].parts));
 const model=createMarian({ort,tokenizer:createTokenizer(JSON.parse(await readFile(new URL(language+'/tokenizer.json',vendor)))),...sessions});
 for(const c of fixture.cases.filter(c=>c.language===language)){
  const rules=checkWritten(c.answer,c.references,c.direction==='to-target'?language:'en');let verdict=rules.status==='different'?null:'likely';
  if(!verdict){const shaped=shapeLike(c.answer,c.references[0]);let reading,own,best=-Infinity;
   if(c.direction==='to-target'){reading=await model.translate(c.answer);own=await model.score(shaped,c.prompt);for(const r of c.references)best=Math.max(best,await model.score(r,c.prompt));}
   else{const state=await model.encode(c.prompt);reading=await model.translate(c.prompt);own=await model.score(c.prompt,shaped,state);for(const r of c.references)best=Math.max(best,await model.score(c.prompt,r,state));}
   verdict=decide({direction:c.direction,delta:own-best,reading,prompt:c.prompt,answer:c.answer,reference:c.references[0]}).verdict;}
  const key=`${c.acceptable?'acceptable':'wrong'}→${verdict}`;tally[key]=(tally[key]||0)+1;
  if(!c.acceptable&&verdict==='likely')wrongAccepted.push(c.answer);if(c.acceptable&&verdict==='unlikely')rightRejected.push(c.answer);
 }
}
console.log(tally);
const total=fixture.cases.filter(c=>manifest.languages[c.language]).length,decided=(tally['acceptable→likely']||0)+(tally['wrong→unlikely']||0);
assert.deepEqual(wrongAccepted,[],'Wrong answers were auto-accepted');
assert(rightRejected.length<=total*0.1,`Too many acceptable answers flagged: ${rightRejected.join(', ')}`);
assert(decided>=total*0.75,`Only ${decided}/${total} answers got a clear verdict`);
console.log(`Translation checker calibration passed: ${decided}/${total} clear verdicts, no wrong answer accepted, ${rightRejected.length} acceptable answers left to learner override.`);
