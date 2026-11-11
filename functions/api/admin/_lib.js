// Shared helpers for the market reviews admin API. No request handlers here, so this file is not a route.
// Secrets (GITHUB_TOKEN, later an AI key) live only in Cloudflare's environment and never reach the browser.

export const REPO = 'romanoroei/self-employed-tax-calculator';
export const BRANCH = 'main';
export const CONTENT_DIR = 'business-site/content/market-reviews';
export const DRAFT_PREFIX = 'review-draft:';
export const MAX_BODY = 300_000;

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// Drafts live in their own KV namespace (REVIEWS); until one is bound, the counters' namespace with a prefix.
export const store = (env) => env.REVIEWS || env.STATS || null;

// Israel's calendar date, so a review published at night carries the right day.
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
export const utf8ToB64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
export const b64ToUtf8 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

// Cloudflare Access puts a signed token on every request it lets through. We check the signature against
// the team's public keys, the audience of this application, the issuer and the expiry.
let certs = { at: 0, keys: [] };
export async function verifyAccess(token, env) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  if (header.alg !== 'RS256') throw new Error('alg');
  const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (Date.now() - certs.at > 3600_000 || !certs.keys.some(k => k.kid === header.kid)) {
    const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error('certs');
    certs = { at: Date.now(), keys: (await res.json()).keys || [] };
  }
  const jwk = certs.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('signature');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error('aud');
  if (claims.iss !== `https://${team}`) throw new Error('iss');
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('expired');
  return claims;
}

async function github(env, method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO || REPO}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'romanoinvest-site-admin', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// The published review files on main (names only).
export async function listPublished(env) {
  if (!env.GITHUB_TOKEN) return [];
  const res = await github(env, 'GET', `contents/${CONTENT_DIR}?ref=${BRANCH}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('github list ' + res.status);
  return (await res.json()).filter(f => /^20\d\d-\d\d\.json$/.test(f.name)).map(f => f.name.slice(0, 7));
}

export async function readPublished(env, id) {
  if (!env.GITHUB_TOKEN) return null;
  const res = await github(env, 'GET', `contents/${CONTENT_DIR}/${id}.json?ref=${BRANCH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('github read ' + res.status);
  const file = await res.json();
  return { sha: file.sha, review: JSON.parse(b64ToUtf8(file.content)) };
}

// One commit on main with the review file; Cloudflare Pages then builds and deploys the site.
export async function writePublished(env, id, review, message) {
  const current = await readPublished(env, id);
  const res = await github(env, 'PUT', `contents/${CONTENT_DIR}/${id}.json`, {
    message, branch: BRANCH, content: utf8ToB64(JSON.stringify(review, null, 2) + '\n'), ...(current ? { sha: current.sha } : {}),
  });
  if (!res.ok) throw new Error('github write ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const out = await res.json();
  return out.commit?.sha || '';
}

export async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}
