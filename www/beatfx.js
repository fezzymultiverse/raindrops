// Raindrops V1.8.0 - Beat master: shapes the SONG (not your voice) so the artist sits beside you like a duet and your voice stays centre.
// Chain: mid/side split (voice pocket cut + centre trim on the MID, width on the SIDE) > weight + tone > "dark" low-pass > duck stage > reverb "back" > level.
// Duck stage = dynamic EQ: when you rap, the beat's 2.6 kHz pocket and level dip a little, then come back in the gaps.
// Used in take playback (live) and export (offline). Recording itself is not touched, so your timing stays put.
// V1.9.0: the Beat master chain is followed by the Mix Rack beat chain (rack.js). The beat is routed through Web Audio when Beat master is on OR a Mix Rack beat control is above 0.
(() => {
const DEF = { on: 0, tone: 0, back: 0, pocket: 0, width: 0, duck: 0, low: 0, lvl: 0, pre: 'flat' };
const S = Object.assign({}, DEF, LS.get('rd_bfx', {}));
const save = () => LS.set('rd_bfx', S);
const dB = x => Math.pow(10, x / 20), cl = (v, a, b) => Math.min(b, Math.max(a, v));
const PRE = {
  flat:   { name: 'Flat',            tone: 0,   back: 0,  pocket: 0,  width: 0,  duck: 0,  low: 0,   lvl: 0 },
  duet:   { name: 'Duet Blend',      tone: -15, back: 35, pocket: 45, width: 25, duck: 40, low: 0,   lvl: -2 },
  dark:   { name: 'Darker',          tone: -70, back: 40, pocket: 30, width: 20, duck: 25, low: 10,  lvl: -1 },
  light:  { name: 'Lighter',         tone: 60,  back: 10, pocket: 40, width: 40, duck: 35, low: -15, lvl: -1 },
  back:   { name: 'Way Back',        tone: -35, back: 85, pocket: 55, width: 55, duck: 45, low: -10, lvl: -4 },
  front:  { name: 'Voice Up Front',  tone: 0,   back: 30, pocket: 80, width: 40, duck: 70, low: 0,   lvl: -3 }
};
const SL = [['tone', 'Dark ◂ ▸ Light', -100, 100], ['back', 'Back (depth)', 0, 100], ['pocket', 'Voice pocket', 0, 100], ['width', 'Width', 0, 100], ['duck', 'Duck under my voice', 0, 100], ['low', 'Low end', -100, 100], ['lvl', 'Beat level (dB)', -12, 3]];

// ---------- the chain (works on a live AudioContext and an OfflineAudioContext) ----------
function buildCore(c) {
  const live = !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext);
  const G = (v = 1) => { const g = c.createGain(); g.gain.value = v; return g; };
  const F = (t, f, q, g) => { const n = c.createBiquadFilter(); n.type = t; n.frequency.value = f; if (q != null) n.Q.value = q; if (g) n.gain.value = g; return n; };
  const input = G(); input.channelCount = 2; input.channelCountMode = 'explicit'; input.channelInterpretation = 'speakers'; // mono songs become dual-mono
  const sp = c.createChannelSplitter(2), mg = c.createChannelMerger(2);
  const M = G(), Sd = G(), mL = G(.5), mR = G(.5), sL = G(.5), sR = G(-.5), sInv = G(-1), Lo = G(), Ro = G();
  const lm = F('peaking', 380, 1, 0), pk = F('peaking', 2600, .9, 0), mLvl = G(), wid = G();
  input.connect(sp); sp.connect(mL, 0); sp.connect(sL, 0); sp.connect(mR, 1); sp.connect(sR, 1);
  mL.connect(M); mR.connect(M); sL.connect(Sd); sR.connect(Sd);
  M.connect(lm); lm.connect(pk); pk.connect(mLvl); Sd.connect(wid);
  mLvl.connect(Lo); wid.connect(Lo); mLvl.connect(Ro); wid.connect(sInv); sInv.connect(Ro);
  Lo.connect(mg, 0, 0); Ro.connect(mg, 0, 1);
  const ls = F('lowshelf', 120, null, 0), hs = F('highshelf', 5500, null, 0), lp = F('lowpass', 20000, .707);
  const duckEq = F('peaking', 2600, .9, 0), duckG = G(), out = G(), pre = c.createDelay(.1), cv = c.createConvolver(), wet = G(0);
  pre.delayTime.value = .018;
  { const n = Math.floor(c.sampleRate * 1.2), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let l = 0; for (let i = 0; i < n; i++) { l += .25 * ((Math.random() * 2 - 1) - l); d[i] = l * 2.4 * Math.pow(1 - i / n, 3); } }
    cv.buffer = b; }
  mg.connect(ls); ls.connect(hs); hs.connect(lp); lp.connect(duckEq); duckEq.connect(duckG); duckG.connect(out);
  lp.connect(pre); pre.connect(cv); cv.connect(wet); wet.connect(duckG);
  const P = (p, v) => { if (live) p.setTargetAtTime(v, c.currentTime, .04); else p.value = v; };
  function set(s) {
    s = s || S; if (!S.on) s = DEF; const t = s.tone / 100, b = s.back / 100, k = s.pocket / 100, w = s.width / 100, lo = s.low / 100;
    P(hs.gain, 7 * t - 4 * b);
    P(ls.gain, (lo < 0 ? 9 * lo : 3 * lo) - 2 * Math.max(0, t));
    P(lp.frequency, cl(20000 * (t < 0 ? Math.pow(.14, -t) : 1) * (1 - .4 * b), 1800, 20000));
    P(pk.gain, -10 * k); P(lm.gain, -3 * k); P(mLvl.gain, dB(-4 * k));
    P(wid.gain, 1 + .9 * w); P(wet.gain, .32 * b); P(out.gain, dB(s.lvl - 4.5 * b));
  }
  set();
  return { input, output: out, set, duckEq, duckG,
    // offline: dip the pocket + level where the voice is active
    duckCurve(vb, at) {
      const n = S.on ? S.duck / 100 : 0; if (!n || !vb) return;
      const d = vb.getChannelData(0), fr = Math.floor(vb.sampleRate * .05), N = Math.floor(d.length / fr); if (N < 2) return;
      const e = new Float32Array(N), g = new Float32Array(N); let cur = 0;
      for (let i = 0; i < N; i++) { let s = 0; for (let j = i * fr; j < (i + 1) * fr; j++) s += d[j] * d[j]; const db = 10 * Math.log10(s / fr + 1e-12), x = cl((db + 48) / 18, 0, 1); cur += (x - cur) * (x > cur ? .7 : .12); e[i] = -9 * n * cur; g[i] = dB(-3 * n * cur); }
      duckEq.gain.setValueCurveAtTime(e, at, N * .05); duckG.gain.setValueCurveAtTime(g, at, N * .05);
    } };
}

