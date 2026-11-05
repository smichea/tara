const CACHE = 'tara-shell-v2';
const ROOT = new URL('./', self.location.href);
const FILES = ['./', './index.html', './app.js', './lib.js', './style.css', './icon.svg', './manifest.webmanifest', './courses/index.json'];
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
      for (const lesson of course.lessons) for (const entry of lesson.entries) if (entry.audio && /^audio\/[a-zA-Z0-9/_-]+\.(mp3|ogg|wav)$/.test(entry.audio)) await cache.add(new URL(entry.audio,ROOT).href);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event=>event.waitUntil((async()=>{
  for (const key of await caches.keys()) if (key.startsWith('tara-shell-') && key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event=>{
  if (event.request.method!=='GET' || !event.request.url.startsWith(ROOT.href)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(event.request);
      if(response.ok && !response.redirected) await cache.put(event.request,response.clone());
      return response;
    } catch {
      const cached=await cache.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return (await cache.match(new URL('./index.html',ROOT))) || Response.error();
      return Response.error();
    }
  })());
});
