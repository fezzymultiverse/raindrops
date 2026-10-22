// Raindrops V1.7.0 - Deezer (Part 1): search + charts + 30 s preview. "Add" matches the song on YouTube (Android app) for the FULL track,
// and keeps Deezer's title, artist and cover art. Deezer's public API only gives 30 s previews, never full songs.
(() => {
const S = () => window.RDstream, API = 'https://api.deezer.com';
let pv = null, pvId = null, cache = {};
const fmt = d => Math.floor(d / 60) + ':' + String(d % 60).padStart(2, '0');
const stopPv = () => { if (pv) { try { pv.pause(); } catch (e) {} pv = null; } pvId = null; document.querySelectorAll('[data-dpv]').forEach(b => b.textContent = '▶'); };
// Browser fetch first. Deezer sends no CORS header, so if that fails use Capacitor's native HTTP (Android app).
async function dzGet(path) {
  const url = API + path, tryFetch = async () => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  };
  let j, err;
  try { j = await tryFetch(); } catch (e) {
    err = e;
    try { const H = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp; if (H && H.get) { const r = await H.get({ url, responseType: 'json' }); j = r.data; if (typeof j == 'string') j = JSON.parse(j); } } catch (e2) { err = e2; }
  }
  if (!j) throw err || new Error('no data');
  if (j.error) throw new Error((j.error.message || j.error.type || 'Deezer error'));
  return j;
}
const clean = t => (t.data || []).filter(x => x && x.id && x.title && x.artist).map(x => ({ id: x.id, title: x.title_short || x.title, full: x.title, artist: x.artist.name, album: (x.album && x.album.title) || '', dur: x.duration || 0, prev: x.preview || '', cover: (x.album && (x.album.cover_medium || x.album.cover)) || '', coverBig: (x.album && (x.album.cover_xl || x.album.cover_big || x.album.cover_medium)) || '' }));
async function load(path, label) {
  const out = $('dzOut'); stopPv(); out.innerHTML = '<p class="hint">' + esc(label) + '…</p>';
  try {
    const l = clean(await dzGet(path));
    if (!l.length) { out.innerHTML = '<p class="hint">No results.</p>'; return; }
    cache = {}; l.forEach(t => cache[t.id] = t);
    out.innerHTML = l.map(t => `<div class="item dz"><img class="dzc" alt="" loading="lazy" src="${esc(t.cover)}"><div class="n">${esc(t.title)}<small>${esc(t.artist)}${t.album ? ' · ' + esc(t.album) : ''} · ${fmt(t.dur)}</small></div><button class="ib" data-dpv="${t.id}" ${t.prev ? '' : 'disabled'} aria-label="Preview 30 seconds">▶</button><button class="ib" data-dadd="${t.id}" aria-label="Add to library">＋</button></div>`).join('');
    out.querySelectorAll('[data-dpv]').forEach(b => b.onclick = () => {
      const id = b.dataset.dpv, same = pvId == id; stopPv(); if (same) return;
      try { if (!aud.paused) aud.pause(); } catch (e) {}
      pv = new Audio(cache[id].prev); pvId = id; b.textContent = '■'; pv.onended = stopPv; pv.onerror = () => { stopPv(); toast('Preview not available'); }; pv.play().catch(() => { stopPv(); toast('Preview not available'); });
    });
    out.querySelectorAll('[data-dadd]').forEach(b => b.onclick = () => add(cache[b.dataset.dadd], b));
  } catch (e) { out.innerHTML = '<p class="hint">Could not reach Deezer (' + esc(String((e && e.message) || e).slice(0, 60)) + '). Check your internet and try again.</p>'; }
}
// Pick the YouTube result closest in length to the Deezer track, so you get the studio cut and not a live or slowed edit.
const pick = (items, dur) => {
  if (!items.length) return null;
  const bad = /\b(live|remix|slowed|reverb|sped|nightcore|8d|cover|karaoke|instrumental)\b/i;
  const scored = items.map((y, i) => ({ y, i, d: Math.abs((y.dur || 0) - dur), bad: bad.test(y.title || '') })).sort((a, b) => (a.bad - b.bad) || (a.d - b.d) || (a.i - b.i));
  return scored[0].y;
};
async function add(t, b) {
  const R = S(); if (!R) { toast('Stream module missing'); return; }
  b.disabled = true; b.textContent = '…';
  const P = R.RDp();
  if (R.NAT && P && P.ytSearch && P.ytGet) {
    try {
      const q = t.artist + ' ' + t.title; let l = [];
      try { l = (await P.ytSearch({ q, kind: 'music_songs' })).items || []; } catch (e) {}
      if (!l.length) l = (await P.ytSearch({ q, kind: 'videos' })).items || [];
      const y = pick(l, t.dur); if (!y) throw new Error('no match on YouTube');
      let art = null; try { const r = await fetch(t.coverBig || t.cover); if (r.ok) art = await r.blob(); } catch (e) {}
      if (art && !/image/.test(art.type)) art = new Blob([art], { type: 'image/jpeg' });
      const dd = Math.abs((y.dur || 0) - t.dur);
      if (dd > 15) toast('Closest YouTube match is ' + dd + ' s different. Check it sounds right.');
      await R.ytAdd({ url: y.url, title: t.title, by: t.artist, meta: { title: t.title, artist: t.artist, art } }, b);
      return;
    } catch (e) { toast('Deezer add failed: ' + String((e && e.message) || e).slice(0, 80)); b.textContent = '＋'; b.disabled = false; return; }
  }
  // Browser build: only the 30 s preview can be saved, and only if the CDN allows it.
  try {
    const r = await fetch(t.prev); if (!r.ok) throw 0; const bl = await r.blob();
    await R.saveBlob(bl, t.title + ' (30s preview)', t.artist, t.artist + ' - ' + t.title + ' (30s preview).mp3');
    b.textContent = '✓'; toast('Saved the 30 s preview. Full songs need the Android app.');
  } catch (e) { b.textContent = '＋'; b.disabled = false; toast('Full songs need the Android app (YouTube match)'); }
}
function search() { const q = $('dzQ').value.trim(); if (!q) return; load('/search?limit=25&q=' + encodeURIComponent(q), 'Searching Deezer'); }
$('dzGo').onclick = search; $('dzQ').onkeydown = e => { if (e.key == 'Enter') search(); };
document.querySelectorAll('[data-dz]').forEach(c => c.onclick = () => {
  document.querySelectorAll('[data-dz]').forEach(x => x.classList.toggle('on', x == c));
  load(c.dataset.dz == 'rap' ? '/chart/116/tracks?limit=25' : '/chart/0/tracks?limit=25', c.dataset.dz == 'rap' ? 'Loading Rap chart' : 'Loading Top chart');
});
window.RDdz = { dzGet, clean, pick };
})();
