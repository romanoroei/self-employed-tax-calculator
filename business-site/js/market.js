// The home page's markets tile.
// - Funds: plain HTML from the build, with each ranked fund's monthly yields for the chart.
//   Rows toggle on and off, and every fund that is on gets its own line.
// - Indices: TradingView's widgets, loaded only when the tab is opened.
// - Currencies and rates: /api/fx and /api/rates, official daily figures, read when their tab is opened.
// Every chart here takes a time range and shows the values under the pointer in its caption, above
// the plot. Clicking two points, or dragging from one to the other, marks that period and measures it.
(() => {
  const tile = document.querySelector('[data-market]');
  if (!tile) return;

  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const COLORS = ['#3A6EA5', '#B8862B', '#0B7A4B', '#A23B5A', '#6B4E9B'];
  const YEAR_MS = 365.25 * 86400000;
  const number = (v, digits = 2) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (v, digits = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${number(Math.abs(v), digits)}`;
  const tone = (v) => (v > 0 ? 'is-up' : v < 0 ? 'is-down' : '');
  const ltr = (text) => `<span dir="ltr">${text}</span>`;
  const day = (t) => { const d = new Date(t); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
  const DAY_MS = 86400000;
  const monthYear = (t) => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };
  const isoTime = (iso) => new Date(`${iso}T00:00:00Z`).getTime();
  const swatch = (color) => `<i class="chart-dot" style="background:${color}"></i>`;

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

  // The value of a line at time t: the nearest point, or on a step line the last change before it.
  function valueAt(points, t, step) {
    let lo = 0;
    let hi = points.length - 1;
    if (t <= points[0][0]) return points[0][1];
    if (t >= points[hi][0]) return points[hi][1];
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid][0] <= t) lo = mid; else hi = mid; }
    if (step) return points[lo][1];
    return t - points[lo][0] <= points[hi][0] - t ? points[lo][1] : points[hi][1];
  }

  // options: { title, hint, lines: [{ points: [[time, value]], color, name }], step, base, axis(v),
  //            tip(spot, waiting), measure(a, b), edge(t, isStart) }
  // A spot is { t, values }: one value per line, at the time nearest the pointer.
  // The caption keeps three fixed rows: the title, how to use the chart, and the readout.
  // At rest the readout shows the latest point, so nothing in it ever appears, vanishes or moves.
  function makeChart(figure) {
    const svg = figure.querySelector('svg');
    const plot = figure.querySelector('.market-plot');
    const caption = figure.querySelector('figcaption');
    caption.innerHTML = '<span class="chart-title"></span><span class="chart-help"></span><span class="chart-read" aria-live="polite"></span>';
    const [titleEl, helpEl, readEl] = caption.children;
    const edges = [0, 1].map(() => { const el = document.createElement('div'); el.className = 'chart-edge'; el.hidden = true; return el; });
    plot.append(...edges);
    let options = null;
    let geometry = null;
    let anchor = null; // where a press began
    let moved = false;
    let first = null; // the first of two clicks
    let range = null; // a measured period: [spot, spot]
    let grab = -1; // which end of the period is being dragged

    function render() {
      geometry = null;
      const width = svg.clientWidth;
      const height = svg.clientHeight;
      if (!options || !width || !height) return;
      const { lines, step, base, axis } = options;
      const values = lines.flatMap((l) => l.points.map((p) => p[1]));
      if (base !== undefined && base !== null) values.push(base);
      let min = Math.min(...values);
      let max = Math.max(...values);
      const margin = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
      min -= margin; max += margin;
      const times = lines.flatMap((l) => [l.points[0][0], l.points[l.points.length - 1][0]]);
      const start = Math.min(...times);
      const end = Math.max(...times);
      const span = end - start || 1;
      const right = width - PAD.right;
      const bottom = height - PAD.bottom;
      const x = (t) => PAD.left + (right - PAD.left) * ((t - start) / span);
      const y = (v) => PAD.top + (bottom - PAD.top) * (1 - (v - min) / (max - min));
      const path = (points) => points.map(([t, v], i) => {
        const px = x(t).toFixed(1);
        const py = y(v).toFixed(1);
        return !i ? `M${px} ${py}` : step ? `H${px}V${py}` : `L${px} ${py}`;
      }).join('');
      const grid = niceTicks(min, max).map((v) => `<line class="chart-grid" x1="${PAD.left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="chart-label" x="${right + 6}" y="${(y(v) + 4).toFixed(1)}">${axis(v)}</text>`).join('');
      const count = width < 360 ? 3 : 4;
      const seen = new Set();
      const ticks = Array.from({ length: count }, (_, n) => {
        const t = start + span * ((n + 0.5) / count);
        const label = axisLabel(t, span);
        if (seen.has(label)) return '';
        seen.add(label);
        return `<text class="chart-label" text-anchor="middle" x="${x(t).toFixed(1)}" y="${height - 5}">${label}</text>`;
      }).join('');
      const baseLine = base === undefined || base === null ? '' : `<line class="chart-base" x1="${PAD.left}" x2="${right}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}"/>`;
      // one line gets the shaded area; several are told apart by colour alone
      const only = lines.length === 1 ? lines[0] : null;
      const area = only ? `<path class="chart-area" d="${path(only.points)}L${x(only.points[only.points.length - 1][0]).toFixed(1)} ${bottom}L${x(only.points[0][0]).toFixed(1)} ${bottom}Z" style="fill:${only.color}"/>` : '';
      const drawn = lines.map((l) => `<path class="chart-line" d="${path(l.points)}" style="stroke:${l.color}"/>`).join('');
      const dots = lines.map((l) => `<circle r="3.5" style="fill:${l.color}"/><circle r="3.5" style="fill:${l.color}"/>`).join('');
      svg.innerHTML = `${grid}${baseLine}<g class="chart-over" hidden><rect class="chart-band" y="${PAD.top}" height="${bottom - PAD.top}"/></g>${area}${drawn}${ticks}`
        + `<g class="chart-marks" hidden><line class="chart-rule" y1="${PAD.top}" y2="${bottom}"/><line class="chart-rule" y1="${PAD.top}" y2="${bottom}"/>${dots}</g>`;
      geometry = { x, y, start, span, right, bottom };
    }

    // what the chart shows when nobody is pointing at it
    function settle() {
      if (range) show(range[0], range[1]);
      else if (first) show(first);
      else rest();
    }

    function spotAt(clientX) {
      const { lines, step } = options;
      const { start, span, right } = geometry;
      const box = svg.getBoundingClientRect();
      const share = Math.min(1, Math.max(0, (clientX - box.left - PAD.left) / (right - PAD.left)));
      let t = start + span * share;
      // a line chart snaps to its nearest point; a step chart keeps the exact day
      if (!step) {
        const points = lines[0].points;
        let lo = 0;
        let hi = points.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid][0] <= t) lo = mid; else hi = mid; }
        t = t - points[lo][0] <= points[hi][0] - t ? points[lo][0] : points[hi][0];
      }
      return { t, values: lines.map((l) => valueAt(l.points, t, step)) };
    }

    function latest() {
      const t = Math.max(...options.lines.map((l) => l.points[l.points.length - 1][0]));
      return { t, values: options.lines.map((l) => valueAt(l.points, t, options.step)) };
    }

    function place(el, middle) {
      const room = plot.clientWidth - el.offsetWidth - 2;
      el.style.left = `${Math.max(2, Math.min(room, middle - el.offsetWidth / 2))}px`;
    }

    function show(a, b) {
      if (!geometry) return;
      const marks = svg.querySelector('.chart-marks');
      const over = svg.querySelector('.chart-over');
      const { x, y, bottom } = geometry;
      const two = Boolean(b) && b.t !== a.t;
      const ends = two ? [a, b].sort((p, q) => p.t - q.t) : [a];
      const [ruleA, ruleB, ...dots] = marks.children;
      marks.removeAttribute('hidden');
      ruleA.setAttribute('x1', x(ends[0].t)); ruleA.setAttribute('x2', x(ends[0].t));
      ruleB.style.display = two ? '' : 'none';
      if (two) { ruleB.setAttribute('x1', x(ends[1].t)); ruleB.setAttribute('x2', x(ends[1].t)); }
      options.lines.forEach((_, n) => {
        const [dotA, dotB] = [dots[n * 2], dots[n * 2 + 1]];
        dotA.setAttribute('cx', x(ends[0].t)); dotA.setAttribute('cy', y(ends[0].values[n]));
        dotB.style.display = two ? '' : 'none';
        if (two) { dotB.setAttribute('cx', x(ends[1].t)); dotB.setAttribute('cy', y(ends[1].values[n])); }
      });
      over.toggleAttribute('hidden', !two);
      if (two) {
        const band = over.firstElementChild;
        band.setAttribute('x', x(ends[0].t)); band.setAttribute('width', x(ends[1].t) - x(ends[0].t));
      }
      // the period's two ends, written on the time axis under each rule
      edges.forEach((el, n) => {
        const spot = ends[n];
        el.hidden = !spot || (!two && !first);
        if (el.hidden) return;
        el.textContent = options.edge(spot.t, two && n === 0);
        el.style.top = `${bottom + 1}px`;
        place(el, x(spot.t));
      });
      readEl.innerHTML = two ? options.measure(ends[0], ends[1]) : options.tip(a, Boolean(first) && !range);
    }

    function rest() {
      svg.querySelector('.chart-marks')?.setAttribute('hidden', '');
      svg.querySelector('.chart-over')?.setAttribute('hidden', '');
      edges.forEach((el) => { el.hidden = true; });
      readEl.innerHTML = options ? options.tip(latest(), false) : '';
    }

    function reset() {
      range = null; first = null; anchor = null; grab = -1;
      if (options) rest();
    }

    // an end of the measured period under the pointer, to drag it wider or narrower
    function endAt(clientX, pointerType) {
      if (!range || !geometry) return -1;
      const px = clientX - svg.getBoundingClientRect().left;
      const gaps = range.map((s) => Math.abs(geometry.x(s.t) - px));
      const n = gaps[0] <= gaps[1] ? 0 : 1;
      return gaps[n] <= (pointerType === 'mouse' ? 10 : 22) ? n : -1;
    }

    new ResizeObserver(() => { render(); settle(); }).observe(svg);
    svg.addEventListener('pointerdown', (e) => {
      if (!geometry) return;
      svg.setPointerCapture(e.pointerId);
      grab = endAt(e.clientX, e.pointerType);
      if (grab >= 0) return;
      anchor = spotAt(e.clientX);
      moved = false;
      if (!first) { range = null; show(anchor); }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!geometry) return;
      const spot = spotAt(e.clientX);
      if (grab >= 0) { range[grab] = spot; show(range[0], range[1]); return; }
      if (anchor) {
        if (spot.t !== anchor.t) moved = true;
        if (moved) { first = null; show(anchor, spot); }
        return;
      }
      svg.style.cursor = endAt(e.clientX, e.pointerType) >= 0 ? 'ew-resize' : '';
      if (range) return;
      if (first) show(first, spot);
      else show(spot);
    });
    svg.addEventListener('pointerup', (e) => {
      if (grab >= 0) { grab = -1; return; }
      if (!anchor) return;
      const spot = spotAt(e.clientX);
      if (moved) {
        // dragged from one point to another
        range = [anchor, spot]; first = null;
      } else if (first && spot.t !== first.t) {
        // the second click of a pair
        range = [first, spot]; first = null;
      } else {
        // the first click: hold this point and wait for the second
        first = spot; range = null;
      }
      anchor = null;
      settle();
    });
    svg.addEventListener('pointerleave', () => {
      if (anchor || grab >= 0) return;
      settle();
    });
    // a click anywhere else clears the measurement
    document.addEventListener('pointerdown', (e) => {
      if (svg.contains(e.target)) return;
      if (range || first) reset();
    });
    return {
      set(next) {
        options = next;
        range = null; first = null; anchor = null; grab = -1;
        titleEl.textContent = options.title;
        const help = options.hint ?? HINT_SHORT;
        helpEl.textContent = help;
        helpEl.hidden = !help;
        render();
        rest();
      },
      clear(title) {
        options = null; geometry = null; svg.replaceChildren();
        edges.forEach((el) => { el.hidden = true; });
        titleEl.textContent = title || '';
        readEl.textContent = '';
      },
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
  const HINT_SHORT = '';
  const PICK_SECOND = '<small>עכשיו לחצו על נקודה נוספת</small>';
  const tipLines = (lines, values, show, named = lines.length > 1) => lines.map((l, n) => `<span class="chart-read-item">${named ? `${lines.length > 1 ? swatch(l.color) : ''}${l.name} ` : ''}<b>${ltr(show(values[n]))}</b></span>`).join('');

  // ---------- the funds tab ----------
  const fundsPanel = tile.querySelector('[data-market-panel="funds"]');
  const series = JSON.parse(document.getElementById('yield-series').textContent);
  const fundsChart = makeChart(fundsPanel.querySelector('.market-chart'));
  const COLUMN_RANGE = { y1: 12, y3: 36, y7: 84 };
  let [product, track, sort] = fundsPanel.querySelector('table[data-yield-view]:not([hidden])').dataset.yieldView.split('-');
  let picked = [];
  const colorOf = new Map();
  let fundRange = COLUMN_RANGE[sort];
  const fundRanges = ranges(fundsPanel.querySelector('.market-ranges'), (value) => { fundRange = Number(value); drawFunds(); });
  // a report period as a month count, and the moment that month ends
  const absolute = (period) => Math.floor(period / 100) * 12 + (period % 100) - 1;
  const monthEnd = (abs) => new Date(Math.floor(abs / 12), (abs % 12) + 1, 1).getTime();
  const shownTable = () => fundsPanel.querySelector('table[data-yield-view]:not([hidden])');
  const nameOf = (key) => shownTable().querySelector(`[data-yield-row="${key}"]`).textContent;

  function paintRows() {
    const table = shownTable();
    fundsPanel.querySelectorAll('tbody tr').forEach((row) => row.classList.remove('is-picked'));
    table.querySelectorAll('[data-yield-row]').forEach((b) => {
      const on = picked.includes(b.dataset.yieldRow);
      b.setAttribute('aria-pressed', String(on));
      b.style.setProperty('--swatch', on ? colorOf.get(b.dataset.yieldRow) : 'transparent');
      b.closest('tr').classList.toggle('is-picked', on);
    });
  }

  function drawFunds() {
    paintRows();
    const funds = picked.map((key) => ({ key, ...series[key], last: absolute(series[key].start) + series[key].m.length - 1 }));
    const last = Math.min(...funds.map((f) => f.last));
    const earliest = Math.max(...funds.map((f) => absolute(f.start)));
    const length = last - earliest + 1;
    fundRanges.allow((r) => Number(r) === 0 || Number(r) <= length);
    if (fundRange && fundRange > length) fundRange = 0;
    fundRanges.pick(fundRange);
    const from = fundRange ? last - fundRange + 1 : earliest;
    const lines = funds.map((f) => {
      const points = [[monthEnd(from - 1), 0]];
      let total = 1;
      for (let abs = from; abs <= last; abs += 1) {
        total *= 1 + f.m[abs - absolute(f.start)] / 100;
        points.push([monthEnd(abs), (total - 1) * 100]);
      }
      return { points, color: colorOf.get(f.key), name: nameOf(f.key) };
    });
    const startName = `${MONTHS[from % 12]} ${Math.floor(from / 12)}`;
    const when = fundRange === 12 ? 'בשנה האחרונה' : fundRange ? `ב־${fundRange / 12} השנים האחרונות` : `מ${startName}`;
    // a point's time is the first day after its month: the period after it starts there,
    // and the month it closes is the one before
    const startOf = (t) => monthYear(t);
    const endOf = (t) => monthYear(t - DAY_MS);
    const rangeStart = lines[0].points[0][0];
    fundsChart.set({
      title: `${lines.length === 1 ? `${lines[0].name}: ` : ''}תשואה מצטברת ${when}`,
      hint: '',
      lines, base: 0,
      axis: (v) => `${number(v, Number.isInteger(v) ? 0 : 1)}%`,
      edge: (t, isStart) => (isStart ? startOf(t) : endOf(t)),
      tip: (s, waiting) => `<span class="chart-read-head">מ־${startOf(rangeStart)} עד סוף ${endOf(s.t)}:</span>${tipLines(lines, s.values, (v) => `${signed(v)}%`, true)}${waiting ? PICK_SECOND : ''}`,
      measure: (a, b) => `<span class="chart-read-head">מ־${startOf(a.t)} עד סוף ${endOf(b.t)}:</span>${tipLines(lines, a.values.map((v, n) => ((1 + b.values[n] / 100) / (1 + v / 100) - 1) * 100), (v) => `${signed(v)}%`, true)}`,
    });
  }

  function toggle(key) {
    if (picked.includes(key)) {
      if (picked.length === 1) return;
      picked = picked.filter((k) => k !== key);
      colorOf.delete(key);
    } else {
      if (picked.length === COLORS.length) return;
      picked.push(key);
      colorOf.set(key, COLORS.find((c) => ![...colorOf.values()].includes(c)));
    }
    drawFunds();
  }

  // On a new view, funds still in the table stay on; with none left, the leader comes on.
  function keepPicks() {
    const keys = [...shownTable().querySelectorAll('[data-yield-row]')].map((b) => b.dataset.yieldRow);
    picked = picked.filter((k) => keys.includes(k));
    for (const key of [...colorOf.keys()]) if (!picked.includes(key)) colorOf.delete(key);
    if (!picked.length) { picked = [keys[0]]; colorOf.set(keys[0], COLORS[0]); }
    drawFunds();
  }

  fundsPanel.addEventListener('click', (e) => {
    if (e.target.closest('.market-ranges, .market-chart')) return;
    const row = e.target.closest('tbody tr');
    if (row && e.target.closest('table[data-yield-view]')) { toggle(row.querySelector('[data-yield-row]').dataset.yieldRow); return; }
    const button = e.target.closest('button');
    if (!button) return;
    const { yieldProduct, yieldTrack, yieldSort } = button.dataset;
    if (!yieldProduct && !yieldTrack && !yieldSort) return;
    product = yieldProduct || product;
    track = yieldTrack || track;
    if (yieldSort) { sort = yieldSort; fundRange = COLUMN_RANGE[sort]; }
    if (!yieldSort) button.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const view = `${product}-${track}-${sort}`;
    fundsPanel.querySelectorAll('[data-yield-view]').forEach((el) => { el.hidden = el.dataset.yieldView !== view; });
    if (yieldProduct || yieldTrack) picked = [];
    keepPicks();
    // the clicked heading belonged to a table that just hid: keep the focus on its twin
    if (yieldSort) shownTable().querySelector(`[data-yield-sort="${yieldSort}"]`).focus();
  });
  keepPicks();

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
  const fx = { picked: 'usdils', range: 12, history: new Map() };

  function buildFx() {
    const element = tile.querySelector('[data-market-panel="fx"]');
    element.innerHTML = `<div class="yield-head"><h2 class="yield-title">שערי מטבע</h2><p class="yield-sub">שער יציג ושערי הבנק המרכזי האירופי, פעם ביום</p></div>${rangeButtons(FX_RANGES)}${chartBlock}<div class="yield-tables market-table"><table><caption class="visually-hidden">שערי מטבע</caption><thead><tr><th scope="col">צמד</th><th scope="col">שער</th><th scope="col">שינוי</th><th scope="col">שינוי %</th></tr></thead><tbody>`
      + FX.map(([id, label], i) => `<tr data-row="${id}"${i ? '' : ' class="is-picked"'}><th scope="row"><button type="button" aria-pressed="${!i}">${label}</button></th><td data-price>—</td><td data-change>—</td><td data-percent>—</td></tr>`).join('')
      + `</tbody></table></div>${noteBlock}`;
    fx.element = element;
    fx.chart = makeChart(element.querySelector('.market-chart'));
    fx.title = element.querySelector('figcaption');
    fx.ranges = ranges(element.querySelector('.market-ranges'), (value) => { fx.range = Number(value); drawFx(); });
    fx.ranges.pick(fx.range);
    element.querySelector('[data-source]').innerHTML = `שער יציג של בנק ישראל לצמדים מול השקל, ושערי הבנק המרכזי האירופי לשאר. מתעדכן פעם ביום. המידע אינו המלצה.`;
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
    fx.title.querySelector('.chart-title').textContent = label;
    const id = fx.picked;
    try {
      if (!fx.history.has(id)) fx.history.set(id, (await getJson(`/api/fx?id=${id}`)).points.map(([d, v]) => [isoTime(d), v]));
      if (id !== fx.picked) return;
      const all = fx.history.get(id);
      const from = all[all.length - 1][0] - fx.range * (YEAR_MS / 12);
      const lines = [{ points: all.filter(([t]) => t >= from), color: COLORS[0], name: label }];
      fx.chart.set({
        title: label,
        lines,
        axis: (v) => number(v, digits === 4 ? 2 : 0),
        edge: day,
        tip: (s, waiting) => `<span class="chart-read-head">${day(s.t)}:</span>${tipLines(lines, s.values, (v) => number(v, digits))}${waiting ? PICK_SECOND : ''}`,
        measure: (a, b) => `<span class="chart-read-head">מ־${day(a.t)} עד ${day(b.t)}:</span>${tipLines(lines, [(b.values[0] / a.values[0] - 1) * 100], (v) => `${signed(v)}%`)}`,
      });
    } catch {
      fx.chart.clear(label);
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
  const RATES = [['il', 'ישראל', 'ריבית בנק ישראל'], ['us', 'ארה"ב', 'ריבית הפד, הטווח העליון'], ['eu', 'אירופה', 'ריבית הפיקדון של הבנק האירופי'], ['uk', 'אנגליה', 'ריבית בנק אנגליה']];
  const RATE_RANGES = [['1', 'שנה'], ['5', '5 שנים'], ['10', '10 שנים'], ['20', '20 שנים'], ['0', 'מקס׳']];
  const rates = { picked: 'il', range: 5, items: null };

  function buildRates() {
    const element = tile.querySelector('[data-market-panel="rates"]');
    element.innerHTML = `<div class="yield-head"><h2 class="yield-title">ריביות בנקים מרכזיים</h2><p class="yield-sub">ישראל, ארה"ב, אירופה ואנגליה</p></div>${rangeButtons(RATE_RANGES)}${chartBlock}<div class="yield-tables market-table"><table><caption class="visually-hidden">ריביות בנקים מרכזיים</caption><thead><tr><th scope="col">בנק מרכזי</th><th scope="col">ריבית</th><th scope="col">שינוי אחרון</th><th scope="col">מתאריך</th></tr></thead><tbody>`
      + RATES.map(([id, label], i) => `<tr data-row="${id}"${i ? '' : ' class="is-picked"'}><th scope="row"><button type="button" aria-pressed="${!i}">${label}</button></th><td data-price>—</td><td data-change>—</td><td data-date>—</td></tr>`).join('')
      + `</tbody></table></div>${noteBlock}`;
    rates.element = element;
    rates.chart = makeChart(element.querySelector('.market-chart'));
    rates.title = element.querySelector('figcaption');
    rates.ranges = ranges(element.querySelector('.market-ranges'), (value) => { rates.range = Number(value); drawRate(); });
    rates.ranges.pick(rates.range);
    element.querySelector('[data-source]').innerHTML = `לפי בנק ישראל, הבנק הפדרלי של ניו יורק, הבנק המרכזי האירופי ובנק אנגליה. המידע אינו המלצה.`;
    element.addEventListener('click', (e) => {
      const row = e.target.closest('tbody tr');
      if (!row) return;
      rates.picked = row.dataset.row;
      pickRow(element, row);
      drawRate();
    });
  }

  function drawRate() {
    const [, label, title] = RATES.find(([id]) => id === rates.picked);
    const item = rates.items?.find((i) => i.id === rates.picked);
    rates.title.querySelector('.chart-title').textContent = title;
    if (!item) { rates.chart.clear(title); return; }
    const all = item.history.map(([date, value]) => [isoTime(date), value]);
    const now = Date.now();
    const from = rates.range ? now - rates.range * YEAR_MS : all[0][0];
    let before = 0;
    while (before + 1 < all.length && all[before + 1][0] <= from) before += 1;
    const points = [[Math.max(from, all[0][0]), all[before][1]], ...all.slice(before + 1), [now, all[all.length - 1][1]]];
    const oldest = all[0][0];
    rates.ranges.allow((r) => Number(r) === 0 || now - Number(r) * YEAR_MS >= oldest - 31 * 86400000);
    const lines = [{ points, color: COLORS[0], name: label }];
    rates.chart.set({
      title,
      lines, step: true,
      axis: (v) => `${number(v, 2)}%`,
      edge: day,
      tip: (s, waiting) => `<span class="chart-read-head">${day(s.t)}:</span>${tipLines(lines, s.values, (v) => `${number(v, 2)}%`)}${waiting ? PICK_SECOND : ''}`,
      measure: (a, b) => `<span class="chart-read-head">מ־${day(a.t)} עד ${day(b.t)}:</span>${tipLines(lines, [b.values[0] - a.values[0]], (v) => `${signed(v)} נק׳ אחוז`)}`,
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

  // ---------- the indices tab: TradingView's widgets ----------
  // One tall chart with its title, value, change and price axis, and a switch between the indices.
  // Its only link out is TradingView's own mark, which its terms require. (Their quotes table linked
  // every row to their site and scrolled sideways, so it is gone.)
  const INDICES = [['TASE:TA35', 'ת"א 35'], ['TASE:TA125', 'ת"א 125'], ['FOREXCOM:SPXUSD', 'S&P 500'], ['FOREXCOM:NSXUSD', 'נאסדק 100'], ['FOREXCOM:GRXEUR', 'דאקס']];
  function widget(box, name, height, config) {
    const holder = document.createElement('div');
    holder.className = 'tradingview-widget-container';
    holder.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const script = document.createElement('script');
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
    script.async = true;
    script.textContent = JSON.stringify({ autosize: true, width: '100%', height: '100%', locale: 'he_IL', colorTheme: 'light', isTransparent: true, ...config });
    holder.append(script);
    box.append(holder);
  }
  function loadIndices() {
    const box = tile.querySelector('[data-market-panel="indices"] [data-tv]');
    widget(box, 'symbol-overview', '100%', {
      symbols: INDICES.map(([s, d]) => [d, `${s}|12M`]),
      chartOnly: false, showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: true,
      scalePosition: 'right', scaleMode: 'Normal', fontSize: '10', noTimeScale: false, valuesTracking: '1', changeMode: 'price-and-percent',
      chartType: 'area', lineColor: 'rgba(58, 110, 165, 1)', topColor: 'rgba(58, 110, 165, 0.25)', bottomColor: 'rgba(58, 110, 165, 0)',
      lineWidth: 2, lineType: 0, gridLineColor: 'rgba(12, 33, 52, 0.06)',
      dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'],
    });
    box.insertAdjacentHTML('beforeend', '<div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>');
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
    // "where does your fund stand" belongs to the funds only; its place stays, so the tile keeps its height
    if (cta) cta.classList.toggle('is-away', name !== 'funds');
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
