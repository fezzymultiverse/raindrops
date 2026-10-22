// Raindrops V1.6.0 (+ 3 reverbs: Plate / Cathedral / Halo, vocal presets, Off, Adapt to song) / V1.5.0 (+ 4-band voice EQ, Voice focus layer) / V1.4.0 (+ Saturation, Lo-fi radio, Chorus) - Mixer tab + track 2 (ad-libs) + double voice (lean chain: only active stages are wired): one effects chain used live (playback) and for export (OfflineAudioContext)
// Order: input gain > gate + de-esser > autotune > low cut > EQ enhancer > exciter > compressor
//        > (echo, reverb) > louder + limiter > output volume. Every control is a slider and changes live.
(() => {
const DEF = { in: 100, out: 100, gate: 0, ds: 0, lc: 0, enh: 0, voc: 0, cp: 0, ld: 0, tn: 0, tna: 100, tns: 20, tnh: 0, tnm: 4095, key: 0, scale: 'chrom', ec: 0, et: 280, ef: 35, rv: 0, rs: 40, byp: 0, loop: 0, dbl: 0, dbs: 24, sat: 0, lof: 0, cho: 0, adb: 0, av: 100, ap: 0, asy: 0, ad: 1, qb: 0, ql: 0, qm: 0, qh: 0, vl: 0, rvp: 0, rvh: 0, rva: 0, pre: '', adapt: 1 };
const S = Object.assign({}, DEF, LS.get('rd_mx', {}));
const save = () => LS.set('rd_mx', S);
const chains = new Set();
const wkCache = new WeakMap();
let wkWarned = false;

const loadWk = c => {
  if (!c.audioWorklet) return Promise.resolve(false);
  if (!wkCache.has(c)) wkCache.set(c, c.audioWorklet.addModule('rd-worklets.js').then(() => true).catch(() => false));
  return wkCache.get(c);
};
const dB = x => Math.pow(10, x / 20);
const gateDb = () => (S.gate < 1 ? -80 : -72 + S.gate * 0.47);

function makeIR(c, size) {
  const sec = 0.4 + size * 0.03, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += 0.35 * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * 2.2 * Math.pow(1 - i / n, 2.6);
    }
  }
  return b;
}
// V1.6.0: three different reverb rooms, all generated (no files). Each is its own ConvolverNode, only wired in when its mix is above 0.
// Plate: short, dense and bright. Cathedral: long, dark, huge. Halo: soft bloom that swells in, with a pre-delay and a bright airy tail.
function makeIRx(c, kind) {
  const sr = c.sampleRate;
  const P = { plate: { sec: 1.7, k: 2.2, lp: 0.9, hp: 0.55, att: 0, pd: 0 }, hall: { sec: 4.6, k: 2.0, lp: 0.16, hp: 0, att: 0.03, pd: 0.035 }, halo: { sec: 3.0, k: 2.6, lp: 0.75, hp: 0.7, att: 0.22, pd: 0.06 } }[kind];
  const n = Math.floor(sr * P.sec), b = c.createBuffer(2, n, sr), pd = Math.floor(sr * P.pd), att = Math.max(1, Math.floor(sr * P.att));
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0, prev = 0, seed = 1234567 + ch * 7919 + kind.length * 31;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    for (let i = pd; i < n; i++) {
      const t = (i - pd) / (n - pd), x = rnd();
      lp += P.lp * (x - lp);
      let y = lp - P.hp * prev; prev = lp;
      let env = Math.exp(-P.k * 2.3 * t);
      if (P.att) env *= Math.min(1, (i - pd) / att);
      d[i] = y * env * 2 * (t > 0.95 ? (1 - t) / 0.05 : 1);
    }
    if (kind === 'plate') { for (let e = 0; e < 6; e++) { const at = Math.floor(sr * (0.004 + e * 0.0053 + ch * 0.0017)); if (at < n) d[at] += (e % 2 ? -1 : 1) * 0.5 / (1 + e * 0.4); } }
    if (kind === 'hall') { for (let e = 0; e < 5; e++) { const at = Math.floor(sr * (0.045 + e * 0.019 + ch * 0.007)); if (at < n) d[at] += 0.4 / (1 + e * 0.5); } }
  }
  return b;
}
function exciterCurve() {
  const n = 1024, a = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; a[i] = Math.tanh(3 * x); }
  return a;
}

