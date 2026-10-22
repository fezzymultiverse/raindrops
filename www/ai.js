// Raindrops V1.3.0 - Studio AI (Gemini): ad-lib coach, beat picker, chat. UI layer; logic lives in ai-core.js.
(() => {
const C = window.RdAIcore, VER = 'V1.3.0';
const KEY = () => String(LS.get('rd_gk', '') || '').trim(), MODEL = () => LS.get('rd_gm', '') || '';
const MODES = ['adlib', 'beat', 'chat'];
let mode = 'adlib', busy = false, vibe = 'hype', mood = 'sad and melodic', tempo = 'any', chat = LS.get('rd_aichat', []), lastAd = [], state = 'idle';

const goTab = p => { const t = document.querySelector('.tab[data-p="' + p + '"]'); if (t) t.click(); };
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
async function copy(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); }
  catch (e) { const x = document.createElement('textarea'); x.value = t; x.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); toast('Copied'); } catch (_) { toast('Copy failed'); } x.remove(); }
}
function saveNote(title, body) {
  try { notes.unshift({ id: Date.now(), t: title, b: body }); LS.set('rd_notes', notes); rNotes(); toast('Saved to Notes'); } catch (e) { toast('Could not save the note'); }
}
const wait = m => '<div class="aiwait"><i></i><i></i><i></i><span>' + esc(m) + '</span></div>';
const fail = (box, e) => { box.innerHTML = '<div class="aierr">' + esc(e && e.message || e) + '</div>'; };

// ---- status + settings ----
function paintStatus() {
  const has = !!KEY(), d = $('aiDot');
  d.className = 'dot' + (state == 'ok' ? ' ok' : state == 'bad' ? ' bad' : '');
  $('aiStT').innerHTML = !has ? '<b>Studio AI is off</b> Add your Gemini key to switch it on.' : state == 'bad' ? '<b>Key problem</b> Open settings and check it.' : '<b>Ready</b> ' + esc(MODEL() || 'newest Gemini Flash');
  $('aiStB').textContent = has ? 'Settings' : 'Add key';
}
function openSettings() { $('aiSet').open = true; $('aiSet').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('aiKeyIn').focus(), 350); }
function fillModels(list) {
  const cur = MODEL(), ids = list.map(m => m.id);
  if (cur && ids.indexOf(cur) < 0) ids.unshift(cur);
  $('aiModel').innerHTML = '<option value="">Auto (newest Flash)</option>' + ids.map(i => '<option value="' + esc(i) + '">' + esc(i) + '</option>').join('');
  $('aiModel').value = cur;
}
const needKey = () => { toast('Add your Gemini key first'); openSettings(); };
$('aiStB').onclick = openSettings;
$('aiKeyEye').onclick = () => { const i = $('aiKeyIn'); i.type = i.type == 'password' ? 'text' : 'password'; $('aiKeyEye').textContent = i.type == 'password' ? 'Show' : 'Hide'; };
$('aiCheck').onclick = async () => {
  const k = $('aiKeyIn').value.trim(); if (!k) { toast('Paste your key first'); return; }
  LS.set('rd_gk', k); $('aiCheck').disabled = true; $('aiSetMsg').textContent = 'Checking…';
  try {
    const l = await C.listModels(k); fillModels(l); state = 'ok';
    $('aiSetMsg').textContent = 'Key works. ' + l.length + ' models found. Auto picks ' + (C.pickModel(l.map(m => ({ name: 'models/' + m.id, supportedGenerationMethods: ['generateContent'] }))) || 'none') + '.';
  } catch (e) { state = 'bad'; $('aiSetMsg').textContent = e.message; }
  $('aiCheck').disabled = false; paintStatus();
};
$('aiModel').onchange = () => { LS.set('rd_gm', $('aiModel').value); paintStatus(); };
$('aiKeyDel').onclick = () => { if (!confirm('Remove the Gemini key from this phone?')) return; try { localStorage.removeItem('rd_gk'); localStorage.removeItem('rd_gm'); } catch (e) {} $('aiKeyIn').value = ''; $('aiModel').value = ''; state = 'idle'; $('aiSetMsg').textContent = 'Key removed.'; paintStatus(); };
$('aiVer').textContent = 'Raindrops ' + VER + ' Studio AI';

