// Admin page for the monthly market reviews (/admin). Two modes:
// - server: behind Cloudflare Access, drafts in KV and "פרסום באתר" commits the review to GitHub (functions/api/admin);
// - local: when the server is not connected yet, drafts stay in this browser and a review is downloaded as a file.
// The page holds no keys. Every review is normalised and validated by the same model the build uses.
import * as M from './model.mjs';
import { renderReviewPage, esc } from './render.mjs';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const state = { mode: 'local', status: null, review: null, dirty: false, tab: 'source' };
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  keys: (prefix) => { try { return Object.keys(localStorage).filter(k => k.startsWith(prefix)); } catch { return []; } },
};
const STATUS_HE = { draft: 'טיוטה', approved: 'מאושרת, טרם פורסמה', published: 'פורסמה' };

// ---------- paths: "sections.0.figures.1.title" ----------
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }

// ---------- connection ----------
async function detect() {
  const el = $('#ad-mode');
  try {
    const res = await fetch('/api/admin/status', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    const ct = res.headers.get('Content-Type') || '';
    if (res.ok && ct.includes('json')) {
      state.status = await res.json();
      state.mode = state.status.drafts ? 'server' : 'local';
    } else state.reason = res.status === 503 ? 'השרת עוד לא חובר ל־Cloudflare Access' : res.status === 401 || res.status === 403 ? 'אין הרשאה' : 'אין שרת ניהול בכתובת הזו';
  } catch { state.reason = 'אין חיבור לשרת'; }
  el.textContent = state.mode === 'server'
    ? `מחובר${state.status.email ? ' כ־' + state.status.email : ''} · טיוטות נשמרות בשרת${state.status.publish ? ' · פרסום פעיל' : ' · פרסום עוד לא חובר'}`
    : `מצב מקומי (${state.reason || 'אין אחסון בשרת'}): הטיוטות נשמרות בדפדפן הזה בלבד`;
  el.dataset.mode = state.mode;
}

async function api(method, path, body) {
  const res = await fetch('/api/admin/' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data };
}

// ---------- list ----------
async function loadList() {
  let items = [];
  if (state.mode === 'server') {
    const { ok, data } = await api('GET', 'reviews');
    if (ok) items = data.reviews;
  } else {
    items = ls.keys('rv-draft:').map(k => JSON.parse(ls.get(k))).filter(Boolean).map(r => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt }));
  }
  items.sort((a, b) => b.id.localeCompare(a.id));
  $('#ad-items').innerHTML = items.length ? items.map(r => `<li class="ad-item">
      <div><strong>${esc(M.monthLabel(r.id))}</strong><span>${esc(r.title || (r.onlyOnSite ? 'באתר' : 'ללא כותרת'))}</span></div>
      <span class="ad-badge" data-status="${esc(r.status)}">${esc(STATUS_HE[r.status] || r.status)}${r.live && r.status !== 'published' ? ' · גרסה קודמת באתר' : ''}</span>
      <button type="button" class="button button-ink" data-open="${esc(r.id)}">עריכה</button>
    </li>`).join('') : '<li class="ad-empty">אין עדיין סקירות. בחרו חודש והוסיפו סקירה חדשה.</li>';
}

// ---------- open / new ----------
function prepare(r) {
  r = M.normalize(r);
  while (r.highlights.length < 5) r.highlights.push('');
  while (r.topics.length < 3) r.topics.push('');
  return r;
}
async function open(id) {
  let r = null;
  if (state.mode === 'server') {
    const { ok, data } = await api('GET', 'reviews/' + id);
    if (ok) r = data.review;
  } else r = JSON.parse(ls.get('rv-draft:' + id) || 'null');
  const backup = JSON.parse(ls.get('rv-backup:' + id) || 'null');
  if (backup && (!r || (backup.savedAt || '') > (r.updatedAt || '')) && backup.review && confirm('נמצאה בדפדפן הזה עריכה שלא נשמרה לסקירה הזו. לשחזר אותה?')) r = backup.review;
  edit(prepare(r || M.emptyReview(id)));
}
function edit(r) {
  state.review = r; state.dirty = false;
  $('#ad-list').hidden = true; $('#ad-edit').hidden = false;
  $('#ad-edit-h').textContent = M.pageTitle(r);
  buildStatic(); fillAll(); refresh(); selectTab('source');
  window.scrollTo(0, 0);
}

