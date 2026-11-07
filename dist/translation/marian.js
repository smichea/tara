// Opus-MT (Marian) inference on ONNX Runtime: greedy translation and
// forced-decoding scores. The decoder graph returns log-probabilities.
export function createMarian({ort,embed,encoder,decoder,tokenizer,maxTokens=64}){
 const int64=list=>new ort.Tensor('int64',BigInt64Array.from(list,BigInt),[1,list.length]);
 // One shared embedding table serves encoder, decoder and output layer.
 const lookup=async ids=>(await embed.run({input_ids:int64(ids)})).inputs_embeds;
 async function encode(text){
  const ids=tokenizer.encodeSource(text).slice(-256),mask=int64(ids.map(()=>1));
  const out=await encoder.run({inputs_embeds:await lookup(ids),attention_mask:mask});
  return {hidden:out.last_hidden_state,mask,length:ids.length};
 }
 async function step(state,prefix){
  const out=await decoder.run({inputs_embeds:await lookup(prefix),encoder_hidden_states:state.hidden,encoder_attention_mask:state.mask});
  return {data:out.log_probs.data,vocab:out.log_probs.dims[2]};
 }
 async function translate(text){
  const state=await encode(text),ids=[tokenizer.start],limit=Math.min(maxTokens,state.length*2+8);
  while(ids.length<=limit){
   const {data,vocab}=await step(state,ids),offset=(ids.length-1)*vocab;let best=0,value=-Infinity;
   for(let i=0;i<vocab;i++)if(i!==tokenizer.pad&&data[offset+i]>value){value=data[offset+i];best=i;}
   if(best===tokenizer.eos)break;ids.push(best);
  }
  return tokenizer.decode(ids.slice(1));
 }
 // Mean log-probability per target token, as in a translation model's loss.
 async function score(source,target,state){
  state??=await encode(source);const labels=tokenizer.encodeTarget(target).slice(0,maxTokens),{data,vocab}=await step(state,[tokenizer.start,...labels.slice(0,-1)]);
  let total=0;labels.forEach((id,i)=>{total+=data[i*vocab+id];});
  return total/labels.length;
 }
 return {encode,translate,score};
}
