import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkWritten,compareMeaning,decide,shapeLike,editDistance,LIKELY,UNLIKELY} from '../dist/translation/grading.js';
import {createTokenizer,normalize} from '../dist/translation/tokenizer.js';
import {validManifest,translationAssetRoot} from '../dist/translation/assets.js';
import {isSharedTranslationURL} from '../dist/media.js';
import {finishSession,freshProgress} from '../dist/lib.js';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));

test('matching and accepted translations are correct without any model',()=>{
 assert.equal(checkWritten('magkano ito',['Magkano ito?'],'fil').status,'correct');
 assert.equal(checkWritten('Magkano po ito?',['Magkano ito?'],'fil').status,'correct');
 assert.equal(checkWritten('Gutom ako',['Gutom na ako.','Gutom ako.'],'fil').status,'correct');
 assert.equal(checkWritten('how are you',['How are you?'],'en').status,'correct');
});
test('near misses are named: accents, politeness and small typos',()=>{
 assert.deepEqual(checkWritten('Je voudrais un cafe',['Je voudrais un café.'],'fr').reason,'accents');
 assert.equal(checkWritten('Maraming salamat',['Maraming salamat po.'],'fil').reason,'politeness');
 const typo=checkWritten('Magkanno ito?',['Magkano ito?'],'fil');assert.equal(typo.status,'close');assert.equal(typo.reason,'spelling');
 // A different word is not a typo, even when it is short.
 assert.equal(checkWritten('Saan ito?',['Magkano ito?'],'fil').status,'different');
 assert.equal(checkWritten('Guro ang tatay ko',['Guro ang nanay ko.'],'fil').status,'different');
 assert.equal(checkWritten('Hindi ako gutom',['Gutom ako.'],'fil').status,'different');
 assert.equal(editDistance('kitten','sitting'),3);
});
test('English meaning comparison flags negation and numbers',()=>{
 assert.equal(compareMeaning("I'm not hungry",'I am hungry.').negation,true);
 assert.equal(compareMeaning("I don't have a pencil",'I do not have paper.').negation,false);
 assert.equal(compareMeaning('The museum opened in 1893','The museum opened to the public in 1793.').numbers,true);
 assert.equal(compareMeaning('Then sit down','Then sit down.').overlap,1);
});
test('model evidence is combined conservatively',()=>{
 const base={direction:'to-target',prompt:'I am hungry.',answer:'x',reference:'Gutom ako.'};
 assert.equal(decide({...base,delta:0,reading:'I was starving'}).verdict,'unsure','No shared meaning word: never auto-accept');
 assert.equal(decide({...base,delta:0,reading:'I am hungry now'}).verdict,'likely');
 assert.equal(decide({...base,delta:0,reading:"I'm not hungry"}).verdict,'unlikely');
 assert.equal(decide({...base,delta:(LIKELY+UNLIKELY)/2,reading:'I am hungry'}).verdict,'unsure');
 assert.equal(decide({...base,delta:UNLIKELY-1,reading:'I am hungry'}).verdict,'unlikely');
});
test('answers take the reference capital and final punctuation before scoring',()=>{
 assert.equal(shapeLike('magkano ito','Magkano ito?'),'Magkano ito?');
 assert.equal(shapeLike('Où est la gare','Où est la gare ?'),'Où est la gare ?');
 assert.equal(shapeLike('Salamat!','Salamat.'),'Salamat!');
});
test('the browser tokenizer reproduces the Marian SentencePiece tokenizer',async()=>{
 const tokenizer=createTokenizer(await json('../dist/translation/vendor/fil/tokenizer.json')),fixture=await json('./fixtures/translation-tokens.json');
 for(const c of fixture.cases){assert.deepEqual(tokenizer.encodeSource(c.s),c.src,c.s);assert.deepEqual(tokenizer.encodeTarget(c.s),c.tgt,c.s);}
 assert.equal(tokenizer.decode(tokenizer.encodeTarget('How much is this?')),'How much is this?');
 assert.equal(normalize('  a​b  '),'a b');
});
test('the checker download list is pinned, complete and verifiable',async()=>{
 const manifest=await json('../dist/translation/assets.json');assert(validManifest(manifest,'fil'));assert.deepEqual(Object.keys(manifest.languages),['fil']);
 const l=manifest.languages.fil;assert(l.bytes<130e6,'Keep the optional download small');
 for(const f of l.files){const data=await readFile(new URL('../dist/translation/vendor/'+f.file,import.meta.url));assert.equal(data.length,f.bytes,f.file);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,f.file);}
 for(const part of Object.values(l.parts)){const hash=createHash('sha256');let n=0;for(const name of part.parts){const d=await readFile(new URL('../dist/translation/vendor/'+name,import.meta.url));hash.update(d);n+=d.length;}assert.equal(n,part.bytes);assert.equal(hash.digest('hex'),part.sha256);}
 assert(!validManifest({languages:{fil:{...l,files:[...l.files,{file:'../app.js',bytes:1,sha256:'0'.repeat(64),type:'text/javascript'}],bytes:l.bytes+1}}},'fil'),'Path traversal is rejected');
});
test('translation assets resolve locally or to the shared public library only',()=>{
 assert.equal(translationAssetRoot('https://example.org/tara/'),'https://example.org/tara/translation/vendor/');
 assert.equal(translationAssetRoot('https://tara-filipino-marco.manaty.chatgpt.site/x'),'https://smichea.github.io/tara/translation/vendor/');
 assert(isSharedTranslationURL('https://smichea.github.io/tara/translation/vendor/fil/decoder-00.bin'));
 assert(!isSharedTranslationURL('https://smichea.github.io/tara/translation/vendor/../app.js?x'));
 assert(!isSharedTranslationURL('https://evil.example/tara/translation/vendor/fil/decoder-00.bin'));
});
test('translation practice updates reviews without completing a lesson',()=>{
 const course={id:'fil-en'},entry={id:'say-hello-1'};
 const {progress}=finishSession(freshProgress(),course,'translate',[{entry,correct:true}]);
 assert.equal(progress.lessons['fil-en:translate'],undefined);assert.equal(progress.cards['fil-en:say-hello-1'].successes,1);
});
test('the service worker ships translation modules but never the model',async()=>{
 const sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
 for(const f of ['assets.js','checker.js','engine-worker.js','grading.js','marian.js','tokenizer.js'])assert(sw.includes(`'./translation/${f}'`),f);
 assert(!/FILES = \[[^\]]*vendor/.test(sw));
});
