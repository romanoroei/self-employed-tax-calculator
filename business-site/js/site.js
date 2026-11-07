// Roei Romano — site script: reveal on scroll and the lead form.

// ===== Reveal once when an element enters the viewport =====
(() => {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  targets.forEach((el) => io.observe(el));
  // safety net: never leave visible content hidden
  window.addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); });
  }, 2500));
})();

// ===== Tools and calculators menu in the top bar =====
(() => {
  const toggle = document.querySelector('.bar-tools-toggle');
  if (!toggle) return;
  const menu = document.getElementById(toggle.getAttribute('aria-controls'));
  const links = [...menu.querySelectorAll('a')];
  const open = (focusFirst) => {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (focusFirst) links[0].focus();
  };
  const close = (focusToggle) => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (focusToggle) toggle.focus();
  };
  toggle.addEventListener('click', () => (menu.hidden ? open(false) : close(false)));
  toggle.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); open(true); } });
  menu.addEventListener('keydown', (e) => {
    const i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.bar-tools')) close(false); });
  // leaving the menu with Tab closes it
  menu.addEventListener('focusout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest('.bar-tools')) close(false); });
})();

// ===== Phones and tablets: the brand tile opens a side menu of the page's sections =====
// The section links are hidden in the top bar up to 900px, so the brand (logo and name) opens them
// in a panel from the right. Above 900px, or without scripting, the brand stays a plain link.
(() => {
  const brand = document.querySelector('.bar-brand');
  const nav = document.querySelector('.bar-nav');
  if (!brand || !nav) return;
  const small = matchMedia('(max-width: 900px)');
  const cta = document.querySelector('.bar-cta');

  const panel = document.createElement('div');
  panel.className = 'site-menu';
  panel.id = 'site-menu';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'תפריט האתר');
  const top = brand.getAttribute('href') === '#top' ? '#top' : '/';
  panel.innerHTML = `
    <div class="site-menu-back" data-close></div>
    <div class="site-menu-sheet">
      <div class="site-menu-head">
        <a class="site-menu-brand" href="${top}">${brand.querySelector('img').outerHTML}<strong>רועי רומנו</strong></a>
        <button type="button" class="site-menu-close" data-close aria-label="סגירת התפריט"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.1 1.7L8 6.6l4.9-4.9 1.4 1.4L9.4 8l4.9 4.9-1.4 1.4L8 9.4l-4.9 4.9-1.4-1.4L6.6 8 1.7 3.1z"/></svg></button>
      </div>
      <nav class="site-menu-links" aria-label="נושאי האתר"></nav>
    </div>`;
  const list = panel.querySelector('.site-menu-links');
  [...nav.querySelectorAll('a')].forEach((a) => {
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.innerHTML = `<span>${a.textContent}</span><span class="v" aria-hidden="true">←</span>`;
    list.append(link);
  });
  if (cta) {
    const go = document.createElement('a');
    go.className = 'site-menu-cta';
    go.href = cta.getAttribute('href');
    go.textContent = 'לשיחת היכרות ללא עלות';
    list.append(go);
  }
  document.body.append(panel);
  const sheet = panel.querySelector('.site-menu-sheet');
  const focusables = () => [...sheet.querySelectorAll('a, button')];

  const open = () => {
    panel.hidden = false;
    document.documentElement.classList.add('menu-open');
    brand.setAttribute('aria-expanded', 'true');
    focusables()[0].focus();
  };
  const close = (focusBrand) => {
    if (panel.hidden) return;
    panel.hidden = true;
    document.documentElement.classList.remove('menu-open');
    brand.setAttribute('aria-expanded', 'false');
    if (focusBrand) brand.focus();
  };
  const sync = () => {
    if (small.matches) {
      brand.setAttribute('aria-controls', 'site-menu');
      brand.setAttribute('aria-expanded', String(!panel.hidden));
      brand.setAttribute('aria-label', 'פתיחת תפריט האתר');
    } else {
      close(false);
      ['aria-controls', 'aria-expanded', 'aria-label'].forEach((n) => brand.removeAttribute(n));
    }
  };
  sync();
  small.addEventListener('change', sync);

  brand.addEventListener('click', (e) => {
    if (!small.matches) return;
    e.preventDefault();
    open();
  });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(true); return; }
    const link = e.target.closest('.site-menu-links a, .site-menu-brand');
    if (!link) return;
    close(false);
    // a section on this page: the link was hidden mid-click, so scroll there ourselves
    const hash = link.getAttribute('href');
    if (hash === '#top') { e.preventDefault(); requestAnimationFrame(goToPageTop); return; }
    const target = hash.startsWith('#') && document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', hash);
    // wait a frame: the page is still locked from the open menu until the next layout
    requestAnimationFrame(() => goToSection(target));
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key !== 'Tab') return;
    // keep Tab inside the open menu
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();

