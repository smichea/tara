// Browser text-to-speech. No service keys or audio generation backend.
export function speechLocale(code) {
  return /^(fil|tl)(-|$)/i.test(code) ? 'fil-PH' : code;
}
export function selectVoice(voices, code) {
  const wanted = speechLocale(code).toLowerCase();
  const family = lang => /^(fil|tl)(-|$)/i.test(lang) ? 'fil' : lang.toLowerCase().split('-')[0];
  return voices.filter(v => family(v.lang) === family(wanted)).sort((a,b) => {
    const score = v => (v.lang.toLowerCase() === wanted ? 4 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
    return score(b)-score(a);
  })[0] || null;
}
export function createSpeechPlayer(env = globalThis, {onError = () => {}, onVoicesChanged = () => {}} = {}) {
  const synth = env.speechSynthesis;
  const supported = !!synth && typeof env.SpeechSynthesisUtterance === 'function';
  let voices = [], active = null;
  function refresh() {
    if (!supported) return [];
    try { voices = Array.from(synth.getVoices()); } catch { voices = []; }
    return voices;
  }
  function stop() {
    active = null; // Ignore cancellation events from the previous utterance.
    if (supported) synth.cancel();
  }
  function changed() { refresh(); onVoicesChanged(); }
  if (supported) { refresh(); synth.addEventListener?.('voiceschanged', changed); }
  return {
    supported,
    voice(code) { return selectVoice(refresh(), code); },
    stop,
    speak(text, code, rate = .9) {
      if (!supported) { onError('unsupported'); return false; }
      stop();
      const utterance = new env.SpeechSynthesisUtterance(text);
      const voice = selectVoice(refresh(), code);
      // Some browsers expose an empty voice list until the first request.
      // Let the browser resolve the requested language instead of disabling sound.
      utterance.lang = voice?.lang || speechLocale(code);
      if (voice) utterance.voice = voice;
      utterance.rate = Number.isFinite(rate) ? Math.max(.5, Math.min(1.2, rate)) : .9;
      utterance.onend = () => { if (active === utterance) active = null; };
      utterance.onerror = event => {
        if (active !== utterance) return;
        active = null;
        if (!['canceled','interrupted'].includes(event.error)) onError(event.error || 'unavailable');
      };
      active = utterance;
      try {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
        return true;
      } catch {
        active = null; onError('unavailable'); return false;
      }
    },
    destroy() { stop(); synth?.removeEventListener?.('voiceschanged', changed); }
  };
}