async function build(c, bo) {
  const tk = (bo && bo.tk) || 'main', dK = tk == 'adlib' ? 'adb' : 'dbl';
  // V1.2.1: LEAN chain. Only the stages that are switched on are wired in.
  // Everything at default (dry) = plain input > output, same as V1.1.0, so recording
  // while a song plays and playing it back stays smooth on weak phones.
  const live = !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext);
  const bq = (t, f, Q, g) => { const n = c.createBiquadFilter(); n.type = t; n.frequency.value = f; if (Q) n.Q.value = Q; if (g) n.gain.value = g; return n; };
  const G = () => c.createGain();
  const inp = G(), out = G(), inG = G();
  inG.channelCount = 1; inG.channelCountMode = 'explicit';
  const wopt = o => ({ numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1], processorOptions: o });
  let wk = null, wkTried = false, dyn = null, tune = null;
  const act = () => ({
    byp: !!S.byp || isDry(),
    dyn: S.gate > 0 || S.ds > 0,
    tune: !!S.tn,
    eq: S.lc > 0 || S.enh > 0 || S.voc > 0,
    ex: S.voc > 0,
    cp: S.cp > 0,
    db: S[dK] > 0,
    sat: S.sat > 0, lof: S.lof > 0, cho: S.cho > 0,
    q4: !!(S.qb || S.ql || S.qm || S.qh), vl: S.vl > 0,
    ec: S.ec > 0,
    rv: S.rv > 0,
    rvp: S.rvp > 0, rvh: S.rvh > 0, rva: S.rva > 0
  });
  const needWk = a => !a.byp && (a.dyn || a.tune);
  const loadOnce = async () => {
    wkTried = true;
    wk = await loadWk(c);
    if (!wk && !wkWarned) { wkWarned = true; try { toast('Gate, de-esser and autotune need Android WebView audio worklets — skipped here'); } catch (e) {} }
  };
  if (needWk(act())) await loadOnce();

  const hp = bq('highpass', 20, 0.7), warm = bq('lowshelf', 180), mud = bq('peaking', 280, 1), pres = bq('peaking', 3200, 0.9), air = bq('highshelf', 10000);
  const eqOut = G(), exHp = bq('highpass', 3500, 0.7), ws = c.createWaveShaper(), exG = G();
  ws.curve = exciterCurve(); ws.oversample = '2x';
  const cp = c.createDynamicsCompressor(), mk = G(), mix = G();
  cp.knee.value = 10; cp.attack.value = 0.005; cp.release.value = 0.12;
  const dl = c.createDelay(1.5), fbLp = bq('lowpass', 3500, 0.7), fbG = G(), ecG = G();
  const pre = c.createDelay(0.2), cv = c.createConvolver(), rvG = G();
  pre.delayTime.value = 0.02;
  const preP = c.createDelay(0.2), cvP = c.createConvolver(), gP = G(), preH = c.createDelay(0.2), cvH = c.createConvolver(), gH = G(), preA = c.createDelay(0.2), cvA = c.createConvolver(), gA = G();
  preP.delayTime.value = 0.008; preH.delayTime.value = 0.03; preA.delayTime.value = 0.045;
  const ld = G(), lim = c.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  // V1.3.0 double voice: two short delayed copies (slow LFO = tiny detune), panned wide, added to the dry voice
  const dbOut = G(), dbG = G(), dlA = c.createDelay(0.1), dlB = c.createDelay(0.1);
  const mkPan = p => { if (!c.createStereoPanner) return G(); const n = c.createStereoPanner(); n.pan.value = p; return n; };
  const pnA = mkPan(-0.85), pnB = mkPan(0.85);
  // V1.5.0: 4-band voice EQ (Bass / Low-mid / Mid / High) and Voice focus layer (a second, band-limited copy of the voice that sits in front of the song)
  const qB = bq('lowshelf', 200), qL = bq('peaking', 500, 1), qM = bq('peaking', 2000, 0.9), qH = bq('highshelf', 6000);
  const vlSum = G(), vlHp = bq('highpass', 220, 0.7), vlHp2 = bq('highpass', 220, 0.7), vlPk = bq('peaking', 3000, 0.9, 4), vlLp = bq('lowpass', 7500, 0.7), vlCp = c.createDynamicsCompressor(), vlG = G();
  vlCp.threshold.value = -30; vlCp.knee.value = 12; vlCp.ratio.value = 4; vlCp.attack.value = 0.004; vlCp.release.value = 0.12;
  // V1.4.0 vocal FX (parallel wet/dry, only wired in when above 0): Saturation, Lo-fi radio, Chorus
  const sCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) sCurve[i] = Math.tanh((i / 511.5 - 1) * 1.6);
  const saDry = G(), saPre = G(), saWs = c.createWaveShaper(), saWet = G(), saSum = G(); saWs.curve = sCurve; saWs.oversample = '2x';
  const loDry = G(), loHp = bq('highpass', 450, 0.8), loLp = bq('lowpass', 3200, 0.8), loPk = bq('peaking', 1600, 1, 5), loWet = G(), loSum = G();
  const chDry = G(), chWet = G(), chSum = G(), chD = [0.018, 0.026, 0.034].map(x => { const d = c.createDelay(0.1); d.delayTime.value = x; return d; });
  const chP = [mkPan(-0.8), mkPan(0), mkPan(0.8)];
  let chL = [];
  let lfoA = null, lfoB = null;
  const inner = [saDry, saPre, saWs, saWet, saSum, loDry, loHp, loLp, loPk, loWet, loSum, chDry, chWet, chSum, ...chD, ...chP, inp, inG, hp, warm, mud, pres, air, eqOut, exHp, ws, exG, cp, mk, mix, dl, fbLp, fbG, ecG, pre, cv, rvG, preP, cvP, gP, preH, cvH, gH, preA, cvA, gA, ld, lim, dbOut, dbG, dlA, dlB, pnA, pnB, qB, qL, qM, qH, vlSum, vlHp, vlHp2, vlPk, vlLp, vlCp, vlG];

  let sig = '';
  const wire = () => {
    const a = act();
    if (wk && !dyn && a.dyn && !a.byp) { try { dyn = new AudioWorkletNode(c, 'rd-dyn', wopt({ gate: gateDb(), ds: S.ds })); } catch (e) { dyn = null; } }
    if (wk && !tune && a.tune && !a.byp) { try { tune = new AudioWorkletNode(c, 'rd-tune', wopt({ on: S.tn, amt: S.tna, spd: S.tns, key: S.key, scale: S.scale, hold: S.tnh, mask: S.tnm })); } catch (e) { tune = null; } }
    const useDyn = !!(a.dyn && dyn), useTune = !!(a.tune && tune);
    if (a.db && !a.byp && !lfoA) {
      const mkL = (f, d, dly) => { const osc = c.createOscillator(), og = G(); osc.frequency.value = f; og.gain.value = d; osc.connect(og); og.connect(dly.delayTime); osc.start(); return osc; };
      lfoA = mkL(0.37, 0.0011, dlA); lfoB = mkL(0.53, 0.0013, dlB);
    }
    if (a.cho && !a.byp && !chL.length) {
      [[0.6, 0.004], [0.8, 0.005], [0.45, 0.006]].forEach(([f, d], i) => { const o = c.createOscillator(), og = G(); o.frequency.value = f; og.gain.value = d; o.connect(og); og.connect(chD[i].delayTime); o.start(); chL.push(o); });
    }
    const s = [a.byp, useDyn, useTune, a.eq, a.ex, a.cp, a.db, a.ec, a.rv, a.rvp, a.rvh, a.rva, a.sat, a.lof, a.cho, a.q4, a.vl].map(x => x ? 1 : 0).join('');
    if (s === sig) return;
    sig = s;
    inner.forEach(n => { try { n.disconnect(); } catch (e) {} });
    [dyn, tune].forEach(n => { if (n) try { n.disconnect(); } catch (e) {} });
    if (a.byp) { inp.connect(out); return; }
    inp.connect(inG);
    let t = inG;
    if (useDyn) { t.connect(dyn); t = dyn; }
    if (useTune) { t.connect(tune); t = tune; }
    if (a.q4) { t.connect(qB); qB.connect(qL); qL.connect(qM); qM.connect(qH); t = qH; }
    if (a.eq) {
      t.connect(hp); hp.connect(warm); warm.connect(mud); mud.connect(pres); pres.connect(air); air.connect(eqOut);
      if (a.ex) { air.connect(exHp); exHp.connect(ws); ws.connect(exG); exG.connect(eqOut); }
      t = eqOut;
    }
    if (a.cp) { t.connect(cp); cp.connect(mk); t = mk; }
    if (a.sat) { t.connect(saDry); saDry.connect(saSum); t.connect(saPre); saPre.connect(saWs); saWs.connect(saWet); saWet.connect(saSum); t = saSum; }
    if (a.lof) { t.connect(loDry); loDry.connect(loSum); t.connect(loHp); loHp.connect(loLp); loLp.connect(loPk); loPk.connect(loWet); loWet.connect(loSum); t = loSum; }
    if (a.cho) { t.connect(chDry); chDry.connect(chSum); chD.forEach((d, i) => { t.connect(d); d.connect(chP[i]); chP[i].connect(chWet); }); chWet.connect(chSum); t = chSum; }
    if (a.db) { t.connect(dbOut); t.connect(dlA); dlA.connect(pnA); pnA.connect(dbG); t.connect(dlB); dlB.connect(pnB); pnB.connect(dbG); dbG.connect(dbOut); t = dbOut; }
    if (a.vl) { t.connect(vlSum); t.connect(vlHp); vlHp.connect(vlHp2); vlHp2.connect(vlPk); vlPk.connect(vlLp); vlLp.connect(vlCp); vlCp.connect(vlG); vlG.connect(vlSum); t = vlSum; }
    if (a.ec || a.rv || a.rvp || a.rvh || a.rva) {
      t.connect(mix);
      if (a.ec) { t.connect(dl); dl.connect(fbLp); fbLp.connect(fbG); fbG.connect(dl); fbLp.connect(ecG); ecG.connect(mix); }
      if (a.rv) { t.connect(pre); pre.connect(cv); cv.connect(rvG); rvG.connect(mix); }
      if (a.rvp) { t.connect(preP); preP.connect(cvP); cvP.connect(gP); gP.connect(mix); }
      if (a.rvh) { t.connect(preH); preH.connect(cvH); cvH.connect(gH); gH.connect(mix); }
      if (a.rva) { t.connect(preA); preA.connect(cvA); cvA.connect(gA); gA.connect(mix); }
      t = mix;
    }
    t.connect(ld); ld.connect(lim); lim.connect(out);
  };

  let irSize = -1, first = true, irT = 0;
  const sv = (p, v) => { if (first) p.value = v; else p.setTargetAtTime(v, c.currentTime, 0.03); };
  const set = () => {
    const a = act();
    if (!wkTried && needWk(a)) loadOnce().then(() => { try { set(); } catch (e) {} });
    wire();
    sv(inG.gain, S.in / 100); sv(out.gain, S.out / 100);
    sv(hp.frequency, 20 + S.lc * 1.8);
    sv(warm.gain, S.voc * 0.08); sv(mud.gain, -S.enh * 0.05); sv(pres.gain, S.enh * 0.07); sv(air.gain, S.enh * 0.06);
    sv(exG.gain, S.voc / 100 * 0.35);
    sv(cp.threshold, -10 - S.cp * 0.32); sv(cp.ratio, 2 + S.cp * 0.1); sv(mk.gain, dB(S.cp * 0.09));
    sv(dl.delayTime, S.et / 1000); sv(fbG.gain, S.ef / 100 * 0.85); sv(ecG.gain, S.ec / 100 * 0.9);
    sv(rvG.gain, S.rv / 100 * 1.1);
    sv(gP.gain, S.rvp / 100 * 3.6); sv(gH.gain, S.rvh / 100 * 0.45); sv(gA.gain, S.rva / 100 * 2.2);   // levels matched to the old Reverb mix (tail about 8 dB under the voice at 100%)
    if (a.rvp && !cvP.buffer) cvP.buffer = makeIRx(c, 'plate');
    if (a.rvh && !cvH.buffer) cvH.buffer = makeIRx(c, 'hall');
    if (a.rva && !cvA.buffer) cvA.buffer = makeIRx(c, 'halo');
    sv(dbG.gain, S[dK] / 100 * 0.85); sv(dlA.delayTime, S.dbs / 1000); sv(dlB.delayTime, S.dbs * 1.45 / 1000);
    if (a.rv && irSize !== S.rs) {
      const need = irSize < 0 || !cv.buffer;
      irSize = S.rs;
      if (first || need) cv.buffer = makeIR(c, S.rs);
      else { clearTimeout(irT); irT = setTimeout(() => { try { cv.buffer = makeIR(c, irSize); } catch (e) {} }, 220); }
    }
    { const q = S.sat / 100; sv(saPre.gain, 1 + q * 6); sv(saDry.gain, 1 - q * 0.6); sv(saWet.gain, q * 0.8 / (1 + q * 1.5)); }
    { const q = S.lof / 100; sv(loDry.gain, 1 - q); sv(loWet.gain, q * 1.7); }
    { const q = S.cho / 100; sv(chDry.gain, 1); sv(chWet.gain, q * 0.55); }
    sv(qB.gain, S.qb); sv(qL.gain, S.ql); sv(qM.gain, S.qm); sv(qH.gain, S.qh);
    sv(vlG.gain, S.vl / 100 * 0.3);
    sv(ld.gain, dB(S.ld * 0.12));
    if (dyn) dyn.port.postMessage({ gate: gateDb(), ds: S.ds });
    if (tune) tune.port.postMessage({ on: S.tn, amt: S.tna, spd: S.tns, key: S.key, scale: S.scale, hold: S.tnh, mask: S.tnm });
    first = false;
  };
  set();
  const ch = { input: inp, output: out, set, stop: () => { chains.delete(ch); clearTimeout(irT); [lfoA, lfoB, ...chL].forEach(n => { try { n && n.stop(); } catch (e) {} }); try { inner.forEach(n => n.disconnect()); [dyn, tune].forEach(n => n && n.disconnect()); out.disconnect(); } catch (e) {} } };
  if (live) chains.add(ch);
  return ch;
}

