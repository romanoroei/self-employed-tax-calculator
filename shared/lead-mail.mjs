// The lead e-mail to Roei, for every form on the site: the home page contact form and the compass
// (functions/api/contact.js) and the questionnaires /check and /financial-check (functions/api/lead.js).
// It looks like the client questionnaire e-mail (functions/api/questionnaire.js): right to left, the site's navy
// and gold, a header with the name, the phone and the e-mail, and the details in a two-column table.
//
// Delivery is the same as the client questionnaire: the service binding MAILER, a small Worker
// (workers/questionnaire-mailer.js) that sends with Cloudflare Email Routing to Roei's verified address.
// Formspree stays only as a fallback when MAILER is missing or fails, so a lead is never lost to an outage.
// This file is not published (the build publishes an explicit list); the functions import it.

const FORMSPREE = 'https://formspree.io/f/mvzjeykj';
const ORIGIN = 'https://romanoinvest.co.il';
const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,24}$/;

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const oneLine = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// A plain-text lead message (blocks split by a blank line, the first line of a block its title, then
// "label: value" lines, or numbered questions "1. question" with the answer on the next, indented line)
// turned into sections of rows for the table.
export function textToSections(text) {
  const sections = [];
  for (const block of String(text || '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const first = lines[0].trim();
    const titled = !/^\d+\.\s/.test(first) && !/^[^:]{1,60}:\s/.test(first);
    const title = titled ? first : '';
    const rows = [];
    for (let i = titled ? 1 : 0; i < lines.length; i++) {
      const l = lines[i];
      const numbered = l.match(/^(\d+)\.\s+(.*)$/);
      if (numbered && lines[i + 1] && /^\s{2,}\S/.test(lines[i + 1])) { rows.push({ q: numbered[2].trim(), a: lines[i + 1].trim() }); i++; continue; }
      const kv = l.match(/^\s*-?\s*([^:]{1,80}):\s+(.*)$/);
      if (kv) { rows.push({ q: kv[1].trim(), a: kv[2].trim() }); continue; }
      rows.push({ q: '', a: l.replace(/^\s*-\s*/, '').trim() });
    }
    if (rows.length) sections.push({ title, rows });
  }
  return sections;
}

// kicker: the small gold line (where the lead came from); sections: [{ title, rows: [{ q, a }] }]
export function renderLead({ subject, kicker, name, phone, email, sections, now = new Date() }) {
  const date = now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const mail = EMAIL.test(email || '') ? email : '';
  const tel = String(phone || '').replace(/[^\d+]/g, '');

  let text = `${subject}\n${kicker}\n${date}\nשם: ${name}\nטלפון: ${phone}${mail ? `\nמייל: ${mail}` : ''}\n`;
  for (const s of sections) {
    text += `\n━━━━━━━━━━━━━━━\n${s.title ? s.title + '\n\n' : ''}`;
    for (const r of s.rows) text += r.q ? `${r.q}: ${r.a}\n` : `${r.a}\n`;
  }

  const F = "font-family:Arial,'Segoe UI',Helvetica,sans-serif;";
  const cell = `${F}direction:rtl;text-align:right;`;
  let rowsHtml = '';
  for (const s of sections) {
    if (s.title) rowsHtml += `<tr><td colspan="2" dir="rtl" align="right" style="${cell}padding:22px 0 8px;font-size:17px;font-weight:bold;color:#0C2134;border-bottom:2px solid #C9B772;">${esc(s.title)}</td></tr>`;
    for (const r of s.rows) {
      const answer = esc(r.a).replace(/\n/g, '<br>');
      rowsHtml += r.q
        ? `<tr>`
          + `<td dir="rtl" align="right" valign="top" width="42%" style="${cell}padding:9px 0 9px 14px;font-size:14px;color:#46586A;border-bottom:1px solid #E4E5E2;">${esc(r.q)}</td>`
          + `<td dir="rtl" align="right" valign="top" style="${cell}padding:9px 0;font-size:15px;color:#0C2134;border-bottom:1px solid #E4E5E2;">${answer}</td>`
          + `</tr>`
        : `<tr><td colspan="2" dir="rtl" align="right" valign="top" style="${cell}padding:9px 0;font-size:15px;color:#0C2134;border-bottom:1px solid #E4E5E2;">${answer}</td></tr>`;
    }
  }
  const contactLine = [
    tel ? `<a href="tel:${esc(tel)}" style="color:#C9B772;text-decoration:none;font-weight:bold;" dir="ltr">${esc(phone)}</a>` : '',
    mail ? `<a href="mailto:${esc(mail)}" style="color:#C9B772;">${esc(mail)}</a>` : 'לא נמסרה כתובת מייל',
  ].filter(Boolean).join(' · ');
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>`
    + `<body dir="rtl" style="margin:0;padding:0;background:#F1F1EE;">`
    + `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F1EE;"><tr><td dir="rtl" align="center" style="padding:16px 8px;">`
    + `<table role="presentation" dir="rtl" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">`
    + `<tr><td dir="rtl" align="right" style="${cell}background:#0C2134;padding:24px 26px;">`
    + `<div style="${cell}font-size:13px;color:#C9B772;font-weight:bold;">${esc(kicker)}</div>`
    + `<div style="${cell}font-size:24px;color:#F1F1EE;font-weight:bold;padding-top:4px;">${esc(name)}</div>`
    + `<div style="${cell}font-size:15px;color:#C1CEDB;padding-top:6px;">${contactLine}</div>`
    + `<div style="${cell}font-size:13px;color:#C1CEDB;padding-top:4px;">${esc(date)}</div>`
    + `</td></tr>`
    + `<tr><td dir="rtl" align="right" style="${cell}background:#FFFFFF;padding:4px 26px 24px;">`
    + `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>`
    + `</td></tr>`
    + `<tr><td dir="rtl" align="right" style="${cell}padding:12px 4px;font-size:12px;color:#46586A;">נשלח אוטומטית מהאתר romanoinvest.co.il${mail ? '. לחיצה על "השב" תענה לפונה.' : '.'}</td></tr>`
    + `</table></td></tr></table></body></html>`;
  return { subject: oneLine(subject, 200), text, html, replyTo: mail, replyName: oneLine(name, 80) };
}

async function viaMailer(env, msg) {
  if (!env.MAILER) return false;
  try {
    const r = await env.MAILER.fetch('https://questionnaire-mailer/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: msg.subject, text: msg.text, html: msg.html, replyTo: msg.replyTo || '', replyName: msg.replyName || '' }),
    });
    if (!r.ok) console.error('lead-mail: mailer status', r.status);
    return r.ok;
  } catch (e) { console.error('lead-mail: mailer unreachable'); return false; }
}
async function viaFormspree(env, msg, page) {
  const f = { _subject: msg.subject, 'פירוט מלא': msg.text };
  if (msg.replyTo) f.email = msg.replyTo;
  try {
    const r = await fetch(env.LEAD_FORMSPREE_URL || FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: ORIGIN, Referer: ORIGIN + (page || '/') },
      body: JSON.stringify(f),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('lead-mail: formspree status', r.status);
    return r.ok;
  } catch (e) { console.error('lead-mail: formspree unreachable'); return false; }
}

// the designed e-mail through MAILER; Formspree (plain text) only when that fails. Returns 'mailer', 'formspree' or ''.
export async function deliver(env, msg, page) {
  if (await viaMailer(env, msg)) return 'mailer';
  if (await viaFormspree(env, msg, page)) return 'formspree';
  return '';
}
