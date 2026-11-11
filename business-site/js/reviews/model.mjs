// Monthly market reviews: the data model used by the build and the tests. Pure functions only, no DOM and no I/O.
// Each month Roei sends the link to the Arbitrage review; Claude writes an edited review from it in this format,
// Roei approves it, and only then it is published.
//
// One review = one JSON file in business-site/content/market-reviews/<id>.json, where <id> is the
// month the review covers (YYYY-MM). Only status "published" reaches the site.
// All text is plain text: the renderer escapes everything and understands only blank-line
// paragraphs, "- " list lines and **bold**. No HTML is ever taken from a review.

export const SITE = 'https://romanoinvest.co.il';
export const SCHEMA = 1;
export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const ID_RE = /^20\d\d-(?:0[1-9]|1[0-2])$/;
export const DATE_RE = /^20\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
// The original review is linked only on the Arbitrage site (ar-fo.co.il).
export const SOURCE_URL_RE = /^https:\/\/www\.ar-fo\.co\.il\/[\w\-\/%.]+$/;
export const STATUSES =['draft', 'approved', 'published'];

// The market areas a section can cover (5ב). A month may use any subset, in any order.
export const SECTION_KINDS = {
  israel: 'שוק המניות בישראל',
  global: 'שוק המניות בארה"ב ובעולם',
  rates: 'ריבית ואינפלציה',
  bonds: 'שוק איגרות החוב',
  fx: 'שערי מטבע',
  events: 'אירועים כלכליים מרכזיים',
  other: 'נושא נוסף',
};

// "What it means for our savings" (5ד): one short card per product, only those filled in.
export const PRODUCTS = {
  pension: { name: 'קרנות פנסיה' },
  study: { name: 'קרנות השתלמות' },
  gemel: { name: 'קופות גמל להשקעה', href: '/investment-fund' },
  policy: { name: 'פוליסות חיסכון', href: '/savings-policy' },
  portfolio: { name: 'תיקי השקעות' },
  cash: { name: 'כספים פנויים בבנק' },
};

// Internal links a review may point to. Anything else is refused, so a review cannot link out.
export const RELATED = {
  '/investment-fund': { k: 'מדריך', title: 'קופת גמל להשקעה', text: 'נזילות, מס על הרווחים וקצבה פטורה ממס מגיל 60' },
  '/savings-policy': { k: 'מדריך', title: 'פוליסת חיסכון', text: 'נזילות, מסלולים, דמי ניהול ומס על הרווחים' },
  '/self-employed': { k: 'מדריך', title: 'פנסיה וחיסכון לעצמאים', text: 'כמה חובה להפקיד ואילו הטבות מס אפשר לקבל' },
  '/magazine/tides-and-waves': { k: 'מאמר', title: 'הגאות והגלים', text: 'שוק ההון ומסלולי החיסכון שלנו, ולמה כדאי לזכור את 2022' },
  '/magazine/financial-calendar': { k: 'לוח שנה', title: 'לוח השנה הפיננסי', text: 'מה לבדוק בכל חודש, עם תזכורות ישר ליומן' },
  '/compass': { k: 'שאלון', title: 'המצפן הפיננסי לעצמאים', text: 'כמה שאלות קצרות, ותדעו מה כדאי לבדוק קודם' },
};

// Cover pictures already on the site (all public domain or licensed, see assets/credits.json).
export const COVERS = {
  '/assets/tase-board.jpg': 'לוח המסחר בבורסה לניירות ערך בתל אביב',
  '/assets/tase-lobby.jpg': 'לובי הבורסה לניירות ערך בתל אביב',
  '/assets/img/wall-street.jpg': 'וול סטריט, ניו יורק',
  '/assets/nyse-floor-1963.jpg': 'רצפת המסחר בבורסה בניו יורק, 1963',
  '/assets/nyse-floor-highsmith.jpg': 'רצפת המסחר בבורסה בניו יורק',
  '/assets/edison-ticker.jpg': 'טלגרף מניות של אדיסון',
};

// Channels for measured links (10). The counter accepts exactly these names.
export const CHANNELS = {
  whatsapp: { name: 'וואטסאפ (נועם)', medium: 'noam' },
  facebook: { name: 'פייסבוק', medium: 'social' },
  instagram: { name: 'אינסטגרם', medium: 'social' },
  tiktok: { name: 'טיקטוק', medium: 'social' },
  email: { name: 'מייל', medium: 'email' },
};

// Phase 2 (marketing content) is stored on the review so it never needs a schema change.
export const MARKETING_CHANNELS = ['facebook', 'reels', 'instagram', 'whatsapp'];
export const MARKETING_STATUSES = ['draft', 'approved', 'published'];

