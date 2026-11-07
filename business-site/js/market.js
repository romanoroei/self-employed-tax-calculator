// The home page's markets tile. The funds tab is plain HTML from the build; this switches its
// views and draws its chart. The rates tab reads /api/rates, and only once it is opened.
(() => {
  const tile = document.querySelector('[data-market]');
  if (!tile) return;

  const RATES = [['il', 'ישראל', 'ריבית בנק ישראל'], ['us', 'ארה"ב', 'ריבית הפד, הטווח העליון'], ['eu', 'אירופה', 'ריבית הפיקדון של הבנק האירופי'], ['uk', 'לונדון', 'ריבית בנק אנגליה']];

  const number = (v, digits = 2) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (v, digits) => `${v > 0 ? '+' : ''}${number(v, digits)}`;
  const monthYear = (date) => `${date.getMonth() + 1}/${String(date.getFullYear()).slice(2)}`;
  const ltr = (text) => `<span dir="ltr">${text}</span>`;

  // ---------- the chart ----------
  const SVG_PAD = { left: 6, right: 54, top: 8, bottom: 20 };

  function niceTicks(min, max) {
    const raw = (max - min) / 3 || Math.abs(max) / 10 || 1;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find((n) => n * power >= raw) * power;
    const ticks = [];
    for (let t = Math.ceil(min / step) * step; t <= max + step / 1000; t += step) ticks.push(Number(t.toFixed(8)));
    return ticks;
  }

  // options: { points: [[x, value]], byX, step, base, format, xLabel }
  function draw(svg, options) {
    svg.__chart = options;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    if (!width || !height) return;
    const { points, byX, step, base, format, xLabel } = options;
    const values = points.map((p) => p[1]);
    if (base !== null && base !== undefined) values.push(base);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const margin = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
    min -= margin; max += margin;
    const right = width - SVG_PAD.right;
    const bottom = height - SVG_PAD.bottom;
    const first = points[0][0];
    const span = points[points.length - 1][0] - first || 1;
    const x = (p, i) => SVG_PAD.left + (right - SVG_PAD.left) * (byX ? (p[0] - first) / span : i / (points.length - 1));
    const y = (v) => SVG_PAD.top + (bottom - SVG_PAD.top) * (1 - (v - min) / (max - min));
    let line = '';
    points.forEach((p, i) => {
      const px = x(p, i).toFixed(1);
      const py = y(p[1]).toFixed(1);
      if (!i) line = `M${px} ${py}`;
      else line += step ? `H${px}V${py}` : `L${px} ${py}`;
    });
    const end = points.length - 1;
    const area = `${line}L${x(points[end], end).toFixed(1)} ${bottom}L${x(points[0], 0).toFixed(1)} ${bottom}Z`;
    const grid = niceTicks(min, max).map((t) => `<line class="chart-grid" x1="${SVG_PAD.left}" x2="${right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="chart-label" x="${right + 6}" y="${(y(t) + 4).toFixed(1)}">${format(t)}</text>`).join('');
    const count = width < 360 ? 3 : 4;
    const seen = new Set();
    const xTicks = Array.from({ length: count }, (_, n) => {
      const share = (n + 0.5) / count;
      // on a time scale the ticks are even in time, otherwise even in points
      const spot = byX ? [Math.round(first + span * share), 0] : points[Math.round(share * end)];
      const label = xLabel(spot[0]);
      if (seen.has(label)) return '';
      seen.add(label);
      const px = SVG_PAD.left + (right - SVG_PAD.left) * share;
      return `<text class="chart-label" text-anchor="middle" x="${px.toFixed(1)}" y="${height - 5}">${label}</text>`;
    }).join('');
    const baseLine = base === null || base === undefined ? '' : `<line class="chart-base" x1="${SVG_PAD.left}" x2="${right}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}"/>`;
    svg.innerHTML = `${grid}${baseLine}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${xTicks}<g class="chart-cross" hidden><line y1="${SVG_PAD.top}" y2="${bottom}"/><circle r="3.5"/><text class="chart-value" y="${SVG_PAD.top + 10}"></text></g>`;
    svg.__at = (px) => {
      let best = 0;
      points.forEach((p, i) => { if (Math.abs(x(p, i) - px) < Math.abs(x(points[best], best) - px)) best = i; });
      return { px: x(points[best], best), py: y(points[best][1]), text: `${xLabel(points[best][0])}  ${format(points[best][1])}` };
    };
  }

  function follow(svg) {
    new ResizeObserver(() => { if (svg.__chart) draw(svg, svg.__chart); }).observe(svg);
    svg.addEventListener('pointermove', (e) => {
      const group = svg.querySelector('.chart-cross');
      if (!group || !svg.__at) return;
      const spot = svg.__at(e.clientX - svg.getBoundingClientRect().left);
      group.hidden = false;
      const [rule, dot, label] = group.children;
      rule.setAttribute('x1', spot.px); rule.setAttribute('x2', spot.px);
      dot.setAttribute('cx', spot.px); dot.setAttribute('cy', spot.py);
      label.textContent = spot.text;
      const onRight = spot.px < svg.clientWidth / 2;
      label.setAttribute('x', onRight ? spot.px + 8 : spot.px - 8);
      label.setAttribute('text-anchor', onRight ? 'start' : 'end');
    });
    svg.addEventListener('pointerleave', () => { const group = svg.querySelector('.chart-cross'); if (group) group.hidden = true; });
  }

  // ---------- the funds tab ----------
  const fundsPanel = tile.querySelector('[data-market-panel="funds"]');
  const series = JSON.parse(document.getElementById('yield-series').textContent);
  const fundsChart = fundsPanel.querySelector('.market-chart svg');
  const fundsTitle = fundsPanel.querySelector('.market-chart figcaption');
  follow(fundsChart);
  const periodDate = (period, plus) => new Date(Math.floor(period / 100), period % 100 - 1 + plus, 1);
  let [product, track, sort] = fundsPanel.querySelector('table[data-yield-view]:not([hidden])').dataset.yieldView.split('-');
  let pickedFund = null;

  function pickFund(table) {
    const button = table.querySelector(`[data-yield-row="${pickedFund}"]`) || table.querySelector('[data-yield-row]');
    pickedFund = button.dataset.yieldRow;
    fundsPanel.querySelectorAll('tbody tr').forEach((row) => row.classList.remove('is-picked'));
    table.querySelectorAll('[data-yield-row]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    button.closest('tr').classList.add('is-picked');
    const { start, label, values } = series[pickedFund];
    fundsTitle.textContent = `${button.textContent}: תשואה מצטברת מ${label}`;
    draw(fundsChart, {
      points: values.map((v, i) => [i, v]), byX: true, base: 0,
      format: (v) => `${number(v, Number.isInteger(v) ? 0 : 1)}%`,
      xLabel: (i) => monthYear(periodDate(start, i)),
    });
  }
  fundsPanel.addEventListener('click', (e) => {
    const table = e.target.closest('table[data-yield-view]');
    const row = e.target.closest('tbody tr');
    if (table && row) { pickedFund = row.querySelector('[data-yield-row]').dataset.yieldRow; pickFund(table); return; }
    const button = e.target.closest('button');
    if (!button) return;
    const { yieldProduct, yieldTrack, yieldSort } = button.dataset;
    product = yieldProduct || product;
    track = yieldTrack || track;
    sort = yieldSort || sort;
    if (!yieldSort) button.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const view = `${product}-${track}-${sort}`;
    fundsPanel.querySelectorAll('[data-yield-view]').forEach((el) => { el.hidden = el.dataset.yieldView !== view; });
    const table2 = fundsPanel.querySelector(`table[data-yield-view="${view}"]`);
    pickFund(table2);
    // the clicked heading belonged to a table that just hid: keep the focus on its twin
    if (yieldSort) table2.querySelector(`[data-yield-sort="${yieldSort}"]`).focus();
  });
  pickFund(fundsPanel.querySelector('table[data-yield-view]:not([hidden])'));

  // ---------- the rates tab ----------
  const chartBlock = '<figure class="market-chart"><figcaption></figcaption><div class="market-plot"><svg></svg></div></figure>';
  const noteBlock = '<p class="yield-note"><strong data-updated>&nbsp;</strong><span data-source></span></p>';
  const panels = {};

  function buildRates() {
    const element = tile.querySelector('[data-market-panel="rates"]');
    element.innerHTML = `${chartBlock}<div class="yield-tables market-table"><table><caption class="visually-hidden">ריביות בנקים מרכזיים</caption><thead><tr><th scope="col">בנק מרכזי</th><th scope="col">ריבית</th><th scope="col">שינוי אחרון</th><th scope="col">מתאריך</th></tr></thead><tbody>`
      + RATES.map(([id, label], i) => `<tr data-row="${id}"${i ? '' : ' class="is-picked"'}><th scope="row"><button type="button" aria-pressed="${!i}">${label}</button></th><td data-price>—</td><td data-change>—</td><td data-date>—</td></tr>`).join('')
      + `</tbody></table></div>${noteBlock}`;
    const panel = { name: 'rates', element, picked: 'il', svg: element.querySelector('svg'), title: element.querySelector('figcaption'), items: null };
    follow(panel.svg);
    element.querySelector('[data-source]').textContent = 'לפי בנק ישראל, הבנק הפדרלי של ניו יורק, הבנק המרכזי האירופי ובנק אנגליה. המידע אינו המלצה.';
    element.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr');
      if (!row) return;
      panel.picked = row.dataset.row;
      element.querySelectorAll('tbody tr').forEach((r) => {
        r.classList.toggle('is-picked', r === row);
        r.querySelector('button').setAttribute('aria-pressed', String(r === row));
      });
      drawRate(panel);
    });
    panels.rates = panel;
  }

  const stamp = (seconds) => new Date(seconds * 1000).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const say = (panel, text) => { panel.element.querySelector('[data-updated]').textContent = text; };
  const UNAVAILABLE = 'הנתונים לא זמינים כרגע';

  function drawRate(panel) {
    const [, , title] = RATES.find(([id]) => id === panel.picked);
    panel.title.textContent = `${title}, 5 שנים`;
    const item = panel.items?.find((i) => i.id === panel.picked);
    if (!item) { panel.svg.replaceChildren(); return; }
    const points = item.history.map(([date, value]) => [new Date(`${date}T00:00:00Z`).getTime() / 1000, value]);
    points.push([Date.now() / 1000, points[points.length - 1][1]]);
    draw(panel.svg, {
      points, byX: true, step: true,
      format: (v) => `${number(v, 2)}%`,
      xLabel: (seconds) => monthYear(new Date(seconds * 1000)),
    });
  }

  async function loadRates() {
    const panel = panels.rates;
    try {
      const response = await fetch('/api/rates');
      if (!response.ok) throw new Error(String(response.status));
      const { updated, items } = await response.json();
      panel.items = items;
      for (const item of items) {
        const row = panel.element.querySelector(`[data-row="${item.id}"]`);
        const last = item.history[item.history.length - 1];
        const before = item.history[item.history.length - 2];
        const [year, month, day] = last[0].split('-').map(Number);
        row.querySelector('[data-price]').innerHTML = ltr(item.from === undefined ? `${number(last[1], 2)}%` : `${number(item.from, 2)}–${number(last[1], 2)}%`);
        row.querySelector('[data-change]').innerHTML = before ? ltr(signed(last[1] - before[1], 2)) : '—';
        row.querySelector('[data-date]').innerHTML = ltr(`${day}.${month}.${year}`);
      }
      say(panel, `עודכן ${stamp(updated)}`);
      drawRate(panel);
    } catch {
      say(panel, UNAVAILABLE);
    }
  }

  // ---------- the tabs ----------
  const tabs = [...tile.querySelectorAll('[data-market-tab]')];
  let active = 'funds';
  let ratesLoaded = false;

  function show(name) {
    active = name;
    for (const tab of tabs) {
      const on = tab.dataset.marketTab === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    tile.querySelectorAll('[data-market-panel]').forEach((el) => { el.hidden = el.dataset.marketPanel !== name; });
    if (name === 'rates' && !ratesLoaded) { ratesLoaded = true; loadRates(); }
  }

  tile.querySelector('.market-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-market-tab]');
    if (tab) show(tab.dataset.marketTab);
  });
  tile.querySelector('.market-tabs').addEventListener('keydown', (e) => {
    const move = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
    if (!move) return;
    e.preventDefault();
    const next = tabs[(tabs.findIndex((t) => t.dataset.marketTab === active) + move + tabs.length) % tabs.length];
    show(next.dataset.marketTab);
    next.focus();
  });

  buildRates();
})();
