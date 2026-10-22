// V1.5.0 tests: 4-band EQ + Voice focus layer (real audio math), Voice analyzer, Gemini ears (mocked Gemini, no live key).
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.WWW;
const srv = http.createServer((q, r) => { let f = path.join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x !== undefined ? JSON.stringify(x) : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const hits = [];
  await pg.route('https://generativelanguage.googleapis.com/**', async route => {
    const u = route.request().url(), body = route.request().postData(); hits.push({ u, key: route.request().headers()['x-goog-api-key'], body });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const J = (st, o) => route.fulfill({ status: st, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/models?')) return J(200, { models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }] });
    return J(200, { candidates: [{ content: { parts: [{ text: 'Raise **Mid** by 3 dB first.\nThen Voice focus layer to 40%.' }] }, finishReason: 'STOP' }] });
  });
  await pg.goto(url); await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));

  // ---- mixer controls exist and default dry ----
  ok('EQ sliders exist', await pg.locator('#m-qb, #m-ql, #m-qm, #m-qh').count() == 4);
  ok('Voice focus slider exists', await pg.locator('#m-vl').count() == 1);
  ok('defaults are dry', await pg.evaluate(() => MX.isDry()));
  ok('analyzer card in mixer', await pg.locator('#anCard').count() == 1);
  ok('Gemini ears card in Studio AI', await pg.locator('#gxCard').count() == 1);

  // ---- real audio math: EQ and voice layer change the sound ----
  const dsp = await pg.evaluate(async () => {
    const SRt = 48000, rms = (x, a) => { let s = 0, n = 0; for (let i = a; i < x.length; i++) { s += x[i] * x[i]; n++; } return Math.sqrt(s / n); };
    async function run(hz, set) {
      ['qb', 'ql', 'qm', 'qh', 'vl'].forEach(k => MX.put(k, 0)); Object.entries(set).forEach(([k, v]) => MX.put(k, v));
      const off = new OfflineAudioContext(1, SRt, SRt), buf = off.createBuffer(1, SRt, SRt), d = buf.getChannelData(0);
      for (let i = 0; i < SRt; i++) d[i] = 0.1 * Math.sin(2 * Math.PI * hz * i / SRt);
      const s = off.createBufferSource(); s.buffer = buf; const c = await MX.build(off); s.connect(c.input); c.output.connect(off.destination); s.start();
      const r = await off.startRendering(); return 20 * Math.log10(rms(r.getChannelData(0), 9600));
    }
    const o = {};
    o.bass0 = await run(100, {}); o.bass12 = await run(100, { qb: 12 });
    o.mid0 = await run(2000, {}); o.mid6 = await run(2000, { qm: 6 }); o.midCut = await run(2000, { qm: -6 });
    o.hi0 = await run(8000, {}); o.hi6 = await run(8000, { qh: 6 });
    o.low1k0 = await run(500, {}); o.low1k6 = await run(500, { ql: 6 });
    o.vl0 = await run(2000, {}); o.vl100 = await run(2000, { vl: 100 });
    o.vlLow0 = await run(60, {}); o.vlLow100 = await run(60, { vl: 100 });
    ['qb', 'ql', 'qm', 'qh', 'vl'].forEach(k => MX.put(k, 0));
    o.dryAgain = MX.isDry();
    return o;
  });
  console.log('DSP', JSON.stringify(Object.fromEntries(Object.entries(dsp).map(([k, v]) => [k, typeof v == 'number' ? Math.round(v * 10) / 10 : v]))));
  ok('Bass +12 lifts a 100 Hz tone by 8+ dB', dsp.bass12 - dsp.bass0 > 8, dsp);
  ok('Mid +6 lifts 2 kHz by about 6 dB', dsp.mid6 - dsp.mid0 > 4.5 && dsp.mid6 - dsp.mid0 < 7.5, dsp);
  ok('Mid -6 cuts 2 kHz', dsp.midCut - dsp.mid0 < -4.5, dsp);
  ok('High +6 lifts 8 kHz', dsp.hi6 - dsp.hi0 > 4, dsp);
  ok('Low-mid +6 lifts 500 Hz', dsp.low1k6 - dsp.low1k0 > 4, dsp);
  ok('Voice focus layer at 100% lifts the voice range (2 kHz) by 2 to 7 dB', dsp.vl100 - dsp.vl0 > 2 && dsp.vl100 - dsp.vl0 < 7, dsp);
  ok('Voice focus layer leaves deep bass alone (60 Hz)', Math.abs(dsp.vlLow100 - dsp.vlLow0) < 1.5, dsp);
  ok('all dry again after reset', dsp.dryAgain);

  // ---- synth a voice (mid heavy, bursts) and a bass-heavy song, put them in the app ----
  await pg.evaluate(async () => {
    const R = 44100, secs = 14;
    const mk = async fn => { const o = new OfflineAudioContext(1, R * secs, R), b = o.createBuffer(1, R * secs, R), d = b.getChannelData(0); fn(d, R); const s = o.createBufferSource(); s.buffer = b; s.connect(o.destination); s.start(); return wav(await o.startRendering()); };
    const voice = await mk((d, R) => { for (let i = 0; i < d.length; i++) { const t = i / R, env = (t % 2) < 1.2 ? 1 : 0; d[i] = env * (0.25 * Math.sin(2 * Math.PI * 1000 * t) + 0.2 * Math.sin(2 * Math.PI * 2000 * t) + 0.04 * Math.sin(2 * Math.PI * 150 * t)); } });
    const song = await mk((d, R) => { for (let i = 0; i < d.length; i++) { const t = i / R; d[i] = 0.5 * Math.sin(2 * Math.PI * 80 * t) + 0.1 * Math.sin(2 * Math.PI * 400 * t) + 0.02 * Math.sin(2 * Math.PI * 1500 * t); } });
    const sid = uid(), rid = uid();
    songs.unshift({ id: sid, name: 'testbeat.wav', size: song.size, type: 'audio/wav', blob: song, title: 'Test Beat', artist: 'Tester', art: null, lyrics: '', added: Date.now() });
    recs.unshift({ id: rid, name: 'Take test', blob: voice, ext: 'wav', mime: 'audio/wav', dur: secs, bgId: sid, bgName: 'Test Beat', bgOff: 0, created: Date.now(), track: 'main', baseId: null });
    recs.unshift({ id: uid(), name: 'Take no song', blob: voice, ext: 'wav', mime: 'audio/wav', dur: secs, bgId: null, bgName: '', bgOff: 0, created: Date.now() - 1, track: 'main', baseId: null });
    rSongs(); rRecs(); window.__rid = rid; window.__sid = sid;
  });

  // ---- analyzer: voice vs song ----
  await pg.click('.tab[data-p="mixer"]'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const s = document.getElementById('mxTake'); s.value = window.__rid; });
  await pg.click('#anRun'); await pg.waitForFunction(() => document.querySelectorAll('#anOut .anres').length == 4 || document.querySelector('#anOut .aierr'), null, { timeout: 30000 });
  const an = await pg.evaluate(() => ({ err: (document.querySelector('#anOut .aierr') || {}).textContent, txt: document.getElementById('anOut').innerText }));
  console.log(an.txt.replace(/\n+/g, ' | ').slice(0, 700));
  ok('analyzer ran without error', !an.err, an.err);
  const res = await pg.evaluate(() => RdEars.analyze(recs.find(r => r.id == window.__rid)));
  const by = Object.fromEntries(res.bands.map(x => [x.k, x]));
  ok('song detected', res.song === true);
  ok('bass: song is much louder than voice', by.qb.diff < -12, by.qb);
  ok('mid: voice louder than song', by.qm.diff > 5, by.qm);
  ok('low-mid: voice is below song', by.ql.diff < 0, by.ql);
  ok('every boost hint follows the rule: target minus gap, 1 to 8 dB, only when 2+ dB short', res.bands.every((x, i) => { const need = [-10, -3, 2, 0][i] - x.diff; return need >= 2 ? x.boost == Math.max(1, Math.min(8, Math.round(need))) : x.boost == 0; }), res.bands);
  ok('mid says no boost needed', by.qm.boost == 0, by.qm);
  const noSong = await pg.evaluate(() => RdEars.analyze(recs.find(r => r.name == 'Take no song')));
  ok('no song -> levels only, no hints', noSong.song === false && noSong.bands.every(x => x.diff === null && !x.say));
  await pg.screenshot({ path: 'shots/10-analyzer.png', fullPage: false });
  await pg.evaluate(() => document.getElementById('anCard').scrollIntoView());
  await pg.screenshot({ path: 'shots/11-analyzer-card.png' });

  // apply suggested boost (only if the tool found a need; force a case by faking)
  await pg.evaluate(() => { const a = { rid: window.__rid, secs: 5, song: true, songName: 'X', bands: [{ k: 'qb', n: 'Bass', lo: 60, hi: 250, v: -40, s: -20, diff: -20, need: 10, boost: 8, say: 'Boost about +8 dB' }, { k: 'ql', n: 'Low-mid', lo: 250, hi: 800, v: -30, s: -25, diff: -5, need: 2, boost: 2, say: 'Boost about +2 dB' }, { k: 'qm', n: 'Mid', lo: 800, hi: 3000, v: -20, s: -30, diff: 10, need: -8, boost: 0, say: 'Strong here, no boost needed' }, { k: 'qh', n: 'High', lo: 3000, hi: 10000, v: -50, s: -50, diff: 0, need: 0, boost: 0, say: 'Balanced' }] }; window.__fake = a; });
  // live meter while a take plays
  await pg.evaluate(() => playR(window.__rid)); await pg.waitForTimeout(1500);
  const live = await pg.evaluate(() => ({ st: document.getElementById('anSt').textContent, mid: parseFloat(document.getElementById('anB_qm').style.width) || 0, bass: parseFloat(document.getElementById('anB_qb').style.width) || 0, pb: !!PB }));
  ok('live meter shows while a take plays', live.pb && live.st == 'live' && live.mid > 5, live);
  await pg.evaluate(() => stopPlay()); await pg.waitForTimeout(400);
  ok('live meter resets after stop', await pg.evaluate(() => document.getElementById('anSt').textContent == '' && document.getElementById('anB_qm').style.width == '0%'));

  // ---- EQ slider moves live state and survives a preset click ----
  await pg.evaluate(() => { const e = document.getElementById('m-qm'); e.value = 5; e.oninput(); });
  ok('Mid slider writes state', await pg.evaluate(() => MX.state.qm == 5 && !MX.isDry()));
  await pg.evaluate(() => document.querySelector('#mxPre .chip[data-v=clean]').click());
  ok('preset keeps your EQ', await pg.evaluate(() => MX.state.qm == 5));
  await pg.evaluate(() => document.getElementById('eq4Reset').click());
  ok('Reset EQ zeroes the four bands', await pg.evaluate(() => !MX.state.qb && !MX.state.ql && !MX.state.qm && !MX.state.qh));
  await pg.evaluate(() => document.querySelector('#mxPre .chip[data-v=flat]').click());

  // ---- Gemini ears ----
  await pg.click('.tab[data-p="ai"]'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { document.getElementById('gxCard').open = true; });
  await pg.waitForTimeout(100);
  ok('take list filled', await pg.locator('#gxTake option').count() >= 2);
  ok('audio switch is OFF by default', await pg.evaluate(() => !document.getElementById('gxAud').classList.contains('on')));
  ok('library/recordings/numbers ON by default', await pg.evaluate(() => ['gxLib', 'gxRec', 'gxNum'].every(i => document.getElementById(i).classList.contains('on'))));
  const before = hits.length;
  await pg.click('#gxGo'); await pg.waitForTimeout(300);
  ok('no key -> no Gemini call', hits.length == before);
  await pg.fill('#aiKeyIn', 'TESTKEY123'); await pg.click('#aiCheck'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('gxTake').value = window.__rid; });
  await pg.fill('#gxQ', 'Is my voice buried in the chorus?');
  const n0 = hits.length;
  await pg.click('#gxGo'); await pg.waitForSelector('#gxOut .aib', { timeout: 30000 });
  const call1 = hits.slice(n0).find(h => /generateContent/.test(h.u));
  const body1 = JSON.parse(call1.body), text1 = body1.contents[0].parts[0].text;
  ok('request has the key header, not in the URL', call1.key == 'TESTKEY123' && !call1.u.includes('TESTKEY'));
  ok('library list was shared', /MY LIBRARY/.test(text1) && /Test Beat - Tester/.test(text1));
  ok('recordings list was shared', /MY RECORDINGS/.test(text1) && /Take test/.test(text1));
  ok('band numbers were shared', /MEASURED/.test(text1) && /Bass 60-250 Hz: my voice/.test(text1) && /gap/.test(text1));
  ok('question was shared', /buried in the chorus/.test(text1));
  ok('NO audio sent while the switch is off', body1.contents[0].parts.length == 1 && !/inlineData/.test(call1.body));
  ok('prompt tells Gemini no clip is attached', /No audio clip is attached/.test(text1));
  ok('system prompt forbids claiming to hear audio', /never claim you heard anything/.test(body1.systemInstruction.parts[0].text));
  const outTxt = await pg.evaluate(() => document.getElementById('gxOut').innerText);
  ok('answer shown, says no audio sent', /Raise Mid by 3 dB/.test(outTxt) && /no audio was sent/.test(outTxt), outTxt);
  await pg.screenshot({ path: 'shots/12-gemini-ears-text.png', fullPage: true });

  // switches off -> data not sent
  await pg.evaluate(() => { ['gxLib', 'gxRec', 'gxNum'].forEach(i => document.getElementById(i).click()); });
  const n1 = hits.length; await pg.click('#gxGo'); await pg.waitForFunction(() => /generateContent/.test('x') || true); await pg.waitForTimeout(1200);
  const call2 = hits.slice(n1).find(h => /generateContent/.test(h.u)), text2 = JSON.parse(call2.body).contents[0].parts[0].text;
  ok('library OFF -> titles not sent', !/MY LIBRARY/.test(text2) && !/Test Beat - Tester/.test(text2));
  ok('recordings OFF -> list not sent', !/MY RECORDINGS/.test(text2));
  ok('numbers OFF -> no measurements sent', !/MEASURED/.test(text2));
  ok('the chosen take is still named', /TAKE I WANT HEARD: Take test/.test(text2));

  // audio ON (accept the confirm) -> clip is attached
  pg.once('dialog', d => d.accept());
  await pg.evaluate(() => document.getElementById('gxAud').click());
  ok('audio switch turned ON after confirm', await pg.evaluate(() => document.getElementById('gxAud').classList.contains('on')));
  await pg.evaluate(() => { ['gxLib', 'gxRec', 'gxNum'].forEach(i => document.getElementById(i).click()); });
  const n2 = hits.length; await pg.click('#gxGo'); await pg.waitForFunction(() => /heard a/.test(document.getElementById('gxOut').innerText), null, { timeout: 40000 });
  const call3 = hits.slice(n2).find(h => /generateContent/.test(h.u)), b3 = JSON.parse(call3.body), parts3 = b3.contents[0].parts;
  ok('audio part attached as WAV', parts3.length == 2 && parts3[1].inlineData && parts3[1].inlineData.mimeType == 'audio/wav');
  const raw = Buffer.from(parts3[1].inlineData.data, 'base64');
  ok('attachment is a real RIFF/WAVE file', raw.slice(0, 4).toString() == 'RIFF' && raw.slice(8, 12).toString() == 'WAVE', raw.slice(0, 12).toString());
  const sr = raw.readUInt32LE(24), ch = raw.readUInt16LE(22), dataLen = raw.readUInt32LE(40);
  ok('clip is mono 16 kHz', sr == 16000 && ch == 1, { sr, ch });
  ok('clip is 14 s of audio (take length) and under 1.2 MB', Math.abs(dataLen / 2 / 16000 - 14) < 0.2 && raw.length < 1.2e6, { secs: dataLen / 2 / 16000, bytes: raw.length });
  // clip has real content: voice + song (80 Hz bass in the song -> energy must exist)
  const samples = new Int16Array(raw.buffer, raw.byteOffset + 44, (raw.length - 44) >> 1); let pk = 0; for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > pk) pk = a; }
  ok('clip is not silence', pk > 3000, pk);
  ok('prompt says a clip is attached', /An audio clip is attached: 14 s, my voice with the backing song/.test(parts3[0].text), parts3[0].text.slice(-400));
  // clip length slider: 30 -> 60 s on a 14 s take still gives the whole take, and a 300 s cap is respected
  const lenRes = await pg.evaluate(async () => { const r = recs.find(x => x.id == window.__rid); const a = await RdEars.makeClip(r, false, 0, 300), b2 = await RdEars.makeClip(r, false, 0, 5); return { a: a.secs, b: b2.secs, bytes: a.bytes }; });
  ok('length 300 gives the whole 14 s take', lenRes.a == 14, lenRes);
  ok('length below 30 is raised to 30 (take is 14 s so 14)', lenRes.b == 14, lenRes);
  await pg.evaluate(() => { const e = document.getElementById('gxLn'); e.value = 60; e.oninput(); });
  ok('length label updates', await pg.evaluate(() => document.getElementById('gxLnV').textContent == '60'));
  // song switch off -> voice only clip
  await pg.evaluate(() => document.getElementById('gxSong').click());
  const n3 = hits.length; await pg.click('#gxGo'); await pg.waitForFunction(() => /voice only|heard a/.test(document.getElementById('gxOut').innerText)); await pg.waitForTimeout(1500);
  const call4 = hits.slice(n3).find(h => /generateContent/.test(h.u)), t4 = JSON.parse(call4.body).contents[0].parts[0].text;
  ok('song switch off -> "my voice only" clip', /my voice only/.test(t4), t4.slice(-300));
  // decline the confirm -> stays off
  await pg.evaluate(() => document.getElementById('gxAud').click());
  pg.once('dialog', d => d.dismiss());
  await pg.evaluate(() => document.getElementById('gxAud').click());
  ok('declining the confirm leaves audio OFF', await pg.evaluate(() => !document.getElementById('gxAud').classList.contains('on') && LS.get('rd_gx_aud', true) === false));
  // save to notes
  const nn = await pg.evaluate(() => notes.length); await pg.click('#gxSave'); ok('Save to Notes works', await pg.evaluate(n => notes.length == n + 1 && /Raise/.test(notes[0].b), nn));
  await pg.screenshot({ path: 'shots/13-gemini-ears-audio.png', fullPage: true });

  // old things still alive
  ok('Studio AI modes still work', await pg.evaluate(() => { document.querySelector('#aiSeg button[data-m=chat]').click(); return !document.getElementById('ai-chat').classList.contains('hidden'); }));
  ok('no JS errors', errs.length == 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
