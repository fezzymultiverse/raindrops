// Raindrops V1.5.0 - Voice analyzer (Bass / Low-mid / Mid / High) in the Mixer + "Gemini ears" in Studio AI.
// Live bars = your voice only (the song never goes through Web Audio). "Analyze this take" compares your voice with the backing song band by band.
// Gemini ears = you choose what Gemini may see: library list, recordings list, the measured numbers, and (off until you switch it on) a 30 s audio clip.
(() => {
const BANDS = [
  { k: 'qb', n: 'Bass', lo: 60, hi: 250, tgt: -10 },
  { k: 'ql', n: 'Low-mid', lo: 250, hi: 800, tgt: -3 },
  { k: 'qm', n: 'Mid', lo: 800, hi: 3000, tgt: 2 },
  { k: 'qh', n: 'High', lo: 3000, hi: 10000, tgt: 0 }
];
// tgt = how far the voice usually sits above (+) or below (-) the song in that band. Rough starting guide, not a measured rule: trust your ears.
const SR = 22050, WIN = 0.1, CAP = 90, SONGCAP = 240;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dbf = p => 10 * Math.log10(p + 1e-12);
const rd = n => (Math.round(n * 10) / 10);
const mdh = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const getRec = () => { const v = $('mxTake').value; return v ? recs.find(r => r.id == v) : null; };
const songOf = r => (r && r.bgId && songs.find(s => s.id == r.bgId)) || null;

// ================= analysis (offline, no network) =================
const decode = async blob => new OfflineAudioContext(1, 1, SR).decodeAudioData(await blob.arrayBuffer());
function winPow(x, sr) {
  const n = Math.max(1, Math.floor(sr * WIN)), cnt = Math.floor(x.length / n), o = new Float32Array(cnt);
  for (let k = 0; k < cnt; k++) { let s = 0; for (let i = k * n, e = i + n; i < e; i++) s += x[i] * x[i]; o[k] = s / n; }
  return o;
}
async function bandWin(buf, lo, hi, capSec) {
  const len = Math.min(buf.length, Math.floor(buf.sampleRate * capSec)), o = new OfflineAudioContext(1, len, buf.sampleRate), s = o.createBufferSource();
  s.buffer = buf;
  const f = (t, hz) => { const n = o.createBiquadFilter(); n.type = t; n.frequency.value = hz; n.Q.value = 0.707; return n; };
  const chain = [f('highpass', lo), f('highpass', lo), f('lowpass', hi), f('lowpass', hi)];
  s.connect(chain[0]); for (let i = 0; i < 3; i++) chain[i].connect(chain[i + 1]); chain[3].connect(o.destination);
  s.start(); const r = await o.startRendering();
  return winPow(r.getChannelData(0), buf.sampleRate);
}
// returns { bands:[{k,n,lo,hi,v,s,diff,need,boost,say}], song:bool, secs }
async function analyze(r) {
  const vb = await decode(r.blob), sg = songOf(r), sb = sg ? await decode(sg.blob).catch(() => null) : null;
  const vFull = winPow(vb.getChannelData(0), vb.sampleRate).subarray(0, Math.floor(CAP / WIN));
  const sorted = Array.from(vFull).sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)] || 0, thr = Math.max(p95 * Math.pow(10, -3.5), 1e-8);
  const act = []; for (let k = 0; k < vFull.length; k++) if (vFull[k] > thr) act.push(k);
  if (act.length < 5) throw new Error('I could not hear your voice in this take (too quiet or too short).');
  const off = (r.bgOff || 0), out = [];
  for (const b of BANDS) {
    const vp = await bandWin(vb, b.lo, b.hi, CAP);
    let vs = 0; act.forEach(k => { vs += vp[k] || 0; });
    const row = { k: b.k, n: b.n, lo: b.lo, hi: b.hi, v: dbf(vs / act.length), s: null, diff: null, need: null, boost: 0, say: '' };
    if (sb) {
      const sp = await bandWin(sb, b.lo, b.hi, SONGCAP); let ss = 0, c = 0;
      act.forEach(k => { const i = Math.floor((off + k * WIN) / WIN) % sp.length; ss += sp[i]; c++; });
      row.s = dbf(ss / c); row.diff = row.v - row.s; row.need = b.tgt - row.diff;
      if (row.need >= 2) { row.boost = clamp(Math.round(row.need), 1, 8); row.say = 'Boost about +' + row.boost + ' dB'; }
      else if (row.need <= -5) row.say = 'Strong here, no boost needed';
      else row.say = 'Balanced';
    }
    out.push(row);
  }
  return { bands: out, song: !!sb, songName: sg ? sg.title : '', secs: Math.round(Math.min(vb.duration, CAP)) };
}
const pct = db => clamp((db + 80) / 80 * 100, 0, 100) + '%';