const isDry = () => S.in == 100 && S.out == 100 && !S.gate && !S.ds && !S.lc && !S.enh && !S.voc && !S.cp && !S.ld && !S.tn && !S.ec && !S.rv && !S.dbl && !S.adb && !S.sat && !S.lof && !S.cho && !S.qb && !S.ql && !S.qm && !S.qh && !S.vl && !S.rvp && !S.rvh && !S.rva;
const tailSec = () => (S.rvh > 0 ? 5.0 : S.rva > 0 ? 3.2 : S.rv > 0 || S.ec > 0 ? 3.5 : S.rvp > 0 ? 1.8 : 0.4) + (S.tn ? 0.1 : 0);
const put = (k, v) => { S[k] = v; save(); chains.forEach(c => c.set()); if (k == 'av' || k == 'ap') { try { window.adLive && adLive(); } catch (e) {} } };

// ---------- UI ----------
const GR = [
  ['Levels', [['in', 'Input gain (voice into effects)', '%', 0, 200, 1], ['out', 'Voice output volume', '%', 0, 200, 1], ['sg', 'Song volume', '%', 0, 100, 1], ['sy', 'Voice sync (ms)', '', -300, 300, 10]]],
  ['Clean', [['gate', 'Noise gate', '%', 0, 100, 1], ['ds', 'De-esser (harsh S and T)', '%', 0, 100, 1], ['lc', 'Low cut (rumble)', '%', 0, 100, 1]]],
  ['Voice', [['enh', 'Voice enhancer (clarity)', '%', 0, 100, 1], ['voc', 'Vocalise (body + air)', '%', 0, 100, 1], ['cp', 'Compression (punch)', '%', 0, 100, 1], ['ld', 'Louder', '%', 0, 100, 1]]],
  ['Autotune', [['tna', 'Strength', '%', 0, 100, 1], ['tns', 'Retune speed (0 = hard, 100 = natural)', '', 0, 100, 1], ['tnh', 'Hold the note (hard-tune lock, steps between notes)', '%', 0, 100, 1]]],
  ['HD Echo', [['ec', 'Echo mix', '%', 0, 100, 1], ['et', 'Echo time', ' ms', 60, 800, 10], ['ef', 'Echo repeats', '%', 0, 85, 1]]],
  ['Reverb', [['rv', 'Reverb mix', '%', 0, 100, 1], ['rs', 'Room size', '%', 0, 100, 1]]],
  ['Reverb rooms (V1.6.0)', [['rvp', 'Plate (bright, tight)', '%', 0, 100, 1], ['rvh', 'Cathedral (huge, dark)', '%', 0, 100, 1], ['rva', 'Halo (soft bloom, airy)', '%', 0, 100, 1]]],
  ['Vocal FX', [['sat', 'Saturation (warmth + grit)', '%', 0, 100, 1], ['lof', 'Lo-fi radio (telephone voice)', '%', 0, 100, 1], ['cho', 'Chorus (thick stereo)', '%', 0, 100, 1]]]
];
const sliderHtml = s => `<div class="row"><div class="lb"><span>${s[1]}</span><b id="mv-${s[0]}"></b></div><input type="range" id="m-${s[0]}" min="${s[3]}" max="${s[4]}" step="${s[5]}"></div>`;
const AD = [['av', 'Ad-lib volume', '%', 0, 200, 1], ['ap', 'Ad-lib pan (-100 left, +100 right)', '', -100, 100, 1], ['asy', 'Ad-lib timing fix (raise if ad-libs sound late)', ' ms', 0, 500, 10], ['adb', 'Ad-lib double voice', '%', 0, 100, 1]];
const EQ4 = [['qb', 'Bass (60-250 Hz)', ' dB', -12, 12, 1], ['ql', 'Low-mid (250-800 Hz)', ' dB', -12, 12, 1], ['qm', 'Mid (0.8-3 kHz)', ' dB', -12, 12, 1], ['qh', 'High (3-10 kHz)', ' dB', -12, 12, 1]];
const VL = [['vl', 'Voice focus layer (second voice)', '%', 0, 200, 1]];
const DB = [['dbl', 'Double voice on main track', '%', 0, 100, 1], ['dbs', 'Double spread', ' ms', 10, 60, 1]];
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PRE = {
  flat: { name: 'Flat', v: {} },
  clean: { name: 'Clean', v: { gate: 20, ds: 30, lc: 20, enh: 40, voc: 20, cp: 45, ld: 20 } },
  radio: { name: 'Radio clear', v: { gate: 25, ds: 40, lc: 25, enh: 70, voc: 30, cp: 60, ld: 40 } },
  juice: { name: 'Juice 999', v: { gate: 15, ds: 35, lc: 20, enh: 55, voc: 45, cp: 60, ld: 45, ec: 18, et: 320, ef: 38, rv: 22, rs: 55, tn: 1, tna: 55, tns: 35 } },
  lofi: { name: 'Lo-fi radio', v: { lc: 30, enh: 20, cp: 50, ld: 25, lof: 85, sat: 25 } },
  polished: { name: 'Polished', v: { gate: 10, ds: 35, lc: 25, enh: 45, voc: 35, cp: 55, ld: 35, sat: 15 } },
  clear: { name: 'Clear', v: { gate: 20, ds: 30, lc: 30, enh: 75, voc: 20, cp: 50, ld: 30 } },
  rumble: { name: 'Rumble + spit clean', v: { gate: 35, ds: 70, lc: 60, enh: 25, cp: 40, ld: 20 } },
  hardlim: { name: 'Hard limit', v: { lc: 20, ds: 35, enh: 35, cp: 80, ld: 90 } },
  trap: { name: 'Wet trap', v: { ds: 40, lc: 20, enh: 60, voc: 40, cp: 65, ld: 50, ec: 30, et: 375, ef: 45, rv: 35, rs: 70, tn: 1, tna: 100, tns: 5 } }
};

