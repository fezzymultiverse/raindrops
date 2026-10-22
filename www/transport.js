// Raindrops V1.4.0 - Now playing bar: back / forward / play-pause / seek on Record, Mixer and Library (+ drawer).
// Works on whatever is playing: a take (voice + ad-libs + backing track kept in sync), the backing song, or an Audius preview.
// Locked while recording: moving the backing track mid-take would break the sync saved with the take.
(() => {
const STEP = 10;                       // seconds per tap
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fin = x => typeof x == 'number' && isFinite(x) && x > 0;

// ---------- what is playing right now ----------
function cur() {
  if (recording) return { k: 'rec' };
  if (PB && !PB.guide) return { k: 'take', pb: PB, r: recs.find(x => x.id == PB.id) || null };
  const p = window.RDpv && window.RDpv();
  if (p && !p.el.paused) return { k: 'pv', p };
  if (curSong && !aud.paused) return { k: 'song' };
  if (p) return { k: 'pv', p };
  if (curSong) return { k: 'song' };
  return { k: 'none' };
}
function dur(c) {
  if (c.k == 'song') return fin(aud.duration) ? aud.duration : 0;
  if (c.k == 'pv') return fin(c.p.el.duration) ? c.p.el.duration : (c.p.t && fin(+c.p.t.duration) ? +c.p.t.duration : 0);
  if (c.k == 'take') return fin(c.pb.el.duration) ? c.pb.el.duration : (c.r && fin(c.r.dur) ? c.r.dur : 0);
  return 0;
}
function pos(c) {
  if (c.k == 'song') return aud.currentTime || 0;
  if (c.k == 'pv') return c.p.el.currentTime || 0;
  if (c.k == 'take') return c.pb.el.currentTime || 0;
  return 0;
}
function playing(c) {
  if (c.k == 'song') return !aud.paused;
  if (c.k == 'pv') return !c.p.el.paused;
  if (c.k == 'take') return !c.pb.npPaused && !c.pb.el.paused;
  return false;
}
function info(c) {
  if (c.k == 'rec') return { t: 'Recording…', s: 'Seeking is locked until you stop', a: BLANK };
  if (c.k == 'song') return { t: curSong.title, s: curSong.artist || 'Backing track', a: artOf(curSong) };
  if (c.k == 'pv') { const m = c.p.t || {}; return { t: m.title || 'Preview', s: (m.user && m.user.name) || 'Audius preview', a: BLANK }; }
  if (c.k == 'take') {
    const r = c.r, sg = c.pb.hasSong && curSong ? curSong : null;
    return { t: r ? r.name : 'Take', s: (r && r.track == 'adlib' ? 'AD-LIB' : 'MAIN') + (r && r.bgName ? ' · 🎵 ' + r.bgName : ''), a: sg ? artOf(sg) : BLANK };
  }
  return { t: 'Nothing playing', s: 'Pick a song or a take', a: BLANK };
}

// ---------- seeking ----------
function seek(t) {
  const c = cur();
  if (c.k == 'rec') { toast('Stop recording first — seeking would knock the take out of sync'); return; }
  if (c.k == 'none') return;
  const d = dur(c); if (!d) return;
  t = clamp(t, 0, Math.max(0, d - 0.05));
  if (c.k == 'song') { try { aud.currentTime = t; } catch (e) {} return; }
  if (c.k == 'pv') { try { c.p.el.currentTime = t; } catch (e) {} return; }
  const pb = c.pb, r = c.r;
  pb.timers.forEach(clearTimeout); pb.timers.length = 0;
  try { pb.el.currentTime = t; } catch (e) {}
  if (pb.ad) { try { pb.ad.el.currentTime = Math.max(0, t + ((window.MX && MX.state.asy) || 0) / 1000); } catch (e) {} }
  if (pb.hasSong) {
    const sd = aud.duration, sy = (window.RdLat ? RdLat.syncFor(r) : +$('sy').value) / 1000;
    let st = ((r && r.bgOff) || 0) + t - sy;
    if (fin(sd)) st = ((st % sd) + sd) % sd; else st = Math.max(0, st);
    try { aud.currentTime = st; } catch (e) {}
  }
  if (!pb.npPaused) { pb.el.play().catch(() => {}); if (pb.ad) pb.ad.el.play().catch(() => {}); if (pb.hasSong) aud.play().catch(() => {}); }
}
function togglePlay(tabHint) {
  const c = cur();
  if (c.k == 'rec') { toast('Recording — tap the red button to stop'); return; }
  if (c.k == 'take') {
    const pb = c.pb;
    if (playing(c)) { pb.npPaused = true; pb.timers.forEach(clearTimeout); pb.timers.length = 0; pb.el.pause(); if (pb.ad) pb.ad.el.pause(); if (pb.hasSong) aud.pause(); }
    else { pb.npPaused = false; pb.el.play().catch(() => {}); if (pb.ad) pb.ad.el.play().catch(() => {}); if (pb.hasSong) aud.play().catch(() => {}); }
    return;
  }
  if (c.k == 'pv') { c.p.el.paused ? c.p.el.play().catch(() => {}) : c.p.el.pause(); return; }
  if (c.k == 'song' && (curSong && (tabHint != 'mixer' || !recs.length))) { aud.paused ? aud.play().catch(() => toast('Cannot play this file')) : aud.pause(); return; }
  if (recs.length) { const id = (window.MX && tabHint == 'mixer' && $('mxTake').value) ? +$('mxTake').value : recs[0].id; playR(id); return; }
  toast('Pick a song in Library or record a take first');
}

// ---------- the bar ----------
function bar(kind) {
  const d = document.createElement('div');
  d.className = kind == 'mix' ? 'npbar npin' : 'card npbar' + (kind == 'lib' ? ' sticky' : ''); d.dataset.np = kind;
  d.innerHTML =
    '<div class="npr"><img class="npa" alt=""><div class="npm"><b class="npn">Nothing playing</b><small class="nps">Pick a song or a take</small></div><span class="npc">0:00 / 0:00</span></div>' +
    '<input type="range" class="npk" min="0" max="1000" value="0" aria-label="Seek">' +
    '<div class="npb"><button class="ib" data-a="start" aria-label="Back to start">⏮</button><button class="ib" data-a="back" aria-label="Back 10 seconds">⏪</button><button class="ib pp" data-a="pp" aria-label="Play or pause">▶</button><button class="ib" data-a="fwd" aria-label="Forward 10 seconds">⏩</button></div>' +
    (kind == 'rec' ? '<p class="hint nph"></p>' : '');
  return d;
}
const bars = [];
function put(kind, anchor, how) { if (!anchor) return; const b = bar(kind); anchor.insertAdjacentElement(how, b); bars.push(b); wire(b); }
put('rec', document.querySelector('#p-rec .ctl'), 'afterend');
put('mix', $('mxStop') && $('mxStop').parentElement, 'afterend');
put('lib', document.querySelector('#p-lib'), 'afterbegin');

// hold a skip button to scrub: starts slow, speeds up
function wire(b) {
  const k = b.querySelector('.npk');
  let drag = false, rq = 0;
  b._drag = () => drag;
  k.addEventListener('pointerdown', () => { drag = true; });
  ['pointerup', 'pointercancel', 'change', 'blur'].forEach(ev => k.addEventListener(ev, () => { drag = false; }));
  k.addEventListener('input', () => {
    const c = cur(), d = dur(c); if (!d) return;
    const v = k.value / 1000 * d; cancelAnimationFrame(rq); rq = requestAnimationFrame(() => seek(v));
  });
  b.querySelectorAll('[data-a]').forEach(el => hold(el));
}
function hold(el) {
  const a = el.dataset.a; let t1 = 0, t2 = 0, n = 0;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = 0; };
  const sgn = a == 'back' ? -1 : 1;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); stop();
    if (a == 'pp') { togglePlay(el.closest('[data-np]') && el.closest('[data-np]').dataset.np == 'mix' ? 'mixer' : ''); return; }
    if (a == 'start') { seek(0); return; }
    const c = cur(); if (c.k == 'rec') { toast('Stop recording first — seeking would knock the take out of sync'); return; }
    if (c.k == 'none') { toast('Nothing playing'); return; }
    seek(pos(c) + sgn * STEP); n = 0;
    t1 = setTimeout(() => { t2 = setInterval(() => { const cc = cur(); n++; seek(pos(cc) + sgn * Math.min(12, 2 + n * 0.5)); }, 140); }, 380);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, stop));
}
// drawer: same back / forward around its own seek bar
(function () {
  const tp = document.querySelector('#side .tp'), sk = $('sSeek'); if (!tp || !sk) return;
  const mk = (a, t, l) => { const x = document.createElement('button'); x.className = 'ib'; x.dataset.a = a; x.textContent = t; x.setAttribute('aria-label', l); return x; };
  const bk = mk('back', '⏪', 'Back 10 seconds'), fw = mk('fwd', '⏩', 'Forward 10 seconds');
  tp.insertBefore(bk, sk); sk.insertAdjacentElement('afterend', fw); hold(bk); hold(fw);
})();