// ================= Mixer card =================
const card = document.createElement('div');
card.className = 'card'; card.id = 'anCard';
card.innerHTML = '<div class="ct"><span>Voice analyzer</span><b id="anSt" style="color:var(--accent)"></b></div>' +
  BANDS.map(b => '<div class="anr"><span>' + b.n + '<small>' + (b.hi >= 1000 ? (b.lo / 1000) + '-' + (b.hi / 1000) + ' kHz' : b.lo + '-' + b.hi + ' Hz') + '</small></span><div class="meter"><i id="anB_' + b.k + '"></i></div><b id="anV_' + b.k + '">-</b></div>').join('') +
  '<p class="hint">Live bars: play a take and watch your voice by band (voice only, after your effects). The song is not in these bars.</p>' +
  '<button class="btn" id="anRun" style="margin-top:6px">Analyze this take (voice vs song)</button><div id="anOut"></div>';
const eqc = $('eq4card'); if (eqc) eqc.parentNode.insertBefore(card, eqc); else $('p-mixer').appendChild(card);

const fd = new Uint8Array(1024), sm = {};
let wasLive = false;
(function loop() {
  const on = $('p-mixer').classList.contains('on') && PB && typeof analyser !== 'undefined' && analyser && ctxA;
  if (on) {
    analyser.getByteFrequencyData(fd); const bw = ctxA.sampleRate / analyser.fftSize;
    BANDS.forEach(b => {
      const i0 = Math.max(1, Math.floor(b.lo / bw)), i1 = Math.min(fd.length - 1, Math.ceil(b.hi / bw)); let m = 0;
      for (let i = i0; i <= i1; i++) if (fd[i] > m) m = fd[i];
      sm[b.k] = Math.max(m, (sm[b.k] || 0) * 0.85);
      $('anB_' + b.k).style.width = (sm[b.k] / 255 * 100) + '%'; $('anV_' + b.k).textContent = sm[b.k] > 8 ? Math.round(-100 + sm[b.k] / 255 * 70) + ' dB' : '-';
    });
    wasLive = true; $('anSt').textContent = 'live';
  } else if (wasLive) {
    wasLive = false; $('anSt').textContent = '';
    BANDS.forEach(b => { sm[b.k] = 0; $('anB_' + b.k).style.width = '0%'; $('anV_' + b.k).textContent = '-'; });
  }
  requestAnimationFrame(loop);
})();

