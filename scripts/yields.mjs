// The home page's yields tile. Picks the leaders from the Finance Ministry data
// that GemelHub syncs, and renders them as plain HTML at build time.
// Track rules follow GemelHub's js/config.js, so both sites agree on a track.

export const PRODUCTS = [
  { id: 'invest', label: 'גמל להשקעה', classification: 'קופת גמל להשקעה', source: 'gemel' },
  { id: 'study', label: 'השתלמות', classification: 'קרנות השתלמות', source: 'gemel', excluded: ['1290'] },
  { id: 'policy', label: 'פוליסת חיסכון', classification: 'פוליסות שהונפקו החל משנת 2004', source: 'polisa', excluded: ['14385', '14386', '15207', '14291'] },
];
export const TRACKS = [
  { id: 'general', label: 'כללי', sub: 'כללי', policyName: 'כללי', policyIds: ['18013'] },
  { id: 'stocks', label: 'מניות', sub: 'מניות', policyName: 'מניות' },
];
export const ROWS = 3;

// Policy tracks have no SUB_SPECIALIZATION, so GemelHub matches them by name.
const POLICY_EXCLUDES = {
  general: ['פאסיבי', ' 2', 'BlackRock', 'fidelity', 'State Street', 'Apollo', 'שריעה', 'למקבלי', 'קצבה'],
  stocks: ['BlackRock', 'fidelity', 'State Street', 'Apollo', 'סחיר', 'עוקב', 'למקבלי', 'S&P', 'אג"ח', '25%', 'ממשלות', 'ממשלת', 'קצבה'],
};

// Longest names first, so "הכשרה" never swallows a more exact match.
const COMPANIES = ['ישיר', 'איי. די. איי', 'אלטשולר', 'ילין לפידות', 'מנורה', 'הפניקס', 'אינפיניטי', 'אנליסט', 'איילון', 'הכשרה', 'פסגות', 'מיטב', 'מגדל', 'הראל', 'כלל', 'מור'];
const COMPANY_LABELS = { 'איי. די. איי': 'ישיר', 'אלטשולר': 'אלטשולר שחם', 'מנורה': 'מנורה מבטחים' };
export function companyOf(record) {
  const texts = [record.CONTROLLING_CORPORATION, record.MANAGING_CORPORATION, record.PARENT_COMPANY_NAME, record.FUND_NAME].map((t) => String(t || ''));
  for (const text of texts) {
    const hit = COMPANIES.filter((c) => new RegExp(`(^|[\\s"'-])${c.replace(/[.]/g, '\\.')}`).test(text)).sort((a, b) => text.search(a) - text.search(b))[0];
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

export function computeYields({ gemel, polisa, trailing7y }) {
  const sources = { gemel, polisa };
  if (gemel.report_period !== polisa.report_period) throw new Error(`Report periods differ: ${gemel.report_period} / ${polisa.report_period}`);
  const period = gemel.report_period;
  for (const family of ['gemel', 'polisa']) {
    if (trailing7y.families[family].reportPeriod !== period) throw new Error(`7-year figures are for ${trailing7y.families[family].reportPeriod}, not ${period}`);
  }
  // Absent for a fund without seven full years of monthly yields.
  const sevenYears = (product, record) => {
    const value = trailing7y.families[product.source].values[String(record.FUND_ID)];
    return isNumber(value) ? Math.round(value * 100) / 100 : null;
  };
  const views = {};
  for (const product of PRODUCTS) {
    const rows = sources[product.source].records.filter((r) => r.REPORT_PERIOD === period
      && String(r.FUND_CLASSIFICATION || '').trim() === product.classification
      && !product.excluded?.includes(String(r.FUND_ID)));
    for (const track of TRACKS) {
      const candidates = rows
        .filter((r) => inTrack(r, product, track) && isNumber(r.YIELD_TRAILING_3_YRS) && isNumber(r.YEAR_TO_DATE_YIELD) && r.YIELD_TRAILING_3_YRS !== 0)
        .map((r) => ({ company: companyOf(r), name: String(r.FUND_NAME).trim(), ytd: r.YEAR_TO_DATE_YIELD, y3: r.YIELD_TRAILING_3_YRS, y7: sevenYears(product, r) }))
        .filter((r) => r.company)
        .sort((a, b) => b.y3 - a.y3);
      // One row per company: the tile compares companies inside a track.
      const seen = new Set();
      const top = candidates.filter((r) => !seen.has(r.company) && seen.add(r.company)).slice(0, ROWS);
      if (top.length < ROWS) throw new Error(`Only ${top.length} rows for ${product.id}/${track.id}`);
      views[`${product.id}-${track.id}`] = top;
    }
  }
  return { period, views };
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const periodLabel = (period) => `${MONTHS[period % 100 - 1]} ${Math.floor(period / 100)}`;
const percent = (v) => (v === null ? '<span aria-label="אין נתון">—</span>' : `<span dir="ltr">${v.toFixed(2)}%</span>`);
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function renderYields({ period, views }) {
  const buttons = (group, items, first) => items.map((item) => `<button type="button" data-yield-${group}="${item.id}" aria-pressed="${item.id === first}">${item.label}</button>`).join('');
  const tables = Object.entries(views).map(([key, rows], index) => {
    const [productId, trackId] = key.split('-');
    const caption = `${PRODUCTS.find((p) => p.id === productId).label}, מסלול ${TRACKS.find((t) => t.id === trackId).label}`;
    return `<table data-yield-view="${key}"${index ? ' hidden' : ''}><caption class="visually-hidden">${caption}</caption>`
      + '<thead><tr><th scope="col">חברה</th><th scope="col">מתחילת השנה</th><th scope="col">3 שנים</th><th scope="col">7 שנים</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><th scope="row" title="${escape(r.name)}">${escape(r.company)}</th><td>${percent(r.ytd)}</td><td>${percent(r.y3)}</td><td>${percent(r.y7)}</td></tr>`).join('')
      + '</tbody></table>';
  }).join('');
  return `<div class="yield-picks"><div role="group" aria-label="סוג המוצר">${buttons('product', PRODUCTS, PRODUCTS[0].id)}</div><div role="group" aria-label="מסלול">${buttons('track', TRACKS, TRACKS[0].id)}</div></div>`
    + `<div class="yield-tables">${tables}</div>`
    + `<p class="yield-note">נתוני משרד האוצר עד ${periodLabel(period)}, לפי הדירוג ב־3 שנים. תשואה מצטברת לפני דמי ניהול. מקף: אין נתון ל־7 שנים מלאות. תשואות עבר אינן מבטיחות תשואות בעתיד. המידע אינו המלצה.</p>`;
}
