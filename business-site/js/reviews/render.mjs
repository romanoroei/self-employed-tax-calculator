// Monthly market reviews: HTML for the hub (/market-reviews) and each review (/market-reviews/<id>).
// Used by the build (scripts/build-cloudflare.mjs) and by the admin preview, so both show the same page.
// Every piece of review text goes through esc(); the only markup a review can produce is
// paragraphs, lists and bold (see prose()).
import { SITE, SECTION_KINDS, PRODUCTS, RELATED, monthLabel, reviewPath, reviewUrl, pageTitle, hebrewDate, readingMinutes, contactText, parseRows, parseNumber } from './model.mjs';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

// Blank lines split paragraphs; a run of lines starting with "- " becomes a list.
export function prose(text) {
  return String(text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.every(l => /^[-•]\s+/.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.replace(/^[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('\n');
}

const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
const LINK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0Zm-2.8 5.7a4 4 0 0 1-2.9-6.8l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a2 2 0 0 0 2.9 2.9l2.1-2.1a1 1 0 1 1 1.4 1.4l-2.1 2.1a4 4 0 0 1-2.8 1.1Zm8.5-7.3a1 1 0 0 1-.7-1.7l2.1-2.1a2 2 0 0 0-2.9-2.9l-2.1 2.1a1 1 0 1 1-1.4-1.4l2.1-2.1a4 4 0 0 1 5.7 5.7l-2.1 2.1a1 1 0 0 1-.7.3Z"/></svg>';

function head({ title, description, canonical, image, type, root, jsonLd, preview }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${preview ? `<base href="${esc(preview)}">\n<meta name="robots" content="noindex">\n` : ''}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${type}">
<meta property="og:image" content="${SITE}${esc(image)}">
<meta property="og:locale" content="he_IL">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}css/site.css">
<link rel="stylesheet" href="${root}css/article.css">
<link rel="stylesheet" href="${root}css/reviews.css">
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="${root}css/consent.css">
<link rel="stylesheet" href="${root}css/year-end.css">
<link rel="canonical" href="${canonical}">
<meta property="og:url" content="${canonical}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>

<header class="topbar" id="top">
  <a class="tile tile-ink bar-brand" href="/"><img src="${root}assets/arbitrage-mark.png" width="44" height="28" alt=""><strong>רועי רומנו</strong><span>מתכנן פיננסי</span></a>
  <div class="bar-tools"><a class="bar-tools-toggle" href="/knowledge">ארביטראז' של ידע</a></div>
  <nav class="tile tile-slate bar-nav" aria-label="ניווט ראשי">
    <a href="/#approach">הגישה שלי</a>
    <a href="/#about">עליי</a>
    <a href="/#clients">את מי אני מלווה</a>
    <a href="/#services">תחומים</a>
    <a href="/#magazine">מגזין וכלים</a>
    <a href="/#faq">שאלות נפוצות</a>
  </nav>
  <a class="tile tile-gold bar-cta" href="/#contact">לשיחת היכרות</a>
</header>

<a class="back-home" href="/"><span aria-hidden="true">→</span> חזרה לדף העסקי</a>
`;
}

function foot(root, page) {
  return `
<footer class="foot">
  <div class="foot-board board">
    <div class="tile tile-ink foot-name">
      <p><strong>רועי רומנו</strong> <span>מתכנן פיננסי</span></p>
      <p>שותף ב<a class="link" href="https://www.ar-fo.co.il" target="_blank" rel="noopener">ארביטראז'</a>, פירמת שותפים לניהול פיננסי · רישיון סוכן פנסיוני 00117164</p>
      <p class="foot-disclaimer">המידע באתר אינו ייעוץ השקעות או ייעוץ פנסיוני אישי · 2026</p>
    </div>
    <a class="tile tile-gold foot-phone" href="tel:0528089808"><span dir="ltr">052-8089808</span><small>להתקשר</small></a>
    <div class="tile tile-slate foot-links">
      <a class="link" href="mailto:roeir@ar-fo.co.il">roeir@ar-fo.co.il</a>
      <a class="link" href="https://wa.me/972528089808" target="_blank" rel="noopener">וואטסאפ</a>
      <a class="link" href="https://www.tiktok.com/@roeiromano" target="_blank" rel="noopener">טיקטוק</a>
    </div>
  </div>
  <div class="foot-meta">
    <p class="foot-legal"><a class="link" href="/privacy">מדיניות פרטיות</a> · <a class="link" href="/terms">תנאי שימוש</a> · <a class="link" href="/accessibility">הצהרת נגישות</a> · <a class="link" href="/disclosure">גילוי נאות</a> · <a class="link" href="#" data-cookie-settings>הגדרות עוגיות</a> · <a class="link" href="#top">לראש הדף</a></p>
  </div>
</footer>

<script src="${root}js/site.js" defer></script>
<script src="${root}js/consent.js" data-root="${root}" defer></script>
<script src="${root}js/year-end.js" defer></script>
<script src="${root}js/reviews.js" data-review-page="${esc(page)}" defer></script>
</body>
</html>
`;
}

const PERSON = { '@type': 'Person', name: 'רועי רומנו', jobTitle: 'מתכנן פיננסי', url: SITE + '/' };

// Bars are a real table (readable by screen readers), drawn as bars by CSS. Negative values point the other way.
function figure(f) {
  const rows = parseRows(f.rows);
  const unit = esc(f.unit || '');
  const meta = `<p class="rv-fig-src">נכון ל־${esc(hebrewDate(f.asOf))}. מקור הנתונים: ${esc(f.source)}.</p>`;
  if (f.type === 'table') {
    const [headRow, ...body] = rows;
    return `<figure class="rv-fig">
  <figcaption class="rv-fig-cap">${esc(f.title)}</figcaption>
  <div class="rv-table-wrap" tabindex="0" role="region" aria-label="${esc(f.title)}"><table class="rv-table">
    <thead><tr>${headRow.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${body.map(r => `<tr>${headRow.map((_, i) => i === 0 ? `<th scope="row">${esc(r[i] ?? '')}</th>` : `<td dir="auto">${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  ${meta}
</figure>`;
  }
  const values = rows.map(r => parseNumber(r[1]));
  const max = Math.max(...values.map(Math.abs), 0.0001);
  const hasNeg = values.some(v => v < 0);
  return `<figure class="rv-fig">
  <figcaption class="rv-fig-cap">${esc(f.title)}</figcaption>
  <table class="rv-bars${hasNeg ? ' has-neg' : ''}">
    <thead class="visually-hidden"><tr><th scope="col">שם</th><th scope="col">ערך${unit ? ` (${unit})` : ''}</th></tr></thead>
    <tbody>${rows.map((r, i) => {
      const v = values[i];
      const shown = (v > 0 && hasNeg ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('he-IL', { maximumFractionDigits: 2 }) + (f.unit || '');
      const bar = `<span class="rv-bar" style="--w:${(Math.abs(v) / max * 100).toFixed(1)}%"></span>`, val = `<span class="rv-val" dir="ltr">${esc(shown)}</span>`;
      // with losses, each row has two halves around a middle line: gains grow to the right of it, losses to the left
      const cell = !hasNeg ? bar + val : v < 0 ? `<span class="rv-half"></span><span class="rv-half">${bar}${val}</span>` : `<span class="rv-half">${val}${bar}</span><span class="rv-half"></span>`;
      return `<tr class="${v < 0 ? 'is-neg' : 'is-pos'}"><th scope="row">${esc(r[0])}</th><td>${cell}</td></tr>`;
    }).join('')}</tbody>
  </table>
  ${meta}
</figure>`;
}

function shareBlock(r) {
  const url = reviewUrl(r.id);
  const text = `${pageTitle(r)}: ${r.title}\n${url}`;
  return `<div class="art-share">
        <p>מכירים מישהו שזה יכול לעניין?</p>
        <div class="rv-share-actions">
          <a class="button button-line-ink" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" data-count="share:review-${r.id}">${WA_ICON}לשתף בוואטסאפ</a>
          <button type="button" class="button button-line-ink rv-copy" data-copy="${esc(url)}" data-count-copy="review:copy-${r.id}">${LINK_ICON}<span>להעתיק קישור</span></button>
        </div>
        <p class="rv-copied visually-hidden" role="status" aria-live="polite"></p>
      </div>`;
}

export function renderReviewPage(r, { prev = null, next = null, preview = false } = {}) {
  const root = '../';
  const month = monthLabel(r.id);
  const h1 = pageTitle(r);
  const url = reviewUrl(r.id);
  const minutes = readingMinutes(r);
  const description = (r.metaDescription || '').trim() || `${h1}: ${r.title}. ${r.summary}`.slice(0, 158);
  const title = (r.seoTitle || '').trim() || `${h1}: ${r.title} | רועי רומנו`;
  const items = (r.meaning?.items || []).filter(i => i.text?.trim());
  const sections = (r.sections || []).filter(s => s.heading?.trim() && s.text?.trim());
  const angle = r.angle?.approved && r.angle.text?.trim() ? r.angle.text : '';
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Article', headline: `${h1}: ${r.title}`.slice(0, 110), description,
      datePublished: r.publishedAt, dateModified: r.updatedAt || r.publishedAt, inLanguage: 'he', image: [SITE + r.cover.src],
      author: PERSON, publisher: { '@type': 'Organization', name: 'רועי רומנו, מתכנן פיננסי', logo: { '@type': 'ImageObject', url: SITE + '/assets/img/roei-romano-logo.png' } },
      mainEntityOfPage: url, articleSection: 'סקירות שוק ההון',
      isBasedOn: { '@type': 'CreativeWork', name: r.source.title || `סקירת שוק ההון של ${r.source.name}`, datePublished: r.source.date, publisher: { '@type': 'Organization', name: r.source.name } },
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: "ארביטראז' של ידע", item: SITE + '/knowledge' },
      { '@type': 'ListItem', position: 2, name: 'סקירות שוק ההון', item: SITE + '/market-reviews' },
      { '@type': 'ListItem', position: 3, name: month, item: url },
    ] },
  ];

  return head({ title, description, canonical: url, image: r.cover.src, type: 'article', root, jsonLd, preview }) + `
<main>
<article class="rv">
  <header class="wrap art-head rv-head">
    <div class="art-col">
      <nav class="rv-crumbs" aria-label="פירורי לחם"><ol><li><a class="link" href="/knowledge">ארביטראז' של ידע</a></li><li><a class="link" href="/market-reviews">סקירות שוק ההון</a></li><li aria-current="page">${esc(month)}</li></ol></nav>
      <p class="rv-kicker">סקירה חודשית</p>
      <h1 class="art-title rv-title">${esc(h1)}</h1>
      <p class="art-standfirst">${esc(r.title)}</p>
      <div class="art-byline">
        <img src="${root}assets/img/roei-2.jpg" width="720" height="853" alt="רועי רומנו">
        <p><strong>רועי רומנו, מתכנן פיננסי</strong> פורסם ב־<time datetime="${esc(r.publishedAt)}">${esc(hebrewDate(r.publishedAt) || 'טרם פורסם')}</time> · ${minutes} דקות קריאה · על בסיס סקירת שוק ההון של ${esc(r.source.name)}</p>
      </div>
    </div>
  </header>

  <figure class="wrap rv-cover"><img src="${esc(r.cover.src.replace(/^\//, root))}" alt="${esc(r.cover.alt)}" width="1600" height="900" fetchpriority="high"></figure>

  <div class="wrap art-body">
    <div class="art-col prose">
      <section class="rv-brief" aria-labelledby="rv-brief-h">
        <h2 id="rv-brief-h">בקצרה</h2>
        ${prose(r.summary)}
        <ul class="rv-points">${(r.highlights || []).filter(h => h.trim()).map(h => `<li>${inline(h)}</li>`).join('')}</ul>
      </section>

      <h2 id="markets">מה קרה החודש בשווקים?</h2>
      ${sections.map((s, i) => `<section class="rv-sec" aria-labelledby="rv-s${i + 1}">
        <p class="rv-sec-k">${esc(SECTION_KINDS[s.kind] || '')}</p>
        <h3 id="rv-s${i + 1}">${esc(s.heading)}</h3>
        ${prose(s.text)}
        ${(s.figures || []).map(figure).join('\n')}
      </section>`).join('\n')}
${items.length ? `
      <section class="rv-meaning" aria-labelledby="rv-meaning-h">
        <h2 id="rv-meaning-h">מה זה אומר על החיסכון וההשקעות שלנו?</h2>
        ${prose(r.meaning.intro)}
        <div class="rv-products">${items.map(i => `<div class="rv-product">
          <h3>${esc(PRODUCTS[i.key].name)}</h3>
          ${prose(i.text)}${PRODUCTS[i.key].href ? `<a class="link rv-product-go" href="${PRODUCTS[i.key].href}">למדריך ${esc(PRODUCTS[i.key].name.replace(/^קופות גמל/, 'קופת גמל').replace(/^פוליסות/, 'פוליסת'))}</a>` : ''}
        </div>`).join('')}</div>
        <p class="rv-general">ההסברים כלליים ואינם מתייחסים למצב האישי של אף אחד. ההתאמה של מסלול או מוצר נבדקת לפי המטרות, טווח ההשקעה ורמת הסיכון של כל אחד.</p>
      </section>` : ''}
${angle ? `
      <section class="rv-angle" aria-labelledby="rv-angle-h">
        <img src="${root}assets/img/roei-3.jpg" width="96" height="96" alt="">
        <div>
          <h2 id="rv-angle-h">הזווית שלי | רועי רומנו</h2>
          ${prose(angle)}
        </div>
      </section>` : ''}

      <p class="art-note rv-credit">הסקירה מבוססת על סקירת שוק ההון של ${esc(r.source.name)}${r.source.title ? ` ("${esc(r.source.title)}")` : ''} מ־${esc(hebrewDate(r.source.date))}, בעריכה ובעיבוד של רועי רומנו, ומובאת באישור. ${r.source.note ? esc(r.source.note) + ' ' : ''}הנתונים נכונים לתאריכים שצוינו לצדם. המידע כללי, אינו ייעוץ השקעות, ייעוץ פנסיוני או שיווק השקעות, ואינו תחליף לייעוץ המותאם לנתונים ולצרכים של כל אדם. תשואות עבר אינן מבטיחות תשואות בעתיד. כסוכן פנסיוני אני עשוי לקבל עמלות מחברות ביטוח ומגופים מוסדיים, הפרטים ב<a class="link" href="/disclosure">גילוי הנאות</a>.</p>

      ${shareBlock(r)}
${prev || next ? `
      <nav class="rv-pager" aria-label="סקירות נוספות">
        ${next ? `<a class="rv-pager-link" href="/market-reviews/${next.id}" rel="next"><small>הסקירה הבאה</small><strong>${esc(monthLabel(next.id))}</strong></a>` : '<span></span>'}
        ${prev ? `<a class="rv-pager-link is-prev" href="/market-reviews/${prev.id}" rel="prev"><small>הסקירה הקודמת</small><strong>${esc(monthLabel(prev.id))}</strong></a>` : '<span></span>'}
      </nav>` : ''}
      <p class="rv-all"><a class="link" href="/market-reviews">לכל סקירות שוק ההון</a></p>
    </div>
  </div>
${(r.related || []).length ? `
  <section class="wrap rv-related" aria-labelledby="rv-related-h">
    <h2 id="rv-related-h" class="kn-title">כדאי לקרוא גם</h2>
    <div class="kn-grid rv-related-grid">${r.related.map(h => `<a class="kn-card" href="${h}"><span class="kn-text"><span class="kn-k">${esc(RELATED[h].k)}</span><strong>${esc(RELATED[h].title)}</strong><small>${esc(RELATED[h].text)}</small></span><span class="kn-go" aria-hidden="true">←</span></a>`).join('')}</div>
  </section>` : ''}
</article>

<section class="art-cta rv-cta">
  <div class="wrap">
    <div class="art-col">
      <h2 class="h-small">רוצים להבין איך ההתפתחויות בשווקים קשורות לחיסכון ולהשקעות שלכם?</h2>
      <p class="statement">כל החלטה פיננסית צריכה להתבסס על המטרות שלכם, טווח ההשקעה ורמת הסיכון המתאימה לכם. אפשר לפנות אליי לבחינת התמונה הפיננסית האישית.</p>
      <a class="button button-ink art-cta-btn" href="https://wa.me/972528089808?text=${encodeURIComponent(contactText(r))}" target="_blank" rel="noopener" data-count="review:cta-${r.id}">${WA_ICON}לשיחה עם רועי</a>
    </div>
  </div>
</section>
</main>
` + foot(root, r.id);
}

function card(r, { featured = false } = {}) {
  const month = monthLabel(r.id);
  const year = r.id.slice(0, 4);
  const topics = (r.topics || []).filter(t => t.trim());
  if (featured) {
    return `<article class="rv-feature">
      <img class="rv-feature-img" src="${esc(r.cover.src.replace(/^\//, ''))}" alt="${esc(r.cover.alt)}" width="1600" height="900">
      <div class="rv-feature-text">
        <p class="rv-kicker">הסקירה האחרונה · ${esc(month)}</p>
        <h2 class="rv-feature-title"><a href="/market-reviews/${r.id}">${esc(r.title)}</a></h2>
        <p class="rv-feature-sum">${esc(r.summary.length > 260 ? r.summary.slice(0, 257).replace(/\s+\S*$/, '') + '…' : r.summary)}</p>
        <ul class="rv-topics" aria-label="נושאים מרכזיים">${topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="rv-meta">${readingMinutes(r)} דקות קריאה · פורסם ב־${esc(hebrewDate(r.publishedAt))}</p>
        <a class="button button-ink" href="/market-reviews/${r.id}">לקריאת הסקירה<span class="visually-hidden"> של ${esc(month)}</span></a>
      </div>
    </article>`;
  }
  return `<a class="kn-card rv-card" href="/market-reviews/${r.id}" data-year="${year}" data-tags="${esc((r.tags || []).join(' '))}">
        <span class="kn-text"><span class="kn-k">${esc(month)}</span><strong>${esc(r.title)}</strong><small>${esc(topics.join(' · '))}</small></span>
        <span class="kn-go" aria-hidden="true">←</span>
      </a>`;
}

// reviews: the published ones, newest first.
export function renderHub(reviews) {
  const root = '';
  const url = SITE + '/market-reviews';
  const [latest, ...older] = reviews;
  const years = [...new Set(older.map(r => r.id.slice(0, 4)))];
  const description = 'סקירה חודשית של שוקי ההון בישראל ובעולם: מה קרה בשווקים, ומה זה אומר על הפנסיה, קרן ההשתלמות, קופות הגמל והחסכונות שלנו. מאת רועי רומנו, מתכנן פיננסי.';
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'סקירות שוק ההון', description, url, inLanguage: 'he', author: PERSON,
      mainEntity: { '@type': 'ItemList', itemListElement: reviews.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: reviewUrl(r.id), name: `${pageTitle(r)}: ${r.title}` })) } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: "ארביטראז' של ידע", item: SITE + '/knowledge' },
      { '@type': 'ListItem', position: 2, name: 'סקירות שוק ההון', item: url },
    ] },
  ];
  return head({ title: 'סקירות שוק ההון – Romano Invest | רועי רומנו מתכנן פיננסי', description, canonical: url, image: latest ? latest.cover.src : '/assets/tase-board.jpg', type: 'website', root, jsonLd }) + `
<main class="rv-hub">
  <header class="wrap art-head kn-head">
    <div class="art-col">
      <nav class="rv-crumbs" aria-label="פירורי לחם"><ol><li><a class="link" href="/knowledge">ארביטראז' של ידע</a></li><li aria-current="page">סקירות שוק ההון</li></ol></nav>
      <h1 class="art-title">סקירות שוק ההון – Romano Invest</h1>
      <p class="art-standfirst">מדי חודש אני מרכז עבורכם את ההתפתחויות המרכזיות בשוקי ההון בישראל ובעולם, ומסביר מה חשוב לדעת על החסכונות וההשקעות שלנו.</p>
    </div>
  </header>

  <div class="wrap">
    ${latest ? card(latest, { featured: true }) : `<p class="rv-empty">הסקירה הראשונה תעלה כאן בקרוב.</p>`}
  </div>
${older.length ? `
  <section class="wrap rv-archive" aria-labelledby="rv-archive-h">
    <div class="rv-archive-head">
      <h2 id="rv-archive-h" class="kn-title">ארכיון הסקירות</h2>
      ${years.length > 1 ? `<div class="rv-years" role="group" aria-label="סינון לפי שנה" hidden>
        <button type="button" class="rv-year" aria-pressed="true" data-year="">הכול</button>
        ${years.map(y => `<button type="button" class="rv-year" aria-pressed="false" data-year="${y}">${y}</button>`).join('')}
      </div>` : ''}
    </div>
    <div class="kn-grid rv-archive-grid">
      ${older.map(r => card(r)).join('\n      ')}
    </div>
    <p class="rv-filter-status visually-hidden" role="status" aria-live="polite"></p>
  </section>` : ''}

  <section class="art-cta">
    <div class="wrap">
      <div class="art-col">
        <p class="statement">הסקירה מסבירה מה קרה. בשיחה נבדוק מה זה אומר בשבילכם.</p>
        <a class="button button-ink art-cta-btn" href="/#contact">לשיחת היכרות ללא עלות</a>
      </div>
    </div>
  </section>
</main>
` + foot(root, 'hub');
}

// The hub card on /knowledge points here; sitemap paths for the build.
export const sitemapPaths = (reviews) => ['market-reviews', ...reviews.map(r => reviewPath(r.id).slice(1))];
