// Small Sites artifact; the public app and self-hosted copies retain all MP3s.
import {cp,rm,readdir,stat} from 'node:fs/promises';import {resolve} from 'node:path';
const root=new URL('../',import.meta.url).pathname,source=resolve(root,'dist'),output=resolve(root,'out');
await rm(output,{recursive:true,force:true});
await cp(source,output,{recursive:true,filter:path=>!/[\\/]audio[\\/](fil|fr)[\\/]marin[\\/][a-f0-9]{24}\.mp3$/.test(path)});
async function size(path){let bytes=0;for(const f of await readdir(path,{withFileTypes:true})){const p=resolve(path,f.name);bytes+=f.isDirectory()?await size(p):(await stat(p)).size;}return bytes;}
console.log(`Private static artifact: ${(await size(output)/1e6).toFixed(2)} MB; shared voice files resolve to the public library.`);
