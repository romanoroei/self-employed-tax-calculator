// The home page's yields tile. Ranks the companies in each track from the Finance
// Ministry data that GemelHub syncs, and renders them as plain HTML at build time.
// Group rules and the simple average follow GemelHub's js/config.js and js/api.js,
// so both sites agree on a track and on its average.

export const PRODUCTS = [
  { id: 'invest', label: 'גמל להשקעה', classification: 'קופת גמל להשקעה', source: 'gemel' },
  { id: 'study', label: 'השתלמות', classification: 'קרנות השתלמות', source: 'gemel', excluded: ['1290'] },
  // ישיר stays out of the policies view at Roei's request.
  { id: 'policy', label: 'פוליסת חיסכון', classification: 'פוליסות שהונפקו החל משנת 2004', source: 'polisa', excluded: ['14385', '14386', '15207', '14291', '90'], excludedNames: ['אקסלנס', 'משתתף', 'מקבלי קצבה'], excludedCompanies: ['ישיר'] },
];
export const TRACKS = [
  { id: 'general', label: 'כללי', sub: 'כללי', policyName: 'כללי', policyIds: ['18013'] },
  { id: 'stocks', label: 'מניות', sub: 'מניות', policyName: 'מניות' },
];
export const COLUMNS = [
  { id: 'y1', label: 'שנה' },
  { id: 'y3', label: '3 שנים' },
  { id: 'y7', label: '7 שנים' },
];
export const DEFAULT_COLUMN = 'y7';
export const ROWS = 3;
// The chart's ranges, in months; 0 is the whole history.
const FUND_RANGES = [[12, 'שנה'], [36, '3 שנים'], [60, '5 שנים'], [84, '7 שנים'], [120, '10 שנים'], [0, 'מקס׳']];

// Policy tracks have no SUB_SPECIALIZATION, so GemelHub matches them by name.
const POLICY_EXCLUDES = {
  general: ['פאסיבי', ' 2', 'BlackRock', 'fidelity', 'State Street', 'Apollo', 'שריעה', 'למקבלי', 'קצבה'],
  stocks: ['BlackRock', 'fidelity', 'State Street', 'Apollo', 'סחיר', 'עוקב', 'למקבלי', 'S&P', 'אג"ח', '25%', 'ממשלות', 'ממשלת', 'קצבה'],
};

const COMPANIES = ['ישיר', 'איי. די. איי', 'אלטשולר', 'ילין לפידות', 'מנורה', 'הפניקס', 'אינפיניטי', 'אנליסט', 'איילון', 'הכשרה', 'פסגות', 'מיטב', 'מגדל', 'הראל', 'כלל', 'מור'];
const COMPANY_LABELS = { 'איי. די. איי': 'ישיר', 'אלטשולר': 'אלטשולר שחם', 'מנורה': 'מנורה מבטחים' };

export function companyOf(record) {
  const texts = [record.CONTROLLING_CORPORATION, record.MANAGING_CORPORATION, record.PARENT_COMPANY_NAME, record.FUND_NAME].map((t) => String(t || ''));
  for (const text of texts) {
    const hit = COMPANIES.filter((c) => new RegExp(`(^|[\\s"'-])${c.replace(/[.]/g, '\\.')}(?![א-ת])`).test(text)).sort((a, b) => text.search(a) - text.search(b))[0];
    if (hit) return COMPANY_LABELS[hit] || hit;
  }
  return null;
}

const inTrack = (record, product, track) => {
  const name = String(record.FUND_NAME || '');
  if (product.source === 'polisa') {
    if (track.policyIds?.includes(String(record.FUND_ID))) return true;
    return name.includes(track.policyName) && !POLICY_EXCLUDES[track.id].some((word) => name.toLowerCase().includes(word.toLowerCase()));
  }
  return String(record.SUB_SPECIALIZATION || '').trim() === track.sub
    && String(record.TARGET_POPULATION || '').trim() === 'כלל האוכלוסיה';
};

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const rounded = (v) => Math.round(v * 100) / 100;
// A multi-year yield of exactly zero in these files means the fund has no such figure.
const figure = (v) => (isNumber(v) && v !== 0 ? v : null);

