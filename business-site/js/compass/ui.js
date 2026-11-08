// The financial compass: the interface. It draws what engine.js decides, and holds no rules of its own.
// Everything stays in this browser until the visitor chooses to send the form. Text is always set with
// textContent, never as HTML, so nothing typed or stored can inject markup.
(() => {
  'use strict';
  const root = document.getElementById('compass');
  const cfg = window.CompassConfig;
  const C = window.CompassContent;
  const E = window.CompassEngine && window.CompassEngine.engine;
  if (!root || !cfg || !C || !E) return;

  const R = C.result;
  const screens = { intro: root.querySelector('[data-screen="intro"]'), run: root.querySelector('[data-screen="run"]'), result: root.querySelector('[data-screen="result"]') };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-still');

  // ---------- small DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    return el;
  }
  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  const icon = (svg) => { const t = document.createElement('template'); t.innerHTML = svg; return t.content.firstChild; };

  // ---------- anonymous totals: a label only, each at most once per visit ----------
  const counted = new Set();
  const count = (label) => {
    if (counted.has(label)) return;
    counted.add(label);
    try { navigator.sendBeacon(cfg.countUrl, label); } catch (e) { /* counting is optional */ }
  };
  const params = new URLSearchParams(location.search);
  const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) => (params.get(k) || '').slice(0, 60).replace(/[^\w֐-׿ .\-]/g, '')).filter(Boolean);
  const utmLabel = () => {
    const src = (params.get('utm_source') || '').toLowerCase();
    if (!src) return null;
    const hit = cfg.utmSources.find((s) => src.includes(s));
    return `compass:utm-${hit || 'other'}`;
  };

  // ---------- this device only ----------
  const store = {
    load() { try { return E.restore(localStorage.getItem(cfg.storageKey), cfg.storageDays); } catch (e) { return null; } },
    save(s) { try { localStorage.setItem(cfg.storageKey, E.serialize(s)); } catch (e) { /* private mode: no saving */ } },
    clear() { try { localStorage.removeItem(cfg.storageKey); } catch (e) { /* nothing to clear */ } },
  };

  let state = null;
  let startedAt = 0;

  function show(name) {
    for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  }
  function scrollToTop(el) {
    const bar = document.querySelector('.topbar');
    const y = el.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 12;
    if (window.scrollY > y || y - window.scrollY > window.innerHeight * 0.35) window.scrollTo({ top: Math.max(0, y), behavior: still() ? 'instant' : 'smooth' });
  }

  // ---------- intro ----------
  const startBtn = screens.intro.querySelector('[data-start]');
  const resumeBox = screens.intro.querySelector('[data-resume]');
  const saved = store.load();
  if (saved && saved.history.length) {
    resumeBox.hidden = false;
    startBtn.closest('.cp-start-row').hidden = true;
  }
  startBtn.addEventListener('click', () => begin(E.newState(), 'compass:start'));
  resumeBox.querySelector('[data-resume-go]').addEventListener('click', () => begin(saved, 'compass:resume'));
  resumeBox.querySelector('[data-resume-new]').addEventListener('click', () => { store.clear(); begin(E.newState(), 'compass:start'); });

  function begin(s, label) {
    state = s;
    startedAt = Date.now();
    count(label);
    const u = utmLabel();
    if (u) count(u);
    render(true);
  }

  // ---------- the question screen ----------
  const progress = screens.run.querySelector('[data-progress]');
  const say = screens.run.querySelector('[data-say]');
  const qBox = screens.run.querySelector('[data-question]');
  const answersBox = screens.run.querySelector('[data-answers]');
  const answersList = screens.run.querySelector('[data-answers-list]');

  function render(focus) {
    const v = E.view(state);
    store.save(state);
    if (!v.question) { renderResult(); return; }
    show('run');
    if (v.stage > 1) count(`compass:stage-${v.stage}`);

    // stages, not a misleading percentage
    const now = v.stages.find((s) => s.id === v.stage);
    progress.replaceChildren(
      h('ol', { class: 'cp-steps', 'aria-hidden': 'true' }, v.stages.map((s) => h('li', { class: s.id < v.stage ? 'is-done' : s.id === v.stage ? 'is-now' : '' }))),
      h('p', { class: 'cp-steps-label' }, h('span', {}, 'שלב ', h('strong', { text: `${v.stage} מתוך ${v.stages.length}` }), `: ${now.label}`), h('span', { text: v.answeredCount ? `${v.answeredCount} תשובות` : '' })),
    );

    say.textContent = v.message || '';
    const q = v.question;
    const multi = q.type === 'multi';
    const name = `q-${q.id}`;
    const selected = new Set(q.selected === null ? [] : [].concat(q.selected));
    const error = h('p', { class: 'cp-error', id: 'cp-error', role: 'alert' });
    const helpEl = q.help ? h('p', { class: 'cp-help', id: 'cp-help', text: q.help }) : null;
    const heading = h('h2', { id: 'cp-qtitle', tabindex: '-1', text: q.text });
    const fieldset = h('fieldset', { class: `cp-opts${q.options.length >= 5 && !q.options.some((o) => o.label.length > 34) ? ' is-grid' : ''}`, 'aria-labelledby': 'cp-qtitle', 'aria-describedby': [helpEl ? 'cp-help' : '', 'cp-error'].filter(Boolean).join(' ') },
      q.options.map((o, i) => {
        const input = h('input', { type: multi ? 'checkbox' : 'radio', name, value: o.value, id: `${name}-${i}`, checked: selected.has(o.value) });
        input.dataset.exclusive = o.exclusive ? '1' : '';
        return h('label', { class: `cp-opt cp-opt-${multi ? 'check' : 'radio'}${o.gap ? ' is-gap' : ''}`, for: `${name}-${i}` },
          input, h('span', { class: 'cp-mark', 'aria-hidden': 'true' }),
          h('span', { class: 'cp-opt-text' }, h('span', { text: o.label }), o.note ? h('small', { text: o.note }) : null));
      }));
    const inputs = [...fieldset.querySelectorAll('input')];
    const value = () => {
      const on = inputs.filter((i) => i.checked).map((i) => i.value);
      return multi ? on : on[0];
    };
    // multi: an exclusive answer ("none", "don't know") clears the others, and the other way round
    if (multi) fieldset.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.checked) return;
      inputs.forEach((i) => { if (i !== t && (t.dataset.exclusive || i.dataset.exclusive)) i.checked = false; });
      error.textContent = '';
    });

    const go = () => {
      const val = value();
      if (multi ? !val.length : !val) {
        error.textContent = multi ? 'בחרו לפחות תשובה אחת כדי להמשיך.' : 'בחרו תשובה כדי להמשיך.';
        (inputs.find((i) => i.checked) || inputs[0]).focus();
        return;
      }
      advance(q.id, val);
    };
    const next = h('button', { type: 'button', class: 'button button-ink cp-next', onclick: go }, 'המשך');
    const nav = h('div', { class: 'cp-nav' },
      h('button', { type: 'button', class: 'cp-link-btn', hidden: !v.canBack, onclick: () => { state = E.back(state); render(true); } }, 'חזרה'),
      q.required ? null : h('button', { type: 'button', class: 'cp-link-btn', onclick: () => { state = E.skip(state, q.id); render(true); } }, 'דילוג על השאלה'),
      next);

    // a single answer picked with a pointer moves on by itself; the keyboard keeps the explicit button
    if (!multi) fieldset.addEventListener('click', (e) => {
      const input = e.target.closest('label') && e.target.closest('label').querySelector('input');
      if (!input || e.detail === 0) return;
      input.checked = true;
      error.textContent = '';
      setTimeout(() => { if (input.checked && E.view(state).question && E.view(state).question.id === q.id) go(); }, still() ? 0 : 220);
    });
    fieldset.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); go(); } });

    qBox.replaceChildren(heading, helpEl || '', fieldset, error, nav);
    if (!still()) { qBox.classList.remove('is-entering'); void qBox.offsetWidth; qBox.classList.add('is-entering'); }

    // the answers so far, each one can be changed without starting again
    const list = E.answersList(state);
    answersBox.hidden = !list.length;
    answersList.replaceChildren(...list.map((a) => answerItem(a)));

    if (focus) { scrollToTop(screens.run); heading.focus({ preventScroll: true }); }
  }

  function answerItem(a) {
    return h('li', {}, h('span', {}, h('b', { text: `${a.label}: ` }), a.value),
      h('button', { type: 'button', class: 'cp-link-btn', 'aria-label': `שינוי התשובה: ${a.label}`, onclick: () => { state = E.editFrom(state, a.questionId); render(true); } }, 'שינוי'));
  }

  function advance(id, val) {
    const first = !state.history.some((x) => x.questionId === id);
    state = E.answer(state, id, val);
    if (first && id === 'priorities') val.forEach((p) => count(`compass:pick-${C.priorities[p].n}`));
    if (first && id === 'primary') count(`compass:primary-${C.priorities[val].n}`);
    render(true);
  }

  // ---------- the result ----------
  function renderResult() {
    const res = E.result(state);
    if (!res) { show('intro'); return; }
    show('result');
    count('compass:stage-5');
    count('compass:done');
    if (res.limited) count('compass:limited');
    if (startedAt) {
      const min = (Date.now() - startedAt) / 60000;
      count(`compass:time-${min < 2 ? 'fast' : min < 5 ? 'mid' : 'slow'}`);
    }
    const box = screens.result;
    const s = res.relevanceScores;

    const head = h('header', { class: 'tile tile-ink cp-res-head' },
      h('h2', { id: 'cp-result-title', tabindex: '-1', text: R.title }),
      h('p', { text: R.subtitle }),
      res.limited ? h('p', { class: 'cp-limited', text: R.limitedNote }) : null);

    const primary = h('section', { class: 'tile tile-gold cp-res-primary', 'aria-labelledby': 'cp-primary' },
      h('small', { text: R.primaryPrefix }),
      h('h3', { id: 'cp-primary', text: res.primaryNeed.label }),
      res.primaryNeed.explain.map((t) => h('p', { text: t })));

    const needs = res.secondaryNeeds.length ? h('section', { class: 'cp-block cp-needs tile-paper2', 'aria-labelledby': 'cp-needs' },
      h('h3', { id: 'cp-needs', text: res.secondaryNeeds.length === 2 ? R.complementTitle : 'עוד נושא שעלה' }),
      h('div', { class: `cp-pair${res.secondaryNeeds.length === 1 ? ' is-single' : ''}` }, res.secondaryNeeds.map((n) => h('div', { class: 'cp-need cp-block tile-paper' },
        h('h4', { text: n.title }), h('p', { text: n.text }), n.because ? h('p', { class: 'cp-because', text: `עלה כי ${n.because}.` }) : null)))) : null;

    const order = E.AREAS.slice().sort((a, b) => s[b].score - s[a].score);
    const map = h('section', { class: 'cp-block cp-map', 'aria-labelledby': 'cp-map' },
      h('h3', { id: 'cp-map', text: R.mapTitle }),
      h('p', { class: 'cp-note', text: R.mapNote }),
      h('div', { class: 'cp-map-list' }, order.map((a) => {
        const reasons = s[a].reasons.filter((r) => r.pts !== 0);
        const bar = h('i', {});
        const row = h('div', { class: `cp-map-row${a === res.primaryNeed.area ? ' is-top' : ''}${s[a].score < C.limits.relevantScore ? ' is-low' : ''}` },
          h('span', { class: 'cp-map-name', id: `cp-area-${a}`, text: s[a].title }),
          h('span', { class: 'cp-map-score', 'aria-hidden': 'true', text: String(s[a].score) }),
          h('span', { class: 'cp-bar', role: 'img', 'aria-label': `${s[a].title}: רלוונטיות ${s[a].score} מתוך 100` }, bar),
          reasons.length ? h('details', { class: 'cp-why' }, h('summary', { text: 'למה?' }), h('ul', {}, reasons.map((r) => h('li', { text: r.why })))) : null);
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = `${s[a].score}%`; }));
        return row;
      })));

    const checks = h('section', { class: 'cp-block cp-checks', 'aria-labelledby': 'cp-checks' },
      h('h3', { id: 'cp-checks', text: R.checksTitle }),
      h('ol', {}, res.recommendedChecks.map((t) => h('li', { text: t }))));

    const missing = h('section', { class: 'cp-block cp-missing', 'aria-labelledby': 'cp-missing' },
      h('h3', { id: 'cp-missing', text: R.missingTitle }),
      h('p', { text: R.missingIntro }),
      h('ul', {}, [...res.missing, ...res.documents].map((t) => h('li', { text: t }))),
      res.contradictions.length ? h('div', { class: 'cp-flag' }, h('p', { text: res.contradictions.length === 1 ? 'תשובה שכדאי לברר:' : R.contradictionsIntro }), h('ul', {}, res.contradictions.map((c) => h('li', { text: c.text })))) : null,
      res.cannotTell ? h('p', { text: R.cannotTell }) : null,
      h('p', { class: 'cp-note', text: R.noDocuments }));

    // section ו: the invitation, only after the visitor already has the result
    const waText = E.whatsappText(res);
    const formTile = buildForm(res);
    const invite = h('section', { class: 'tile tile-ink cp-invite', 'aria-labelledby': 'cp-invite' },
      h('h3', { id: 'cp-invite', text: R.inviteTitle }),
      h('p', { text: R.inviteText }),
      h('p', { class: 'cp-cta-line', text: `${res.callToAction}.` }),
      h('div', { class: 'cp-actions' },
        h('button', { type: 'button', class: 'button', 'aria-expanded': 'false', 'aria-controls': 'cp-form', onclick: (e) => openForm(e.currentTarget, formTile) }, R.inviteButton),
        h('a', { class: 'button button-line', href: E.whatsappUrl(res, cfg), target: '_blank', rel: 'noopener', 'data-count': 'compass:whatsapp' }, icon(WA_ICON), R.whatsappButton),
        res.showNumbersLink ? h('p', { class: 'cp-numbers' }, h('a', { class: 'link', href: cfg.calculatorUrl, 'data-count': 'compass:calculator', text: `${R.numbersButton} ←` }), h('small', { text: R.numbersNote })) : null),
      h('details', { class: 'cp-wa-text' }, h('summary', { text: 'מה ייכתב בהודעת הוואטסאפ?' }), h('blockquote', { text: waText }),
        h('p', { text: 'ההודעה כוללת רק את הנושאים, בלי פרטים אישיים. אפשר לערוך אותה בוואטסאפ לפני השליחה.' })));

    const mine = h('details', { class: 'cp-mine' }, h('summary', { text: 'התשובות שלכם (אפשר לשנות כל אחת)' }), h('ul', {}, E.answersList(state).map(answerItem)));
    const tools = h('p', { class: 'cp-tools' },
      h('button', { type: 'button', class: 'cp-link-btn', onclick: () => { store.clear(); state = E.newState(); startedAt = Date.now(); render(true); } }, 'להתחיל מחדש'),
      h('button', { type: 'button', class: 'cp-link-btn', onclick: (e) => { store.clear(); e.currentTarget.textContent = 'התשובות נמחקו מהדפדפן'; e.currentTarget.disabled = true; } }, 'למחוק את התשובות מהדפדפן'));
    const share = h('div', { class: 'cp-share' }, h('p', { text: 'מכירים עצמאי שזה יכול לעזור לו?' }),
      h('a', { class: 'button button-line-ink', href: `https://wa.me/?text=${encodeURIComponent('המצפן הפיננסי לעצמאים: כמה שאלות קצרות, ומפת צרכים אישית של מה כדאי לבדוק בחיסכון\nhttps://romanoinvest.co.il/compass')}`, target: '_blank', rel: 'noopener', 'data-count': 'compass:share' }, icon(WA_ICON), 'לשתף את המצפן'));
    const disclaimer = h('p', { class: 'cp-disclaimer' }, R.disclaimer, ' כסוכן פנסיוני רועי רומנו עשוי לקבל עמלות מגופים מוסדיים, הפרטים ב', h('a', { class: 'link', href: '/disclosure', text: 'גילוי הנאות' }), '.');

    box.replaceChildren(head, primary, needs || '', h('div', { class: 'cp-res-grid' }, map, checks), missing, invite, formTile, mine, tools, share, disclaimer);
    if (!still()) { box.classList.remove('is-entering'); void box.offsetWidth; box.classList.add('is-entering'); }
    scrollToTop(box);
    head.querySelector('h2').focus({ preventScroll: true });
  }

  function openForm(button, tile) {
    tile.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    scrollToTop(tile);
    tile.querySelector('input:not([type="hidden"])').focus({ preventScroll: true });
  }

  // ---------- the contact form: the existing Formspree + Sheets pipeline ----------
  function buildForm(res) {
    const topics = [res.primaryNeed.area, ...res.secondaryNeeds.map((n) => n.area)].map((a) => ({ A: 'פנסיה', B: 'ביטוחים', C: 'הטבות מס', D: 'חובת הפקדה', E: 'פתרון לכסף פנוי', F: 'תמונה מלאה של הכול' }[a]));
    const status = h('p', { class: 'form-status', id: 'cp-form-status', role: 'status' });
    const dry = h('div', { class: 'cp-dry', hidden: true });
    const preview = h('pre', { text: E.summary(state, {}) });
    const button = h('button', { type: 'submit', class: 'button' }, 'לשליחת הפרטים');
    const field = (label, input, opt) => h('label', { class: 'cp-field' }, h('span', {}, label, opt ? h('small', { text: ' (לא חובה)' }) : null), input);
    const hidden = (name, value) => h('input', { type: 'hidden', name, value });
    const form = h('form', { class: 'coupon-form cp-form', id: 'cp-lead', action: cfg.formspreeUrl, method: 'POST', novalidate: false },
      h('h3', { text: 'לתיאום שיחת התאמה' }),
      h('p', { class: 'cp-form-lead', text: 'השאירו פרטים ורועי יחזור אליכם. שיחת ההיכרות הראשונה ללא עלות וללא התחייבות.' }),
      hidden('_subject', 'פנייה חדשה מהמצפן הפיננסי'),
      hidden('מקור', 'המצפן הפיננסי'),
      hidden('_replyto', ''),
      field('שם פרטי', h('input', { name: 'שם מלא', required: true, autocomplete: 'given-name', maxlength: '60' })),
      field('טלפון', h('input', { name: 'טלפון', required: true, type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: '20', pattern: '^\\+?[0-9\\s\\-]{9,16}$', title: 'מספר טלפון, למשל 050-1234567' })),
      field('אימייל', h('input', { name: 'אימייל', type: 'email', autocomplete: 'email', maxlength: '100' }), true),
      field('מתי נוח לכם שנדבר?', h('select', { name: 'זמן מועדף' }, ['', 'בבוקר', 'בצהריים', 'אחר הצהריים', 'בערב', 'לא משנה לי'].map((t) => h('option', { value: t, text: t || 'בחרו (לא חובה)' }))), false),
      h('details', { class: 'cp-sent' }, h('summary', { text: 'מה יישלח לרועי יחד עם הפרטים?' }), h('p', { text: 'סיכום של התשובות שלכם במצפן, כדי שרועי יגיע לשיחה מוכן. הוא מסומן כדיווח עצמי.' }), preview),
      h('label', { class: 'coupon-consent' }, h('input', { type: 'checkbox', name: 'הסכמה', value: 'כן', required: true }),
        h('span', {}, 'אני מאשר/ת שרועי רומנו יחזור אליי בנוגע לפנייה, ושיחד עם הפרטים יישלח אליו סיכום התשובות שלי במצפן. קראתי את ', h('a', { class: 'link', href: '/privacy', target: '_blank', text: 'מדיניות הפרטיות' }), ' ואת ', h('a', { class: 'link', href: '/disclosure', target: '_blank', text: 'הגילוי הנאות' }), '.')),
      h('label', { class: 'coupon-consent' }, h('input', { type: 'checkbox', name: 'הסכמה לדיוור', value: 'כן' }),
        h('span', { text: 'אשמח לקבל מדי פעם מאמרים ועדכונים במייל או בוואטסאפ (לא חובה, אפשר להסיר בכל עת).' })),
      button, status, dry);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (button.disabled || !form.reportValidity()) return;
      const contact = {
        name: form.elements['שם מלא'].value.trim(),
        phone: form.elements['טלפון'].value.trim(),
        email: form.elements['אימייל'].value.trim(),
        time: form.elements['זמן מועדף'].value,
        source: utm.join(' / '),
      };
      form.elements._replyto.value = contact.email;
      const data = new FormData(form);
      data.set('מטרה', topics.join(', '));
      data.set('סיכום המצפן', E.summary(state, contact));
      data.set('מזהה שאלון', state.sessionId);
      if (contact.source) data.set('מקור הגעה', contact.source);
      button.disabled = true;
      button.textContent = 'שולח...';
      status.className = 'form-status';
      status.textContent = '';
      const done = () => { button.disabled = false; button.textContent = 'לשליחת הפרטים'; };

      // previews and local copies never send: they show what would have been sent
      if (!cfg.productionHosts.includes(location.hostname)) {
        dry.hidden = false;
        dry.replaceChildren(h('strong', { text: 'תצוגה מקדימה: שום דבר לא נשלח.' }), h('span', { text: 'כך ייראו הנתונים שיגיעו לרועי באתר החי:' }),
          h('pre', { text: [...data.entries()].filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n') }));
        status.className = 'form-status success';
        status.textContent = 'בדיקה בלבד: הטופס תקין ולא נשלח.';
        done();
        return;
      }
      fetch(cfg.sheetsUrl, { method: 'POST', mode: 'no-cors', body: data }).catch(() => {});
      fetch(cfg.formspreeUrl, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          form.reset();
          status.className = 'form-status success';
          status.textContent = 'הפרטים נשלחו. רועי יחזור אליכם בהקדם.';
          count('compass:form');
        })
        .catch(() => { status.className = 'form-status error'; status.textContent = 'אירעה שגיאה בשליחה. אפשר גם להתקשר ישירות: 052-8089808.'; })
        .finally(done);
    });
    return h('section', { class: 'cp-form-tile', id: 'cp-form', hidden: true, 'aria-label': 'טופס יצירת קשר' }, form);
  }
})();
