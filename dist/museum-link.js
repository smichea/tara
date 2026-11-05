import {createMuseumQuiz} from './museum.js';
export const DEFAULT_MUSEUM_HOST='https://play.retro-museum.net/';
export function museumHost(value=DEFAULT_MUSEUM_HOST){
 const url=new URL(value);
 const local=url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.hostname==='[::1]'||/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
 if(!(url.protocol==='https:'||url.protocol==='http:'&&local)||url.username||url.password||url.search||url.hash||!/^\/(?:[a-z][a-z0-9-]*\/?)?$/.test(url.pathname))throw Error('Use an HTTPS Retro Museum host, or a local museum address ending in /play/.');
 url.pathname=url.pathname.replace(/\/?$/,'/');return url.href;
}
export function museumTransfer(course,selection){
 const quiz=createMuseumQuiz(course,selection);
 if(quiz.questions.length>1000)throw Error('Choose a smaller practice pack: a quiz supports up to 1,000 questions.');
 return {format:'tara-quiz',version:1,quiz,provenance:{app:'Tara!',license:'CC-BY-SA-4.0',source:'https://github.com/smichea/tara',status:course.status==='reviewed'?'reviewed':'draft'}};
}
export async function museumLink(course,selection,host=DEFAULT_MUSEUM_HOST,env=globalThis){
 const text=JSON.stringify(museumTransfer(course,selection)),bytes=new TextEncoder().encode(text);
 if(bytes.length>2_000_000)throw Error('This quiz is too large. Choose a smaller practice pack.');
 let data=bytes,format='raw';
 if(typeof env.CompressionStream==='function'){
  data=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new env.CompressionStream('gzip'))).arrayBuffer());format='gz';
 }
 let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode(...data.subarray(i,i+32768));
 const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const fragment=`tara-v1.${format}.${encoded}`;
 if(fragment.length>179999)throw Error('This practice pack is too large for a direct link in this browser. Choose a smaller pack.');
 const url=new URL('tara',museumHost(host));url.hash=fragment;return url.href;
}
