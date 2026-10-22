// Raindrops V1.9.0 - Mix Rack tab (next to Mixer): a safe-range FX rack for the VOICE and for the BEAT, plus a Voice <-> Beat balance, a live scope and an AI rack doctor.
// Voice rack sits AFTER the Mixer chain:  Mixer voice chain > rumble cut > tone (mud / presence / air / warmth) > leveler > glow > space (slap + plate) > trim > safety limiter.
// Beat rack sits AFTER Beat master (beatfx.js): sub clean > mud cut > harsh tamer > air > glue > warmth > trim > safety limiter.
// Every range is capped so nothing can wreck the voice. All stages are lean: a stage at 0 is not wired in, a rack with everything at 0 is a straight wire.
// Same chains run live (playback) and offline (export).
(() => {
const DEF = { on: 1, bon: 1, ad: 1, pre: '', hp: 0, mud: 0, pres: 0, air: 0, warm: 0, lev: 0, glow: 0, slap: 0, slt: 110, plate: 0, pd: 25, vtrim: 0, bsub: 0, bmud: 0, bharsh: 0, bair: 0, bglue: 0, bwarm: 0, btrim: 0, bal: 0 };
const S = Object.assign({}, DEF, LS.get('rd_rack', {}));
const save = () => LS.set('rd_rack', S);
const dB = x => Math.pow(10, x / 20), cl = (v, a, b) => Math.min(b, Math.max(a, v)), rd1 = n => Math.round(n * 10) / 10;
const liveV = new Set(), liveB = new Set();
let mainV = null, ab = false;

const VK = ['hp', 'mud', 'pres', 'air', 'warm', 'lev', 'glow', 'slap', 'plate', 'vtrim'];
const BK = ['bsub', 'bmud', 'bharsh', 'bair', 'bglue', 'bwarm', 'btrim'];
const anyV = () => VK.some(k => S[k] != 0) || S.bal != 0;
const anyB = () => BK.some(k => S[k] != 0) || S.bal != 0;
const byp = () => !!(window.MX && MX.state && MX.state.byp);
const balV = () => (S.bal > 0 ? S.bal * 0.03 : S.bal * 0.04);   // voice up to +3 dB, down to -4 dB
const balB = () => (S.bal > 0 ? -S.bal * 0.06 : -S.bal * 0.03); // beat down to -6 dB, up to +3 dB
const satCurve = () => { const a = new Float32Array(1024); for (let i = 0; i < 1024; i++) a[i] = Math.tanh((i / 511.5 - 1) * 1.6); return a; };

// ---------------- voice rack ----------------
function buildVoice(c, kind) {
  const live = !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext);
  const G = v => { const g = c.createGain(); if (v != null) g.gain.value = v; return g; };
  const bq = (t, f, Q, g) => { const n = c.createBiquadFilter(); n.type = t; n.frequency.value = f; if (Q) n.Q.value = Q; if (g) n.gain.value = g; return n; };
  const inp = G(), out = G(), tr = G();
  const hp = bq('highpass', 20, 0.7), mud = bq('peaking', 300, 1, 0), pres = bq('peaking', 3200, 0.9, 0), air = bq('highshelf', 11000, null, 0), warm = bq('lowshelf', 180, null, 0);
  const cp = c.createDynamicsCompressor(), lvG = G();
  cp.knee.value = 14; cp.attack.value = 0.012; cp.release.value = 0.16;
  const gDry = G(), gPre = G(), gWs = c.createWaveShaper(), gWet = G(), gSum = G(); gWs.curve = satCurve(); gWs.oversample = '2x';
  const sDl = c.createDelay(0.5), sHp = bq('highpass', 250, 0.7), sLp = bq('lowpass', 4500, 0.7), sG = G();
  const pPre = c.createDelay(0.2), pHp = bq('highpass', 300, 0.7), pCv = c.createConvolver(), pLp = bq('lowpass', 7500, 0.7), pG = G();
  const sum = G();
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.08;
  const an = c.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.78;
  out.connect(an);
  const inner = [inp, tr, hp, mud, pres, air, warm, cp, lvG, gDry, gPre, gWs, gWet, gSum, sDl, sHp, sLp, sG, pPre, pHp, pCv, pLp, pG, sum, lim];
  const act = () => {
    const on = !!S.on && !ab && !byp() && (kind !== 'ad' || !!S.ad);
    return { on, hp: on && S.hp > 0, tone: on && (S.mud > 0 || S.pres > 0 || S.air > 0 || S.warm > 0), lev: on && S.lev > 0, glow: on && S.glow > 0, slap: on && S.slap > 0, plate: on && S.plate > 0, trim: on && (S.vtrim != 0 || S.bal != 0) };
  };
  let sig = '';
  const wire = () => {
    const a = act(), any = a.hp || a.tone || a.lev || a.glow || a.slap || a.plate || a.trim;
    const s = [a.on, any, a.hp, a.tone, a.lev, a.glow, a.slap, a.plate, a.trim].map(x => (x ? 1 : 0)).join('');
    if (s === sig) return;
    sig = s;
    inner.forEach(n => { try { n.disconnect(); } catch (e) {} });
    if (!a.on || !any) { inp.connect(out); return; }
    let t = inp;
    if (a.hp) { t.connect(hp); t = hp; }
    if (a.tone) { t.connect(mud); mud.connect(pres); pres.connect(air); air.connect(warm); t = warm; }
    if (a.lev) { t.connect(cp); cp.connect(lvG); t = lvG; }
    if (a.glow) { t.connect(gDry); gDry.connect(gSum); t.connect(gPre); gPre.connect(gWs); gWs.connect(gWet); gWet.connect(gSum); t = gSum; }
    if (a.slap || a.plate) {
      t.connect(sum);
      if (a.slap) { t.connect(sDl); sDl.connect(sHp); sHp.connect(sLp); sLp.connect(sG); sG.connect(sum); }
      if (a.plate) { t.connect(pPre); pPre.connect(pHp); pHp.connect(pCv); pCv.connect(pLp); pLp.connect(pG); pG.connect(sum); }
      t = sum;
    }
    t.connect(tr); tr.connect(lim); lim.connect(out);
  };
  let first = true;
  const sv = (p, v) => { if (first || !live) p.value = v; else p.setTargetAtTime(v, c.currentTime, 0.03); };
  const set = () => {
    const a = act();
    wire();
    sv(hp.frequency, 20 + S.hp);
    sv(mud.gain, -6 * S.mud / 100); sv(pres.gain, 4 * S.pres / 100); sv(air.gain, 4 * S.air / 100); sv(warm.gain, 3 * S.warm / 100);
    { const q = S.lev / 100; sv(cp.threshold, -14 - q * 14); sv(cp.ratio, 1.6 + q * 2.2); sv(lvG.gain, dB(q * 3.5)); }
    { const q = S.glow / 100; sv(gPre.gain, 1 + q * 4); sv(gDry.gain, 1 - q * 0.5); sv(gWet.gain, q * 0.7 / (1 + q * 1.2)); }
    sv(sDl.delayTime, S.slt / 1000); sv(sG.gain, S.slap / 100 * 0.45);
    sv(pPre.delayTime, S.pd / 1000); sv(pG.gain, S.plate / 100 * 2.5);
    if (a.plate && !pCv.buffer) { try { pCv.buffer = window.MX && MX.makeIRx ? MX.makeIRx(c, 'plate') : null; } catch (e) {} }
    sv(tr.gain, dB(S.vtrim + balV()));
    first = false;
  };
  set();
  const ch = {
    input: inp, output: out, set, analyser: an, comp: cp,
    stop: () => { liveV.delete(ch); if (mainV === ch) mainV = null; try { inner.forEach(n => n.disconnect()); out.disconnect(); } catch (e) {} }
  };
  if (live) { liveV.add(ch); if (kind !== 'ad') mainV = ch; }
  return ch;
}

// ---------------- beat rack ----------------
function buildBeat(c) {
  const live = !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext);
  const G = v => { const g = c.createGain(); if (v != null) g.gain.value = v; return g; };
  const bq = (t, f, Q, g) => { const n = c.createBiquadFilter(); n.type = t; n.frequency.value = f; if (Q) n.Q.value = Q; if (g) n.gain.value = g; return n; };
  const inp = G(), out = G(), tr = G();
  inp.channelCount = 2; inp.channelCountMode = 'explicit'; inp.channelInterpretation = 'speakers';
  const hp = bq('highpass', 20, 0.7), mud = bq('peaking', 250, 1, 0), har = bq('peaking', 3800, 1.1, 0), air = bq('highshelf', 9000, null, 0);
  const cp = c.createDynamicsCompressor(), gl = G();
  cp.knee.value = 12; cp.attack.value = 0.03; cp.release.value = 0.2;
  const wDry = G(), wPre = G(), wWs = c.createWaveShaper(), wWet = G(), wSum = G(); wWs.curve = satCurve(); wWs.oversample = '2x';
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.08;
  const an = c.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.78;
  out.connect(an);
  const inner = [inp, tr, hp, mud, har, air, cp, gl, wDry, wPre, wWs, wWet, wSum, lim];
  const act = () => {
    const on = !!S.bon && !ab;
    return { on, hp: on && S.bsub > 0, eq: on && (S.bmud > 0 || S.bharsh > 0 || S.bair > 0), cp: on && S.bglue > 0, wm: on && S.bwarm > 0, trim: on && (S.btrim != 0 || S.bal != 0) };
  };
  let sig = '';
  const wire = () => {
    const a = act(), any = a.hp || a.eq || a.cp || a.wm || a.trim;
    const s = [a.on, any, a.hp, a.eq, a.cp, a.wm, a.trim].map(x => (x ? 1 : 0)).join('');
    if (s === sig) return;
    sig = s;
    inner.forEach(n => { try { n.disconnect(); } catch (e) {} });
    if (!a.on || !any) { inp.connect(out); return; }
    let t = inp;
    if (a.hp) { t.connect(hp); t = hp; }
    if (a.eq) { t.connect(mud); mud.connect(har); har.connect(air); t = air; }
    if (a.cp) { t.connect(cp); cp.connect(gl); t = gl; }
    if (a.wm) { t.connect(wDry); wDry.connect(wSum); t.connect(wPre); wPre.connect(wWs); wWs.connect(wWet); wWet.connect(wSum); t = wSum; }
    t.connect(tr); tr.connect(lim); lim.connect(out);
  };
  let first = true;
  const sv = (p, v) => { if (first || !live) p.value = v; else p.setTargetAtTime(v, c.currentTime, 0.04); };
  const set = () => {
    wire();
    sv(hp.frequency, 20 + S.bsub * 0.5);
    sv(mud.gain, -5 * S.bmud / 100); sv(har.gain, -6 * S.bharsh / 100); sv(air.gain, 3 * S.bair / 100);
    { const q = S.bglue / 100; sv(cp.threshold, -12 - q * 12); sv(cp.ratio, 1.4 + q * 1.4); sv(gl.gain, dB(q * 2)); }
    { const q = S.bwarm / 100; sv(wPre.gain, 1 + q * 3); sv(wDry.gain, 1 - q * 0.4); sv(wWet.gain, q * 0.6 / (1 + q)); }
    sv(tr.gain, dB(S.btrim + balB()));
    first = false;
  };
  set();
  const ch = { input: inp, output: out, set, analyser: an, stop: () => { liveB.delete(ch); try { inner.forEach(n => n.disconnect()); out.disconnect(); } catch (e) {} } };
  if (live) liveB.add(ch);
  return ch;
}

