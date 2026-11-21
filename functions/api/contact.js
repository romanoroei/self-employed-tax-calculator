// Cloudflare Pages Function: the contact form on the home page and the lead form of the compass (/compass).
// Until 2026-11-21 these two posted straight from the browser to Formspree and the Google Sheets script. Now the
// browser sends JSON here, and this function checks it and forwards it, the same way functions/api/lead.js does
// for the questionnaires:
// - only our own pages may post (Origin), JSON only, a size limit, a hidden field that drops bots quietly;
// - the fields are taken from a fixed list per form, trimmed and length-limited; the subject and the source
//   label are set here, never by the browser;
// - at most RATE_MAX sends per address per hour, and the same phone on the same form counts once an hour;
// - Formspree emails Roei (the address lives in Formspree) and a copy goes to the Sheets script. If Formspree
//   fails, the message waits in the KV namespace LEADS (14 days at most) and later requests try again.
// Nothing personal is logged; KV keeps hashes for the checks and, only after a failed delivery, the message.

const FORMSPREE = 'https://formspree.io/f/mvzjeykj';
const SHEETS = 'https://script.google.com/macros/s/AKfycbwt-mMdDo6fA___Mh57M8085t2bFPiiVpoKhq3j22hNyhqUybEKMp2t9X5RFm6PwlXa3g/exec';
const ORIGINS = ['https://romanoinvest.co.il', 'https://www.romanoinvest.co.il'];
const MAX_BODY = 16384;
const RATE_MAX = 5;
const HOUR = 3600;
const QUEUE_DAYS = 14;

const FORMS = {
  home: {
    subject: 'פנייה חדשה מהאתר',
    source: 'אתר עסקי, דף הבית',
    page: '/',
    goals: ['פתרון לכסף פנוי', 'פנסיה', 'קרן השתלמות', 'ביטוחים', 'הסדר פנסיוני לעובדים', 'לקראת פרישה', 'תמונה מלאה של הכול'],
    needGoal: true,
  },
  compass: {
    subject: 'פנייה חדשה מהמצפן הפיננסי',
    source: 'המצפן הפיננסי',
    page: '/compass',
    goals: ['פנסיה', 'ביטוחים', 'הטבות מס', 'חובת הפקדה', 'פתרון לכסף פנוי', 'תמונה מלאה של הכול'],
    times: ['', 'בבוקר', 'בצהריים', 'אחר הצהריים', 'בערב', 'לא משנה לי'],
  },
};

const memory = new Map();
export function _resetMemory() { memory.clear(); }

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const line = (v, max) => text(v, max).replace(/\s+/g, ' ');

async function sha(s) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function store(env) {
  const kv = env.LEADS;
  return {
    kv: !!kv,
    async get(key) {
      if (kv) { try { return await kv.get(key); } catch (e) { return null; } }
      const hit = memory.get(key);
      return hit && hit.until > Date.now() ? hit.value : null;
    },
    async put(key, value, ttl) {
      if (kv) { try { await kv.put(key, value, { expirationTtl: Math.max(60, ttl) }); return true; } catch (e) { return false; } }
      memory.set(key, { value, until: Date.now() + ttl * 1000 });
      return true;
    },
  };
}

// the contact details: a name of letters, a phone of 9 to 15 digits (landlines too), an optional e-mail
export function checkFields(input) {
  const c = input || {};
  const name = line(c.name, 60);
  const phone = line(c.phone, 20);
  const digits = phone.replace(/\D/g, '');
  const email = line(c.email, 100);
  const errors = {};
  if ((name.match(/\p{L}/gu) || []).length < 2 || /[<>{}]/.test(name)) errors.name = true;
  if (!/^\+?[0-9\s\-()]{9,20}$/.test(phone) || digits.length < 9 || digits.length > 15) errors.phone = true;
  if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(email)) errors.email = true;
  return { ok: !Object.keys(errors).length, errors, clean: { name, phone, email } };
}

