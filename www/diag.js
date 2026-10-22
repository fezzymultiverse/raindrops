// Raindrops V1.9.7 - diagnostics, no Termux needed.
// 1) Records JS errors + a trail of what you tapped, and notices when Android closed the app without a clean exit.
// 2) "Check connections" tests YouTube (NewPipe plugin), Deezer, Audius, lyrics and Wikipedia from inside the app and shows the exact error.
// 3) "Copy report" puts everything on the clipboard so it can be pasted into a chat.
(() => {
'use strict';
const $ = id => document.getElementById(id);
const KL = 'rd_diag_log', KA = 'rd_diag_alive';
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const NAT = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const PL = n => { try { return window.Capacitor.Plugins[n]; } catch (e) { return null; } };
let log = [];
try { log = JSON.parse(localStorage.getItem(KL) || '[]'); if (!Array.isArray(log)) log = []; } catch (e) { log = []; }
const saveLog = () => { try { localStorage.setItem(KL, JSON.stringify(log.slice(-60))); } catch (e) {} };
const add = m => { log.push(stamp() + '  ' + String(m).slice(0, 500)); if (log.length > 80) log = log.slice(-60); saveLog(); };
window.rdDiagAdd = add;

// ---- unclean exit detection: the flag is rewritten on every tap and on show/hide, and cleared on a clean pagehide
const trail = [];
const memNow = () => { try { const m = performance.memory; return m ? Math.round(m.usedJSHeapSize / 1048576) + 'MB js heap' : ''; } catch (e) { return ''; } };
let vis = document.visibilityState;
const writeAlive = why => { try { localStorage.setItem(KA, JSON.stringify({ t: stamp(), vis, last: trail.slice(-6), mem: memNow(), why: why || '' })); } catch (e) {} };
let prev = null;
try { prev = JSON.parse(localStorage.getItem(KA) || 'null'); } catch (e) { prev = null; }
if (prev) {
  const where = prev.vis === 'hidden' ? 'while the app was in the background (Android or the Honor battery manager closed it)' : 'while the app was on screen (crash or out of memory)';
  add('LAST RUN ENDED WITHOUT A CLEAN CLOSE ' + where + '. Last seen ' + prev.t + ', trail: ' + (prev.last || []).join(' > ') + (prev.mem ? ', ' + prev.mem : ''));
  window.rdUncleanExit = prev;
}
writeAlive('start');
document.addEventListener('click', e => {
  const t = e.target && e.target.closest ? e.target.closest('button,.tab,.chip,.ib,[id]') : null;
  if (!t) return;
  trail.push((t.id || t.dataset && (t.dataset.p || t.dataset.v) || t.className || t.tagName).toString().slice(0, 24));
  if (trail.length > 20) trail.shift();
  writeAlive('tap');
}, true);
document.addEventListener('visibilitychange', () => { vis = document.visibilityState; writeAlive(vis); });
window.addEventListener('pagehide', () => { try { if (document.visibilityState !== 'hidden') localStorage.removeItem(KA); } catch (e) {} });

// ---- JS errors
window.addEventListener('error', e => add('JS error: ' + (e.message || '?') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
window.addEventListener('unhandledrejection', e => { const r = e.reason; add('Promise error: ' + String((r && (r.message || r)) || '?').slice(0, 200)); });

// ---- native crash / renderer-lost note (native.js reads + clears it a moment after start)
setTimeout(() => { if (window.rdLastCrash) add('NATIVE: ' + String(window.rdLastCrash).replace(/\s+/g, ' ').slice(0, 420)); }, 2500);

// ---- connection checks
const lines = [];
const out = () => { const o = $('diagOut'); if (o) o.textContent = lines.join('\n'); };
const say = m => { lines.push(m); out(); };
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' timed out after ' + Math.round(ms / 1000) + 's')), ms))]);
const errTxt = e => String((e && (e.message || e.errorMessage || e)) || 'unknown').replace(/\s+/g, ' ').slice(0, 140);
async function step(name, fn, ms) {
  const t0 = Date.now();
  try { const r = await withTimeout(fn(), ms || 15000, name); say('PASS  ' + name + (r ? ' - ' + r : '') + '  (' + (Date.now() - t0) + ' ms)'); return true; }
  catch (e) { say('FAIL  ' + name + ' - ' + errTxt(e)); add('check FAIL ' + name + ': ' + errTxt(e)); return false; }
}
const getJson = async url => {
  let err;
  try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch (e) { err = e; }
  const H = PL('CapacitorHttp');
  if (H && H.get) { const r = await H.get({ url, responseType: 'json' }); if (r.status >= 400) throw new Error('HTTP ' + r.status); return typeof r.data == 'string' ? JSON.parse(r.data) : r.data; }
  throw err;
};
let running = false;
async function runChecks() {
  if (running) return; running = true; lines.length = 0;
  const b = $('bDiag'); if (b) b.disabled = true;
  say('Raindrops V1.9.8 check  ' + stamp());
  say('Platform: ' + (NAT ? 'Android app' : 'browser') + ' | online: ' + (navigator.onLine ? 'yes' : 'NO') + ' | ' + (navigator.userAgent.match(/Chrome\/[\d.]+/) || ['WebView ?'])[0]);
  const names = ['Raindrops', 'RaindropsSys', 'LocalNotifications', 'Filesystem', 'Share', 'CapacitorHttp'];
  say('Native plugins: ' + names.map(n => n + (PL(n) ? ' yes' : ' MISSING')).join(', '));
  const RP = PL('Raindrops');
  if (NAT && !RP) say('>> The YouTube plugin is NOT in this APK. You are running an old build. Install the newest raindrops.apk from your GitLab pipeline (the icon changes with it).');
  try { if (navigator.storage && navigator.storage.estimate) { const s = await navigator.storage.estimate(); say('Storage: ' + Math.round((s.usage || 0) / 1048576) + ' MB used of ' + Math.round((s.quota || 0) / 1048576) + ' MB'); } } catch (e) {}
  if (memNow()) say('Memory: ' + memNow());
  if (NAT && RP && RP.ytSearch) await step('YouTube search (NewPipe)', async () => { const r = await RP.ytSearch({ q: 'juice wrld lucid dreams', kind: 'videos', limit: 3 }); const n = (r.items || []).length; if (!n) throw new Error('0 results'); return n + ' results, first: ' + String(r.items[0].title).slice(0, 40); }, 40000);
  if (NAT && RP && RP.ytSearch) await step('YouTube music search (what V1.6.0 used)', async () => { const r = await RP.ytSearch({ q: 'juice wrld', kind: 'music_songs' }); const n = (r.items || []).length; if (!n) throw new Error('0 results'); return n + ' results'; }, 40000);
  await step('Deezer search', async () => { const j = await getJson('https://api.deezer.com/search?q=juice%20wrld&limit=1'); if (j.error) throw new Error(j.error.message || 'Deezer error'); return ((j.data || []).length) + ' result'; });
  await step('Audius', async () => { const j = await getJson('https://api.audius.co'); const h = (j.data || [])[0]; if (!h) throw new Error('no host'); const s = await getJson(h + '/v1/tracks/search?limit=1&app_name=raindrops&query=juice'); return ((s.data || []).length) + ' result'; });
  await step('Lyrics (LRCLIB)', async () => { const j = await getJson('https://lrclib.net/api/search?q=juice%20wrld%20lucid%20dreams'); return (Array.isArray(j) ? j.length : 0) + ' result'; });
  await step('Wikipedia (artist history)', async () => { const j = await getJson('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=juice%20wrld&srlimit=1'); return j && j.query ? 'ok' : 'empty'; });
  const f = lines.filter(l => l.startsWith('FAIL')).length;
  say(f ? ('Result: ' + f + ' check(s) FAILED. Tap Copy report and paste it to me.') : 'Result: everything answered.');
  add('check finished, ' + f + ' failed');
  if (b) b.disabled = false; running = false;
}
const reportText = () => 'RAINDROPS REPORT\n' + lines.join('\n') + '\n\nLOG (newest last)\n' + log.slice(-40).join('\n');
const copy = async txt => {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (e) { return false; }
};
const toastS = m => { try { window.toast ? window.toast(m) : null; } catch (e) {} };
const bind = () => {
  const b = $('bDiag'), c = $('bDiagCopy'), x = $('bDiagClr'), o = $('diagOut');
  if (b) b.onclick = runChecks;
  if (c) c.onclick = async () => { if (!lines.length && o) { lines.push('(checks not run yet)'); out(); } toastS((await copy(reportText())) ? 'Report copied' : 'Could not copy, select the text below'); };
  if (x) x.onclick = () => { log = []; saveLog(); try { localStorage.removeItem(KA); } catch (e) {} lines.length = 0; out(); toastS('Log cleared'); };
  if (o && log.length) { o.textContent = 'Saved log:\n' + log.slice(-12).join('\n'); }
  if (window.rdUncleanExit) toastS('Android closed Raindrops last time. Details: Record tab, Fix + diagnose');
};
bind();
})();