const refreshAll = () => { liveV.forEach(c => c.set()); liveB.forEach(c => c.set()); };
const put = (k, v) => {
  S[k] = v; save(); refreshAll();
  if (BK.indexOf(k) >= 0 || k == 'bal' || k == 'bon') { try { window.RdBeat && RdBeat.refresh(); } catch (e) {} }
};

// ---------------- presets (voice + beat + balance together) ----------------
const PRE = {
  flat:   { name: 'Flat', v: {} },
  clean:  { name: 'Clean Lead', v: { hp: 25, mud: 30, pres: 25, air: 15, lev: 35, plate: 8, bsub: 30, bmud: 15, bharsh: 15, bglue: 20, bal: 15 } },
  airy:   { name: 'Airy Pop', v: { hp: 20, mud: 25, pres: 35, air: 45, warm: 10, lev: 35, glow: 10, plate: 20, pd: 30, bsub: 25, bharsh: 25, bair: 20, bglue: 15, bal: 20 } },
  trap:   { name: 'Trap Space', v: { hp: 30, mud: 30, pres: 30, air: 25, lev: 45, glow: 20, slap: 18, slt: 140, plate: 28, pd: 35, bsub: 35, bmud: 20, bharsh: 20, bglue: 30, bwarm: 15, bal: 20 } },
  warm:   { name: 'Warm Mid', v: { warm: 45, mud: 15, pres: 15, air: 10, lev: 40, glow: 30, plate: 12, bharsh: 20, bglue: 25, bwarm: 25, bal: 10 } },
  dry:    { name: 'Tight + Dry', v: { hp: 30, mud: 35, pres: 30, lev: 50, glow: 8, bsub: 25, bglue: 15, bal: 25 } },
  lead:   { name: 'Voice Lead', v: { hp: 20, mud: 20, pres: 30, air: 20, lev: 35, plate: 12, bsub: 30, bmud: 25, bharsh: 30, bglue: 25, bal: 30 } }
};

