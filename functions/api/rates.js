// Cloudflare Pages Function: central bank rates for the home page tile, from each bank's own public data.
// The visitor's browser only ever talks to this site. Nothing about the visitor is passed on or stored.
// A complete answer is held at the edge for hours, since these rates change a few times a year.

const SECONDS = 21600;
const YEARS = 25;
const HEADERS = { 'User-Agent': 'romanoinvest.co.il rates', Accept: '*/*' };

async function source(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`);
  return response;
}

// Only the days a rate changed, plus its first value.
function changes(rows) {
  const kept = [];
  for (const [date, value] of rows.filter(([, v]) => Number.isFinite(v)).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!kept.length || kept[kept.length - 1][1] !== value) kept.push([date, value]);
  }
  if (!kept.length) throw new Error('No rate');
  return kept;
}

function csvRows(text, series) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const names = head.split(',');
  const date = names.indexOf('TIME_PERIOD');
  const value = names.indexOf('OBS_VALUE');
  if (date < 0 || value < 0) throw new Error('Unexpected CSV');
  return lines.map((line) => line.split(',')).filter((cells) => !series || cells[0] === series).map((cells) => [cells[date], parseFloat(cells[value])]);
}

const startDate = () => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - YEARS); return d.toISOString().slice(0, 10); };

const RATES = {
  async il() {
    const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/BR/1.0/?c%5BDATA_TYPE%5D=OF00&startperiod=${startDate()}&format=csv`;
    return { history: changes(csvRows(await (await source(url)).text(), 'MNT_RIB_BOI_D')) };
  },
  async us() {
    const today = new Date().toISOString().slice(0, 10);
    const { refRates } = await (await source(`https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=${startDate()}&endDate=${today}`)).json();
    const latest = refRates.reduce((a, b) => (a.effectiveDate > b.effectiveDate ? a : b));
    return { history: changes(refRates.map((r) => [r.effectiveDate, r.targetRateTo])), from: latest.targetRateFrom };
  },
  async eu() {
    const url = `https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?startPeriod=${startDate()}&format=csvdata`;
    return { history: changes(csvRows(await (await source(url)).text())) };
  },
  async uk() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, d] = startDate().split('-');
    const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=${d}/${months[m - 1]}/${y}&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`;
    const rows = (await (await source(url)).text()).trim().split(/\r?\n/).slice(1).map((line) => {
      const [date, value] = line.split(',');
      const [day, month, year] = date.split(' ');
      return [`${year}-${String(months.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`, parseFloat(value)];
    });
    return { history: changes(rows) };
  },
};

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

async function rates(origin, waitUntil) {
  const ids = Object.keys(RATES);
  const settled = await Promise.allSettled(ids.map((id) => lastGood(origin, `rate-${id}`, () => RATES[id](), waitUntil)));
  const items = settled.flatMap((s, i) => (s.status === 'fulfilled' ? [{ id: ids[i], ...s.value.value }] : []));
  if (!items.length) throw new Error(settled[0].reason?.message || 'No rates');
  const complete = settled.every((s) => s.status === 'fulfilled' && s.value.fresh);
  return { body: { updated: Math.floor(Date.now() / 1000), items }, complete };
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = globalThis.caches?.default;
  const origin = new URL(request.url).origin;
  // the version in the key drops answers held from an older shape of the data (v2: before the last-good fallback)
  const key = new Request(`${origin}/api/rates?years=${YEARS}&v=2`);
  const held = cache && await cache.match(key);
  if (held) return held;
  try {
    const { body, complete } = await rates(origin, waitUntil);
    const response = new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${complete ? SECONDS : SHORT}` },
    });
    if (cache) waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (error) {
    console.error('rates', error.message);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
