// Raindrops V1.4.0 - Duplicate scanner (Library). EXACT = same bytes (SHA-256). SIMILAR = same title/artist or file name after cleaning.
// Exact copies are pre-ticked for removal (one keeper per group). Similar ones are never pre-ticked - you decide.
(() => {
const norm = s => String(s || '').toLowerCase().replace(/\.\w{2,5}$/, '').replace(/\(\d+\)|\[[^\]]*\]|[-_ ]+copy\b/g, '').replace(/[^a-z0-9]+/g, '');
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
let groups = [], busy = false;

async function scan() {
  if (busy) return; busy = true;
  const out = $('dupBody'), go = $('dupGo'); go.disabled = true;
  $('dup').classList.add('show'); out.innerHTML = '<p>Scanning ' + songs.length + ' songs…</p>';
  const hash = {}, bySize = {};
  songs.forEach(s => (bySize[s.size] = bySize[s.size] || []).push(s));
  const need = Object.values(bySize).filter(g => g.length > 1).flat();
  let n = 0;
  for (const s of need) {
    try { hash[s.id] = hex(await crypto.subtle.digest('SHA-256', await s.blob.arrayBuffer())); } catch (e) {}
    if (++n % 3 == 0) { out.innerHTML = '<p>Checking file contents ' + n + ' / ' + need.length + '…</p>'; await new Promise(r => setTimeout(r)); }
  }
  // union-find: link songs sharing a hash, a title+artist key or a cleaned file name
  const p = {}, f = x => (p[x] == x ? x : (p[x] = f(p[x])));
  songs.forEach(s => (p[s.id] = s.id));
  const seen = {}, link = (k, s) => { if (!k) return; if (seen[k] != null) p[f(s.id)] = f(seen[k]); else seen[k] = s.id; };
  songs.forEach(s => { link(hash[s.id] && 'h' + hash[s.id], s); link(s.title && 't' + norm(s.artist + '|' + s.title), s); link('n' + norm(s.name), s); });
  const m = {}; songs.forEach(s => (m[f(s.id)] = m[f(s.id)] || []).push(s));
  groups = Object.values(m).filter(g => g.length > 1).map(g => {
    const score = s => (s.lyrics ? 2 : 0) + (s.art ? 1 : 0);
    g.sort((a, b) => score(b) - score(a) || a.added - b.added);
    const exact = g.every(s => hash[s.id] && hash[s.id] == hash[g[0].id]);
    return { exact, list: g };
  }).sort((a, b) => b.exact - a.exact);
  draw(); busy = false;
}

function draw() {
  const out = $('dupBody');
  if (!groups.length) { out.innerHTML = '<p>No duplicates found. Your library is clean 🐾</p>'; $('dupGo').disabled = true; return; }
  out.innerHTML = groups.map((g, gi) => `<div class="ct" style="margin-top:12px"><span>${g.exact ? 'EXACT COPIES' : 'SIMILAR — CHECK'}</span><b style="color:var(--accent)">${g.list.length}</b></div>` +
    g.list.map((s, i) => `<label class="item" style="cursor:pointer"><input type="checkbox" class="dk" data-g="${gi}" data-i="${i}" ${g.exact && i ? 'checked' : ''}><div class="n">${i ? '' : '✅ KEEP · '}${esc(s.title)}<small>${esc(s.artist || 'Unknown artist')} · ${esc(s.name)} · ${(s.size / 1048576).toFixed(1)}MB${s.lyrics ? ' · lyrics' : ''}${s.art ? ' · art' : ''}</small></div></label>`).join('')).join('');
  out.querySelectorAll('.dk').forEach(c => c.onchange = cnt);
  cnt();
}
function picked() {
  const r = [];
  groups.forEach((g, gi) => {
    const sel = g.list.map((s, i) => ({ s, i })).filter(x => document.querySelector(`.dk[data-g="${gi}"][data-i="${x.i}"]`).checked);
    if (!sel.length) return;
    const keepers = g.list.filter((s, i) => !sel.some(x => x.i == i));
    const keep = keepers[0] || g.list[0];
    sel.forEach(x => { if (x.s !== keep) r.push({ s: x.s, keep }); });
  });
  return r;
}
function cnt() { const n = picked().length; $('dupGo').textContent = 'Remove selected (' + n + ')'; $('dupGo').disabled = !n; }

async function remove() {
  const r = picked(); if (!r.length || !confirm('Remove ' + r.length + ' duplicate song(s) from the app? Your takes keep working.')) return;
  if (PB) stopPlay();
  const gone = new Set(r.map(x => x.s.id));
  for (const { s, keep } of r) {
    for (const t of recs) if (t.bgId == s.id) { t.bgId = keep.id; t.bgName = keep.title; try { await DB.put('recs', strip(t)); } catch (e) {} }
    if (s._u) URL.revokeObjectURL(s._u); if (s._a) URL.revokeObjectURL(s._a);
    try { await DB.del('songs', s.id); } catch (e) {}
  }
  const wasCur = curSong && gone.has(curSong.id);
  const to = wasCur && r.find(x => x.s.id == curSong.id).keep;
  if (wasCur) stopSong();
  songs = songs.filter(s => !gone.has(s.id));
  if (to) setSong(songs.find(s => s.id == to.id) || to);
  rSongs(); rRecs(); ui();
  $('dup').classList.remove('show'); toast(r.length + ' duplicates removed');
}
$('bDup').onclick = scan; $('dupX').onclick = () => $('dup').classList.remove('show'); $('dupGo').onclick = remove;
})();
