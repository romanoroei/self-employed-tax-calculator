// Roei Romano — financial calendar: marks the current month, fills the "this month" tiles,
// filters by audience (remembered in this browser) and offers yearly reminders as an .ics file.

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

  // ===== Yearly reminders for the visitor's own calendar =====
  const REMINDERS = [
    [1, 5, 'קופת גמל להשקעה: תקרה חדשה לשנה', 'להחליט על הפקדה חד־פעמית או הוראת קבע, לפי התזרים והמטרות.'],
    [3, 25, 'לבדוק שהגיעו טופס 106 וטופס 867', 'טופס 106 מכל מעסיק עד 31.3, וטופס 867 מכל בנק ובית השקעות.'],
    [4, 20, 'לקרוא את הדוחות השנתיים מהקרנות', 'דמי ניהול, מסלול השקעה וכיסויים ביטוחיים, בכל דוח.'],
    [9, 1, 'לעדכן מוטבים בקרנות ובביטוחים', 'נישואים, גירושים או לידה לא מעדכנים את המוטבים מעצמם.'],
    [11, 15, 'לחשב כמה עוד להפקיד השנה', 'עצמאים: הפקדות לפנסיה ולקרן ההשתלמות לפני סוף שנת המס.'],
    [12, 15, 'הפקדות ותרומות של סוף השנה', 'פנסיה וקרן השתלמות, ניצול תקרת קופת הגמל להשקעה ותרומות. הכול צריך להיקלט עד 31.12.'],
  ];
  const PAGE = 'https://romanoinvest.co.il/magazine/financial-calendar';
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`);
  // calendar lines are limited to 75 bytes; Hebrew takes two bytes a letter, so fold every 30 characters
  const fold = (line) => line.match(/.{1,30}/g).join('\r\n ');
  const ics = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const events = REMINDERS.map(([mo, d, title, text], i) => {
      // the next time this date comes round
      const y = (mo - 1 < m || (mo - 1 === m && d < today.getDate())) ? year + 1 : year;
      const day = `${y}${pad(mo)}${pad(d)}`;
      const after = new Date(Date.UTC(y, mo - 1, d + 1));
      const end = `${after.getUTCFullYear()}${pad(after.getUTCMonth() + 1)}${pad(after.getUTCDate())}`;
      return [
        'BEGIN:VEVENT',
        `UID:rr-calendar-${i + 1}@romanoinvest.co.il`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`,
        `DTEND;VALUE=DATE:${end}`,
        'RRULE:FREQ=YEARLY',
        `SUMMARY:${esc(title)}`,
        `DESCRIPTION:${esc(`${text} ${PAGE}`)}`,
        `URL:${PAGE}`,
        'END:VEVENT',
      ].map(fold).join('\r\n');
    });
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roei Romano//Financial calendar//HE', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
  };
  const button = document.querySelector('[data-ics]');
  if (button) button.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([ics()], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'romano-financial-calendar.ics';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
