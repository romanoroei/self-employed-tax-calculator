// Worker "questionnaire-mailer": sends the client questionnaire e-mail to Roei through Cloudflare Email Routing.
// It is called only by the site's Pages Function (functions/api/questionnaire.js) through the service binding
// MAILER, which builds and escapes the message; this Worker only wraps it in MIME and sends it.
//
// Dashboard setup (no wrangler in this project):
//   - Email Routing on romanoinvest.co.il, with roeir@ar-fo.co.il as a verified destination address.
//   - This Worker: binding "Send email" named EMAIL (destination roeir@ar-fo.co.il); the workers.dev and preview
//     URLs turned off, so nothing but the service binding can reach it.
//   - The Pages project: service binding MAILER -> this Worker, then a redeploy.
// The source of truth is this file; paste it into the dashboard editor after a change.
import { EmailMessage } from 'cloudflare:email';

const FROM = 'questionnaire@romanoinvest.co.il';
const FROM_NAME = 'שאלון לקוח - romanoinvest.co.il';
const TO = 'roeir@ar-fo.co.il';
const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,24}$/;

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const word = (s) => `=?UTF-8?B?${b64(s)}?=`;
const clean = (s, max) => String(s || '').replace(/[\r\n\u0000-\u001f]+/g, ' ').slice(0, max);

export function mime({ subject, text, html, replyTo, replyName }, now = new Date()) {
  const boundary = 'qn-' + crypto.randomUUID();
  const id = `<${crypto.randomUUID()}@romanoinvest.co.il>`;
  const headers = [
    `From: ${word(FROM_NAME)} <${FROM}>`,
    `To: <${TO}>`,
    EMAIL.test(replyTo || '') ? `Reply-To: ${word(clean(replyName, 80) || replyTo)} <${replyTo}>` : null,
    `Subject: ${word(clean(subject, 200))}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  return headers.join('\r\n') + '\r\n\r\n'
    + `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(text))}`
    + `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(html))}`
    + `--${boundary}--\r\n`;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('method', { status: 405 });
    let body;
    try { body = await request.json(); } catch (e) { return new Response('json', { status: 400 }); }
    if (!body || typeof body.subject !== 'string' || typeof body.text !== 'string' || typeof body.html !== 'string') return new Response('fields', { status: 400 });
    if (body.html.length > 200000 || body.text.length > 100000) return new Response('size', { status: 413 });
    try {
      await env.EMAIL.send(new EmailMessage(FROM, TO, mime(body)));
      return new Response('ok');
    } catch (e) {
      console.error('mailer: send failed', e && e.message);
      return new Response('send', { status: 502 });
    }
  },
};
