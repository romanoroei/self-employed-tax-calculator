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
    go.textContent = cta.dataset.menuLabel || 'לשיחת התאמה ללא עלות'; // a page can name its own (the questionnaire: מילוי שאלון)
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
  // only the audience tabs: the market tile has tabs of its own (js/market.js), and taking those too
  // left every audience panel closed when the page opened
  const tabs = [...document.querySelectorAll('.clients [role="tab"]')];
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
// On desktop the page is zoomed to 90% (site.css): layout offsets are page pixels, scrolling and the window are screen pixels.
const pageZoom = () => document.body.getBoundingClientRect().width / document.body.offsetWidth || 1;
function pageTop(element) {
  let y = 0;
  // layout offsets: a heading that has not faded in yet is still moved by a transform
  for (let node = element; node; node = node.offsetParent) y += node.offsetTop;
  return y;
}
function landingPoint(section) {
  // the photo starts with this tile, above "נעים להכיר" on phones and beside it on desktop: show all of it
  if (section.id === 'about') return section.querySelector('.about-text');
  // a section with a small label over its heading lands on the label (the approach, Roei 2026-11-13)
  // and so does one that marks its own landing point, like the year-end stamp over the Hachshara offer
  const kicker = section.querySelector('.section-kicker, [data-land]');
  if (kicker) return kicker;
  return section.querySelector('h2') || section;
}
function sectionTop(section) {
  const bar = document.querySelector('.topbar').offsetHeight;
  if (section.id === 'contact') {
    // the form is the destination: center it in the space under the bar, with its words, when both fit.
    // When they do not (phones), the card starts just under the bar, its white edge showing above
    // "בואו נעשה סדר, יחד", and the form follows on scrolling.
    const room = window.innerHeight / pageZoom() - bar;
    const coupon = section.querySelector('.coupon');
    if (coupon.offsetHeight > room || window.innerWidth <= 700) return pageTop(coupon) - bar - 12;
    return pageTop(coupon) - bar - Math.max(16, (room - coupon.offsetHeight) / 2);
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
  const top = sectionTop(section) * pageZoom();
  if (Math.abs(window.scrollY - top) < 2) return;
  window.scrollTo({ top, behavior: instant || still ? 'instant' : 'smooth' });
  if (instant || still) return;
  // images loading on the way can move the page; a visitor who scrolled away on their own stays where they are
  const settle = () => {
    const off = window.scrollY - sectionTop(section) * pageZoom();
    if (Math.abs(off) > 2 && Math.abs(off) < 400) window.scrollTo({ top: sectionTop(section) * pageZoom(), behavior: 'instant' });
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
// Where a visit came from, among search and AI engines only (src:<engine>), counted once per visit. The engine is kept
// for the visit so a contact counts again as lead:<engine>: is traffic from Google or ChatGPT turning into leads?
// Only the engine name is kept or sent, never the address, the search or anything about the visitor.
const ENGINES = [['chatgpt', /(^|\.)(chatgpt\.com|openai\.com)$/], ['perplexity', /(^|\.)perplexity\.ai$/], ['gemini', /^gemini\.google\.com$/],
  ['copilot', /^copilot\.microsoft\.com$/], ['claude', /(^|\.)claude\.ai$/], ['google', /(^|\.)google\.[a-z.]+$/], ['bing', /(^|\.)bing\.com$/], ['duckduckgo', /(^|\.)duckduckgo\.com$/]];
const visitEngine = (() => {
  let engine = '';
  try { engine = sessionStorage.getItem('src-engine') || ''; } catch { /* storage blocked */ }
  if (engine) return engine;
  let host = '';
  try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* no referrer */ }
  const utm = (new URLSearchParams(location.search).get('utm_source') || '').toLowerCase();
  if (host === location.hostname) return '';
  const hit = ENGINES.find(([, re]) => re.test(host) || re.test(utm));
  if (!hit) return '';
  try { sessionStorage.setItem('src-engine', hit[0]); } catch { /* storage blocked */ }
  countClick(`src:${hit[0]}`);
  return hit[0];
})();
const countLead = () => { if (visitEngine) countClick(`lead:${visitEngine}`); };
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me/"], a[data-count], a[data-subscribe], a[data-cta]');
  if (!a) return;
  // which call to action on which page (knowledge-mid-whatsapp...), on top of the contact total below
  if (a.dataset.cta) countClick(`cta:${a.dataset.cta}`);
  // the fixed phone button: which page it was pressed on, on top of the WhatsApp total below
  if (a.dataset.float) countClick(`float:${a.dataset.float}`);
  if (a.dataset.cta && !/^(?:tel:|mailto:|https:\/\/wa\.me\/)/.test(a.getAttribute('href'))) return;
  if (a.dataset.subscribe) countClick(`subscribe:${a.dataset.subscribe}`);
  else if (a.dataset.count) countClick(a.dataset.count);
  else if (a.href.startsWith('tel:')) countClick('contact:phone');
  else if (a.href.startsWith('mailto:')) countClick('contact:email');
  else countClick('contact:whatsapp');
  countLead();
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
      ? { title: 'שבוע אחרון. <em>מה שלא תפקידו עד 31.12, מס הכנסה ישמח לקחת.</em>', go: 'בודק עכשיו' }
      : days <= 21
      ? { title: `עצמאי? <em>${days} ימים</em> להחליט אם הכסף הולך לחיסכון שלך או למס הכנסה.`, go: 'תראו לי את המספר' }
      : { title: 'עצמאים, אין לכם מעסיק שיפקיד בשבילכם. <em>יש לכם עד 31.12.</em>', go: 'כמה אחסוך?' };
    tile.querySelector('[data-now-title]').innerHTML = text.title;
    tile.querySelector('[data-now-go]').textContent = text.go;
    // the countdown sits beside both the fund strip and this tile, so it is found on the page, not in the tile
    document.querySelector('[data-now-days]').textContent = days;
    document.querySelector('[data-now-unit]').textContent = days === 1 ? 'יום' : 'ימים';
    document.querySelector('[data-now-when]').hidden = false;
  }

  // the investment provident fund reminder: November and December, while the year's ceiling can still be used
  const investStrip = document.querySelector('[data-invest-strip]');
  if (investStrip && month >= 10) investStrip.hidden = false;
  // the ceiling shown beside it belongs to one year: from January it waits for the new figure
  const investCap = investStrip?.querySelector('[data-cap-year]');
  if (investCap && String(year) !== investCap.dataset.capYear) investCap.remove();

  const monthFocus = document.querySelector(`#m${month + 1} .cal-focus`);
  if (monthFocus && until) {
    const badge = document.createElement('span');
    badge.className = 'cal-until';
    badge.textContent = `${left}, עד ${date}`;
    monthFocus.append(' ', badge);
  }
})();

