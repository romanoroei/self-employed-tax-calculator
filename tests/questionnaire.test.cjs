// /questionnaire/: the function that sends the client's answers to Roei when the summary shows, and the mailer
// Worker it calls. Runs in the build (scripts/build-cloudflare.mjs); a failure stops publication.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = () => import(pathToFileURL(path.join(root, 'functions/api/questionnaire.js')).href);

const SECTIONS = [
  { title: 'פרטים ראשוניים', rows: [{ q: 'שם מלא', a: 'דנה כהן', red: false }] },
  { title: 'הכר את הלקוח', rows: [{ q: 'מצב תעסוקתי?', a: 'עצמאי', red: true }, { q: 'שם העסק', a: '<b>כהן</b> & בנים', red: false }] },
];
const good = (extra = {}) => ({ sessionId: 'a1b2c3d4-e5f6', name: 'דנה כהן', email: 'dana@example.com', sections: SECTIONS, update: false, ...extra });
const post = (fn, payload, env = {}, headers = {}, ip = '203.0.113.9') => fn.onRequestPost({
  request: new Request('https://romanoinvest.co.il/api/questionnaire', { method: 'POST', headers: { Origin: 'https://romanoinvest.co.il', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  env,
});
function fakeFetch(ok = true) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return new Response('{}', { status: ok ? 200 : 500 }); };
  f.calls = calls;
  return f;
}
const fakeMailer = (ok = true) => { const f = fakeFetch(ok); return { fetch: f, calls: f.calls }; };

test('the questionnaire function refuses what it should', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  assert.equal((await post(fn, good(), {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(fn, good(), {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(fn, 'x'.repeat(50000))).status, 413);
  assert.equal((await post(fn, '{nope')).status, 400);
  assert.equal((await post(fn, good({ sessionId: '<x>' }))).status, 400, 'a malformed session');
  assert.equal((await post(fn, good({ name: '' }))).status, 400, 'no name');
  assert.equal((await post(fn, good({ sections: [] }))).status, 400, 'no answers');
  assert.equal((await post(fn, good({ sections: [{ title: 'x', rows: [{ q: 'a', a: '' }] }] }))).status, 400, 'only empty answers');
  assert.equal((await post(fn, good({ sections: [{ title: 'x', rows: Array.from({ length: 81 }, (_, i) => ({ q: 'q' + i, a: 'a' })) }] }))).status, 400, 'too many rows');
  assert.equal(globalThis.fetch.calls.length, 0, 'nothing refused is sent');
  assert.equal((await post(fn, good({ website: 'spam' }))).status, 200);
  assert.equal(globalThis.fetch.calls.length, 0, 'a bot gets a quiet ok and nothing is sent');
});

test('the e-mail is right to left, escaped, and marks the answers to check', async () => {
  const fn = await load();
  const msg = fn.buildMessage(fn.cleanBody(good()), new Date('2026-11-21T10:00:00Z'));
  assert.equal(msg.subject, 'שאלון - דנה כהן');
  assert.match(msg.html, /^<!doctype html><html lang="he" dir="rtl">/);
  assert(msg.html.includes('<body dir="rtl"'));
  assert(!/<td(?![^>]*dir="rtl")/.test(msg.html), 'every cell is right to left');
  assert(msg.html.includes('&lt;b&gt;כהן&lt;/b&gt; &amp; בנים'), 'answers are escaped');
  assert(!msg.html.includes('<b>כהן</b>'));
  assert(msg.html.includes('color:#B42318;font-weight:bold;">🔴 עצמאי'));
  assert(msg.html.includes('1 תשובה מסומנת'));
  assert(msg.html.includes('href="mailto:dana@example.com"'));
  assert(msg.text.includes('מצב תעסוקתי?: 🔴 עצמאי'));
  assert(fn.buildMessage(fn.cleanBody(good({ update: true }))).subject.startsWith('שאלון (עדכון)'));
});

test('with the mailer bound, the message goes through it and not Formspree', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  const MAILER = fakeMailer();
  const r = await post(fn, good(), { MAILER });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).via, 'mailer');
  assert.equal(globalThis.fetch.calls.length, 0, 'Formspree is not used');
  const [call] = MAILER.calls;
  assert.equal(call.body.subject, 'שאלון - דנה כהן');
  assert.equal(call.body.replyTo, 'dana@example.com');
  assert(call.body.html.includes('dir="rtl"'));
  assert.equal((await (await post(fn, good(), { MAILER })).json()).duplicate, true, 'the same answers again are sent once');
  await post(fn, good({ update: true, sections: [...SECTIONS, { title: 'עוד', rows: [{ q: 'מצב משפחתי', a: 'נשוי' }] }] }), { MAILER });
  assert.equal(MAILER.calls.length, 2, 'edited answers go out again');
  const failing = fakeMailer(false);
  const fallback = await post(fn, good({ sessionId: 'other-session-1' }), { MAILER: failing });
  assert.equal((await fallback.json()).via, 'formspree', 'a failed mailer falls back to Formspree');
  assert.equal(globalThis.fetch.calls.length, 1);
  globalThis.fetch = fakeFetch(false);
  assert.equal((await post(fn, good({ sessionId: 'other-session-3' }), { MAILER: failing })).status, 502, 'both failing is reported');
});

test('without the mailer, Formspree carries it, with the client as the reply-to', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  const r = await post(fn, good());
  assert.equal(r.status, 200);
  const [call] = globalThis.fetch.calls;
  assert.equal(call.url, 'https://formspree.io/f/mvzjeykj');
  assert.equal(call.body.email, 'dana@example.com');
  assert(call.body['פירוט מלא'].includes('🔴 עצמאי'));
  globalThis.fetch = fakeFetch(false);
  assert.equal((await post(fn, good({ sessionId: 'other-session-2' }))).status, 502);
});

