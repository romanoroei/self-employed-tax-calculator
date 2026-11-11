// /financial-check: the branching, the classification, the lead message and the lead function.
// Runs in the build (scripts/build-cloudflare.mjs); a failure stops publication.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = (p) => import(pathToFileURL(path.join(root, p)).href);
const engine = () => load('business-site/js/fcheck/engine.mjs');
const NOW = new Date('2026-11-20T10:00:00Z'); // in season
const OFF = new Date('2026-06-15T10:00:00Z'); // out of season

function run(E, picks, now = NOW) {
  let s = E.newState(now);
  for (const o of picks) {
    const v = E.view(s, { now });
    if (!v.question) throw new Error('no question left for ' + o);
    s = E.answer(s, v.question.id, o, { now });
  }
  return s;
}
const asked = (E, s) => E.answersList(s, { now: NOW }).map((a) => a.q);
const nextId = (E, s) => (E.view(s, { now: NOW }).question || {}).id;

test('the definitions check themselves', async () => {
  const E = await engine();
  assert.deepEqual(E.validateDefinitions(), []);
});

test('each first answer opens its own route', async () => {
  const E = await engine();
  const first = { invest: 'a_amount', monthly: 'b_monthly', pension: 'c_employment', selfemp: 'd_status', unsure: 'e_employment' };
  for (const [need, q] of Object.entries(first)) assert.equal(nextId(E, run(E, [need])), q, need);
});

test('conditional questions appear only in their cases', async () => {
  const E = await engine();
  // the purpose of the money: only from 100,000 ₪
  assert.equal(nextId(E, run(E, ['invest', '100to300'])), 'a_purpose');
  assert.equal(nextId(E, run(E, ['invest', 'over300'])), 'a_purpose');
  assert.equal(nextId(E, run(E, ['invest', '50to100'])), 'a_horizon');
  // deposits of the self-employed: only for the self-employed
  assert.equal(nextId(E, run(E, ['pension', 'self'])), 'c_selfdeposits');
  assert.equal(nextId(E, run(E, ['pension', 'both'])), 'c_selfdeposits');
  assert.equal(nextId(E, run(E, ['pension', 'employee'])), 'c_focus');
  // the reason for the insurance check: only when insurance is chosen
  assert.equal(nextId(E, run(E, ['pension', 'employee', 'insurance'])), 'c_insreason');
  assert.equal(nextId(E, run(E, ['pension', 'employee', 'fees'])), 'c_lastcheck');
  // study fund and pension interest: only without one
  assert.equal(nextId(E, run(E, ['selfemp', 'licensed', 'none'])), 'd_study_interest');
  assert.equal(nextId(E, run(E, ['selfemp', 'licensed', 'regular'])), 'd_pension');
  assert.equal(nextId(E, run(E, ['selfemp', 'licensed', 'regular', 'none'])), 'd_pension_interest');
  assert.equal(nextId(E, run(E, ['selfemp', 'licensed', 'regular', 'regular'])), 'd_checked');
  // planning a business: no question about this year's deposits
  assert.equal(nextId(E, run(E, ['selfemp', 'planning', 'regular', 'regular'])), 'd_goal');
});

test('route E maps the need and asks at most one focused question', async () => {
  const E = await engine();
  const cases = [
    [['unsure', 'self', 'tax', 'none', 'upto500', 'month'], 'd_checked', 'selfemp'],
    [['unsure', 'employee', 'tax', 'none', 'upto500', 'month'], 'c_focus', 'pension'],
    [['unsure', 'employee', 'unknown', 'none', 'none', 'month'], 'c_focus', 'pension'],
    [['unsure', 'employee', 'idle', '25to100', 'none', 'asap'], 'a_horizon', 'invest'],
    [['unsure', 'employee', 'idle', 'none', 'upto500', 'asap'], 'b_goal', 'savings'],
    [['unsure', 'employee', 'notsaving', 'none', 'upto500', 'asap'], 'b_goal', 'savings'],
    [['unsure', 'other', 'order', 'over300', 'none', 'asap'], 'a_horizon', 'invest'],
  ];
  for (const [picks, follow, track] of cases) {
    const s = run(E, picks);
    assert.equal(nextId(E, s), follow, picks.join(','));
    const done = run(E, [...picks, E.QUESTIONS[follow].options[0].id]);
    assert.equal(nextId(E, done), undefined, 'one follow-up only: ' + picks.join(','));
    assert.equal(E.result(done, { now: NOW }).track, track);
  }
  // the general map: no follow-up question at all
  const gen = run(E, ['unsure', 'employee', 'order', 'none', 'none', 'explore']);
  assert.equal(E.view(gen, { now: NOW }).done, true);
  assert.equal(E.result(gen, { now: NOW }).track, 'general');
});

