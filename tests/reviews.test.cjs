// Market reviews: model and renderer. Runs in the build (scripts/build-cloudflare.mjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = (p) => import(pathToFileURL(path.join(root, p)).href);
const sample = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'market-review-sample.json'), 'utf8'));

test('the sample passes validation for publishing', async () => {
  const { normalize, validate } = await load('business-site/js/reviews/model.mjs');
  const { errors } = validate(normalize(sample()), { forPublish: true });
  assert.deepEqual(errors, []);
});

test('publishing needs permission, approval, a source date and dated, sourced figures', async () => {
  const { normalize, validate } = await load('business-site/js/reviews/model.mjs');
  const r = normalize(sample());
  r.source.permission = false; r.approval.content = false; r.source.date = '';
  r.sections[0].figures[0].asOf = ''; r.sections[0].figures[0].source = '';
  r.sections[1].ref = '';
  const { errors } = validate(r, { forPublish: true });
  for (const part of ['הרשאת שימוש', 'בדקתי ואישרתי', 'תאריך הסקירה המקורית', 'תאריך ייחוס', 'מקור הנתונים', 'שם המקור']) assert(errors.some(e => e.includes(part)), 'missing error: ' + part);
});

test('normalize drops unknown fields, foreign links and covers', async () => {
  const { normalize } = await load('business-site/js/reviews/model.mjs');
  const r = normalize({ ...sample(), evil: 1, related: ['https://evil.example', '/compass'], cover: { src: 'javascript:alert(1)' } });
  assert.equal(r.evil, undefined);
  assert.deepEqual(r.related, ['/compass']);
  assert.equal(r.cover.src, '/assets/tase-board.jpg');
});

test('the review page escapes text, shows only an approved angle, credits the source, and links the measured CTA', async () => {
  const { normalize } = await load('business-site/js/reviews/model.mjs');
  const { renderReviewPage } = await load('business-site/js/reviews/render.mjs');
  const r = normalize(sample());
  let html = renderReviewPage(r);
  assert(!html.includes('<script>alert(1)'), 'title must be escaped');
  assert(!html.includes('<b>תגית</b>') && html.includes('&lt;b&gt;תגית&lt;/b&gt;'), 'section text must be escaped');
  assert(html.includes('<strong>הדגשה</strong>'), 'bold works');
  assert(html.includes('<h1 class="art-title rv-title">סקירת שוק ההון – אוקטובר 2026</h1>'));
  assert(html.includes('rel="canonical" href="https://romanoinvest.co.il/market-reviews/2026-10"'));
  assert(html.includes('href="https://www.ar-fo.co.il/professional-magazine/sample"'), 'link to the original');
  assert(html.includes('"@type":"Article"') && html.includes('"isBasedOn"'));
  assert(html.includes('הזווית שלי | רועי רומנו'));
  assert(html.includes('סקירת שוק ההון של ארביטראז&#39;'), 'source credit');
  assert(html.includes('נכון ל־31 באוקטובר 2026. מקור הנתונים: נתוני דוגמה.'), 'figure date and source');
  assert(html.includes('class="art-share') && html.includes(encodeURIComponent('https://romanoinvest.co.il/market-reviews/2026-10')), 'WhatsApp share of its own address');
  assert(html.includes('data-count="review:cta-2026-10"') && html.includes('wa.me/972528089808?text='), 'CTA to WhatsApp with the month');
  assert(html.includes(encodeURIComponent('אוקטובר 2026')));
  r.angle.approved = false;
  html = renderReviewPage(r);
  assert(!html.includes('הזווית שלי | רועי רומנו'), 'an unapproved angle never shows');
  assert(!html.includes('<script>alert'), 'no script from the data, even in JSON-LD');
});

test('the hub lists the newest review first and the rest in the archive', async () => {
  const { normalize } = await load('business-site/js/reviews/model.mjs');
  const { renderHub } = await load('business-site/js/reviews/render.mjs');
  const a = normalize(sample()), b = normalize({ ...sample(), id: '2026-09', title: 'ספטמבר' });
  const html = renderHub([a, b]);
  assert(html.includes('<h1 class="art-title">סקירות שוק ההון</h1>'));
  assert(html.indexOf('/market-reviews/2026-10') < html.indexOf('/market-reviews/2026-09'));
  assert(html.includes('data-year="2026"'));
  assert(renderHub([]).includes('הסקירה הראשונה תעלה כאן בקרוב'));
});

test('Noam: the message keeps [שם] for AgendOS, carries a measured link, and the teaser has at most three sentences', async () => {
  const { normalize, noamMessage, teaser, utmLink } = await load('business-site/js/reviews/model.mjs');
  const r = normalize(sample());
  const msg = noamMessage(r);
  assert(msg.startsWith('היי [שם], כאן נועם'));
  assert(msg.includes('https://romanoinvest.co.il/market-reviews/2026-10?utm_source=whatsapp&utm_medium=noam&utm_campaign=market-review-2026-10'));
  assert(!teaser(r).includes('רביעי'));
  assert.throws(() => utmLink('2026-10', 'somebody'));
});

test('the funds table shows the stored snapshot only, labelled as historical', async () => {
  const { normalize, validate } = await load('business-site/js/reviews/model.mjs');
  const { renderReviewPage } = await load('business-site/js/reviews/render.mjs');
  const r = normalize({ ...sample(), funds: { period: 202610, takenAt: '2026-11-11', rows: [{ key: 'invest-general', m1: -0.02, y1: 10.39, y3: 43.84, funds: 11, companies: 11 }, { key: 'policy-general', m1: 0.1, y1: 10.52, y3: 42.09, funds: 12, companies: 7 }] } });
  assert.deepEqual(validate(r, { forPublish: true }).errors, []);
  const html = renderReviewPage(r);
  for (const part of ['נתונים היסטוריים', 'תמונת מצב לסוף אוקטובר 2026', 'כפי שנשמרה ב־11 בנובמבר 2026', '−0.02%', '+10.39%', '+42.09%', '12 מסלולים של 7 חברות', 'לפני דמי ניהול']) assert(html.includes(part), 'missing: ' + part);
  const waiting = renderReviewPage(normalize(sample()));
  assert(waiting.includes('התשואות של אוקטובר 2026 יתווספו כאן') && !waiting.includes('rv-funds-fig'), 'no snapshot yet: a note, no table');
  assert(validate(normalize({ ...sample(), funds: { period: 202609, takenAt: '2026-11-11', rows: [{ key: 'invest-general', m1: 1, y1: 1, y3: 1, funds: 1, companies: 1 }] } })).errors.some(e => e.includes('חודש הסקירה')), 'another month is refused');
  const bad = normalize({ ...sample(), funds: { period: 202613, takenAt: '', rows: [] } });
  assert(validate(bad).errors.some(e => e.includes('הקופות')));
});