// ===== The gaps keep closing: bars (and the share prices) loop while the section is on screen =====
(() => {
  const box = document.querySelector('.arb');
  if (!box) return;
  const bars = [...box.querySelectorAll('.arb-bar')].map((el) => {
    const css = getComputedStyle(el);
    const label = el.querySelector('span');
    return {
      el, label,
      from: parseFloat(css.getPropertyValue('--from')), to: parseFloat(css.getPropertyValue('--to')),
      p0: label && label.dataset.priceFrom ? parseFloat(label.dataset.priceFrom) : null,
      p1: label && label.dataset.priceTo ? parseFloat(label.dataset.priceTo) : null,
    };
  });
  // one cycle: hold open, close, hold closed, reopen
  const CYCLE = 6400;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const phase = (ms) => {
    const t = ms % CYCLE;
    if (t < 800) return 0;
    if (t < 2600) return ease((t - 800) / 1800);
    if (t < 3800) return 1;
    if (t < 5600) return 1 - ease((t - 3800) / 1800);
    return 0;
  };
  const draw = (k) => bars.forEach((b) => {
    b.el.style.width = `${(b.from + (b.to - b.from) * k) * 100}%`;
    if (b.p0 !== null) b.label.textContent = `${(b.p0 + (b.p1 - b.p0) * k).toFixed(2)} ₪`;
  });
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-still');

  let running = false, start = 0, frame = 0;
  const tick = (now) => {
    if (!running) return;
    if (still()) { draw(1); running = false; return; }
    if (!start) start = now;
    draw(phase(now - start));
    frame = requestAnimationFrame(tick);
  };
  const play = () => { if (!running) { running = true; frame = requestAnimationFrame(tick); } };
  const stop = () => { running = false; cancelAnimationFrame(frame); };

  draw(still() ? 1 : 0);
  if (!('IntersectionObserver' in window)) { play(); return; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? play() : stop()), { threshold: 0.2 }).observe(box);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); return; }
    const r = box.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) play();
  });
  // re-check when the accessibility menu toggles animations
  new MutationObserver(() => { if (still()) { stop(); draw(1); } else { const r = box.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) play(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();

// ===== Audience tabs: one panel at a time (all panels show when scripting is off) =====
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      // right-to-left: ArrowLeft moves forward
      const step = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
  select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]);
})();