test('one address is limited per hour', async (t) => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  for (let i = 0; i < 6; i++) assert.equal((await post(fn, good({ sessionId: 'sess-rate-' + i }), {}, {}, '198.51.100.7')).status, 200);
  assert.equal((await post(fn, good({ sessionId: 'sess-rate-x' }), {}, {}, '198.51.100.7')).status, 429);
});

test('the mailer wraps the message in valid MIME for Roei only', () => {
  const src = fs.readFileSync(path.join(root, 'workers/questionnaire-mailer.js'), 'utf8')
    .replace("import { EmailMessage } from 'cloudflare:email';", 'class EmailMessage {}')
    .replace(/export default/, 'const _default =').replace(/export function/g, 'function');
  const mime = new Function(src + '\nreturn mime;')();
  const raw = mime({ subject: 'שאלון - דנה', text: 'שלום', html: '<p dir="rtl">שלום</p>', replyTo: 'dana@example.com', replyName: 'דנה\r\nBcc: x@evil' });
  assert(raw.includes('To: <roeir@ar-fo.co.il>'));
  assert(raw.includes('<questionnaire@romanoinvest.co.il>'));
  assert(raw.includes('<dana@example.com>'));
  assert(!/\r\nBcc:/i.test(raw), 'no header injection through the name');
  assert(raw.includes('Content-Type: text/html; charset=UTF-8'));
  const html = raw.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('--qn-')[0].replace(/\r\n/g, '');
  assert.equal(Buffer.from(html, 'base64').toString('utf8'), '<p dir="rtl">שלום</p>');
  assert(!mime({ subject: 's', text: 't', html: 'h', replyTo: 'bad' }).includes('Reply-To'), 'a malformed reply-to is left out');
});

test('the page posts sections to the function and tells the client whether it worked', () => {
  const page = fs.readFileSync(path.join(root, 'business-site/questionnaire/index.html'), 'utf8');
  assert(page.includes("const QN_SEND_URL = '/api/questionnaire';"));
  assert(page.includes('showSummary = function () { qnShowSummaryBase(); qnAutoSend();'));
  assert(page.includes('sections, update: qnDelivered'));
  for (const id of ['summaryHero', 'summaryIcon', 'summaryTitle', 'summaryLead']) assert(page.includes(`id="${id}"`), id);
  assert(page.includes('עוד צעד אחד: התשובות עוד לא נשלחו'));
  assert(page.includes('בסיום השאלון התשובות נשלחות אליי באופן אוטומטי'));
  assert(page.includes("window.addEventListener('beforeunload'"));
  assert(page.includes('id: "publicFigure"'), 'the public office question');
  assert.equal((page.match(/q.id === 'publicFigure'/g) || []).length, 3, 'a yes is marked red in every message');
  assert(page.includes('class="topbar"') && page.includes('data-menu-label="מילוי שאלון"'), 'the site top bar with its own call to action');
  assert(page.includes('id="qnWa"') && !page.includes('class="btn-contact'), 'only the WhatsApp icon in the bottom bar');
});
