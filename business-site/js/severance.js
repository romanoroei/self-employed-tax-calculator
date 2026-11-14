// Severance guide (/severance): the calculator, the three-question quiz and the checklist.
// Everything runs in the browser. Only the checklist ticks are kept, in localStorage, and nothing is sent anywhere
// except an anonymous click label to /api/count (no amounts, no answers).
(() => {
  const CEILING = 13750; // exempt severance per year of work, 2026 (unchanged since 2025)
  const count = (label) => { try { navigator.sendBeacon('/api/count', label); } catch { /* optional */ } };
  const num = (el) => {
    const v = parseFloat(String(el.value).replace(/[^\d.]/g, ''));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const ils = (v) => Math.round(v).toLocaleString('he-IL') + ' ₪';

  // thousands separators while typing in the money fields
  for (const id of ['sv-salary', 'sv-amount']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('input', () => {
      const digits = el.value.replace(/\D/g, '');
      el.value = digits ? Number(digits).toLocaleString('he-IL') : '';
    });
  }

  // ===== calculator =====
  const calc = document.getElementById('sv-calc');
  if (calc) {
    calc.addEventListener('submit', (e) => {
      e.preventDefault();
      const salary = num(document.getElementById('sv-salary'));
      const years = num(document.getElementById('sv-years'));
      const given = num(document.getElementById('sv-amount'));
      const error = document.getElementById('sv-calc-error');
      const box = document.getElementById('sv-calc-result');
      if (!salary || !years) { error.hidden = false; box.hidden = true; return; }
      error.hidden = true;
      const total = given || salary * years;
      const cap = Math.min(CEILING, salary * 1.5) * years;
      const free = Math.min(total, cap);
      const tax = Math.max(0, total - free);
      document.getElementById('sv-free').textContent = ils(free);
      document.getElementById('sv-tax').textContent = ils(tax);
      document.getElementById('sv-how').textContent =
        `פיצויים של ${ils(total)}${given ? ' (לפי הטופס)' : ' (שכר אחרון כפול שנות העבודה)'}. תקרת הפטור שלכם: ${ils(cap)}.`;
      box.hidden = false;
      count('severance:calc');
    });
  }

  // ===== quiz =====
  const ANSWERS = {
    now: {
      title: 'כיוון לבדיקה: משיכה חלקית',
      text: ['כשצריך כסף עכשיו, אפשר לשקול למשוך רק את הפיצויים הפטורים ממס, ולהשאיר את החלק החייב במס ברצף קצבה. כך מקבלים כסף לתשלומים הדחופים, אבל זה עלול לפגוע משמעותית בפנסיה בעתיד.'],
      note: 'כל משיכה עכשיו משפיעה על הקצבה בעתיד. לפני שמחליטים, כדאי להתייעץ עם בעל רישיון ולבדוק חלופות, למשל הלוואה.'
    },
    young: {
      title: 'כיוון לבדיקה: רצף קצבה או רצף פיצויים',
      text: ['רצף קצבה: הכסף נשאר בקופה לקצבה בפרישה, או למשיכה של כל הפיצויים בעתיד.', 'רצף פיצויים: מתאים למי שמתכנן למשוך בעתיד את הפיצויים בסכום חד־פעמי. הבחירה הזאת רק דוחה את ההתחשבנות על המס, בהנחה שהמס בעתיד יהיה נמוך יותר.'],
      note: 'רצף פיצויים היא פעולה מורכבת: צריך לנהל אותה לאורך כל תקופת העבודה הבאה, וקשה לסגור אותה מול רשות המסים.'
    },
    default: {
      title: 'כיוון לבדיקה: רצף זכויות לקצבה',
      text: ['לפי הגיל והתוכניות שלכם, הכיוון הראשון לבדיקה הוא רצף זכויות לקצבה. הוא מגדיל את הקצבה החודשית בפרישה, ודוחה את המס עד שמתחילים לקבל אותה.'],
      note: 'לרוב זו הבחירה הטובה ביותר לטווח הארוך.'
    }
  };
  const quiz = document.getElementById('sv-quiz');
  if (quiz) {
    quiz.addEventListener('submit', (e) => {
      e.preventDefault();
      const pick = (n) => (quiz.querySelector(`input[name="${n}"]:checked`) || {}).value;
      const [q1, q2, q3] = [pick('q1'), pick('q2'), pick('q3')];
      const error = document.getElementById('sv-quiz-error');
      const box = document.getElementById('sv-answer');
      if (!q1 || !q2 || !q3) { error.hidden = false; box.hidden = true; return; }
      error.hidden = true;
      const a = q1 === 'now' ? ANSWERS.now : (q2 === 'young' && q3 === 'yes') ? ANSWERS.young : ANSWERS.default;
      box.replaceChildren();
      const h = document.createElement('h3'); h.textContent = a.title; box.append(h);
      for (const t of a.text) { const p = document.createElement('p'); p.textContent = t; box.append(p); }
      const n = document.createElement('p'); n.className = 'sv-answer-note'; n.textContent = a.note; box.append(n);
      const go = document.createElement('a'); go.className = 'button'; go.href = '/#contact'; go.textContent = 'לבדוק את זה בשיחת התאמה'; box.append(go);
      box.hidden = false;
      box.focus({ preventScroll: true });
      box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
      count('severance:quiz');
    });
  }

  // ===== checklist, kept in this browser only =====
  const KEY = 'severance-checklist';
  const list = document.getElementById('sv-check');
  if (list) {
    const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
    try { (JSON.parse(localStorage.getItem(KEY)) || []).forEach((v, i) => { if (boxes[i]) boxes[i].checked = !!v; }); } catch { /* storage may be blocked */ }
    const update = () => {
      const pct = Math.round(boxes.filter((b) => b.checked).length / boxes.length * 100);
      document.getElementById('sv-bar-fill').style.width = pct + '%';
      document.getElementById('sv-bar').setAttribute('aria-valuenow', pct);
      document.getElementById('sv-progress-pct').textContent = pct + '%';
      document.getElementById('sv-progress-msg').textContent =
        pct === 0 ? 'סמנו כל שלב שסיימתם' : pct < 50 ? 'התחלה טובה, ממשיכים לשלב הבא' : pct < 100 ? 'כמעט שם' : 'סיימתם את כל השלבים';
    };
    list.addEventListener('change', () => {
      update();
      try { localStorage.setItem(KEY, JSON.stringify(boxes.map((b) => b.checked))); } catch { /* storage may be blocked */ }
    });
    update();
  }
})();