// V1.9.0: Beat master core + Mix Rack beat chain as one unit (same interface as before)
function build(c) {
  const core = buildCore(c), rk = window.RdRack && RdRack.buildBeat ? RdRack.buildBeat(c) : null;
  if (!rk) return core;
  core.output.connect(rk.input);
  return Object.assign({}, core, { output: rk.output, rack: rk, analyser: rk.analyser });
}
const on = () => !!S.on || !!(window.RdRack && RdRack.beatOn && RdRack.beatOn());

// ---------- live: route the song element through the chain only while a take plays ----------
let R = null, tm = 0, an = null, routed = false;
function live(c, pb) {
  if (!on()) return;
  if (!R) {
    const src = c.createMediaElementSource(aud), byp = c.createGain(), chn = build(c), cg = c.createGain();
    src.connect(byp); byp.connect(c.destination); src.connect(chn.input); chn.output.connect(cg); cg.connect(c.destination); cg.gain.value = 0;
    R = { c, src, byp, chn, cg };
  }
  routed = true; const t = c.currentTime; R.chn.set(S); R.byp.gain.setTargetAtTime(0, t, .02); R.cg.gain.setTargetAtTime(1, t, .02);
  an = c.createAnalyser(); an.fftSize = 1024; try { pb.src.connect(an); } catch (e) {}
  const buf = new Float32Array(1024); let cur = 0; clearInterval(tm);
  tm = setInterval(() => {
    if (!R || !an) return; an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const x = cl((10 * Math.log10(s / buf.length + 1e-12) + 48) / 18, 0, 1), n = S.on ? S.duck / 100 : 0; cur += (x - cur) * (x > cur ? .6 : .12);
    const tt = R.c.currentTime; R.chn.duckEq.gain.setTargetAtTime(-9 * n * cur, tt, .03); R.chn.duckG.gain.setTargetAtTime(dB(-3 * n * cur), tt, .03);
  }, 30);
}
function unlive() {
  clearInterval(tm); an = null; routed = false; if (!R) return; const t = R.c.currentTime;
  R.byp.gain.setTargetAtTime(1, t, .02); R.cg.gain.setTargetAtTime(0, t, .02); R.chn.duckEq.gain.setTargetAtTime(0, t, .03); R.chn.duckG.gain.setTargetAtTime(1, t, .03);
}
const apply = () => { save(); if (R && PB && PB.hasSong) R.chn.set(S); refresh(); };
// V1.9.0: switch the beat into Web Audio mid-take when a control that needs it was just raised
function refresh() { try { if (!routed && on() && PB && PB.hasSong && !PB.guide && PB.src) live(PB.src.context, PB); } catch (e) {} }
let uiPut = null;