// ---------------- slider specs ----------------
const SV = [
  ['Clean up', [['hp', 'Rumble cut', '%', 0, 100], ['mud', 'Mud cut (boxy / muddy voice)', '%', 0, 100]]],
  ['Tone', [['pres', 'Presence (words cut through)', '%', 0, 100], ['air', 'Air (sparkle)', '%', 0, 100], ['warm', 'Warmth (body)', '%', 0, 100]]],
  ['Leveler', [['lev', 'Leveler (steady volume, never squashed past 4:1)', '%', 0, 100]]],
  ['Glow', [['glow', 'Glow (soft warmth + grit, blended)', '%', 0, 100]]],
  ['Space', [['slap', 'Slap echo (one tight repeat)', '%', 0, 100], ['slt', 'Slap time', ' ms', 60, 220], ['plate', 'Plate space (filtered, no mud)', '%', 0, 100], ['pd', 'Space pre-delay', ' ms', 5, 80]]],
  ['Output', [['vtrim', 'Voice trim', ' dB', -6, 6]]]
];
const SB = [
  ['Beat clean up', [['bsub', 'Sub clean (rumble under the beat)', '%', 0, 100], ['bmud', 'Mud cut (low-mid cloud)', '%', 0, 100]]],
  ['Beat tone', [['bharsh', 'Harsh tamer (shrill hats, synths)', '%', 0, 100], ['bair', 'Open up (beat sounds dull)', '%', 0, 100], ['bwarm', 'Warmth (blended)', '%', 0, 100]]],
  ['Beat glue', [['bglue', 'Glue (gentle, max 2.8:1)', '%', 0, 100]]],
  ['Beat output', [['btrim', 'Beat trim', ' dB', -9, 3]]]
];
const sl = s => '<div class="row"><div class="lb"><span>' + s[1] + '</span><b id="rv-' + s[0] + '"></b></div><input type="range" id="rk-' + s[0] + '" min="' + s[3] + '" max="' + s[4] + '" step="1"></div>';
const grp = g => '<div class="sec">' + g[0] + '</div>' + g[1].map(sl).join('');