let last = null;
function paintResult(a, rec) {
  a.rid = rec.id; last = a;
  const hasNeed = a.bands.filter(b => b.boost > 0);
  $('anOut').innerHTML = '<p class="hint" style="margin:12px 0 8px">' + esc(rec.name) + ' · first ' + a.secs + ' s, only while you are talking' + (a.song ? ' · against ' + esc(a.songName) : ' · no backing song attached, so no boost hints') + '</p>' +
    a.bands.map(b => '<div class="anres"><div class="anh"><b>' + b.n + '</b><span>voice ' + rd(b.v) + ' dB' + (b.s != null ? ' · song ' + rd(b.s) + ' dB · gap ' + (b.diff > 0 ? '+' : '') + rd(b.diff) + ' dB' : '') + '</span></div>' +
      '<div class="anb2"><i style="width:' + pct(b.v) + '"></i>' + (b.s != null ? '<u style="left:' + pct(b.s) + '"></u>' : '') + '</div>' +
      (b.say ? '<div class="ans ' + (b.boost ? 'need' : 'ok') + '">' + esc(b.say) + '</div>' : '') + '</div>').join('') +
    (a.song ? '<p class="hint">The line marks the song level in that band. The hints are a rough starting guide (a vocal usually sits well under the song in the bass and above it in the mids), so trust your ears.</p>' : '') +
    (hasNeed.length ? '<button class="btn" id="anApply" style="margin-top:6px">Apply suggested boost to Voice EQ</button>' : '');
  if (hasNeed.length) $('anApply').onclick = () => {
    if (!window.MX) return; hasNeed.forEach(b => MX.put(b.k, clamp(Math.max(MX.state[b.k] || 0, b.boost), -12, 12))); MX.syncUI(); toast('Voice EQ set. Play the take and listen.');
  };
}
$('anRun').onclick = async () => {
  const r = getRec(); if (!r) { toast('Record a take first'); return; }
  if (r.track == 'adlib') { toast('Pick a main take'); return; }
  const b = $('anRun'); b.disabled = true; b.textContent = 'Analyzing…'; $('anOut').innerHTML = '';
  try { paintResult(await analyze(r), r); }
  catch (e) { $('anOut').innerHTML = '<div class="aierr">' + esc(e && e.message || e) + '</div>'; }
  b.disabled = false; b.textContent = 'Analyze this take (voice vs song)';
};

// ================= Gemini ears (Studio AI) =================
const C = window.RdAIcore, KEY = () => String(LS.get('rd_gk', '') || '').trim(), MODEL = () => LS.get('rd_gm', '') || '';
const gx = document.createElement('details');
gx.className = 'card aiset'; gx.id = 'gxCard';
gx.innerHTML = '<summary>Gemini ears: library, recordings, audio</summary>' +
  '<p class="hint" style="margin-top:12px">You choose what Gemini can see. Nothing is sent until you tap Ask.</p>' +
  '<div class="cr" style="margin-bottom:10px"><span>Share my library list (titles + artists)</span><div class="sw" id="gxLib"></div></div>' +
  '<div class="cr" style="margin-bottom:10px"><span>Share my recordings list (names, length, backing song)</span><div class="sw" id="gxRec"></div></div>' +
  '<div class="cr" style="margin-bottom:10px"><span>Share the measured Bass / Low-mid / Mid / High numbers</span><div class="sw" id="gxNum"></div></div>' +
  '<div class="cr" style="margin-bottom:14px"><span>Let Gemini hear an audio clip (sent to Google)</span><div class="sw" id="gxAud"></div></div>' +
  '<div class="ct">Take to listen to</div><select id="gxTake" class="mxsel"></select>' +
  '<div class="row"><div class="lb"><span>Clip length (seconds, 300 = 5 min)</span><b id="gxLnV">30</b></div><input type="range" id="gxLn" min="30" max="300" step="30" value="30"></div>' +
  '<div class="row"><div class="lb"><span>Start the clip at (seconds)</span><b id="gxStV">0</b></div><input type="range" id="gxSt" min="0" max="300" step="1" value="0"></div>' +
  '<div class="cr" style="margin-bottom:12px"><span>Put the backing song in the clip</span><div class="sw" id="gxSong"></div></div>' +
  '<textarea class="pad" id="gxQ" placeholder="What should Gemini listen for? (optional) Example: is my voice buried in the chorus?" style="min-height:76px"></textarea>' +
  '<button class="btn aigo" id="gxGo" style="margin-top:12px">Ask Gemini to listen</button><div id="gxOut" style="margin-top:12px"></div>';
