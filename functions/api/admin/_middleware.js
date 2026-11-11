// Guards every /api/admin/* request: closed until Cloudflare Access is configured (ACCESS_TEAM_DOMAIN, ACCESS_AUD),
// then only requests carrying a valid Access token, optionally only for the addresses in ADMIN_EMAILS.
// Writes must come from this site (no cross-site requests), and nothing is cached.
import { json, verifyAccess } from './_lib.js';

export async function onRequest({ request, env, data, next }) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json({ error: 'not-configured', message: 'אזור הניהול עדיין לא חובר ל־Cloudflare Access' }, 503);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return json({ error: 'unauthorized' }, 401);
  let claims;
  try { claims = await verifyAccess(token, env); } catch { return json({ error: 'unauthorized' }, 401); }
  const allowed = String(env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(claims.email || '').toLowerCase())) return json({ error: 'forbidden' }, 403);
  if (request.method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (!origin || new URL(origin).host !== new URL(request.url).host) return json({ error: 'forbidden-origin' }, 403);
  }
  data.email = claims.email || '';
  return next();
}