$('p-mixer').innerHTML =
`<div class="card"><div class="ct"><span>Mixer</span><b id="mxT" style="color:var(--accent)"></b></div>
<select id="mxTake" class="mxsel"></select>
<div class="meter"><i id="mxM"></i></div>
<div class="ctl" style="margin:14px 0"><button class="sub" id="mxPlay">▶</button><button class="sub" id="mxStop">■</button></div>
<div class="cr" style="margin-bottom:12px"><span>Play with its backing track</span><div class="sw" id="mxTk"></div></div>
<div class="cr" style="margin-bottom:12px"><span>Loop</span><div class="sw" id="mxLoop"></div></div>
<div class="cr"><span>Effects ON (off = hear the raw take)</span><div class="sw" id="mxFx"></div></div>
<p class="hint">Play a take, then move any slider: you hear it change while it plays. Recording is always raw; effects are applied on playback and export.</p></div>
<div class="card"><div class="ct"><span>Presets</span><b id="mxPreSt" style="color:var(--accent)"></b></div><div class="chips" id="mxPre"></div>
<div class="cr" style="margin:12px 0 10px"><span>Adapt preset to the song</span><div class="sw on" id="mxAdp"></div></div>
<button class="btn g" id="mxAdaptNow">Adapt to song now</button>
<p class="hint">Off = hear the raw take (your settings are kept, tap a preset to turn effects back on). With Adapt on, picking a preset also measures your voice against the backing song and sets Voice EQ and Voice focus to fit it (rough rule of thumb, trust your ears). Needs a take with a backing song.</p></div>
<div class="card"><div class="ct"><span>Ad-libs track (track 2)</span></div>
<select id="mxAd" class="mxsel"></select>
<div class="cr" style="margin-bottom:14px"><span>Ad-libs ON</span><div class="sw" id="mxAdOn"></div></div>
${AD.map(sliderHtml).join('')}
<p class="hint">Track 2 plays together with the main take above. Record it in the Record tab: pick 2 · Ad-libs. Volume and pan move live; timing fix and the take choice apply on the next play.</p></div>
<div class="card"><div class="ct">Double voice</div>${DB.map(sliderHtml).join('')}
<p class="hint">Adds a wide, slightly detuned second copy of the voice. Ad-libs have their own double slider above.</p></div>
<div class="card"><div class="ct">Voice focus (second voice)</div>${VL.map(sliderHtml).join('')}
<p class="hint">A second copy of only your voice range (no deep bass, no hiss), squeezed so it stays steady, added on top of your voice. Raise it when the song swallows your words. The song is never touched, so this only lifts the voice. Plays and exports.</p></div>
<div class="card" id="eq4card"><div class="ct">Voice EQ (Bass / Low-mid / Mid / High)</div>${EQ4.map(sliderHtml).join('')}
<button class="btn g" id="eq4Reset">Reset EQ</button><p class="hint">Use the Voice analyzer below to see which band needs a boost, then move it here. You hear changes live.</p></div>`
+ GR.slice(0, 3).map(g => `<div class="card"><div class="ct">${g[0]}</div>${g[1].map(sliderHtml).join('')}</div>`).join('')
+ `<div class="card"><div class="ct">Autotune</div><div class="cr" style="margin-bottom:14px"><span>Autotune ON</span><div class="sw" id="mxTn"></div></div>${GR[3][1].map(sliderHtml).join('')}
<div class="ct" style="margin-top:6px">Hard-tune styles</div><div class="chips" id="mxTnP"></div>
<div class="ct" style="margin-top:12px">Key</div><div class="chips" id="mxKey"></div><div class="ct" style="margin-top:12px">Scale</div><div class="chips" id="mxScale"></div>
<div id="mxNotesW" class="hidden"><div class="ct" style="margin-top:12px">Allowed notes (Custom scale)</div><div class="chips" id="mxNotes"></div></div>
<p class="hint">Hard tune: Strength 100, Retune speed 0, Hold 40 to 100, pick a key and a scale (Minor pent. and Blues suit trap). Plays and exports; recording stays raw so your timing never moves. Moves up to 6 semitones to reach a note.</p></div>`
+ GR.slice(4).map(g => `<div class="card"><div class="ct">${g[0]}</div>${g[1].map(sliderHtml).join('')}</div>`).join('');

