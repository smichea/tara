import test from 'node:test';
import assert from 'node:assert/strict';
import {speechLocale,selectVoice,createSpeechPlayer} from '../dist/speech.js';
function fixture(initial=[]){
 let available=initial;const spoken=[],errors=[];const synth=new EventTarget();
 synth.getVoices=()=>available;synth.cancel=()=>{};synth.speak=u=>spoken.push(u);synth.resume=()=>{synth.paused=false;};
 class Utterance{constructor(text){this.text=text;this.voice=null;}}
 const player=createSpeechPlayer({speechSynthesis:synth,SpeechSynthesisUtterance:Utterance},{onError:e=>errors.push(e)});
 return {player,synth,spoken,errors,setVoices:v=>{available=v;synth.dispatchEvent(new Event('voiceschanged'));}};
}
const english={name:'English',lang:'en-US',localService:true};
test('Filipino and Tagalog codes request Filipino Philippines',()=>{assert.equal(speechLocale('fil'),'fil-PH');assert.equal(speechLocale('tl-PH'),'fil-PH');assert.equal(speechLocale('ja'),'ja');});
test('voice matching recognizes both Filipino and Tagalog and rejects English',()=>{const tagalog={name:'Tagalog',lang:'tl-PH'};assert.equal(selectVoice([english,tagalog],'fil'),tagalog);assert.equal(selectVoice([english],'fil'),null);});
test('voice matching prefers requested region, then local voices',()=>{const br={lang:'pt-BR'},pt={lang:'pt-PT',localService:true};assert.equal(selectVoice([pt,br],'pt-BR'),br);const local={lang:'fil-PH',localService:true},online={lang:'fil-PH',localService:false};assert.equal(selectVoice([online,local],'fil'),local);});
test('an initially empty voice list does not prevent a browser language request',()=>{const f=fixture();assert(f.player.speak('Kumusta ka?','fil'));assert.equal(f.spoken[0].lang,'fil-PH');assert.equal(f.spoken[0].voice,null);assert.equal(f.spoken[0].text,'Kumusta ka?');});
test('late-loading voices are used on the next tap',()=>{const f=fixture([english]);const v={name:'Filipino',lang:'fil-PH'};f.setVoices([english,v]);f.player.speak('Salamat!','fil');assert.equal(f.spoken[0].voice,v);});
test('slow playback is requested without changing the phrase or language',()=>{const f=fixture();f.player.speak('Kumusta ka?','fil',.65);assert.equal(f.spoken[0].rate,.65);assert.equal(f.spoken[0].lang,'fil-PH');});
test('new playback cancels the previous utterance and ignores its error',()=>{const f=fixture();let cancels=0;f.synth.cancel=()=>cancels++;f.player.speak('Una','fil');f.player.speak('Ikalawa','fil');f.spoken[0].onerror({error:'interrupted'});assert.equal(cancels,2);assert.deepEqual(f.errors,[]);f.spoken[1].onerror({error:'language-unavailable'});assert.deepEqual(f.errors,['language-unavailable']);});
test('unsupported API and engine exceptions report a failure without breaking lessons',()=>{const errors=[];const player=createSpeechPlayer({},{onError:e=>errors.push(e)});assert(!player.supported);assert(!player.speak('Hi','en'));assert.deepEqual(errors,['unsupported']);const f=fixture();f.synth.speak=()=>{throw new Error('offline');};assert(!f.player.speak('Hi','en'));assert.deepEqual(f.errors,['unavailable']);});
