// Cloudflare Pages Function: exchange rates for the home page tile, from official daily publications.
// Shekel pairs are the Bank of Israel representative rates; the others are worked out from the ECB reference rates.
//   /api/fx              the latest rate of each pair and the one before it
//   /api/fx?id=usdils    ten years of one pair, for the chart
// The visitor's browser only ever talks to this site. Complete answers are held at the edge for an hour.

const SECONDS = 3600;
const YEARS = 10;
const HEADERS = { 'User-Agent': 'romanoinvest.co.il rates', Accept: '*/*' };
const BOI = 'https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0';
const ECB = 'https://data-api.ecb.europa.eu/service/data/EXR';

// How each pair is read: a Bank of Israel series, or ECB rates per euro (a / b).
const PAIRS = {
  usdils: { boi: 'RER_USD_ILS' },
  eurils: { boi: 'RER_EUR_ILS' },
  gbpils: { boi: 'RER_GBP_ILS' },
  eurusd: { ecb: ['USD'] },
  gbpusd: { ecb: ['USD', 'GBP'] },
  usdjpy: { ecb: ['JPY', 'USD'] },
  usdchf: { ecb: ['CHF', 'USD'] },
};

async function text(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`);
  return response.text();
}

// Rows of [series, date, value] from an SDMX CSV, whatever the column order.
function csv(body, seriesColumn) {
  const [head, ...lines] = body.trim().split(/\r?\n/);
  const names = head.split(',');
  const series = names.indexOf(seriesColumn);
  const date = names.indexOf('TIME_PERIOD');
  const value = names.indexOf('OBS_VALUE');
  if (series < 0 || date < 0 || value < 0) throw new Error('Unexpected CSV');
  return lines.map((line) => line.split(',')).map((c) => [c[series], c[date], parseFloat(c[value])]).filter((r) => Number.isFinite(r[2]));
}

const since = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

async function boiSeries(codes, start) {
  const rows = csv(await text(`${BOI}/${codes.join('+')}?startperiod=${start}&format=csv`), 'SERIES_CODE');
  const bySeries = Object.fromEntries(codes.map((c) => [c, []]));
  for (const [code, date, value] of rows) bySeries[code]?.push([date, value]);
  return bySeries;
}

async function ecbSeries(currencies, start) {
  const rows = csv(await text(`${ECB}/D.${currencies.join('+')}.EUR.SP00.A?startPeriod=${start}&format=csvdata`), 'CURRENCY');
  const byCurrency = Object.fromEntries(currencies.map((c) => [c, new Map()]));
  for (const [currency, date, value] of rows) byCurrency[currency]?.set(date, value);
  return byCurrency;
}

// ECB pairs: per-euro rates divided on the days both exist.
function cross(byCurrency, [a, b]) {
  const top = byCurrency[a];
  if (!b) return [...top.entries()];
  const bottom = byCurrency[b];
  return [...top.entries()].filter(([date]) => bottom.has(date)).map(([date, v]) => [date, v / bottom.get(date)]);
}

const sorted = (points) => points.sort((x, y) => x[0].localeCompare(y[0]));

// Each source's last good answer is kept for a month. A source that fails for a moment then shows
// its last figures instead of leaving its rows out, and the combined answer is held only briefly,
// so the next visitor tries that source again.
const KEEP = 30 * 86400;
const SHORT = 300;
async function lastGood(origin, name, fetcher, waitUntil) {
  const cache = globalThis.caches?.default;
  const key = new Request(`${origin}/api/last-good/${name}`);
  try {
    const value = await fetcher();
    if (cache) waitUntil(cache.put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${KEEP}` } })));
    return { value, fresh: true };
  } catch (error) {
    console.error(name, error.message);
    const held = cache && await cache.match(key);
    if (held) return { value: await held.json(), fresh: false };
    throw error;
  }
}

// ECB rates per currency travel as plain lists, so they can be kept; maps are rebuilt for cross().
const plain = (byCurrency) => Object.fromEntries(Object.entries(byCurrency).map(([c, m]) => [c, [...m.entries()]]));
const maps = (lists) => Object.fromEntries(Object.entries(lists).map(([c, l]) => [c, new Map(l)]));

async function series(id, start, origin, waitUntil) {
  const pair = PAIRS[id];
  return lastGood(origin, `fx-${id}`, async () => (pair.boi
    ? sorted((await boiSeries([pair.boi], start))[pair.boi])
    : sorted(cross(await ecbSeries([...new Set(pair.ecb)], start), pair.ecb))), waitUntil);
}

async function latest(origin, waitUntil) {
  const start = since(20);
  const ids = Object.keys(PAIRS);
  const [boi, ecb] = await Promise.allSettled([
    lastGood(origin, 'fx-boi', () => boiSeries(ids.filter((id) => PAIRS[id].boi).map((id) => PAIRS[id].boi), start), waitUntil),
    lastGood(origin, 'fx-ecb', async () => plain(await ecbSeries(['USD', 'GBP', 'JPY', 'CHF'], start)), waitUntil),
  ]);
  const items = [];
  for (const id of ids) {
    const pair = PAIRS[id];
    const source = pair.boi ? boi : ecb;
    if (source.status !== 'fulfilled') continue;
    const points = sorted(pair.boi ? source.value.value[pair.boi] : cross(maps(source.value.value), pair.ecb));
    if (points.length < 2) continue;
    const [date, value] = points[points.length - 1];
    items.push({ id, date, value, previous: points[points.length - 2][1], source: pair.boi ? 'boi' : 'ecb' });
  }
  if (!items.length) throw new Error('No rates');
  const complete = [boi, ecb].every((s) => s.status === 'fulfilled' && s.value.fresh);
  return { body: { updated: Math.floor(Date.now() / 1000), items }, complete };
}

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id !== null && !Object.hasOwn(PAIRS, id)) return new Response(null, { status: 400 });
  const cache = globalThis.caches?.default;
  // v2: answers held before the last-good fallback may be missing rows
  const key = new Request(`${url.origin}/api/fx?v=2${id ? `&id=${id}` : ''}`);
  const held = cache && await cache.match(key);
  if (held) return held;
  try {
    let body;
    let complete;
    if (id) {
      const got = await series(id, since(YEARS * 365), url.origin, waitUntil);
      body = { id, points: got.value };
      complete = got.fresh;
    } else {
      ({ body, complete } = await latest(url.origin, waitUntil));
    }
    const response = new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${complete ? SECONDS : SHORT}` },
    });
    if (cache) waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (error) {
    console.error('fx', error.message);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