// ===== Lead form: sent to our own function (functions/api/contact.js), which checks it and forwards it to Formspree and Sheets =====
(() => {
  const form = document.getElementById('lead-form');
  if (!form) return;
  const LIVE = ['romanoinvest.co.il', 'www.romanoinvest.co.il'].includes(location.hostname);
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const ERROR = 'אירעה שגיאה בשליחה, והפרטים לא נשלחו. אפשר לנסות שוב, או להתקשר ישירות: 052-8089808.';
  // the topics are checkboxes, and at least one is needed
  const goals = [...form.querySelectorAll('input[name="מטרה"]')];
  const NO_GOAL = 'סמנו לפחות נושא אחד שתרצו לבדוק.';
  goals.forEach((g) => g.addEventListener('change', () => {
    if (goals.some((x) => x.checked) && status.textContent === NO_GOAL) { status.className = 'form-status'; status.textContent = ''; }
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!button.disabled && goals.length && !goals.some((g) => g.checked)) {
      status.className = 'form-status error';
      status.textContent = NO_GOAL;
      goals[0].focus();
      return;
    }
    if (button.disabled || !form.reportValidity()) return;
    status.className = 'form-status';
    status.textContent = '';
    const el = form.elements;
    const payload = {
      form: 'home',
      contact: { name: el['שם מלא'].value, phone: el['טלפון'].value, email: el['אימייל'].value },
      goals: goals.filter((g) => g.checked).map((g) => g.value),
      consent: el['הסכמה'].checked,
      marketing: el['הסכמה לדיוור'].checked,
      website: el.website ? el.website.value : '',
    };
    // previews and local copies never send
    if (!LIVE) { status.className = 'form-status success'; status.textContent = 'בדיקה בלבד: הטופס תקין ולא נשלח.'; return; }
    button.disabled = true;
    button.textContent = 'שולח...';
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        status.className = 'form-status error';
        status.textContent = res.status === 400 && body.error === 'contact' ? 'נא לבדוק את השם ומספר הטלפון.' : res.status === 429 ? 'נשלחו כבר כמה פניות מהחיבור הזה בשעה האחרונה. אפשר להתקשר ישירות: 052-8089808.' : ERROR;
        return;
      }
      form.reset();
      status.className = 'form-status success';
      status.textContent = 'הפרטים נשלחו. אחזור אליכם בהקדם.';
      countClick('contact:form');
      countLead();
    } catch (err) {
      status.className = 'form-status error';
      status.textContent = ERROR;
    } finally {
      button.disabled = false;
      button.textContent = 'לשליחת הפרטים';
    }
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

// ===== Home page: the photo tile is a slide show =====
// The first slide is Roei; the others point to a guide or a tool. Every 4 seconds (Roei, 2026-11-10) the slide moves to the
// right and the next comes in from the left. It stops while the pointer or the keyboard focus is on the
// tile, while the page is hidden, after the pause button, and never runs for visitors who asked their
// device for less motion (they change slides by hand). Arrows, dots and a swipe on phones move it too.
(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  hero.querySelectorAll('[data-slide][data-until]').forEach((slide) => { if (slide.dataset.until < todayIso) slide.remove(); });
  // a slide meant for one screen size (the market data slide is for phones only) leaves on the others
  hero.querySelectorAll('[data-slide][data-media]').forEach((slide) => { if (!matchMedia(slide.dataset.media).matches) slide.remove(); });
  const slides = [...hero.querySelectorAll('[data-slide]')];
  if (slides.length < 2) return;

  const INTERVAL = 3000;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer = 0;
  let paused = still.matches;
  let held = false;
  let finishMove = null;

  hero.setAttribute('role', 'region');
  hero.setAttribute('aria-roledescription', 'מצגת');
  hero.setAttribute('aria-label', 'רועי רומנו, ומה חדש באתר');
  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'שקף');
    slide.setAttribute('aria-label', `${i + 1} מתוך ${slides.length}`);
    slide.hidden = i !== 0;
    slide.inert = i !== 0;
  });

  const icon = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const PLAY = 'M4 2.5v11l9-5.5z';
  const PAUSE = 'M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z';
  const nav = document.createElement('div');
  nav.className = 'hero-nav';
  nav.innerHTML = `<button type="button" class="hero-arrow" data-go="-1" aria-label="השקף הקודם">${icon('M5.6 1.6L4.2 3l5 5-5 5 1.4 1.4L12 8z')}</button>`
    + `<div class="hero-dots">${slides.map((_, i) => `<button type="button" class="hero-dot" data-to="${i}" aria-label="שקף ${i + 1} מתוך ${slides.length}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>`
    + `<button type="button" class="hero-arrow" data-go="1" aria-label="השקף הבא">${icon('M10.4 1.6L11.8 3l-5 5 5 5-1.4 1.4L4 8z')}</button>`
    + `<button type="button" class="hero-pause" aria-pressed="false"></button>`;
  hero.append(nav);
  const dots = [...nav.querySelectorAll('.hero-dot')];
  const pauseButton = nav.querySelector('.hero-pause');
  function drawPause() {
    pauseButton.innerHTML = icon(paused ? PLAY : PAUSE);
    pauseButton.setAttribute('aria-label', paused ? 'הפעלת המצגת' : 'עצירת המצגת');
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  drawPause();

  // dir 1: the slide leaves to the right and the next comes in from the left; -1 the other way.
  // The slide coming in is always drawn above the one leaving, and the leaving one stays where the move took it
  // until it is hidden: from the last slide back to Roei the leaving slide came later in the page and stayed
  // on top, so a strip of its photo could show at the side of his (Roei, 2026-11-11).
  function show(next, dir) {
    if (next === current) return;
    if (finishMove) finishMove();
    const from = slides[current];
    const to = slides[next];
    current = next;
    dots.forEach((dot, i) => (i === next ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
    to.hidden = false;
    to.inert = false;
    from.inert = true;
    let anims = [];
    let ended = false;
    const done = () => {
      if (ended) return;
      ended = true;
      from.hidden = true;
      from.classList.remove('is-moving');
      to.classList.remove('is-moving');
      from.style.zIndex = '';
      to.style.zIndex = '';
      anims.forEach((a) => a.cancel());
      if (finishMove === done) finishMove = null;
    };
    if (still.matches || !to.animate) { done(); return; }
    from.classList.add('is-moving');
    to.classList.add('is-moving');
    from.style.zIndex = '0';
    to.style.zIndex = '1';
    const timing = { duration: 650, easing: 'cubic-bezier(.2, .7, .2, 1)' };
    anims = [
      from.animate([{ transform: 'none' }, { transform: `translateX(${dir * 100}%)` }], { ...timing, fill: 'forwards' }),
      to.animate([{ transform: `translateX(${dir * -100}%)` }, { transform: 'none' }], timing),
    ];
    finishMove = done;
    anims[1].finished.then(done, done);
  }
  const step = (dir) => show((current + (dir > 0 ? 1 : -1) + slides.length) % slides.length, dir);

  function schedule() {
    clearTimeout(timer);
    // each slide stands still for the whole interval, and the move (650ms) comes on top (Roei)
    if (!paused && !held && !document.hidden) timer = setTimeout(() => { step(1); schedule(); }, INTERVAL + (still.matches ? 0 : 650));
  }

  nav.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button === pauseButton) { paused = !paused; drawPause(); schedule(); return; }
    if (button.dataset.go) step(Number(button.dataset.go));
    if (button.dataset.to) { const to = Number(button.dataset.to); show(to, to > current ? 1 : -1); }
    schedule();
  });
  // hold while a mouse rests on the tile or the keyboard is inside it
  hero.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { held = true; schedule(); } });
  hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { held = false; schedule(); } });
  hero.addEventListener('focusin', () => { held = true; schedule(); });
  hero.addEventListener('focusout', (e) => { if (!hero.contains(e.relatedTarget)) { held = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  // arrow keys inside the tile: left is the next slide, as the slides come in from the left
  hero.addEventListener('keydown', (e) => {
    const dir = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
    if (!dir || !nav.contains(document.activeElement)) return;
    e.preventDefault();
    step(dir);
    schedule();
  });
  // a swipe on a touch screen: pulling to the right brings the next slide in from the left
  let startX = null;
  let startY = 0;
  hero.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx > 0 ? 1 : -1);
    schedule();
  });
  schedule();
})();