// ---------------- AI rack doctor ----------------
const RANGE = { hp: [0, 70], mud: [0, 70], pres: [0, 70], air: [0, 70], warm: [0, 70], lev: [0, 75], glow: [0, 50], slap: [0, 45], slt: [60, 220], plate: [0, 55], pd: [5, 80], vtrim: [-4, 4], bsub: [0, 70], bmud: [0, 70], bharsh: [0, 70], bair: [0, 60], bglue: [0, 60], bwarm: [0, 45], btrim: [-9, 2], bal: [-40, 60] };
const AI_SYS = 'You are a careful mix engineer setting a phone-recorded rap and singing vocal rack plus the beat it sits on. ' +
  'Keep the voice natural and never harsh. The beat must support the voice, never bury it. Prefer subtle values. Reply with JSON only: {"set":{key:number,...},"why":"one plain sentence under 30 words"}. ' +
  'Only include keys you want to change. Keys and allowed ranges: ' + Object.keys(RANGE).map(k => k + ' ' + RANGE[k][0] + ' to ' + RANGE[k][1]).join(', ') + '. ' +
  'Meaning: hp rumble cut, mud mud cut on voice, pres presence, air sparkle, warm body, lev leveler, glow soft saturation, slap slap echo mix, slt slap ms, plate plate reverb mix, pd pre-delay ms, vtrim voice trim dB, ' +
  'bsub beat sub clean, bmud beat mud cut, bharsh beat harsh tamer, bair beat open-up, bglue beat glue, bwarm beat warmth, btrim beat trim dB, bal balance (positive = voice louder and beat quieter).';
const rdOne = n => Math.round(n * 10) / 10;
async function measured() {
  try {
    const v = $('mxTake') && $('mxTake').value, r = v && recs.find(x => x.id == v);
    if (!r || !window.RdEars) return '';
    const a = await RdEars.analyze(r);
    return 'Measured while the voice is active (dB): ' + a.bands.map(b => b.n + ' voice ' + rdOne(b.v) + (b.s != null ? ', song ' + rdOne(b.s) + ', gap ' + rdOne(b.diff) : '')).join('; ') + '.';
  } catch (e) { return ''; }
}

