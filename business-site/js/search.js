/* Site search (Roei, 27.11.2026): a "חיפוש" button in the top bar of every page opens a search over all the guides,
   tools and market reviews. The index (/search-index.json) is written at build time by scripts/build-cloudflare.mjs
   from the published pages, so it always matches the site. Styles: css/search.css.
   /knowledge also has the same search inline, in a form marked data-ss-inline.
   Hebrew matching: prefixes (ו ה ב ל מ ש כ) and plural endings are tried off, final letters and ״ ׳ are ignored,
   and a few everyday words map to the words the guides use. Nothing typed is sent anywhere. */
(() => {
  const INDEX_URL = '/search-index.json';
  const MAX = 8;
  const POPULAR = [
    ['דמי ניהול', '/management-fees'],
    ['פנסיה לעצמאים', '/self-employed'],
    ['קרן השתלמות', '/study-fund'],
    ['כסף פנוי בעו״ש', '/cash-in-bank-account'],
    ['פיצויים וטופס 161', '/severance'],
    ['קופת גמל להשקעה', '/investment-fund'],
  ];
  // everyday words -> words the pages use
  const ALIASES = {
    'עוש': ['עו״ש', 'עובר ושב', 'חשבון הבנק'],
    'פיצויים': ['פיצויים', '161'],
    'קהש': ['קרן השתלמות', 'השתלמות'],
    'עוסק': ['עצמאי', 'עצמאים'],
    'פרישה': ['פרישה', 'פורש', 'קצבה'],
    'משכנתא': ['משכנתא', 'הלוואה'],
    'ריבית': ['ריבית', 'פיקדון'],
    'מניות': ['מניות', 'מסלול מנייתי', 'S&P'],
    'השקעה': ['השקעה', 'להשקיע', 'השקעות'],
    'מס': ['מס', 'מיסוי'],
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  const clean = (s) => s.toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[״"׳'`]/g, '').replace(/[ךםןףץ]/g, (c) => FINAL[c]);
  const words = (q) => clean(q).split(/[^\p{L}\p{N}%&]+/u).filter((w) => w.length > 1 || /\d/.test(w));

  // a word as a pattern over the original text: any letter with a final form matches both, ״ ׳ may sit between letters
  const LETTER = { 'כ': '[כך]', 'מ': '[מם]', 'נ': '[נן]', 'פ': '[פף]', 'צ': '[צץ]' };
  const toPattern = (w) => [...w].map((c) => LETTER[c] || c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('["״׳\']?');

  // the variants of one typed word, longest first
  function variants(w) {
    const out = new Set([w]);
    let base = w;
    for (let i = 0; i < 2 && base.length > 3 && /^[והבלמשכ]/.test(base); i++) { base = base.slice(1); out.add(base); }
    for (const v of [...out]) {
      if (v.length > 4 && /(ים|ות)$/.test(v)) out.add(v.slice(0, -2));
      if (v.length > 4 && /[הת]$/.test(v)) out.add(v.slice(0, -1));
    }
    for (const v of [...out]) for (const a of ALIASES[v] || []) out.add(clean(a));
    return [...out].sort((a, b) => b.length - a.length);
  }
  const termOf = (w) => {
    const vs = variants(w);
    return { w, re: new RegExp(vs.map(toPattern).join('|'), 'i'), reG: new RegExp(vs.map(toPattern).join('|'), 'gi') };
  };

  let index = null, loading = null;
  const load = () => loading || (loading = fetch(INDEX_URL, { credentials: 'same-origin' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { index = d.pages || []; return index; })
    .catch(() => { loading = null; index = null; return null; }));

  function search(q) {
    const ws = words(q);
    if (!ws.length || !index) return [];
    const terms = ws.map(termOf);
    const phrase = q.trim().length > 3 ? new RegExp(toPattern(clean(q.trim())), 'i') : null;
    const scored = [];
    for (const p of index) {
      let score = 0, hit = 0;
      for (const t of terms) {
        let best = 0;
        if (t.re.test(p.t)) best = 12;
        if (best < 7 && p.s.some((s) => t.re.test(s[0]))) best = 7;
        if (best < 5 && t.re.test(p.d)) best = 5;
        if (best < 3 && t.re.test(p.k)) best = 3;
        if (!best) { const n = p.s.reduce((a, s) => a + ((s[2].match(t.reG) || []).length), 0); if (n) best = Math.min(1 + n * 0.3, 4); }
        if (best) { hit++; score += best; }
      }
      if (!hit) continue;
      if (phrase && phrase.test(p.t)) score += 10;
      score += (p.w || 0);
      // the section that matches best gives the deep link and the excerpt
      let sec = null, secScore = 0;
      for (const s of p.s) {
        let v = 0;
        for (const t of terms) { if (t.re.test(s[0])) v += 6; v += Math.min((s[2].match(t.reG) || []).length, 4); }
        if (phrase && (phrase.test(s[0]) || phrase.test(s[2]))) v += 6;
        if (v > secScore) { secScore = v; sec = s; }
      }
      scored.push({ p, score, hit, sec });
    }
    // pages with every word first; when they are few, the closest ones follow
    const byScore = (a, b) => b.score - a.score;
    const full = scored.filter((r) => r.hit === terms.length).sort(byScore);
    const near = full.length < 4 ? scored.filter((r) => r.hit < terms.length && r.hit >= Math.ceil(terms.length / 2)).sort(byScore) : [];
    return [...full, ...near].slice(0, MAX).map((r) => ({ ...r, terms, partial: !full.length }));
  }

  function mark(text, terms) {
    const all = new RegExp(terms.map((t) => t.reG.source).join('|'), 'gi');
    let out = '', last = 0;
    for (const m of text.matchAll(all)) { if (!m[0]) continue; out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
    return out + esc(text.slice(last));
  }
  function excerpt(text, terms) {
    if (!text) return '';
    let at = -1;
    for (const t of terms) { const m = text.match(t.re); if (m && (at < 0 || m.index < at)) at = m.index; }
    if (at < 0) return text.length > 150 ? text.slice(0, 150).replace(/\s\S*$/, '') + '…' : text;
    let start = Math.max(0, at - 50);
    if (start > 0) start = text.indexOf(' ', start) + 1 || start;
    let end = Math.min(text.length, start + 160);
    if (end < text.length) end = text.lastIndexOf(' ', end) > start ? text.lastIndexOf(' ', end) : end;
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function render(results, q) {
    if (!results.length) {
      return '<p class="ss-empty">לא מצאתי עמוד על <strong>' + esc(q.trim()) + '</strong>. נסו מילה אחרת, או <a class="link" href="https://wa.me/972528089808?text=' +
        encodeURIComponent('היי רועי, חיפשתי באתר ולא מצאתי: ' + q.trim()) + '" target="_blank" rel="noopener">שאלו את רועי בוואטסאפ</a>.</p>';
    }
    return (results[0].partial ? '<p class="ss-note">אין עמוד שמכיל את כל המילים. הכי קרובים:</p>' : '') +
      '<ol class="ss-results">' + results.map(({ p, sec, terms }) => {
        const deep = sec && sec[1] && sec[0] && !new RegExp('^' + toPattern(clean(sec[0])) + '$', 'i').test(p.t);
        const href = p.u + (deep ? '#' + sec[1] : '');
        const ext = /^https?:/.test(p.u);
        return '<li><a class="ss-hit" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' +
          '<span class="ss-k">' + esc(p.k) + (deep ? ' · <span class="ss-in">' + mark(sec[0], terms) + '</span>' : '') + '</span>' +
          '<strong>' + mark(p.t, terms) + '</strong>' +
          '<small>' + mark(excerpt(sec && sec[2] && sec[2].length > 20 ? sec[2] : p.d, terms), terms) + '</small></a></li>';
      }).join('') + '</ol>';
  }
  const popular = () => '<p class="ss-label">חיפושים נפוצים</p><ul class="ss-popular">' +
    POPULAR.map(([t, u]) => '<li><a href="' + u + '">' + esc(t) + '</a></li>').join('') + '</ul>' +
    '<p class="ss-all"><a class="link" href="/knowledge">כל המדריכים והכלים לפי נושא</a></p>';

  // one input + one output box: used by the overlay and by the inline search on /knowledge
  function wire(input, out, { emptyHtml = '' } = {}) {
    let timer = 0;
    const run = async () => {
      const q = input.value;
      if (!words(q).length) { out.innerHTML = emptyHtml; return; }
      if (!index) { out.innerHTML = '<p class="ss-note">טוען…</p>'; await load(); }
      if (!index) { out.innerHTML = '<p class="ss-empty">החיפוש לא נטען. נסו שוב בעוד רגע.</p>'; return; }
      if (input.value !== q) return;
      out.innerHTML = render(search(q), q);
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 90); });
    input.addEventListener('focus', load, { once: true });
    input.addEventListener('keydown', (e) => {
      const hits = [...out.querySelectorAll('a')];
      if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); hits[0].focus(); }
      if (e.key === 'Enter') { e.preventDefault(); const first = out.querySelector('.ss-hit'); if (first) first.click(); else run(); }
    });
    out.addEventListener('keydown', (e) => {
      const hits = [...out.querySelectorAll('a')];
      const i = hits.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); (hits[i + 1] || hits[i]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (hits[i - 1] || input).focus(); }
    });
    out.innerHTML = emptyHtml;
    return run;
  }

  // ---- the top bar button and the overlay ----
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
  const bar = document.querySelector('.topbar');
  let open = () => {};
  if (bar) {
    bar.classList.add('has-search');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bar-search';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', 'site-search');
    btn.setAttribute('aria-label', 'חיפוש באתר');
    btn.innerHTML = ICON + '<span>חיפוש</span>';
    const tools = bar.querySelector('.bar-tools');
    if (tools) tools.after(btn); else bar.append(btn);

    const box = document.createElement('div');
    box.className = 'ss';
    box.id = 'site-search';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'חיפוש באתר');
    box.innerHTML = '<div class="ss-panel"><form class="ss-form" role="search" action="/knowledge">' + ICON +
      '<input class="ss-input" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="מה תרצו לבדוק? למשל: דמי ניהול" aria-label="חיפוש באתר">' +
      '<button class="ss-close" type="button" aria-label="סגירת החיפוש"><span aria-hidden="true">×</span></button></form>' +
      '<div class="ss-out" aria-live="polite"></div></div>';
    document.body.append(box);
    const input = box.querySelector('.ss-input');
    const out = box.querySelector('.ss-out');
    wire(input, out, { emptyHtml: popular() });

    let lastFocus = null;
    let hideTimer = 0;
    open = (q) => {
      lastFocus = document.activeElement;
      clearTimeout(hideTimer);
      box.hidden = false;
      // a frame later, so the fade-in runs from the hidden state (Roei: appear gently, not all at once)
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-in')));
      document.documentElement.classList.add('ss-open');
      btn.setAttribute('aria-expanded', 'true');
      if (typeof q === 'string') { input.value = q; input.dispatchEvent(new Event('input')); }
      input.focus();
      load();
    };
    const close = () => {
      box.classList.remove('is-in');
      hideTimer = setTimeout(() => { box.hidden = true; }, 220);
      document.documentElement.classList.remove('ss-open');
      btn.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => open());
    box.querySelector('.ss-close').addEventListener('click', close);
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    // a result on this same page: close first, so the page can scroll to it
    out.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && a.pathname === location.pathname && a.hash) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && box.classList.contains('is-in')) { e.preventDefault(); close(); return; }
      const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
      if (!box.classList.contains('is-in') && !typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); open(); }
      // keep the focus inside the dialog
      if (e.key === 'Tab' && box.classList.contains('is-in')) {
        const f = [...box.querySelectorAll('input, button, a[href]')];
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  // ---- /knowledge: the same search inline, under the page title ----
  const inline = document.querySelector('[data-ss-inline]');
  if (inline) {
    const input = inline.querySelector('input');
    const out = inline.querySelector('.kn-search-out');
    const run = wire(input, out);
    inline.addEventListener('submit', (e) => e.preventDefault());
    const q = new URLSearchParams(location.search).get('q');
    if (q) { input.value = q; load().then(run); }
  }

  // ---- a link from the search to an answer folded in <details>: open it ----
  const unfold = () => {
    if (!location.hash) return;
    let el = null;
    try { el = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
    const d = el && el.closest('details');
    if (d && !d.open) { d.open = true; requestAnimationFrame(() => el.scrollIntoView()); }
  };
  unfold();
  window.addEventListener('hashchange', unfold);
})();
