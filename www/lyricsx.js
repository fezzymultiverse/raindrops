// Raindrops V1.9.6 - stronger lyrics fetcher for Rap-Along and the lyrics search.
// LRCLIB exact match (artist + title + length), LRCLIB structured and loose searches, a cleaned-title retry,
// and lyrics.ovh as a plain-text fallback. All run at once, merged, de-duplicated and ranked. Results are cached.
(() => {
const E = encodeURIComponent, LR = 'https://lrclib.net/api/';
const jg = url => (typeof jget === 'function' ? jget(url) : fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }));
const get = url => Promise.race([jg(url), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 14000))]);
const clean = t => String(t || '').replace(/\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i, '').replace(/_+/g, ' ')
  .replace(/\s*[\(\[][^\)\]]*(feat|ft\.?|featuring|prod|official|lyric|audio|video|remaster|explicit|visuali[sz]er)[^\)\]]*[\)\]]/ig, '')
  .replace(/\s*-\s*(remaster(ed)?( \d{4})?|single version|album version|explicit|official.*)$/i, '').replace(/\s+/g, ' ').trim();
const nz = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lt = x => x.syncedLyrics || x.plainLyrics || '';

function norm(list) {
  const seen = new Set(), out = [];
  list.forEach(x => {
    if (!x || typeof x != 'object' || !lt(x)) return;
    const k = x.id != null ? 'i' + x.id : 't' + nz(lt(x)).slice(0, 80); if (seen.has(k)) return; seen.add(k);
    out.push({ id: x.id, trackName: x.trackName || x.name || '', artistName: x.artistName || '', albumName: x.albumName || '', duration: +x.duration || 0, plainLyrics: x.plainLyrics || '', syncedLyrics: x.syncedLyrics || '', src: x.src || 'LRCLIB' });
  });
  return out;
}
// best first: title match, then length within 4 s, then synced over text, then closest length
function rank(list, T, dur) {
  const t = nz(T);
  const nm = x => { if (!t) return 0; const n = nz(x.trackName); return n == t ? 0 : (n.includes(t) || t.includes(n)) ? 1 : 2; };
  const bk = x => (dur && x.duration) ? (Math.abs(x.duration - dur) <= 4 ? 0 : 2) : 1;
  const df = x => (dur && x.duration) ? Math.abs(x.duration - dur) : 99;
  return list.map(x => ({ x, a: nm(x), b: bk(x), c: x.syncedLyrics ? 0 : 1, d: df(x) }))
    .sort((p, q) => (p.a - q.a) || (p.b - q.b) || (p.c - q.c) || (p.d - q.d)).map(o => o.x);
}
function cacheGet(k) { const c = LS.get('rd_lyc', {}); const e = c[k]; return e && Date.now() - e.at < 6048e5 ? e.list : null; }
function cachePut(k, list) {
  if (!list.length) return; const c = LS.get('rd_lyc', {}); c[k] = { at: Date.now(), list };
  const ks = Object.keys(c).sort((a, b) => c[b].at - c[a].at); ks.slice(16).forEach(x => delete c[x]); LS.set('rd_lyc', c);
}
async function run(jobs) {
  const rs = await Promise.allSettled(jobs); let list = [], ok = 0, last = null;
  rs.forEach(r => { if (r.status == 'fulfilled') { ok++; list = list.concat(Array.isArray(r.value) ? r.value : [r.value]); } else last = r.reason; });
  if (!ok) throw last || new Error('no response');
  return list;
}
async function ovh(A, T) {
  const j = await get('https://api.lyrics.ovh/v1/' + E(A) + '/' + E(T));
  const x = (j && j.lyrics || '').replace(/\r/g, '').trim(); return x ? [{ id: 'ovh', trackName: T, artistName: A, duration: 0, plainLyrics: x, src: 'lyrics.ovh' }] : [];
}
async function find({ artist, title, dur }) {
  const A = clean(artist), T = clean(title), D = Math.round(dur || 0), key = (A + '|' + T + '|' + D).toLowerCase();
  const hit = cacheGet(key); if (hit) return hit;
  const jobs = [];
  if (A && T && D) jobs.push(get(LR + 'get?artist_name=' + E(A) + '&track_name=' + E(T) + '&duration=' + D).then(x => [x]));
  if (A && T) jobs.push(get(LR + 'search?track_name=' + E(T) + '&artist_name=' + E(A)));
  jobs.push(get(LR + 'search?q=' + E((A + ' ' + T).trim())));
  if (A && T) jobs.push(get(LR + 'search?q=' + E(T)));
  const settled = await Promise.allSettled(jobs); let list = [], ok = 0, last = null;
  settled.forEach(r => { if (r.status == 'fulfilled') { ok++; list = list.concat(r.value || []); } else last = r.reason; });
  list = norm(list);
  if (!list.length && A && T) { try { list = norm(await ovh(A, T)); ok++; } catch (e) { last = last || e; } }
  if (!ok) throw last || new Error('no response');
  list = rank(list, T, D); cachePut(key, list); return list;
}
// free-text search for the Rap-Along search bar: "song", "artist song", "artist - song", "song - artist"
async function search(q, dur) {
  const Q = clean(q); if (!Q) return []; const D = Math.round(dur || 0), key = ('q|' + Q + '|' + D).toLowerCase();
  const hit = cacheGet(key); if (hit) return hit;
  const jobs = [get(LR + 'search?q=' + E(Q)), get(LR + 'search?track_name=' + E(Q))];
  const m = Q.split(/\s+[-–—]\s+/);
  if (m.length >= 2) {
    const a = m[0], b = m.slice(1).join(' - ');
    jobs.push(get(LR + 'search?track_name=' + E(b) + '&artist_name=' + E(a)), get(LR + 'search?track_name=' + E(a) + '&artist_name=' + E(b)));
  }
  const list = rank(norm(await run(jobs)), '', D); cachePut(key, list); return list;
}
window.RDlyrics = { find, search, clean };
})();
