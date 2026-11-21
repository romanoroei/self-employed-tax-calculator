// Cloudflare Pages Function: the lead form of /financial-check.
// The browser sends the answer ids, the contact details, the consent and the campaign source. This function
// checks all of it again: it replays the answers with the same engine the page uses, works out the track and
// the grade itself, and builds the message for Roei from its own question texts, so nothing the browser
// claims (a grade, a question, a label) is taken on trust.
//
// Delivery: the designed right-to-left e-mail of shared/lead-mail.mjs, through the MAILER Worker (Cloudflare Email
// Routing), like the client questionnaire; Formspree only when that fails. A copy goes to the Google Sheets
// script. If the e-mail fails, the message waits in the KV namespace bound as LEADS (14 days at most) and each
// later request tries to send it again, so a lead is not lost to a short outage. LEADS also holds the duplicate and rate checks, as hashes only.
// Nothing personal is logged. Without the LEADS binding the function still delivers, keeping its checks in
// memory, and answers with an error when Formspree fails, so the visitor sees the phone number instead.
import { renderLead, textToSections, deliver } from '../../shared/lead-mail.mjs';
import { fromAnswers, result, leadMessage, checkContact, cleanSource, CONSENT } from '../../business-site/js/fcheck/engine.mjs';

const FORMSPREE = 'https://formspree.io/f/mvzjeykj';
const SHEETS = 'https://script.google.com/macros/s/AKfycbwt-mMdDo6fA___Mh57M8085t2bFPiiVpoKhq3j22hNyhqUybEKMp2t9X5RFm6PwlXa3g/exec';
const ORIGINS = ['https://romanoinvest.co.il', 'https://www.romanoinvest.co.il'];
const MAX_BODY = 16384;
const RATE_MAX = 5; // sent forms per address per hour
const HOUR = 3600;
const QUEUE_DAYS = 14;

const memory = new Map(); // fallback for the checks when there is no LEADS binding (per worker instance)
export function _resetMemory() { memory.clear(); }

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

async function sha(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// a tiny store: KV when bound, memory otherwise. A KV failure (a quota, an outage) never blocks a lead.
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

function fields(msg, contact, source) {
  const res = msg.result;
  const from = [source.ref && `ref=${source.ref}`, source.utm_source && `utm_source=${source.utm_source}`, source.utm_medium && `utm_medium=${source.utm_medium}`, source.utm_campaign && `utm_campaign=${source.utm_campaign}`].filter(Boolean).join(' / ');
  const f = {
    _subject: msg.subject,
    'שם מלא': contact.name,
    'טלפון': contact.phone,
    'אימייל': contact.email || '',
    'מקור': 'בדיקת התאמה פיננסית',
    'מטרה': res.title,
    'דירוג': `${res.grade} (${res.score} נקודות)`,
    'מקור הגעה': from || 'ישיר',
    'פירוט מלא': msg.text,
  };
  if (contact.email) f.email = contact.email; // Formspree uses it as the reply-to address
  return f;
}

// the designed e-mail, built from the same plain-text message the engine writes
export function buildMail(msg, contact, now) {
  return renderLead({
    subject: msg.subject,
    kicker: 'ליד מהשאלון באתר · ' + msg.result.title,
    name: contact.name, phone: contact.phone, email: contact.email,
    // the name, phone and e-mail are already in the header
    sections: textToSections(msg.text).filter((sec) => sec.title !== 'פרטי הפונה'), now,
  });
}

async function sendSheets(env, f) {
  try {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (!k.startsWith('_') && k !== 'email') body.set(k, v);
    await fetch(env.FC_SHEETS_URL || SHEETS, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
  } catch (e) { console.error('fcheck: sheets unreachable'); }
}

// messages that waited after a failed delivery: up to three are retried on each request
async function flushQueue(env) {
  const kv = env.LEADS;
  if (!kv) return;
  try {
    const { keys } = await kv.list({ prefix: 'fc:q:', limit: 3 });
    for (const { name } of keys) {
      const raw = await kv.get(name);
      if (!raw) continue;
      const q = JSON.parse(raw);
      // a message queued before the designed e-mail holds the Formspree fields; it goes out as plain text
      const mail = q.mail || { subject: q._subject || 'ליד מהשאלון באתר', text: q['פירוט מלא'] || '', html: '', replyTo: q.email || '' };
      if (await deliver(env, mail.html ? mail : { ...mail, html: '<pre dir="rtl">' + mail.text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</pre>' }, '/financial-check')) await kv.delete(name);
    }
  } catch (e) { console.error('fcheck: queue'); }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (context.waitUntil) context.waitUntil(flushQueue(env));

  // only our own pages may post here (the form sends JSON, which a plain cross-site form cannot)
  const allowed = env.FC_ALLOWED_ORIGINS ? env.FC_ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : ORIGINS;
  if (!allowed.includes(request.headers.get('Origin') || '')) return json(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json(415, { ok: false, error: 'type' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'size' });
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json(400, { ok: false, error: 'json' }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'json' });

  // a field people never see: anything in it is a bot, which gets a quiet "ok" and nothing is sent
  if (body.website) return json(200, { ok: true });

  const db = store(env);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = 'fc:rl:' + await sha(ip + '|' + new Date().toISOString().slice(0, 13));
  const sent = parseInt((await db.get(rateKey)) || '0', 10);
  if (sent >= RATE_MAX) return json(429, { ok: false, error: 'rate' });

  const state = fromAnswers(body.sessionId, body.answers, { flow: body.flow === 'site' ? 'site' : undefined });
  if (!state || !result(state)) return json(400, { ok: false, error: 'answers' });
  const check = checkContact(body.contact);
  if (!check.ok) return json(400, { ok: false, error: 'contact', fields: Object.keys(check.errors) });
  const consent = body.consent || {};
  if (consent.contact !== true || consent.version !== CONSENT.version) return json(400, { ok: false, error: 'consent' });

  const contact = check.clean;
  const dupKey = 'fc:dd:' + await sha(state.sessionId + '|' + contact.phone);
  if (await db.get(dupKey)) return json(200, { ok: true, duplicate: true });

  const source = cleanSource(body.source);
  const msg = leadMessage(state, contact, source, { contact: true, marketing: consent.marketing === true });
  const f = fields(msg, contact, source);
  const mail = buildMail(msg, contact);
  const [via] = await Promise.all([deliver(env, mail, state.flow === 'site' ? '/check' : '/financial-check'), sendSheets(env, f)]);
  const delivered = !!via;
  await db.put(rateKey, String(sent + 1), HOUR);
  if (delivered) {
    await db.put(dupKey, '1', HOUR);
    return json(200, { ok: true, via });
  }
  if (db.kv && await db.put('fc:q:' + state.sessionId, JSON.stringify({ mail }), QUEUE_DAYS * 86400)) {
    await db.put(dupKey, '1', HOUR);
    return json(202, { ok: true, queued: true });
  }
  return json(502, { ok: false, error: 'delivery' });
}