const sliders = GR.flatMap(g => g[1]).concat(AD, DB, VL, EQ4);
const link = { sg: () => $('bgVol'), sy: () => $('sy') };
function showVal(s) { const v = $('m-' + s[0]).value; $('mv-' + s[0]).textContent = v + s[2]; }
sliders.forEach(s => {
  const el = $('m-' + s[0]);
  el.oninput = () => {
    showVal(s);
    if (link[s[0]]) { const t = link[s[0]](); t.value = el.value; t.oninput(); }
    else { if (!/^(q[blmh]|vl|in|out|dbl|dbs|sg|sy)$/.test(s[0]) && S.pre) { S.pre = ''; } put(s[0], +el.value); syncPre(); }
  };
});
const swSet = (id, on) => $(id).classList.toggle('on', !!on);
function syncUI() {
  sliders.forEach(s => { $('m-' + s[0]).value = link[s[0]] ? link[s[0]]().value : S[s[0]]; showVal(s); });
  swSet('mxTn', S.tn); swSet('mxAdOn', S.ad); swSet('mxLoop', S.loop); swSet('mxFx', !S.byp); swSet('mxTk', $('swTk').classList.contains('on'));
  $('mxKey').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.v == S.key));
  $('mxScale').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.v == S.scale));
  swSet('mxAdp', S.adapt); syncPre();
  $('mxNotesW').classList.toggle('hidden', S.scale != 'custom');
  $('mxNotes').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', !!((S.tnm >> +c.dataset.v) & 1)));
}
$('mxTn').onclick = () => { put('tn', S.tn ? 0 : 1); syncUI(); };
$('mxLoop').onclick = () => { put('loop', S.loop ? 0 : 1); syncUI(); };
$('mxAdOn').onclick = () => { put('ad', S.ad ? 0 : 1); syncUI(); };
$('mxFx').onclick = () => { put('byp', S.byp ? 0 : 1); syncUI(); };
$('mxTk').onclick = () => { $('swTk').click(); syncUI(); };
$('mxKey').innerHTML = NOTES.map((n, i) => `<div class="chip" data-v="${i}">${n}</div>`).join('');
$('mxKey').querySelectorAll('.chip').forEach(c => c.onclick = () => { put('key', +c.dataset.v); syncUI(); });
$('mxScale').innerHTML = [['chrom', 'Chromatic'], ['major', 'Major'], ['minor', 'Minor'], ['pmin', 'Minor pent.'], ['pmaj', 'Major pent.'], ['blues', 'Blues'], ['hmin', 'Harm. minor'], ['dor', 'Dorian'], ['phryg', 'Phrygian'], ['custom', 'Custom']].map(([v, l]) => `<div class="chip" data-v="${v}">${l}</div>`).join('');
$('mxScale').querySelectorAll('.chip').forEach(c => c.onclick = () => { put('scale', c.dataset.v); syncUI(); });
$('mxNotes').innerHTML = NOTES.map((n, i) => `<div class="chip" data-v="${i}">${n}</div>`).join('');
$('mxNotes').querySelectorAll('.chip').forEach(c => c.onclick = () => { let m = S.tnm ^ (1 << +c.dataset.v); if (!(m & 4095)) m = S.tnm; put('tnm', m & 4095); syncUI(); });
const TNP = {
  tpain: { n: 'T-Pain lock', v: { tn: 1, tna: 100, tns: 0, tnh: 70 } },
  travis: { n: 'Travis (tune + space)', v: { tn: 1, tna: 100, tns: 8, tnh: 40, ec: 22, et: 340, ef: 40, rv: 30, rs: 70, dbl: 35 } },
  natural: { n: 'Natural', v: { tn: 1, tna: 70, tns: 55, tnh: 0 } },
  soft: { n: 'Soft fix', v: { tn: 1, tna: 45, tns: 80, tnh: 0 } },
  off: { n: 'Tune off', v: { tn: 0 } }
};
$('mxTnP').innerHTML = Object.entries(TNP).map(([k, p]) => `<div class="chip" data-v="${k}">${p.n}</div>`).join('');
$('mxTnP').querySelectorAll('.chip').forEach(c => c.onclick = () => { const p = TNP[c.dataset.v]; Object.assign(S, p.v, { pre: '' }); save(); chains.forEach(x => x.set()); syncUI(); toast(p.n); });
$('mxPre').innerHTML = '<div class="chip" data-v="off">Off</div>' + Object.entries(PRE).map(([k, p]) => `<div class="chip" data-v="${k}">${p.name}</div>`).join('');
function syncPre() {
  const cur = S.byp ? 'off' : S.pre;
  $('mxPre').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', !!cur && x.dataset.v == cur));
  const n = S.byp ? 'Effects off' : (S.pre && PRE[S.pre] ? PRE[S.pre].name : '');
  const st = $('mxPreSt'); if (st) st.textContent = n;
}
// Adapt to song: measure voice vs the take's backing song (RdEars.analyze, offline), then set the 4 EQ bands + Voice focus.
let adapting = false;
async function adaptToSong(silent) {
  if (adapting) return false;
  const id = pickId(), r = id && recs.find(x => x.id == id);
  if (!r) { if (!silent) toast('Record a take first'); return false; }
  if (!r.bgId || !songs.some(x => x.id == r.bgId)) { if (!silent) toast('This take has no backing song to adapt to'); return false; }
  if (!window.RdEars) { if (!silent) toast('Analyzer not loaded'); return false; }
  adapting = true; const b = $('mxAdaptNow'); b.disabled = true; b.textContent = 'Adapting…';
  try {
    const a = await RdEars.analyze(r);
    if (!a.song) throw new Error('Song could not be decoded');
    const get = k => a.bands.find(x => x.k == k) || { boost: 0, need: 0 };
    ['qb', 'ql', 'qm', 'qh'].forEach(k => { S[k] = Math.max(-12, Math.min(12, get(k).boost || 0)); });
    const nm = get('qm').need || 0;
    S.vl = nm >= 2 ? Math.min(120, Math.round(20 + nm * 8)) : 0;
    save(); chains.forEach(x => x.set()); syncUI();
    toast('Adapted to ' + (a.songName || 'the song') + ': EQ ' + ['qb', 'ql', 'qm', 'qh'].map(k => (S[k] > 0 ? '+' : '') + S[k]).join(' / ') + ' dB, focus ' + S.vl + '%');
    return true;
  } catch (e) { toast('Adapt failed: ' + ((e && e.message) || e).toString().slice(0, 90)); return false; }
  finally { adapting = false; b.disabled = false; b.textContent = 'Adapt to song now'; }
}
$('mxAdaptNow').onclick = () => { adaptToSong(false); };
$('mxAdp').onclick = () => { S.adapt = S.adapt ? 0 : 1; save(); syncUI(); };
$('mxPre').querySelectorAll('.chip').forEach(c => c.onclick = () => {
  if (c.dataset.v == 'off') { S.byp = 1; S.pre = ''; save(); chains.forEach(x => x.set()); syncUI(); toast('Effects off - raw take'); return; }
  const p = PRE[c.dataset.v], keep = { in: S.in, out: S.out, key: S.key, scale: S.scale, adapt: S.adapt, tnm: S.tnm, loop: S.loop, dbl: S.dbl, dbs: S.dbs, adb: S.adb, av: S.av, ap: S.ap, asy: S.asy, ad: S.ad, qb: S.qb, ql: S.ql, qm: S.qm, qh: S.qh, vl: S.vl };
  Object.assign(S, DEF, keep, p.v, { byp: 0, pre: c.dataset.v }); save(); chains.forEach(x => x.set()); syncUI();
  toast(p.name);
  if (S.adapt) adaptToSong(true);
});
$('eq4Reset').onclick = () => { ['qb', 'ql', 'qm', 'qh'].forEach(k => { S[k] = 0; }); save(); chains.forEach(c => c.set()); syncUI(); };
document.querySelector('.tab[data-p=mixer]').addEventListener('click', syncUI);

