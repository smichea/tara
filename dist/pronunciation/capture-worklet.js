class TaraCapture extends AudioWorkletProcessor{
 constructor(){super();this.buffer=new Float32Array(2048);this.offset=0;this.port.onmessage=({data})=>{if(data==='flush'){this.flush();this.port.postMessage({flushed:true});}};}
 flush(){if(this.offset){const chunk=this.buffer.slice(0,this.offset);this.port.postMessage(chunk,[chunk.buffer]);this.offset=0;}}
 process(inputs){const audio=inputs[0]?.[0];if(audio)for(const sample of audio){this.buffer[this.offset++]=sample;if(this.offset===this.buffer.length)this.flush();}return true;}
}
registerProcessor('tara-capture',TaraCapture);
