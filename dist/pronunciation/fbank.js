// Wrapper for the Apache-2.0 Kaldi-compatible extractor; source in scripts/phonetics-source.
let instance;
export async function loadFbank(url){
 if(!instance){const response=await fetch(url);if(!response.ok)throw Error('Speaking feature extractor is unavailable.');instance=(await WebAssembly.instantiate(await response.arrayBuffer(),{})).instance;}
 return audio=>{
  if(audio.length<400)throw Error('Please say a little more.');
  const e=instance.exports,input=e.malloc(audio.length*4),count=e.malloc(4);let features=0;
  try{
   if(!input||!count)throw Error('Not enough memory for speaking practice.');
   new Float32Array(e.memory.buffer,input,audio.length).set(audio);
   features=e.extract_fbank(input,audio.length,count);if(!features)throw Error('No speech features were found.');
   const frames=new Int32Array(e.memory.buffer,count,1)[0];
   return {data:new Float32Array(new Float32Array(e.memory.buffer,features,frames*80)),frames};
  }finally{if(features)e.free_features(features);e.free(input);e.free(count);}
 };
}
