// Roei Romano — financial calendar: marks the current month, fills the "this month" tiles,
// filters by audience (remembered in this browser) and offers the yearly reminders as a calendar subscription.

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

  // ===== This month and next =====
  const now = months[m];
  now.classList.add('is-now');
  const badge = document.createElement('span');
  badge.className = 'cal-badge';
  badge.textContent = 'החודש';
  now.querySelector('h3 .cal-name').after(badge);

  const name = (tile) => tile.querySelector('.cal-name').textContent;
  const focus = (tile) => tile.querySelector('.cal-focus').textContent;
  const main = document.querySelector('.cal-now-main');
  if (main) {
    main.querySelector('.cal-now-month').textContent = name(now);
    main.querySelector('.cal-now-focus').textContent = focus(now);
    const list = main.querySelector('.cal-items');
    now.querySelectorAll('.cal-items > li').forEach((li) => list.append(li.cloneNode(true)));
  }
  const next = months[(m + 1) % 12];
  const nextTile = document.querySelector('.cal-next');
  if (nextTile) {
    nextTile.href = `#${next.id}`;
    nextTile.querySelector('.cal-next-month').textContent = name(next);
    nextTile.querySelector('.cal-next-focus').textContent = focus(next);
  }

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
  };
  buttons.forEach((b) => b.addEventListener('click', () => { apply(b.dataset.filter); store.set(b.dataset.filter); }));
  const saved = store.get();
  apply(buttons.some((b) => b.dataset.filter === saved) ? saved : 'all');

  // ===== Subscribing to the yearly reminders (the feed is written by the build) =====
  // Anonymous totals only: the label is all that is sent, and a failed count never blocks anything.
  const count = (label) => { try { navigator.sendBeacon('/api/count', label); } catch { /* counting is optional */ } };
  document.querySelectorAll('a[data-subscribe]').forEach((a) => {
    a.addEventListener('click', () => count(`subscribe:${a.dataset.subscribe}`));
  });
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