// ---- modes ----
function setMode(m) {
  mode = m; $('aiSeg').style.setProperty('--i', MODES.indexOf(m));
  document.querySelectorAll('#aiSeg button').forEach(b => { b.classList.toggle('on', b.dataset.m == m); b.setAttribute('aria-selected', b.dataset.m == m); });
  MODES.forEach(x => $('ai-' + x).classList.toggle('hidden', x != m));
  if (m == 'chat') { drawChat(); }
}
document.querySelectorAll('#aiSeg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
chips('aiVibe', [['hype', 'Hype'], ['melodic', 'Melodic'], ['dark', 'Dark'], ['emotional', 'Emotional'], ['trap', 'Trap'], ['playful', 'Playful']], 'rd_aivibe', 'hype', v => { vibe = v; });
chips('aiMood', [['sad and melodic', 'Sad and melodic'], ['hype and aggressive', 'Hype'], ['dark and moody', 'Dark'], ['late night chill', 'Late night'], ['party energy', 'Party'], ['heartbreak', 'Heartbreak']], 'rd_aimood', 'sad and melodic', v => { mood = v; });
chips('aiTempo', [['slow', 'Slow'], ['mid-tempo', 'Mid'], ['fast', 'Fast'], ['any', 'Any']], 'rd_aitempo', 'any', v => { tempo = v; });

// runs one AI action; returns true on success, false on failure (the reason is in go.err). Never throws.
async function go(btnId, fn) {
  if (busy) return false; if (!KEY()) { needKey(); return false; }
  busy = true; const b = $(btnId); b.disabled = true;
  try { await fn(); if (state != 'ok') { state = 'ok'; paintStatus(); } return true; }
  catch (e) { go.err = e; if (/(not allowed|does not accept)/.test(e.message)) { state = 'bad'; paintStatus(); } return false; }
  finally { busy = false; b.disabled = false; }
}

// ---- ad-libs ----
function curLine() {
  const p = document.querySelector('#lyr p.cur'); if (p) return p.textContent.trim();
  const f = document.querySelector('#lyr p'); return f && !/^No lyrics yet/.test(f.textContent) ? f.textContent.trim() : '';
}
function noteLine() {
  const t = $('nb'), v = t.value, s = t.selectionStart || 0, e = t.selectionEnd || 0; if (!v.trim()) return '';
  if (e > s) return v.slice(s, e).trim();
  const a = v.lastIndexOf('\n', s - 1) + 1, z = v.indexOf('\n', s); return v.slice(a, z < 0 ? v.length : z).trim();
}
$('aiUseLy').onclick = () => { const l = curLine(); if (l) { $('aiLine').value = l; } else toast('Play a song with lyrics first'); };
$('aiUseNote').onclick = () => { const l = noteLine(); if (l) { $('aiLine').value = l; } else toast('Nothing in Notes yet'); };
function drawAd(list) {
  lastAd = list;
  $('aiAdOut').innerHTML = list.map((a, i) => '<div class="aistamp" style="--d:' + i + '"><div class="aiw">' + esc(a.adlib) + '</div>' +
    (a.where ? '<div class="aiwh">' + esc(a.where) + '</div>' : '') + (a.how ? '<div class="aihow">' + esc(a.how) + '</div>' : '') +
    '<div class="aiact"><button class="aibtn" data-c="' + i + '">Copy</button></div></div>').join('') +
    '<div class="btnrow" style="margin-top:4px"><button class="btn g" id="aiAdAll">Save all to Notes</button><button class="btn g" id="aiAdAgain">More ideas</button></div>';
  $('aiAdOut').querySelectorAll('[data-c]').forEach(b => b.onclick = () => copy(list[+b.dataset.c].adlib));
  $('aiAdAll').onclick = () => saveNote('Ad-libs: ' + ($('aiLine').value.trim().slice(0, 30) || 'ideas'), 'Line: ' + $('aiLine').value.trim() + '\n\n' + list.map(a => a.adlib + (a.where ? ' - ' + a.where : '') + (a.how ? ' (' + a.how + ')' : '')).join('\n'));
  $('aiAdAgain').onclick = () => $('aiAdGo').click();
}
$('aiAdGo').onclick = () => { if ($('aiLine').value.trim()) go('aiAdGo', runAd); else toast('Type or paste a line first'); };
async function runAd() {
  const line = $('aiLine').value.trim();
  const box = $('aiAdOut'); box.innerHTML = wait('Writing ad-libs…');
  try {
    const r = await C.ask({ key: KEY(), model: MODEL() || undefined, system: C.SYS_ADLIB, prompt: C.adlibPrompt(line.slice(0, 600), vibe, 6), json: true, temp: 1 });
    let a = C.parseJSON(r.text); if (a && !Array.isArray(a)) a = a.adlibs || a.ideas || Object.values(a).find(Array.isArray);
    a = (a || []).filter(x => x && x.adlib).slice(0, 8).map(x => ({ adlib: String(x.adlib), where: x.where ? String(x.where) : '', how: x.how ? String(x.how) : '' }));
    if (!a.length) throw new Error('Gemini sent something unreadable. Tap again.');
    drawAd(a);
  } catch (e) { fail(box, e); throw e; }
}

// ---- beats ----
function useSong(s) { if (recording) { toast('Stop recording first'); return; } setSong(s); toast('Backing track set: ' + s.title); }
$('aiBeatGo').onclick = () => go('aiBeatGo', async () => {
  const box = $('aiBeatOut'); box.innerHTML = wait('Finding beats…');
  const snap = songs.slice(0, 150);
  try {
    const r = await C.ask({ key: KEY(), model: MODEL() || undefined, system: C.SYS_BEAT, prompt: C.beatPrompt($('aiBrief').value.trim().slice(0, 400), mood, tempo, snap.map(s => ({ title: s.title, artist: s.artist }))), json: true, temp: .8 });
    const d = C.parseJSON(r.text) || {}, seen = new Set();
    const lib = (Array.isArray(d.library) ? d.library : []).map(x => ({ i: Number(x && x.i), why: x && x.why ? String(x.why) : '' })).filter(x => Number.isInteger(x.i) && snap[x.i] && !seen.has(x.i) && seen.add(x.i)).slice(0, 4);
    const sr = (Array.isArray(d.search) ? d.search : []).map(x => ({ q: x && x.q ? String(x.q).slice(0, 80) : '', why: x && x.why ? String(x.why) : '' })).filter(x => x.q).slice(0, 5);
    if (!lib.length && !sr.length) throw new Error('Gemini had no picks for that. Try another mood.');
    box.innerHTML = (lib.length ? '<div class="aih">From your library</div>' + lib.map((x, k) => '<div class="aibeat"><div class="n">' + esc(snap[x.i].title) + '<small>' + esc(snap[x.i].artist || 'Unknown artist') + '</small></div><div class="aiwhy">' + esc(x.why) + '</div><div class="aiact"><button class="aibtn pri" data-u="' + k + '">Use as backing</button><button class="aibtn" data-p="' + k + '">Preview</button></div></div>').join('') : (snap.length ? '' : '<p class="hint">Your library is empty, so these are search ideas only. Add songs in Library.</p>')) +
      (sr.length ? '<div class="aih">Search ideas</div>' + sr.map((x, k) => '<div class="aibeat"><div class="n">' + esc(x.q) + '</div><div class="aiwhy">' + esc(x.why) + '</div><div class="aiact"><button class="aibtn pri" data-s="' + k + '">Search beats</button></div></div>').join('') : '');
    box.querySelectorAll('[data-u]').forEach(b => b.onclick = () => useSong(snap[lib[+b.dataset.u].i]));
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => toggleSong(snap[lib[+b.dataset.p].i].id));
    box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { $('stQ').value = sr[+b.dataset.s].q; goTab('lib'); setTimeout(() => { $('stGo').click(); $('stQ').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); });
  } catch (e) { fail(box, e); throw e; }
});

