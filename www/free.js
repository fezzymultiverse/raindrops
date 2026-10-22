// Raindrops V1.8.0 - Free full songs: Jamendo (Creative Commons, needs a free client id) + Internet Archive (no key).
// Both give the WHOLE track, not a 30 s preview. ▶ streams it, ＋ saves it into your Library as a backing track.
(() => {
const R = window.RDstream; if (!R) return;
let SRC = LS.get('rd_fsrc', 'jam'), BEAT = LS.get('rd_fbeat', 0), KEY = LS.get('rd_jam', '');
const dur = s => { s = Math.round(+s || 0); return s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : ''; };
const card = document.createElement('div'); card.className = 'card';
card.innerHTML = '<div class="ct"><span>Free full songs</span><b style="color:var(--accent)">Jamendo · Internet Archive</b></div>' +
  '<div class="chips" id="fS"><div class="chip" data-s="jam">Jamendo</div><div class="chip" data-s="ia">Internet Archive</div><div class="chip" id="fB">Beats only</div></div>' +
  '<div id="fK" class="hidden" style="margin-top:10px"><div class="btnrow"><input type="password" id="fKi" placeholder="Jamendo client id (free)" autocomplete="off" spellcheck="false"><button class="ib" id="fKs" style="width:auto;padding:0 14px">Save</button></div><p class="hint">Jamendo needs a free client id from devportal.jamendo.com. Paste it once.</p></div>' +
  '<div class="btnrow" style="margin-top:10px"><input type="text" id="fQ" placeholder="Search full songs or beats…"><button class="ib" id="fGo" style="width:auto;padding:0 14px">Go</button></div>' +
  '<div id="fOut" style="margin-top:10px"></div><p class="hint">Jamendo and Internet Archive songs are free to use, but check each one\'s licence before you release anything. Some Jamendo artists switch downloads off, and those tracks stream only.</p>';
const anchor = $('stQ') && $('stQ').closest('.card'); (anchor ? anchor.insertAdjacentElement('afterend', card) : $('p-lib').appendChild(card));
const $f = id => document.getElementById(id), out = $f('fOut');
const paint = () => { card.querySelectorAll('#fS .chip[data-s]').forEach(c => c.classList.toggle('on', c.dataset.s == SRC)); $f('fB').classList.toggle('on', !!BEAT); $f('fK').classList.toggle('hidden', !(SRC == 'jam' && !KEY)); };
card.querySelectorAll('#fS .chip[data-s]').forEach(c => c.onclick = () => { SRC = c.dataset.s; LS.set('rd_fsrc', SRC); paint(); if ($f('fQ').value.trim()) go(); });
$f('fB').onclick = () => { BEAT = BEAT ? 0 : 1; LS.set('rd_fbeat', BEAT); paint(); if ($f('fQ').value.trim()) go(); };
$f('fKs').onclick = () => { KEY = $f('fKi').value.trim(); LS.set('rd_jam', KEY); $f('fKi').value = ''; paint(); toast(KEY ? 'Key saved' : 'Key removed'); if (KEY && $f('fQ').value.trim()) go(); };

// blob download: normal fetch first, native HTTP as the fallback when the site blocks the webview (CORS)
async function getBlob(url) {
  try { const r = await fetch(url); if (!r.ok) throw 0; return await r.blob(); }
  catch (e) {
    const H = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp; if (!H) throw e;
    const r = await H.get({ url, responseType: 'blob', connectTimeout: 15000, readTimeout: 120000 }); if (r.status >= 400) throw new Error('HTTP ' + r.status);
    const bin = atob(r.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: (r.headers && (r.headers['Content-Type'] || r.headers['content-type'])) || 'audio/mpeg' });
  }
}
// one list of tracks -> rows with ▶ and ＋. Each track: { id, title, artist, dur, url (stream), dl (download), art }
function rows(box, l) {
  const by = {}; l.forEach(t => by[t.id] = t);
  box.innerHTML = l.map(t => '<div class="item"><div class="n">' + esc(t.title) + '<small>' + esc(t.artist || '') + (t.dur ? ' · ' + dur(t.dur) : '') + (t.nodl ? ' · stream only' : '') + '</small></div><button class="ib" data-pv="' + esc(t.id) + '">▶</button>' + (t.nodl ? '' : '<button class="ib" data-add="' + esc(t.id) + '">＋</button>') + '</div>').join('');
  box.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { const t = by[b.dataset.pv]; R.play(t.id, t.url, { title: t.title, user: { name: t.artist }, duration: t.dur }, b); });
  box.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
    const t = by[b.dataset.add]; b.disabled = true; b.textContent = '…';
    try {
      const bl = await getBlob(t.dl || t.url); let art = null; if (t.art) { try { art = await getBlob(t.art); } catch (e) {} }
      await R.save(new Blob([bl], { type: 'audio/mpeg' }), t.title, t.artist, (t.artist ? t.artist + ' - ' : '') + t.title + '.mp3', art); b.textContent = '✓';
    } catch (e) { b.textContent = '＋'; b.disabled = false; toast('Download blocked. Preview still works; try another track'); }
  });
}

