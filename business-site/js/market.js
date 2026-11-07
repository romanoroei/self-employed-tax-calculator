// The home page's markets tile.
// - Funds: plain HTML from the build, with each ranked fund's monthly yields for the chart.
// - Indices: TradingView's widget, loaded only when the tab is opened.
// - Currencies and rates: /api/fx and /api/rates, official daily figures, read when their tab is opened.
// Every chart here takes a time range, shows the value under the pointer,
// and measures the change between two points when you drag across it.
(() => {
  const tile = document.querySelector('[data-market]');
  if (!tile) return;

  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const YEAR_MS = 365.25 * 86400000;
  const number = (v, digits = 2) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (v, digits = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${number(Math.abs(v), digits)}`;
  const tone = (v) => (v > 0 ? 'is-up' : v < 0 ? 'is-down' : '');
  const ltr = (text) => `<span dir="ltr">${text}</span>`;
  const day = (t) => { const d = new Date(t); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
  const month = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getFullYear()}`; };
  const isoTime = (iso) => new Date(`${iso}T00:00:00Z`).getTime();

  // ---------- the chart ----------
  const PAD = { left: 6, right: 56, top: 10, bottom: 20 };

  function niceTicks(min, max) {
    const raw = (max - min) / 3 || Math.abs(max) / 10 || 1;
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].find((n) => n * power >= raw) * power;
    const ticks = [];
    for (let t = Math.ceil(min / step) * step; t <= max + step / 1000; t += step) ticks.push(Number(t.toFixed(8)));
    return ticks;
  }

  function axisLabel(t, span) {
    const d = new Date(t);
    if (span < 120 * 86400000) return `${d.getDate()}.${d.getMonth() + 1}`;
    if (span < 4 * YEAR_MS) return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
    return String(d.getFullYear());
  }

  // options: { points: [[time, value]], step, base, axis(v), tip(spot), measure(a, b) }
  // A spot is { t, v, i }: on a step chart the value holds until the next change.
  function makeChart(figure) {
    const svg = figure.querySelector('svg');
    const plot = figure.querySelector('.market-plot');
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    plot.append(tip);
    let options = null;
    let geometry = null;
    let anchor = null;
    let pinned = false;

    function render() {
      tip.hidden = true;
      const width = svg.clientWidth;
      const height = svg.clientHeight;
      if (!options || !width || !height) return;
      const { points, step, base, axis } = options;
      const values = points.map((p) => p[1]);
      if (base !== undefined && base !== null) values.push(base);
      let min = Math.min(...values);
      let max = Math.max(...values);
      const margin = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
      min -= margin; max += margin;
      const first = points[0][0];
      const last = points[points.length - 1][0];
      const span = last - first || 1;
      const right = width - PAD.right;
      const bottom = height - PAD.bottom;
      const x = (t) => PAD.left + (right - PAD.left) * ((t - first) / span);
      const y = (v) => PAD.top + (bottom - PAD.top) * (1 - (v - min) / (max - min));
      let line = '';
      points.forEach(([t, v], i) => {
        const px = x(t).toFixed(1);
        const py = y(v).toFixed(1);
        line += !i ? `M${px} ${py}` : step ? `H${px}V${py}` : `L${px} ${py}`;
      });
      const area = `${line}L${x(last).toFixed(1)} ${bottom}L${x(first).toFixed(1)} ${bottom}Z`;
      const grid = niceTicks(min, max).map((v) => `<line class="chart-grid" x1="${PAD.left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="chart-label" x="${right + 6}" y="${(y(v) + 4).toFixed(1)}">${axis(v)}</text>`).join('');
      const count = width < 360 ? 3 : 4;
      const seen = new Set();
      const ticks = Array.from({ length: count }, (_, n) => {
        const t = first + span * ((n + 0.5) / count);
        const label = axisLabel(t, span);
        if (seen.has(label)) return '';
        seen.add(label);
        return `<text class="chart-label" text-anchor="middle" x="${x(t).toFixed(1)}" y="${height - 5}">${label}</text>`;
      }).join('');
      const baseLine = base === undefined || base === null ? '' : `<line class="chart-base" x1="${PAD.left}" x2="${right}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}"/>`;
      svg.innerHTML = `${grid}${baseLine}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${ticks}`
        + `<g class="chart-over" hidden><rect class="chart-band" y="${PAD.top}" height="${bottom - PAD.top}"/><line class="chart-rule" y1="${PAD.top}" y2="${bottom}"/><line class="chart-rule" y1="${PAD.top}" y2="${bottom}"/><circle r="3.5"/><circle r="3.5"/></g>`;
      geometry = { x, y, first, span, right };
    }

    function spotAt(clientX) {
      const { points, step } = options;
      const { first, span, right } = geometry;
      const box = svg.getBoundingClientRect();
      const share = Math.min(1, Math.max(0, (clientX - box.left - PAD.left) / (right - PAD.left)));
      const t = first + span * share;
      let i = 0;
      if (step) {
        while (i + 1 < points.length && points[i + 1][0] <= t) i += 1;
        return { t, v: points[i][1], i };
      }
      let lo = 0;
      let hi = points.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid][0] <= t) lo = mid; else hi = mid; }
      i = t - points[lo][0] <= points[hi][0] - t ? lo : hi;
      return { t: points[i][0], v: points[i][1], i };
    }

    function show(a, b) {
      const over = svg.querySelector('.chart-over');
      if (!over) return;
      const { x, y } = geometry;
      const [band, ruleA, ruleB, dotA, dotB] = over.children;
      const ends = b ? [a, b].sort((p, q) => p.t - q.t) : [a];
      over.hidden = false;
      ruleA.setAttribute('x1', x(ends[0].t)); ruleA.setAttribute('x2', x(ends[0].t));
      dotA.setAttribute('cx', x(ends[0].t)); dotA.setAttribute('cy', y(ends[0].v));
      const two = Boolean(b) && b.t !== a.t;
      for (const el of [band, ruleB, dotB]) el.style.display = two ? '' : 'none';
      if (two) {
        band.setAttribute('x', x(ends[0].t)); band.setAttribute('width', x(ends[1].t) - x(ends[0].t));
        ruleB.setAttribute('x1', x(ends[1].t)); ruleB.setAttribute('x2', x(ends[1].t));
        dotB.setAttribute('cx', x(ends[1].t)); dotB.setAttribute('cy', y(ends[1].v));
      }
      tip.innerHTML = two ? options.measure(ends[0], ends[1]) : options.tip(a);
      tip.hidden = false;
      const middle = two ? (x(ends[0].t) + x(ends[1].t)) / 2 : x(a.t);
      const room = plot.clientWidth - tip.offsetWidth - 4;
      tip.style.left = `${Math.max(4, Math.min(room, middle - tip.offsetWidth / 2))}px`;
    }

    function hide() {
      const over = svg.querySelector('.chart-over');
      if (over) over.hidden = true;
      tip.hidden = true;
    }

    new ResizeObserver(render).observe(svg);
    svg.addEventListener('pointerdown', (e) => {
      if (!geometry) return;
      pinned = false;
      anchor = spotAt(e.clientX);
      svg.setPointerCapture(e.pointerId);
      show(anchor);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!geometry) return;
      const spot = spotAt(e.clientX);
      if (anchor) show(anchor, spot);
      else if (!pinned) show(spot);
    });
    svg.addEventListener('pointerup', (e) => {
      if (!anchor) return;
      const spot = spotAt(e.clientX);
      pinned = spot.t !== anchor.t;
      if (pinned) show(anchor, spot);
      anchor = null;
    });
    svg.addEventListener('pointerleave', (e) => {
      if (anchor || (pinned && e.pointerType !== 'mouse')) return;
      pinned = false;
      hide();
    });
    return {
      set(next) { options = next; pinned = false; anchor = null; render(); },
      clear() { options = null; geometry = null; svg.replaceChildren(); tip.hidden = true; },
    };
  }

  // A row of range buttons; ranges that need more history than there is are switched off.
  function ranges(group, onPick) {
    group.addEventListener('click', (e) => {
      const button = e.target.closest('[data-range]');
      if (!button || button.disabled) return;
      group.querySelectorAll('[data-range]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      onPick(button.dataset.range);
    });
    return {
      pick(value) { group.querySelectorAll('[data-range]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.range === String(value)))); },
      allow(test) { group.querySelectorAll('[data-range]').forEach((b) => { b.disabled = !test(b.dataset.range); }); },
    };
  }
  const rangeButtons = (list) => `<div class="market-ranges" role="group" aria-label="טווח זמן">${list.map(([id, label]) => `<button type="button" data-range="${id}" aria-pressed="false">${label}</button>`).join('')}</div>`;
  const chartBlock = '<figure class="market-chart"><figcaption></figcaption><div class="market-plot"><svg></svg></div></figure>';
  const HINT = '<span class="chart-hint">גררו על הגרף כדי למדוד תקופה</span>';

  // ---------- the funds tab ----------
  const fundsPanel = tile.querySelector('[data-market-panel="funds"]');
  const series = JSON.parse(document.getElementById('yield-series').textContent);
  const fundsChart = makeChart(fundsPanel.querySelector('.market-chart'));
  const fundsTitle = fundsPanel.querySelector('.market-chart figcaption');
  const COLUMN_RANGE = { y1: 12, y3: 36, y7: 84 };
  let [product, track, sort] = fundsPanel.querySelector('table[data-yield-view]:not([hidden])').dataset.yieldView.split('-');
  let pickedFund = null;
  let fundRange = COLUMN_RANGE[sort];
  const fundRanges = ranges(fundsPanel.querySelector('.market-ranges'), (value) => { fundRange = Number(value); drawFund(); });
  // the month a report period ends, as a time: the first of the next month
  const monthEnd = (period, plus) => new Date(Math.floor(period / 100), period % 100 + plus, 1).getTime();

  function drawFund() {
    const button = fundsPanel.querySelector(`table:not([hidden]) [data-yield-row="${pickedFund}"]`);
    const { start, m } = series[pickedFund];
    fundRanges.allow((r) => Number(r) === 0 || Number(r) <= m.length);
    if (fundRange && fundRange > m.length) fundRange = 0;
    fundRanges.pick(fundRange);
    const from = fundRange ? m.length - fundRange : 0;
    const points = [[monthEnd(start, from - 1), 0]];
    let total = 1;
    for (let i = from; i < m.length; i += 1) { total *= 1 + m[i] / 100; points.push([monthEnd(start, i), (total - 1) * 100]); }
    const shown = (t) => month(t - 86400000);
    const when = fundRange === 12 ? 'בשנה האחרונה' : fundRange ? `ב־${fundRange / 12} השנים האחרונות` : `מ${MONTHS[(start % 100) - 1]} ${Math.floor(start / 100)}`;
    fundsTitle.innerHTML = `${button.textContent}: תשואה מצטברת ${when}`;
    fundsChart.set({
      points, base: 0,
      axis: (v) => `${number(v, Number.isInteger(v) ? 0 : 1)}%`,
      tip: (s) => `<b>${ltr(`${signed(s.v)}%`)}</b> מתחילת התקופה ועד סוף ${shown(s.t)}`,
      measure: (a, b) => `<b>${ltr(`${signed(((1 + b.v / 100) / (1 + a.v / 100) - 1) * 100)}%`)}</b> מסוף ${shown(a.t)} עד סוף ${shown(b.t)}`,
    });
  }

  function pickFund(table) {
    const button = table.querySelector(`[data-yield-row="${pickedFund}"]`) || table.querySelector('[data-yield-row]');
    pickedFund = button.dataset.yieldRow;
    fundsPanel.querySelectorAll('tbody tr').forEach((row) => row.classList.remove('is-picked'));
    table.querySelectorAll('[data-yield-row]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    button.closest('tr').classList.add('is-picked');
    drawFund();
  }
  fundsPanel.addEventListener('click', (e) => {
    if (e.target.closest('.market-ranges, .market-chart')) return;
    const table = e.target.closest('table[data-yield-view]');
    const row = e.target.closest('tbody tr');
    if (table && row) { pickedFund = row.querySelector('[data-yield-row]').dataset.yieldRow; pickFund(table); return; }
    const button = e.target.closest('button');
    if (!button) return;
    const { yieldProduct, yieldTrack, yieldSort } = button.dataset;
    product = yieldProduct || product;
    track = yieldTrack || track;
    if (yieldSort) { sort = yieldSort; fundRange = COLUMN_RANGE[sort]; }
    if (!yieldSort) button.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const view = `${product}-${track}-${sort}`;
    fundsPanel.querySelectorAll('[data-yield-view]').forEach((el) => { el.hidden = el.dataset.yieldView !== view; });
    const shownTable = fundsPanel.querySelector(`table[data-yield-view="${view}"]`);
    pickFund(shownTable);
    // the clicked heading belonged to a table that just hid: keep the focus on its twin
    if (yieldSort) shownTable.querySelector(`[data-yield-sort="${yieldSort}"]`).focus();
  });
  pickFund(fundsPanel.querySelector('table[data-yield-view]:not([hidden])'));

  // ---------- shared by the live tabs ----------
  const noteBlock = '<p class="yield-note"><strong data-updated>&nbsp;</strong><span data-source></span></p>';
  const UNAVAILABLE = 'הנתונים לא זמינים כרגע';
  const getJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  };
  function pickRow(element, row) {
    element.querySelectorAll('tbody tr').forEach((r) => {
      r.classList.toggle('is-picked', r === row);
      r.querySelector('button').setAttribute('aria-pressed', String(r === row));
    });
  }

  // ---------- the currencies tab ----------
  const FX = [['usdils', 'דולר/שקל', 4], ['eurils', 'אירו/שקל', 4], ['gbpils', 'ליש"ט/שקל', 4], ['eurusd', 'אירו/דולר', 4], ['gbpusd', 'ליש"ט/דולר', 4], ['usdjpy', 'דולר/ין יפני', 2], ['usdchf', 'דולר/פרנק', 4]];
  const FX_RANGES = [['1', 'חודש'], ['6', '6 ח׳'], ['12', 'שנה'], ['60', '5 שנים'], ['120', '10 שנים']];
  const fx = { picked: 'usdils', range: 12, history: new Map(), loaded: false };

  function buildFx() {
    const element = tile.querySelector('[data-market-panel="fx"]');
    element.innerHTML = `${rangeButtons(FX_RANGES)}${chartBlock}<div class="yield-tables market-table"><table><caption class="visually-hidden">שערי מטבע</caption><thead><tr><th scope="col">צמד</th><th scope="col">שער</th><th scope="col">שינוי</th><th scope="col">שינוי %</th></tr></thead><tbody>`
      + FX.map(([id, label], i) => `<tr data-row="${id}"${i ? '' : ' class="is-picked"'}><th scope="row"><button type="button" aria-pressed="${!i}">${label}</button></th><td data-price>—</td><td data-change>—</td><td data-percent>—</td></tr>`).join('')
      + `</tbody></table></div>${noteBlock}`;
    fx.element = element;
    fx.chart = makeChart(element.querySelector('.market-chart'));
    fx.title = element.querySelector('figcaption');
    fx.ranges = ranges(element.querySelector('.market-ranges'), (value) => { fx.range = Number(value); drawFx(); });
    fx.ranges.pick(fx.range);
    element.querySelector('[data-source]').innerHTML = `שער יציג של בנק ישראל לצמדים מול השקל, ושערי הבנק המרכזי האירופי לשאר. מתעדכן פעם ביום. המידע אינו המלצה. ${HINT}`;
    element.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr');
      if (!row) return;
      fx.picked = row.dataset.row;
      pickRow(element, row);
      drawFx();
    });
  }

  async function drawFx() {
    const [, label, digits] = FX.find(([id]) => id === fx.picked);
    fx.title.textContent = label;
    const id = fx.picked;
    try {
      if (!fx.history.has(id)) fx.history.set(id, (await getJson(`/api/fx?id=${id}`)).points.map(([d, v]) => [isoTime(d), v]));
      if (id !== fx.picked) return;
      const all = fx.history.get(id);
      const from = all[all.length - 1][0] - fx.range * (YEAR_MS / 12);
      const points = all.filter(([t]) => t >= from);
      fx.chart.set({
        points,
        axis: (v) => number(v, digits === 4 ? 2 : 0),
        tip: (s) => `<b>${ltr(number(s.v, digits))}</b> ב־${day(s.t)}`,
        measure: (a, b) => `<b>${ltr(`${signed((b.v / a.v - 1) * 100)}%`)}</b> מ־${day(a.t)} עד ${day(b.t)}`,
      });
    } catch {
      fx.chart.clear();
    }
  }

  async function loadFx() {
    try {
      const { items } = await getJson('/api/fx');
      for (const item of items) {
        const [, , digits] = FX.find(([id]) => id === item.id);
        const row = fx.element.querySelector(`[data-row="${item.id}"]`);
        const change = item.value - item.previous;
        const percent = (change / item.previous) * 100;
        row.querySelector('[data-price]').innerHTML = ltr(number(item.value, digits));
        row.querySelector('[data-change]').innerHTML = ltr(signed(change, digits));
        row.querySelector('[data-percent]').innerHTML = ltr(`${signed(percent)}%`);
        row.querySelector('[data-change]').className = tone(change);
        row.querySelector('[data-percent]').className = tone(percent);
      }
      const shekel = items.find((i) => i.source === 'boi');
      const euro = items.find((i) => i.source === 'ecb');
      fx.element.querySelector('[data-updated]').textContent = [shekel && `שער יציג ${day(isoTime(shekel.date))}`, euro && `שער אירופי ${day(isoTime(euro.date))}`].filter(Boolean).join(' · ');
    } catch {
      fx.element.querySelector('[data-updated]').textContent = UNAVAILABLE;
    }
    drawFx();
  }

  // ---------- the rates tab ----------
  const RATES = [['il', 'ישראל', 'ריבית בנק ישראל'], ['us', 'ארה"ב', 'ריבית הפד, הטווח העליון'], ['eu', 'אירופה', 'ריבית הפיקדון של הבנק האירופי'], ['uk', 'לונדון', 'ריבית בנק אנגליה']];
  const RATE_RANGES = [['1', 'שנה'], ['5', '5 שנים'], ['10', '10 שנים'], ['20', '20 שנים'], ['0', 'מקס׳']];
  const rates = { picked: 'il', range: 5, items: null, loaded: false };

  function buildRates() {
    const element = tile.querySelector('[data-market-panel="rates"]');
    element.innerHTML = `${rangeButtons(RATE_RANGES)}${chartBlock}<div class="yield-tables market-table"><table><caption class="visually-hidden">ריביות בנקים מרכזיים</caption><thead><tr><th scope="col">בנק מרכזי</th><th scope="col">ריבית</th><th scope="col">שינוי אחרון</th><th scope="col">מתאריך</th></tr></thead><tbody>`
      + RATES.map(([id, label], i) => `<tr data-row="${id}"${i ? '' : ' class="is-picked"'}><th scope="row"><button type="button" aria-pressed="${!i}">${label}</button></th><td data-price>—</td><td data-change>—</td><td data-date>—</td></tr>`).join('')
      + `</tbody></table></div>${noteBlock}`;
    rates.element = element;
    rates.chart = makeChart(element.querySelector('.market-chart'));
    rates.title = element.querySelector('figcaption');
    rates.ranges = ranges(element.querySelector('.market-ranges'), (value) => { rates.range = Number(value); drawRate(); });
    rates.ranges.pick(rates.range);
    element.querySelector('[data-source]').innerHTML = `לפי בנק ישראל, הבנק הפדרלי של ניו יורק, הבנק המרכזי האירופי ובנק אנגליה. המידע אינו המלצה. ${HINT}`;
    element.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr');
      if (!row) return;
      rates.picked = row.dataset.row;
      pickRow(element, row);
      drawRate();
    });
  }

  function drawRate() {
    const [, , title] = RATES.find(([id]) => id === rates.picked);
    const item = rates.items?.find((i) => i.id === rates.picked);
    rates.title.textContent = title;
    if (!item) { rates.chart.clear(); return; }
    const all = item.history.map(([date, value]) => [isoTime(date), value]);
    const now = Date.now();
    const from = rates.range ? now - rates.range * YEAR_MS : all[0][0];
    let before = 0;
    while (before + 1 < all.length && all[before + 1][0] <= from) before += 1;
    const points = [[Math.max(from, all[0][0]), all[before][1]], ...all.slice(before + 1), [now, all[all.length - 1][1]]];
    const oldest = all[0][0];
    rates.ranges.allow((r) => Number(r) === 0 || now - Number(r) * YEAR_MS >= oldest - 31 * 86400000);
    rates.chart.set({
      points, step: true,
      axis: (v) => `${number(v, 2)}%`,
      tip: (s) => `<b>${ltr(`${number(s.v, 2)}%`)}</b> ב־${day(s.t)}`,
      measure: (a, b) => `<b>${ltr(signed(b.v - a.v))}</b> נקודות אחוז מ־${day(a.t)} עד ${day(b.t)}`,
    });
  }

  async function loadRates() {
    try {
      const { updated, items } = await getJson('/api/rates');
      rates.items = items;
      for (const item of items) {
        const row = rates.element.querySelector(`[data-row="${item.id}"]`);
        const last = item.history[item.history.length - 1];
        const before = item.history[item.history.length - 2];
        row.querySelector('[data-price]').innerHTML = ltr(item.from === undefined ? `${number(last[1], 2)}%` : `${number(item.from, 2)}–${number(last[1], 2)}%`);
        row.querySelector('[data-change]').innerHTML = before ? ltr(signed(last[1] - before[1])) : '—';
        row.querySelector('[data-date]').innerHTML = ltr(day(isoTime(last[0])));
      }
      rates.element.querySelector('[data-updated]').textContent = `עודכן ${day(updated * 1000)}`;
    } catch {
      rates.element.querySelector('[data-updated]').textContent = UNAVAILABLE;
    }
    drawRate();
  }

  // ---------- the indices tab: TradingView's widget ----------
  const INDICES = [['TASE:TA35', 'ת"א 35'], ['TASE:TA125', 'ת"א 125'], ['FOREXCOM:SPXUSD', 'S&P 500'], ['FOREXCOM:NSXUSD', 'נאסדק 100'], ['FOREXCOM:GRXEUR', 'דאקס']];
  function loadIndices() {
    const box = tile.querySelector('[data-market-panel="indices"] [data-tv]');
    box.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div></div>';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.async = true;
    script.textContent = JSON.stringify({
      colorTheme: 'light', dateRange: '12M', showChart: true, locale: 'he_IL', width: '100%', height: '100%',
      largeChartUrl: '', isTransparent: true, showSymbolLogo: false, showFloatingTooltip: true,
      plotLineColorGrowing: 'rgba(58, 110, 165, 1)', plotLineColorFalling: 'rgba(58, 110, 165, 1)',
      gridLineColor: 'rgba(12, 33, 52, 0.08)', scaleFontColor: 'rgba(70, 88, 106, 1)',
      belowLineFillColorGrowing: 'rgba(58, 110, 165, 0.14)', belowLineFillColorFalling: 'rgba(58, 110, 165, 0.14)',
      belowLineFillColorGrowingBottom: 'rgba(58, 110, 165, 0)', belowLineFillColorFallingBottom: 'rgba(58, 110, 165, 0)',
      symbolActiveColor: 'rgba(58, 110, 165, 0.12)',
      tabs: [{ title: 'מדדים', symbols: INDICES.map(([s, d]) => ({ s, d })) }],
    });
    box.querySelector('.tradingview-widget-container').append(script);
  }

  // ---------- the tabs ----------
  const tabs = [...tile.querySelectorAll('[data-market-tab]')];
  const cta = tile.querySelector('.yield-cta');
  const opened = new Set(['funds']);
  const firstOpen = { indices: loadIndices, fx: loadFx, rates: loadRates };

  function show(name) {
    for (const tab of tabs) {
      const on = tab.dataset.marketTab === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    tile.querySelectorAll('[data-market-panel]').forEach((el) => { el.hidden = el.dataset.marketPanel !== name; });
    // "where does your fund stand" belongs to the funds only
    if (cta) cta.hidden = name !== 'funds';
    if (!opened.has(name)) { opened.add(name); firstOpen[name](); }
  }

  tile.querySelector('.market-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-market-tab]');
    if (tab) show(tab.dataset.marketTab);
  });
  tile.querySelector('.market-tabs').addEventListener('keydown', (e) => {
    const move = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
    if (!move) return;
    e.preventDefault();
    const current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = tabs[(current + move + tabs.length) % tabs.length];
    show(next.dataset.marketTab);
    next.focus();
  });

  buildFx();
  buildRates();
})();
