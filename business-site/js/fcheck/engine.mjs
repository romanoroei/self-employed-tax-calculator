// /financial-check: the deterministic engine. No DOM, no network, no wording of its own.
// It reads the questions and routes (questions.mjs), the classification (rules.mjs) and the settings (config.mjs).
// The same module runs in the browser, in the tests and in the lead function on the server, so the server
// re-checks every answer and works out the track and the grade itself: nothing the browser claims is trusted.
//
// The state is only the answer history. Everything else (facts, the next question, the progress, the result)
// is recomputed from it on every step, so a changed answer can never leave a stale conclusion behind.
import { ENTRY, QUESTIONS, ROUTES, TEXTS, CONSENT } from './questions.mjs';
import { TRACKS, TRACK_RULES, GRADE, GRADE_LABELS, GRADE_RULES, URGENCY, TALKING_POINTS } from './rules.mjs';
import { CONFIG } from './config.mjs';

export const STATE_VERSION = 1;
export const MAX_QUESTIONS = 10;
const ROUTE_GUESS = 7; // the progress estimate before the first answer picks a route

// ---------- the season (month-day in Israel time) ----------
export function israelParts(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return p;
}
export function inSeason(now = new Date(), season = CONFIG.season) {
  if (!season || !season.enabled) return false;
  const p = israelParts(now);
  const md = `${p.month}-${p.day}`;
  return season.from <= season.to ? md >= season.from && md <= season.to : md >= season.from || md <= season.to;
}
export function israelTime(now = new Date()) {
  const p = israelParts(now);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

// ---------- conditions: true, false, or null when a fact they need is not known yet ----------
function ev3(c, ctx) {
  if (!c) return true;
  if (c.all) { const r = c.all.map((x) => ev3(x, ctx)); return r.includes(false) ? false : r.includes(null) ? null : true; }
  if (c.any) { const r = c.any.map((x) => ev3(x, ctx)); return r.includes(true) ? true : r.includes(null) ? null : false; }
  if (c.not) { const r = ev3(c.not, ctx); return r === null ? null : !r; }
  if ('season' in c) return ctx.season === c.season;
  if ('track' in c) {
    const t = trackOf(ctx.facts);
    if (t === null) return null;
    return Array.isArray(c.track) ? c.track.includes(t) : t === c.track;
  }
  if ('fact' in c) {
    const v = ctx.facts[c.fact];
    if (v === undefined) return null;
    if ('is' in c) return v === c.is;
    if ('in' in c) return c.in.includes(v);
  }
  throw new Error('Unknown condition: ' + JSON.stringify(c));
}
const ev = (c, ctx) => ev3(c, ctx) === true;

// the professional track: the first rule that holds; null while the answers cannot tell yet
export function trackOf(facts) {
  const ctx = { facts, season: false };
  for (const r of TRACK_RULES) {
    // a track rule never refers to the track itself or the season, so plain evaluation is safe here
    if (ev3(r.when, ctx) === true) return r.track;
  }
  return null;
}

// ---------- the route ----------
function plan(facts) {
  const steps = [{ q: ENTRY }];
  if (facts.need && ROUTES[facts.need]) steps.push(...ROUTES[facts.need]);
  return steps;
}
function pick(ctx, asked) {
  if (asked.length >= MAX_QUESTIONS) return null;
  for (const step of plan(ctx.facts)) {
    const q = QUESTIONS[step.q];
    if (asked.includes(step.q)) continue;
    if (ctx.facts[q.fact] !== undefined) continue; // already known from another answer
    if (step.when && !ev(step.when, ctx)) continue;
    return step.q;
  }
  return null;
}
// questions still ahead, counting a conditional one while it might still come up
function remaining(ctx, asked) {
  if (!ctx.facts.need) return ROUTE_GUESS;
  let n = 0;
  const seenFacts = new Set();
  for (const step of plan(ctx.facts)) {
    const q = QUESTIONS[step.q];
    if (asked.includes(step.q) || ctx.facts[q.fact] !== undefined || seenFacts.has(q.fact)) continue;
    if (step.when && ev3(step.when, ctx) === false) continue;
    seenFacts.add(q.fact);
    n++;
  }
  return Math.min(n, MAX_QUESTIONS - asked.length);
}

function walk(state, opts = {}) {
  const now = opts.now || new Date();
  const facts = {};
  const ctx = { facts, season: inSeason(now, opts.season) };
  const asked = [];
  const valid = [];
  let stale = false;
  for (const entry of state.history) {
    const expected = pick(ctx, asked);
    const q = QUESTIONS[entry.q];
    if (!expected || expected !== entry.q || !q.options.some((o) => o.id === entry.o)) { stale = true; break; }
    facts[q.fact] = entry.o;
    for (const d of q.derive || []) if (d.if.includes(entry.o)) for (const [k, v] of Object.entries(d.set)) if (facts[k] === undefined) facts[k] = v;
    asked.push(entry.q);
    valid.push(entry);
  }
  const next = pick(ctx, asked);
  return { ctx, facts, asked, valid, stale, next, done: !next && facts.need !== undefined && !stale };
}

// ---------- state operations (each returns a new state) ----------
export function newState(now = new Date()) {
  const id = 'f' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 8);
  return { v: STATE_VERSION, sessionId: id, history: [], drafts: {} };
}
const clone = (s) => ({ ...s, history: s.history.slice(), drafts: { ...s.drafts } });

