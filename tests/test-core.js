const Core = require(process.env.CORE);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n); } };
const M = n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] });
// model picking
const list = [M('gemini-2.5-flash'), M('gemini-3.5-flash'), M('gemini-3.8-flash'), M('gemini-3.8-pro'), M('gemini-3.8-flash-lite'), M('gemini-3.9-flash-preview'), M('gemini-3.8-flash-image'), M('gemini-3.8-flash-tts'), M('gemini-embedding-001'), { name: 'models/gemini-3.8-flash-live', supportedGenerationMethods: ['bidiGenerateContent'] }, { name: 'models/gemini-4.0-flash', supportedGenerationMethods: ['countTokens'] }];
ok('picks newest stable flash', Core.pickModel(list) === 'gemini-3.8-flash');
ok('skips image/tts/embedding/live', !Core.rankModels(list).some(m => /image|tts|embed|live/.test(m.id)));
ok('skips non-generateContent', !Core.rankModels(list).some(m => m.id === 'gemini-4.0-flash'));
ok('only previews -> still picks one', Core.pickModel([M('gemini-3.9-flash-preview')]) === 'gemini-3.9-flash-preview');
ok('empty list -> null', Core.pickModel([]) === null);
// JSON parsing
ok('parse fenced json', JSON.stringify(Core.parseJSON('```json\n[{"a":1}]\n```')) === '[{"a":1}]');
ok('parse json with chatter', JSON.stringify(Core.parseJSON('Sure! {"x":2} hope that helps')) === '{"x":2}');
ok('parse garbage -> null', Core.parseJSON('nope') === null);
// friendly errors
ok('429 message', /quota/i.test(Core.friendly(429, {})));
ok('bad key message', /key/i.test(Core.friendly(400, { error: { message: 'API key not valid' } })));
ok('offline message', /internet/i.test(Core.friendly(0, '')));
// ask() with mocked fetch
let calls = [];
global.fetch = async (url, o) => {
  calls.push({ url, method: o.method, key: o.headers['x-goog-api-key'], body: o.body });
  const mk = (st, d) => ({ status: st, text: async () => JSON.stringify(d) });
  if (url.includes('/models?')) return mk(200, { models: list });
  if (url.includes('gemini-GONE:')) return mk(404, { error: { message: 'not found' } });
  if (o.headers['x-goog-api-key'] === 'KEYBAD') return mk(400, { error: { message: 'API key not valid' } });
  return mk(200, { candidates: [{ content: { parts: [{ text: '[{"adlib":"yeah","where":"end","how":"low"}]' }] }, finishReason: 'STOP' }] });
};
(async () => {
  let r = await Core.ask({ key: 'K1', prompt: 'hi', system: 'sys', json: true });
  ok('auto-picks model via list then posts', calls[0].url.includes('/models?') && calls[1].url.includes('gemini-3.8-flash:generateContent'));
  ok('key sent in header not URL', calls.every(c => c.key === 'K1' && !c.url.includes('K1')));
  ok('json mode requested', JSON.parse(calls[1].body).generationConfig.responseMimeType === 'application/json');
  ok('system instruction sent', JSON.parse(calls[1].body).systemInstruction.parts[0].text === 'sys');
  ok('returns text + model', r.text.startsWith('[') && r.model === 'gemini-3.8-flash');
  calls = [];
  r = await Core.ask({ key: 'K1', prompt: 'hi', model: 'gemini-GONE' });
  ok('404 -> re-lists and retries with a working model', r.model === 'gemini-3.8-flash' && calls.length === 3);
  let err = ''; try { await Core.ask({ key: '', prompt: 'x' }); } catch (e) { err = e.message; }
  ok('no key -> clear error', /key/i.test(err));
  err = ''; try { await Core.ask({ key: 'KEYBAD', prompt: 'x', model: 'gemini-3.8-flash' }); } catch (e) { err = e.message; }
  ok('bad key -> friendly error', /does not accept this key/.test(err));
  // blocked + empty
  global.fetch = async () => ({ status: 200, text: async () => JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }) });
  err = ''; try { await Core.ask({ key: 'K', prompt: 'x', model: 'm' }); } catch (e) { err = e.message; }
  ok('blocked prompt -> readable error', /blocked/.test(err));
  global.fetch = async () => { throw new Error('offline'); };
  err = ''; try { await Core.ask({ key: 'K', prompt: 'x', model: 'm' }); } catch (e) { err = e.message; }
  ok('network failure -> readable error', /internet/i.test(err));
  // prompts
  const bp = Core.beatPrompt('sad love song', 'melodic', 'slow', [{ title: 'A', artist: 'B' }, { title: 'C', artist: '' }]);
  ok('beat prompt numbers the library', bp.includes('0: A - B') && bp.includes('1: C'));
  ok('adlib prompt carries line + vibe', Core.adlibPrompt('line here', 'hype', 6).includes('line here') && Core.adlibPrompt('l', 'hype', 6).includes('hype'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