// Every way through the questionnaire that can change the route: every option of each question a condition
// or a track rule depends on, and the first and last option of the others. No question outside the route,
// no fact asked twice, never more than ten questions, a result at the end, and a progress count that lands exactly.
test('every path through every route stays within its rules', async () => {
  const E = await engine();
  const routeOf = (need) => new Set(['need', ...E.ROUTES[need].map((s) => s.q)]);
  let paths = 0;
  const facts = new Set();
  const collect = (c) => { if (!c) return; if (c.all || c.any) return (c.all || c.any).forEach(collect); if (c.not) return collect(c.not); if (c.fact) facts.add(c.fact); if (c.track) ['need', 'concern', 'employment', 'amount'].forEach((x) => facts.add(x)); };
  Object.values(E.ROUTES).flat().forEach((st) => collect(st.when));
  facts.add('need');
  const choices = (q) => (facts.has(E.QUESTIONS[q.id].fact) ? q.options : [q.options[0], q.options[q.options.length - 1]]);
  function walk(s, depth) {
    const v = E.view(s, { now: NOW });
    if (!v.question) {
      paths++;
      const list = E.answersList(s, { now: NOW });
      const need = list[0].o;
      const allowed = routeOf(need);
      const facts = list.map((a) => E.QUESTIONS[a.q].fact);
      assert(list.every((a) => allowed.has(a.q)), 'question outside the route');
      assert.equal(new Set(facts).size, facts.length, 'a fact asked twice');
      assert(list.length >= 5 && list.length <= 10, 'length ' + list.length);
      const r = E.result(s, { now: NOW });
      assert(r && ['A', 'B', 'C'].includes(r.grade) && E.TRACKS[r.track]);
      return;
    }
    assert(v.index <= v.total, 'progress beyond its total');
    assert(depth < 10);
    for (const o of choices(v.question)) {
      const next = E.answer(s, v.question.id, o.id, { now: NOW });
      const nv = E.view(next, { now: NOW });
      if (!nv.question) assert.equal(v.total, v.index, 'the last question shows as the last: ' + asked(E, next).join(','));
      walk(next, depth + 1);
    }
  }
  walk(E.newState(NOW), 0);
  assert(paths > 1000, 'paths ' + paths);
});

test('going back and changing an answer rebuilds the route and drops what no longer fits', async () => {
  const E = await engine();
  let s = run(E, ['invest', 'over300', 'home', 'y3to5', 'grow', 'checking', 'asap']);
  assert.equal(E.result(s, { now: NOW }).track, 'invest');
  s = E.editFrom(s, 'need');
  s = E.answer(s, 'need', 'pension', { now: NOW });
  assert.equal(nextId(E, s), 'c_employment');
  assert.deepEqual(asked(E, s), ['need']);
  // a lower sum: the purpose question disappears
  let t = run(E, ['invest', 'over300', 'home', 'y3to5']);
  t = E.editFrom(t, 'a_amount');
  t = E.answer(t, 'a_amount', '25to50', { now: NOW });
  assert.equal(nextId(E, t), 'a_horizon');
  assert(!asked(E, t).includes('a_purpose'));
  // the earlier answer is offered again, pre-selected, but not counted until confirmed
  assert.equal(E.view(t, { now: NOW }).question.selected, 'y3to5');
  assert(!asked(E, t).includes('a_horizon'));
  // back keeps the answer as a pre-selection
  const b = E.back(run(E, ['monthly', 'upto500']));
  assert.equal(E.view(b, { now: NOW }).question.selected, 'upto500');
});

test('the result needs no contact details', async () => {
  const E = await engine();
  const s = run(E, ['monthly', '500to1500', 'none', 'home', 'y3to5', 'no', 'month']);
  const r = E.result(s, { now: NOW });
  assert.equal(r.track, 'savings');
  assert.equal(r.title, 'חיסכון חודשי');
});