export function answer(state, qid, optionId, opts) {
  const w = walk(state, opts);
  if (w.next !== qid) throw new Error('Not the current question: ' + qid);
  if (!QUESTIONS[qid].options.some((o) => o.id === optionId)) throw new Error('Unknown option for ' + qid);
  const s = clone(state);
  s.history = w.valid.concat({ q: qid, o: optionId });
  delete s.drafts[qid];
  return s;
}
export function back(state) {
  if (!state.history.length) return state;
  const s = clone(state);
  const last = s.history.pop();
  s.drafts[last.q] = last.o;
  return s;
}
// Change an earlier answer: that question becomes current again. The later answers are dropped from the
// record; they stay only as a pre-selection if the same question comes up again, and count only when confirmed.
export function editFrom(state, qid) {
  const i = state.history.findIndex((h) => h.q === qid);
  if (i < 0) return state;
  const s = clone(state);
  for (const h of s.history.slice(i)) s.drafts[h.q] = h.o;
  s.history = s.history.slice(0, i);
  return s;
}

// ---------- what the interface shows ----------
export function view(state, opts) {
  const w = walk(state, opts);
  const answered = w.valid.length;
  const total = answered + remaining(w.ctx, w.asked);
  const base = { answered, total: Math.max(total, answered + (w.next ? 1 : 0)), canBack: state.history.length > 0, done: w.done, season: w.ctx.season };
  if (!w.next) return { ...base, question: null };
  const q = QUESTIONS[w.next];
  const draft = state.drafts[w.next];
  return {
    ...base,
    index: answered + 1,
    question: { id: w.next, text: q.text, help: q.help || '', options: q.options.map((o) => ({ id: o.id, label: o.label })), selected: q.options.some((o) => o.id === draft) ? draft : null },
  };
}

// The questions actually asked, in order, with the option chosen and the text that was shown.
export function answersList(state, opts) {
  return walk(state, opts).valid.map((h) => {
    const q = QUESTIONS[h.q];
    const o = q.options.find((x) => x.id === h.o);
    return { q: h.q, o: h.o, label: q.label, question: q.text, answer: o.label };
  });
}

// ---------- the result: track, grade and the reasons ----------
export function result(state, opts) {
  const w = walk(state, opts);
  if (!w.done) return null;
  const ctx = w.ctx;
  const track = trackOf(w.facts) || 'general';
  const T = TRACKS[track];
  const variant = (T.variants || []).find((x) => ev(x.when, ctx));
  let score = 0;
  const reasons = [];
  for (const r of GRADE_RULES) if (ev(r.when, ctx)) { score += r.pts; reasons.push({ pts: r.pts, why: r.why }); }
  const grade = score >= GRADE.A ? 'A' : score >= GRADE.B ? 'B' : 'C';
  return {
    track,
    title: T.title,
    text: variant ? variant.text : T.text,
    seasonNote: track === 'selfemp' && ctx.season && w.facts.bizStatus !== 'planning' ? TEXTS.season : '',
    grade,
    gradeLabel: GRADE_LABELS[grade],
    score,
    reasons: reasons.sort((a, b) => b.pts - a.pts),
    talking: TALKING_POINTS.filter((t) => ev(t.when, ctx)).map((t) => t.text),
    urgency: w.facts.urgency ? URGENCY[w.facts.urgency] : 'לא נאסף',
    facts: { ...w.facts },
    season: ctx.season,
  };
}

