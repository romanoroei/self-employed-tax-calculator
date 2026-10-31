// Roei Romano — financial calendar: shows the year one month at a time, like a wall calendar, opening on the
// current month; filters by audience (remembered in this browser); offers the reminders as a calendar subscription.

(() => {
  const months = [...document.querySelectorAll('.cal-month')];
  if (months.length !== 12) return;
  const today = new Date();
  const m = today.getMonth();
  const year = today.getFullYear();

  // tax refunds reach back six years: name the year whose window closes this December
  document.querySelectorAll('[data-years-back]').forEach((el) => {
    el.textContent = `שנת ${year - parseInt(el.dataset.yearsBack, 10)}`;
  });

  // ===== This month =====
  months[m].classList.add('is-now');
  const badge = document.createElement('span');
  badge.className = 'cal-badge';
  badge.textContent = 'החודש';
  months[m].querySelector('h3 .cal-name').after(badge);
  const tabs = [...document.querySelectorAll('.cal-strip a')];
  if (tabs[m]) tabs[m].classList.add('is-now');

  // ===== Audience filter =====
  const KEY = 'rr-cal-for';
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode: the filter lasts for this visit */ } },
  };
  const buttons = [...document.querySelectorAll('.cal-filter [data-filter]')];
  const apply = (who) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === who)));
    document.querySelectorAll('[data-for]').forEach((el) => {
      const tags = el.dataset.for.split(' ');
      el.hidden = !(who === 'all' || tags.includes('all') || tags.includes(who));
    });
    months.forEach((tile) => {
      tile.querySelector('.cal-empty').hidden = !!tile.querySelector('.cal-items > li:not([hidden])');
    });
    // months with nothing for this audience fade in the strip
    tabs.forEach((a, i) => a.classList.toggle('is-empty', !months[i].querySelector('.cal-items > li:not([hidden])')));
  };
  buttons.forEach((b) => b.addEventListener('click', () => { apply(b.dataset.filter); store.set(b.dataset.filter); }));
  const saved = store.get();
  apply(buttons.some((b) => b.dataset.filter === saved) ? saved : 'all');

  // ===== One month at a time, like the pages of a wall calendar =====
  const wrap = document.querySelector('.cal-year-wrap');
  const pager = document.querySelector('.cal-pager');
  const strip = document.querySelector('.cal-strip');
  if (wrap && pager && strip && tabs.length === 12) {
    const turns = [...pager.querySelectorAll('[data-turn]')];
    const html = document.documentElement;
    const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || html.classList.contains('a11y-still');
    const label = (i) => months[(i + 12) % 12].querySelector('.cal-name').textContent;
    let shown = -1;
    const show = (i, dir) => {
      i = (i + 12) % 12;
      if (i === shown) return false;
      months.forEach((tile, k) => { tile.hidden = k !== i; });
      tabs.forEach((a, k) => { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      turns.forEach((b) => { b.querySelector('.cal-pager-name').textContent = label(i + Number(b.dataset.turn)); });
      const tile = months[i];
      tile.classList.remove('is-turning');
      if (dir && !still()) { void tile.offsetWidth; tile.dataset.dir = dir; tile.classList.add('is-turning'); }
      shown = i;
      return true;
    };
    // a turn the visitor made: keep the address pointing at the month, and bring the page top into view
    const go = (i, dir) => {
      if (!show(i, dir)) return;
      history.replaceState(null, '', `${location.pathname}#${months[shown].id}`);
      const head = months[shown].querySelector('h3');
      head.setAttribute('tabindex', '-1');
      head.focus({ preventScroll: true });
      if (strip.getBoundingClientRect().top < 0) strip.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    };
    const fromHash = () => {
      const h = /^#m(\d{1,2})$/.exec(location.hash);
      const n = h ? parseInt(h[1], 10) : 0;
      return n >= 1 && n <= 12 ? n - 1 : null;
    };
    const dirTo = (i) => (i > shown ? 'next' : 'prev');

    wrap.classList.add('is-paged');
    pager.hidden = false;
    const start = fromHash();
    show(start === null ? m : start);

    tabs.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); go(i, dirTo(i)); }));
    turns.forEach((b) => b.addEventListener('click', () => {
      const step = Number(b.dataset.turn);
      go(shown + step, step > 0 ? 'next' : 'prev');
    }));
    window.addEventListener('hashchange', () => { const i = fromHash(); if (i !== null) go(i, dirTo(i)); });
    // arrow keys turn the page; in a right-to-left page the next month is to the left
    wrap.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      go(shown + (e.key === 'ArrowLeft' ? 1 : -1), e.key === 'ArrowLeft' ? 'next' : 'prev');
    });
    // a sideways swipe on the page; dragging it to the right brings the next month in from the left
    const book = document.querySelector('.cal-year');
    let x0 = null;
    let y0 = 0;
    book.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    book.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      go(shown + (dx > 0 ? 1 : -1), dx > 0 ? 'next' : 'prev');
    }, { passive: true });
  }

  // ===== Subscribing to the yearly reminders (the feed is written by the build) =====
  // Anonymous totals only: the label is all that is sent, and a failed count never blocks anything.
  // Clicks on the subscribe links are counted by site.js, which every page loads.
  const count = (label) => { try { navigator.sendBeacon('/api/count', label); } catch { /* counting is optional */ } };
  const copy = document.querySelector('button[data-subscribe="copy"]');
  if (copy) copy.addEventListener('click', async () => {
    const label = copy.textContent;
    try {
      await navigator.clipboard.writeText(copy.dataset.feed);
      copy.textContent = 'הכתובת הועתקה. מדביקים אותה ביומן תחת "הוספת יומן מכתובת"';
    } catch {
      copy.textContent = copy.dataset.feed;
    }
    count('subscribe:copy');
    setTimeout(() => { copy.textContent = label; }, 6000);
  });

  // a visit from a calendar reminder: count it, then drop the marker so a shared link stays clean
  const params = new URLSearchParams(location.search);
  if (params.get('from') === 'reminder') {
    const month = /^#m(\d{1,2})$/.exec(location.hash);
    if (month) count(`return:m${month[1]}`);
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();