// ===== Links to a section land with its heading right under the top bar =====
// The sections have generous top padding, so the browser's own jump leaves the heading far down the screen.
function pageTop(element) {
  let y = 0;
  // layout offsets: a heading that has not faded in yet is still moved by a transform
  for (let node = element; node; node = node.offsetParent) y += node.offsetTop;
  return y;
}
function landingPoint(section) {
  // the photo starts with this tile, above "נעים להכיר" on phones and beside it on desktop: show all of it
  if (section.id === 'about') return section.querySelector('.about-text');
  return section.querySelector('h2') || section;
}
function sectionTop(section) {
  const bar = document.querySelector('.topbar').offsetHeight;
  if (section.id === 'contact') {
    // the form is the destination: center it in the space under the bar, with its words when both fit
    const room = window.innerHeight - bar;
    const coupon = section.querySelector('.coupon');
    const target = coupon.offsetHeight <= room ? coupon : section.querySelector('.coupon-form');
    return pageTop(target) - bar - Math.max(16, (room - target.offsetHeight) / 2);
  }
  return pageTop(landingPoint(section)) - bar - 16;
}
// The #top target is the sticky bar itself, which is always on screen, so the browser's jump would not move the page.
function goToPageTop() {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-still');
  window.scrollTo({ top: 0, behavior: still ? 'instant' : 'smooth' });
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
}
function goToSection(section, instant) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-still');
  const top = sectionTop(section);
  if (Math.abs(window.scrollY - top) < 2) return;
  window.scrollTo({ top, behavior: instant || still ? 'instant' : 'smooth' });
  if (instant || still) return;
  // images loading on the way can move the page; a visitor who scrolled away on their own stays where they are
  const settle = () => {
    const off = window.scrollY - sectionTop(section);
    if (Math.abs(off) > 2 && Math.abs(off) < 400) window.scrollTo({ top: sectionTop(section), behavior: 'instant' });
  };
  if ('onscrollend' in window) window.addEventListener('scrollend', settle, { once: true });
  else setTimeout(settle, 1200);
}
const sectionOf = (hash) => {
  const target = hash.length > 1 && document.getElementById(hash.slice(1));
  return target && target.tagName === 'SECTION' ? target : null;
};
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href="#top"]');
  if (!link || e.defaultPrevented) return;
  e.preventDefault();
  goToPageTop();
  // keyboard users continue from the top, not from a link far down the page
  document.querySelector('.bar-brand')?.focus({ preventScroll: true });
});
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  const section = link && !e.defaultPrevented && sectionOf(link.getAttribute('href'));
  if (!section) return;
  e.preventDefault();
  history.pushState(null, '', link.getAttribute('href'));
  goToSection(section);
  // keyboard users continue from the section they chose
  const heading = section.querySelector('h2');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
});
// arriving from another page: the browser makes the jump itself, and repeats it until the page has loaded,
// so tell it where to land (scroll-padding on html already leaves room for the top bar)
if (sectionOf(location.hash)) {
  const land = () => {
    const section = sectionOf(location.hash);
    if (section) section.style.scrollMarginTop = `${pageTop(section) - document.querySelector('.topbar').offsetHeight - 16 - sectionTop(section)}px`;
  };
  land();
  window.addEventListener('load', land);
}

// Anonymous totals (functions/api/count.js). Only the label is sent; a failed count never blocks anything.
const countClick = (label) => { try { navigator.sendBeacon('/api/count', label); } catch { /* counting is optional */ } };
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me/"], a[data-count], a[data-subscribe]');
  if (!a) return;
  if (a.dataset.subscribe) countClick(`subscribe:${a.dataset.subscribe}`);
  else if (a.dataset.count) countClick(a.dataset.count);
  else if (a.href.startsWith('tel:')) countClick('contact:phone');
  else if (a.href.startsWith('mailto:')) countClick('contact:email');
  else countClick('contact:whatsapp');
});

// ===== Home page strip and the calendar's countdown, worked out from today's date =====
// The main tile teases the calculator, and in November and December counts down to 31.12. Today counts as a day.
// Without scripting it stays a plain link.
(() => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  // the months with a deadline: March for the year's documents, November and December for deposits
  const until = month === 2 ? [3, 31] : month >= 10 ? [12, 31] : null;
  const start = new Date(year, month, today.getDate());
  const days = until ? Math.round((new Date(year, until[0] - 1, until[1]) - start) / 86400000) + 1 : 0;
  const left = days === 1 ? 'יום אחרון' : days === 2 ? 'עוד יומיים' : `עוד ${days} ימים`;
  const date = until ? `${until[1]}.${until[0]}` : '';

  const tile = document.querySelector('[data-now]');
  if (tile && month >= 10) {
    const text = days <= 7
      ? { title: 'שבוע אחרון. <em>מה שלא תפקידו עד 31.12, מס הכנסה ישמח לקחת.</em>', sub: 'חלק מהקופות סוגרות הפקדות כמה ימים לפני סוף השנה. בדיקה של דקה, עכשיו.', go: 'בודק עכשיו' }
      : days <= 21
      ? { title: `עצמאי? <em>${days} ימים</em> להחליט אם הכסף הולך לחיסכון שלך או למס הכנסה.`, sub: 'המחשבון מראה בדקה כמה מס חוסכים בהפקדה עד סוף השנה.', go: 'תראו לי את המספר' }
      : { title: 'עצמאים, אין לכם מעסיק שיפקיד בשבילכם. <em>יש לכם עד 31.12.</em>', sub: `הפקדה לפנסיה ולקרן השתלמות לפני סוף השנה מקטינה את המס.`, go: 'כמה אחסוך?' };
    tile.querySelector('[data-now-title]').innerHTML = text.title;
    tile.querySelector('[data-now-text]').textContent = text.sub;
    tile.querySelector('[data-now-go]').textContent = text.go;
    tile.querySelector('[data-now-days]').textContent = days;
    tile.querySelector('[data-now-unit]').textContent = days === 1 ? 'יום' : 'ימים';
    tile.querySelector('[data-now-when]').hidden = false;
  }

  const monthFocus = document.querySelector(`#m${month + 1} .cal-focus`);
  if (monthFocus && until) {
    const badge = document.createElement('span');
    badge.className = 'cal-until';
    badge.textContent = `${left}, עד ${date}`;
    monthFocus.append(' ', badge);
  }
})();

