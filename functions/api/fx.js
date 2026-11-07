// Cloudflare Pages Function: exchange rates for the home page tile, from official daily publications.
// Shekel pairs are the Bank of Israel representative rates; the others are worked out from the ECB reference rates.
//   /api/fx              the latest rate of each pair and the one before it
//   /api/fx?id=usdils    ten years of one pair, for the chart
// The visitor's browser only ever talks to this site. Answers are held at the edge for an hour.

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

async function series(id, start) {
  const pair = PAIRS[id];
  if (pair.boi) return sorted((await boiSeries([pair.boi], start))[pair.boi]);
  return sorted(cross(await ecbSeries([...new Set(pair.ecb)], start), pair.ecb));
}

async function latest() {
  const start = since(20);
  const ids = Object.keys(PAIRS);
  const [boi, ecb] = await Promise.allSettled([
    boiSeries(ids.filter((id) => PAIRS[id].boi).map((id) => PAIRS[id].boi), start),
    ecbSeries(['USD', 'GBP', 'JPY', 'CHF'], start),
  ]);
  const items = [];
  for (const id of ids) {
    const pair = PAIRS[id];
    const source = pair.boi ? boi : ecb;
    if (source.status !== 'fulfilled') continue;
    const points = sorted(pair.boi ? source.value[pair.boi] : cross(source.value, pair.ecb));
    if (points.length < 2) continue;
    const [date, value] = points[points.length - 1];
    items.push({ id, date, value, previous: points[points.length - 2][1], source: pair.boi ? 'boi' : 'ecb' });
  }
  if (!items.length) throw new Error('No rates');
  return { updated: Math.floor(Date.now() / 1000), items };
}

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id !== null && !Object.hasOwn(PAIRS, id)) return new Response(null, { status: 400 });
  const cache = globalThis.caches?.default;
  const key = new Request(`${url.origin}/api/fx${id ? `?id=${id}` : ''}`);
  const held = cache && await cache.match(key);
  if (held) return held;
  try {
    const body = id ? { id, points: await series(id, since(YEARS * 365)) } : await latest();
    const response = new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${SECONDS}` },
    });
    if (cache) waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (error) {
    console.error('fx', error.message);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