// the message for Formspree and Sheets, built from the fixed list of the form
export function buildFields(formId, body) {
  const form = FORMS[formId];
  const check = checkFields(body.contact);
  if (!check.ok) return { error: 'contact', fields: Object.keys(check.errors) };
  if (body.consent !== true) return { error: 'consent' };
  const goals = (Array.isArray(body.goals) ? body.goals : []).map((g) => line(g, 40)).filter((g, i, a) => form.goals.includes(g) && a.indexOf(g) === i);
  if (form.needGoal && !goals.length) return { error: 'goal' };
  const { name, phone, email } = check.clean;
  const f = {
    _subject: form.subject,
    'שם מלא': name,
    'טלפון': phone,
    'אימייל': email,
    'מקור': form.source,
    'מטרה': goals.join(', '),
    'הסכמה': 'כן',
    'הסכמה לדיוור': body.marketing === true ? 'כן' : 'לא',
  };
  if (formId === 'compass') {
    const time = line(body.time, 20);
    if (time && form.times.includes(time)) f['זמן מועדף'] = time;
    const summary = text(body.summary, 6000);
    if (summary) f['סיכום המצפן'] = summary;
    const id = line(body.sessionId, 64).replace(/[^A-Za-z0-9_\-]/g, '');
    if (id) f['מזהה שאלון'] = id;
    const from = line(body.source, 200).replace(/[^A-Za-z0-9_.\-/= ]/g, '');
    if (from) f['מקור הגעה'] = from;
  }
  if (email) f.email = email; // Formspree uses it as the reply-to address
  return { fields: f, phone };
}

async function sendFormspree(env, f, page) {
  try {
    const r = await fetch(env.CT_FORMSPREE_URL || FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: ORIGINS[0], Referer: ORIGINS[0] + (page || '/') },
      body: JSON.stringify(f),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('contact: formspree status', r.status);
    return r.ok;
  } catch (e) { console.error('contact: formspree unreachable'); return false; }
}
async function sendSheets(env, f) {
  try {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (!k.startsWith('_') && k !== 'email') body.set(k, v);
    await fetch(env.CT_SHEETS_URL || SHEETS, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
  } catch (e) { console.error('contact: sheets unreachable'); }
}

async function flushQueue(env) {
  const kv = env.LEADS;
  if (!kv) return;
  try {
    const { keys } = await kv.list({ prefix: 'ct:q:', limit: 3 });
    for (const { name } of keys) {
      const raw = await kv.get(name);
      if (!raw) continue;
      const { f, page } = JSON.parse(raw);
      if (await sendFormspree(env, f, page)) await kv.delete(name);
    }
  } catch (e) { console.error('contact: queue'); }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (context.waitUntil) context.waitUntil(flushQueue(env));

  const allowed = env.CT_ALLOWED_ORIGINS ? env.CT_ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : ORIGINS;
  if (!allowed.includes(request.headers.get('Origin') || '')) return json(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json(415, { ok: false, error: 'type' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'size' });
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json(400, { ok: false, error: 'json' }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'json' });
  if (body.website) return json(200, { ok: true });
  const formId = Object.hasOwn(FORMS, body.form) ? body.form : null;
  if (!formId) return json(400, { ok: false, error: 'form' });

  const db = store(env);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = 'ct:rl:' + await sha(ip + '|' + new Date().toISOString().slice(0, 13));
  const sent = parseInt((await db.get(rateKey)) || '0', 10);
  if (sent >= RATE_MAX) return json(429, { ok: false, error: 'rate' });

  const built = buildFields(formId, body);
  if (built.error) return json(400, { ok: false, error: built.error, ...(built.fields ? { fields: built.fields } : {}) });
  const f = built.fields;
  const dupKey = 'ct:dd:' + await sha(formId + '|' + built.phone.replace(/\D/g, ''));
  if (await db.get(dupKey)) return json(200, { ok: true, duplicate: true });

  const page = FORMS[formId].page;
  const [delivered] = await Promise.all([sendFormspree(env, f, page), sendSheets(env, f)]);
  await db.put(rateKey, String(sent + 1), HOUR);
  if (delivered) {
    await db.put(dupKey, '1', HOUR);
    return json(200, { ok: true });
  }
  if (db.kv && await db.put('ct:q:' + Date.now() + ':' + await sha(built.phone + Math.random()), JSON.stringify({ f, page }), QUEUE_DAYS * 86400)) {
    await db.put(dupKey, '1', HOUR);
    return json(202, { ok: true, queued: true });
  }
  return json(502, { ok: false, error: 'delivery' });
}
