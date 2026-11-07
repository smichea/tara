// Both hosted copies share the public, content-addressed speech library.
export const SHARED_MEDIA_ROOT='https://smichea.github.io/tara/';
const BUNDLED=/^audio\/(fil|fr)\/marin\/[a-f0-9]{24}\.mp3$/;
export function audioURL(path,base){const root=new URL(base);return new URL(path,root.hostname==='tara-filipino-marco.manaty.chatgpt.site'&&BUNDLED.test(path)?SHARED_MEDIA_ROOT:root).href;}
export function isSharedAudioURL(value){const url=new URL(value);return url.origin==='https://smichea.github.io'&&url.pathname.startsWith('/tara/')&&!url.search&&!url.hash&&BUNDLED.test(url.pathname.slice('/tara/'.length));}
export function isSharedSpeakingURL(value){const url=new URL(value);return url.origin==='https://smichea.github.io'&&!url.search&&!url.hash&&/^\/tara\/pronunciation\/vendor\/[a-z0-9][a-z0-9.-]*\.(mjs|js|wasm|data|txt|onnx|bin)$/i.test(url.pathname);}
export function isSharedTranslationURL(value){const url=new URL(value);return url.origin==='https://smichea.github.io'&&!url.search&&!url.hash&&/^\/tara\/translation\/vendor\/(?:[a-z]{2,3}\/)?[a-z0-9][a-z0-9.-]*\.(mjs|json|txt|bin)$/i.test(url.pathname);}