// ---------- "Match to my voice": measure take vs song, set the sliders ----------
const RATE = 16000, FR = 800;
async function bands(buf, off, sec) {
  const len = Math.floor(sec * RATE), o = new OfflineAudioContext(4, len, RATE), s = o.createBufferSource(); s.buffer = buf; s.loop = true; const m = o.createChannelMerger(4);
  const f = (t, hz) => { const n = o.createBiquadFilter(); n.type = t; n.frequency.value = hz; n.Q.value = .707; return n; };
  const lo = f('lowpass', 400), h1 = f('highpass', 1000), h2 = f('lowpass', 4000), hi = f('highpass', 5000);
  s.connect(lo); lo.connect(m, 0, 0); s.connect(h1); h1.connect(h2); h2.connect(m, 0, 1); s.connect(hi); hi.connect(m, 0, 2); s.connect(m, 0, 3); m.connect(o.destination);
  s.start(0, off % buf.duration); const r = await o.startRendering(), N = Math.floor(len / FR), out = [0, 1, 2, 3].map(() => new Float32Array(N));
  for (let c = 0; c < 4; c++) { const d = r.getChannelData(c); for (let i = 0; i < N; i++) { let q = 0; for (let j = i * FR; j < (i + 1) * FR; j++) q += d[j] * d[j]; out[c][i] = q / FR; } }
  return out;
}
async function match() {
  const r = recs.find(x => x.track != 'adlib' && x.bgId && songs.some(s => s.id == x.bgId));
  if (!r) { toast('Record a take over a song first'); return null; }
  const sg = songs.find(s => s.id == r.bgId), D = new OfflineAudioContext(1, 1, RATE), dec = async b => D.decodeAudioData(await b.arrayBuffer());
  const vb = await dec(r.blob), sb = await dec(sg.blob), sec = Math.min(90, vb.duration), sync = (window.RdLat ? RdLat.syncFor(r) : +$('sy').value) / 1000;
  const v = await bands(vb, 0, sec), b = await bands(sb, (r.bgOff || 0) - sync, sec), N = Math.min(v[0].length, b[0].length);
  const top = Math.max(...v[3].slice(0, N)), thr = Math.max(top * Math.pow(10, -2.8), 1e-7); let n = 0; const V = [0, 0, 0], B = [0, 0, 0];
  for (let i = 0; i < N; i++) if (v[3][i] > thr) { n++; for (let c = 0; c < 3; c++) { V[c] += v[c][i]; B[c] += b[c][i]; } }
  if (n < 10) { toast('Not enough voice in that take to measure'); return null; }
  const db = x => 10 * Math.log10(x / n + 1e-12), Vl = db(V[0]), Vm = db(V[1]), Vh = db(V[2]), Bl = db(B[0]), Bm = db(B[1]), Bh = db(B[2]);
  const dT = (Bh - Bl) - (Vh - Vl), gap = Vm - Bm, need = 5 - gap;            // want your voice ~5 dB above the beat in the voice band
  const pocket = need > 0 ? cl(need / 9 * 100, 0, 80) : 0, rest = need > 0 ? need - pocket * .09 : need;
  const o = { tone: cl(Math.round(-dT * 8), -80, 70), back: cl(Math.round(35 + cl((Bm - Bl) - (Vm - Vl), -10, 15) * 2), 20, 75), pocket: Math.round(pocket),
    width: 30, duck: n / N > .6 ? 60 : 45, low: 0, lvl: cl(Math.round(-rest * 2) / 2, -12, 3) };
  const say = (dT > 1.5 ? 'Beat is brighter than your voice, so it goes darker. ' : dT < -1.5 ? 'Beat is duller than your voice, so it goes lighter. ' : 'Tone already close. ') +
    (need > 1 ? 'Beat sits ' + need.toFixed(0) + ' dB too loud in the voice range, so I cut a pocket.' : need < -1 ? 'Beat is a bit quiet against you, so I lifted it.' : 'Level against your voice is about right.');
  return { o, say };
}