// ---------- contact details and the referral source ----------
const NAME_RE = /^[\p{L}][\p{L}\p{M} '"׳״.\-]{0,58}[\p{L}.]$/u;
export function cleanPhone(raw) {
  const digits = String(raw || '').replace(/[\s\-().]/g, '');
  const m = digits.match(/^(?:\+972|972|0)(5\d)(\d{7})$/);
  return m ? `0${m[1]}-${m[2]}` : null;
}
export function checkContact(input) {
  const c = input || {};
  const name = String(c.name || '').replace(/\s+/g, ' ').trim();
  const phone = cleanPhone(c.phone);
  const email = String(c.email || '').trim();
  const errors = {};
  if (!NAME_RE.test(name) || (name.match(/\p{L}/gu) || []).length < 2) errors.name = 'נא למלא שם מלא';
  if (!phone) errors.phone = 'נא למלא מספר נייד ישראלי, למשל 050-1234567';
  if (email && (email.length > 100 || !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(email))) errors.email = 'כתובת הדוא"ל אינה תקינה';
  return { ok: !Object.keys(errors).length, errors, clean: { name, phone, email } };
}

const tidy = (v, max = 60) => String(v || '').toLowerCase().slice(0, max).replace(/[^a-z0-9_.\-]/g, '');
// What came with the link: kept for the lead record only. Anything outside a small character set is dropped.
export function cleanSource(src) {
  const s = src || {};
  let referrer = '';
  try { referrer = s.referrer ? new URL(s.referrer).hostname.slice(0, 80) : ''; } catch (e) { referrer = ''; }
  return {
    ref: tidy(s.ref, 32),
    utm_source: tidy(s.utm_source),
    utm_medium: tidy(s.utm_medium),
    utm_campaign: tidy(s.utm_campaign, 80),
    referrer: /^[a-z0-9.\-]+$/i.test(referrer) ? referrer : '',
  };
}
// the label the counters use for a ref: a known partner, "other", or "direct" with no ref at all
export function refLabel(ref) {
  const r = tidy(ref, 32);
  if (!r) return 'direct';
  return CONFIG.partners.includes(r) ? r : 'other';
}
export function landingUrl(src) {
  const s = cleanSource(src);
  const q = new URLSearchParams();
  for (const k of ['ref', 'utm_source', 'utm_medium', 'utm_campaign']) if (s[k]) q.set(k, s[k]);
  const qs = q.toString();
  return CONFIG.pageUrl + (qs ? '?' + qs : '');
}

// ---------- the lead email for Roei (section 15 of the brief) ----------
const notCollected = 'לא נאסף';
export function leadMessage(state, contact, source, consent, opts = {}) {
  const res = result(state, opts);
  if (!res) return null;
  const now = opts.now || new Date();
  const c = checkContact(contact).clean;
  const s = cleanSource(source);
  const list = answersList(state, opts);
  const valueOf = (fact) => { const a = list.find((x) => QUESTIONS[x.q].fact === fact); return a ? a.answer : notCollected; };
  const L = [];
  L.push('פרטי הפונה');
  L.push(`שם מלא: ${c.name}`);
  L.push(`נייד: ${c.phone}`);
  L.push(`דוא"ל: ${c.email || 'לא נמסר'}`);
  L.push(`נשלח: ${israelTime(now)} (שעון ישראל)`);
  L.push('');
  L.push(`תשובות השאלון (${list.length} שאלות, לפי הסדר, דיווח עצמי)`);
  list.forEach((a, i) => { L.push(`${i + 1}. ${a.question}`); L.push(`   ${a.answer}`); });
  L.push('');
  L.push('ניתוח פנימי (לא נשלח לפונה)');
  L.push(`מסלול ההתאמה: ${res.title}`);
  L.push(`דירוג: ${res.grade} (${res.gradeLabel}), ${res.score} נקודות`);
  L.push(`סיבת הדירוג: ${res.reasons.length ? res.reasons.map((r) => `${r.why} (${r.pts})`).join('; ') : 'לא נמצאו סימנים מעבר להתעניינות ראשונית'}`);
  L.push(`הצורך המרכזי: ${valueOf('need')}`);
  L.push(`דחיפות: ${res.urgency}`);
  L.push(`סכום פנוי: ${valueOf('amount')}`);
  L.push(`חיסכון חודשי: ${valueOf('monthly')}`);
  L.push('נקודות לבירור בשיחה:');
  if (res.talking.length) res.talking.forEach((t) => L.push(`- ${t}`)); else L.push('- אין נקודות מיוחדות מעבר לתשובות');
  L.push('');
  L.push('פרטי מקור');
  L.push(`מזהה שיתוף הפעולה (ref): ${s.ref || 'ללא'}`);
  L.push(`מקור ההפניה: ${s.referrer || 'לא ידוע'}`);
  L.push(`UTM source: ${s.utm_source || 'ללא'}`);
  L.push(`UTM medium: ${s.utm_medium || 'ללא'}`);
  L.push(`UTM campaign: ${s.utm_campaign || 'ללא'}`);
  L.push(`כתובת דף הנחיתה: ${landingUrl(s)}`);
  L.push('');
  L.push('הסכמה');
  L.push(`הסכמה ליצירת קשר: ${consent && consent.contact ? 'כן' : 'לא'}`);
  L.push(`מועד ההסכמה: ${israelTime(now)} (שעון ישראל)`);
  L.push(`גרסת נוסח ההסכמה: ${CONSENT.version}`);
  L.push(`הסכמה לדיוור: ${consent && consent.marketing ? 'כן' : 'לא'}`);
  L.push('');
  L.push(`מזהה שאלון: ${state.sessionId}`);
  const safeName = c.name.replace(/[\r\n]/g, ' ');
  return { subject: `ליד חדש – התאמה פיננסית – ${safeName} – דירוג ${res.grade}`, text: L.join('\n'), result: res };
}

// ---------- rebuilding a state from a list of answers (session storage, and the server) ----------
const SESSION_RE = /^f[a-z0-9]{6,20}$/;
export function fromAnswers(sessionId, answers, opts) {
  if (!SESSION_RE.test(String(sessionId || '')) || !Array.isArray(answers) || answers.length > MAX_QUESTIONS) return null;
  const state = { v: STATE_VERSION, sessionId, history: [], drafts: {} };
  for (const a of answers) {
    if (!a || typeof a.q !== 'string' || typeof a.o !== 'string' || !QUESTIONS[a.q]) return null;
    state.history.push({ q: a.q, o: a.o });
  }
  const w = walk(state, opts);
  return w.stale ? null : state;
}
export function restore(json, opts) {
  try {
    const s = JSON.parse(json);
    if (!s || s.v !== STATE_VERSION) return null;
    const state = { v: STATE_VERSION, sessionId: s.sessionId, history: [], drafts: {} };
    if (!SESSION_RE.test(String(s.sessionId || '')) || !Array.isArray(s.history)) return null;
    state.history = s.history.filter((h) => h && QUESTIONS[h.q]).map((h) => ({ q: h.q, o: h.o }));
    state.history = walk(state, opts).valid; // whatever no longer fits the questions is dropped
    return state;
  } catch (e) { return null; }
}

// ---------- self-check of the definitions, run by the tests ----------
export function validateDefinitions() {
  const errors = [];
  const facts = new Set(Object.values(QUESTIONS).map((q) => q.fact));
  for (const q of Object.values(QUESTIONS)) for (const d of q.derive || []) Object.keys(d.set).forEach((k) => facts.add(k));
  const tracks = Object.keys(TRACKS);
  const check = (c, where) => {
    if (!c) return;
    if (c.all || c.any) return (c.all || c.any).forEach((x) => check(x, where));
    if (c.not) return check(c.not, where);
    if ('fact' in c) {
      if (!facts.has(c.fact)) errors.push(`${where}: unknown fact ${c.fact}`);
      const values = Object.values(QUESTIONS).filter((q) => q.fact === c.fact).flatMap((q) => q.options.map((o) => o.id)).concat(Object.values(QUESTIONS).flatMap((q) => (q.derive || []).flatMap((d) => (d.set[c.fact] ? [d.set[c.fact]] : []))));
      for (const v of 'is' in c ? [c.is] : c.in || []) if (!values.includes(v)) errors.push(`${where}: ${c.fact} has no value ${v}`);
    }
    if ('track' in c) for (const t of [].concat(c.track)) if (!tracks.includes(t)) errors.push(`${where}: unknown track ${t}`);
  };
  for (const [id, q] of Object.entries(QUESTIONS)) {
    if (!q.label || !q.text || !q.fact) errors.push(`${id}: missing label, text or fact`);
    const ids = q.options.map((o) => o.id);
    if (q.options.length < 2 || new Set(ids).size !== ids.length) errors.push(`${id}: options`);
  }
  for (const o of QUESTIONS[ENTRY].options) if (!ROUTES[o.id]) errors.push(`entry option ${o.id}: no route`);
  for (const [r, steps] of Object.entries(ROUTES)) {
    if (steps.length + 1 > MAX_QUESTIONS) errors.push(`route ${r}: too long`);
    for (const s of steps) { if (!QUESTIONS[s.q]) errors.push(`route ${r}: unknown question ${s.q}`); check(s.when, `route ${r} ${s.q}`); }
  }
  TRACK_RULES.forEach((r, i) => { check(r.when, `track rule ${i}`); if (!TRACKS[r.track]) errors.push(`track rule ${i}: unknown track`); });
  GRADE_RULES.forEach((r, i) => { check(r.when, `grade rule ${i}`); if (!(r.pts > 0) || !r.why) errors.push(`grade rule ${i}: points must be positive, with a reason`); });
  TALKING_POINTS.forEach((r, i) => check(r.when, `talking point ${i}`));
  return errors;
}

export { QUESTIONS, ROUTES, TEXTS, CONSENT, TRACKS, CONFIG };
