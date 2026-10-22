const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.WWW, OUT = process.env.SHOTS || '/tmp', SEC = +(process.env.SEC || 300);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message)); pg.on('console', m => { if (m.type() == 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  pg.on('dialog', d => { console.log('DIALOG', d.message().replace(/\n/g, ' ')); d.dismiss(); });
  await pg.goto(url); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));
  const caps = await pg.evaluate(async () => ({ ve: !!window.VideoEncoder, ae: !!window.AudioEncoder, avc: (await VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width: 480, height: 480, bitrate: 4e5, framerate: 10 })).supported, vp9: (await VideoEncoder.isConfigSupported({ codec: 'vp09.00.10.08', width: 480, height: 480, bitrate: 4e5, framerate: 10 })).supported, aac: AudioEncoder ? (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 })).supported : false }));
  console.log('CAPS', JSON.stringify(caps));
  await pg.evaluate(async (SEC) => {
    const sr = 22050, n = SEC * sr, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const t = i / sr, e = Math.max(0, Math.sin(t * 3)) ; v.setInt16(44 + i * 2, Math.round((Math.sin(2 * Math.PI * (180 + 60 * Math.sin(t)) * t) * e * 9000 + (Math.random() - .5) * 1500)), true) }
    const blob = new Blob([buf], { type: 'audio/wav' });
    recs.unshift({ id: uid(), name: 'Long take', blob, ext: 'wav', mime: 'audio/wav', dur: SEC, bgId: null, bgName: '', bgOff: 0, created: Date.now(), track: 'main', baseId: null }); rRecs();
  }, SEC);
  await pg.evaluate(() => openE(recs[0].id)); await pg.click('#ef .chip[data-f=vid]');
  const t0 = Date.now(); const dlp = pg.waitForEvent('download', { timeout: 280000 }).catch(e => null);
  await pg.click('#eGo');
  let peak = 0, lastP = '', tick = setInterval(async () => { try { const mem = await pg.evaluate(() => Math.round(performance.memory.usedJSHeapSize/1048576)); peak = Math.max(peak, mem); const p = await pg.locator('#ep2').innerText(); if (p && p !== lastP) { lastP = p; console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', p) } } catch (e) {} }, 1500);
  if (process.env.CANCEL) { await pg.waitForTimeout(4000); await pg.click('#eX'); await pg.waitForTimeout(2500); console.log('CANCEL toast:', await pg.locator('#toast').innerText(), '| busy:', await pg.evaluate(() => busy), '| modal open:', await pg.locator('#exp').evaluate(e => e.classList.contains('show'))); await b.close(); srv.close(); return; }
  const d = await dlp; clearInterval(tick);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!d) { console.log('NO DOWNLOAD after', secs, 's'); await pg.screenshot({ path: OUT + '/exp-fail.png' }); await b.close(); srv.close(); process.exit(1); }
  const f = OUT + '/export-test.mp4'; await d.saveAs(f);
  console.log('PEAK JS heap MB', peak); console.log('DONE video of', SEC, 's in', secs, 's =', (SEC / secs).toFixed(1) + 'x realtime;', fs.statSync(f).size, 'bytes', d.suggestedFilename());
  await b.close(); srv.close();
})();