export const LIMITS = { title: 120, summary: 700, highlight: 220, topic: 40, heading: 100, text: 6000, angle: 2500, rows: 30, seoTitle: 70, meta: 170, opener: 300, message: 1200 };

export function emptyReview(id = '') {
  return {
    schema: SCHEMA, id, status: 'draft',
    title: '', seoTitle: '', metaDescription: '',
    publishedAt: '', updatedAt: '',
    summary: '', highlights: ['', '', ''], topics: ['', '', ''], tags: [],
    cover: { src: '/assets/tase-board.jpg', alt: COVERS['/assets/tase-board.jpg'] },
    source: { name: "ארביטראז'", title: '', date: '', url: '', permission: false, note: '' },
    sections: [],
    meaning: { intro: '', items: [] },
    angle: { text: '', approved: false },
    related: ['/investment-fund', '/magazine/tides-and-waves'],
    noam: { opener: '', message: '' },
    approval: { content: false, at: '' },
    marketing: { topics: [], items: [] },
  };
}

export function emptySection(kind = 'israel') {
  return { kind, heading: SECTION_KINDS[kind] || '', text: '', basis: 'source', ref: '', figures: [] };
}

export function emptyFigure(type = 'bars') {
  return { type, title: '', unit: '%', rows: '', asOf: '', source: '' };
}

