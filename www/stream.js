// Raindrops V1.6.0 - Stream (+ YouTube via NewPipe, Android app only): search Audius (free public API), preview, then "Add" saves the track into your library
// so it works as a backing track (record, sync, export). Also: paste a direct audio URL.
(() => {
const APP = 'raindrops';
let host = null, pv = null, pvId = null, pvMeta = null;
window.RDpv = () => (pv ? { el: pv, t: pvMeta } : null);
const getHost = async () => {
  if (host) return host;
  const r = await fetch('https://api.audius.co'); if (!r.ok) throw new Error('Audius HTTP ' + r.status); const j = await r.json();
  host = (j.data || [])[0]; if (!host) throw new Error('Audius returned no host'); return host;
};
const stopPv = () => { if (pv) { try { pv.pause(); } catch (e) {} pv = null; } pvId = null; pvMeta = null; document.querySelectorAll('[data-pv]').forEach(b => b.textContent = '▶'); };
async function saveBlob(blob, title, artist, name, art) {
  if (songs.some(s => s.name == name && s.size == blob.size)) { toast('Already in your library'); return; }
  const s = { id: uid(), name, size: blob.size, type: blob.type || 'audio/mpeg', blob, title, artist: artist || '', art: art || null, lyrics: '', added: Date.now() };
  songs.unshift(s);
  try { await DB.put('songs', strip(s)); } catch (e) { songs.shift(); toast('Storage blocked or full'); return; }
  rSongs(); toast('Added: ' + title);
}
window.RDstream = { save: saveBlob, stop: stopPv, play: (id, url, meta, b) => { const same = pvId == id; stopPv(); if (same) return; if (!aud.paused) aud.pause();
  pv = new Audio(url); pvId = id; pvMeta = meta || null; b.textContent = '■'; pv.onended = stopPv; pv.onerror = () => { stopPv(); toast('Could not stream this track'); }; pv.play().catch(() => {}); } };
async function search() {
  const q = $('stQ').value.trim(), out = $('stOut'); if (!q) return;
  stopPv(); out.innerHTML = '<p class="hint">Searching…</p>';
  try {
    const h = await getHost(), r = await fetch(h + '/v1/tracks/search?limit=15&app_name=' + APP + '&query=' + encodeURIComponent(q)), j = await r.json(), l = j.data || [];
    if (!l.length) { out.innerHTML = '<p class="hint">No results.</p>'; return; }
    out.innerHTML = l.map(t => `<div class="item"><div class="n">${esc(t.title)}<small>${esc((t.user && t.user.name) || '')} · ${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, '0')}</small></div><button class="ib" data-pv="${t.id}">▶</button><button class="ib" data-add="${t.id}">＋</button></div>`).join('');
    const by = {}; l.forEach(t => by[t.id] = t);
    const url = id => host + '/v1/tracks/' + id + '/stream?app_name=' + APP;
    out.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => {
      const id = b.dataset.pv; const same = pvId == id; stopPv(); if (same) return;
      if (!aud.paused) aud.pause();
      pv = new Audio(url(id)); pvId = id; pvMeta = by[id] || null; b.textContent = '■'; pv.onended = stopPv; pv.onerror = () => { stopPv(); toast('Could not stream this track'); }; pv.play().catch(() => {});
    });
    out.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
      const t = by[b.dataset.add]; b.disabled = true; b.textContent = '…';
      try { const r2 = await fetch(url(t.id)); if (!r2.ok) throw 0; const bl = await r2.blob(); await saveBlob(bl, t.title, t.user && t.user.name, (t.user ? t.user.name + ' - ' : '') + t.title + '.mp3'); b.textContent = '✓'; }
      catch (e) { b.textContent = '＋'; b.disabled = false; toast('Download blocked. Preview still works; try another track'); }
    });
  } catch (e) { host = null; out.innerHTML = '<p class="hint">Audius search failed: ' + esc(String((e && e.message) || e || 'no response').slice(0, 100)) + '</p>'; }
}
const NAT = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const RDp = () => { try { return Capacitor.Plugins.Raindrops; } catch (e) { return null; } };
async function ytAdd(it, b) { const M = it.meta || {};
  const P = RDp(); let r = null, h = null; b.disabled = true; b.textContent = '…';
  try {
    h = await P.addListener('ytProgress', e => { b.textContent = Math.round((e.p || 0) * 100) + '%'; });
    r = await P.ytGet({ url: it.url });
    const bl0 = await (await fetch(Capacitor.convertFileSrc(r.path))).blob();
    const bl = new Blob([bl0], { type: r.mime || 'audio/mp4' });
    let art = null;
    if (r.art) { const bin = atob(r.art), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); art = new Blob([u], { type: 'image/jpeg' }); }
    if (M.art) art = M.art; const ttl = M.title || r.title || it.title, bya = M.artist || r.artist || it.by; await saveBlob(bl, ttl, bya, M.title ? (bya ? bya + ' - ' : '') + ttl + '.m4a' : (r.name || (it.title + '.m4a')), art);
    b.textContent = '✓';
  } catch (e) { b.textContent = '＋'; b.disabled = false; toast('YouTube failed: ' + String((e && e.message) || e).slice(0, 90)); }
  try { h && h.remove(); } catch (e) {}
  try { r && r.path && P.ytClean({ path: r.path }); } catch (e) {}
}
async function ytSearch() {
  const q = $('yQ').value.trim(), out = $('yOut'); if (!q) return;
  const P = RDp();
  if (!NAT || !P || !P.ytSearch) { out.innerHTML = '<p class="hint">YouTube is not in this APK. Install the newest raindrops.apk from your GitLab pipeline. Nothing to run in Termux.</p>'; return; }
  out.innerHTML = '<p class="hint">Searching YouTube…</p>';
  try {
    const kinds = YK == 'both' ? ['music_songs', 'videos'] : [YK], qs = [q, q + ' official audio', q + ' lyrics'];
    // V1.9.8: one request at a time (V1.6.0, where YouTube worked, sent one). Six at once can trip YouTube's rate limit (429) and starve the phone.
    const rs = []; let got = 0;
    for (const kind of kinds) { for (const qq of qs) {
      try { const v = await Promise.race([P.ytSearch({ q: qq, kind, limit: 30 }), new Promise((_, no) => setTimeout(() => no(new Error('YouTube did not answer in 20 s (the search engine in the APK is stuck or blocked)')), 20000))]); rs.push({ status: 'fulfilled', value: v }); got += ((v && v.items) || []).length; }
      catch (e) { rs.push({ status: 'rejected', reason: e }); if (/did not answer/.test(String((e && e.message) || e))) got = 999; }
      if (got >= 45) break;
    } if (got >= 45) break; }
    const seen = new Set(), errs = []; let l = [];
    rs.forEach(r => {
      if (r.status != 'fulfilled') { errs.push(String((r.reason && r.reason.message) || r.reason)); return; }
      (r.value.items || []).forEach(t => {
        const a = t.url || '', b2 = (t.title || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + Math.round((t.dur || 0) / 3);
        if (seen.has(a) || seen.has(b2)) return; seen.add(a); seen.add(b2); l.push(t);
      });
    });
    if (!l.length) { out.innerHTML = errs.length ? '<p class="hint">YouTube search failed: ' + esc(errs[0].slice(0, 120)) + '</p>' : '<p class="hint">No results.</p>'; return; }
    const draw = n => {
      out.innerHTML = l.slice(0, n).map((t, i) => `<div class="item"><div class="n">${esc(t.title)}<small>${esc(t.by || '')} · ${Math.floor(t.dur / 60)}:${String(t.dur % 60).padStart(2, '0')}</small></div><button class="ib" data-y="${i}">＋</button></div>`).join('') + (l.length > n ? '<button class="btn g" id="yMore" style="margin-top:8px">Show more (' + (l.length - n) + ' left)</button>' : '') + '<p class="hint">' + l.length + ' results</p>';
      out.querySelectorAll('[data-y]').forEach(b => b.onclick = () => ytAdd(l[+b.dataset.y], b)); const mb = $('yMore'); if (mb) mb.onclick = () => draw(n + 20);
    };
    draw(20); try { out.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  } catch (e) { out.innerHTML = '<p class="hint">YouTube search failed: ' + esc(String((e && e.message) || e).slice(0, 100)) + '</p>'; }
}
let YK = LS.get('rd_yk', 'both');
document.querySelectorAll('#yK .chip').forEach(c => { c.classList.toggle('on', c.dataset.k == YK); c.onclick = () => { YK = c.dataset.k; LS.set('rd_yk', YK); document.querySelectorAll('#yK .chip').forEach(x => x.classList.toggle('on', x == c)); if ($('yQ').value.trim()) ytSearch(); }; });
$('yGo').onclick = ytSearch; $('yQ').onkeydown = e => { if (e.key == 'Enter') ytSearch(); };
async function addUrl() {
  const u = $('stU').value.trim();
  if (/(youtu\.be|youtube\.com)\//i.test(u)) {
    if (!NAT || !RDp() || !RDp().ytGet) { toast('YouTube works only in the Android app build'); return; }
    await ytAdd({ url: u, title: 'YouTube', by: '' }, $('stUGo')); $('stUGo').textContent = 'Add'; $('stUGo').disabled = false; $('stU').value = ''; return;
  } if (!/^https?:\/\//i.test(u)) { toast('Paste a full http(s) audio link'); return; }
  $('stUGo').disabled = true; toast('Downloading…');
  try {
    const r = await fetch(u); if (!r.ok) throw 0; const bl = await r.blob();
    if (bl.type && !/audio|octet|mpeg|ogg|wav/i.test(bl.type)) { toast('That link is not audio'); return; }
    const nm = decodeURIComponent((u.split('?')[0].split('/').pop() || 'stream')).replace(/\.\w+$/, '') || 'Stream';
    await saveBlob(bl, nm, '', nm + '.mp3'); $('stU').value = '';
  } catch (e) { toast('Could not download (the site may block apps)'); }
  $('stUGo').disabled = false;
}
window.RDstream = Object.assign(window.RDstream || {}, { saveBlob, ytAdd, stopPv, NAT, RDp });
$('stGo').onclick = search; $('stQ').onkeydown = e => { if (e.key == 'Enter') search(); }; $('stUGo').onclick = addUrl;
})();
