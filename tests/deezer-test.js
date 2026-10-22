const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.WWW;
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(path.join(ROOT, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : u.endsWith('.css') ? 'text/css' : u.endsWith('.png') ? 'image/png' : 'text/html' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n); };
const CORS = { 'access-control-allow-origin': '*' };
const TR = (id, t, a, d) => ({ id, title: t, title_short: t, artist: { name: a }, duration: d, preview: 'https://cdns-preview.test/' + id + '.mp3', album: { title: 'Alb' + id, cover_medium: 'https://cdn.test/c' + id + '.jpg', cover_xl: 'https://cdn.test/x' + id + '.jpg' } });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  // ---------- Browser build (no native) ----------
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const hits = []; let mode = 'ok';
  await pg.route('https://api.deezer.com/**', r => {
    const u = r.request().url(); hits.push(u);
    if (mode == 'down') return r.abort();
    if (mode == 'err') return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: { type: 'Exception', message: 'Quota limit exceeded' } }) });
    if (/chart\/116/.test(u)) return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ data: [TR(9, 'Rap One', 'MC A', 200)] }) });
    if (/chart\/0/.test(u)) return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ data: [TR(8, 'Pop One', 'Singer', 180)] }) });
    r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ data: [TR(1, 'Lucid Dreams', 'Juice WRLD', 239), TR(2, 'Bad <b>Title</b>', 'X', 100), { id: 3 }, TR(4, 'No Preview', 'Y', 90)].map(t => t.id == 4 ? { ...t, preview: '' } : t) }) });
  });
  await pg.route('https://cdn.test/**', r => r.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }));
  await pg.goto(url); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));
  await pg.click('.tab[data-p="lib"]'); await pg.waitForTimeout(150);
  ok('Deezer card present', await pg.locator('#dzQ').count() == 1 && await pg.locator('.dzcard').count() == 1);
  ok('RDstream + RDdz exposed', await pg.evaluate(() => !!(window.RDstream && window.RDdz)));
  await pg.fill('#dzQ', 'juice wrld'); await pg.click('#dzGo'); await pg.waitForTimeout(400);
  ok('search hit /search with q', hits.some(h => /\/search\?limit=25&q=juice%20wrld/.test(h)));
  ok('3 valid rows (junk row dropped)', await pg.locator('#dzOut .item').count() == 3);
  ok('title is HTML-escaped (no injected tag)', await pg.locator('#dzOut b').count() == 0 && /Bad <b>Title<\/b>/.test(await pg.locator('#dzOut .n').nth(1).innerText()));
  ok('cover image rendered', await pg.locator('#dzOut img.dzc').count() == 3);
  ok('no-preview row has disabled play', await pg.locator('[data-dpv="4"]').isDisabled());
  ok('duration shown 3:59', /3:59/.test(await pg.locator('#dzOut .n').first().innerText()));
  // chips
  await pg.click('[data-dz="rap"]'); await pg.waitForTimeout(300);
  ok('Rap chart uses genre 116', hits.some(h => /chart\/116\/tracks/.test(h)) && /Rap One/.test(await pg.locator('#dzOut').innerText()));
  ok('chip highlighted', await pg.locator('[data-dz="rap"]').evaluate(e => e.classList.contains('on')));
  await pg.click('[data-dz="top"]'); await pg.waitForTimeout(300);
  ok('Top chart loads', /Pop One/.test(await pg.locator('#dzOut').innerText()) && await pg.locator('[data-dz="rap"]').evaluate(e => !e.classList.contains('on')));
  // preview toggle
  await pg.fill('#dzQ', 'x'); await pg.click('#dzGo'); await pg.waitForTimeout(300);
  const WAV = (() => { const n = 8000 * 5, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
  await pg.route('https://cdns-preview.test/**', r => r.fulfill({ status: 200, headers: CORS, contentType: 'audio/wav', body: WAV }));
  await pg.click('[data-dpv="1"]'); await pg.waitForTimeout(100);
  ok('preview button shows stop', (await pg.locator('[data-dpv="1"]').innerText()).trim() == '■');
  await pg.click('[data-dpv="1"]'); await pg.waitForTimeout(100);
  ok('second tap stops preview', (await pg.locator('[data-dpv="1"]').innerText()).trim() == '▶');
  // browser add (no native): preview CDN blocked in test -> must fail cleanly, button re-enabled
  await pg.route('https://cdns-preview.test/**', r => r.abort());
  await pg.click('[data-dadd="1"]'); await pg.waitForTimeout(500);
  ok('browser add fails cleanly, button usable again', await pg.locator('[data-dadd="1"]').isEnabled() && (await pg.locator('[data-dadd="1"]').innerText()).trim() == '＋');
  ok('library unchanged after failed add', await pg.evaluate(() => songs.length) == 0);
  // browser add with preview allowed -> saves tagged preview
  await pg.unroute('https://cdns-preview.test/**');
  await pg.route('https://cdns-preview.test/**', r => r.fulfill({ status: 200, headers: CORS, contentType: 'audio/mpeg', body: Buffer.alloc(2000, 1) }));
  await pg.click('[data-dadd="1"]'); await pg.waitForTimeout(600);
  const s0 = await pg.evaluate(() => songs[0] && { t: songs[0].title, a: songs[0].artist });
  ok('preview saved with honest "(30s preview)" label', s0 && /30s preview/.test(s0.t) && s0.a == 'Juice WRLD');
  // errors
  mode = 'err'; await pg.fill('#dzQ', 'z'); await pg.click('#dzGo'); await pg.waitForTimeout(300);
  ok('API error shown, not a crash', /Could not reach Deezer/.test(await pg.locator('#dzOut').innerText()) && /Quota/.test(await pg.locator('#dzOut').innerText()));
  mode = 'down'; await pg.click('#dzGo'); await pg.waitForTimeout(500);
  ok('network down shown, not a crash', /Could not reach Deezer/.test(await pg.locator('#dzOut').innerText()));
  await pg.fill('#dzQ', '   '); const n0 = hits.length; await pg.click('#dzGo'); await pg.waitForTimeout(150);
  ok('blank query makes no request', hits.length == n0);
  // pick() unit tests
  const pk = await pg.evaluate(() => {
    const P = RDdz.pick, it = [{ title: 'Song (Live)', dur: 240, url: 'live' }, { title: 'Song', dur: 252, url: 'studio-off' }, { title: 'Song - slowed + reverb', dur: 239, url: 'slow' }, { title: 'Song', dur: 240, url: 'studio-exact' }];
    return [P(it, 239).url, P([it[0]], 240).url, P([], 10)];
  });
  ok('pick prefers non-live/non-slowed, nearest length', pk[0] == 'studio-exact');
  ok('pick falls back to a live version if it is all there is', pk[1] == 'live');
  ok('pick on empty list returns null', pk[2] === null);
  await pg.click('.tab[data-p="lib"]'); await pg.screenshot({ path: 'shots/deezer-browser.png', fullPage: true });
  ok('no page errors (browser build)', errs.length == 0); if (errs.length) console.log(errs);
  await ctx.close();
  // ---------- Native build (mock Capacitor + Raindrops plugin) ----------
  ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); pg = await ctx.newPage(); const errs2 = []; pg.on('pageerror', e => errs2.push(e.message));
  await pg.addInitScript(() => {
    window.__yt = { searches: [], gets: [] };
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    window.Capacitor = { isNativePlatform: () => true, convertFileSrc: p => p, Plugins: {
      CapacitorHttp: { get: async o => ({ status: 200, data: { data: [{ id: 7, title: 'Native Row', artist: { name: 'Nat' }, duration: 239, preview: '', album: { title: 'A', cover_medium: 'https://cdn.test/c7.jpg' } }] } }) },
      Raindrops: {
        ytSearch: async o => { window.__yt.searches.push(o); if (o.kind == 'music_songs') return { items: [{ title: 'Native Row (Live)', dur: 239, url: 'u-live', by: 'x' }, { title: 'Native Row', dur: 241, url: 'u-good', by: 'x' }] }; return { items: [] }; },
        ytGet: async o => { window.__yt.gets.push(o); return { path: '/blob.m4a', mime: 'audio/mp4', title: 'YT TITLE', artist: 'YT ARTIST', name: 'yt.m4a', art: png }; },
        ytClean: async () => ({}), addListener: async () => ({ remove() {} }), batteryStatus: async () => ({ ignoring: true })
      } } };
    const of = window.fetch; window.fetch = (u, o) => (u === '/blob.m4a' ? Promise.resolve(new Response(new Blob([new Uint8Array(3000)], { type: 'audio/mp4' }))) : /^https:\/\/api\.deezer/.test(String(u)) ? Promise.reject(new TypeError('CORS')) : /cdn\.test/.test(String(u)) ? Promise.resolve(new Response(new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))], { type: 'image/png' }))) : of(u, o));
  });
  await pg.goto(url); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));
  await pg.click('.tab[data-p="lib"]'); await pg.fill('#dzQ', 'native'); await pg.click('#dzGo'); await pg.waitForTimeout(500);
  ok('fetch blocked (CORS) -> falls back to CapacitorHttp', /Native Row/.test(await pg.locator('#dzOut').innerText()));
  await pg.click('[data-dadd="7"]'); await pg.waitForTimeout(900);
  const y = await pg.evaluate(() => window.__yt), sg = await pg.evaluate(() => songs[0] && { t: songs[0].title, a: songs[0].artist, art: !!songs[0].art, n: songs[0].name });
  ok('YouTube searched with "artist title"', y.searches[0] && y.searches[0].q == 'Nat Native Row' && y.searches[0].kind == 'music_songs');
  ok('chose the studio cut, not the Live one', y.gets.length == 1 && y.gets[0].url == 'u-good');
  ok('saved with Deezer title + artist (not YouTube\'s)', sg && sg.t == 'Native Row' && sg.a == 'Nat' && sg.n == 'Nat - Native Row.m4a');
  ok('saved with Deezer cover art', sg && sg.art === true);
  ok('button shows done', (await pg.locator('[data-dadd="7"]').innerText()).trim() == '✓');
  ok('no page errors (native build)', errs2.length == 0); if (errs2.length) console.log(errs2);
  await b.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