// The ministry publishes no 12-month figure, so it is compounded from the monthly yields, as GemelHub does.
// Compounding the same months back to January reproduces YEAR_TO_DATE_YIELD on every fund checked.
// A fund missing any of the twelve months has no figure.
const lastTwelve = (period) => Array.from({ length: 12 }, (_, i) => {
  const t = Math.floor(period / 100) * 12 + (period % 100 - 1) - i;
  return Math.floor(t / 12) * 100 + (t % 12) + 1;
});
function yearBack(records, period) {
  const months = new Set(lastTwelve(period));
  const byFund = new Map();
  for (const r of records) {
    if (!months.has(r.REPORT_PERIOD) || !isNumber(r.MONTHLY_YIELD)) continue;
    const id = String(r.FUND_ID);
    if (!byFund.has(id)) byFund.set(id, new Map());
    byFund.get(id).set(r.REPORT_PERIOD, r.MONTHLY_YIELD);
  }
  const values = new Map();
  for (const [id, yields] of byFund) {
    if (yields.size === 12) values.set(id, rounded(([...yields.values()].reduce((total, v) => total * (1 + v / 100), 1) - 1) * 100));
  }
  return values;
}

// The chart of a fund: its monthly yields, back to the first month it is missing.
// The page compounds them over whatever period the visitor picks.
function monthly(records, id, period) {
  const yields = new Map(records.filter((r) => String(r.FUND_ID) === id && isNumber(r.MONTHLY_YIELD)).map((r) => [r.REPORT_PERIOD, r.MONTHLY_YIELD]));
  const months = [];
  for (let t = Math.floor(period / 100) * 12 + (period % 100 - 1); ; t -= 1) {
    const month = Math.floor(t / 12) * 100 + (t % 12) + 1;
    if (!yields.has(month)) break;
    months.unshift(month);
  }
  if (months.length < 2) return null;
  return { start: months[0], m: months.map((m) => rounded(yields.get(m))) };
}

// Which funds the tile ranks, so the updater can fetch just their history.
export const rankedFunds = ({ views }) => [...new Map(Object.values(views).flatMap((v) => Object.values(v.rank).flat()).map((r) => [r.key, r.id])).entries()];

// Adds each ranked fund's monthly history. history: { gemel: records, polisa: records }, older and current months together.
export function addHistory(data, history) {
  const series = {};
  for (const [key, id] of rankedFunds(data)) {
    const records = key.startsWith('g') ? history.gemel : history.polisa;
    series[key] = monthly(records, id, data.period);
    if (!series[key]) throw new Error(`No history for fund ${id}`);
  }
  return { ...data, series };
}