// a link that leads to the contact form (a slide button, a path card) ticks the matching topic there
// from another page (a guide) the topic waits in this tab's session storage until the form is there
const tickGoal = (goal) => {
  const box = goal && [...document.querySelectorAll('input[name="מטרה"]')].find((input) => input.value === goal);
  if (box) box.checked = true;
  return Boolean(box);
};
document.addEventListener('click', (e) => {
  const goal = e.target.closest('a[data-goal]')?.dataset.goal;
  if (!goal || tickGoal(goal)) return;
  try { sessionStorage.setItem('lead-goal', goal); } catch { /* the topic is a convenience */ }
});
try {
  const waiting = sessionStorage.getItem('lead-goal');
  if (waiting && tickGoal(waiting)) sessionStorage.removeItem('lead-goal');
} catch { /* the topic is a convenience */ }

// ===== Home page: the savings policy slide counts its yields up each time it comes in =====
// The figures are written by the build; this only replays them from zero. Not for visitors who asked for less motion.
(() => {
  const slide = document.querySelector('.hero-slide-policy');
  if (!slide || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const figures = [...slide.querySelectorAll('.policy-bar span[dir="ltr"], .policy-proof b')];
  figures.forEach((el) => { el.dataset.final = el.textContent; });
  const show = (k) => figures.forEach((el) => {
    el.textContent = k >= 1 ? el.dataset.final : el.dataset.final.replace(/\d+(?:\.\d+)?/g, (n) => (parseFloat(n) * k).toFixed(n.includes('.') ? n.split('.')[1].length : 0));
  });
  let frame = 0;
  const run = () => {
    cancelAnimationFrame(frame);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start - 300) / 1700);
      show(t <= 0 ? 0 : 1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  new MutationObserver(() => { if (!slide.hidden) run(); }).observe(slide, { attributes: true, attributeFilter: ['hidden'] });
})();

// ===== Opening hours: "open now", or when Roei will be back, by Israel time =====
// The hours are those of the Google Business Profile (Sunday to Thursday, 9:00–18:00). Holidays are not
// worked out here: on a holiday the line may say open. Change OPEN_DAYS and the hours together with Google.
(() => {
  const lines = document.querySelectorAll('[data-hours-now]');
  if (!lines.length) return;
  const OPEN_DAYS = [0, 1, 2, 3, 4];
  const OPEN = 9 * 60;
  const CLOSE = 18 * 60;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const open = OPEN_DAYS.includes(day) && minute >= OPEN && minute < CLOSE;
  let text;
  if (open) text = 'פתוח עכשיו';
  else if (OPEN_DAYS.includes(day) && minute < OPEN) text = 'סגור עכשיו · אחזור אליכם היום מ־9:00';
  else {
    let next = (day + 1) % 7;
    while (!OPEN_DAYS.includes(next)) next = (next + 1) % 7;
    const name = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][next];
    text = `סגור עכשיו · אחזור אליכם ${next === (day + 1) % 7 ? 'מחר' : `ביום ${name}`} מ־9:00`;
  }
  lines.forEach((line) => { line.textContent = text; line.classList.toggle('is-open', open); line.hidden = false; });
})();

