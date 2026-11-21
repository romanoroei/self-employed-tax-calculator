// Cloudflare Pages Function: the client questionnaire (/questionnaire/) sends its answers here when the client
// reaches the end, so Roei gets them even when the client closes the page without pressing WhatsApp or e-mail.
//
// The page sends the answers as sections of question/answer rows. This function checks them, escapes them and
// builds the e-mail itself: a right-to-left HTML message (sections, the answers to look at marked in red) plus a
// plain-text copy.
//
// Delivery: through the service binding MAILER, a small Worker (workers/questionnaire-mailer.js) that sends with
// Cloudflare Email Routing to Roei's verified address. Until that binding exists, the message goes to the site's
// Formspree form instead (the address is set in Formspree, never in this code). Nothing is stored: there is no
// retry queue, so when delivery fails the function answers with an error and the page asks the client to send by
// WhatsApp or e-mail. The only things kept (KV binding LEADS, when bound) are hashes for the rate and duplicate
// checks. Nothing personal is logged.

const FORMSPREE = 'https://formspree.io/f/mvzjeykj';
const ORIGINS = ['https://romanoinvest.co.il', 'https://www.romanoinvest.co.il'];
const MAX_BODY = 40000;
const MAX_SECTIONS = 12;
const MAX_ROWS = 80;
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

const oneLine = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,24}$/;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function cleanBody(body) {
  if (!body || typeof body !== 'object') return null;
  const sessionId = oneLine(body.sessionId, 64);
  if (!/^[a-z0-9-]{8,64}$/i.test(sessionId)) return null;
  const name = oneLine(body.name, 80);
  if (name.length < 2) return null;
  const emailRaw = oneLine(body.email, 254);
  const email = EMAIL.test(emailRaw) ? emailRaw : '';
  if (!Array.isArray(body.sections) || !body.sections.length || body.sections.length > MAX_SECTIONS) return null;
  let count = 0;
  const sections = [];
  for (const s of body.sections) {
    if (!s || !Array.isArray(s.rows)) return null;
    const rows = [];
    for (const r of s.rows) {
      if (!r || typeof r !== 'object') return null;
      const q = oneLine(r.q, 300);
      const a = oneLine(r.a, 1500);
      if (!q || !a) continue;
      rows.push({ q, a, red: r.red === true });
    }
    count += rows.length;
    if (rows.length) sections.push({ title: oneLine(s.title, 120), rows });
  }
  if (!count || count > MAX_ROWS) return null;
  return { sessionId, name, email, sections, update: body.update === true };
}