const anchor = $('aiSet'); if (anchor) anchor.parentNode.insertBefore(gx, anchor); else $('p-ai').appendChild(gx);
sw('gxLib', 'rd_gx_lib', true); sw('gxRec', 'rd_gx_rec', true); sw('gxNum', 'rd_gx_num', true); sw('gxAud', 'rd_gx_aud', false); sw('gxSong', 'rd_gx_song', true);
$('gxAud').addEventListener('click', e => { /* sw() already toggled; if it just went ON, make the person confirm once */
  if ($('gxAud').classList.contains('on') && !confirm('Each time you tap Ask, up to the clip length you set (30 s to 5 min) of audio from this take (and the backing song if that switch is on) is sent to Google Gemini. Keep it on?')) { $('gxAud').classList.remove('on'); LS.set('rd_gx_aud', false); }
});
$('gxSt').oninput = () => { $('gxStV').textContent = $('gxSt').value; };
$('gxLn').oninput = () => { $('gxLnV').textContent = $('gxLn').value; };
function fillTakes() {
  const sel = $('gxTake'), keep = sel.value;
  sel.innerHTML = recs.map(r => '<option value="' + r.id + '">' + (r.track == 'adlib' ? '🗣 ' : '') + esc(r.name) + (r.bgName ? ' · 🎵 ' + esc(r.bgName) : '') + '</option>').join('') || '<option value="">No takes yet</option>';
  if (keep && recs.some(r => r.id == keep)) sel.value = keep;
}
gx.addEventListener('toggle', () => { if (gx.open) fillTakes(); });
document.querySelector('.tab[data-p=ai]').addEventListener('click', fillTakes);

const SYS = 'You are a vocal mixing coach for a rapper and singer who records on a phone in an app called Raindrops. ' +
  'You only get what the person chose to share: a library list, a recordings list, measured band levels of their voice against the backing song, and sometimes a short audio clip. Use only that. ' +
  'If no audio clip is attached, say you are working from the numbers only and never claim you heard anything. Never invent measurements. ' +
  'Give specific moves using the app controls: Voice EQ Bass, Low-mid, Mid, High (dB, -12 to +12), Voice focus layer (%), Compression, De-esser, Noise gate, Low cut, Double voice, Song volume. ' +
  'Under 180 words, plain text, short lines, no markdown headings. Never quote lyrics from existing songs.';

