import {audioURL,isSharedAudioURL,isSharedSpeakingURL,isSharedTranslationURL} from './media.js';
import {LESSON_CACHE_PREFIX,audioRangeResponse} from './offline.js';
const CACHE = 'tara-shell-v14';
const ROOT = new URL('./', self.location.href);
const FILES = ['./', './index.html', './app.js', './lib.js', './curriculum.js', './museum.js', './museum-link.js', './speech.js', './media.js', './offline.js', './glosses.js', './style.css', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './manifest.webmanifest', './LICENSE.txt', './NOTICE.txt', './courses/index.json', './pronunciation/assets.json', './pronunciation/assets.js', './pronunciation/practice.js', './pronunciation/phonetics.js', './pronunciation/engine-worker.js', './pronunciation/fbank.js', './pronunciation/capture-worklet.js', './translation/assets.json', './translation/assets.js', './translation/checker.js', './translation/engine-worker.js', './translation/grading.js', './translation/marian.js', './translation/tokenizer.js'];
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
  if (event.request.method!=='GET' || (!event.request.url.startsWith(ROOT.href)&&!isSharedAudioURL(event.request.url)&&!isSharedSpeakingURL(event.request.url)&&!isSharedTranslationURL(event.request.url))) return;
  event.respondWith((async()=>{
    // Explicit downloads write only their own durable lesson cache.
    if(event.request.cache==='no-store')return fetch(event.request);
    // Speaking tools are downloaded explicitly and survive app-shell updates.
    // The translation checker is also an explicit download in its own durable cache.
    if(new URL(event.request.url).pathname.includes('/translation/vendor/')){const tools=await caches.open('tara-translation-v1'),stored=await tools.match(event.request.url);return stored||fetch(event.request);}
    if(new URL(event.request.url).pathname.includes('/pronunciation/vendor/')){const tools=await caches.open('tara-speaking-v1'),stored=await tools.match(event.request);return stored||fetch(event.request);}
    const isAudio=/\.(mp3|ogg|wav)$/.test(new URL(event.request.url).pathname);
    if(isAudio)for(const name of await caches.keys())if(name.startsWith(LESSON_CACHE_PREFIX)){
      const stored=await (await caches.open(name)).match(event.request.url);
      if(stored?.status===200)return audioRangeResponse(event.request,stored);
    }
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
      if(cached)return isAudio?audioRangeResponse(event.request,cached):cached;
      if(event.request.mode==='navigate')return (await cache.match(new URL('./index.html',ROOT))) || Response.error();
      return Response.error();
    }
  })());
});
