import {audioURL,isSharedAudioURL} from './media.js';
const CACHE = 'tara-shell-v10';
const ROOT = new URL('./', self.location.href);
const FILES = ['./', './index.html', './app.js', './lib.js', './curriculum.js', './museum.js', './speech.js', './media.js', './glosses.js', './style.css', './icon.svg', './manifest.webmanifest', './LICENSE.txt', './NOTICE.txt', './courses/index.json'];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(file=>new URL(file,ROOT).href));
    const registry = await (await cache.match(new URL('./courses/index.json',ROOT))).json();
    for (const item of registry) {
      if (!/^[a-z0-9-]+\.json$/.test(item.file)) throw new Error('Invalid course path');
      const url = new URL('./courses/'+item.file,ROOT).href;
      await cache.add(url);
      const course = await (await cache.match(url)).json();
      // Keep installation small; later recordings are cached as they are played.
      for (const entry of course.lessons[0].entries) if (entry.audio && /^audio\/[a-zA-Z0-9/_-]+\.(mp3|ogg|wav)$/.test(entry.audio)) await cache.add(audioURL(entry.audio,ROOT.href));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event=>event.waitUntil((async()=>{
  for (const key of await caches.keys()) if (key.startsWith('tara-shell-') && key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event=>{
  if (event.request.method!=='GET' || (!event.request.url.startsWith(ROOT.href)&&!isSharedAudioURL(event.request.url))) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(event.request);
      // Cache API rejects partial (206) media responses. Never discard playable
      // network audio because caching failed or browser storage is full.
      if(response.status===200 && !response.redirected) {
        try { await cache.put(event.request.url,response.clone()); } catch {}
      } else if(response.status===206) {
        const range=/^bytes 0-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range')||'');
        if(range&&Number(range[1])+1===Number(range[2])) {
          // A complete file delivered as a byte range can be stored as HTTP 200.
          const headers=new Headers(response.headers);headers.delete('Content-Range');
          try { await cache.put(event.request.url,new Response(response.clone().body,{status:200,headers})); } catch {}
        } else {
          // Fetch a complete copy for the next offline listen without delaying playback.
          event.waitUntil(cache.add(event.request.url).catch(()=>{}));
        }
      }
      return response;
    } catch {
      const cached=await cache.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return (await cache.match(new URL('./index.html',ROOT))) || Response.error();
      return Response.error();
    }
  })());
});
