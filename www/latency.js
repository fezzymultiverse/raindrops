// Raindrops V1.6.0 - Auto latency pairing (headphones).
// Problem: while you record, the song reaches your ears late (output latency, big on Bluetooth) and your voice reaches the file late (mic latency).
// So your voice sits LATE against the song in the saved take. Fix = delay the song on playback/export by that same amount.
// How the amount is found (best source wins):
//   1. Tap calibration (you tap along to a click for ~10 s) - measured on THIS device, saved per output device.
//   2. What the phone reports (AudioContext.outputLatency + baseLatency).
//   3. A guess (Bluetooth 180 ms, other 45 ms) when the phone reports nothing.
//   + mic latency (track setting if the phone gives it, else 20 ms guess).
// The number is saved WITH each take when you press record (take.lat), so a take recorded on Bluetooth stays right even if you play it on a speaker later.
// The old "Voice sync" slider stays as a manual trim on top. Ad-libs timing (track 2) is NOT touched.
(() => {
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const BT = /blue|bt[\s_-]|buds|airpod|a2dp|hfp|wireless|headset|earbud|honor choice|galaxy buds|jbl|sony wh|wf-/i;
const GUESS_BT = 180, GUESS_OUT = 45, GUESS_MIC = 20;
const CAL = LS.get('rd_latcal', {});                 // { deviceKey: output ms measured by tapping }
let auto = !!LS.get('rd_latauto', 1);
let est = { label: '', key: 'default', bt: false, out: GUESS_OUT, outSrc: 'guess', inn: GUESS_MIC, innSrc: 'guess', total: GUESS_OUT + GUESS_MIC };

// one-time move of the old manual slider value so it is not counted twice (old takes keep it, new takes use their own saved latency)
if (LS.get('rd_lat_mig', 0) !== 1) {
  const old = +LS.get('rd_sy', 0) || 0;
  LS.set('rd_lat_legacy', old); LS.set('rd_sy', 0); LS.set('rd_lat_mig', 1);
  const sy = $('sy'); if (sy) { sy.value = 0; sy.oninput && sy.oninput(); }
  if (old) setTimeout(() => { try { toast('Voice sync moved: old takes keep ' + old + ' ms, new takes pair automatically'); } catch (e) {} }, 1500);
}
const legacy = () => +LS.get('rd_lat_legacy', 0) || 0;

// ---------- the number applied on playback / export ----------
function syncFor(r) {
  const trim = +($('sy') ? $('sy').value : 0) || 0;
  const has = r && r.lat != null && isFinite(r.lat);
  const base = has ? (auto ? r.lat : 0) : legacy();
  return base + trim;                                  // ms; positive = song starts later than the voice
}
const current = () => est.total;

// ---------- tap math (pure, tested) ----------
// clicks = when each click was scheduled to play (ms), taps = when you tapped (ms), same clock.
function solveTaps(clicks, taps) {
  const used = new Map();
  taps.forEach(t => {
    let bj = -1, bd = 1e9;
    clicks.forEach((c, j) => { const d = t - c; if (Math.abs(d) < Math.abs(bd)) { bd = d; bj = j; } });
    if (bj < 0 || Math.abs(bd) > 400) return;
    if (!used.has(bj) || Math.abs(bd) < Math.abs(used.get(bj))) used.set(bj, bd);
  });
  let d = [...used.values()];
  if (d.length < 6) return { ok: false, n: d.length, reason: 'Too few taps near a click (need 6, got ' + d.length + ')' };
  const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  let m = med(d); const mad = med(d.map(x => Math.abs(x - m)));
  const lim = Math.max(30, 3 * 1.4826 * mad);
  d = d.filter(x => Math.abs(x - m) <= lim);
  if (d.length < 6) return { ok: false, n: d.length, reason: 'Taps were all over the place, try again' };
  m = med(d);
  const mean = d.reduce((a, b) => a + b, 0) / d.length, sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / d.length);
  if (sd > 55) return { ok: false, n: d.length, sd, reason: 'Taps were not steady enough (spread ' + Math.round(sd) + ' ms), try again' };
  return { ok: true, n: d.length, sd, ms: clamp(Math.round(m), 0, 800) };
}

// ---------- estimate ----------
async function outLabel() {
  try {
    const ds = await navigator.mediaDevices.enumerateDevices();
    const o = ds.filter(d => d.kind == 'audiooutput');
    const d = o.find(x => x.deviceId == 'default') || o[0];
    return (d && d.label) || '';
  } catch (e) { return ''; }
}
async function probeCtx() {
  try {
    const C = window.AudioContext || window.webkitAudioContext, c = new C({ latencyHint: 'interactive' });
    try { await c.resume(); } catch (e) {}
    await new Promise(r => setTimeout(r, 60));
    const o = (typeof c.outputLatency == 'number' ? c.outputLatency : 0) * 1000, b = (c.baseLatency || 0) * 1000;
    try { c.close(); } catch (e) {}
    return { out: o, base: b };
  } catch (e) { return { out: 0, base: 0 }; }
}
let busy = null;
function refresh() {
  if (busy) return busy;
  busy = (async () => {
    const label = await outLabel(), key = label || 'default', bt = BT.test(label);
    let out, src;
    if (CAL[key] != null) { out = CAL[key]; src = 'tapped'; }
    else {
      const p = await probeCtx(), rep = p.out + p.base;
      if (p.out > 0 && !(bt && rep < 120)) { out = rep; src = 'phone report'; }
      else if (bt) { out = GUESS_BT; src = p.out > 0 ? 'Bluetooth guess (phone under-reports)' : 'Bluetooth guess'; }
      else { out = p.out > 0 ? rep : GUESS_OUT; src = p.out > 0 ? 'phone report' : 'guess'; }
    }
    const prev = est.key;
    est = Object.assign(est, { label, key, bt, out: Math.round(out), outSrc: src });
    est.total = Math.round(est.out + est.inn);
    paint();
    return { changedDevice: prev !== key };
  })().finally(() => { busy = null; });
  return busy;
}
function noteMic(stream) {
  try {
    const t = stream && stream.getAudioTracks && stream.getAudioTracks()[0], l = t && t.getSettings && t.getSettings().latency;
    if (l > 0 && l < 1) { est.inn = Math.round(l * 1000); est.innSrc = 'mic setting'; }
    else { est.inn = GUESS_MIC; est.innSrc = 'guess'; }
    est.total = est.out + est.inn;
  } catch (e) {}
  refresh();                                           // labels exist once mic permission is granted
}

// ---------- UI: Record tab card ----------
const sy = $('sy'), anchor = sy && sy.closest('.card');
const card = document.createElement('div'); card.className = 'card'; card.id = 'latCard';
card.innerHTML = '<div class="ct"><span>Latency pairing (headphones)</span><b id="latTot" style="color:var(--accent)"></b></div>' +
  '<div class="cr" style="margin-bottom:12px"><span>Auto latency pairing</span><div class="sw" id="latAuto"></div></div>' +
  '<p class="hint" id="latInfo" style="margin:0 0 10px"></p>' +
  '<div class="btnrow"><button class="btn" id="latCalBtn">Calibrate (tap along)</button><button class="btn g" id="latRe">Re-measure</button></div>' +
  '<div id="latPanel" class="hidden" style="margin-top:12px;text-align:center"><p class="hint" id="latMsg" style="margin:0 0 10px"></p><button class="btn" id="latTap" style="height:84px;font-size:22px;width:100%">TAP</button></div>' +
  '<p class="hint" style="margin-top:10px">Your voice reaches the file late (headphone + mic delay), so the app delays the song by that amount when it plays or exports. The number is saved with each take when you press record. Voice sync above is a manual trim on top. Tap calibration is accurate to roughly 30 ms.</p>';
if (anchor) anchor.parentNode.insertBefore(card, anchor.nextSibling); else document.getElementById('p-record') && document.getElementById('p-record').appendChild(card);
if (sy) { sy.max = 600; const lb = sy.closest('.row') && sy.closest('.row').querySelector('.lb span'); if (lb) lb.textContent = 'Voice sync trim (ms, on top of auto)'; }

function paint() {
  const s = (x, y) => { const e = $(x); if (e) e.textContent = y; };
  s('latTot', auto ? est.total + ' ms' : 'manual');
  s('latInfo', (est.label ? est.label + ' · ' : '') + 'output ' + est.out + ' ms (' + est.outSrc + ') + mic ' + est.inn + ' ms (' + est.innSrc + ')' + (auto ? '' : ' · Auto is off: only the Voice sync slider is used'));
  const sw = $('latAuto'); if (sw) sw.classList.toggle('on', auto);
  takeRow();
}
$('latAuto').onclick = () => { auto = !auto; LS.set('rd_latauto', auto ? 1 : 0); paint(); };
$('latRe').onclick = async () => { $('latRe').disabled = true; await refresh(); $('latRe').disabled = false; toast('Latency ' + est.total + ' ms (' + est.outSrc + ')'); };

// ---------- tap calibration ----------
let cal = null;
$('latCalBtn').onclick = async () => {
  if (cal) { endCal(true); return; }
  if (typeof recording !== 'undefined' && recording) { toast('Stop recording first'); return; }
  try { if (typeof stopPlay == 'function') stopPlay(); if (typeof stopSong == 'function') stopSong(); } catch (e) {}
  const C = window.AudioContext || window.webkitAudioContext; if (!C) { toast('Audio not available'); return; }
  const c = new C({ latencyHint: 'interactive' }); try { await c.resume(); } catch (e) {}
  const N = 12, GAP = 0.8, p0 = performance.now(), c0 = c.currentTime, first = c0 + 1.2, clicks = [];
  for (let i = 0; i < N; i++) {
    const at = first + i * GAP, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 1500; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.9, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + 0.06);
    clicks.push(p0 + (at - c0) * 1000);                // click time on the performance clock (when it was WRITTEN to the audio device)
  }
  cal = { c, clicks, taps: [], timer: setTimeout(() => endCal(false), (1.2 + N * GAP + 0.6) * 1000) };
  $('latPanel').classList.remove('hidden'); $('latCalBtn').textContent = 'Cancel calibration';
  $('latMsg').textContent = 'Headphones on. Tap the button exactly when you HEAR each click. 12 clicks, about 11 seconds.';
};
$('latTap').addEventListener('pointerdown', e => { if (!cal) return; e.preventDefault(); cal.taps.push(performance.now()); $('latMsg').textContent = 'Taps: ' + cal.taps.length + ' / 12'; });
function endCal(cancel) {
  if (!cal) return; const k = cal; cal = null; clearTimeout(k.timer); try { k.c.close(); } catch (e) {}
  $('latPanel').classList.add('hidden'); $('latCalBtn').textContent = 'Calibrate (tap along)';
  if (cancel) { toast('Calibration cancelled'); return; }
  const r = solveTaps(k.clicks, k.taps);
  if (!r.ok) { toast(r.reason); return; }
  CAL[est.key] = r.ms; LS.set('rd_latcal', CAL);
  refresh().then(() => toast('Calibrated: output ' + r.ms + ' ms for ' + (est.label || 'this output') + ' (' + r.n + ' taps, spread ' + Math.round(r.sd) + ' ms)'));
}

