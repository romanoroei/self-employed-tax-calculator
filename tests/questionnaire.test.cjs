// /questionnaire/: the function that sends the client's answers to Roei when the summary shows.
// Runs in the build (scripts/build-cloudflare.mjs); a failure stops publication.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = () => import(pathToFileURL(path.join(root, 'functions/api/questionnaire.js')).href);

const TEXT = 'פרטים ראשוניים\n\nשם מלא: דנה כהן\nכתובת מייל: dana@example.com\nמחזור הכנסות שנתי בעסק: 🔴 400000';
const good = (extra = {}) => ({ sessionId: 'a1b2c3d4-e5f6', name: 'דנה כהן', email: 'dana@example.com', text: TEXT, update: false, ...extra });
const post = (fn, payload, headers = {}, ip = '203.0.113.9') => fn.onRequestPost({
  request: new Request('https://romanoinvest.co.il/api/questionnaire', { method: 'POST', headers: { Origin: 'https://romanoinvest.co.il', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  env: {},
});
function fakeFetch(ok = true) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return new Response('{}', { status: ok ? 200 : 500 }); };
  f.calls = calls;
  return f;
}

test('the questionnaire function refuses what it should', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  assert.equal((await post(fn, good(), { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(fn, good(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(fn, 'x'.repeat(30000))).status, 413);
  assert.equal((await post(fn, '{nope')).status, 400);
  assert.equal((await post(fn, good({ sessionId: '<x>' }))).status, 400, 'a malformed session');
  assert.equal((await post(fn, good({ name: '' }))).status, 400, 'no name');
  assert.equal((await post(fn, good({ text: 'קצר' }))).status, 400, 'no answers');
  assert.equal((await post(fn, good({ text: 'x'.repeat(16001) }))).status, 400, 'too long');
  assert.equal(globalThis.fetch.calls.length, 0, 'nothing refused reaches Formspree');
  const bot = await post(fn, good({ website: 'spam' }));
  assert.equal(bot.status, 200);
  assert.equal(globalThis.fetch.calls.length, 0, 'a bot gets a quiet ok and nothing is sent');
});

test('the answers reach Formspree once, with the client as the reply-to', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  const r = await post(fn, good());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  const [call] = globalThis.fetch.calls;
  assert.equal(call.url, 'https://formspree.io/f/mvzjeykj');
  assert.equal(call.body._subject, 'שאלון - דנה כהן');
  assert.equal(call.body.email, 'dana@example.com');
  assert.equal(call.body['פירוט מלא'], TEXT);
  assert.equal(call.body['מקור'], 'שאלון לקוח');
  const again = await post(fn, good());
  assert.equal((await again.json()).duplicate, true, 'the same answers again are not sent twice');
  assert.equal(globalThis.fetch.calls.length, 1);
  await post(fn, good({ text: TEXT + '\nמצב משפחתי: נשוי', update: true }));
  assert.equal(globalThis.fetch.calls.length, 2, 'edited answers go out again');
  assert.equal(globalThis.fetch.calls[1].body._subject, 'שאלון (עדכון) - דנה כהן');
  await post(fn, good({ sessionId: 'zzzzzzzz-1', email: 'not an email' }));
  assert.equal(globalThis.fetch.calls[2].body.email, undefined, 'a malformed address is not used as the reply-to');
});

test('a failed delivery is reported, so the page asks for WhatsApp or e-mail', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch(false);
  const r = await post(fn, good());
  assert.equal(r.status, 502);
  globalThis.fetch = fakeFetch(true);
  assert.equal((await post(fn, good())).status, 200, 'a failure is not remembered as sent');
});

test('one address is limited per hour', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  for (let i = 0; i < 6; i++) assert.equal((await post(fn, good({ sessionId: 'sess-rate-' + i }), {}, '198.51.100.7')).status, 200);
  assert.equal((await post(fn, good({ sessionId: 'sess-rate-x' }), {}, '198.51.100.7')).status, 429);
});

test('the page posts to the function and tells the client whether it worked', () => {
  const page = fs.readFileSync(path.join(root, 'business-site/questionnaire/index.html'), 'utf8');
  assert(page.includes("const QN_SEND_URL = '/api/questionnaire';"));
  assert(page.includes('showSummary = function () { qnShowSummaryBase(); qnAutoSend(); };'));
  for (const id of ['summaryHero', 'summaryIcon', 'summaryTitle', 'summaryLead']) assert(page.includes(`id="${id}"`), id);
  assert(page.includes('עוד צעד אחד: התשובות עוד לא נשלחו'));
  assert(page.includes("window.addEventListener('beforeunload'"));
});
