// /financial-check: the interface. It draws what engine.mjs decides and holds no rules of its own.
// The answers stay in this tab (sessionStorage) until the visitor chooses to send the form. Text is always set
// with textContent, never as HTML, so nothing typed, stored or passed in the link can inject markup.
import * as E from './engine.mjs';

const { TEXTS, CONSENT, CONFIG: cfg } = E;
const root = document.getElementById('fcheck');
if (root) start();

function start() {
  const screens = Object.fromEntries(['intro', 'run', 'result', 'done'].map((k) => [k, root.querySelector(`[data-screen="${k}"]`)]));
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-still');
  const live = cfg.productionHosts.includes(location.hostname);

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

  // ---------- this tab only ----------
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode: nothing kept */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nothing to clear */ } },
  };
  const KEY = cfg.storageKey;
  const SRC = cfg.storageKey + '-src';
  const SENT = cfg.storageKey + '-sent';

  // ---------- where the visitor came from: kept with the answers, sent only with the form ----------
  const params = new URLSearchParams(location.search);
  let source = null;
  try { source = JSON.parse(session.get(SRC) || 'null'); } catch (e) { source = null; }
  if (['ref', 'utm_source', 'utm_medium', 'utm_campaign'].some((k) => params.get(k)) || !source) {
    let referrer = '';
    try { const r = document.referrer && new URL(document.referrer); referrer = r && r.hostname !== location.hostname ? r.origin : ''; } catch (e) { referrer = ''; }
    source = E.cleanSource({ ref: params.get('ref'), utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'), referrer });
    session.set(SRC, JSON.stringify(source));
  }
  const ref = E.refLabel(source.ref);

  // ---------- anonymous totals: a label only, each at most once per page load, live site only ----------
  const counted = new Set();
  const count = (label) => {
    if (!live || counted.has(label)) return;
    counted.add(label);
    try { navigator.sendBeacon(cfg.countUrl, label); } catch (e) { /* counting is optional */ }
  };
  count(`fc:view-${ref}`);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-fc-site]');
    if (a) count(`fc:site-${a.dataset.fcSite}`);
  });

  let state = null;
  let current = null; // the question on screen, for the "where did the visit end" count
  const save = () => session.set(KEY, JSON.stringify(state));
  const show = (name) => { for (const [k, el] of Object.entries(screens)) el.hidden = k !== name; };
  function scrollToTop(el) {
    const bar = document.querySelector('.topbar');
    const y = el.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 12;
    if (window.scrollY > y || y - window.scrollY > window.innerHeight * 0.35) window.scrollTo({ top: Math.max(0, y), behavior: still() ? 'instant' : 'smooth' });
  }
  // a visit that ends on a question: counted once per question, so the drop-off point shows in the totals
  const leave = () => { if (document.visibilityState === 'hidden' && current && !screens.run.hidden) count(`fc:exit-${current}`); };
  document.addEventListener('visibilitychange', leave);
  window.addEventListener('pagehide', () => { if (current && !screens.run.hidden) count(`fc:exit-${current}`); });

  // ---------- intro ----------
  const seasonBox = screens.intro.querySelector('[data-season]');
  if (E.inSeason(new Date())) { seasonBox.textContent = TEXTS.season; seasonBox.hidden = false; }
  screens.intro.querySelector('[data-start]').addEventListener('click', () => begin());
  function begin() {
    state = E.newState();
    session.del(SENT);
    count(`fc:start-${ref}`);
    render(true);
  }

  // ---------- the question screen ----------
  const progress = screens.run.querySelector('[data-progress]');
  const qBox = screens.run.querySelector('[data-question]');
  const answersBox = screens.run.querySelector('[data-answers]');
  const answersUl = screens.run.querySelector('[data-answers-list]');

  function render(focus) {
    save();
    const v = E.view(state);
    if (!v.question) { current = null; renderResult(); return; }
    show('run');
    const q = v.question;
    current = q.id;

    const pct = Math.round(((v.index - 1) / v.total) * 100);
    const bar = h('i', {});
    progress.replaceChildren(
      h('div', { class: 'fc-bar', role: 'progressbar', 'aria-label': 'התקדמות בשאלון', 'aria-valuemin': '0', 'aria-valuemax': String(v.total), 'aria-valuenow': String(v.index - 1), 'aria-valuetext': `שאלה ${v.index} מתוך ${v.total}` }, bar),
      h('p', { class: 'fc-progress-label' }, h('span', {}, 'שאלה ', h('strong', { text: `${v.index} מתוך ${v.total}` })), h('span', { text: v.index > 1 ? 'אפשר לחזור ולשנות כל תשובה' : '' })));
    requestAnimationFrame(() => { bar.style.width = `${pct}%`; });

    const name = `q-${q.id}`;
    const error = h('p', { class: 'cp-error', id: 'fc-error', role: 'alert' });
    const helpEl = q.help ? h('p', { class: 'cp-help', id: 'fc-help', text: q.help }) : null;
    const heading = h('h2', { id: 'fc-qtitle', tabindex: '-1', text: q.text });
    const fieldset = h('fieldset', { class: 'cp-opts', 'aria-labelledby': 'fc-qtitle', 'aria-describedby': [helpEl ? 'fc-help' : '', 'fc-error'].filter(Boolean).join(' ') },
      q.options.map((o, i) => h('label', { class: 'cp-opt cp-opt-radio', for: `${name}-${i}` },
        h('input', { type: 'radio', name, value: o.id, id: `${name}-${i}`, checked: q.selected === o.id }),
        h('span', { class: 'cp-mark', 'aria-hidden': 'true' }),
        h('span', { class: 'cp-opt-text' }, h('span', { text: o.label })))));
    const inputs = [...fieldset.querySelectorAll('input')];
    const go = () => {
      const on = inputs.find((i) => i.checked);
      if (!on) { error.textContent = 'בחר/י תשובה כדי להמשיך.'; inputs[0].focus(); return; }
      advance(q.id, on.value);
    };
    // a choice made with a pointer moves on by itself; the keyboard keeps the explicit button
    fieldset.addEventListener('click', (e) => {
      const label = e.target.closest('label');
      if (!label || e.detail === 0) return;
      const input = label.querySelector('input');
      input.checked = true;
      error.textContent = '';
      setTimeout(() => { if (input.checked && current === q.id && !screens.run.hidden) go(); }, still() ? 0 : 220);
    });
    fieldset.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); go(); } });
    const nav = h('div', { class: 'cp-nav' },
      h('button', { type: 'button', class: 'cp-link-btn', hidden: !v.canBack, onclick: () => { state = E.back(state); render(true); } }, 'חזרה'),
      h('button', { type: 'button', class: 'button button-ink cp-next', onclick: go }, 'המשך'));

    qBox.replaceChildren(heading, helpEl || '', fieldset, error, nav);
    if (!still()) { qBox.classList.remove('is-entering'); void qBox.offsetWidth; qBox.classList.add('is-entering'); }

    const list = E.answersList(state);
    answersBox.hidden = !list.length;
    answersUl.replaceChildren(...list.map(answerItem));
    if (focus) { scrollToTop(screens.run); heading.focus({ preventScroll: true }); }
  }

  function answerItem(a) {
    return h('li', {}, h('span', {}, h('b', { text: `${a.label}: ` }), a.answer),
      h('button', { type: 'button', class: 'cp-link-btn', 'aria-label': `שינוי התשובה: ${a.label}`, onclick: () => { state = E.editFrom(state, a.q); count('fc:edit'); render(true); } }, 'שינוי'));
  }

  function advance(qid, optionId) {
    const first = qid === 'need' && !state.history.some((x) => x.q === 'need');
    state = E.answer(state, qid, optionId);
    if (first) count(`fc:route-${optionId}`);
    render(true);
  }

  // ---------- the result ----------
  function renderResult() {
    const res = E.result(state);
    if (!res) { show('intro'); return; }
    show('result');
    count(`fc:result-${res.track}`);
    const box = screens.result;

    const head = h('header', { class: 'tile tile-ink cp-res-head' },
      h('h2', { id: 'fc-result-title', tabindex: '-1', text: TEXTS.resultTitle }));
    const primary = h('section', { class: 'tile tile-gold cp-res-primary', 'aria-labelledby': 'fc-track' },
      h('small', { text: TEXTS.resultPrefix }),
      h('h3', { id: 'fc-track', text: res.title }),
      h('p', { text: res.text }),
      res.seasonNote ? h('p', { class: 'fc-season-note', text: res.seasonNote }) : null);
    const disclaimer = h('p', { class: 'cp-disclaimer' }, TEXTS.resultDisclaimer, ' כסוכן פנסיוני רועי רומנו עשוי לקבל עמלות מגופים מוסדיים, הפרטים ב', h('a', { class: 'link', href: '/disclosure', target: '_blank', rel: 'noopener', text: 'גילוי הנאות' }), '.');
    const mine = h('details', { class: 'cp-mine' }, h('summary', { text: 'התשובות שלך (אפשר לשנות כל אחת)' }), h('ul', {}, E.answersList(state).map(answerItem)));
    const tools = h('p', { class: 'fc-tools' },
      h('button', { type: 'button', class: 'cp-link-btn', onclick: () => { count('fc:restart'); session.del(KEY); begin(); } }, 'להתחיל מחדש'),
      h('a', { class: 'link', href: cfg.siteUrl, target: '_blank', rel: 'noopener', 'data-fc-site': 'result' }, 'רוצה להכיר את רועי רומנו קודם? ←', h('span', { class: 'visually-hidden', text: ' (נפתח בלשונית חדשה)' })));

    box.replaceChildren(head, primary, disclaimer, buildForm(res), mine, tools);
    if (!still()) { box.classList.remove('is-entering'); void box.offsetWidth; box.classList.add('is-entering'); }
    scrollToTop(box);
    head.querySelector('h2').focus({ preventScroll: true });
  }

  // ---------- the form: our own function, which checks everything again and forwards to Formspree and Sheets ----------
  function buildForm(res) {
    const tile = h('section', { class: 'fc-form-tile', id: 'fc-form', 'aria-labelledby': 'fc-form-title' });
    if (session.get(SENT) === state.sessionId) {
      tile.append(h('div', { class: 'coupon-form' }, h('h3', { id: 'fc-form-title', text: TEXTS.successTitle }), h('p', { class: 'fc-sent-note', text: 'הפרטים מהבדיקה הזו כבר נשלחו לרועי.' })));
      return tile;
    }
    const status = h('p', { class: 'form-status', id: 'fc-form-status', role: 'status' });
    const dry = h('div', { class: 'cp-dry', hidden: true });
    const button = h('button', { type: 'submit', class: 'button' }, TEXTS.formButton);
    const errors = {};
    const field = (key, label, input, optional) => {
      errors[key] = h('span', { class: 'fc-field-error', id: `fc-err-${key}` });
      input.setAttribute('aria-describedby', `fc-err-${key}`);
      return h('label', { class: 'cp-field' }, h('span', {}, label, optional ? h('small', { text: ' (לא חובה)' }) : null), input, errors[key]);
    };
    const name = h('input', { name: 'name', required: true, autocomplete: 'name', maxlength: '60' });
    const phone = h('input', { name: 'phone', required: true, type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: '20', dir: 'ltr' });
    const email = h('input', { name: 'email', type: 'email', autocomplete: 'email', maxlength: '100', dir: 'ltr' });
    const consent = h('input', { type: 'checkbox', name: 'consent', required: true, 'aria-describedby': 'fc-err-consent' });
    const marketing = h('input', { type: 'checkbox', name: 'marketing' });
    errors.consent = h('span', { class: 'fc-field-error', id: 'fc-err-consent' });
    // a field people never see; a bot that fills it is dropped quietly by the server
    const hp = h('div', { class: 'fc-hp', 'aria-hidden': 'true' }, h('label', {}, 'אתר', h('input', { name: 'website', tabindex: '-1', autocomplete: 'off' })));
    const preview = h('ul', {}, E.answersList(state).map((a) => h('li', { text: `${a.question} ${a.answer}` })));
    const form = h('form', { class: 'coupon-form', novalidate: true },
      h('h3', { id: 'fc-form-title', text: TEXTS.formTitle }),
      h('p', { class: 'fc-form-lead', text: TEXTS.formText }),
      field('name', 'שם מלא', name),
      field('phone', 'מספר טלפון נייד', phone),
      field('email', 'כתובת דוא"ל', email, true),
      hp,
      h('details', { class: 'cp-sent' }, h('summary', { text: 'מה יישלח לרועי יחד עם הפרטים?' }),
        h('p', { text: 'השאלות שנשאלת והתשובות שבחרת, כדי שרועי יגיע לשיחה מוכן, ואם הגעת מקישור של שיתוף פעולה גם מקור הקישור:' }), preview),
      h('label', { class: 'coupon-consent' }, consent, h('span', {}, CONSENT.text.replace('בהתאם למדיניות הפרטיות.', 'בהתאם ל'), h('a', { class: 'link', href: '/privacy', target: '_blank', rel: 'noopener', text: 'מדיניות הפרטיות' }), '.')),
      errors.consent,
      h('label', { class: 'coupon-consent' }, marketing, h('span', { text: CONSENT.marketing })),
      button, status, dry);

    let opened = false;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      if (!opened && entries.some((e) => e.isIntersecting)) { opened = true; count('fc:form'); io.disconnect(); }
    }) : null;
    if (io) io.observe(form); else count('fc:form');

    const showErrors = (errs) => {
      for (const [k, el] of Object.entries(errors)) el.textContent = errs[k] || '';
      for (const [k, input] of [['name', name], ['phone', phone], ['email', email]]) input.setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
      const firstBad = ['name', 'phone', 'email', 'consent'].find((k) => errs[k]);
      if (firstBad) ({ name, phone, email, consent })[firstBad].focus();
      return !firstBad;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (button.disabled) return;
      const check = E.checkContact({ name: name.value, phone: phone.value, email: email.value });
      const errs = { ...check.errors };
      if (!consent.checked) errs.consent = 'כדי שרועי יוכל לחזור אליך, יש לאשר יצירת קשר.';
      if (!showErrors(errs)) return;
      const payload = {
        sessionId: state.sessionId,
        answers: state.history.map((x) => ({ q: x.q, o: x.o })),
        contact: check.clean,
        consent: { contact: true, marketing: marketing.checked, version: CONSENT.version },
        source,
        website: form.elements.website.value,
      };
      status.className = 'form-status';
      status.textContent = '';
      // previews and local copies never send: they show the message Roei would get
      if (!live) {
        const msg = E.leadMessage(state, check.clean, source, payload.consent);
        dry.hidden = false;
        dry.replaceChildren(h('strong', { text: 'תצוגה מקדימה: שום דבר לא נשלח.' }), h('span', { text: `כך ייראה המייל שיגיע לרועי באתר החי. נושא: ${msg.subject}` }), h('pre', { text: msg.text }));
        status.className = 'form-status success';
        status.textContent = 'בדיקה בלבד: הטופס תקין ולא נשלח.';
        return;
      }
      button.disabled = true;
      button.textContent = 'שולח...';
      try {
        const r = await fetch(cfg.leadUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const body = await r.json().catch(() => ({}));
        if (r.ok && body.ok) {
          count(`fc:sent-${ref}`);
          session.set(SENT, state.sessionId);
          session.del(KEY);
          renderDone();
          return;
        }
        count('fc:fail');
        if (r.status === 400 && body.error === 'contact') { showErrors(Object.fromEntries((body.fields || []).map((k) => [k, 'נא לבדוק את השדה']))); }
        status.className = 'form-status error';
        status.textContent = r.status === 429
          ? 'נשלחו כבר כמה פניות מהחיבור הזה בשעה האחרונה. אפשר להתקשר ישירות: ' + cfg.phone + '.'
          : 'אירעה שגיאה בשליחה, והפרטים לא נשלחו. אפשר לנסות שוב, או להתקשר ישירות: ' + cfg.phone + '.';
      } catch (err) {
        count('fc:fail');
        status.className = 'form-status error';
        status.textContent = 'אין חיבור כרגע, והפרטים לא נשלחו. אפשר לנסות שוב, או להתקשר ישירות: ' + cfg.phone + '.';
      } finally {
        button.disabled = false;
        button.textContent = TEXTS.formButton;
      }
    });
    tile.append(form);
    return tile;
  }

  // ---------- after sending ----------
  function renderDone() {
    show('done');
    const box = screens.done;
    const tile = h('div', { class: 'tile tile-ink fc-done-tile' },
      h('h2', { id: 'fc-done-title', tabindex: '-1', text: TEXTS.successTitle }),
      h('p', { text: TEXTS.successText }),
      h('div', { class: 'fc-done-actions' },
        h('a', { class: 'button', href: cfg.siteUrl, 'data-fc-site': 'success' }, 'מעבר לאתר העסקי של רועי רומנו'),
        h('button', { type: 'button', class: 'button button-line', onclick: () => { state = null; session.del(KEY); show('intro'); scrollToTop(screens.intro); screens.intro.querySelector('[data-start]').focus(); } }, 'חזרה לתחילת השאלון')));
    box.replaceChildren(tile);
    if (!still()) { box.classList.remove('is-entering'); void box.offsetWidth; box.classList.add('is-entering'); }
    scrollToTop(box);
    tile.querySelector('h2').focus({ preventScroll: true });
  }

  // ---------- a reload in the same tab continues where the visitor was ----------
  const saved = E.restore(session.get(KEY) || '');
  if (saved && saved.history.length) { state = saved; render(false); }
}
