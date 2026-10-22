// Raindrops V1.3.0 - Studio AI core (no DOM): Gemini client, model picker, JSON parsing, prompts.
// Everything here is plain logic so it can be tested outside the app. The key stays on this phone (localStorage), never in the code.
(() => {
const API = 'https://generativelanguage.googleapis.com/v1beta';
const SKIP = /(image|tts|audio|embed|live|robotics|computer|vision|aqa|learnlm|gemma|imagen|veo|native|dialog|thinking-exp)/i;

// ---- model picking: model ids change often, so ask the API what this key can use ----
function parseModel(m) {
  const id = String(m.name || '').replace(/^models\//, '');
  const x = /^gemini-(\d+(?:\.\d+)?)-(flash-lite|flash|pro)(?:-(.+))?$/.exec(id);
  if (!x) return null;
  const meth = m.supportedGenerationMethods || [];
  if (meth.length && meth.indexOf('generateContent') < 0) return null;
  if (SKIP.test(id)) return null;
  return { id, ver: parseFloat(x[1]), tier: x[2], rest: x[3] || '', preview: /preview|exp/.test(x[3] || '') };
}
const TIER = { 'flash': 3, 'flash-lite': 2, 'pro': 1 };
function rankModels(list) {
  const ok = (list || []).map(parseModel).filter(Boolean);
  ok.sort((a, b) => (a.preview - b.preview) || (b.ver - a.ver) || (TIER[b.tier] - TIER[a.tier]) || (a.rest.length - b.rest.length));
  const seen = new Set();
  return ok.filter(m => !seen.has(m.id) && seen.add(m.id));
}
function pickModel(list) {
  const r = rankModels(list);
  if (!r.length) return null;
  const stable = r.filter(m => !m.preview), pool = stable.length ? stable : r;
  const top = pool[0].ver, same = pool.filter(m => m.ver === top);
  return (same.find(m => m.tier === 'flash') || same[0]).id;
}

// ---- errors in plain words ----
function friendly(status, body) {
  let msg = '';
  try { const j = typeof body === 'string' ? JSON.parse(body) : body; msg = (j && j.error && j.error.message) || ''; } catch (e) {}
  if (status === 0) return 'No internet. Connect and try again.';
  if (status === 400 && /api key|API_KEY/i.test(msg + '')) return 'Gemini does not accept this key. Check it and paste it again.';
  if (status === 400) return 'Gemini could not read that request. ' + (msg ? msg.slice(0, 120) : '');
  if (status === 401 || status === 403) return 'This key is not allowed to use Gemini. Check the key in Studio AI settings.';
  if (status === 404) return 'That model is not available for your key. Tap Check key to pick another.';
  if (status === 429) return 'Gemini says slow down: quota used up for now. Wait a minute or switch model.';
  if (status >= 500) return 'Gemini is having a bad moment. Try again in a bit.';
  return 'Gemini error ' + status + (msg ? ': ' + msg.slice(0, 120) : '');
}

// ---- HTTP: Capacitor native HTTP when in the Android app, plain fetch in a browser ----
async function http(method, url, key, body, tmo) {
  const H = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || null;
  const native = !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
  try {
    if (native && H) {
      const r = await H.request({ method, url, headers, data: body, connectTimeout: 15000, readTimeout: tmo || 60000 });
      return { status: r.status, data: r.data };
    }
    const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    let d = t; try { d = JSON.parse(t); } catch (e) {}
    return { status: r.status, data: d };
  } catch (e) { return { status: 0, data: String(e && e.message || e) }; }
}

const Core = {
  API, parseModel, rankModels, pickModel, friendly,
  models: null,
  async listModels(key) {
    const r = await http('GET', API + '/models?pageSize=1000', key);
    if (r.status !== 200) throw new Error(friendly(r.status, r.data));
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    Core.models = rankModels(d.models || []);
    return Core.models;
  },
  // one call: system prompt + turns -> text. Retries once on a missing model by re-picking from the live list.
  async ask(o) {
    const key = o.key, sys = o.system, contents = o.contents || [{ role: 'user', parts: [{ text: o.prompt }] }];
    let model = o.model;
    if (!key) throw new Error('Add your Gemini key first.');
    const body = () => ({
      systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
      contents,
      generationConfig: Object.assign({ temperature: o.temp == null ? 0.9 : o.temp, maxOutputTokens: o.max || 2048 }, o.json ? { responseMimeType: 'application/json' } : {})
    });
    const go = async m => http('POST', API + '/models/' + m + ':generateContent', key, body(), o.timeout);
    if (!model) { const l = Core.models || await Core.listModels(key); model = pickModel(l.map(x => ({ name: 'models/' + x.id, supportedGenerationMethods: ['generateContent'] }))); if (!model) throw new Error('No Gemini model found for this key.'); }
    let r = await go(model), used = model;
    if (r.status === 404) {
      const l = await Core.listModels(key), alt = pickModel(l.map(x => ({ name: 'models/' + x.id, supportedGenerationMethods: ['generateContent'] })));
      if (alt && alt !== model) { used = alt; r = await go(alt); }
    }
    if (r.status !== 200) throw new Error(friendly(r.status, r.data));
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    const c = d.candidates && d.candidates[0];
    if (!c) { const why = d.promptFeedback && d.promptFeedback.blockReason; throw new Error(why ? 'Gemini blocked that request (' + why + '). Try different words.' : 'Gemini sent back nothing. Try again.'); }
    const text = ((c.content && c.content.parts) || []).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini sent back an empty answer. Try again.');
    return { text, model: used, finish: c.finishReason || '' };
  },
  // tolerant JSON: strips code fences, grabs the first array/object
  parseJSON(t) {
    let s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(s); } catch (e) {}
    const a = s.search(/[\[{]/), z = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (a >= 0 && z > a) { try { return JSON.parse(s.slice(a, z + 1)); } catch (e) {} }
    return null;
  },
  // ---- prompts ----
  SYS_ADLIB: 'You are a studio ad-lib coach for a rapper and singer who records on a phone. ' +
    'Ad-libs are short vocal hits (one to three words, sounds or hype words) placed around the main vocal. ' +
    'Give ORIGINAL ideas that fit the line and the vibe. Never quote or copy lyrics from existing songs. Keep it clean of slurs. ' +
    'Reply with JSON only.',
  adlibPrompt(line, vibe, n) {
    return 'Main line:\n"""' + line + '"""\nVibe: ' + vibe + '\n' +
      'Give ' + n + ' ad-lib ideas. Mix quick hits and a couple of melodic ones. For each: "adlib" (the words as they would be sung or said), ' +
      '"where" (exact placement, for example "right after the word X" or "echo the last 2 words, softer, panned left"), "how" (delivery in under 12 words: pitch, volume, energy). ' +
      'Return a JSON array of objects with keys adlib, where, how.';
  },
  SYS_BEAT: 'You help a rapper and singer choose backing tracks and beats. Be specific and brief. Reply with JSON only.',
  beatPrompt(brief, mood, tempo, lib) {
    const list = lib.map((s, i) => i + ': ' + s.title + (s.artist ? ' - ' + s.artist : '')).join('\n');
    return 'What they are writing: ' + (brief || '(not said)') + '\nMood: ' + mood + '\nTempo feel: ' + tempo + '\n' +
      (lib.length ? 'Their library (index: title - artist):\n' + list + '\n' : 'Their library is empty.\n') +
      'Return a JSON object with two keys. "library": up to 4 objects {"i": index from the library list, "why": one short reason} chosen ONLY from the library list above (empty array if none fit). ' +
      '"search": up to 5 objects {"q": a short search phrase to find a beat or instrumental on a music site, "why": one short reason}. Phrases should describe style and mood, not copyrighted song lyrics.';
  },
  SYS_CHAT: 'You are Raindrops Studio AI, a friendly, direct studio partner inside a voice-recording app. You help with ad-libs, flow, hooks, melodies, song structure, mixing tips for phone recordings and picking beats. ' +
    'Keep answers short and usable, a few lines unless asked for more. Write original material only and never reproduce lyrics from existing songs. If asked about the app, you can mention the Record, Mixer, Mix Rack (voice rack, beat rack, voice-beat balance, AI rack doctor), Effects, Library and Notes tabs.'
};
if (typeof window !== 'undefined') window.RdAIcore = Core;
if (typeof module !== 'undefined') module.exports = Core;
})();