// ---------- editors that are drawn from the data ----------
function buildStatic() {
  const r = state.review;
  $('#ad-highlights').innerHTML = r.highlights.map((_, i) => `<input data-path="highlights.${i}" aria-label="נקודה ${i + 1}" maxlength="220" placeholder="${i < 3 ? 'חובה' : 'לא חובה'}">`).join('');
  $('#ad-cover').innerHTML = Object.entries(M.COVERS).map(([src, alt]) => `<option value="${esc(src)}">${esc(alt)}</option>`).join('');
  $('#ad-add-kind').innerHTML = Object.entries(M.SECTION_KINDS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
  $('#ad-products').innerHTML = Object.entries(M.PRODUCTS).map(([k, p]) => `<label class="ad-field"><span>${esc(p.name)}</span><textarea data-product="${k}" rows="4"></textarea></label>`).join('');
  $('#ad-related').innerHTML = Object.entries(M.RELATED).map(([h, x]) => `<label class="ad-check"><input type="checkbox" data-related="${esc(h)}"> ${esc(x.title)} <small>(${esc(h)})</small></label>`).join('');
  buildSections();
}
function buildSections() {
  const r = state.review;
  $('#ad-sections').innerHTML = r.sections.map((s, i) => `<fieldset class="ad-sec">
    <legend>${esc(M.SECTION_KINDS[s.kind] || 'נושא')} <small>(${i + 1})</small></legend>
    <div class="ad-sec-tools">
      <button type="button" class="ad-mini" data-act="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="להזיז למעלה">↑</button>
      <button type="button" class="ad-mini" data-act="down" data-i="${i}" ${i < r.sections.length - 1 ? '' : 'disabled'} aria-label="להזיז למטה">↓</button>
      <button type="button" class="ad-mini ad-danger" data-act="remove" data-i="${i}">הסרה</button>
    </div>
    <div class="ad-grid">
      <label class="ad-field"><span>תחום</span><select data-path="sections.${i}.kind">${Object.entries(M.SECTION_KINDS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
      <label class="ad-field"><span>כותרת</span><input data-path="sections.${i}.heading" maxlength="100"></label>
    </div>
    <label class="ad-field ad-wide"><span>טקסט</span><textarea data-path="sections.${i}.text" rows="6"></textarea></label>
    <div class="ad-grid">
      <label class="ad-field"><span>בסיס המידע</span><select data-path="sections.${i}.basis"><option value="source">מופיע בסקירה המקורית</option><option value="verified">אומת ממקור מוסמך אחר</option></select></label>
      <label class="ad-field"><span>${s.basis === 'verified' ? 'שם המקור המוסמך (חובה)' : 'עמוד בסקירה המקורית'}</span><input data-path="sections.${i}.ref" placeholder="${s.basis === 'verified' ? 'למשל: בנק ישראל, הודעת הריבית מ־24.11' : 'למשל: עמוד 3'}"></label>
    </div>
    ${s.figures.map((f, j) => `<div class="ad-fig">
      <p class="ad-fig-h">${f.type === 'table' ? 'טבלה' : 'גרף עמודות'} ${j + 1} <button type="button" class="ad-mini ad-danger" data-act="rmfig" data-i="${i}" data-j="${j}">הסרה</button></p>
      <div class="ad-grid">
        <label class="ad-field"><span>כותרת</span><input data-path="sections.${i}.figures.${j}.title"></label>
        ${f.type === 'bars' ? `<label class="ad-field"><span>יחידה</span><input data-path="sections.${i}.figures.${j}.unit" maxlength="6" placeholder="%"></label>` : ''}
        <label class="ad-field"><span>נכון לתאריך</span><input type="date" data-path="sections.${i}.figures.${j}.asOf"></label>
        <label class="ad-field"><span>מקור הנתונים</span><input data-path="sections.${i}.figures.${j}.source" placeholder="למשל: ארביטראז', עמוד 4"></label>
      </div>
      <label class="ad-field ad-wide"><span>${f.type === 'table' ? 'שורות: הראשונה כותרות, תאים מופרדים ב־|' : 'שורה לכל עמודה: שם | מספר'}</span><textarea data-path="sections.${i}.figures.${j}.rows" rows="5" dir="auto" placeholder="${f.type === 'table' ? 'מדד | תשואה בחודש | מתחילת השנה' : 'ת"א 35 | 2.4'}"></textarea></label>
    </div>`).join('')}
    <div class="ad-row">
      <button type="button" class="ad-mini" data-act="addbars" data-i="${i}">+ גרף עמודות</button>
      <button type="button" class="ad-mini" data-act="addtable" data-i="${i}">+ טבלה</button>
    </div>
  </fieldset>`).join('') || '<p class="ad-help">עוד אין נושאים. בחרו תחום והוסיפו.</p>';
  fillAll($('#ad-sections'));
}

function fillAll(scope = document) {
  const r = state.review;
  $$('[data-path]', scope).forEach(el => {
    const v = getPath(r, el.dataset.path);
    if (el.type === 'checkbox') el.checked = v === true; else el.value = v ?? '';
  });
  if (scope === document) {
    $$('[data-product]').forEach(el => { el.value = (r.meaning.items.find(i => i.key === el.dataset.product) || {}).text || ''; });
    $$('[data-related]').forEach(el => { el.checked = r.related.includes(el.dataset.related); });
  }
}

// ---------- changes ----------
let backupTimer, previewTimer;
function changed() {
  state.dirty = true;
  $('#ad-saved').textContent = 'יש שינויים שלא נשמרו';
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => ls.set('rv-backup:' + state.review.id, JSON.stringify({ savedAt: new Date().toISOString(), review: state.review })), 600);
  refresh();
}
function refresh() {
  const r = state.review;
  $('#ad-status').textContent = 'סטטוס: ' + (STATUS_HE[r.status] || r.status) + (r.publishedAt ? ` · פורסמה לראשונה ב־${M.hebrewDate(r.publishedAt)}` : '');
  // SEO counters and a search result preview
  const title = r.seoTitle.trim() || `${M.pageTitle(r)}: ${r.title} | רועי רומנו`;
  const desc = r.metaDescription.trim() || `${M.pageTitle(r)}: ${r.title}. ${r.summary}`.slice(0, 158);
  $$('[data-count-for]').forEach(el => { const n = (r[el.dataset.countFor] || '').length; el.textContent = n ? `(${n} תווים)` : '(ריק: ייבנה אוטומטית)'; });
  $('#ad-serp-url').textContent = M.reviewUrl(r.id).replace('https://', '').replace('/market-reviews/', ' › market-reviews › ');
  $('#ad-serp-title').textContent = title.length > 62 ? title.slice(0, 60) + '…' : title;
  $('#ad-serp-desc').textContent = desc.length > 158 ? desc.slice(0, 156) + '…' : desc;
  // Noam
  const msg = $('#ad-noam-msg');
  if (document.activeElement !== msg) msg.value = M.noamMessage(r);
  $('#ad-snips').innerHTML = [['כותרת קצרה', `${M.pageTitle(r)}: ${r.title}`], ['תקציר (עד שלושה משפטים)', M.teaser(r)], ['קישור ישיר', M.reviewUrl(r.id)]]
    .map(([k, v], i) => `<div><dt>${esc(k)}</dt><dd><span id="snip-${i}">${esc(v)}</span> <button type="button" class="ad-mini" data-copy-from="snip-${i}">העתקה</button></dd></div>`).join('');
  $('#ad-links').innerHTML = Object.entries(M.CHANNELS).map(([k, c]) => `<div><dt>${esc(c.name)}</dt><dd><span id="lnk-${k}" dir="ltr">${esc(M.utmLink(r.id, k))}</span> <button type="button" class="ad-mini" data-copy-from="lnk-${k}">העתקה</button></dd></div>`).join('');
  // checks
  const { errors, warnings } = M.validate({ ...r, publishedAt: r.publishedAt || today() }, { forPublish: true });
  $('#ad-checks').innerHTML = (errors.length ? `<p class="ad-bad">לפני פרסום צריך לתקן:</p><ul>${errors.map(e => `<li class="ad-bad">${esc(e)}</li>`).join('')}</ul>` : '<p class="ad-good">כל בדיקות הפרסום עברו.</p>')
    + (warnings.length ? `<p>לתשומת לב:</p><ul>${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '');
  const blockers = errors.filter(e => !e.includes('בדקתי ואישרתי'));
  $('#ad-mark').disabled = !!blockers.length || !r.approval.content;
  $('#ad-publish').disabled = state.mode !== 'server' || !state.status?.publish || !!errors.length || r.status !== 'approved' || state.dirty;
  $('#ad-publish-help').textContent = state.mode !== 'server' ? 'במצב מקומי אין פרסום ישיר: מורידים את הקובץ, והוא נכנס לאתר דרך GitHub (business-site/content/market-reviews). ' :
    !state.status?.publish ? 'הפרסום הישיר עוד לא חובר (חסר מפתח GitHub בהגדרות Cloudflare). אפשר להוריד את הקובץ. ' :
    r.status !== 'approved' || state.dirty ? 'כדי לפרסם: מסמנים את האישור, שומרים כמאושר, ואז "פרסום באתר". ' : 'הסקירה מוכנה. הפרסום יוצר עדכון באתר, שעולה תוך כשתי דקות. ';
  if (state.tab === 'preview') { clearTimeout(previewTimer); previewTimer = setTimeout(drawPreview, 250); }
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

function drawPreview() {
  const r = M.normalize(state.review);
  r.publishedAt = r.publishedAt || today();
  // the preview frame runs no scripts (sandboxed), so they are left out
  $('#ad-frame').srcdoc = renderReviewPage(r, { preview: location.origin + '/market-reviews/' }).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
}

document.addEventListener('input', onField);
document.addEventListener('change', onField);
function onField(e) {
  const el = e.target;
  if (!state.review || !$('#ad-form').contains(el)) return;
  const r = state.review;
  if (el.dataset.path) {
    setPath(r, el.dataset.path, el.type === 'checkbox' ? el.checked : el.value);
    if (/^sections\.\d+\.(kind|basis)$/.test(el.dataset.path) && e.type === 'change') buildSections();
    if (el.dataset.path === 'cover.src') r.cover.alt = M.COVERS[el.value] || '';
    if (el.dataset.path === 'approval.content') { r.approval.at = el.checked ? new Date().toISOString() : ''; if (!el.checked && r.status === 'approved') r.status = 'draft'; }
  } else if (el.dataset.product) {
    const items = r.meaning.items.filter(i => i.key !== el.dataset.product);
    if (el.value.trim()) items.push({ key: el.dataset.product, text: el.value });
    r.meaning.items = Object.keys(M.PRODUCTS).map(k => items.find(i => i.key === k)).filter(Boolean);
  } else if (el.dataset.related) {
    r.related = Object.keys(M.RELATED).filter(h => (h === el.dataset.related ? el.checked : r.related.includes(h)));
  } else if (el.id === 'ad-noam-msg') {
    r.noam.message = el.value.trim() === M.noamMessage({ ...r, noam: { ...r.noam, message: '' } }) ? '' : el.value;
  } else return;
  // an approved review that changes goes back to draft until approved again
  if (r.status === 'approved' && el.dataset.path !== 'approval.content') r.status = 'draft';
  changed();
}

// ---------- buttons ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button, [data-open]');
  if (!b) return;
  const r = state.review;
  if (b.dataset.open) return open(b.dataset.open);
  if (b.dataset.copyFrom) return copy(b, ($('#' + b.dataset.copyFrom).value ?? $('#' + b.dataset.copyFrom).textContent));
  if (b.dataset.act) {
    const i = Number(b.dataset.i);
    const s = r.sections;
    if (b.dataset.act === 'up') [s[i - 1], s[i]] = [s[i], s[i - 1]];
    if (b.dataset.act === 'down') [s[i + 1], s[i]] = [s[i], s[i + 1]];
    if (b.dataset.act === 'remove' && confirm('להסיר את הנושא הזה?')) s.splice(i, 1);
    if (b.dataset.act === 'addbars') s[i].figures.push(M.emptyFigure('bars'));
    if (b.dataset.act === 'addtable') s[i].figures.push(M.emptyFigure('table'));
    if (b.dataset.act === 'rmfig' && confirm('להסיר את הגרף או הטבלה?')) s[i].figures.splice(Number(b.dataset.j), 1);
    buildSections(); changed(); return;
  }
  switch (b.id) {
    case 'ad-back': if (!state.dirty || confirm('יש שינויים שלא נשמרו. לצאת בכל זאת?')) { state.review = null; state.dirty = false; $('#ad-edit').hidden = true; $('#ad-list').hidden = false; loadList(); } break;
    case 'ad-add-section': r.sections.push(M.emptySection($('#ad-add-kind').value)); buildSections(); changed(); break;
    case 'ad-save': await save(); break;
    case 'ad-mark': r.status = 'approved'; await save(); break;
    case 'ad-publish': await publish(); break;
    case 'ad-download': download(); break;
    case 'ad-noam-reset': r.noam.message = ''; $('#ad-noam-msg').value = M.noamMessage(r); changed(); break;
  }
  if (b.classList.contains('ad-seg-b')) {
    $$('.ad-seg-b').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#ad-frame').style.width = b.dataset.width ? b.dataset.width + 'px' : '';
  }
});

async function save() {
  const r = state.review;
  const btn = $('#ad-save');
  btn.disabled = true;
  try {
    if (state.mode === 'server') {
      const { ok, data } = await api('PUT', 'reviews/' + r.id, r);
      if (!ok) throw new Error(data.error || 'שגיאה');
      state.review = prepare(data.review);
    } else {
      const n = M.normalize(r);
      n.status = r.status === 'approved' && n.approval.content && !M.validate(n).errors.length ? 'approved' : 'draft';
      n.updatedAt = today();
      if (!ls.set('rv-draft:' + r.id, JSON.stringify(n))) throw new Error('הדפדפן לא מאפשר שמירה');
      state.review = prepare(n);
    }
    state.dirty = false;
    $('#ad-saved').textContent = 'נשמר ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    fillAll(); refresh();
  } catch (err) {
    $('#ad-saved').textContent = 'השמירה נכשלה: ' + err.message;
  } finally { btn.disabled = false; }
}

async function publish() {
  const r = state.review;
  if (!confirm(`לפרסם באתר את ${M.pageTitle(r)}?\nהסקירה תופיע באתר ובמפת האתר תוך כשתי דקות.`)) return;
  const out = $('#ad-publish-result');
  out.textContent = 'מפרסם…';
  const { ok, data } = await api('POST', 'publish/' + r.id);
  if (!ok) { out.innerHTML = 'הפרסום לא בוצע:<br>' + (data.errors || [data.error]).map(esc).join('<br>'); return; }
  state.review = prepare(data.review); fillAll(); refresh();
  out.innerHTML = `נשלח לפרסום. בעוד כשתי דקות הסקירה תהיה בכתובת <a class="link" href="${esc(data.url)}" target="_blank" rel="noopener">${esc(data.url)}</a>. עכשיו אפשר לעבור ללשונית "נועם והפצה".`;
}

function download() {
  const r = M.normalize(state.review);
  const ready = r.status === 'approved' && !M.validate({ ...r, publishedAt: r.publishedAt || today(), status: 'published' }, { forPublish: true }).errors.length;
  if (ready) { r.publishedAt = r.publishedAt || today(); r.updatedAt = today(); r.status = 'published'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2) + '\n'], { type: 'application/json' }));
  a.download = r.id + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('#ad-publish-result').textContent = ready ? 'הורד קובץ מוכן לפרסום (מאושר).' : 'הורד קובץ טיוטה. הוא לא יתפרסם עד שיאושר.';
}

async function copy(btn, text) {
  try { await navigator.clipboard.writeText(text); const t = btn.textContent; btn.textContent = 'הועתק'; setTimeout(() => { btn.textContent = t; }, 1600); }
  catch { prompt('להעתקה:', text); }
}

// ---------- tabs ----------
function selectTab(name) {
  state.tab = name;
  $$('.ad-tabs [role=tab]').forEach(t => { const on = t.id === 't-' + name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  $$('.ad-tab').forEach(p => { p.hidden = p.id !== 'p-' + name; });
  if (name === 'preview') drawPreview();
  if (name === 'stats') loadStats();
}
$('.ad-tabs').addEventListener('click', (e) => { const t = e.target.closest('[role=tab]'); if (t) selectTab(t.id.slice(2)); });
$('.ad-tabs').addEventListener('keydown', (e) => {
  const tabs = $$('.ad-tabs [role=tab]'); const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const step = { ArrowLeft: 1, ArrowRight: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
  if (step === undefined) return;
  e.preventDefault(); const t = tabs[(i + step + tabs.length) % tabs.length]; t.focus(); selectTab(t.id.slice(2));
});

async function loadStats() {
  const box = $('#ad-stats');
  if (state.mode !== 'server' || !state.status?.stats) { box.innerHTML = '<p class="ad-help">הנתונים זמינים כשאזור הניהול מחובר לשרת.</p>'; return; }
  const { ok, data } = await api('GET', 'stats');
  if (!ok) { box.textContent = 'לא הצלחתי לקרוא את הנתונים.'; return; }
  const t = data.reviews[state.review.id] || {};
  const rows = [['כניסות לסקירה', t.view], ['מוואטסאפ (נועם)', t['from-whatsapp']], ['מפייסבוק', t['from-facebook']], ['מאינסטגרם', t['from-instagram']], ['מטיקטוק', t['from-tiktok']], ['ממייל', t['from-email']], ['מקישור מדיד אחר', t['from-other']], ['לחיצות "לשיחה עם רועי"', t.cta], ['שיתופים בוואטסאפ', t.share], ['העתקות קישור', t.copy], ['כניסות לעמוד כל הסקירות (כל החודשים)', data.hub]];
  box.innerHTML = `<table class="ad-table"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${Number(v || 0).toLocaleString('he-IL')}</td></tr>`).join('')}</tbody></table>`;
}

// ---------- PDF: read in this browser only ----------
$('#ad-pdf').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const status = $('#ad-pdf-status');
  if (!file) return;
  if (file.size > 40 * 1024 * 1024) { status.textContent = 'הקובץ גדול מדי (עד 40MB)'; return; }
  status.textContent = 'קורא את הקובץ…';
  try {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = '', lastY;
      for (const item of content.items) {
        const y = item.transform && item.transform[5];
        if (lastY !== undefined && Math.abs(y - lastY) > 2) text += '\n';
        text += item.str + (item.hasEOL ? '\n' : '');
        lastY = y;
      }
      pages.push(`——— עמוד ${n} ———\n${text.replace(/\n{3,}/g, '\n\n').trim()}`);
    }
    $('#ad-pdf-text').value = pages.join('\n\n');
    status.textContent = `נקראו ${doc.numPages} עמודים. אם הטקסט נראה הפוך או חסר, אפשר להעתיק ישירות מה־PDF.`;
    if (!state.review.source.title) { state.review.source.title = file.name.replace(/\.pdf$/i, ''); fillAll(); changed(); }
  } catch (err) {
    status.textContent = 'לא הצלחתי לקרוא את הקובץ: ' + err.message;
  }
});
let pdfPromise;
function pdfjs() {
  // pdf.js from cdnjs, loaded only when a file is chosen; the PDF itself never leaves the browser
  pdfPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve(window.pdfjsLib); };
    s.onerror = () => { pdfPromise = null; reject(new Error('הרכיב לקריאת PDF לא נטען')); };
    document.head.append(s);
  });
  return pdfPromise;
}

// ---------- new and import ----------
$('#ad-new').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('#ad-new-month').value;
  if (!M.ID_RE.test(id)) return;
  open(id);
});
$('#ad-import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const r = M.normalize(JSON.parse(await f.text()));
    if (!M.ID_RE.test(r.id)) throw new Error('אין חודש תקין בקובץ');
    r.status = 'draft';
    edit(prepare(r)); changed();
  } catch (err) { alert('הקובץ לא נקרא: ' + err.message); }
  e.target.value = '';
});
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

await detect();
await loadList();
