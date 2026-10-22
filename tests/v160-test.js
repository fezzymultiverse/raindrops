// V1.6.0 tests: 3 reverb rooms, vocal presets + Off + Adapt to song, latency pairing (real audio math, headless Chromium, fake mic).
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.WWW;
const srv = http.createServer((q, r) => { let f = path.join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } const t = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'; r.writeHead(200, { 'content-type': t }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x !== undefined ? JSON.stringify(x) : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));

  // ================= UI exists =================
  const ui = await pg.evaluate(() => ({
    off: !!document.querySelector('#mxPre .chip[data-v=off]'),
    pres: ['polished', 'clear', 'rumble', 'hardlim'].every(k => !!document.querySelector('#mxPre .chip[data-v=' + k + ']')),
    rooms: ['rvp', 'rvh', 'rva'].every(k => !!document.getElementById('m-' + k)),
    lat: !!document.getElementById('latCard'), adapt: !!document.getElementById('mxAdaptNow'), tk: !!document.getElementById('latTake'),
    syMax: document.getElementById('sy').max, dry: MX.isDry(), cnt: document.querySelectorAll('#mxPre .chip').length
  }));
  ok('Off chip exists', ui.off); ok('4 new vocal presets exist', ui.pres); ok('3 reverb room sliders exist', ui.rooms);
  ok('latency card + per-take row + Adapt button exist', ui.lat && ui.adapt && ui.tk, ui);
  ok('Voice sync slider range raised to 600', ui.syMax == '600', ui.syMax); ok('defaults are dry', ui.dry);

  // ================= DSP helpers inside the page =================
  await pg.evaluate(() => {
    window.render = async (setup, gen, secs) => {
      const SR = 44100, off = new OfflineAudioContext(1, Math.ceil(SR * secs), SR), buf = off.createBuffer(1, Math.ceil(SR * secs), SR);
      gen(buf.getChannelData(0), SR);
      const s = off.createBufferSource(); s.buffer = buf;
      setup(); const ch = await MX.build(off); s.connect(ch.input); ch.output.connect(off.destination); s.start();
      const r = await off.startRendering(); ch.stop(); return r.getChannelData(0);
    };
    window.rms = (d, a, b) => { let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, b - a)); };
    window.zero = () => { const k = Object.keys(MX.state); MX.state.byp = 0; MX.put('in', 100); ['gate', 'ds', 'lc', 'enh', 'voc', 'cp', 'ld', 'tn', 'ec', 'rv', 'dbl', 'sat', 'lof', 'cho', 'qb', 'ql', 'qm', 'qh', 'vl', 'rvp', 'rvh', 'rva'].forEach(x => MX.put(x, 0)); MX.put('out', 100); MX.state.pre = ''; };
    window.burst = (d, SR) => { for (let i = 0; i < SR * 0.05; i++) d[Math.floor(SR * 0.1) + i] = (Math.random() * 2 - 1) * 0.5; };
    window.tone = f => (d, SR) => { for (let i = 0; i < d.length; i++) d[i] = 0.02 * Math.sin(2 * Math.PI * f * i / SR); };
  });

  // ================= reverb rooms =================
  const rooms = await pg.evaluate(async () => {
    const out = {};
    for (const [k, key] of [['plate', 'rvp'], ['hall', 'rvh'], ['halo', 'rva']]) {
      zero(); MX.put(key, 100);
      const d = await render(() => {}, burst, 8), SR = 44100, win = Math.floor(SR * 0.05), env = [];
      for (let i = 0; i + win < d.length; i += win) env.push(rms(d, i, i + win));
      const w4 = env.slice(4), pk = Math.max(...w4), pkAt = (w4.indexOf(pk) + 4) * 0.05;   // wet only: look after the dry burst has ended (0.2 s on)
      const bEnd = Math.floor(0.2 / 0.05);
      let t40 = 0; for (let i = env.length - 1; i > bEnd; i--) if (env[i] > pk * 0.01) { t40 = i * 0.05 - 0.2; break; }   // time after burst until -40 dB
      // brightness of the tail: zero crossing rate 0.3 s to 0.9 s after the burst
      const a = Math.floor(SR * 0.5), z = Math.floor(SR * 1.1); let zc = 0; for (let i = a + 1; i < z; i++) if ((d[i] >= 0) != (d[i - 1] >= 0)) zc++;
      out[k] = { t40, pkAt, pk, zc: zc / ((z - a) / SR), tailRms: rms(d, Math.floor(SR * 0.6), Math.floor(SR * 1.0)) };
    }
    zero(); return out;
  });
  ok('Plate makes sound', rooms.plate.pk > 0.005, rooms.plate); ok('Cathedral makes sound', rooms.hall.pk > 0.005, rooms.hall); ok('Halo makes sound', rooms.halo.pk > 0.005, rooms.halo);
  const lv = await pg.evaluate(async () => {
    const o = {}; for (const key of ['rv', 'rvp', 'rvh', 'rva']) {
      zero(); MX.put(key, 100);
      const SR = 44100, off = new OfflineAudioContext(1, SR * 6, SR), buf = off.createBuffer(1, SR * 6, SR), d0 = buf.getChannelData(0); let lp = 0; for (let i = 0; i < SR * 3; i++) { lp += 0.3 * ((Math.random() * 2 - 1) - lp); d0[i] = lp * 0.3; }
      const s = off.createBufferSource(); s.buffer = buf; const ch = await MX.build(off); s.connect(ch.input); ch.output.connect(off.destination); s.start();
      const d = (await off.startRendering()).getChannelData(0); o[key] = 20 * Math.log10(rms(d, SR * 3 + 4410, SR * 3 + 8820) + 1e-9); ch.stop();
    } zero(); return o;
  });
  ok('Room levels match the old Reverb mix (each within 6 dB of it at 100%)', ['rvp', 'rvh', 'rva'].every(k => Math.abs(lv[k] - lv.rv) < 6), lv);
  ok('Plate tail is short (under 2.4 s to -40 dB)', rooms.plate.t40 < 2.4, rooms.plate.t40);
  ok('Cathedral tail is long (over 3 s to -40 dB)', rooms.hall.t40 > 3, rooms.hall.t40);
  ok('Cathedral longer than Plate by at least 1 s', rooms.hall.t40 - rooms.plate.t40 > 1, [rooms.plate.t40, rooms.hall.t40]);
  ok('Cathedral is darker than Plate (lower zero-crossing rate)', rooms.hall.zc < rooms.plate.zc * 0.8, [rooms.hall.zc, rooms.plate.zc]);
  ok('Halo blooms: its peak comes later than the Plate peak', rooms.halo.pkAt > rooms.plate.pkAt + 0.08, [rooms.halo.pkAt, rooms.plate.pkAt]);
  ok('Halo is brighter than Cathedral', rooms.halo.zc > rooms.hall.zc * 1.3, [rooms.halo.zc, rooms.hall.zc]);
  ok('room mixes make isDry false and export tail longer', await pg.evaluate(() => { zero(); const a = MX.tail(); MX.put('rvh', 50); const r = !MX.isDry() && MX.tail() > a + 3; zero(); return r; }));

  // ================= presets, Off =================
  const pr = await pg.evaluate(async () => {
    zero(); MX.state.adapt = 0; const res = {};
    const click = k => document.querySelector('#mxPre .chip[data-v=' + k + ']').click();
    // OFF: bit-exact pass through
    click('polished'); res.polState = { cp: MX.state.cp, ds: MX.state.ds, enh: MX.state.enh, pre: MX.state.pre, byp: MX.state.byp, chipOn: document.querySelector('#mxPre .chip[data-v=polished]').classList.contains('on') };
    const sig = tone(1000);
    const wet = await render(() => {}, sig, 1.2);
    click('off'); res.offState = { byp: MX.state.byp, chipOn: document.querySelector('#mxPre .chip[data-v=off]').classList.contains('on'), polOn: document.querySelector('#mxPre .chip[data-v=polished]').classList.contains('on'), cpKept: MX.state.cp };
    const dry = await render(() => {}, sig, 1.2), ref = new Float32Array(Math.ceil(44100 * 1.2)); sig(ref, 44100);
    let md = 0; for (let i = 0; i < ref.length; i++) md = Math.max(md, Math.abs(dry[i] - ref[i]));
    res.offMaxDiff = md; res.wetDiffers = Math.abs(rms(wet, 20000, 40000) - rms(ref, 20000, 40000)) > 1e-4;
    click('clear'); res.backOn = MX.state.byp == 0 && MX.state.pre == 'clear';
    // each new preset renders sound and never clips
    for (const k of ['polished', 'clear', 'rumble', 'hardlim']) { click(k); const d = await render(() => {}, (x, SR) => { for (let i = 0; i < x.length; i++) x[i] = 0.9 * Math.sin(2 * Math.PI * 800 * i / SR); }, 1.5); let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); res['pk_' + k] = pk; res['rms_' + k] = rms(d, 30000, 60000); }
    // Rumble + spit: 40 Hz rumble much quieter than 1 kHz, relative to the dry take
    click('rumble'); const lo = await render(() => {}, tone(40), 1.5), hi = await render(() => {}, tone(1000), 1.5);
    res.rumbleDiffDb = 20 * Math.log10(rms(lo, 30000, 60000) / rms(hi, 30000, 60000));
    // Hard limit: loud input stays under the ceiling
    click('hardlim'); res.hardCp = MX.state.cp; res.hardLd = MX.state.ld;
    // moving a preset-owned slider clears the preset name, moving EQ does not
    click('polished'); const sl = document.getElementById('m-cp'); sl.value = 10; sl.dispatchEvent(new Event('input', { bubbles: true })); res.clearedOnSlider = MX.state.pre == '';
    click('polished'); const q = document.getElementById('m-qb'); q.value = 3; q.dispatchEvent(new Event('input', { bubbles: true })); res.keptOnEq = MX.state.pre == 'polished';
    click('polished'); res.eqKept = MX.state.qb == 3; zero(); return res;
  });
  ok('Polished sets its values + highlights', pr.polState.cp == 55 && pr.polState.ds == 35 && pr.polState.pre == 'polished' && pr.polState.byp == 0 && pr.polState.chipOn, pr.polState);
  ok('Off: effects bypassed, Off chip lit, preset chip not lit, settings kept', pr.offState.byp == 1 && pr.offState.chipOn && !pr.offState.polOn && pr.offState.cpKept == 55, pr.offState);
  ok('Off is bit-exact: output equals input', pr.offMaxDiff < 1e-6, pr.offMaxDiff);
  ok('With a preset on, the sound really changes', pr.wetDiffers);
  ok('Picking a preset after Off turns effects back on', pr.backOn);
  ok('No preset clips (peaks <= 1.0)', ['polished', 'clear', 'rumble', 'hardlim'].every(k => pr['pk_' + k] <= 1.0), pr);
  ok('No preset is silent', ['polished', 'clear', 'rumble', 'hardlim'].every(k => pr['rms_' + k] > 0.05), pr);
  ok('Rumble + spit clean cuts 40 Hz rumble by 12+ dB vs 1 kHz', pr.rumbleDiffDb < -12, pr.rumbleDiffDb);
  ok('Hard limit preset = heavy compression + big louder', pr.hardCp >= 80 && pr.hardLd >= 90);
  ok('Moving a preset slider clears the preset name; moving EQ keeps it', pr.clearedOnSlider && pr.keptOnEq && pr.eqKept, pr);

  // ================= Adapt to song =================
  await pg.evaluate(async () => {
    const R = 44100, secs = 14;
    const mk = async fn => { const o = new OfflineAudioContext(1, R * secs, R), b = o.createBuffer(1, R * secs, R), d = b.getChannelData(0); fn(d, R); const s = o.createBufferSource(); s.buffer = b; s.connect(o.destination); s.start(); return wav(await o.startRendering()); };
    // quiet mid voice, song loud in the mids -> Mid must need a boost
    const voice = await mk((d, R) => { for (let i = 0; i < d.length; i++) { const t = i / R, env = (t % 2) < 1.2 ? 1 : 0; d[i] = env * (0.03 * Math.sin(2 * Math.PI * 1000 * t) + 0.02 * Math.sin(2 * Math.PI * 2000 * t)); } });
    const song = await mk((d, R) => { for (let i = 0; i < d.length; i++) { const t = i / R; d[i] = 0.2 * Math.sin(2 * Math.PI * 1100 * t) + 0.15 * Math.sin(2 * Math.PI * 1900 * t) + 0.1 * Math.sin(2 * Math.PI * 90 * t); } });
    const sid = uid(), rid = uid();
    songs.unshift({ id: sid, name: 't.wav', size: song.size, type: 'audio/wav', blob: song, title: 'Loud Mid Beat', artist: 'T', art: null, lyrics: '', added: Date.now() });
    recs.unshift({ id: rid, name: 'Take adapt', blob: voice, ext: 'wav', mime: 'audio/wav', dur: secs, bgId: sid, bgName: 'Loud Mid Beat', bgOff: 0, created: Date.now(), track: 'main', baseId: null });
    recs.unshift({ id: uid(), name: 'Take nosong', blob: voice, ext: 'wav', mime: 'audio/wav', dur: secs, bgId: null, bgName: '', bgOff: 0, created: Date.now() - 1, track: 'main', baseId: null });
    rSongs(); rRecs(); MX.refresh(); window.__rid2 = rid;
  });
  await pg.click('.tab[data-p="mixer"]'); await pg.waitForTimeout(250);
  await pg.evaluate(() => { document.getElementById('mxTake').value = window.__rid2; zero(); MX.state.adapt = 0; });
  const ad1 = await pg.evaluate(async () => { const r = await MX.adaptToSong(false); return { r, qm: MX.state.qm, qh: MX.state.qh, qb: MX.state.qb, vl: MX.state.vl, ql: MX.state.ql }; });
  ok('Adapt to song returns true and boosts Mid + sets Voice focus', ad1.r && ad1.qm >= 2 && ad1.vl > 0, ad1);
  ok('Adapt keeps every EQ value inside -12..12', [ad1.qb, ad1.ql, ad1.qm, ad1.qh].every(v => v >= -12 && v <= 12), ad1);
  // preset click with Adapt ON runs it automatically
  const ad2 = await pg.evaluate(async () => { zero(); MX.state.adapt = 1; MX.syncUI(); document.querySelector('#mxPre .chip[data-v=clear]').click(); await new Promise(r => { const t0 = Date.now(); const i = setInterval(() => { if (MX.state.qm > 0 || Date.now() - t0 > 25000) { clearInterval(i); r(); } }, 200); }); return { pre: MX.state.pre, cp: MX.state.cp, qm: MX.state.qm, vl: MX.state.vl }; });
  ok('Preset click with Adapt ON: preset kept AND EQ/focus adapted to the song', ad2.pre == 'clear' && ad2.cp == 50 && ad2.qm >= 2 && ad2.vl > 0, ad2);
  // no song -> refuses politely, EQ untouched
  const ad3 = await pg.evaluate(async () => { const nr = recs.find(r => r.name == 'Take nosong'); document.getElementById('mxTake').value = nr.id; MX.put('qm', 5); const r = await MX.adaptToSong(true); return { r, qm: MX.state.qm }; });
  ok('Adapt with no backing song does nothing (EQ untouched)', ad3.r === false && ad3.qm == 5, ad3);
  await pg.evaluate(() => zero());

  // ================= latency: tap math =================
  const tm = await pg.evaluate(() => {
    const clicks = [...Array(12)].map((_, i) => 1000 + i * 800), rnd = (a) => (Math.random() * 2 - 1) * a, out = {};
    out.clean = RdLat.solveTaps(clicks, clicks.map(c => c + 180 + rnd(15)));
    const t2 = clicks.map(c => c + 180 + rnd(15)); t2[3] = clicks[3] + 380; t2[8] = clicks[8] - 90;     // two bad taps
    out.outliers = RdLat.solveTaps(clicks, t2);
    out.few = RdLat.solveTaps(clicks, clicks.slice(0, 4).map(c => c + 180));
    out.messy = RdLat.solveTaps(clicks, clicks.map((c, i) => c + (i % 2 ? 60 : 300)));
    out.wired = RdLat.solveTaps(clicks, clicks.map(c => c + 40 + rnd(8)));
    out.doubleTap = RdLat.solveTaps(clicks, clicks.flatMap(c => [c + 150, c + 150 + 40]));
    return out;
  });
  ok('Tap math finds 180 ms within 12 ms', tm.clean.ok && Math.abs(tm.clean.ms - 180) <= 12, tm.clean);
  ok('Tap math survives 2 bad taps', tm.outliers.ok && Math.abs(tm.outliers.ms - 180) <= 15, tm.outliers);
  ok('Too few taps is rejected', !tm.few.ok, tm.few);
  ok('Unsteady taps are rejected', !tm.messy.ok, tm.messy);
  ok('Wired-size latency (40 ms) found within 10 ms', tm.wired.ok && Math.abs(tm.wired.ms - 40) <= 10, tm.wired);
  ok('Double taps count once per click', tm.doubleTap.ok && Math.abs(tm.doubleTap.ms - 150) <= 12, tm.doubleTap);

  // ================= latency: estimate + syncFor + migration =================
  const sf = await pg.evaluate(() => {
    const o = {}; const sy = document.getElementById('sy');
    o.est = { total: RdLat.est.total, out: RdLat.est.out, src: RdLat.est.outSrc }; o.auto = RdLat.auto;
    sy.value = 30; sy.oninput();
    o.newTake = RdLat.syncFor({ lat: 200 }); o.oldTake = RdLat.syncFor({}); o.nullLat = RdLat.syncFor({ lat: null });
    document.getElementById('latAuto').click(); o.autoOff = RdLat.syncFor({ lat: 200 }); o.autoOffFlag = RdLat.auto;
    document.getElementById('latAuto').click(); o.autoOn = RdLat.syncFor({ lat: 200 });
    sy.value = 0; sy.oninput(); return o;
  });
  ok('Estimate is a sane number (1..800 ms)', sf.est.total > 0 && sf.est.total < 800 && !!sf.est.src, sf.est);
  ok('Auto is on by default', sf.auto === true);
  ok('syncFor: new take = its saved latency + manual trim (230)', sf.newTake === 230, sf.newTake);
  ok('syncFor: old take (no lat) = legacy + trim (30)', sf.oldTake === 30 && sf.nullLat === 30, sf);
  ok('Auto off ignores saved latency (30), back on gives 230', sf.autoOff === 30 && sf.autoOffFlag === false && sf.autoOn === 230, sf);

  // ================= latency: real record flow saves take.lat =================
  await pg.click('.tab[data-p=rec]'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { RdLat.est.out = 150; RdLat.est.total = 170; });
  await pg.click('#bRec'); await pg.waitForTimeout(1600); await pg.click('#bRec'); await pg.waitForTimeout(1500);
  const rl = await pg.evaluate(() => { const r = recs[0]; return { lat: r && r.lat, cur: RdLat.current(), name: r && r.name }; });
  ok('New take saves its latency (a number, equals the pairing at record time)', typeof rl.lat == 'number' && rl.lat > 0 && rl.lat < 800, rl);
  await pg.click('.tab[data-p="mixer"]'); await pg.waitForTimeout(400);
  ok('Mixer shows the take latency row', /Take latency: \d+ ms/.test(await pg.locator('#latTakeTxt').innerText()), await pg.locator('#latTakeTxt').innerText());
  // re-pair button
  const rp = await pg.evaluate(async () => { const r = recs[0]; document.getElementById('mxTake').value = r.id; RdLat.est.total = 260; document.getElementById('latTakeBtn').click(); await new Promise(x => setTimeout(x, 300)); return r.lat; });
  ok('Re-pair to now sets the take latency', rp === 260, rp);

  // ================= latency: export/playback really delays the song by take.lat =================
  const ex = await pg.evaluate(async () => {
    const R = 44100; const mk = async (fn, secs) => { const o = new OfflineAudioContext(1, R * secs, R), b = o.createBuffer(1, R * secs, R); fn(b.getChannelData(0)); const s = o.createBufferSource(); s.buffer = b; s.connect(o.destination); s.start(); return wav(await o.startRendering()); };
    const voice = await mk(d => { for (let i = 0; i < 300; i++) d[i] = 0.8 * Math.sin(i / 3); }, 3);       // voice click at 0 s
    const song = await mk(d => { for (let i = 0; i < 300; i++) d[i] = 0.6 * Math.sin(i / 3); }, 4);        // song click at 0 s (loops every 4 s)
    const sid = uid(); songs.unshift({ id: sid, name: 's.wav', size: song.size, type: 'audio/wav', blob: song, title: 'Click Song', artist: 'x', art: null, lyrics: '', added: Date.now() });
    const find = (d, from) => { for (let i = from; i < d.length; i++) if (Math.abs(d[i]) > 0.05) return i / 48000; return -1; };
    const out = {};
    for (const lat of [0, 200, 420]) {
      const r = { id: uid(), name: 'x', blob: voice, ext: 'wav', mime: 'audio/wav', dur: 3, bgId: sid, bgName: 'Click Song', bgOff: 0, created: Date.now(), track: 'main', baseId: null, lat };
      const ab = await renderMix(r, { song: true, ad: false, fx: false }), d = ab.getChannelData(0);
      const v = find(d, 0), s = find(d, Math.floor(0.05 * 48000));
      out[lat] = { voiceAt: v, songAt: s };
    }
    const nl = { id: uid(), name: 'x', blob: voice, ext: 'wav', mime: 'audio/wav', dur: 3, bgId: sid, bgName: 'Click Song', bgOff: 0, created: Date.now(), track: 'main', baseId: null, lat: null };
    const ab2 = await renderMix(nl, { song: true, ad: false, fx: false }); out.none = { songAt: find(ab2.getChannelData(0), Math.floor(0.05 * 48000)) };
    return out;
  });
  ok('Export lat 0: song starts with the voice', Math.abs(ex[0].songAt - ex[0].voiceAt) < 0.03 || ex[0].songAt < 0.03, ex[0]);
  ok('Export lat 200: song starts 200 ms after the voice', Math.abs(ex[200].songAt - 0.2) < 0.02, ex[200]);
  ok('Export lat 420: song starts 420 ms after the voice', Math.abs(ex[420].songAt - 0.42) < 0.02, ex[420]);
  ok('Take without lat: no extra delay', ex.none.songAt < 0.03 || ex.none.songAt < 0, ex.none);

  // ================= calibration UI end to end (simulated taps at click + 150 ms) =================
  await pg.click('.tab[data-p=rec]'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
  await pg.click('#latCalBtn'); await pg.waitForTimeout(300);
  ok('Calibrate opens the tap panel', await pg.evaluate(() => !document.getElementById('latPanel').classList.contains('hidden') && !!RdLat._cal));
  await pg.evaluate(() => { const k = RdLat._cal; k.clicks.forEach(c => { const d = c + 150 + (Math.random() * 2 - 1) * 8 - performance.now(); if (d > 0) setTimeout(() => document.getElementById('latTap').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })), d); }); });
  await pg.waitForFunction(() => !RdLat._cal, null, { timeout: 20000 }); await pg.waitForTimeout(800);
  const cal = await pg.evaluate(() => ({ cal: Object.values(RdLat.CAL), out: RdLat.est.out, src: RdLat.est.outSrc, panelHidden: document.getElementById('latPanel').classList.contains('hidden'), toasts: window.__toasts.slice(-4) }));
  ok('Calibration result ~150 ms (within 25 ms; timer jitter allowed) and saved', cal.cal.length == 1 && Math.abs(cal.cal[0] - 150) <= 25 && cal.out == cal.cal[0] && cal.src == 'tapped', cal);
  ok('Panel closes after calibration', cal.panelHidden);
  ok('Calibration is remembered after reload', await (async () => { await pg.reload(); await pg.waitForTimeout(900); return pg.evaluate(() => Object.values(JSON.parse(localStorage.getItem('rd_latcal') || '{}')).length == 1 && RdLat.est.outSrc == 'tapped'); })());
  // no taps -> clear error, nothing saved
  await pg.evaluate(() => { localStorage.removeItem('rd_latcal'); }); await pg.reload(); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));
  await pg.evaluate(() => { window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
  await pg.click('.tab[data-p=rec]'); await pg.click('#latCalBtn'); await pg.waitForFunction(() => !RdLat._cal, null, { timeout: 20000 }); await pg.waitForTimeout(500);
  const nt = await pg.evaluate(() => ({ t: window.__toasts.join('|'), n: Object.keys(RdLat.CAL).length }));
  ok('No taps: clear message, nothing saved', /Too few taps/.test(nt.t) && nt.n == 0, nt);
  // device change handler does not throw
  await pg.evaluate(() => { navigator.mediaDevices.dispatchEvent(new Event('devicechange')); }); await pg.waitForTimeout(1500);

  await pg.screenshot({ path: process.env.OUT + '/rec-lat.png', fullPage: false });
  await pg.click('.tab[data-p="mixer"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: process.env.OUT + '/mixer.png' });

  ok('no JS errors', errs.length == 0, errs.slice(0, 5));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
