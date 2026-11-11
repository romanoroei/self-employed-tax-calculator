// /financial-check: the classification rules. Plain data, read by engine.mjs; no AI and no hidden weights.
// Two separate outputs: the professional track (what the conversation is about) and an internal lead grade
// (A/B/C). The grade only orders Roei's call-backs: it is never shown to the visitor, never sent to the
// counters, and says nothing about eligibility, risk or a person's financial worth. A small sum never
// lowers a grade: points are only added.

// ---------- the track: the first rule that matches ----------
export const TRACKS = {
  invest: { title: 'השקעת סכום פנוי', text: 'נראה שכדאי להתחיל בבחינת האפשרויות לחיסכון ולהשקעה של הסכום הפנוי, בהתאם למטרות שלך, לטווח הזמן ולנזילות שנדרשת.' },
  savings: { title: 'חיסכון חודשי', text: 'נראה שהשלב הבא הוא לבנות תוכנית חיסכון שמתאימה לסכום החודשי ולמטרות שלך.' },
  pension: { title: 'בדיקה פנסיונית וביטוחית', text: 'כדאי לבחון את התוכניות הקיימות ולראות אם הן מתאימות לצרכים שלך כיום.' },
  selfemp: {
    title: 'עצמאים והטבות מס',
    text: 'נראה שכדאי לבדוק את ההפקדות שבוצעו ואת האפשרויות שעומדות לרשותך לקראת סוף שנת המס.',
    // before the business is opened there are no deposits of this year to check, and no benefit to promise
    variants: [{ when: { fact: 'bizStatus', is: 'planning' }, text: 'נראה שכדאי לבדוק כבר עכשיו איך לבנות את החיסכון וההפקדות לקראת פתיחת העסק.' }],
  },
  general: { title: 'מיפוי פיננסי כללי', text: 'נראה שכדאי להתחיל במיפוי מסודר של התמונה הכלכלית: מה כבר קיים, מה חסר, ובמה כדאי לטפל קודם.' },
};

export const TRACK_RULES = [
  { when: { fact: 'need', is: 'invest' }, track: 'invest' },
  { when: { fact: 'need', is: 'monthly' }, track: 'savings' },
  { when: { fact: 'need', is: 'pension' }, track: 'pension' },
  { when: { fact: 'need', is: 'selfemp' }, track: 'selfemp' },
  // route E: from the main concern, the employment and the sums
  { when: { all: [{ fact: 'concern', is: 'tax' }, { fact: 'employment', in: ['self', 'both'] }] }, track: 'selfemp' },
  { when: { fact: 'concern', in: ['tax', 'unknown'] }, track: 'pension' },
  { when: { all: [{ fact: 'concern', is: 'idle' }, { fact: 'amount', in: ['upto25', '25to100', '100to300', 'over300'] }] }, track: 'invest' },
  { when: { fact: 'concern', in: ['idle', 'notsaving'] }, track: 'savings' },
  { when: { all: [{ fact: 'concern', is: 'order' }, { fact: 'amount', in: ['100to300', 'over300'] }] }, track: 'invest' },
  { when: { fact: 'concern', is: 'order' }, track: 'general' },
];

// ---------- the internal grade ----------
export const GRADE = { A: 60, B: 35 }; // at least 60 points: A; at least 35: B; otherwise C
export const GRADE_LABELS = { A: 'התאמה מסחרית גבוהה', B: 'התאמה מסחרית בינונית', C: 'התעניינות ראשונית' };

