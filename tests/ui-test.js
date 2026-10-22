const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.WWW;
const srv = http.createServer((q, r) => { let f = path.join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() == 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const MODELS = ['gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-3.8-flash-lite', 'gemini-3.8-flash-image'].map(n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] }));
  const hits = [];
  await pg.route('https://generativelanguage.googleapis.com/**', async route => {
    const u = route.request().url(), body = route.request().postData(); hits.push({ u, key: route.request().headers()['x-goog-api-key'], body });
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (route.request().method() == 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const J = (st, o) => route.fulfill({ status: st, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/models?')) return J(200, { models: MODELS });
    const txt = JSON.parse(body).contents.map(c => c.parts[0].text).join(' ');
    let out;
    if (/ad-lib ideas/.test(txt)) out = JSON.stringify([{ adlib: 'Yeah, yeah', where: 'Right after the word "gone"', how: 'Low and breathy, panned left' }, { adlib: 'Ooh-woah', where: 'Echo the last two words, softer', how: 'Melodic, rising pitch' }, { adlib: 'Skrrt', where: 'Between bar 2 and 3', how: 'Sharp, loud, short' }, { adlib: 'Ayy!', where: 'On the downbeat of the hook', how: 'Full energy' }]);
    else if (/Their library/.test(txt)) out = JSON.stringify({ library: [{ i: 1, why: 'Slow piano keeps the pain up front.' }, { i: 99, why: 'bogus index' }, { i: 1, why: 'dupe' }], search: [{ q: 'sad piano trap instrumental', why: 'Matches the mood.' }, { q: 'melodic rain beat 140bpm', why: 'Rainy, slow-burn drums.' }] });
    else out = 'Start with the **feeling**, then pick one image. Try: "I kept the light on for a ghost".';
    return J(200, { candidates: [{ content: { parts: [{ text: out }] }, finishReason: 'STOP' }] });
  });
  await pg.goto(url); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.getElementById('gate').classList.remove('show'));
  // entry buttons exist
  ok('record tab has AI button', await pg.locator('#aiAdBtn').count() == 1);
  await pg.screenshot({ path: 'shots/01-record.png' });
  // Studio AI tab, no key
  await pg.click('.tab[data-p="ai"]'); await pg.waitForTimeout(200);
  ok('AI panel shows', await pg.locator('#p-ai').evaluate(e => e.classList.contains('on')));
  ok('no key -> status says off', /off/i.test(await pg.locator('#aiStT').innerText()));
  ok('no key -> settings open', await pg.locator('#aiSet').evaluate(e => e.open));
  await pg.screenshot({ path: 'shots/02-ai-nokey.png', fullPage: true });
  // action with no key must not call API
  await pg.fill('#aiLine', 'I kept the light on but you were gone'); await pg.click('#aiAdGo');
  ok('no key -> no API call', hits.length == 0);
  // key + check
  await pg.fill('#aiKeyIn', 'TESTKEY123'); await pg.click('#aiCheck'); await pg.waitForTimeout(400);
  ok('check key lists models', hits.some(h => h.u.includes('/models?')) && hits[0].key == 'TESTKEY123');
  ok('status ready', /ready/i.test(await pg.locator('#aiStT').innerText()));
  ok('image model hidden from picker', !(await pg.locator('#aiModel option').allInnerTexts()).some(t => /image/.test(t)));
  ok('key stored locally', await pg.evaluate(() => JSON.parse(localStorage.getItem('rd_gk')) == 'TESTKEY123'));
  await pg.evaluate(() => document.getElementById('aiSet').open = false);
  // ad-libs
  await pg.click('#aiAdGo'); await pg.waitForSelector('.aistamp', { timeout: 5000 }); await pg.waitForTimeout(700);
  ok('4 ad-lib stamps', await pg.locator('.aistamp').count() == 4);
  ok('uses auto model', hits.some(h => h.u.includes('gemini-3.8-flash:generateContent')));
  ok('line + vibe sent', hits.some(h => (h.body || '').includes('I kept the light on') && (h.body || '').includes('hype')));
  await pg.screenshot({ path: 'shots/03-adlibs.png', fullPage: true });
  await pg.click('#aiAdAll'); ok('save all -> note created', await pg.evaluate(() => notes.length == 1 && /Yeah, yeah/.test(notes[0].b)));
  // vibe change
  await pg.locator('#aiVibe .chip[data-v="dark"]').click(); ok('vibe chip persists', await pg.evaluate(() => JSON.parse(localStorage.getItem('rd_aivibe')) == 'dark'));
  // beats with a seeded library
  await pg.evaluate(() => { songs = [{ id: 11, title: 'Rainy Streets', artist: 'Producer A', name: 'a.mp3', size: 1e6, blob: new Blob(['x'], { type: 'audio/mpeg' }) }, { id: 12, title: 'Slow Piano Pain', artist: 'Producer B', name: 'b.mp3', size: 1e6, blob: new Blob(['x'], { type: 'audio/mpeg' }) }]; rSongs(); });
  await pg.click('#aiSeg [data-m="beat"]'); await pg.fill('#aiBrief', 'missing someone I lost'); await pg.click('#aiBeatGo'); await pg.waitForSelector('.aibeat', { timeout: 5000 });
  ok('beats: invalid + duplicate library indexes dropped (1 library card + 2 search)', await pg.locator('.aibeat').count() == 3);
  ok('beats: library list sent to AI', hits.some(h => (h.body || '').includes('0: Rainy Streets - Producer A') && (h.body || '').includes('1: Slow Piano Pain')));
  await pg.screenshot({ path: 'shots/04-beats.png', fullPage: true });
  await pg.click('[data-u="0"]'); ok('use as backing sets the song', await pg.evaluate(() => curSong && curSong.title == 'Slow Piano Pain' && /Slow Piano Pain/.test(document.getElementById('bgName').textContent)));
  await pg.click('[data-s="1"]'); await pg.waitForTimeout(400);
  ok('search idea fills Audius box + jumps to Library', await pg.evaluate(() => document.getElementById('stQ').value == 'melodic rain beat 140bpm' && document.getElementById('p-lib').classList.contains('on')));
  // chat
  await pg.click('.tab[data-p="ai"]'); await pg.click('#aiSeg [data-m="chat"]'); await pg.fill('#aiChatIn', 'help me with a hook'); await pg.press('#aiChatIn', 'Enter'); await pg.waitForSelector('.aib.m b', { timeout: 5000 });
  ok('chat reply rendered with bold', await pg.locator('.aib.u').count() == 1 && await pg.locator('.aib.m b').count() == 1);
  ok('chat history saved', await pg.evaluate(() => JSON.parse(localStorage.getItem('rd_aichat')).length == 2));
  await pg.screenshot({ path: 'shots/05-chat.png', fullPage: true });
  // sidebar entry
  await pg.evaluate(() => { lyrics('[00:01.00] first line of the verse\n[00:05.00] second line here'); document.getElementById('side').classList.add('show'); });
  ok('sidebar has AI button', await pg.locator('#aiLineBtn').isVisible());
  await pg.screenshot({ path: 'shots/06-sidebar.png' });
  await pg.click('#aiLineBtn'); await pg.waitForSelector('.aistamp', { timeout: 5000 });
  ok('sidebar button fills line and runs', await pg.inputValue('#aiLine') == 'first line of the verse');
  // themes: switch to an artist theme and look
  await pg.evaluate(() => applyTheme('ggr')); await pg.click('#aiSeg [data-m="adlib"]'); await pg.waitForTimeout(500); await pg.screenshot({ path: 'shots/07-theme-ggr.png', fullPage: true });
  // error path: bad key
  await pg.unroute('https://generativelanguage.googleapis.com/**');
  await pg.route('https://generativelanguage.googleapis.com/**', r => r.fulfill({ status: 400, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }) }));
  await pg.click('#aiAdGo'); await pg.waitForSelector('.aierr', { timeout: 5000 });
  ok('bad key shows readable error', /does not accept this key/.test(await pg.locator('.aierr').innerText()));
  ok('bad key flips status', /problem/i.test(await pg.locator('#aiStT').innerText()));
  // existing features untouched
  ok('existing tabs still work', await pg.evaluate(() => { document.querySelector('.tab[data-p="notes"]').click(); return document.getElementById('p-notes').classList.contains('on'); }));
  ok('no JS errors', errs.length == 0); if (errs.length) console.log(errs);
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
