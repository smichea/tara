import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {museumLink,museumHost,museumTransfer} from '../dist/museum-link.js';
const courses=await Promise.all(['fil-en','fr-en'].map(id=>readFile(new URL('../dist/courses/'+id+'.json',import.meta.url),'utf8').then(JSON.parse)));
test('direct quiz links transfer full Filipino/French banks and attribution without progress or learner profiles',async()=>{
 for(const c of courses){const url=new URL(await museumLink(c,'all'));assert.equal(url.origin,'https://play.retro-museum.net');assert.equal(url.pathname,'/tara');assert.equal(url.search,'');assert(url.hash.length<180000);const data=JSON.parse(gunzipSync(Buffer.from(url.hash.split('.').at(-1),'base64url')));assert.deepEqual(data,museumTransfer(c,'all'));assert(data.quiz.questions.length>100);assert.equal(data.provenance.license,'CC-BY-SA-4.0');for(const k of ['progress','learnerName','learnerId','cards','xp'])assert(!Object.hasOwn(data,k));}
});
test('direct links also support local drafts, raw fallback and a mounted LAN museum host',async()=>{
 const c=structuredClone(courses[1]);c.id='local-french';c.learnerName='Private learner';c.lessons=c.lessons.slice(0,2);const url=new URL(await museumLink(c,'all','http://192.168.1.20:4310/play/',{}));assert.equal(url.pathname,'/play/tara');assert(url.hash.startsWith('#tara-v1.raw.'));const data=JSON.parse(Buffer.from(url.hash.split('.').at(-1),'base64url'));assert.equal(data.quiz.id,'tara-local-french-all');assert(!JSON.stringify(data).includes('Private learner'));
});
test('museum targets reject credentials, scripts, external insecure hosts and query/fragment payloads',()=>{
 for(const target of ['javascript:alert(1)','http://untrusted.example','https://user:password@example.org','https://example.org/?token=x','https://example.org/#x','https://example.org/a/b'])assert.throws(()=>museumHost(target));assert.equal(museumHost('https://example.org/play'),'https://example.org/play/');
});