// ---------- refresh ----------
let last = '';
function paint() {
  const c = cur(), d = dur(c), p = pos(c), i = info(c), pl = playing(c), lock = c.k == 'rec', none = c.k == 'none';
  const sig = [c.k, i.t, i.s, i.a, pl, Math.floor(p * 4), Math.floor(d), lock, recOff ? Math.floor(recOff()) : 0].join('|');
  if (sig === last && !bars.some(b => b._drag())) return; last = sig;
  const tt = fmtT(p) + ' / ' + fmtT(d);
  bars.forEach(b => {
    const q = s => b.querySelector(s);
    if (q('.npn').textContent !== i.t) q('.npn').textContent = i.t;
    if (q('.nps').textContent !== i.s) q('.nps').textContent = i.s;
    if (q('.npa').getAttribute('src') !== i.a) q('.npa').src = i.a;
    q('.npc').textContent = tt;
    const k = q('.npk'); if (!b._drag()) k.value = d ? p / d * 1000 : 0;
    k.disabled = lock || none || !d;
    b.querySelectorAll('[data-a]').forEach(x => { x.disabled = lock && x.dataset.a != 'pp' ? true : (none && x.dataset.a != 'pp'); });
    q('[data-a=pp]').textContent = pl ? '❚❚' : '▶';
    b.classList.toggle('lock', lock);
    const h = q('.nph');
    if (h) {
      const o = recOff();
      h.textContent = lock ? 'Recording. Skip buttons unlock when you stop.'
        : (curSong && $('swBg').classList.contains('on')) ? (o > 0.5 ? 'Next take starts the backing track at ' + fmtT(o) + '. ⏮ puts it back to the top.' : 'Next take starts the backing track from the top. Seek to a verse first to start there.')
        : 'Pick a backing track in Library to record over it.';
    }
  });
}
setInterval(paint, 150); paint();

try {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('seekbackward', () => seek(pos(cur()) - STEP));
    navigator.mediaSession.setActionHandler('seekforward', () => seek(pos(cur()) + STEP));
  }
} catch (e) {}
window.RDT = { seek, cur, pos, dur, togglePlay };
})();