// Each rule adds points when its condition holds. `why` is the reason Roei reads in the lead email.
export const GRADE_RULES = [
  // the sum available now
  { when: { fact: 'amount', is: 'over300' }, pts: 40, why: 'סכום פנוי של מעל 300,000 ₪' },
  { when: { fact: 'amount', is: '100to300' }, pts: 35, why: 'סכום פנוי של 100,000–300,000 ₪' },
  { when: { fact: 'amount', is: '50to100' }, pts: 25, why: 'סכום פנוי של 50,000–100,000 ₪' },
  { when: { fact: 'amount', is: '25to100' }, pts: 20, why: 'סכום פנוי של 25,000–100,000 ₪' },
  { when: { fact: 'amount', is: '25to50' }, pts: 15, why: 'סכום פנוי של 25,000–50,000 ₪' },
  { when: { fact: 'amount', is: 'upto25' }, pts: 8, why: 'סכום פנוי של עד 25,000 ₪' },
  // the monthly saving
  { when: { fact: 'monthly', is: 'over3000' }, pts: 25, why: 'חיסכון חודשי של מעל 3,000 ₪' },
  { when: { fact: 'monthly', in: ['1500to3000', 'over1500'] }, pts: 20, why: 'חיסכון חודשי של מעל 1,500 ₪' },
  { when: { fact: 'monthly', is: '500to1500' }, pts: 12, why: 'חיסכון חודשי של 500–1,500 ₪' },
  { when: { fact: 'monthly', is: 'upto500' }, pts: 6, why: 'חיסכון חודשי של עד 500 ₪' },
  // a one-off sum beside the monthly saving (route B)
  { when: { fact: 'lump', is: 'over100' }, pts: 25, why: 'גם סכום חד־פעמי של מעל 100,000 ₪' },
  { when: { fact: 'lump', is: '25to100' }, pts: 15, why: 'גם סכום חד־פעמי של 25,000–100,000 ₪' },
  { when: { fact: 'lump', is: 'upto25' }, pts: 5, why: 'גם סכום חד־פעמי של עד 25,000 ₪' },
  // a defined professional need
  { when: { track: ['invest', 'savings', 'pension', 'selfemp'] }, pts: 10, why: 'צורך מקצועי מוגדר' },
  // employment: the self-employed are at the heart of the practice
  { when: { any: [{ fact: 'employment', in: ['self', 'both'] }, { fact: 'bizStatus', in: ['exempt', 'licensed', 'company', 'both'] }] }, pts: 10, why: 'עצמאי/ת או בעל/ת עסק' },
  { when: { fact: 'bizStatus', is: 'planning' }, pts: 5, why: 'מתכנן/ת לפתוח עסק' },
  // pension and insurance
  { when: { fact: 'focus', is: 'all' }, pts: 10, why: 'מבקש/ת בדיקה של כל התוכניות והביטוחים' },
  { when: { fact: 'lastCheck', in: ['y3plus', 'never'] }, pts: 8, why: 'לא נעשתה בדיקה מקצועית בשלוש השנים האחרונות' },
  { when: { fact: 'knowsProducts', in: ['partial', 'no'] }, pts: 5, why: 'אין תמונה מלאה של מה שקיים' },
  { when: { fact: 'lifeChange', in: ['job', 'selfemp', 'income', 'family'] }, pts: 8, why: 'שינוי משמעותי לאחרונה' },
  { when: { fact: 'selfDeposits', in: ['pension', 'study', 'none', 'unsure'] }, pts: 7, why: 'עצמאי/ת בלי הפקדות מלאות לפנסיה ולקרן השתלמות' },
  { when: { fact: 'insReason', in: ['duplicate', 'cost'] }, pts: 5, why: 'חשש לכפל ביטוחים או לעלויות' },
  // the self-employed and tax benefits
  { when: { fact: 'taxChecked', in: ['notyet', 'unknown'] }, pts: 15, why: 'לא נבדקו ההפקדות והטבות המס לשנה הנוכחית' },
  { when: { fact: 'pensionActive', in: ['none', 'irregular'] }, pts: 10, why: 'אין חיסכון פנסיוני פעיל או שההפקדות אינן סדירות' },
  { when: { fact: 'studyFund', in: ['none', 'irregular'] }, pts: 5, why: 'אין קרן השתלמות או שההפקדות אינן קבועות' },
  { when: { fact: 'studyInterest', is: 'yes' }, pts: 5, why: 'מעוניין/ת לבדוק פתיחת קרן השתלמות' },
  { when: { fact: 'pensionInterest', is: 'yes' }, pts: 5, why: 'מעוניין/ת לבדוק חיסכון פנסיוני' },
  // a defined goal for the money
  { when: { fact: 'purpose', in: ['home', 'future', 'income'] }, pts: 5, why: 'מטרה מוגדרת לסכום' },
  { when: { fact: 'goal', in: ['home', 'family', 'longterm', 'security'] }, pts: 5, why: 'מטרה מוגדרת לחיסכון' },
  // urgency; before the year end weighs more for the self-employed while the season message is on
  { when: { fact: 'urgency', is: 'asap' }, pts: 20, why: 'רוצה לטפל בהקדם' },
  { when: { fact: 'urgency', is: 'month' }, pts: 15, why: 'רוצה לטפל בחודש הקרוב' },
  { when: { all: [{ fact: 'urgency', is: 'yearend' }, { season: true }] }, pts: 20, why: 'רוצה לטפל לפני סוף שנת המס' },
  { when: { all: [{ fact: 'urgency', is: 'yearend' }, { season: false }] }, pts: 15, why: 'רוצה לטפל לפני סוף השנה' },
  { when: { fact: 'urgency', in: ['months', 'later'] }, pts: 5, why: 'רוצה לטפל בחודשים הקרובים' },
];