test('the grade follows the brief: big sums and the self-employed rank high, a small sum is never turned away', async () => {
  const E = await engine();
  const g = (picks, now = NOW) => E.result(run(E, picks, now), { now });
  assert.equal(g(['invest', '100to300', 'general', 'y5plus', 'grow', 'deposit', 'asap']).grade, 'A');
  const self = g(['selfemp', 'licensed', 'regular', 'irregular', 'notyet', 'tax', 'yearend']);
  assert(['A', 'B'].includes(self.grade));
  assert(['A', 'B'].includes(g(['pension', 'employee', 'all', 'general', 'never', 'partial', 'job', 'asap']).grade));
  assert(['B', 'C'].includes(g(['monthly', 'upto500', 'none', 'longterm', 'y5plus', 'no', 'explore']).grade));
  // points are only ever added: a low sum scores more than no sum, never less
  const low = g(['unsure', 'employee', 'order', 'upto25', 'none', 'explore']).score;
  const none = g(['unsure', 'employee', 'order', 'none', 'none', 'explore']).score;
  assert(low > none);
  // before the year end weighs more in the season than outside it
  const picks = ['selfemp', 'licensed', 'regular', 'regular', 'self', 'tax', 'yearend'];
  assert(g(picks, NOW).score > g(picks, OFF).score);
  // planning a business: no year-end note and no promise of a benefit
  const plan = g(['selfemp', 'planning', 'none', 'yes', 'none', 'yes', 'tax', 'asap']);
  assert.equal(plan.seasonNote, '');
  assert(plan.text.includes('לקראת פתיחת העסק'));
});

test('the lead message lists exactly the questions asked, in order, and marks what was not collected', async () => {
  const E = await engine();
  const s = run(E, ['pension', 'employee', 'fees', 'y3plus', 'yes', 'none', 'later']);
  const m = E.leadMessage(s, { name: 'דנה כהן', phone: '+972 52-123-4567', email: 'dana@example.com' }, { ref: 'Partner01', utm_source: 'Instagram', utm_medium: 'influencer', utm_campaign: 'year_end_2026<script>', referrer: 'https://l.instagram.com/abc?x=1' }, { contact: true, marketing: true }, { now: NOW });
  assert.equal(m.subject, `ליד חדש – התאמה פיננסית – דנה כהן – דירוג ${m.result.grade}`);
  const list = E.answersList(s, { now: NOW });
  let at = -1;
  for (const a of list) { const i = m.text.indexOf(a.question, at + 1); assert(i > at, 'order: ' + a.question); at = i; }
  assert(!m.text.includes(E.QUESTIONS.c_insreason.text) && !m.text.includes(E.QUESTIONS.c_selfdeposits.text), 'skipped questions are not listed');
  for (const part of ['נייד: 052-1234567', 'סכום פנוי: לא נאסף', 'חיסכון חודשי: לא נאסף', 'ref): partner01', 'UTM campaign: year_end_2026script', 'מקור ההפניה: l.instagram.com', 'גרסת נוסח ההסכמה: fc-contact-2026-11-v1', 'הסכמה לדיוור: כן', '20.11.2026 12:00']) assert(m.text.includes(part), part);
});

test('contact details, campaign sources and the season are checked', async () => {
  const E = await engine();
  assert.equal(E.cleanPhone('0521234567'), '052-1234567');
  assert.equal(E.cleanPhone('+972-50-1234567'), '050-1234567');
  assert.equal(E.cleanPhone('03-1234567'), null);
  assert.equal(E.cleanPhone('052123'), null);
  assert.equal(E.checkContact({ name: 'א', phone: '0521234567' }).ok, false);
  assert.equal(E.checkContact({ name: 'דנה כהן', phone: '0521234567', email: 'not-an-email' }).ok, false);
  assert.equal(E.checkContact({ name: 'דנה כהן', phone: '0521234567', email: '' }).ok, true);
  assert.equal(E.checkContact({ name: '<b>x</b>', phone: '0521234567' }).ok, false);
  assert.equal(E.refLabel('partner01'), 'partner01');
  assert.equal(E.refLabel('someone_new'), 'other');
  assert.equal(E.refLabel(''), 'direct');
  assert.equal(E.cleanSource({ referrer: 'javascript:alert(1)' }).referrer, '');
  assert.equal(E.inSeason(NOW), true);
  assert.equal(E.inSeason(OFF), false);
  assert.equal(E.inSeason(NOW, { enabled: false, from: '11-01', to: '12-31' }), false);
  // 23:30 on 31.12 in Israel is still the season; 00:30 on 1.1 is not
  assert.equal(E.inSeason(new Date('2026-12-31T21:30:00Z')), true);
  assert.equal(E.inSeason(new Date('2026-12-31T22:30:00Z')), false);
});