// ---------------- UI ----------------
const P = $('p-rack');
P.innerHTML =
  '<div class="card"><div class="ct"><span>Mix Rack</span><b id="rkT" style="color:var(--accent)"></b></div>' +
  '<canvas id="rkScope"></canvas><p class="hint" id="rkBal" style="margin-top:8px">Play a take: your voice shows above the line, the beat below it.</p>' +
  '<div class="ctl" style="margin:12px 0"><button class="sub" id="rkPlay">▶</button><button class="sub" id="rkStop">■</button></div>' +
  '<div class="cr" style="margin-bottom:12px"><span>Voice rack ON</span><div class="sw" id="rkOn"></div></div>' +
  '<div class="cr" style="margin-bottom:12px"><span>Beat rack ON</span><div class="sw" id="rkBon"></div></div>' +
  '<div class="cr" style="margin-bottom:12px"><span>Also on ad-libs</span><div class="sw" id="rkAd"></div></div>' +
  '<div class="btnrow"><button class="btn g" id="rkAB">Hold: hear it without the rack</button></div>' +
  '<div class="btnrow" style="margin-top:8px"><button class="btn g" id="rkDice">🎲 Surprise me (safe)</button><button class="btn g" id="rkReset">Reset rack</button></div>' +
  '<p class="hint">Works on the Mixer\'s take picker. Changes move live while a take plays and are included in export. Every control is capped so it cannot wreck your voice or bury it under the beat. The Mixer\'s own "Effects ON" switch also turns the voice rack off, so Off still means the raw take.</p></div>' +
  '<div class="card"><div class="ct"><span>Rack presets</span><b id="rkPreSt" style="color:var(--accent)"></b></div><div class="chips" id="rkPre"></div>' +
  '<p class="hint">Each preset sets voice, beat and balance together.</p></div>' +
  '<div class="card"><div class="ct"><span>Balance: voice ⟷ beat</span></div>' +
  '<div class="row"><div class="lb"><span>Balance (left = beat forward, right = voice forward)</span><b id="rv-bal"></b></div><input type="range" id="rk-bal" min="-100" max="100" step="1"></div>' +
  '<div class="row"><div class="lb"><span>Beat ducks under my voice</span><b id="rv-duck"></b></div><input type="range" id="rk-duck" min="0" max="100" step="1"></div>' +
  '<div class="row"><div class="lb"><span>Voice pocket in the beat</span><b id="rv-pocket"></b></div><input type="range" id="rk-pocket" min="0" max="100" step="1"></div>' +
  '<button class="btn" id="rkAuto">Auto-balance from my take</button><p class="hint" id="rkAutoS" style="margin-top:10px">Measures your take against its song, sets Voice EQ + Voice focus in the Mixer and the beat shaping in Effects. Needs a take recorded over a backing song.</p>' +
  '<p class="hint">Balance moves the voice up to +3 dB and the beat down to -6 dB (or the other way, smaller). Duck and pocket are the same controls as Beat master in Effects.</p></div>' +
  '<div class="card"><div class="ct">Voice rack</div>' + SV.map(grp).join('') + '</div>' +
  '<div class="card"><div class="ct">Beat rack</div>' + SB.map(grp).join('') + '<p class="hint">The beat is only routed through the rack while it is on and something is above 0. If you raise a beat control mid-take it switches in by itself.</p></div>' +
  '<div class="card" id="rkAiC"><div class="ct"><span>AI rack doctor</span><b style="color:var(--accent)">Gemini</b></div>' +
  '<div class="chips" id="rkVibe"></div>' +
  '<textarea id="rkAiTxt" class="mxsel" rows="3" style="width:100%;margin-top:10px;padding:10px;resize:vertical" placeholder="What do you hear? e.g. my voice sounds boxy and the beat is too boomy"></textarea>' +
  '<div class="cr" style="margin:10px 0"><span>Let AI see my measured voice bands</span><div class="sw on" id="rkAiM"></div></div>' +
  '<button class="btn aigo" id="rkAiGo">Set my rack with AI</button><p class="hint" id="rkAiS" style="margin-top:10px">AI only moves the rack inside the safe ranges. You hear it, then tweak.</p></div>';

const VIBES = ['Clean + loud', 'Dark + moody', 'Bright pop', 'Lo-fi', 'Big + spacey', 'Raw + dry'];
let vibe = VIBES[0];
$('rkVibe').innerHTML = VIBES.map(v => '<div class="chip" data-v="' + v + '">' + v + '</div>').join('');
const paintVibe = () => $('rkVibe').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.v == vibe));
$('rkVibe').querySelectorAll('.chip').forEach(c => c.onclick = () => { vibe = c.dataset.v; paintVibe(); });
paintVibe();