// ---------- UI (top of the Effects tab) ----------
function ui() {
  const fx = document.getElementById('p-fx'); if (!fx) return;
  const card = document.createElement('div'); card.className = 'card'; card.id = 'bfx';
  card.innerHTML = '<div class="ct"><span>Beat master</span><b style="color:var(--accent)">the song, not your voice</b></div>' +
    '<div class="cr" style="margin-bottom:12px"><span>Process the beat in playback + export</span><div class="sw" id="bfOn"></div></div>' +
    '<div class="chips" id="bfP">' + Object.keys(PRE).map(k => '<div class="chip" data-k="' + k + '">' + PRE[k].name + '</div>').join('') + '</div>' +
    '<div class="btnrow" style="margin-top:12px"><button class="btn" id="bfM">Match to my voice</button><button class="btn g" id="bfH">Hear it</button></div><p class="hint" id="bfS" style="margin-top:10px">Your voice stays centre: the beat gives up the middle and spreads out to the sides.</p>' +
    SL.map(([k, n, a, z]) => '<div class="row"><div class="lb"><span>' + n + '</span><b id="bv_' + k + '"></b></div><input type="range" id="bs_' + k + '" min="' + a + '" max="' + z + '" step="' + (k == 'lvl' ? .5 : 1) + '"></div>').join('') +
    '<p class="hint">Changes the song when a take plays and in exports. While you record, the song plays as normal so your timing does not move. Moves live while a take plays.</p>';
  fx.insertBefore(card, fx.firstChild);
  const $b = id => document.getElementById(id), paint = () => {
    $b('bfOn').classList.toggle('on', !!S.on);
    card.querySelectorAll('#bfP .chip').forEach(c => c.classList.toggle('on', c.dataset.k == S.pre));
    SL.forEach(([k]) => { $b('bs_' + k).value = S[k]; $b('bv_' + k).textContent = k == 'lvl' ? (S[k] > 0 ? '+' : '') + S[k] + ' dB' : S[k]; });
  };
  const put = o => { Object.assign(S, o); paint(); apply(); };
  uiPut = put;
  $b('bfOn').onclick = () => { S.on = S.on ? 0 : 1; paint(); apply(); toast(S.on ? 'Beat master on' : 'Beat master off'); };
  card.querySelectorAll('#bfP .chip').forEach(c => c.onclick = () => { const p = PRE[c.dataset.k]; const o = Object.assign({}, p); delete o.name; o.pre = c.dataset.k; if (c.dataset.k != 'flat') o.on = 1; put(o); });
  SL.forEach(([k]) => $b('bs_' + k).oninput = e => put({ [k]: +e.target.value, pre: 'custom' }));
  $b('bfH').onclick = () => { if (PB) { toast('Tap ■ to stop, then Hear it again'); return; } const r = recs.find(x => x.track != 'adlib' && x.bgId && songs.some(s => s.id == x.bgId)); if (!r) { toast('Record a take over a song first'); return; } if (!S.on) put({ on: 1 }); playR(r.id); };
  $b('bfM').onclick = async () => {
    const b = $b('bfM'); b.disabled = true; b.textContent = 'Listening…'; $b('bfS').textContent = 'Measuring your take against the song…';
    try { const m = await match(); if (m) { m.o.on = 1; m.o.pre = 'match'; put(m.o); $b('bfS').textContent = m.say + ' Press Hear it, then fine-tune.'; } else $b('bfS').textContent = 'Your voice stays centre: the beat gives up the middle and spreads out to the sides.'; }
    catch (e) { $b('bfS').textContent = 'Could not measure that take.'; }
    b.disabled = false; b.textContent = 'Match to my voice';
  };
  paint();
}
ui();
window.RdBeat = { build, live, unlive, on, state: S, PRE, match, refresh, analyser: () => (R && routed && R.chn.analyser) || null, put: o => { if (uiPut) uiPut(o); else { Object.assign(S, o); apply(); } } };
})();