// ---------- take picker + transport ----------
const isMain = r => r.track != 'adlib' || !r.baseId || !recs.some(x => x.id == r.baseId);
function refresh() {
  const sel = $('mxTake'), keep = sel.value, mains = recs.filter(isMain), ads = recs.filter(r => r.track == 'adlib');
  sel.innerHTML = mains.map(r => `<option value="${r.id}">${r.track == 'adlib' ? '🗣 ' : ''}${esc(r.name)}${r.bgName ? ' · 🎵 ' + esc(r.bgName) : ''}</option>`).join('') || '<option value="">No takes yet — record one</option>';
  if (keep && mains.some(r => r.id == keep)) sel.value = keep;
  const sa = $('mxAd'), ka = sa.value || 'auto';
  sa.innerHTML = '<option value="auto">Ad-libs: newest for this take</option><option value="none">Ad-libs: none</option>' + ads.map(r => `<option value="${r.id}">🗣 ${esc(r.name)}</option>`).join('');
  sa.value = [...sa.options].some(o => o.value == ka) ? ka : 'auto';
  $('mxPlay').textContent = PB ? '■' : '▶';
}
// track 2: which ad-lib take (if any) plays with this main take
function adPick(mainId) {
  if (!S.ad) return null;
  const v = $('mxAd').value || 'auto';
  if (v == 'none') return null;
  if (v != 'auto') return recs.find(r => r.id == v) || null;
  return recs.find(r => r.track == 'adlib' && r.baseId == mainId) || null;
}
const pickId = () => { const v = $('mxTake').value; if (v) return +v; const m = recs.find(isMain); return m ? m.id : null; };
$('mxPlay').onclick = () => { const id = pickId(); if (!id) { toast('Record a take first'); return; } if (PB && PB.id == id) stopPlay(); else playR(id); };
$('mxStop').onclick = () => { if (PB) stopPlay(); };
$('mxTake').onchange = () => { if (PB) playR(pickId()); };
$('mxAd').onchange = () => { if (PB) playR(pickId()); };
$('mxTk').onclick = () => { $('swTk').click(); syncUI(); };