const b64 = async blob => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
// 30 s to 5 min, mono, 16 kHz WAV (about 1 MB per 30 s) of the voice (with your current effects) and optionally the backing song, so the upload stays around 1 MB
async function makeClip(r, withSong, start, len) {
  const R = 16000, D = new OfflineAudioContext(1, 1, R), dec = async b => D.decodeAudioData(await b.arrayBuffer());
  const vb = await dec(r.blob), st = clamp(start, 0, Math.max(0, vb.duration - 1)), dur = Math.max(1, Math.min(clamp(len || 30, 30, 300), vb.duration - st));
  const sg = withSong ? songOf(r) : null; let sb = null; if (sg) { try { sb = await dec(sg.blob); } catch (e) {} }
  const off = new OfflineAudioContext(1, Math.ceil(dur * R), R), vs = off.createBufferSource(); vs.buffer = vb;
  if (window.MX && !MX.isDry()) { const c = await MX.build(off); vs.connect(c.input); c.output.connect(off.destination); } else vs.connect(off.destination);
  vs.start(0, st, dur);
  if (sb) { const ss = off.createBufferSource(), g = off.createGain(); ss.buffer = sb; ss.loop = true; g.gain.value = $('bgVol').value / 100; ss.connect(g); g.connect(off.destination); ss.start(0, ((r.bgOff || 0) + st) % sb.duration); }
  const w = wav(await off.startRendering());
  return { data: await b64(w), bytes: w.size, secs: Math.round(dur), song: !!sb };
}
async function buildParts(r) {
  const L = [], q = $('gxQ').value.trim().slice(0, 500);
  if (LS.get('rd_gx_lib', true)) { const l = songs.slice(0, 150); L.push('MY LIBRARY (' + songs.length + ' songs' + (songs.length > 150 ? ', first 150 shown' : '') + '):\n' + (l.map((s, i) => (i + 1) + '. ' + s.title + (s.artist ? ' - ' + s.artist : '')).join('\n') || '(empty)')); }
  if (LS.get('rd_gx_rec', true)) { const l = recs.slice(0, 40); L.push('MY RECORDINGS (' + recs.length + '):\n' + (l.map(x => '- ' + x.name + ' | ' + (x.track == 'adlib' ? 'ad-libs' : 'main') + ' | ' + Math.round(x.dur) + ' s' + (x.bgName ? ' | backing: ' + x.bgName + (x.bgOff > 0.5 ? ' from ' + fmtT(x.bgOff) : '') : ' | no backing')).join('\n') || '(none)')); }
  L.push('TAKE I WANT HEARD: ' + r.name + (r.bgName ? ' over ' + r.bgName : ''));
  let note = '';
  if (LS.get('rd_gx_num', true)) {
    if (r.track == 'adlib') note = 'Measured numbers: skipped (this is an ad-lib take).';
    else try {
      const a = last && last.rid == r.id ? last : await analyze(r); a.rid = r.id; last = a;
      L.push('MEASURED, first ' + a.secs + ' s, only while I talk (dB, higher = louder):\n' + a.bands.map(b => b.n + ' ' + b.lo + '-' + b.hi + ' Hz: my voice ' + rd(b.v) + (b.s != null ? ', song ' + rd(b.s) + ', gap ' + (b.diff > 0 ? '+' : '') + rd(b.diff) : '')).join('\n') + (a.song ? '' : '\n(no backing song attached to this take)'));
    } catch (e) { note = 'Measured numbers: not available (' + String(e.message || e).slice(0, 80) + ').'; }
  }
  if (note) L.push(note);
  const parts = [], withAudio = LS.get('rd_gx_aud', false); let clip = null;
  if (withAudio) { clip = await makeClip(r, LS.get('rd_gx_song', true), +$('gxSt').value || 0, +$('gxLn').value || 30); L.push('An audio clip is attached: ' + clip.secs + ' s' + (clip.song ? ', my voice with the backing song' : ', my voice only') + '.'); }
  else L.push('No audio clip is attached.');
  L.push('MY QUESTION: ' + (q || 'Tell me what in my voice needs a boost or a cut against the song, and what to change first.'));
  parts.push({ text: L.join('\n\n') });
  if (clip) parts.push({ inlineData: { mimeType: 'audio/wav', data: clip.data } });
  return { parts, clip };
}
let gxBusy = false;
$('gxGo').onclick = async () => {
  if (gxBusy) return;
  if (!KEY()) { toast('Add your Gemini key first'); $('aiSet').open = true; $('aiSet').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const r = recs.find(x => x.id == $('gxTake').value); if (!r) { toast('Record a take first'); return; }
  gxBusy = true; const b = $('gxGo'), out = $('gxOut'); b.disabled = true; out.innerHTML = '<div class="aiwait"><i></i><i></i><i></i><span>Preparing what you chose to share…</span></div>';
  try {
    const { parts, clip } = await buildParts(r);
    out.innerHTML = '<div class="aiwait"><i></i><i></i><i></i><span>' + (clip ? 'Gemini is listening…' : 'Gemini is reading…') + '</span></div>';
    const res = await C.ask({ key: KEY(), model: MODEL() || undefined, system: SYS, contents: [{ role: 'user', parts }], temp: 0.5, max: 1500, timeout: clip ? 180000 : 60000 });
    out.innerHTML = '<div class="aib m" style="max-width:100%">' + mdh(res.text) + '</div><p class="hint">' + (clip ? 'Gemini heard a ' + clip.secs + ' s clip (' + Math.round(clip.bytes / 1024) + ' KB).' : 'Gemini worked from text and numbers only, no audio was sent.') + '</p><button class="btn g" id="gxSave">Save to Notes</button>';
    $('gxSave').onclick = () => { try { notes.unshift({ id: Date.now(), t: 'Gemini ears: ' + r.name.slice(0, 30), b: res.text }); LS.set('rd_notes', notes); rNotes(); toast('Saved to Notes'); } catch (e) { toast('Could not save the note'); } };
  } catch (e) { out.innerHTML = '<div class="aierr">' + esc(e && e.message || e) + '</div>'; }
  gxBusy = false; b.disabled = false;
};

window.RdEars = { BANDS, analyze, makeClip, buildParts };
})();
