// /financial-check: the question definitions and the order of each route. Wording only, no logic.
// Every question and option has a stable id: the answers, the counters and the lead record use the ids,
// so a label can be reworded without breaking anything. To add a question: define it here, place it in
// a route (with a `when` if it is conditional), and run the tests.
//
// A question writes its answer to a `fact`. Two questions may share a fact (for example employment in
// routes C and E), and a question whose fact is already known is never asked again.

export const ENTRY = 'need';

export const QUESTIONS = {
  need: {
    fact: 'need', label: 'הצורך המרכזי',
    text: 'מה הכי חשוב לך כרגע?',
    options: [
      { id: 'invest', label: 'יש לי סכום פנוי ואני רוצה לבחון אפשרויות השקעה' },
      { id: 'monthly', label: 'אני רוצה להתחיל לחסוך סכום קבוע בכל חודש' },
      { id: 'pension', label: 'אני רוצה לעשות סדר בפנסיה ובביטוחים' },
      { id: 'selfemp', label: 'אני עצמאי/ת ורוצה לבדוק הטבות מס והפקדות' },
      { id: 'unsure', label: 'אני לא ממש יודע/ת מאיפה להתחיל' },
    ],
  },

  // ---------- route A: a sum to invest ----------
  a_amount: {
    fact: 'amount', label: 'סכום פנוי',
    text: 'מה הסכום הפנוי?',
    options: [
      { id: 'upto25', label: 'עד 25,000 ₪' },
      { id: '25to50', label: '25,000–50,000 ₪' },
      { id: '50to100', label: '50,000–100,000 ₪' },
      { id: '100to300', label: '100,000–300,000 ₪' },
      { id: 'over300', label: 'מעל 300,000 ₪' },
    ],
  },
  a_purpose: {
    fact: 'purpose', label: 'ייעוד הכסף',
    text: 'האם הכסף הזה מיועד למטרה מסוימת?',
    options: [
      { id: 'home', label: 'רכישת דירה או נכס' },
      { id: 'future', label: 'שיפור המצב הכלכלי בעתיד' },
      { id: 'income', label: 'יצירת הכנסה נוספת' },
      { id: 'general', label: 'חיסכון כללי ללא יעד מוגדר' },
      { id: 'other', label: 'מטרה אחרת' },
    ],
  },
  a_horizon: {
    fact: 'horizon', label: 'מתי יידרש הכסף',
    text: 'מתי לדעתך יהיה צורך בכסף?',
    options: [
      { id: 'y1', label: 'במהלך השנה הקרובה' },
      { id: 'y1to3', label: 'בעוד שנה עד שלוש שנים' },
      { id: 'y3to5', label: 'בעוד שלוש עד חמש שנים' },
      { id: 'y5plus', label: 'בעוד יותר מחמש שנים' },
      { id: 'unknown', label: 'עדיין לא החלטתי' },
    ],
  },
  a_priority: {
    fact: 'moneyPriority', label: 'מה הכי חשוב לגבי הכסף',
    text: 'מה הכי חשוב לך לגבי הכסף?',
    help: 'זו שאלה להבנת הצורך בלבד, ולא שאלון לקביעת רמת סיכון.',
    options: [
      { id: 'liquid', label: 'שיהיה נזיל וזמין' },
      { id: 'grow', label: 'לנסות להגדיל את הסכום לאורך זמן' },
      { id: 'lowvol', label: 'לשמור על תנודתיות נמוכה ככל האפשר' },
      { id: 'mix', label: 'לשלב בין צמיחה לנזילות' },
      { id: 'unsure', label: 'עדיין לא יודע/ת' },
    ],
  },
  a_where: {
    fact: 'whereNow', label: 'איפה הסכום כיום',
    text: 'היכן נמצא הסכום כיום?',
    options: [
      { id: 'checking', label: 'בחשבון העו"ש' },
      { id: 'deposit', label: 'בפיקדון בנקאי' },
      { id: 'portfolio', label: 'בתיק השקעות או במניות' },
      { id: 'gemel_policy', label: 'בקופת גמל להשקעה או בפוליסת חיסכון' },
      { id: 'several', label: 'בכמה מקומות שונים' },
    ],
  },
  a_when: {
    fact: 'urgency', label: 'מתי להתחיל',
    text: 'מתי היית רוצה להתחיל לטפל בנושא?',
    options: [
      { id: 'asap', label: 'בהקדם האפשרי' },
      { id: 'month', label: 'במהלך החודש הקרוב' },
      { id: 'months', label: 'בחודשים הקרובים' },
      { id: 'explore', label: 'כרגע בעיקר רוצה להבין את האפשרויות' },
    ],
  },

  // ---------- route B: monthly saving ----------
  b_monthly: {
    fact: 'monthly', label: 'חיסכון חודשי',
    text: 'איזה סכום אפשר לחסוך בחודש?',
    options: [
      { id: 'upto500', label: 'עד 500 ₪' },
      { id: '500to1500', label: '500–1,500 ₪' },
      { id: '1500to3000', label: '1,500–3,000 ₪' },
      { id: 'over3000', label: 'מעל 3,000 ₪' },
      { id: 'unknown', label: 'עדיין לא יודע/ת' },
    ],
  },
  b_existing: {
    fact: 'existing', label: 'חיסכון קיים',
    text: 'האם כבר קיים חיסכון כלשהו?',
    options: [
      { id: 'bank', label: 'כן, חיסכון בבנק' },
      { id: 'gemel_policy', label: 'כן, קופת גמל להשקעה או פוליסת חיסכון' },
      { id: 'market', label: 'כן, השקעות בשוק ההון' },
      { id: 'several', label: 'יש כמה סוגי חסכונות' },
      { id: 'none', label: 'עדיין אין לי חיסכון' },
    ],
  },
  b_goal: {
    fact: 'goal', label: 'מטרת החיסכון',
    text: 'מה מטרת החיסכון?',
    options: [
      { id: 'security', label: 'בניית ביטחון כלכלי' },
      { id: 'home', label: 'רכישת דירה' },
      { id: 'family', label: 'חיסכון לילדים או למשפחה' },
      { id: 'longterm', label: 'צבירת הון לטווח ארוך' },
      { id: 'none', label: 'עדיין אין מטרה מוגדרת' },
    ],
  },
  b_horizon: {
    fact: 'horizon', label: 'מתי יידרש הכסף',
    text: 'מתי צפוי להיות צורך בכסף?',
    options: [
      { id: 'y1', label: 'עד שנה' },
      { id: 'y1to3', label: 'שנה עד שלוש שנים' },
      { id: 'y3to5', label: 'שלוש עד חמש שנים' },
      { id: 'y5plus', label: 'מעל חמש שנים' },
      { id: 'unknown', label: 'עדיין לא יודע/ת' },
    ],
  },
  b_lump: {
    fact: 'lump', label: 'סכום חד־פעמי',
    text: 'האם יש כרגע גם סכום חד־פעמי לחיסכון?',
    options: [
      { id: 'no', label: 'לא' },
      { id: 'upto25', label: 'עד 25,000 ₪' },
      { id: '25to100', label: '25,000–100,000 ₪' },
      { id: 'over100', label: 'מעל 100,000 ₪' },
    ],
  },
  b_when: {
    fact: 'urgency', label: 'מתי להתחיל',
    text: 'מתי תרצה/י להתחיל?',
    options: [
      { id: 'asap', label: 'בהקדם האפשרי' },
      { id: 'month', label: 'במהלך החודש הקרוב' },
      { id: 'months', label: 'בחודשים הקרובים' },
      { id: 'explore', label: 'כרגע רוצה רק להבין' },
    ],
  },

  // ---------- route C: pension and insurance ----------
  c_employment: {
    fact: 'employment', label: 'מצב תעסוקתי',
    text: 'מה המצב התעסוקתי?',
    options: [
      { id: 'employee', label: 'שכיר/ה' },
      { id: 'self', label: 'עצמאי/ת' },
      { id: 'both', label: 'גם שכיר/ה וגם עצמאי/ת' },
      { id: 'other', label: 'לא עובד/ת כרגע / אחר' },
    ],
  },
  c_selfdeposits: {
    fact: 'selfDeposits', label: 'הפקדות כעצמאי/ת',
    text: 'האם יש לך כיום הפקדות פעילות לפנסיה או לקרן השתלמות?',
    options: [
      { id: 'both', label: 'כן, לשתיהן' },
      { id: 'pension', label: 'רק לפנסיה' },
      { id: 'study', label: 'רק לקרן השתלמות' },
      { id: 'none', label: 'לא' },
      { id: 'unsure', label: 'לא בטוח/ה' },
    ],
  },
  c_focus: {
    fact: 'focus', label: 'מה חשוב לבדוק',
    text: 'מה בעיקר חשוב לך לבדוק?',
    options: [
      { id: 'pension', label: 'קרן הפנסיה והחיסכון לגיל פרישה' },
      { id: 'insurance', label: 'ביטוחי בריאות, חיים ואובדן כושר עבודה' },
      { id: 'fees', label: 'דמי ניהול והתאמת מסלולי השקעה' },
      { id: 'all', label: 'כל התוכניות והביטוחים ביחד' },
      { id: 'unsure', label: 'לא בטוח/ה מה קיים על שמי' },
    ],
  },
  c_insreason: {
    fact: 'insReason', label: 'סיבת בדיקת הביטוחים',
    text: 'מה הסיבה העיקרית לבדיקה?',
    options: [
      { id: 'duplicate', label: 'חשש לכפל ביטוחים' },
      { id: 'cost', label: 'בדיקת עלויות' },
      { id: 'coverage', label: 'בדיקת הכיסויים הקיימים' },
      { id: 'needs', label: 'שינוי בצרכים' },
      { id: 'general', label: 'בדיקה כללית' },
    ],
  },
  c_lastcheck: {
    fact: 'lastCheck', label: 'בדיקה מקצועית אחרונה',
    text: 'מתי בוצעה בדיקה מקצועית לאחרונה?',
    options: [
      { id: 'y1', label: 'בשנה האחרונה' },
      { id: 'y1to3', label: 'לפני שנה עד שלוש שנים' },
      { id: 'y3plus', label: 'לפני יותר משלוש שנים' },
      { id: 'never', label: 'מעולם לא בוצעה בדיקה' },
      { id: 'unknown', label: 'לא זוכר/ת' },
    ],
  },
  c_known: {
    fact: 'knowsProducts', label: 'מה ידוע על המוצרים הקיימים',
    text: 'האם ידוע לך מה קיים על שמך?',
    options: [
      { id: 'yes', label: 'כן, יש לי תמונה מסודרת' },
      { id: 'partial', label: 'מכיר/ה רק חלק מהתוכניות' },
      { id: 'no', label: 'לא ממש יודע/ת' },
    ],
  },
  c_change: {
    fact: 'lifeChange', label: 'שינויים אחרונים',
    text: 'האם חלו שינויים משמעותיים לאחרונה?',
    options: [
      { id: 'job', label: 'מעבר עבודה' },
      { id: 'selfemp', label: 'מעבר לעצמאות' },
      { id: 'income', label: 'שינוי בהכנסה' },
      { id: 'family', label: 'שינוי משפחתי' },
      { id: 'none', label: 'לא חל שינוי משמעותי' },
    ],
  },
  c_when: {
    fact: 'urgency', label: 'מתי לטפל',
    text: 'מתי תרצה/י לטפל בנושא?',
    options: [
      { id: 'asap', label: 'בהקדם' },
      { id: 'month', label: 'בחודש הקרוב' },
      { id: 'later', label: 'בהמשך' },
      { id: 'explore', label: 'כרגע רוצה להבין את האפשרויות' },
    ],
  },

  // ---------- route D: the self-employed and tax benefits ----------
  d_status: {
    fact: 'bizStatus', label: 'סטטוס העסק',
    text: 'מה הסטטוס שלך?',
    options: [
      { id: 'exempt', label: 'עוסק פטור' },
      { id: 'licensed', label: 'עוסק מורשה' },
      { id: 'company', label: 'בעל/ת חברה' },
      { id: 'both', label: 'גם שכיר/ה וגם עצמאי/ת' },
      { id: 'planning', label: 'מתכנן/ת לפתוח עסק' },
    ],
    // what the status tells about employment, so it is never asked again
    derive: [{ if: ['exempt', 'licensed', 'company'], set: { employment: 'self' } }, { if: ['both'], set: { employment: 'both' } }],
  },
  d_study: {
    fact: 'studyFund', label: 'קרן השתלמות',
    text: 'האם יש לך קרן השתלמות?',
    options: [
      { id: 'regular', label: 'כן, ואני מפקיד/ה באופן שוטף' },
      { id: 'irregular', label: 'כן, אבל לא מפקיד/ה בקביעות' },
      { id: 'none', label: 'אין לי' },
      { id: 'unsure', label: 'לא בטוח/ה' },
    ],
  },
  d_study_interest: {
    fact: 'studyInterest', label: 'עניין בקרן השתלמות',
    text: 'האם מעניין אותך לבדוק אפשרות לפתיחת קרן השתלמות לעצמאים?',
    options: [
      { id: 'yes', label: 'כן' },
      { id: 'maybe', label: 'אולי, רוצה להבין' },
      { id: 'no', label: 'לא כרגע' },
    ],
  },
  d_pension: {
    fact: 'pensionActive', label: 'חיסכון פנסיוני פעיל',
    text: 'האם יש לך חיסכון פנסיוני פעיל?',
    options: [
      { id: 'regular', label: 'כן, אני מפקיד/ה באופן שוטף' },
      { id: 'irregular', label: 'כן, אבל ההפקדות אינן סדירות' },
      { id: 'none', label: 'אין לי חיסכון פנסיוני פעיל' },
      { id: 'unsure', label: 'לא בטוח/ה' },
    ],
  },
  d_pension_interest: {
    fact: 'pensionInterest', label: 'עניין בחיסכון פנסיוני',
    text: 'האם מעניין אותך לבדוק את חובת ההפקדה ואת אפשרויות החיסכון הפנסיוני?',
    options: [
      { id: 'yes', label: 'כן' },
      { id: 'understand', label: 'רוצה להבין מה נדרש' },
      { id: 'no', label: 'לא כרגע' },
    ],
  },
  d_checked: {
    fact: 'taxChecked', label: 'בדיקת הפקדות והטבות מס השנה',
    text: 'האם בדקת את ההפקדות והטבות המס שלך לשנה הנוכחית?',
    options: [
      { id: 'advisor', label: 'כן, עם רואה החשבון או יועץ המס' },
      { id: 'self', label: 'בדקתי באופן עצמאי' },
      { id: 'notyet', label: 'עדיין לא בדקתי' },
      { id: 'unknown', label: 'לא יודע/ת אילו הטבות רלוונטיות עבורי' },
    ],
  },
  d_goal: {
    fact: 'selfGoal', label: 'מה הכי חשוב',
    text: 'מה הכי חשוב לך?',
    options: [
      { id: 'tax', label: 'לבדוק ניצול הטבות מס' },
      { id: 'grow', label: 'להגדיל את החיסכון' },
      { id: 'openstudy', label: 'לפתוח קרן השתלמות' },
      { id: 'pension', label: 'להסדיר הפקדות לפנסיה' },
      { id: 'all', label: 'לעשות סדר בכל התוכניות' },
    ],
  },
  d_when: {
    fact: 'urgency', label: 'מתי לטפל',
    text: 'מתי תרצה/י לטפל בנושא?',
    options: [
      { id: 'asap', label: 'בהקדם האפשרי' },
      { id: 'yearend', label: 'לפני סוף השנה' },
      { id: 'months', label: 'בחודשים הקרובים' },
      { id: 'explore', label: 'כרגע רוצה להבין את האפשרויות' },
    ],
  },

  // ---------- route E: not sure where to start ----------
  e_employment: {
    fact: 'employment', label: 'מצב תעסוקתי',
    text: 'מה המצב התעסוקתי?',
    options: [
      { id: 'employee', label: 'שכיר/ה' },
      { id: 'self', label: 'עצמאי/ת' },
      { id: 'both', label: 'גם שכיר/ה וגם עצמאי/ת' },
      { id: 'other', label: 'אחר' },
    ],
  },
  e_concern: {
    fact: 'concern', label: 'מה הכי מטריד',
    text: 'מה הכי מטריד אותך בנושא הכסף?',
    options: [
      { id: 'idle', label: 'הכסף שלי לא מנוצל כמו שצריך' },
      { id: 'notsaving', label: 'אני לא חוסך/ת מספיק' },
      { id: 'unknown', label: 'אני לא יודע/ת מה יש לי בפנסיה ובביטוחים' },
      { id: 'tax', label: 'אני חושש/ת שאני מפספס/ת הטבות מס' },
      { id: 'order', label: 'אני רוצה לעשות סדר באופן כללי' },
    ],
  },
  e_amount: {
    fact: 'amount', label: 'סכום פנוי',
    text: 'האם יש לך סכום פנוי?',
    options: [
      { id: 'none', label: 'אין כרגע' },
      { id: 'upto25', label: 'עד 25,000 ₪' },
      { id: '25to100', label: '25,000–100,000 ₪' },
      { id: '100to300', label: '100,000–300,000 ₪' },
      { id: 'over300', label: 'מעל 300,000 ₪' },
    ],
  },
  e_monthly: {
    fact: 'monthly', label: 'חיסכון חודשי',
    text: 'האם אפשר לחסוך בכל חודש?',
    options: [
      { id: 'none', label: 'לא כרגע' },
      { id: 'upto500', label: 'עד 500 ₪' },
      { id: '500to1500', label: '500–1,500 ₪' },
      { id: 'over1500', label: 'מעל 1,500 ₪' },
      { id: 'unknown', label: 'עדיין לא יודע/ת' },
    ],
  },
  e_when: {
    fact: 'urgency', label: 'מתי להתחיל',
    text: 'מתי תרצה/י להתחיל?',
    options: [
      { id: 'asap', label: 'בהקדם' },
      { id: 'month', label: 'בחודש הקרוב' },
      { id: 'months', label: 'בחודשים הקרובים' },
      { id: 'explore', label: 'כרגע רוצה להבין' },
    ],
  },
};