export function buildMessage(clean, now = new Date()) {
  const date = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const subject = `${clean.update ? 'שאלון (עדכון)' : 'שאלון'} - ${clean.name}`;
  const reds = clean.sections.reduce((n, s) => n + s.rows.filter((r) => r.red).length, 0);

  let text = `${subject}\n${date}${clean.email ? `\nמייל: ${clean.email}` : ''}\n`;
  for (const s of clean.sections) {
    text += `\n━━━━━━━━━━━━━━━\n${s.title ? s.title + '\n\n' : ''}`;
    for (const r of s.rows) text += `${r.q}: ${r.red ? '🔴 ' : ''}${r.a}\n`;
  }

  const F = "font-family:Arial,'Segoe UI',Helvetica,sans-serif;";
  const cell = `${F}direction:rtl;text-align:right;`;
  let rowsHtml = '';
  for (const s of clean.sections) {
    if (s.title) rowsHtml += `<tr><td colspan="2" dir="rtl" align="right" style="${cell}padding:22px 0 8px;font-size:17px;font-weight:bold;color:#0C2134;border-bottom:2px solid #C9B772;">${esc(s.title)}</td></tr>`;
    for (const r of s.rows) {
      const answer = r.red
        ? `<span style="color:#B42318;font-weight:bold;">🔴 ${esc(r.a)}</span>`
        : esc(r.a);
      rowsHtml += `<tr>`
        + `<td dir="rtl" align="right" valign="top" width="45%" style="${cell}padding:9px 0 9px 14px;font-size:14px;color:#46586A;border-bottom:1px solid #E4E5E2;">${esc(r.q)}</td>`
        + `<td dir="rtl" align="right" valign="top" style="${cell}padding:9px 0;font-size:15px;color:#0C2134;border-bottom:1px solid #E4E5E2;">${answer}</td>`
        + `</tr>`;
    }
  }
  const replyLine = clean.email
    ? `<a href="mailto:${esc(clean.email)}" style="color:#C9B772;">${esc(clean.email)}</a>`
    : 'לא נמסרה כתובת מייל';
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>`
    + `<body dir="rtl" style="margin:0;padding:0;background:#F1F1EE;">`
    + `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F1EE;"><tr><td dir="rtl" align="center" style="padding:16px 8px;">`
    + `<table role="presentation" dir="rtl" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">`
    + `<tr><td dir="rtl" align="right" style="${cell}background:#0C2134;padding:24px 26px;">`
    + `<div style="${cell}font-size:13px;color:#C9B772;font-weight:bold;">${clean.update ? 'שאלון לקוח · תשובות מעודכנות' : 'שאלון לקוח'}</div>`
    + `<div style="${cell}font-size:24px;color:#F1F1EE;font-weight:bold;padding-top:4px;">${esc(clean.name)}</div>`
    + `<div style="${cell}font-size:14px;color:#C1CEDB;padding-top:6px;">${esc(date)} · ${replyLine}</div>`
    + (reds ? `<div style="${cell}font-size:14px;color:#F1F1EE;padding-top:10px;">🔴 ${reds} ${reds === 1 ? 'תשובה מסומנת' : 'תשובות מסומנות'} לבדיקה</div>` : '')
    + `</td></tr>`
    + `<tr><td dir="rtl" align="right" style="${cell}background:#FFFFFF;padding:4px 26px 24px;">`
    + `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>`
    + `</td></tr>`
    + `<tr><td dir="rtl" align="right" style="${cell}padding:12px 4px;font-size:12px;color:#46586A;">נשלח אוטומטית מהשאלון באתר romanoinvest.co.il${clean.email ? '. לחיצה על "השב" תענה ללקוח.' : '.'}</td></tr>`
    + `</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

async function sendMailer(env, clean, msg) {
  try {
    const r = await env.MAILER.fetch('https://questionnaire-mailer/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: msg.subject, text: msg.text, html: msg.html, replyTo: clean.email || '', replyName: clean.name }),
    });
    if (!r.ok) console.error('questionnaire: mailer status', r.status);
    return r.ok;
  } catch (e) { console.error('questionnaire: mailer unreachable'); return false; }
}

async function sendFormspree(env, clean, msg) {
  const f = {
    _subject: msg.subject,
    'שם מלא': clean.name,
    'אימייל': clean.email,
    'מקור': clean.update ? 'שאלון לקוח - תשובות מעודכנות' : 'שאלון לקוח',
    'פירוט מלא': msg.text,
  };
  if (clean.email) f.email = clean.email; // Formspree uses it as the reply-to address
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
  const dupKey = 'qn:dd:' + await sha(clean.sessionId + '|' + JSON.stringify(clean.sections));
  if (await db.get(dupKey)) return json(200, { ok: true, duplicate: true });

  const msg = buildMessage(clean);
  const delivered = env.MAILER ? await sendMailer(env, clean, msg) : await sendFormspree(env, clean, msg);
  await db.put(rateKey, String(sent + 1), HOUR);
  if (!delivered) return json(502, { ok: false, error: 'delivery' });
  await db.put(dupKey, '1', 24 * HOUR);
  return json(200, { ok: true, via: env.MAILER ? 'mailer' : 'formspree' });
}
