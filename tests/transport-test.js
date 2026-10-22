const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = process.env.WWW, OUT = process.env.SHOTS || '/tmp';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x === undefined ? '' : JSON.stringify(x))); };
function wav(sec, sr, hz) { const n = sec * sr, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / sr) * 9000), 44 + i * 2); return b; }
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const song = path.join(os.tmpdir(), 'Test Artist - Test Beat.wav'); fs.writeFileSync(song, wav(60, 8000, 220));
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::|ERR_/.test(m.text())) errs.push(m.text()); });
  await pg.goto(url); await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));
  const bars = await pg.locator('[data-np]').count(); ok('3 bars injected (record, mixer, library)', bars == 3, bars);
  ok('drawer has back/forward', await pg.locator('#side [data-a=back]').count() == 1 && await pg.locator('#side [data-a=fwd]').count() == 1);
  ok('idle: bar says nothing playing', /Nothing playing/.test(await pg.locator('[data-np=rec] .npn').innerText()));
  // add a song
  await pg.setInputFiles('#fScan', song); await pg.waitForTimeout(800);
  ok('song in library', await pg.evaluate(() => songs.length) == 1);
  // library bar: play song via list, then skip
  await pg.click('.tab[data-p=lib]');
  await pg.evaluate(() => toggleSong(songs[0].id)); await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('side').classList.remove('show'));
  ok('library bar shows the song', /Test Beat/.test(await pg.locator('[data-np=lib] .npn').innerText()), await pg.locator('[data-np=lib] .npn').innerText());
  const dur = await pg.evaluate(() => aud.duration); ok('song duration known (60s)', Math.abs(dur - 60) < 1, dur);
  const t0 = await pg.evaluate(() => aud.currentTime);
  await pg.click('[data-np=lib] [data-a=fwd]'); await pg.waitForTimeout(300);
  const t1 = await pg.evaluate(() => aud.currentTime); ok('fwd tap = +10s', t1 - t0 > 9 && t1 - t0 < 12, [t0, t1]);
  await pg.click('[data-np=lib] [data-a=back]'); await pg.waitForTimeout(300);
  const t2 = await pg.evaluate(() => aud.currentTime); ok('back tap = -10s', t1 - t2 > 9 && t1 - t2 < 12, [t1, t2]);
  // hold scrub
  const fb = await pg.locator('[data-np=lib] [data-a=fwd]').boundingBox();
  await pg.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(1300); await pg.mouse.up();
  const t3 = await pg.evaluate(() => aud.currentTime); ok('hold fwd scrubs far (>25s ahead)', t3 - t2 > 25, [t2, t3]);
  // slider
  await pg.evaluate(() => { const k = document.querySelector('[data-np=lib] .npk'); k.value = 500; k.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(250);
  const t4 = await pg.evaluate(() => aud.currentTime); ok('slider to 50% = ~30s', Math.abs(t4 - 30) < 1.5, t4);
  // clamp at end
  await pg.evaluate(() => RDT.seek(9999)); await pg.waitForTimeout(100);
  ok('seek past end clamps', await pg.evaluate(() => aud.currentTime) < 60.01);
  await pg.evaluate(() => RDT.seek(-50)); await pg.waitForTimeout(100);
  ok('seek before start clamps to 0', await pg.evaluate(() => aud.currentTime) < 0.3);
  // pause/play
  await pg.click('[data-np=lib] [data-a=pp]'); await pg.waitForTimeout(250);
  ok('pp pauses song', await pg.evaluate(() => aud.paused));
  await pg.click('[data-np=lib] [data-a=pp]'); await pg.waitForTimeout(250);
  ok('pp resumes song', !(await pg.evaluate(() => aud.paused)));
  await pg.screenshot({ path: OUT + '/lib.png' });
  // go to record: seek to 20s, pause, then record from there
  await pg.click('.tab[data-p=rec]');
  await pg.evaluate(() => RDT.seek(20)); await pg.click('[data-np=rec] [data-a=pp]'); await pg.waitForTimeout(300);
  ok('record hint shows start at 0:20', /0:20/.test(await pg.locator('[data-np=rec] .nph').innerText()), await pg.locator('[data-np=rec] .nph').innerText());
  await pg.screenshot({ path: OUT + '/rec.png' });
  await pg.click('#bRec'); await pg.waitForTimeout(2500);
  ok('recording: song started near 20s', await pg.evaluate(() => aud.currentTime) > 21 && await pg.evaluate(() => aud.currentTime) < 24, await pg.evaluate(() => aud.currentTime));
  ok('recording: skip buttons locked', await pg.locator('[data-np=rec] [data-a=fwd]').isDisabled());
  ok('recording: slider locked', await pg.locator('[data-np=rec] .npk').isDisabled());
  const before = await pg.evaluate(() => aud.currentTime); await pg.evaluate(() => RDT.seek(5)); const after = await pg.evaluate(() => aud.currentTime);
  ok('recording: seek refused', Math.abs(after - before) < 0.5, [before, after]);
  await pg.screenshot({ path: OUT + '/recording.png' });
  await pg.click('#bRec'); await pg.waitForTimeout(1500);
  const rec = await pg.evaluate(() => { const r = recs[0]; return r && { bgOff: r.bgOff, dur: r.dur, mime: r.mime, bgName: r.bgName }; });
  ok('take saved with bgOff ~20s', rec && rec.bgOff > 19.5 && rec.bgOff < 20.5, rec);
  // mixer: auto-plays take; seek it
  await pg.waitForTimeout(800);
  ok('mixer tab active after take', await pg.locator('#p-mixer').evaluate(e => e.classList.contains('on')));
  ok('take is playing', await pg.evaluate(() => !!PB));
  const info = await pg.evaluate(() => ({ d: PB.el.duration, hasSong: PB.hasSong, song: aud.currentTime, v: PB.el.currentTime }));
  console.log('INFO take', JSON.stringify(info));
  ok('mixer bar shows the take', /Take/.test(await pg.locator('[data-np=mix] .npn').innerText()));
  ok('song follows take at bgOff', info.hasSong && Math.abs(info.song - (20 + info.v)) < 1.5, info);
  await pg.evaluate(() => RDT.seek(1.0)); await pg.waitForTimeout(500);
  const s1 = await pg.evaluate(() => ({ v: PB.el.currentTime, song: aud.currentTime, d: PB.el.duration }));
  ok('take seek to 1.0s sticks (webm w/o duration)', Math.abs(s1.v - 1.0) < 1.2 && s1.v < 2.5, s1);
  ok('song re-synced after take seek', Math.abs(s1.song - (20 + s1.v)) < 1.2, s1);
  await pg.click('[data-np=mix] [data-a=back]'); await pg.waitForTimeout(400);
  const s2 = await pg.evaluate(() => ({ v: PB.el.currentTime, song: aud.currentTime }));
  ok('back at start clamps to 0', s2.v < 1.2, s2);
  await pg.click('[data-np=mix] [data-a=pp]'); await pg.waitForTimeout(300);
  const ps = await pg.evaluate(() => ({ v: PB.el.paused, s: aud.paused }));
  ok('take pause pauses voice + song', ps.v && ps.s, ps);
  await pg.click('[data-np=mix] [data-a=pp]'); await pg.waitForTimeout(400);
  const rs = await pg.evaluate(() => ({ v: PB.el.paused, s: aud.paused }));
  ok('take resume plays voice + song', !rs.v && !rs.s, rs);
  await pg.screenshot({ path: OUT + '/mixer.png' });
  // stream preview hook
  await pg.evaluate(() => { stopPlay(); });
  ok('RDpv hook exists', await pg.evaluate(() => typeof window.RDpv == 'function' && window.RDpv() === null));
  ok('no JS errors', errs.length == 0, errs);
  console.log(pass + ' pass, ' + fail + ' fail');
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