// Each route: the questions in order. A step with `when` is asked only when its condition holds.
// Conditions: { fact, in: [...] } · { fact, is } · { track } (the track worked out in rules.mjs) · { all } · { any } · { not }.
export const ROUTES = {
  invest: [
    { q: 'a_amount' },
    { q: 'a_purpose', when: { fact: 'amount', in: ['100to300', 'over300'] } },
    { q: 'a_horizon' },
    { q: 'a_priority' },
    { q: 'a_where' },
    { q: 'a_when' },
  ],
  monthly: [
    { q: 'b_monthly' },
    { q: 'b_existing' },
    { q: 'b_goal' },
    { q: 'b_horizon' },
    { q: 'b_lump' },
    { q: 'b_when' },
  ],
  pension: [
    { q: 'c_employment' },
    { q: 'c_selfdeposits', when: { fact: 'employment', in: ['self', 'both'] } },
    { q: 'c_focus' },
    { q: 'c_insreason', when: { fact: 'focus', in: ['insurance', 'all'] } },
    { q: 'c_lastcheck' },
    { q: 'c_known' },
    { q: 'c_change' },
    { q: 'c_when' },
  ],
  selfemp: [
    { q: 'd_status' },
    { q: 'd_study' },
    { q: 'd_study_interest', when: { fact: 'studyFund', is: 'none' } },
    { q: 'd_pension' },
    { q: 'd_pension_interest', when: { fact: 'pensionActive', is: 'none' } },
    // someone who has not opened the business yet has no deposits or tax benefits to check for this year
    { q: 'd_checked', when: { not: { fact: 'bizStatus', is: 'planning' } } },
    { q: 'd_goal' },
    { q: 'd_when' },
  ],
  // E maps the need, then asks one focused question of the track it found (none for the general map)
  unsure: [
    { q: 'e_employment' },
    { q: 'e_concern' },
    { q: 'e_amount' },
    { q: 'e_monthly' },
    { q: 'e_when' },
    { q: 'a_horizon', when: { track: 'invest' } },
    { q: 'b_goal', when: { track: 'savings' } },
    { q: 'c_focus', when: { track: 'pension' } },
    { q: 'd_checked', when: { track: 'selfemp' } },
  ],
};