// ---- chat ----
function drawChat() {
  const L = $('aiLog');
  L.innerHTML = chat.length ? chat.map(m => '<div class="aib ' + (m.role == 'user' ? 'u' : 'm') + '">' + md(m.parts[0].text) + '</div>').join('') : '<p class="hint" style="margin:6px 0">Ask about hooks, flow, melodies, ad-libs, mixing on a phone, anything in the studio.</p>';
  L.scrollTop = L.scrollHeight; $('aiClear').classList.toggle('hidden', !chat.length);
}
async function send(txt) {
  txt = (txt || '').trim(); if (!txt) return; if (busy) return; if (!KEY()) { needKey(); return; }
  chat.push({ role: 'user', parts: [{ text: txt }] }); $('aiChatIn').value = ''; drawChat();
  $('aiLog').insertAdjacentHTML('beforeend', '<div class="aib m">' + wait('Thinking…') + '</div>'); $('aiLog').scrollTop = $('aiLog').scrollHeight;
  const done = await go('aiSend', async () => {
    let h = chat.slice(-12); while (h.length && h[0].role != 'user') h.shift();
    const r = await C.ask({ key: KEY(), model: MODEL() || undefined, system: C.SYS_CHAT, contents: h, temp: .9, max: 1500 });
    chat.push({ role: 'model', parts: [{ text: r.text }] });
  });
  if (done) { chat = chat.slice(-24); LS.set('rd_aichat', chat); drawChat(); }
  else { chat.pop(); $('aiChatIn').value = txt; drawChat(); toast(String(go.err && go.err.message || 'Chat failed').slice(0, 80)); }
}
$('aiSend').onclick = () => send($('aiChatIn').value);
$('aiChatIn').onkeydown = e => { if (e.key == 'Enter') send($('aiChatIn').value); };
$('aiClear').onclick = () => { if (!confirm('Clear this chat?')) return; chat = []; LS.set('rd_aichat', chat); drawChat(); };
document.querySelectorAll('#aiQuick .chip').forEach(c => c.onclick = () => send(c.dataset.q));

// ---- entry points elsewhere in the app ----
$('aiAdBtn').onclick = () => { goTab('ai'); setMode('adlib'); const l = curLine(); if (l && !$('aiLine').value.trim()) $('aiLine').value = l; setTimeout(() => $('aiLine').focus(), 80); };
$('aiBeatBtn').onclick = () => { goTab('ai'); setMode('beat'); scrollTo(0, 0); };
$('aiLineBtn').onclick = () => { const l = curLine(); if (!l) { toast('Play a song with lyrics first'); return; } $('aiLine').value = l; $('side').classList.remove('show'); goTab('ai'); setMode('adlib'); scrollTo(0, 0); if (KEY()) $('aiAdGo').click(); else needKey(); };

$('aiKeyIn').value = KEY(); if (MODEL()) fillModels([]); else fillModels([]);
if (KEY()) state = 'idle'; paintStatus(); setMode('adlib'); drawChat();
$('aiSet').open = !KEY();
})();