export function computeYields({ gemel, polisa, trailing7y }) {
  const sources = { gemel, polisa };
  if (gemel.report_period !== polisa.report_period) throw new Error(`Report periods differ: ${gemel.report_period} / ${polisa.report_period}`);
  const period = gemel.report_period;
  for (const family of ['gemel', 'polisa']) {
    if (trailing7y.families[family].reportPeriod !== period) throw new Error(`7-year figures are for ${trailing7y.families[family].reportPeriod}, not ${period}`);
  }
  const views = {};
  for (const product of PRODUCTS) {
    const y1 = yearBack(sources[product.source].records, period);
    const rows = sources[product.source].records.filter((r) => r.REPORT_PERIOD === period
      && String(r.FUND_CLASSIFICATION || '').trim() === product.classification
      && !String(r.FUND_NAME || '').includes('בניהול אישי')
      && !product.excluded?.includes(String(r.FUND_ID))
      && !product.excludedNames?.some((word) => String(r.FUND_NAME || '').includes(word)));
    for (const track of TRACKS) {
      const group = rows.filter((r) => inTrack(r, product, track))
        .map((r) => ({
          company: companyOf(r),
          id: String(r.FUND_ID),
          key: `${product.source[0]}${r.FUND_ID}`,
          name: String(r.FUND_NAME).trim(),
          y1: y1.get(String(r.FUND_ID)) ?? null,
          y3: figure(r.YIELD_TRAILING_3_YRS),
          y7: (() => { const v = figure(trailing7y.families[product.source].values[String(r.FUND_ID)]); return v === null ? null : rounded(v); })(),
        }))
        .filter((r) => r.company && !product.excludedCompanies?.includes(r.company) && COLUMNS.some((c) => r[c.id] !== null));
      // How many stand behind each column's average: a company can hold several funds in a track.
      const average = { count: group.length, funds: {}, companies: {} };
      const rank = {};
      for (const { id } of COLUMNS) {
        const holders = group.filter((r) => r[id] !== null);
        const values = holders.map((r) => r[id]);
        if (!values.length) throw new Error(`No ${id} figures for ${product.id}/${track.id}`);
        average[id] = rounded(values.reduce((sum, v) => sum + v, 0) / values.length);
        average.funds[id] = holders.length;
        average.companies[id] = new Set(holders.map((r) => r.company)).size;
        // One row per company: the tile compares companies inside a track.
        const seen = new Set();
        rank[id] = group.filter((r) => r[id] !== null).sort((a, b) => b[id] - a[id])
          .filter((r) => !seen.has(r.company) && seen.add(r.company)).slice(0, ROWS);
        if (rank[id].length < ROWS) throw new Error(`Only ${rank[id].length} rows for ${product.id}/${track.id}/${id}`);
      }
      views[`${product.id}-${track.id}`] = { average, rank };
    }
  }
  return { period, views };
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const periodLabel = (period) => `${MONTHS[period % 100 - 1]} ${Math.floor(period / 100)}`;
const percent = (v) => (v === null ? '<span aria-label="אין נתון">—</span>' : `<span dir="ltr">${v.toFixed(2)}%</span>`);
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function renderYields({ period, views, series }) {
  const buttons = (group, items, first) => items.map((item) => `<button type="button" data-yield-${group}="${item.id}" aria-pressed="${item.id === first}">${item.label}</button>`).join('');
  const firstView = `${PRODUCTS[0].id}-${TRACKS[0].id}-${DEFAULT_COLUMN}`;
  // How many stand behind the average differs by view and column, so the note carries one line per table.
  const counts = Object.entries(views).flatMap(([key, { average }]) => COLUMNS.map(({ id: sort, label }) => {
    const view = `${key}-${sort}`;
    const makers = average.companies[sort] === average.funds[sort]
      ? `${average.companies[sort]} חברות`
      : `${average.companies[sort]} חברות, ${average.funds[sort]} קופות`;
    return `<span data-yield-view="${view}"${view === firstView ? '' : ' hidden'}>ממוצע הקבוצה, ${label}: ${makers}. </span>`;
  })).join('');
  const tables = Object.entries(views).flatMap(([key, { average, rank }]) => COLUMNS.map(({ id: sort }) => {
    const [productId, trackId] = key.split('-');
    const view = `${key}-${sort}`;
    const caption = `${PRODUCTS.find((p) => p.id === productId).label}, מסלול ${TRACKS.find((t) => t.id === trackId).label}, מדורג לפי ${COLUMNS.find((c) => c.id === sort).label}`;
    const heads = COLUMNS.map((c) => `<th scope="col"${c.id === sort ? ' aria-sort="descending"' : ''}><button type="button" data-yield-sort="${c.id}">${c.label}</button></th>`).join('');
    const cells = (row) => COLUMNS.map((c) => `<td${c.id === sort ? ' class="is-sorted"' : ''}>${percent(row[c.id])}</td>`).join('');
    return `<table data-yield-view="${view}"${view === firstView ? '' : ' hidden'}><caption class="visually-hidden">${caption}</caption>`
      + `<thead><tr><th scope="col">חברה</th>${heads}</tr></thead><tbody>`
      + rank[sort].map((r) => `<tr><th scope="row" title="${escape(r.name)}"><button type="button" data-yield-row="${r.key}">${escape(r.company)}</button></th>${cells(r)}</tr>`).join('')
      + `</tbody><tfoot><tr><th scope="row" title="ממוצע פשוט של הקופות במסלול שיש להן נתון">ממוצע הקבוצה</th>${cells(average)}</tr></tfoot></table>`;
  })).join('');
  return `<div class="yield-picks"><div role="group" aria-label="סוג המוצר">${buttons('product', PRODUCTS, PRODUCTS[0].id)}</div><div role="group" aria-label="מסלול">${buttons('track', TRACKS, TRACKS[0].id)}</div></div>`
    + `<div class="market-ranges" role="group" aria-label="טווח זמן">${FUND_RANGES.map(([months, label]) => `<button type="button" data-range="${months}" aria-pressed="false">${label}</button>`).join('')}</div>`
    + `<figure class="market-chart"><figcaption></figcaption><div class="market-plot"><svg></svg></div></figure>`
    + `<script type="application/json" id="yield-series">${JSON.stringify(series)}</script>`
    + `<div class="yield-tables">${tables}</div>`
    + `<p class="yield-note"><strong>תשואה מצטברת עד ${periodLabel(period)}</strong> ${counts}לפי נתוני משרד האוצר, לפני דמי ניהול. מקף: אין נתון לתקופה המלאה. תשואות עבר אינן מבטיחות תשואות בעתיד. המידע אינו המלצה.</p>`;
}