// ===== The institutions board: one logo at a time lights up in its own colours, in a random order (Roei) =====
// Each round lights every logo once, in a new shuffled order; a round never starts with the logo that ended the last one.
// Runs only while the board is on screen and the tab is visible; pauses while the pointer is on the board;
// does not run at all with reduced motion (the colours still show on hover).
(() => {
  const board = document.querySelector('[data-logo-light]');
  if (!board || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tiles = [...board.querySelectorAll('.logo-tile')];
  if (tiles.length < 2) return;
  const STEP = 900; // a new logo every 0.9s (Roei: a little faster again)
  const HOLD = 620; // each stays lit about 0.6s, then fades out as the next lights up
  let order = [], last = -1, timer = 0, offTimer = 0, inView = false, hovered = false;
  const tick = () => {
    if (!order.length) {
      order = tiles.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [order[i], order[k]] = [order[k], order[i]]; }
      if (order[0] === last) order.push(order.shift());
    }
    last = order.shift();
    const tile = tiles[last];
    tile.classList.add('is-lit');
    offTimer = setTimeout(() => tile.classList.remove('is-lit'), HOLD);
  };
  const stop = () => { clearInterval(timer); clearTimeout(offTimer); timer = 0; tiles.forEach((t) => t.classList.remove('is-lit')); };
  const sync = () => {
    const run = inView && !hovered && !document.hidden;
    if (run && !timer) { tick(); timer = setInterval(tick, STEP); }
    else if (!run && timer) stop();
  };
  new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; sync(); }, { threshold: 0.4 }).observe(board);
  board.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovered = true; sync(); } });
  board.addEventListener('pointerleave', () => { hovered = false; sync(); });
  document.addEventListener('visibilitychange', sync);
})();