// ---------- Mixer: per-take latency + re-pair ----------
const mxTake = $('mxTake'), trow = document.createElement('div');
trow.className = 'cr'; trow.id = 'latTake'; trow.style.cssText = 'margin:0 0 12px;gap:8px';
trow.innerHTML = '<span id="latTakeTxt" style="flex:1"></span><button class="btn g" id="latTakeBtn" style="width:auto;padding:0 14px;margin:0">Re-pair to now</button>';
if (mxTake) mxTake.parentNode.insertBefore(trow, mxTake.nextSibling);
const selRec = () => { try { const v = $('mxTake').value; return v ? recs.find(r => r.id == v) : null; } catch (e) { return null; } };
let lastTxt = '';
function takeRow() {
  const r = selRec(), t = $('latTakeTxt'); if (!t) return;
  let x;
  if (!r) x = 'Take latency: -';
  else if (r.lat == null) x = 'Take latency: old take (uses Voice sync ' + legacy() + ' ms)';
  else x = 'Take latency: ' + r.lat + ' ms' + (auto ? '' : ' (Auto off, not applied)');
  if (x !== lastTxt) { lastTxt = x; t.textContent = x; }
}
$('latTakeBtn').onclick = async () => {
  const r = selRec(); if (!r) { toast('Pick a take first'); return; }
  r.lat = est.total; lastTxt = ''; takeRow();
  try { await DB.put('recs', strip(r)); toast('Take paired at ' + est.total + ' ms. Press play to hear it.'); } catch (e) { toast('Paired for now, could not save'); }
};
if (mxTake) mxTake.addEventListener('change', () => { lastTxt = ''; takeRow(); });
setInterval(() => { if (!document.hidden) takeRow(); }, 1000);

// ---------- headphones plugged / unplugged / Bluetooth connected ----------
try {
  let dt = 0;
  navigator.mediaDevices.addEventListener('devicechange', () => {
    clearTimeout(dt); dt = setTimeout(async () => {
      const r = await refresh();
      if (typeof recording !== 'undefined' && recording) return;
      toast((r.changedDevice ? 'Audio device changed: ' : 'Latency re-checked: ') + est.total + ' ms' + (est.outSrc == 'tapped' ? '' : ' (' + est.outSrc + '). Tap Calibrate for an exact value'));
    }, 700);
  });
} catch (e) {}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

window.RdLat = { get _cal() { return cal; }, syncFor, current, solveTaps, refresh, noteMic, get est() { return est; }, get auto() { return auto; }, CAL };
paint(); refresh();
})();