export const URGENCY = {
  asap: 'גבוהה: בהקדם',
  month: 'גבוהה: בחודש הקרוב',
  yearend: 'גבוהה: לפני סוף השנה',
  months: 'בינונית: בחודשים הקרובים',
  later: 'בינונית: בהמשך',
  explore: 'נמוכה: רוצה בעיקר להבין את האפשרויות',
};

// ---------- points worth raising in the call (for Roei, from the answers only) ----------
export const TALKING_POINTS = [
  { when: { fact: 'horizon', is: 'y1' }, text: 'הכסף עשוי להידרש בתוך שנה: לברר את הצורך בנזילות.' },
  { when: { fact: 'horizon', is: 'unknown' }, text: 'טווח הזמן עדיין לא ברור.' },
  { when: { fact: 'moneyPriority', is: 'lowvol' }, text: 'העדפה לתנודתיות נמוכה: לברר את רמת הסיכון המתאימה בשאלון מלא.' },
  { when: { fact: 'moneyPriority', is: 'unsure' }, text: 'עדיין לא ברור מה חשוב לגבי הכסף: נזילות, צמיחה או יציבות.' },
  { when: { fact: 'whereNow', is: 'checking' }, text: 'הסכום נמצא כיום בעו"ש.' },
  { when: { fact: 'whereNow', is: 'several' }, text: 'הכסף מפוזר בכמה מקומות: כדאי לרכז תמונה מלאה.' },
  { when: { fact: 'purpose', is: 'home' }, text: 'הסכום מיועד לרכישת דירה או נכס: לברר מועד צפוי.' },
  { when: { fact: 'existing', is: 'none' }, text: 'אין עדיין חיסכון: לברר אם קיימת כרית ביטחון.' },
  { when: { fact: 'lump', in: ['25to100', 'over100'] }, text: 'יש גם סכום חד־פעמי משמעותי לחיסכון.' },
  { when: { any: [{ fact: 'knowsProducts', in: ['partial', 'no'] }, { fact: 'focus', is: 'unsure' }, { fact: 'concern', is: 'unknown' }] }, text: 'אין תמונה מלאה של מה שקיים: אפשר להציע הפקת מידע מהמסלקה הפנסיונית, בהסכמה.' },
  { when: { fact: 'lifeChange', is: 'selfemp' }, text: 'עבר/ה לאחרונה לעצמאות: לבדוק את ההפקדות כעצמאי/ת.' },
  { when: { fact: 'lifeChange', is: 'job' }, text: 'מעבר עבודה לאחרונה: לבדוק רציפות הפקדות ומסלולים.' },
  { when: { fact: 'selfDeposits', in: ['none', 'unsure'] }, text: 'עצמאי/ת בלי הפקדות פעילות, או לא בטוח/ה: לברר את חובת ההפקדה.' },
  { when: { fact: 'insReason', is: 'duplicate' }, text: 'חשש לכפל ביטוחים.' },
  { when: { fact: 'bizStatus', is: 'planning' }, text: 'מתכנן/ת לפתוח עסק: לא להניח זכאות להטבות לפני פתיחת התיק.' },
  { when: { fact: 'bizStatus', is: 'company' }, text: 'בעל/ת חברה: לברר אם ההפקדות נעשות דרך החברה.' },
  { when: { fact: 'employment', is: 'both' }, text: 'גם שכיר/ה וגם עצמאי/ת: לבדוק את שני מקורות ההכנסה.' },
  { when: { fact: 'studyInterest', in: ['yes', 'maybe'] }, text: 'מתעניין/ת בפתיחת קרן השתלמות.' },
  { when: { fact: 'pensionActive', is: 'none' }, text: 'אין חיסכון פנסיוני פעיל: לברר את חובת ההפקדה.' },
  { when: { fact: 'taxChecked', in: ['notyet', 'unknown'] }, text: 'ההפקדות והטבות המס לשנה הנוכחית עוד לא נבדקו.' },
];