export const monthLabel = (id) => { const [y, m] = String(id).split('-'); return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : String(id); };
export const reviewPath = (id) => `/market-reviews/${id}`;
export const reviewUrl = (id) => SITE + reviewPath(id);
export const pageTitle = (r) => `סקירת שוק ההון – ${monthLabel(r.id)}`;
export function hebrewDate(iso) {
  if (!DATE_RE.test(iso || '')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ב${MONTHS[m - 1]} ${y}`;
}

// Measured address for one channel. Only the channel and the month go in it, never a person.
export function utmLink(id, channel) {
  const c = CHANNELS[channel];
  if (!c) throw new Error('Unknown channel ' + channel);
  return `${reviewUrl(id)}?utm_source=${channel}&utm_medium=${c.medium}&utm_campaign=market-review-${id}`;
}

// Words in everything a visitor reads; Hebrew reads at about 180 words a minute.
export function readingMinutes(r) {
  const parts = [r.title, r.summary, ...(r.highlights || []), ...(r.sections || []).flatMap(s => [s.heading, s.text, ...(s.figures || []).map(f => f.title + ' ' + f.rows)]), r.meaning?.intro, ...(r.meaning?.items || []).map(i => i.text), r.angle?.approved ? r.angle.text : ''];
  const words = parts.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 180));
}

// The first three sentences of the summary, for Noam and for previews.
export function teaser(r, sentences = 3) {
  const parts = String(r.summary || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["״']?|[^.!?]+$/g) || [];
  return parts.slice(0, sentences).join(' ').trim();
}

// Noam's monthly message (7). "[שם]" stays for AgendOS to fill; it is never filled here.
export function noamMessage(r) {
  if (r.noam?.message?.trim()) return r.noam.message.trim();
  const opener = (r.noam?.opener || '').trim() || '[משפט מעניין על האירוע המרכזי של החודש]';
  return [
    'היי [שם], כאן נועם, העוזר הדיגיטלי של רועי רומנו 👋',
    `הסקירה החודשית החדשה עלתה לאתר של רועי: ${pageTitle(r)}.`,
    opener,
    '',
    '📊 לקריאת הסקירה:',
    utmLink(r.id, 'whatsapp'),
    '',
    'אם משהו בסקירה מעלה אצלך שאלה לגבי החיסכון או ההשקעות שלך, אפשר לכתוב לי ואעביר לרועי.',
  ].join('\n');
}

// The WhatsApp message a reader sends Roei from the call to action (5ו).
export const contactText = (r) => `היי רועי, קראתי את סקירת שוק ההון של ${monthLabel(r.id)} ואשמח לשיחה על החיסכון וההשקעות שלי.`;

// A figure's rows: one per line, cells split by "|". Bars take "label | number".
export function parseRows(text) {
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(c => c.trim()));
}
export function parseNumber(s) {
  const t = String(s ?? '').replace(/[\s,%₪$€]/g, '').replace(/[−–]/g, '-');
  return /^[+-]?\d+(?:\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const str = (v) => typeof v === 'string';
const blank = (v) => !str(v) || !v.trim();

// Errors block approval and publishing; warnings are shown but allowed.
export function validate(r, { forPublish = false } = {}) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  if (!r || typeof r !== 'object') return { errors: ['אין נתונים'], warnings };
  if (!ID_RE.test(r.id || '')) err('חודש הסקירה חסר או לא תקין (YYYY-MM)');
  if (!STATUSES.includes(r.status)) err('סטטוס לא מוכר');
  const len = (v, max, name) => { if (str(v) && v.length > max) err(`${name} ארוך מדי (עד ${max} תווים)`); };
  if (blank(r.title)) err('חסרה כותרת לסקירה'); len(r.title, LIMITS.title, 'הכותרת');
  if (blank(r.summary)) err('חסר תקציר'); len(r.summary, LIMITS.summary, 'התקציר');
  const hl = (r.highlights || []).filter(h => !blank(h));
  if (hl.length < 3 || hl.length > 5) err('צריך 3 עד 5 נקודות חשובות');
  hl.forEach(h => len(h, LIMITS.highlight, 'נקודה חשובה'));
  const topics = (r.topics || []).filter(t => !blank(t));
  if (topics.length !== 3) err('צריך שלושה נושאים מרכזיים לכרטיס');
  topics.forEach(t => len(t, LIMITS.topic, 'נושא'));
  if (!COVERS[r.cover?.src]) err('תמונת השער אינה מהרשימה המאושרת');
  if (blank(r.source?.name)) err('חסר שם המקור לקרדיט');
  if (!DATE_RE.test(r.source?.date || '')) err('חסר תאריך הסקירה המקורית');
  if (r.source?.url && !SOURCE_URL_RE.test(r.source.url)) err("הקישור לסקירה המקורית חייב להיות באתר ארביטראז'");
  if (forPublish && r.source?.permission !== true) err('לא סומן שיש הרשאת שימוש בתוכן המקור');
  const sections = r.sections || [];
  if (!sections.some(s => !blank(s.heading) && !blank(s.text))) err('צריך לפחות נושא אחד ב"מה קרה החודש בשווקים"');
  sections.forEach((s, i) => {
    const n = `נושא ${i + 1}`;
    if (!SECTION_KINDS[s.kind]) err(`${n}: תחום לא מוכר`);
    if (blank(s.heading) || blank(s.text)) err(`${n}: חסרים כותרת או טקסט`);
    len(s.heading, LIMITS.heading, `${n}, הכותרת`); len(s.text, LIMITS.text, `${n}, הטקסט`);
    if (!['source', 'verified'].includes(s.basis)) err(`${n}: חסר בסיס המידע`);
    if (s.basis === 'verified' && blank(s.ref)) err(`${n}: מידע שאומת ממקור אחר צריך את שם המקור`);
    if (s.basis === 'source' && blank(s.ref)) warn(`${n}: כדאי לציין את העמוד בסקירה המקורית`);
    (s.figures || []).forEach((f, j) => {
      const fn = `${n}, גרף/טבלה ${j + 1}`;
      if (!['bars', 'table'].includes(f.type)) err(`${fn}: סוג לא מוכר`);
      if (blank(f.title)) err(`${fn}: חסרה כותרת`);
      if (!DATE_RE.test(f.asOf || '')) err(`${fn}: חסר תאריך ייחוס`);
      if (blank(f.source)) err(`${fn}: חסר מקור הנתונים`);
      const rows = parseRows(f.rows);
      if (!rows.length) err(`${fn}: אין נתונים`);
      if (rows.length > LIMITS.rows) err(`${fn}: יותר מ־${LIMITS.rows} שורות`);
      if (f.type === 'bars' && rows.some(c => c.length !== 2 || Number.isNaN(parseNumber(c[1])))) err(`${fn}: כל שורה צריכה להיות "שם | מספר"`);
      if (f.type === 'table' && rows.length < 2) err(`${fn}: טבלה צריכה שורת כותרות ולפחות שורה אחת`);
    });
  });
  (r.meaning?.items || []).forEach(it => { if (!PRODUCTS[it.key]) err('מוצר לא מוכר ב"מה זה אומר"'); len(it.text, 900, 'הסבר למוצר'); });
  if (!(r.meaning?.items || []).some(it => !blank(it.text))) warn('האזור "מה זה אומר על החיסכון וההשקעות שלנו?" ריק');
  len(r.angle?.text, LIMITS.angle, 'הזווית שלי');
  if (!blank(r.angle?.text) && !r.angle?.approved) warn('"הזווית שלי" לא תוצג עד שתסמן שאישרת אותה');
  (r.related || []).forEach(h => { if (!RELATED[h]) err('קישור פנימי לא מוכר: ' + h); });
  if (str(r.seoTitle) && r.seoTitle.length > LIMITS.seoTitle) warn('כותרת ה־SEO ארוכה מ־70 תווים ועלולה להיחתך בגוגל');
  if (str(r.metaDescription) && r.metaDescription.trim() && (r.metaDescription.length < 70 || r.metaDescription.length > 160)) warn('תיאור ה־Meta מומלץ באורך 70 עד 160 תווים');
  len(r.noam?.opener, LIMITS.opener, 'משפט הפתיחה לנועם'); len(r.noam?.message, LIMITS.message, 'הודעת נועם');
  if (forPublish) {
    if (r.approval?.content !== true) err('הסקירה לא סומנה כ"בדקתי ואישרתי"');
    if (!DATE_RE.test(r.publishedAt || '')) err('חסר תאריך פרסום');
  }
  return { errors, warnings };
}

// Keeps only known fields with the right types, so nothing unexpected is stored or published.
export function normalize(input) {
  const base = emptyReview(input?.id);
  const s = (v, max = 10000) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').slice(0, max) : '');
  const r = input || {};
  return {
    schema: SCHEMA, id: s(r.id, 7), status: STATUSES.includes(r.status) ? r.status : 'draft',
    title: s(r.title, 300), seoTitle: s(r.seoTitle, 200), metaDescription: s(r.metaDescription, 400),
    publishedAt: s(r.publishedAt, 10), updatedAt: s(r.updatedAt, 10),
    summary: s(r.summary, 2000),
    highlights: (Array.isArray(r.highlights) ? r.highlights : base.highlights).slice(0, 5).map(h => s(h, 400)),
    topics: (Array.isArray(r.topics) ? r.topics : base.topics).slice(0, 3).map(t => s(t, 80)),
    tags: (Array.isArray(r.tags) ? r.tags : []).filter(t => SECTION_KINDS[t]).slice(0, 7),
    cover: COVERS[r.cover?.src] ? { src: r.cover.src, alt: s(r.cover.alt, 200) || COVERS[r.cover.src] } : base.cover,
    source: { name: s(r.source?.name, 100) || base.source.name, title: s(r.source?.title, 200), date: s(r.source?.date, 10), url: SOURCE_URL_RE.test(r.source?.url || '') ? r.source.url : '', permission: r.source?.permission === true, note: s(r.source?.note, 400) },
    sections: (Array.isArray(r.sections) ? r.sections : []).slice(0, 12).map(x => ({
      kind: SECTION_KINDS[x?.kind] ? x.kind : 'other', heading: s(x?.heading, 200), text: s(x?.text, 12000),
      basis: x?.basis === 'verified' ? 'verified' : 'source', ref: s(x?.ref, 300),
      figures: (Array.isArray(x?.figures) ? x.figures : []).slice(0, 4).map(f => ({ type: f?.type === 'table' ? 'table' : 'bars', title: s(f?.title, 200), unit: s(f?.unit, 10), rows: s(f?.rows, 4000), asOf: s(f?.asOf, 10), source: s(f?.source, 200) })),
    })),
    meaning: { intro: s(r.meaning?.intro, 1200), items: (Array.isArray(r.meaning?.items) ? r.meaning.items : []).filter(i => PRODUCTS[i?.key]).slice(0, 6).map(i => ({ key: i.key, text: s(i.text, 1200) })) },
    angle: { text: s(r.angle?.text, 4000), approved: r.angle?.approved === true },
    related: (Array.isArray(r.related) ? r.related : []).filter(h => RELATED[h]).slice(0, 4),
    noam: { opener: s(r.noam?.opener, 400), message: s(r.noam?.message, 2000) },
    approval: { content: r.approval?.content === true, at: s(r.approval?.at, 25) },
    marketing: normalizeMarketing(r.marketing),
  };
}

// Phase 2 shape: suggested topics, and outputs per channel, each with its source references and status.
function normalizeMarketing(m) {
  const s = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    topics: (Array.isArray(m?.topics) ? m.topics : []).slice(0, 8).map(t => ({ id: s(t?.id, 40), title: s(t?.title, 200), event: s(t?.event, 1000), why: s(t?.why, 600), audience: s(t?.audience, 300), hook: s(t?.hook, 400), refs: (Array.isArray(t?.refs) ? t.refs : []).map(x => s(x, 100)).slice(0, 6), picked: t?.picked === true })),
    items: (Array.isArray(m?.items) ? m.items : []).slice(0, 60).filter(i => MARKETING_CHANNELS.includes(i?.channel)).map(i => ({
      id: s(i.id, 40), channel: i.channel, topic: s(i.topic, 40), version: Number.isInteger(i.version) ? i.version : 1,
      origin: i.origin === 'ai' ? 'ai' : 'manual', fields: Object.fromEntries(Object.entries(i.fields && typeof i.fields === 'object' ? i.fields : {}).slice(0, 20).map(([k, v]) => [s(k, 40), s(v, 4000)])),
      refs: (Array.isArray(i.refs) ? i.refs : []).map(x => s(x, 100)).slice(0, 10),
      status: MARKETING_STATUSES.includes(i.status) ? i.status : 'draft', createdAt: s(i.createdAt, 25), updatedAt: s(i.updatedAt, 25),
    })),
  };
}