// ===== Lead form: Google Sheets copy + Formspree email (same endpoints as the landing page) =====
(() => {
  const form = document.getElementById('lead-form');
  if (!form) return;
  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwt-mMdDo6fA___Mh57M8085t2bFPiiVpoKhq3j22hNyhqUybEKMp2t9X5RFm6PwlXa3g/exec';
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const ERROR = 'אירעה שגיאה בשליחה. אפשר גם להתקשר ישירות: 052-8089808.';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    status.className = 'form-status';
    status.textContent = '';
    const reply = document.getElementById('replyto-field');
    const email = document.getElementById('email');
    if (reply && email) reply.value = email.value;

    button.disabled = true;
    button.textContent = 'שולח...';
    const data = new FormData(form);
    fetch(SHEETS_URL, { method: 'POST', mode: 'no-cors', body: data }).catch(() => {});
    fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.className = 'form-status success';
        status.textContent = 'הפרטים נשלחו. אחזור אליכם בהקדם.';
        countClick('contact:form');
      })
      .catch(() => { status.className = 'form-status error'; status.textContent = ERROR; })
      .finally(() => { button.disabled = false; button.textContent = 'לשליחת הפרטים'; });
  });
})();

// ===== Calendar subscribe buttons =====
// webcal:// opens only on Apple devices (or where desktop Outlook is installed); elsewhere the click does
// nothing, so other devices get Outlook on the web instead. The markup keeps webcal for when scripting is off.
(() => {
  const FEED = 'https://romanoinvest.co.il/magazine/financial-calendar.ics';
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const phone = /iPhone|iPod/.test(navigator.userAgent);
  document.querySelectorAll('a[data-subscribe="apple"]').forEach((a) => {
    if (apple) {
      a.textContent = phone ? 'ליומן אייפון' : 'ליומן Apple';
      return;
    }
    a.href = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(FEED)}&name=${encodeURIComponent('לוח השנה הפיננסי')}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'ליומן Outlook';
    a.dataset.subscribe = 'outlook';
  });
})();


// The yields tile: the build writes every view and ranking as a table, this only picks which one shows.
(() => {
  const tile = document.querySelector('.hero-yields');
  if (!tile) return;
  let [product, track, sort] = tile.querySelector('[data-yield-view]:not([hidden])').dataset.yieldView.split('-');
  tile.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const { yieldProduct, yieldTrack, yieldSort } = button.dataset;
    product = yieldProduct || product;
    track = yieldTrack || track;
    sort = yieldSort || sort;
    if (!yieldSort) button.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const view = `${product}-${track}-${sort}`;
    tile.querySelectorAll('[data-yield-view]').forEach((table) => { table.hidden = table.dataset.yieldView !== view; });
    // the clicked heading belonged to a table that just hid: keep the focus on its twin
    if (yieldSort) tile.querySelector(`[data-yield-view="${view}"] [data-yield-sort="${yieldSort}"]`).focus();
  });
})();
