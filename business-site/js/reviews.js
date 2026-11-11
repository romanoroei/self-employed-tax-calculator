// Market reviews: year filter on the hub, copy-link on a review, and anonymous counts (functions/api/count.js).
// Only a label goes out: the month, and for visits from a measured link the channel from a fixed list.
// No address, name or identifier is ever sent. Without scripting the pages work as plain pages.
(() => {
  const page = document.currentScript && document.currentScript.dataset.reviewPage;
  const send = (label) => { try { navigator.sendBeacon('/api/count', label); } catch (e) { /* counting is optional */ } };
  const live = ['romanoinvest.co.il', 'www.romanoinvest.co.il'].includes(location.hostname);

  if (page && /^20\d\d-(?:0[1-9]|1[0-2])$/.test(page)) {
    if (live) {
      send('review:view-' + page);
      const source = new URLSearchParams(location.search).get('utm_source');
      if (source) send('review:from-' + (['whatsapp', 'facebook', 'instagram', 'tiktok', 'email'].includes(source) ? source : 'other') + '-' + page);
    }
    // copy the clean address (no measuring parameters), and say so to screen readers
    document.querySelectorAll('.rv-copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const status = document.querySelector('.rv-copied');
        const label = btn.querySelector('span');
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          label.textContent = 'הקישור הועתק';
          btn.classList.add('is-done');
          if (status) status.textContent = 'הקישור הועתק';
          if (live && btn.dataset.countCopy) send(btn.dataset.countCopy);
          setTimeout(() => { label.textContent = 'להעתיק קישור'; btn.classList.remove('is-done'); }, 2400);
        } catch (e) {
          window.prompt('להעתקת הקישור:', btn.dataset.copy);
        }
      });
    });
  }

  if (page === 'hub') {
    if (live) send('review:hub');
    const group = document.querySelector('.rv-years');
    if (!group) return;
    group.hidden = false;
    const cards = document.querySelectorAll('.rv-archive-grid .rv-card');
    const status = document.querySelector('.rv-filter-status');
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.rv-year');
      if (!btn) return;
      group.querySelectorAll('.rv-year').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      cards.forEach((c) => { const on = !btn.dataset.year || c.dataset.year === btn.dataset.year; c.hidden = !on; if (on) shown++; });
      if (status) status.textContent = shown + ' סקירות מוצגות';
    });
  }
})();
