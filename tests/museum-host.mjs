// Optional integration test against the pinned public Retro Museum engine + SDK.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=process.env.TARA_MUSEUM_ENGINE;if(!repo)throw Error('Set TARA_MUSEUM_ENGINE to the pinned game-quizz checkout.');
const {createGameHost,loadGame}=await import(pathToFileURL(resolve(repo,'node_modules/@manaty/retro-museum-sdk/host.js')));
const {default:WebSocket}=await import(pathToFileURL(resolve(repo,'node_modules/ws/index.js')));
const bank=JSON.parse(await readFile('dist/museum/school-foundations.quiz.json'));
const definition=await loadGame(resolve('dist/museum/school-foundations.rmg.json'));let now=1000;
const host=await createGameHost({definitions:[definition],clock:()=>now});await new Promise(r=>host.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+host.server.address().port,sockets=[];
const post=async(path,value,token)=>{const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(value)});return {status:response.status,body:await response.json()};};
const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,25));}throw Error('Host did not reach the expected state.');};
async function connect(room,role,token){const ws=new WebSocket(origin.replace('http','ws')+'/socket');sockets.push(ws);const states=[],acks=[],errors=[];let welcomed=false;ws.on('message',bytes=>{const m=JSON.parse(bytes);if(m.type==='welcome')welcomed=true;if(m.type==='state'){states.push(m.state);ws.send(JSON.stringify({type:'ack',sequence:m.sequence}));}if(m.type==='ack')acks.push(m.id);if(m.type==='error')errors.push(m.message);});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'hello',room,role,token}));await wait(()=>welcomed);return {ws,states,acks,errors};}
try{
 const {body:room}=await post('/api/rooms',{game:definition.pack.manifest.id,language:'en'}),path='/api/rooms/'+room.id;
 const {body:a}=await post(path+'/join',{profile:{name:'Player A'}}),{body:b}=await post(path+'/join',{profile:{name:'Player B'}});
 const phoneA=await connect(room.id,'controller',a.token),phoneB=await connect(room.id,'controller',b.token),screen=await connect(room.id,'display');
 assert.equal((await post(path+'/control',{action:'start'},a.token)).status,403);
 const qr=await fetch(origin+path+'/qr');assert.equal(qr.status,200);assert(qr.headers.get('content-type').includes('image/png'));
 assert.equal((await post(path+'/control',{action:'start',options:{mode:'ranking',questionCount:2,seconds:15,order:'authored'}},room.hostToken)).status,200);
 const party=host.rooms.get(room.id).party;now+=4000;party.tick();await wait(()=>screen.states.at(-1)?.phase==='playing');
 assert.equal(screen.states.at(-1).party.community.question.correct,undefined);assert.equal(screen.states.at(-1).party.community.you,null);
 for(let index=0;index<2;index++){
  const q=party.snapshot().community.question,source=bank.questions.find(x=>x.prompt===q.prompt);assert(source);const correct=q.answers.indexOf(source.answers[source.correct]);assert(correct>=0);
  const send=(phone,id,answer)=>phone.ws.send(JSON.stringify({type:'command',id,matchId:party.id,action:'quizAnswer',value:{question:index,answer}}));
  send(phoneA,'a'+index,correct);send(phoneB,'b'+index,(correct+1)%4);await wait(()=>phoneA.acks.includes('a'+index)&&phoneB.acks.includes('b'+index));
  assert.equal(party.snapshot(a.playerId).community.you.answer,correct);assert.equal(party.snapshot(b.playerId).community.you.answer,(correct+1)%4);assert.equal(party.snapshot().community.question.correct,undefined);
  for(let i=0;i<155;i++){now+=100;party.tick();}
  assert.equal(party.snapshot().community.stage,'reveal');assert.equal(party.snapshot().community.question.correct,correct);
  for(let i=0;i<65;i++){now+=100;party.tick();}
 }
 assert.equal(party.snapshot().community.ranking.find(p=>p.id===a.playerId).score,2);assert.equal(party.snapshot().community.ranking.find(p=>p.id===b.playerId).score,0);assert.equal(party.snapshot().community.ended,true);
 assert.deepEqual([...phoneA.errors,...phoneB.errors,...screen.errors],[]);
 console.log('Retro Museum network QA passed: real two-player room, QR invitation, authenticated host, private phone answers, timed reveal, two complete questions and final ranking.');
}finally{for(const socket of sockets)socket.terminate();await host.close();}
