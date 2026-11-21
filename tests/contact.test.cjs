// functions/api/contact.js: the home page contact form and the compass lead form, sent through our own function.
// Runs in the build (scripts/build-cloudflare.mjs); a failure stops publication.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = () => import(pathToFileURL(path.join(root, 'functions/api/contact.js')).href);

function kv() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix, limit }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })) }; },
  };
}
function fakeFetch(formspreeOk = true) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{}', { status: String(url).includes('formspree') ? (formspreeOk ? 200 : 500) : 200 }); };
  f.calls = calls;
  return f;
}
// the MAILER service binding (workers/questionnaire-mailer.js), replaced by a fake that keeps what it got
function mailer(ok = true) {
  const sent = [];
  return { sent, async fetch(url, init) { sent.push(JSON.parse(init.body)); return new Response('{}', { status: ok ? 200 : 500 }); } };
}
const post = (fn, payload, env = {}, headers = {}) => fn.onRequestPost({
  request: new Request('https://romanoinvest.co.il/api/contact', { method: 'POST', headers: { Origin: 'https://romanoinvest.co.il', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  env,
  waitUntil: () => {},
});
const home = (extra = {}) => ({ form: 'home', contact: { name: 'דנה כהן', phone: '052-1234567', email: 'dana@example.com' }, goals: ['פנסיה', 'ביטוחים'], consent: true, marketing: false, ...extra });
const compass = (extra = {}) => ({ form: 'compass', contact: { name: 'דנה', phone: '03-1234567', email: '' }, goals: ['פנסיה', 'הטבות מס'], time: 'בערב', summary: 'סיכום\nשורה שנייה', sessionId: 'abc-123', source: 'utm_source=instagram', consent: true, marketing: true, ...extra });

test('the contact function refuses what it should', async () => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    fn._resetMemory();
    assert.equal((await post(fn, home(), {}, { Origin: 'https://evil.example' })).status, 403, 'another site');
    assert.equal((await post(fn, home(), {}, { 'Content-Type': 'text/plain' })).status, 415, 'not JSON');
    assert.equal((await post(fn, '{', {})).status, 400, 'broken JSON');
    assert.equal((await post(fn, home({ form: 'other' }))).status, 400, 'an unknown form');
    assert.equal((await post(fn, home({ consent: false }))).status, 400, 'no consent');
    assert.equal((await post(fn, home({ goals: [] }))).status, 400, 'the home form needs a topic');
    assert.equal((await post(fn, home({ goals: ['משהו אחר'] }))).status, 400, 'only the listed topics count');
    const bad = await post(fn, home({ contact: { name: 'x', phone: '123', email: 'not-an-email' } }));
    assert.equal(bad.status, 400);
    assert.deepEqual((await bad.json()).fields.sort(), ['email', 'name', 'phone']);
    assert.equal(globalThis.fetch.calls.length, 0, 'nothing refused was sent');
    const bot = await post(fn, home({ website: 'http://spam' }));
    assert.equal(bot.status, 200);
    assert.equal(globalThis.fetch.calls.length, 0, 'a bot gets a quiet ok and nothing is sent');
  } finally { globalThis.fetch = realFetch; }
});

test('the home form arrives as the designed right-to-left e-mail through MAILER, and Sheets keeps its fields', async () => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    fn._resetMemory();
    const MAILER = mailer();
    const r = await post(fn, home({ goals: ['פנסיה', 'ביטוחים', 'פנסיה', 'זבל'], contact: { name: '  דנה   כהן ', phone: '052-1234567', email: 'dana@example.com' } }), { MAILER });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).via, 'mailer');
    assert.equal(MAILER.sent.length, 1);
    const m = MAILER.sent[0];
    assert.equal(m.subject, 'פנייה חדשה מהאתר – דנה כהן');
    assert.equal(m.replyTo, 'dana@example.com');
    assert(m.html.includes('<html lang="he" dir="rtl">') && m.html.includes('text-align:right'), 'right to left');
    assert(m.html.includes('ליד מטופס יצירת הקשר באתר') && m.html.includes('tel:0521234567') && m.html.includes('mailto:dana@example.com'));
    assert(m.html.includes('פנסיה, ביטוחים') && !m.html.includes('זבל'), 'only the listed topics, once each');
    assert(m.text.includes('מקור: אתר עסקי, דף הבית'));
    assert(!globalThis.fetch.calls.some((c) => c.url.includes('formspree')), 'no Formspree when MAILER works');
    const sh = globalThis.fetch.calls.find((c) => c.url.includes('script.google.com'));
    assert(sh, 'Sheets was called');
    const sheet = new URLSearchParams(sh.init.body);
    assert.equal(sheet.get('שם מלא'), 'דנה כהן');
    assert.equal(sheet.get('מקור'), 'אתר עסקי, דף הבית');
    assert.equal(sheet.get('מטרה'), 'פנסיה, ביטוחים');
    assert.equal(sheet.get('הסכמה לדיוור'), 'לא');
    assert.equal(sheet.get('_subject'), null, 'Sheets gets no mail settings');
    // the same phone again within the hour is not sent twice
    const again = await post(fn, home(), { MAILER }, { 'CF-Connecting-IP': '203.0.113.8' });
    assert.equal((await again.json()).duplicate, true);
    assert.equal(MAILER.sent.length, 1);
  } finally { globalThis.fetch = realFetch; }
});