// ---------- the lead function, with Formspree, Sheets and KV replaced by fakes ----------
async function leadFunction() {
  const src = fs.readFileSync(path.join(root, 'functions/api/lead.js'), 'utf8')
    .replace("'../../business-site/js/fcheck/engine.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'business-site/js/fcheck/engine.mjs')).href));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fc-')), 'lead.mjs');
  fs.writeFileSync(file, src);
  return import(pathToFileURL(file).href);
}
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
async function body(E, picks, extra = {}) {
  const s = run(E, picks, new Date());
  return { sessionId: s.sessionId, answers: s.history, contact: { name: 'דנה כהן', phone: '052-1234567', email: '' }, consent: { contact: true, marketing: false, version: E.CONSENT.version }, source: { ref: 'partner01', utm_source: 'instagram' }, ...extra };
}
const post = (fn, payload, env = {}, headers = {}) => fn.onRequestPost({
  request: new Request('https://romanoinvest.co.il/api/lead', { method: 'POST', headers: { Origin: 'https://romanoinvest.co.il', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  env,
  waitUntil: () => {},
});

test('the lead function refuses what it should, and works out the grade itself', async (t) => {
  const E = await engine();
  const fn = await leadFunction();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const picks = ['invest', 'over300', 'income', 'y5plus', 'grow', 'checking', 'asap'];

  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  assert.equal((await post(fn, await body(E, picks), {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(fn, await body(E, picks), {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(fn, 'x'.repeat(20000))).status, 413);
  assert.equal((await post(fn, await body(E, picks, { answers: [{ q: 'need', o: 'invest' }, { q: 'c_focus', o: 'all' }] }))).status, 400, 'a question outside the route');
  assert.equal((await post(fn, await body(E, picks.slice(0, 3)))).status, 400, 'an unfinished questionnaire');
  const badContact = await post(fn, await body(E, picks, { contact: { name: 'דנה כהן', phone: '12' } }));
  assert.equal(badContact.status, 400);
  assert.deepEqual((await badContact.json()).fields, ['phone']);
  assert.equal((await post(fn, await body(E, picks, { consent: { contact: false, version: E.CONSENT.version } }))).status, 400);
  assert.equal((await post(fn, await body(E, picks, { consent: { contact: true, version: 'old' } }))).status, 400);
  // a bot that filled the hidden field: a quiet "ok", nothing sent
  const bot = await post(fn, await body(E, picks, { website: 'http://spam' }));
  assert.equal(bot.status, 200);
  assert.equal(globalThis.fetch.calls.length, 0);

  // a real lead: Formspree and Sheets get the server's own message; a grade the browser made up is ignored
  const good = await body(E, picks, { grade: 'C', result: { grade: 'C' } });
  const r = await post(fn, good);
  assert.equal(r.status, 200);
  const sent = JSON.parse(globalThis.fetch.calls.find((c) => c.url.includes('formspree')).init.body);
  assert.equal(sent['דירוג'].slice(0, 1), 'A');
  assert(sent._subject.endsWith('דירוג A'));
  assert(sent['פירוט מלא'].includes('ref): partner01'));
  assert(globalThis.fetch.calls.some((c) => c.url.includes('script.google.com')));
  // the same form again: no second email
  const before = globalThis.fetch.calls.length;
  const again = await post(fn, good);
  assert.equal((await again.json()).duplicate, true);
  assert.equal(globalThis.fetch.calls.length, before);
});

test('the lead function limits the rate, and keeps a lead when Formspree fails', async (t) => {
  const E = await engine();
  const fn = await leadFunction();
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const picks = ['monthly', 'upto500', 'none', 'home', 'y5plus', 'no', 'months'];

  // five forms an hour from one address, then 429
  fn._resetMemory();
  globalThis.fetch = fakeFetch();
  const env = { LEADS: kv() };
  for (let i = 0; i < 5; i++) assert.equal((await post(fn, await body(E, picks), env)).status, 200);
  assert.equal((await post(fn, await body(E, picks), env)).status, 429);
  // nothing personal in the stored keys: hashes only
  assert([...env.LEADS.m.keys()].every((k) => /^fc:(?:rl|dd):[0-9a-f]{32}$/.test(k)));

  // Formspree down: the lead waits in KV and the visitor is told it was received
  fn._resetMemory();
  globalThis.fetch = fakeFetch(false);
  const env2 = { LEADS: kv() };
  const queued = await post(fn, await body(E, picks), env2);
  assert.equal(queued.status, 202);
  const qKey = [...env2.LEADS.m.keys()].find((k) => k.startsWith('fc:q:'));
  assert(qKey, 'queued');
  // the next request retries it once Formspree is back
  globalThis.fetch = fakeFetch(true);
  let flushing;
  await fn.onRequestPost({ request: new Request('https://romanoinvest.co.il/api/lead', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }), env: env2, waitUntil: (p) => { flushing = p; } });
  await flushing;
  assert(!env2.LEADS.m.has(qKey), 'sent and removed');

  // Formspree down and no KV: an honest error, so the page shows the phone number
  fn._resetMemory();
  globalThis.fetch = fakeFetch(false);
  assert.equal((await post(fn, await body(E, picks), {})).status, 502);
});