async function jamendo(q) {
  if (!KEY) { out.innerHTML = '<p class="hint">Paste your free Jamendo client id above first.</p>'; return; }
  const u = 'https://api.jamendo.com/v3.0/tracks/?client_id=' + encodeURIComponent(KEY) + '&format=json&limit=30&imagesize=200&audiodlformat=mp32&search=' + encodeURIComponent(q) + (BEAT ? '&vocalinstrumental=instrumental' : '');
  const j = await jget(u); if (j && j.headers && j.headers.status && j.headers.status != 'success') throw new Error(j.headers.error_message || 'Jamendo refused the request');
  const l = ((j && j.results) || []).map(x => ({ id: 'j' + x.id, title: x.name, artist: x.artist_name, dur: x.duration, url: x.audio, dl: x.audiodownload_allowed === false ? '' : (x.audiodownload || x.audio), nodl: x.audiodownload_allowed === false, art: x.image })).filter(t => t.url);
  if (!l.length) { out.innerHTML = '<p class="hint">No results.</p>'; return; } rows(out, l);
}
async function archive(q) {
  const qq = '(' + q + (BEAT ? ' AND (instrumental OR beat)' : '') + ') AND mediatype:audio';
  const j = await jget('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(qq) + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&sort%5B%5D=downloads+desc&rows=25&page=1&output=json');
  const d = (j && j.response && j.response.docs) || []; if (!d.length) { out.innerHTML = '<p class="hint">No results.</p>'; return; }
  out.innerHTML = d.map(x => '<div class="item" data-ia="' + esc(x.identifier) + '" style="cursor:pointer"><div class="n">' + esc(Array.isArray(x.title) ? x.title[0] : x.title || x.identifier) + '<small>' + esc(Array.isArray(x.creator) ? x.creator[0] : x.creator || '') + ' · tap to see tracks</small></div><button class="ib">▾</button></div><div id="iaT_' + esc(x.identifier) + '"></div>').join('');
  out.querySelectorAll('[data-ia]').forEach(e => e.onclick = async () => {
    const id = e.dataset.ia, box = document.getElementById('iaT_' + id); if (box.innerHTML) { box.innerHTML = ''; return; } box.innerHTML = '<p class="hint">Loading tracks…</p>';
    try {
      const m = await jget('https://archive.org/metadata/' + encodeURIComponent(id)), by = (m.metadata && (Array.isArray(m.metadata.creator) ? m.metadata.creator[0] : m.metadata.creator)) || '';
      const f = (m.files || []).filter(x => /\.mp3$/i.test(x.name) && !/_64kb|_sample|_preview/i.test(x.name)).slice(0, 40);
      if (!f.length) { box.innerHTML = '<p class="hint">No MP3 in this item.</p>'; return; }
      rows(box, f.map(x => { const u = 'https://archive.org/download/' + encodeURIComponent(id) + '/' + x.name.split('/').map(encodeURIComponent).join('/'); return { id: 'a' + id + '/' + x.name, title: x.title || x.name.replace(/\.mp3$/i, ''), artist: x.creator || by, dur: /:/.test(x.length || '') ? x.length.split(':').reduce((a, b) => a * 60 + +b, 0) : +x.length, url: u, dl: u }; }));
    } catch (er) { box.innerHTML = '<p class="hint">Could not load tracks.</p>'; }
  });
}
async function go() {
  const q = $f('fQ').value.trim(); if (!q) return; try { (R.stop || R.stopPv || (() => {}))(); } catch (e) {} out.innerHTML = '<p class="hint">Searching…</p>';
  try { SRC == 'jam' ? await jamendo(q) : await archive(q); }
  catch (e) { out.innerHTML = '<p class="hint">Search failed: ' + esc(String((e && e.message) || e).slice(0, 110)) + '</p>'; }
}
$f('fGo').onclick = go; $f('fQ').onkeydown = e => { if (e.key == 'Enter') go(); };
paint();
})();