const ALLS = SV.concat(SB).flatMap(g => g[1]);
const BEATLINK = ['duck', 'pocket'];
function fmtV(s, v) { return v + s[2]; }
function sync() {
  ALLS.forEach(s => { const e = $('rk-' + s[0]); e.value = S[s[0]]; $('rv-' + s[0]).textContent = fmtV(s, S[s[0]]); });
  $('rk-bal').value = S.bal; $('rv-bal').textContent = (S.bal > 0 ? '+' : '') + S.bal;
  BEATLINK.forEach(k => { const v = window.RdBeat ? RdBeat.state[k] : 0; $('rk-' + k).value = v; $('rv-' + k).textContent = v + '%'; });
  $('rkOn').classList.toggle('on', !!S.on); $('rkBon').classList.toggle('on', !!S.bon); $('rkAd').classList.toggle('on', !!S.ad);
  $('rkPre').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.v == S.pre));
  $('rkPreSt').textContent = S.pre && PRE[S.pre] ? PRE[S.pre].name : (S.pre == 'ai' ? 'AI' : S.pre == 'dice' ? 'Surprise' : '');
}
ALLS.forEach(s => {
  $('rk-' + s[0]).oninput = e => { const v = +e.target.value; S.pre = ''; put(s[0], v); $('rv-' + s[0]).textContent = fmtV(s, v); $('rkPreSt').textContent = ''; $('rkPre').querySelectorAll('.chip').forEach(c => c.classList.remove('on')); };
});
$('rk-bal').oninput = e => { const v = +e.target.value; S.pre = ''; put('bal', v); $('rv-bal').textContent = (v > 0 ? '+' : '') + v; };
BEATLINK.forEach(k => {
  $('rk-' + k).oninput = e => { const v = +e.target.value; if (window.RdBeat) RdBeat.put({ [k]: v, pre: 'custom', on: 1 }); $('rv-' + k).textContent = v + '%'; try { RdBeat.refresh(); } catch (x) {} };
});
$('rkOn').onclick = () => { put('on', S.on ? 0 : 1); sync(); toast(S.on ? 'Voice rack on' : 'Voice rack off'); };
$('rkBon').onclick = () => { put('bon', S.bon ? 0 : 1); sync(); toast(S.bon ? 'Beat rack on' : 'Beat rack off'); };
$('rkAd').onclick = () => { put('ad', S.ad ? 0 : 1); sync(); };
$('rkPre').innerHTML = Object.entries(PRE).map(([k, p]) => '<div class="chip" data-v="' + k + '">' + p.name + '</div>').join('');
const applyVals = (o, name) => {
  const keep = { on: S.on, bon: S.bon, ad: S.ad };
  Object.assign(S, DEF, keep, o, { pre: name || '' }); save(); refreshAll();
  try { window.RdBeat && RdBeat.refresh(); } catch (e) {}
  sync();
};
$('rkPre').querySelectorAll('.chip').forEach(c => c.onclick = () => { const p = PRE[c.dataset.v]; applyVals(p.v, c.dataset.v); toast(p.name); });
$('rkReset').onclick = () => { applyVals({}, ''); toast('Rack reset'); };
$('rkDice').onclick = () => {
  const r = (a, b) => Math.round(a + Math.random() * (b - a));
  applyVals({ hp: r(15, 35), mud: r(10, 40), pres: r(10, 40), air: r(5, 40), warm: r(0, 30), lev: r(25, 55), glow: r(0, 25), slap: r(0, 25), slt: r(80, 180), plate: r(5, 35), pd: r(10, 50), bsub: r(15, 40), bmud: r(0, 30), bharsh: r(0, 30), bair: r(0, 25), bglue: r(10, 35), bwarm: r(0, 25), bal: r(10, 35) }, 'dice');
  toast('Surprise rack: play it');
};
const abSet = v => { if (ab === v) return; ab = v; refreshAll(); $('rkAB').textContent = v ? 'Rack bypassed (let go to bring it back)' : 'Hold: hear it without the rack'; };
const abBtn = $('rkAB');
['pointerdown', 'touchstart'].forEach(ev => abBtn.addEventListener(ev, e => { e.preventDefault(); abSet(true); }, { passive: false }));
['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach(ev => abBtn.addEventListener(ev, () => abSet(false)));
$('rkPlay').onclick = () => { const m = $('mxPlay'); if (m) m.click(); };
$('rkStop').onclick = () => { const m = $('mxStop'); if (m) m.click(); };

$('rkAuto').onclick = async () => {
  const b = $('rkAuto'), st = $('rkAutoS'); b.disabled = true; b.textContent = 'Listening…'; st.textContent = 'Measuring your take against its song…';
  let say = '';
  try {
    if (window.MX && MX.adaptToSong) await MX.adaptToSong(true);
    const m = window.RdBeat && (await RdBeat.match());
    if (m) { m.o.on = 1; m.o.pre = 'match'; RdBeat.put(m.o); try { RdBeat.refresh(); } catch (e) {} say = m.say + ' Voice EQ + focus set in the Mixer. Press play and fine-tune the balance.'; }
    else say = 'Needs a take recorded over a backing song.';
  } catch (e) { say = 'Could not measure that take.'; }
  st.textContent = say; b.disabled = false; b.textContent = 'Auto-balance from my take'; sync();
};
$('rkAiM').onclick = () => $('rkAiM').classList.toggle('on');
$('rkAiGo').onclick = async () => {
  const key = String(LS.get('rd_gk', '') || '').trim(), st = $('rkAiS'), b = $('rkAiGo');
  if (!key) { toast('Add your Gemini key in Studio AI first'); const t = document.querySelector('.tab[data-p="ai"]'); if (t) t.click(); return; }
  if (!window.RdAIcore) { toast('AI not loaded'); return; }
  b.disabled = true; b.textContent = 'Thinking…'; st.textContent = 'Reading your rack' + ($('rkAiM').classList.contains('on') ? ' and your take…' : '…');
  try {
    const meas = $('rkAiM').classList.contains('on') ? await measured() : '';
    const cur = {}; Object.keys(RANGE).forEach(k => { cur[k] = S[k]; });
    const bs = window.RdBeat ? RdBeat.state : {};
    const prompt = 'Vibe wanted: ' + vibe + '\nWhat they hear: ' + ($('rkAiTxt').value.trim() || '(nothing said, make it sound polished and balanced)') + '\n' +
      (meas ? meas + '\n' : '') + 'Current rack: ' + JSON.stringify(cur) + '\nBeat master now: duck ' + (bs.duck || 0) + ', pocket ' + (bs.pocket || 0) + '.\nReturn the JSON.';
    const r = await RdAIcore.ask({ key, model: String(LS.get('rd_gm', '') || ''), system: AI_SYS, prompt, json: true, temp: 0.4, max: 700 });
    const j = RdAIcore.parseJSON(r.text), set = j && (j.set || j);
    if (!set || typeof set != 'object') throw new Error('AI sent back something I could not read. Try again.');
    const o = {}; let n = 0;
    Object.keys(RANGE).forEach(k => { if (typeof set[k] == 'number' && isFinite(set[k])) { o[k] = Math.round(cl(set[k], RANGE[k][0], RANGE[k][1])); n++; } });
    if (!n) throw new Error('AI had no changes to suggest. Describe what you hear and try again.');
    const keep = { on: S.on, bon: S.bon, ad: S.ad };
    Object.assign(S, DEF, keep, o, { pre: 'ai' }); save(); refreshAll();
    try { window.RdBeat && RdBeat.refresh(); } catch (e) {}
    sync(); st.textContent = (j.why ? String(j.why).slice(0, 220) + ' ' : '') + '(' + n + ' controls set, play it and tweak)';
  } catch (e) { st.textContent = String((e && e.message) || e).slice(0, 160); }
  b.disabled = false; b.textContent = 'Set my rack with AI';
};
document.querySelector('.tab[data-p=rack]').addEventListener('click', sync);

// ---------------- scope + balance readout ----------------
const cv = $('rkScope'), g2 = cv.getContext('2d'), NB = 40, pkV = new Float32Array(NB), pkB = new Float32Array(NB);
let cw = 0, ch2 = 0, acc = '#FF6B00', lastTxt = 0, rmsV = -90, rmsB = -90, lastByp = null;
function bars(an) {
  const d = an._d || (an._d = new Uint8Array(an.frequencyBinCount)); an.getByteFrequencyData(d);
  const o = new Float32Array(NB), nb = d.length, nyq = an.context.sampleRate / 2, lo = Math.log(60), hi = Math.log(14000);
  for (let i = 0; i < NB; i++) {
    const f0 = Math.exp(lo + (hi - lo) * i / NB), f1 = Math.exp(lo + (hi - lo) * (i + 1) / NB);
    const b0 = Math.max(1, Math.floor(f0 / nyq * nb)), b1 = Math.max(b0 + 1, Math.ceil(f1 / nyq * nb)); let s = 0, c = 0;
    for (let b = b0; b < b1 && b < nb; b++) { s += d[b]; c++; }
    o[i] = c ? s / c / 255 : 0;
  }
  return o;
}
function rms(an) {
  const f = an._f || (an._f = new Float32Array(an.fftSize)); an.getFloatTimeDomainData(f); let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i];
  return 10 * Math.log10(s / f.length + 1e-12);
}
function frame() {
  requestAnimationFrame(frame);
  const b = byp(); if (b !== lastByp) { lastByp = b; refreshAll(); }
  if (!P.classList.contains('on')) return;
  const dpr = window.devicePixelRatio || 1, w = Math.max(10, cv.clientWidth), h = cv.clientHeight || 150;
  if (cw !== w * dpr || ch2 !== h * dpr) { cw = cv.width = Math.round(w * dpr); ch2 = cv.height = Math.round(h * dpr); acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#FF6B00').trim() || '#FF6B00'; }
  const W = cw, H = ch2, mid = H / 2, bw = W / NB;
  g2.clearRect(0, 0, W, H); g2.fillStyle = '#0a0a0a'; g2.fillRect(0, 0, W, H);
  g2.strokeStyle = 'rgba(255,255,255,.08)'; g2.lineWidth = 1; g2.beginPath(); g2.moveTo(0, mid); g2.lineTo(W, mid); g2.stroke();
  g2.fillStyle = 'rgba(255,255,255,.25)'; g2.font = Math.round(9 * dpr) + 'px system-ui';
  [[100, 'Hz'], [1000, '1k'], [10000, '10k']].forEach(([f, t]) => { const x = (Math.log(f) - Math.log(60)) / (Math.log(14000) - Math.log(60)) * W; g2.fillText(t == 'Hz' ? '100' : t, x, mid - 3 * dpr); });
  const va = mainV && mainV.analyser, ba = window.RdBeat && RdBeat.analyser && RdBeat.analyser();
  const vv = va && PB ? bars(va) : null, bb = ba && PB ? bars(ba) : null;
  for (let i = 0; i < NB; i++) {
    const x = i * bw + 1, a = vv ? vv[i] : 0, c = bb ? bb[i] : 0;
    pkV[i] = Math.max(a, pkV[i] - 0.012); pkB[i] = Math.max(c, pkB[i] - 0.012);
    const hv = a * (mid - 6 * dpr), hb = c * (mid - 6 * dpr);
    if (hv > 0) { const gr = g2.createLinearGradient(0, mid - hv, 0, mid); gr.addColorStop(0, acc); gr.addColorStop(1, 'rgba(255,255,255,.08)'); g2.fillStyle = gr; g2.fillRect(x, mid - hv, bw - 2, hv); }
    if (hb > 0) { g2.fillStyle = 'rgba(215,215,215,.72)'; g2.fillRect(x, mid + 1, bw - 2, hb); }
    g2.fillStyle = acc; g2.fillRect(x, mid - pkV[i] * (mid - 6 * dpr) - 2 * dpr, bw - 2, 2 * dpr);
    g2.fillStyle = 'rgba(235,235,235,.9)'; g2.fillRect(x, mid + pkB[i] * (mid - 6 * dpr), bw - 2, 2 * dpr);
  }
  g2.fillStyle = acc; g2.font = '700 ' + Math.round(10 * dpr) + 'px system-ui'; g2.fillText('VOICE', 6 * dpr, 14 * dpr);
  g2.fillStyle = '#ddd'; g2.fillText('BEAT', 6 * dpr, H - 8 * dpr);
  const now = performance.now();
  if (now - lastTxt > 120) {
    lastTxt = now;
    if (PB && va) rmsV += (rms(va) - rmsV) * 0.35; else rmsV = -90;
    if (PB && ba) rmsB += (rms(ba) - rmsB) * 0.35; else rmsB = -90;
    let t;
    if (!PB) t = 'Play a take: your voice shows above the line, the beat below it.';
    else if (rmsV > -55 && rmsB > -60) {
      const d = rmsV - rmsB;
      t = 'Voice sits ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' dB over the beat. ' + (d < 2 ? 'Beat is loud: raise Balance or use Auto-balance.' : d > 10 ? 'Voice is far above the beat: lower Balance a little.' : 'Good working range.');
    } else if (rmsV > -55) t = 'Voice level ' + rdOne(rmsV) + ' dB. The beat is not routed through the rack yet: raise a Beat rack control or turn on Beat master.';
    else t = 'Waiting for your voice…';
    const gr = mainV && mainV.comp ? mainV.comp.reduction : 0;
    if (PB && S.lev > 0 && gr) t += ' Leveler: ' + (typeof gr == 'number' ? gr.toFixed(1) : '0') + ' dB.';
    if ($('rkBal').textContent !== t) $('rkBal').textContent = t;
    const el = PB && PB.el && isFinite(PB.el.duration) ? fmt(PB.el.currentTime) + ' / ' + fmt(PB.el.duration) : '';
    if ($('rkT').textContent !== el) $('rkT').textContent = el;
    const pl = PB ? '■' : '▶'; if ($('rkPlay').textContent !== pl) $('rkPlay').textContent = pl;
  }
}
requestAnimationFrame(frame);

window.RdRack = {
  state: S, buildVoice, buildBeat, PRE, sync, put,
  hook: () => true,
  adOn: () => !!S.on && !!S.ad,
  voiceOn: () => !!S.on && !byp() && anyV(),
  beatOn: () => !!S.bon && anyB(),
  tail: () => (S.plate > 0 ? 1.9 : 0) + (S.slap > 0 ? 0.5 : 0)
};
sync();
})();
