// Roei Romano — shared on every page: skip link, cookie notice, accessibility menu.
// Choices are kept in localStorage only (no cookies). Pages set data-root on the script tag
// ("" on the home page, "../" one folder down) so links to the policy pages resolve.

(() => {
  const script = document.currentScript;
  const root = (script && script.dataset.root) || '';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: settings last for this visit */ } },
  };
  const html = document.documentElement;

  // ===== Skip link =====
  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'main';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#' + main.id;
    skip.textContent = 'דילוג לתוכן הראשי';
    document.body.prepend(skip);
  }

  // ===== A refresh always starts at the top of the page =====
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (nav && nav.type === 'reload') {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    const top = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    top();
    window.addEventListener('load', top);
  }

  // ===== Back-to-top arrow, shown once the visitor has scrolled =====
  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'to-top';
  up.setAttribute('aria-label', 'חזרה לראש העמוד');
  up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5l-7 7 1.4 1.4L11 8.8V20h2V8.8l4.6 4.6L19 12z"/></svg>';
  up.addEventListener('click', () => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || html.classList.contains('a11y-still');
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    const first = document.querySelector('.bar-brand, .brand');
    if (first) first.focus({ preventScroll: true });
  });
  document.body.append(up);
  const showUp = () => up.classList.toggle('is-on', window.scrollY > 400);
  window.addEventListener('scroll', showUp, { passive: true });
  showUp();

  // ===== Accessibility menu =====
  const OPTIONS = [
    ['a11y-text', 'הגדלת טקסט'],
    ['a11y-contrast', 'ניגודיות גבוהה'],
    ['a11y-gray', 'גווני אפור'],
    ['a11y-links', 'הדגשת קישורים'],
    ['a11y-font', 'גופן קריא'],
    ['a11y-still', 'עצירת אנימציות'],
  ];
  const saved = new Set((store.get('rr-a11y') || '').split(' ').filter(Boolean));
  const apply = () => {
    OPTIONS.forEach(([cls]) => html.classList.toggle(cls, saved.has(cls)));
    // animations drawn inside SVG images cannot be paused from the page: swap to the still version
    document.querySelectorAll('[data-still]').forEach((el) => {
      if (!el.dataset.moving) el.dataset.moving = el.getAttribute(el.tagName === 'SOURCE' ? 'srcset' : 'src');
      const src = saved.has('a11y-still') ? el.dataset.still : el.dataset.moving;
      el.setAttribute(el.tagName === 'SOURCE' ? 'srcset' : 'src', src);
    });
    store.set('rr-a11y', [...saved].join(' '));
  };

  const wrap = document.createElement('div');
  wrap.className = 'a11y';
  wrap.innerHTML = `
    <button type="button" class="a11y-toggle" aria-label="תפריט נגישות" aria-expanded="false" aria-controls="a11y-panel">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4.5" r="2.2"/><path d="M4 8.2l8 1.6 8-1.6.5 2-5.6 1.4v3.2l2.3 6.6-1.9.7-2.7-6.3h-1.2l-2.7 6.3-1.9-.7 2.3-6.6v-3.2L3.5 10.2z"/></svg>
      <span>נגישות</span>
    </button>
    <div class="a11y-panel" id="a11y-panel" role="group" aria-label="תפריט נגישות" hidden>
      ${OPTIONS.map(([cls, label]) => `<button type="button" data-a11y="${cls}" aria-pressed="false">${label}</button>`).join('')}
      <button type="button" data-a11y-reset>איפוס הגדרות</button>
      <a href="/accessibility">הצהרת נגישות</a>
    </div>`;
  document.body.append(wrap);
  const toggle = wrap.querySelector('.a11y-toggle');
  const panel = wrap.querySelector('.a11y-panel');
  const sync = () => wrap.querySelectorAll('[data-a11y]').forEach((b) => b.setAttribute('aria-pressed', String(saved.has(b.dataset.a11y))));
  const close = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a11y]');
    if (b) { saved.has(b.dataset.a11y) ? saved.delete(b.dataset.a11y) : saved.add(b.dataset.a11y); apply(); sync(); }
    if (e.target.closest('[data-a11y-reset]')) { saved.clear(); apply(); sync(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); toggle.focus(); } });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  apply(); sync();

  // ===== Cookie notice =====
  const banner = document.createElement('div');
  banner.className = 'cookie';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'הודעה על עוגיות');
  banner.innerHTML = `
    <p><strong class="cookie-title">כיף שאתם כאן!</strong> המדדים הכלליים והאנונימיים עוזרים לי לשפר את האתר. אין עוגיות מעקב או פרסום, והעדפות השימוש נשמרות בדפדפן שלכם בלבד. במחשבון הטבות המס, Google Analytics מופעל רק לאחר אישור נפרד שלכם. <a href="/privacy#cookies">למדיניות הפרטיות</a></p>
    <div class="cookie-actions">
      <button type="button" data-consent="all">אישור</button>
      <button type="button" data-consent="essential">הכרחיות בלבד</button>
    </div>`;
  const updateNoticeOffset = () => {
    html.style.setProperty('--cookie-notice-height', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
  };
  const noticeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateNoticeOffset) : null;
  const showBanner = () => {
    document.body.append(banner);
    document.body.classList.add('has-cookie-notice');
    if (noticeObserver) noticeObserver.observe(banner);
    updateNoticeOffset();
  };
  banner.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    store.set('rr-consent', b.dataset.consent);
    banner.remove();
    document.body.classList.remove('has-cookie-notice');
    if (noticeObserver) noticeObserver.disconnect();
  });
  if (!store.get('rr-consent')) showBanner();
  // any element with data-cookie-settings reopens the notice
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-cookie-settings]')) return;
    e.preventDefault();
    if (!banner.isConnected) showBanner();
    banner.querySelector('button').focus();
  });
})();
