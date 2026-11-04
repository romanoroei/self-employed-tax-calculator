// Year-end reminder for the self-employed: shown until 31.12 on the home page and magazine pages.
// Waits until the cookie notice is closed, then appears after 6 seconds or a third of the page scrolled.
// A visitor who closes it does not see it for 3 days (1 day in the last week). Kept in localStorage only.
(() => {
  const END = new Date('2027-01-01T00:00:00+02:00');
  const now = new Date();
  if (now >= END) return;
  const days = Math.max(1, Math.ceil((END - now) / 86400000));

  // Until the year ends the calculator leads the "כלים וידע" menu, with a year-end tag.
  const menu = document.getElementById('tools-menu');
  const calcItem = menu && menu.querySelector('a[href^="/self-employed-tax-calculator/"]');
  if (calcItem) {
    menu.prepend(calcItem);
    calcItem.classList.add('is-yearend');
    const k = calcItem.querySelector('.k');
    if (k) k.insertAdjacentHTML('beforeend', ' <span class="ye-tag">סוף שנה</span>');
  }
  const KEY = 'rr-yearend-2026';
  const store = {
    get() { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } },
    set(v) { try { localStorage.setItem(KEY, String(v)); } catch { /* private mode: closed for this visit */ } },
  };
  const quiet = (days <= 7 ? 1 : 3) * 86400000;
  if (now - store.get() < quiet) return;

  const text = days <= 7
    ? { title: 'שבוע אחרון. <em>מה שלא תפקידו עד 31.12, מס הכנסה ישמח לקחת.</em>', sub: 'חלק מהקופות סוגרות הפקדות כמה ימים לפני סוף השנה. בדיקה של דקה, עכשיו.', cta: 'בודק עכשיו ←' }
    : days <= 21
    ? { title: `עצמאי? <em>${days} ימים</em> להחליט אם הכסף הולך לחיסכון שלך או למס הכנסה.`, sub: 'המחשבון מראה בדקה כמה מס חוסכים בהפקדה עד סוף השנה.', cta: 'תראו לי את המספר ←' }
    : { title: 'עצמאים, אין לכם מעסיק שיפקיד בשבילכם. <em>יש לכם עד 31.12.</em>', sub: 'הפקדה לפנסיה ולקרן השתלמות לפני סוף השנה מקטינה את המס של 2026. בדקו בדקה כמה זה אצלכם.', cta: 'כמה אחסוך? ←' };

  const card = document.createElement('aside');
  card.className = 'ye';
  card.setAttribute('aria-label', 'תזכורת: סוף שנת המס');
  card.hidden = true;
  if (document.querySelector('.back-home')) card.classList.add('ye--raised');
  card.innerHTML = `
    <div class="ye-cal" aria-hidden="true"><small>עד 31.12</small><strong>${days}</strong><span>${days === 1 ? 'יום' : 'ימים'}</span></div>
    <div class="ye-txt"><p class="ye-title">${text.title}</p><p class="ye-sub">${text.sub}</p></div>
    <a class="ye-cta" href="/self-employed-tax-calculator/?utm_source=site&amp;utm_medium=banner&amp;utm_campaign=yearend2026"><span>${text.cta}</span><small>המחשבון תמיד זמין גם ב"כלים וידע"</small></a>
    <button type="button" class="ye-x" aria-label="סגירת התזכורת">×</button>`;
  card.querySelector('.ye-x').addEventListener('click', () => { card.hidden = true; card.dataset.closed = '1'; store.set(Date.now()); });
  document.body.append(card);

  let ready = false;
  const cookieOpen = () => document.body.classList.contains('has-cookie-notice');
  const show = () => { if (ready && !cookieOpen() && card.hidden && !card.dataset.closed) card.hidden = false; };
  const go = () => { if (ready) return; ready = true; window.removeEventListener('scroll', onScroll); show(); };
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max >= 1 / 3) go();
  };
  setTimeout(go, 6000);
  window.addEventListener('scroll', onScroll, { passive: true });
  // the cookie notice and this card both live at the bottom: wait until the notice is closed
  new MutationObserver(show).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
