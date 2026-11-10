// Cloudflare Pages Function: Israel's latest consumer price index, for the home page events tab.
// From the Central Bureau of Statistics' public API. The visitor's browser only ever talks to this site,
// and nothing about the visitor is passed on or stored.
// The index comes out once a month (the 15th, in the evening), so an answer is held for three hours.

const SECONDS = 10800;
const SHORT = 300;
const KEEP = 30 * 86400;
const URL_CPI = 'https://api.cbs.gov.il/index/data/price?id=120010&format=json&download=false&last=2';

async function latest() {
  const response = await fetch(URL_CPI, { headers: { 'User-Agent': 'romanoinvest.co.il cpi', Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} from cbs`);
  const data = await response.json();
  const rows = data?.month?.[0]?.date;
  if (!Array.isArray(rows) || !rows.length) throw new Error('No CPI');
  const sorted = [...rows].sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
  const [last, before] = sorted;
  if (!Number.isFinite(last.percent) || !Number.isFinite(last.percentYear)) throw new Error('No CPI figures');
  // the month the index measures, its change in that month, over the twelve months up to it,
  // and the month before's change, to compare with
  return { year: last.year, month: last.month, percent: last.percent, percentYear: last.percentYear, previous: Number.isFinite(before?.percent) ? before.percent : null };
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = globalThis.caches?.default;
  const origin = new URL(request.url).origin;
  // v2: with the month before's change
  const key = new Request(`${origin}/api/cpi?v=2`);
  const held = cache && await cache.match(key);
  if (held) return held;
  // the last good answer is kept for a month, in case the bureau's API fails for a while
  const good = new Request(`${origin}/api/last-good/cpi`);
  let body;
  let fresh = true;
  try {
    body = { updated: Math.floor(Date.now() / 1000), ...(await latest()) };
    if (cache) waitUntil(cache.put(good, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${KEEP}` } })));
  } catch (error) {
    console.error('cpi', error.message);
    const kept = cache && await cache.match(good);
    if (!kept) return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    body = await kept.json();
    fresh = false;
  }
  const response = new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${fresh ? SECONDS : SHORT}` },
  });
  if (cache) waitUntil(cache.put(key, response.clone()));
  return response;
}
