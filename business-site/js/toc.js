/* "בעמוד הזה": builds a table of contents from the article's h2s and marks the section being read. Styles: css/toc.css */
(() => {
  const article = document.querySelector('main article');
  if (!article) return;
  const heads = [...article.querySelectorAll('h2')].filter((h) => h.textContent.trim());
  if (heads.length < 4) return;

  heads.forEach((h, i) => { if (!h.id) h.id = 'part-' + (i + 1); });
  const nav = document.createElement('nav');
  nav.className = 'toc';
  nav.setAttribute('aria-label', 'בעמוד הזה');
  nav.innerHTML =
    '<button class="toc-toggle" type="button" aria-expanded="false"><small>בעמוד הזה</small><strong></strong>' +
    '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5l5 5 5-5"/></svg></button>' +
    '<div class="toc-meter" aria-hidden="true"><span></span></div>' +
    '<div class="toc-panel"><p class="toc-label">בעמוד הזה</p><ol class="toc-list"></ol></div>';
  const list = nav.querySelector('.toc-list');
  const links = heads.map((h) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    li.append(a);
    list.append(li);
    return a;
  });
  // desktop: meter sits under the list
  const meter = nav.querySelector('.toc-meter');
  const panel = nav.querySelector('.toc-panel');
  const current = nav.querySelector('.toc-toggle strong');
  const toggle = nav.querySelector('.toc-toggle');
  const head = article.querySelector('.art-head');
  (head || article.firstElementChild).after(nav);
  document.body.classList.add('has-toc');

  const wide = matchMedia('(min-width: 1180px)');
  const placeMeter = () => (wide.matches ? panel.append(meter) : toggle.after(meter));
  placeMeter();
  wide.addEventListener('change', placeMeter);

  const setOpen = (open) => { nav.classList.toggle('is-open', open); document.body.classList.toggle('toc-open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  const fill = meter.querySelector('span');
  let active = -1;
  const update = () => {
    const line = innerHeight * (wide.matches ? 0.3 : 0.4);
    let i = 0;
    heads.forEach((h, n) => { if (h.getBoundingClientRect().top <= line) i = n; });
    if (i !== active) {
      active = i;
      links.forEach((a, n) => (n === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      current.textContent = heads[i].textContent.trim();
      if (wide.matches && nav.scrollHeight > nav.clientHeight) nav.scrollTop = links[i].offsetTop - nav.clientHeight / 2;
    }
    const box = article.getBoundingClientRect();
    const done = Math.min(1, Math.max(0, (line - box.top) / (box.height - line)));
    fill.style.width = (done * 100).toFixed(1) + '%';
    // desktop: show while the guide's sections are on screen
    const first = heads[0].getBoundingClientRect().top;
    nav.classList.toggle('is-shown', first < innerHeight * 0.75 && box.bottom > innerHeight * 0.5);
  };
  let queued = false;
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
})();
