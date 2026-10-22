// Raindrops V1.8.0 - Rap-Along Mode: full-screen lyrics for rapping over the backing track.
// Big current line in the theme colour, next line dimmed, a sweep across the current line (ESTIMATED: LRCLIB times
// whole lines only), tap a line to jump the song there, Record from that verse, and a wrong-lyrics guard with one-tap swap.
(() => {
const ov = document.createElement('div'); ov.id = 'ra';
ov.innerHTML = '<div class="ra-bg"><div id="raBg"></div></div>' +
  '<div class="ra-top"><button class="ra-x" id="raX" aria-label="Close">✕</button><img class="ra-art" id="raArt" alt=""><div class="ra-t"><b id="raT">Rap-Along</b><small id="raA"></small></div><div class="ra-tm"><i></i><span id="raTm">0:00</span></div></div>' +
  '<div class="ra-prog"><i id="raPg"></i></div>' +
  '<div class="ra-match" id="raM"><span class="ra-dot" id="raD"></span><div class="ra-mt" id="raMt">Looking for lyrics…</div><button class="ra-sw" id="raSw">Swap</button></div>' +
  '<div class="ra-sr"><input id="raQ" type="text" placeholder="Search a song or artist (unreleased too)" autocomplete="off" spellcheck="false"><button class="ra-sb2" id="raQg">Search</button></div>' +
  '<div class="ra-list hidden" id="raLs"></div>' +
  '<div class="ra-box" id="raB"></div>' +
  '<div class="ra-bot"><div class="ra-ctl"><button class="ra-sb" id="raU" aria-label="Back to start">⏮</button><button class="big" id="raR" aria-label="Record"><i></i></button><button class="ra-sb" id="raP" aria-label="Play">▶</button></div><div class="ra-hint" id="raH">Tap a line to jump there</div><div class="ra-brand">S.O.I. × Bojack Security · 999</div></div>';
document.body.appendChild(ov);
const $r = id => document.getElementById(id);
let on = false, raf = 0, k = -1, cands = [], ci = -1, ws = [], wasRec = false;

// ---------- lyric matching (same LRCLIB search the Find tab uses, ranked by length closeness) ----------
const lyText = x => x.syncedLyrics || x.plainLyrics || '';
function rank(all) {
  const d = aud.duration || 0;
  return all.filter(x => lyText(x)).map(x => ({ x, diff: d && x.duration ? Math.abs(x.duration - d) : 99 }))
    .sort((a, b) => ((b.x.syncedLyrics ? 1 : 0) - (a.x.syncedLyrics ? 1 : 0)) || (a.diff - b.diff)).map(o => o.x);
}
async function findCands() {
  const s = curSong; if (!s) return;
  try { const r = await RDlyrics.find({ artist: s.artist || '', title: s.title, dur: aud.duration || 0 }); if (curSong !== s) return; cands = r.slice(0, 14); }
  catch (e) { cands = []; }
  ci = cands.findIndex(x => lyText(x) == (s.lyrics || ''));
  showMatch();
}
function showMatch() {
  const m = ci >= 0 ? cands[ci] : null, d = aud.duration || 0, mt = $r('raMt'), dot = $r('raD'); dot.className = 'ra-dot';
  if (!L.length) { mt.innerHTML = '<span>No lyrics loaded</span>'; dot.classList.add('no'); }
  else if (m) {
    const diff = d && m.duration ? Math.round(m.duration - d) : 0, bad = Math.abs(diff) > 4; dot.classList.add(bad || !m.syncedLyrics ? 'warn' : 'ok');
    mt.innerHTML = '<span>' + esc(m.trackName) + ' — ' + esc(m.artistName) + '</span><small' + (bad ? ' class="warn"' : '') + '>' + (m.syncedLyrics ? 'synced' : 'text only, no timing') + (diff ? ' · ' + (diff > 0 ? '+' : '') + diff + 's vs your track' : '') + (bad ? ' · might be the wrong version' : '') + '</small>';
  } else { mt.innerHTML = '<span>Lyrics from file or an earlier search</span><small>Tap Swap to check LRCLIB matches</small>'; dot.classList.add('warn'); }
  $r('raSw').textContent = cands.length > 1 || (cands.length == 1 && ci < 0) ? 'Swap' : 'Find';
}
function pick(i) {
  const x = cands[i]; if (!x) return; ci = i; applyLy(lyText(x), x); build(); showMatch(); $r('raLs').classList.add('hidden');
  toast(x.syncedLyrics ? 'Switched: ' + x.trackName : 'Switched (no timing): ' + x.trackName);
}
$r('raSw').onclick = async () => {
  if (!curSong) { toast('Pick a song in Library'); return; }
  if (recording) { toast('Stop recording first'); return; }
  if (!cands.length) { toast('Searching…'); await findCands(); if (!cands.length) { toast('No matches — try the Find tab'); return; } }
  pick((ci + 1) % cands.length);
};
function showList() {
  const ls = $r('raLs'); if (!cands.length) { ls.classList.add('hidden'); return; }
  ls.classList.remove('hidden');
  ls.innerHTML = cands.map((x, i) => '<div class="item' + (i == ci ? ' cur' : '') + '" data-i="' + i + '"><div class="n">' + esc(x.trackName) + '<small>' + esc(x.artistName) + ' · ' + (x.duration ? fmtT(x.duration) + ' · ' : '') + (x.syncedLyrics ? 'synced' : 'text only') + (x.src && x.src != 'LRCLIB' ? ' · ' + esc(x.src) : '') + '</small></div></div>').join('');
  ls.querySelectorAll('.item').forEach(e => e.onclick = () => pick(+e.dataset.i));
}
$r('raMt').onclick = () => { if (recording) return; const ls = $r('raLs'); if (!ls.classList.contains('hidden')) { ls.classList.add('hidden'); return; } showList(); };
async function doSearch() {
  const q = $r('raQ').value.trim(); if (!q) return; if (recording) { toast('Stop recording first'); return; }
  $r('raMt').innerHTML = '<span>Searching…</span>'; $r('raQg').disabled = true;
  try { cands = await RDlyrics.search(q, aud.duration || 0); ci = -1; } catch (e) { cands = []; toast('Search failed: ' + String((e && e.message) || e).slice(0, 60)); }
  $r('raQg').disabled = false; showMatch();
  if (!cands.length) { $r('raLs').classList.add('hidden'); toast('Nothing found. Try fewer words, or the artist name alone'); return; }
  showList(); toast(cands.length + ' matches. Tap one to use it');
}
$r('raQg').onclick = doSearch; $r('raQ').onkeydown = e => { if (e.key == 'Enter') doSearch(); };

// ---------- lyric view ----------
function words(x) {
  const w = x.split(/\s+/).filter(Boolean), tot = w.reduce((a, b) => a + b.length + 1, 0); let c = 0;
  return w.map(t => { const a = c / tot; c += t.length + 1; return '<span class="w" data-a="' + a.toFixed(3) + '" data-b="' + (c / tot).toFixed(3) + '">' + esc(t) + '</span>'; }).join(' ');
}
function build() {
  const b = $r('raB'); k = -1; ws = [];
  b.innerHTML = L.length ? '<div class="ra-pad"></div>' + L.map((l, i) => '<p data-i="' + i + '">' + words(l.x) + '</p>').join('') + '<div class="ra-pad end"></div>'
    : '<p class="ra-none">No lyrics yet.<br><small>Search the name above, or tap Swap.</small></p>';
  $r('raH').textContent = !L.length ? '' : timed ? 'Tap a line to jump there, then hit record' : 'No timing in these lyrics, so lines only follow roughly. Swap to a synced match to tap-jump.';
}
// estimated length of a line: until the next line, but never longer than a rap line plausibly lasts
function lineEnd(i) { const t = L[i].t, nx = L[i + 1] ? L[i + 1].t : t + 6; return t + Math.min(nx - t, Math.max(1.2, L[i].x.length * 0.075)); }
function tick() {
  if (!on) return; raf = requestAnimationFrame(tick);
  const ct = aud.currentTime || 0, b = $r('raB'), ps = b.querySelectorAll('p[data-i]');
  let n = -1;
  if (timed) { for (let i = 0; i < L.length; i++) { if (L[i].t <= ct) n = i; else break; } }
  else if (aud.duration) n = Math.min(L.length - 1, Math.floor(ct / aud.duration * L.length));
  if (n !== k) {
    k = n;
    ps.forEach((p, i) => { p.className = i == n ? 'cur' : i == n + 1 ? 'nx' : i == n + 2 ? 'n2' : i < n ? 'past' : ''; });
    ws = n >= 0 && ps[n] ? [...ps[n].querySelectorAll('.w')].map(e => [e, +e.dataset.a, +e.dataset.b]) : [];
    if (!timed) ws.forEach(w => w[0].style.setProperty('--wp', 1));
    const el = ps[n]; if (el) b.scrollTo({ top: el.offsetTop - b.clientHeight * 0.3, behavior: 'smooth' });
  }
  if (timed && n >= 0) { const t = L[n].t, e = lineEnd(n), pr = Math.max(0, Math.min(1, (ct - t) / Math.max(0.3, e - t))); ws.forEach(w => w[0].style.setProperty('--wp', Math.max(0, Math.min(1, (pr - w[1]) / Math.max(0.01, w[2] - w[1]))).toFixed(3))); }
  const d = aud.duration || 0;
  $r('raTm').textContent = recording ? $('time').textContent : fmtT(ct); $r('raPg').style.width = (d ? Math.min(100, ct / d * 100) : 0) + '%';
  if (recording !== wasRec) { wasRec = recording; $r('raH').textContent = recording ? 'Recording. Jumping is locked until you stop.' : (L.length ? (timed ? 'Tap a line to jump there, then hit record' : $r('raH').textContent) : ''); }
  ov.classList.toggle('rec', recording); $r('raR').classList.toggle('rec', recording);
  $r('raP').textContent = aud.paused ? '▶' : '❚❚'; $r('raP').disabled = $r('raU').disabled = recording;
}
$r('raB').onclick = e => {
  const p = e.target.closest('p[data-i]'); if (!p) return;
  if (recording) { toast('Stop recording first — jumping would knock the take out of sync'); return; }
  if (!timed) { toast('No timing in these lyrics. Swap to a synced match.'); return; }
  if (PB) stopPlay();
  try { aud.currentTime = Math.max(0, L[+p.dataset.i].t - 0.15); } catch (x) {}
  k = -2; p.classList.remove('jump'); void p.offsetWidth; p.classList.add('jump');
};
$r('raU').onclick = () => { if (recording) return; if (PB) stopPlay(); try { aud.currentTime = 0; } catch (x) {} k = -2; };
$r('raP').onclick = () => { if (!curSong) { toast('Pick a song in Library'); return; } if (PB) stopPlay(); aud.paused ? aud.play().catch(() => toast('Cannot play this file')) : aud.pause(); ui(); };
$r('raR').onclick = () => {
  if (!recording && !curSong) { toast('Pick a song in Library first'); return; }
  if (!recording && !$('swBg').classList.contains('on')) toast('Backing track is off in Record tab, so lyrics will not move');
  $('bRec').click();
};

// ---------- open / close ----------
function open() {
  if (!curSong) { toast('Pick a song in Library first'); return; }
  on = true; ov.classList.add('show'); $('side').classList.remove('show');
  $r('raT').textContent = curSong.title; $r('raA').textContent = curSong.artist || 'Backing track';
  try { const a = artOf(curSong), has = a && a !== BLANK; if (has) $r('raArt').src = a; else $r('raArt').removeAttribute('src'); $r('raBg').style.backgroundImage = has ? 'url("' + a + '")' : 'none'; } catch (e) {}
  build(); showMatch(); cands = []; ci = -1; $r('raQ').value = ((curSong.artist ? curSong.artist + ' ' : '') + curSong.title).trim(); findCands(); cancelAnimationFrame(raf); tick();
}
function close() { on = false; ov.classList.remove('show'); cancelAnimationFrame(raf); lyrK = -2; lyrSync(); }
$r('raX').onclick = () => { if (recording) { toast('Stop recording first'); return; } close(); };
window.RdRapAlong = { open, close };
const btn = $('bRap'); if (btn) btn.onclick = open;
})();