// Texts of the page around the questions.
export const TEXTS = {
  resultTitle: 'מעולה, יש לנו כיוון ראשוני.',
  resultPrefix: 'המסלול שזוהה',
  resultDisclaimer: 'זהו מיפוי ראשוני בלבד, על סמך התשובות שלך. הוא אינו המלצה להשקעה או למוצר פיננסי, אינו ייעוץ פנסיוני או ייעוץ השקעות, ואינו תחליף לבירור צרכים מקצועי.',
  formTitle: 'רוצה לבדוק איך זה מתאים לך באופן אישי?',
  formText: 'אפשר להשאיר פרטים, ורועי יחזור אליך לשיחת התאמה ראשונית.',
  formButton: 'שליחת הפרטים ובקשה לשיחה',
  successTitle: 'תודה! הפרטים התקבלו בהצלחה.',
  successText: 'רועי קיבל את הבקשה שלך ויחזור אליך לצורך שיחת התאמה.',
  season: 'סוף שנת המס מתקרב. זה הזמן לבדוק אם ניצלת את האפשרויות הרלוונטיות לחיסכון ולהטבות מס.',
};

// The contact consent. Changing the wording means a new version: the lead record names the version agreed to.
export const CONSENT = {
  version: 'fc-contact-2026-11-v1',
  text: 'אני מאשר/ת לרועי רומנו ליצור איתי קשר בעקבות פנייתי, בהתאם למדיניות הפרטיות.',
  marketing: 'אשמח לקבל מדי פעם מאמרים ועדכונים במייל או בוואטסאפ (לא חובה, אפשר להסיר בכל עת).',
};
