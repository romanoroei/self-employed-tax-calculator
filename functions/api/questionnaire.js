// Cloudflare Pages Function: the client questionnaire (/questionnaire/) sends its answers here when the client
// reaches the end, so Roei gets them even when the client closes the page without pressing WhatsApp or e-mail.
//
// Delivery: Formspree e-mails Roei (the address is set in Formspree, never in this code), the same form the site's
// lead forms use, with the client's e-mail as the reply-to. Nothing is stored here: there is no retry queue, so
// when Formspree fails the function answers with an error and the page asks the client to send by WhatsApp or
// e-mail instead. The only things kept (KV binding LEADS, when bound) are hashes for the rate and duplicate checks.
// Nothing personal is logged.

const FORMSPREE = 'https://formspree.io/f/mvzjeykj';
const ORIGINS = ['https://romanoinvest.co.il', 'https://www.romanoinvest.co.il'];
const MAX_BODY = 24000;
const MAX_TEXT = 16000;
const RATE_MAX = 6; // sends per address per hour (a first send plus a few edits)
const HOUR = 3600;

const memory = new Map(); // fallback for the checks when there is no LEADS binding (per worker instance)
export function _resetMemory() { memory.clear(); }

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

async function sha(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function store(env) {
  const kv = env.LEADS;
  return {
    async get(key) {
      if (kv) { try { return await kv.get(key); } catch (e) { return null; } }
      const hit = memory.get(key);
      return hit && hit.until > Date.now() ? hit.value : null;
    },
    async put(key, value, ttl) {
      if (kv) { try { await kv.put(key, value, { expirationTtl: Math.max(60, ttl) }); } catch (e) { /* never blocks a send */ } return; }
      memory.set(key, { value, until: Date.now() + ttl * 1000 });
    },
  };
}

const oneLine = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,24}$/;

export function cleanBody(body) {
  if (!body || typeof body !== 'object') return null;
  const sessionId = oneLine(body.sessionId, 64);
  if (!/^[a-z0-9-]{8,64}$/i.test(sessionId)) return null;
  const name = oneLine(body.name, 80);
  if (name.length < 2) return null;
  const emailRaw = oneLine(body.email, 254);
  const email = EMAIL.test(emailRaw) ? emailRaw : '';
  if (typeof body.text !== 'string') return null;
  const text = body.text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, '').trim();
  if (text.length < 20 || text.length > MAX_TEXT) return null;
  return { sessionId, name, email, text, update: body.update === true };
}

async function sendFormspree(env, f) {
  try {
    const r = await fetch(env.QN_FORMSPREE_URL || FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: ORIGINS[0], Referer: ORIGINS[0] + '/questionnaire/' },
      body: JSON.stringify(f),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('questionnaire: formspree status', r.status);
    return r.ok;
  } catch (e) { console.error('questionnaire: formspree unreachable'); return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const allowed = env.QN_ALLOWED_ORIGINS ? env.QN_ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : ORIGINS;
  if (!allowed.includes(request.headers.get('Origin') || '')) return json(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json(415, { ok: false, error: 'type' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'size' });
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json(400, { ok: false, error: 'json' }); }
  if (body && body.website) return json(200, { ok: true }); // a field people never see: bots get a quiet "ok"
  const clean = cleanBody(body);
  if (!clean) return json(400, { ok: false, error: 'fields' });

  const db = store(env);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = 'qn:rl:' + await sha(ip + '|' + new Date().toISOString().slice(0, 13));
  const sent = parseInt((await db.get(rateKey)) || '0', 10);
  if (sent >= RATE_MAX) return json(429, { ok: false, error: 'rate' });
  // the same answers twice (a reload, a double click) are sent once
  const dupKey = 'qn:dd:' + await sha(clean.sessionId + '|' + clean.text);
  if (await db.get(dupKey)) return json(200, { ok: true, duplicate: true });

  const today = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const f = {
    _subject: `${clean.update ? 'שאלון (עדכון)' : 'שאלון'} - ${clean.name}`,
    'שם מלא': clean.name,
    'אימייל': clean.email,
    'מקור': clean.update ? 'שאלון לקוח - תשובות מעודכנות' : 'שאלון לקוח',
    'תאריך': today,
    'פירוט מלא': clean.text,
  };
  if (clean.email) f.email = clean.email; // Formspree uses it as the reply-to address

  const delivered = await sendFormspree(env, f);
  await db.put(rateKey, String(sent + 1), HOUR);
  if (!delivered) return json(502, { ok: false, error: 'delivery' });
  await db.put(dupKey, '1', 24 * HOUR);
  return json(200, { ok: true });
}