// ===== Phones: a fixed WhatsApp button whose message names the page the visitor came from =====
// Shown on narrow screens only, after the first screen, and hidden while the contact form or the footer is in view,
// so it never sits on top of another way to reach Roei. Bottom right: the accessibility button owns bottom left.
(() => {
  const page = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  const pages = {
    '/': ['home', 'הגעתי מהאתר ואשמח לתאם שיחת התאמה.'],
    '/self-employed': ['self', 'הגעתי מהמדריך לעצמאים ואני רוצה לבדוק את ההפקדות שלי.'],
    '/investment-fund': ['invest', 'הגעתי מהמדריך לקופת גמל להשקעה ואני רוצה לבדוק אפשרות להפקיד.'],
    '/savings-policy': ['policy', 'הגעתי מהמדריך לפוליסת חיסכון ואני רוצה לבדוק אם זה מתאים לי.'],
    '/hachshara-policy': ['hachshara', 'הגעתי מעמוד פוליסת החיסכון באתר ויש לי שאלה.'],
    '/study-fund': ['study', 'הגעתי מבדיקת קרן ההשתלמות באתר ואני רוצה לבדוק את הקרן שלי.'],
    '/severance': ['severance', 'הגעתי מעמוד הפיצויים באתר ויש לי שאלה על הכסף שלי.'],
    '/knowledge': ['knowledge', 'הגעתי מהמדריכים באתר ויש לי שאלה:'],
    '/market-data': ['market', 'הגעתי מעמוד התשואות באתר ויש לי שאלה על החיסכון שלי:'],
    '/about': ['about', 'הגעתי מעמוד האודות באתר ואשמח לתאם שיחת התאמה.'],
    '/pension-check': ['pension', 'הגעתי מעמוד בדיקת התיק הפנסיוני ואני רוצה לבדוק את הפנסיה שלי.'],
    '/financial-planning': ['planning', 'הגעתי מעמוד התכנון הפיננסי ואשמח לתאם שיחה.'],
    '/givatayim': ['givatayim', 'הגעתי מהעמוד לתושבי גבעתיים והסביבה ואשמח לתאם שיחת התאמה.'],
    '/management-fees': ['guide', 'קראתי את המדריך באתר ויש לי שאלה:'],
    '/pension-fund-or-managers-insurance': ['guide', 'קראתי את המדריך באתר ויש לי שאלה:'],
    '/old-pension-funds': ['guide', 'קראתי את המדריך באתר ויש לי שאלה:'],
    '/compass': ['compass', 'הגעתי מהמצפן הפיננסי באתר ואשמח לעבור איתך על מה שיצא לי.'],
  };
  const [id, text] = pages[page] || (page.startsWith('/magazine/') ? ['magazine', 'קראתי מאמר באתר ויש לי שאלה:'] : []);
  if (!id) return;
  const a = document.createElement('a');
  a.className = 'wa-float';
  a.href = `https://wa.me/972528089808?text=${encodeURIComponent(`שלום רועי, ${text}`)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.float = `wa-${id}`;
  a.setAttribute('aria-label', 'כתבו לרועי בוואטסאפ (נפתח בלשונית חדשה)');
  a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>';
  document.body.append(a);
  const hiders = new Set();
  const update = () => a.classList.toggle('is-on', window.scrollY > window.innerHeight * 0.6 && !hiders.size);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? hiders.add(e.target) : hiders.delete(e.target);
      update();
    });
    document.querySelectorAll('#contact, footer').forEach((el) => io.observe(el));
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();