test('the compass form keeps its summary, time and source, accepts a first name and a landline, and escapes HTML', async () => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    fn._resetMemory();
    const MAILER = mailer();
    const r = await post(fn, compass({ time: 'בלילה<script>', summary: 'סיכום\nשורה <b>שנייה</b>' }), { MAILER });
    assert.equal(r.status, 200);
    const m = MAILER.sent[0];
    assert.equal(m.subject, 'פנייה חדשה מהמצפן הפיננסי – דנה');
    assert(m.html.includes('ליד מהמצפן הפיננסי') && m.html.includes('סיכום המצפן (דיווח עצמי)'));
    assert(m.html.includes('סיכום<br>שורה &lt;b&gt;שנייה&lt;/b&gt;'), 'line breaks kept, HTML escaped');
    assert(m.html.includes('abc-123') && m.html.includes('utm_source=instagram'));
    assert(!m.html.includes('בלילה'), 'a time outside the list is dropped');
    assert.equal(m.replyTo, '', 'no reply-to without an e-mail');
    const sheet = new URLSearchParams(globalThis.fetch.calls.find((c) => c.url.includes('script.google.com')).init.body);
    assert.equal(sheet.get('סיכום המצפן'), 'סיכום\nשורה <b>שנייה</b>');
    assert.equal(sheet.get('מזהה שאלון'), 'abc-123');
    assert.equal(sheet.get('הסכמה לדיוור'), 'כן');
  } finally { globalThis.fetch = realFetch; }
});

test('when MAILER fails, Formspree gets the full text as a fallback', async () => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  try {
    fn._resetMemory();
    const r = await post(fn, home(), { MAILER: mailer(false) });
    assert.equal((await r.json()).via, 'formspree');
    const f = JSON.parse(globalThis.fetch.calls.find((c) => c.url.includes('formspree')).init.body);
    assert.equal(f._subject, 'פנייה חדשה מהאתר – דנה כהן');
    assert(f['פירוט מלא'].includes('נושאים: פנסיה, ביטוחים'));
    assert.equal(f.email, 'dana@example.com');
  } finally { globalThis.fetch = realFetch; }
});

test('when every delivery fails the message waits in KV and goes out on a later request; the rate limit holds', async () => {
  const fn = await load();
  const realFetch = globalThis.fetch;
  const LEADS = kv();
  try {
    globalThis.fetch = fakeFetch(false);
    const r = await post(fn, home(), { LEADS });
    assert.equal(r.status, 202);
    assert.equal([...LEADS.m.keys()].filter((k) => k.startsWith('ct:q:')).length, 1);
    globalThis.fetch = fakeFetch(true);
    const MAILER = mailer();
    await fn.onRequestPost({ request: new Request('https://romanoinvest.co.il/api/contact', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }), env: { LEADS, MAILER }, waitUntil: (p) => p });
    await new Promise((res) => setTimeout(res, 20));
    assert.equal([...LEADS.m.keys()].filter((k) => k.startsWith('ct:q:')).length, 0, 'the waiting message was sent');
    assert(MAILER.sent.length === 1 && MAILER.sent[0].html.includes('dir="rtl"'), 'as the designed e-mail');
    // no KV and Formspree down: an honest error
    fn._resetMemory();
    globalThis.fetch = fakeFetch(false);
    assert.equal((await post(fn, home({ contact: { name: 'דנה כהן', phone: '054-7654321', email: '' } }), {}, { 'CF-Connecting-IP': '203.0.113.20' })).status, 502);
    // rate: five sends an hour from one address
    fn._resetMemory();
    globalThis.fetch = fakeFetch(true);
    for (let i = 0; i < 5; i++) assert.equal((await post(fn, home({ contact: { name: 'דנה כהן', phone: `050-000000${i}`, email: '' } }), {}, { 'CF-Connecting-IP': '203.0.113.30' })).status, 200);
    assert.equal((await post(fn, home({ contact: { name: 'דנה כהן', phone: '050-0000009', email: '' } }), {}, { 'CF-Connecting-IP': '203.0.113.30' })).status, 429);
  } finally { globalThis.fetch = realFetch; }
});