function afterRec(id) {
  const r = recs.find(x => x.id == id), mid = r && r.track == 'adlib' && r.baseId && recs.some(x => x.id == r.baseId) ? r.baseId : id;
  document.querySelector('.tab[data-p=mixer]').click();
  refresh(); $('mxTake').value = mid;
  if (r && r.track == 'adlib') $('mxAd').value = r.id;
  setTimeout(() => { if (!recording && !PB) playR(mid); }, 350);
}

let lastPl = '', lastT = '', lastM = '';
(function loop() {
  const pl = PB ? '■' : '▶';
  if (pl !== lastPl) { lastPl = pl; $('mxPlay').textContent = pl; }
  const tt = (PB && PB.el && isFinite(PB.el.duration)) ? fmt(PB.el.currentTime) + ' / ' + fmt(PB.el.duration) : '';
  if (tt !== lastT) { lastT = tt; $('mxT').textContent = tt; }
  let pk = 0;
  if (PB && typeof td !== 'undefined' && td) for (let i = 0; i < td.length; i += 4) { const v = Math.abs(td[i] - 128) / 128; if (v > pk) pk = v; }
  const m = Math.min(100, Math.round(pk * 120)) + '%';
  if (m !== lastM) { lastM = m; $('mxM').style.width = m; }
  requestAnimationFrame(loop);
})();

window.MX = { state: S, build, isDry, tail: tailSec, refresh, afterRec, syncUI, adPick, put, PRE, adaptToSong, makeIRx };
syncUI(); refresh();
})();
