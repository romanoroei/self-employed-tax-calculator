// /financial-check: what the visitor gets back. Plain data, read by engine.mjs, in the same condition language
// as rules.mjs. Every sentence is general information that applies to the situation the answers describe. It is
// never a recommendation of a product, a track or a company, and every figure comes from the site's guides
// (2026 tax year). Update the figures in January together with /self-employed and /investment-fund.
//
// INSIGHTS are checked in order and the first MAX_INSIGHTS that hold are shown, so put the time-limited and
// the protective ones first. A short general one closes the list so nobody leaves with fewer than two.
// Tokens: {days} days left to 31.12 (Israel time), {daysText} the same in words ("בעוד 47 ימים", "מחר", "היום"); {monthlyEx} {deposited} {bonds} {general} {stocks} {period} the growth example (engine.mjs).
// A variant (the first that holds) may replace the tag, title, text and figure.
// `figure` puts a number in the gold tile: { kind: 'days' } · { kind: 'growth' } (a row per track) · { value: '...' }.
// `call` is what the conversation with Roei would cover; the form lists the `call` of each insight shown.

export const MAX_INSIGHTS = 3;
export const MAX_STEPS = 3;

// The growth example: the average cumulative 7-year yield of the investment provident funds in each track
// (the Finance Ministry's figures via GemelHub, the same group rules and average as the site's yields tile;
// the bonds track computed the same way). Update with the yields. "bank" is money that earns nothing.
export const TRACK_YIELDS = {
  period: '09/2026',
  years: 7,
  rows: [
    { id: 'bank', label: 'בלי תשואה (עו"ש)', cum: 0 },
    { id: 'bonds', label: 'מסלול סולידי (אשראי ואג"ח)', cum: 32.01 },
    { id: 'general', label: 'סיכון בינוני (מסלול כללי)', cum: 71.08 },
    { id: 'stocks', label: 'סיכון גבוה (מסלול מניות)', cum: 143.1 },
  ],
};

const AMOUNT_ANY = ['upto25', '25to50', '50to100', '25to100', '100to300', 'over300', '50to150', '150to300', '300to600', '600to1200', 'over1200'];
const LUMP_ANY = ['upto25', '25to100', 'over100'];
const BIG = { any: [{ fact: 'amount', in: ['100to300', 'over300', '150to300', '300to600', '600to1200', 'over1200'] }, { fact: 'lump', is: 'over100' }] };
// in business now: from the status (route D) or from the employment answer (routes C and E)
const IN_BUSINESS = { any: [{ fact: 'bizStatus', in: ['exempt', 'licensed', 'company', 'both'] }, { all: [{ fact: 'employment', in: ['self', 'both'] }, { not: { fact: 'bizStatus', is: 'planning' } }] }, { all: [{ fact: 'employment', in: ['self', 'both'] }, { fact: 'need', in: ['pension', 'unsure'] }] }] };

export const INSIGHTS = [
  // ---------- protect first: money needed soon ----------
  {
    id: 'short', tag: 'טווח קצר',
    when: { any: [{ fact: 'horizon', is: 'y1' }, { fact: 'purpose', is: 'home' }, { fact: 'goal', is: 'home' }] },
    title: 'כסף שיידרש בקרוב צריך כללים אחרים',
    text: 'כשהכסף עשוי להידרש בתוך שנה, או שהוא מיועד לדירה, השאלה הראשונה היא נזילות ותנודתיות, לא תשואה. ירידה בשווקים ממש לפני מועד הרכישה עלולה לשבש את התוכנית.',
    call: 'איך לשמור על הכסף זמין ויציב לקראת המועד שבו יידרש',
  },

  // ---------- the law and the calendar ----------
  {
    id: 'mandatory', tag: 'חובה בחוק',
    when: {
      any: [
        { all: [{ fact: 'employment', in: ['self', 'both'] }, { fact: 'selfDeposits', in: ['none', 'unsure', 'study'] }] },
        { fact: 'lifeChange', is: 'selfemp' },
        { all: [{ fact: 'pensionActive', in: ['none', 'irregular', 'unsure'] }, IN_BUSINESS] },
      ],
    },
    title: 'עצמאים חייבים להפקיד לפנסיה',
    text: 'מאז 2017 עצמאים חייבים בחוק להפקיד לחיסכון פנסיוני: 4.45% על ההכנסה עד מחצית השכר הממוצע, ו־12.55% על החלק שמעליה ועד השכר הממוצע. החובה חלה מגיל 21, אחרי שישה חודשים מהרישום כעוסק, וההפקדה צריכה להיכנס באותה שנת מס.',
    figure: { value: '14,044 ₪', caption: 'הפקדת החובה המרבית לעצמאים ב־2026, כ־1,170 ₪ לחודש' },
    call: 'כמה נדרש להפקיד השנה, ואיך להשלים לפני 31.12',
  },
  {
    id: 'inactive', tag: 'מעבר עבודה',
    when: { fact: 'lifeChange', is: 'job' },
    title: 'אחרי מעבר עבודה כדאי לבדוק חשבונות ישנים',
    text: 'אחרי מעבר עבודה נשארים לפעמים חשבונות לא פעילים, ודמי הניהול בהם עולים. כדאי לבדוק אם זה המצב אצלך. גם הכיסוי הביטוחי בקרן פנסיה שלא מפקידים אליה נמשך זמן מוגבל בלבד.',
    call: 'איתור חשבונות לא פעילים, ומה לעשות איתם',
  },
  {
    id: 'study', tag: 'קרן השתלמות',
    when: { all: [IN_BUSINESS, { any: [{ fact: 'studyFund', in: ['none', 'irregular', 'unsure'] }, { fact: 'selfGoal', is: 'openstudy' }, { fact: 'selfDeposits', in: ['pension', 'none', 'unsure'] }, { fact: 'concern', is: 'tax' }] }] },
    title: 'קרן השתלמות: ניכוי ממס, וגם רווחים בלי מס',
    text: 'עצמאים יכולים לנכות ממס הפקדה לקרן השתלמות של עד 4.5% מההכנסה, עד הכנסה של 293,397 ₪, כלומר עד 13,203 ₪. רווחים על הפקדה של עד 20,566 ₪ בשנה פטורים ממס, בכפוף לתנאי המשיכה.',
    variants: [{ when: { season: true }, text: 'עצמאים יכולים לנכות ממס הפקדה לקרן השתלמות של עד 4.5% מההכנסה, עד הכנסה של 293,397 ₪, כלומר עד 13,203 ₪. רווחים על הפקדה של עד 20,566 ₪ בשנה פטורים ממס, בכפוף לתנאי המשיכה. הפקדה שתיחשב ל־2026 צריכה להיכנס עד 31.12 ({daysText}).' }],
    figure: { value: '13,203 ₪', caption: 'התקרה לניכוי ממס בהפקדה לקרן השתלמות לעצמאים, 2026' },
    call: 'כמה אפשר להפקיד לקרן השתלמות, ומה ההטבה בשקלים',
  },
  {
    id: 'ceiling', tag: 'תקרה שנתית',
    when: { any: [{ fact: 'amount', in: AMOUNT_ANY }, { fact: 'lump', in: LUMP_ANY }] },
    title: 'קופת גמל להשקעה: עד 83,641 ₪ בשנה',
    text: 'אפשר להפקיד לקופת גמל להשקעה עד 83,641 ₪ בשנה, בכל הקופות יחד. מה שלא נוצל בשנה מסוימת לא עובר לשנה הבאה, ובכל 1 בינואר נפתחת תקרה חדשה.',
    figure: { value: '83,641 ₪', caption: 'התקרה השנתית להפקדה לקופת גמל להשקעה, 2026' },
    variants: [
      { when: { all: [{ season: true }, BIG] }, tag: 'עד 31.12', title: 'תקרת 2026 בקופת גמל להשקעה נסגרת {daysText}', text: 'אפשר להפקיד לקופת גמל להשקעה עד 83,641 ₪ בשנה, בכל הקופות יחד, ומה שלא נוצל עד 31.12 לא עובר לשנה הבאה. בסכום כמו שציינת אפשר לחלק: חלק עד סוף השנה על חשבון תקרת 2026, והשאר מינואר על חשבון תקרת 2027.', figure: { kind: 'days', caption: 'ימים שנשארו לניצול תקרת 2026 בקופת גמל להשקעה (83,641 ₪)' } },
      { when: { season: true }, tag: 'עד 31.12', title: 'תקרת 2026 בקופת גמל להשקעה נסגרת {daysText}', text: 'אפשר להפקיד לקופת גמל להשקעה עד 83,641 ₪ בשנה, בכל הקופות יחד. מה שלא נוצל עד 31.12 לא עובר לשנה הבאה, וב־1 בינואר נפתחת תקרה חדשה לשנת 2027.', figure: { kind: 'days', caption: 'ימים שנשארו לניצול תקרת 2026 בקופת גמל להשקעה (83,641 ₪)' } },
    ],
    call: 'אם ואיך לנצל את תקרת 2026 לפני 31.12',
  },

  // ---------- the self-employed ----------
  {
    id: 'planning', tag: 'לפני פתיחה',
    when: { fact: 'bizStatus', is: 'planning' },
    title: 'חובת ההפקדה מתחילה חצי שנה אחרי הרישום',
    text: 'עצמאים חייבים להפקיד לפנסיה מגיל 21, אחרי שעברו שישה חודשים מהרישום הראשון כעוסק. כדאי להכניס את ההפקדה לתכנון ההוצאות הקבועות של העסק כבר מההתחלה, יחד עם ביטוח לאומי.',
    call: 'איך לבנות את ההפקדות לפני שהעסק נפתח',
  },
  {
    id: 'exempt', tag: 'עוסק פטור',
    when: { fact: 'bizStatus', is: 'exempt' },
    title: 'גם עוסק פטור נהנה מהטבות המס',
    text: 'הפטור של עוסק פטור הוא ממע"מ בלבד. ההטבות במס הכנסה על הפקדה לפנסיה ולקרן השתלמות חלות בדיוק כמו על עוסק מורשה, וגם חובת ההפקדה לפנסיה.',
    call: 'אילו הטבות מס פתוחות לעוסק פטור',
  },
  {
    id: 'company', tag: 'בעלי חברה',
    when: { fact: 'bizStatus', is: 'company' },
    title: 'בחברה, ההפקדות יכולות לעבור דרך החברה',
    text: 'כשמושכים משכורת מחברה בבעלותך, אפשר להפקיד לפנסיה ולקרן השתלמות דרך החברה, כמו מעסיק. זה משנה את חישוב ההטבה ואת ההוצאה המוכרת לחברה, ולכן כדאי לבדוק את זה יחד עם רואה החשבון.',
    call: 'הפקדה דרך החברה או באופן עצמאי: מה ההבדל במקרה שלך',
  },
  {
    id: 'calc', tag: 'בשקלים',
    when: { all: [IN_BUSINESS, { fact: 'taxChecked', in: ['notyet', 'unknown'] }] },
    title: 'כמה שווה לך ההטבה? אפשר לחשב',
    text: 'המחשבון באתר מראה בשקלים כמה שווה ההפקדה לפנסיה ולקרן השתלמות, לפי ההכנסה שלך, כולל החיסכון בביטוח לאומי ובמס בריאות. השווי תלוי במדרגת המס, ולכן הוא שונה מאדם לאדם.',
    call: 'לעבור יחד על החישוב ועל ההפקדות שכבר בוצעו השנה',
  },
  {
    id: 'floor', tag: 'הטבת מס',
    when: { all: [IN_BUSINESS, { any: [{ fact: 'pensionActive', is: 'regular' }, { fact: 'selfGoal', in: ['tax', 'grow'] }, { fact: 'concern', is: 'tax' }] }] },
    title: 'החובה היא רק רצפה',
    text: 'אפשר להפקיד לפנסיה יותר מהחובה ולקבל על כך הטבת מס, עד 16.5% מהכנסה של עד 232,800 ₪ בשנה. חלק מההפקדה מוכר כניכוי וחלק מזכה בזיכוי ממס. מי שמפקיד רק את המינימום חוסך על חלק מהכנסתו בלבד, וההפרש יורגש בקצבה.',
    call: 'איפה ההפקדות שלך עומדות מול החובה ומול תקרת ההטבה',
  },

  // ---------- where the money sits ----------
  {
    id: 'checking', tag: 'עו"ש',
    when: { fact: 'whereNow', is: 'checking' },
    title: 'בעו"ש הכסף לא עובד בשבילך',
    text: 'בחשבון עו"ש הכסף בדרך כלל לא מקבל ריבית, והאינפלציה שוחקת את ערכו בכל שנה. גם כשהכסף צריך להישאר זמין, יש אפשרויות נזילות שבהן הוא לא עומד במקום.',
    call: 'אילו אפשרויות נזילות קיימות לכסף שנמצא היום בעו"ש',
  },
  {
    id: 'deposit', tag: 'פיקדון',
    when: { fact: 'whereNow', is: 'deposit' },
    title: 'פיקדון: ריבית ידועה, כסף נעול',
    text: 'בפיקדון בנקאי הריבית ידועה מראש, אבל לעיתים קרובות הכסף נעול עד מועד הפירעון, ויציאה מוקדמת עלולה לעלות בריבית. כדאי לדעת מתי הפיקדון מסתיים ומה קורה איתו אז.',
    call: 'מה האפשרויות כשהפיקדון מסתיים',
  },
  {
    id: 'portfolio', tag: 'מס',
    when: { fact: 'whereNow', is: 'portfolio' },
    title: 'בתיק רגיל, כל שינוי עולה מס',
    text: 'מי שמחזיק קרנות נאמנות או ניירות ערך בחשבון רגיל משלם מס על הרווח בכל מכירה. בקופת גמל להשקעה, מעבר בין מסלולים או בין חברות לא נחשב מכירה, והמס נדחה עד המשיכה.',
    call: 'ההבדל במיסוי בין תיק רגיל, קופת גמל להשקעה ופוליסת חיסכון',
  },

  // ---------- monthly saving ----------
  {
    id: 'growth', tag: 'תשואה לאורך זמן',
    when: { all: [{ fact: 'need', is: 'monthly' }, { not: { fact: 'horizon', is: 'y1' } }] },
    title: 'מה עשו 7 השנים האחרונות ל־{monthlyEx} ₪ בחודש',
    text: 'מי שהפקיד {monthlyEx} ₪ בכל חודש ב־7 השנים האחרונות שם בצד {deposited} ₪. בעו"ש, בלי תשואה, זה כל מה שיש לו היום. בקופות גמל להשקעה, לפי התשואה הממוצעת של כל מסלול, אותו כסף היה מגיע לכ־{bonds} ₪ במסלול סולידי, {general} ₪ במסלול בסיכון בינוני ו־{stocks} ₪ במסלול בסיכון גבוה. מסלול עם יותר מניות עלה יותר לאורך זמן, אבל גם ירד יותר בדרך.',
    figure: { kind: 'growth', caption: 'הפקדה של {monthlyEx} ₪ בחודש ב־7 השנים האחרונות. ממוצע קופות הגמל להשקעה בכל מסלול עד {period}, לפני דמי ניהול ובלי התאמה לאינפלציה. תשואת עבר אינה מבטיחה תשואה בעתיד.' },
    call: 'איזו רמת סיכון מתאימה לטווח ולמטרה של החיסכון',
  },
  {
    id: 'cushion', tag: 'כרית ביטחון',
    when: { any: [{ fact: 'existing', is: 'none' }, { fact: 'goal', is: 'security' }] },
    title: 'לפני חיסכון ארוך, כרית ביטחון',
    text: 'מקובל להחזיק סכום נזיל של כמה חודשי הוצאות לפני שמתחילים לחסוך לטווח ארוך. כך הוצאה לא צפויה לא מחייבת למשוך מהחיסכון בזמן לא נוח, או לקחת הלוואה.',
    call: 'איך לבנות כרית ביטחון לצד החיסכון החודשי',
  },
  {
    id: 'auto', tag: 'הרגל',
    when: { any: [{ fact: 'need', is: 'monthly' }, { fact: 'concern', is: 'notsaving' }] },
    title: 'חיסכון שקורה מעצמו',
    text: 'חיסכון חודשי מחזיק לאורך זמן בעיקר כשהוא אוטומטי: הוראת קבע שיורדת סמוך לכניסת המשכורת, לפני שהכסף מתפזר על הוצאות אחרות. ברוב המוצרים אפשר להגדיל, להקטין או לעצור את ההפקדה בהמשך.',
    call: 'איך לקבוע סכום חודשי שאפשר לעמוד בו לאורך זמן',
  },
  {
    id: 'goal', tag: 'מטרה',
    when: { any: [{ fact: 'goal', is: 'none' }, { fact: 'purpose', in: ['general', 'other'] }] },
    title: 'מטרה הופכת חיסכון לתוכנית',
    text: 'כשלחיסכון יש מטרה ומועד, קל יותר לבחור את המוצר, את רמת הסיכון ואת הסכום החודשי. גם מטרה כללית, כמו "ביטחון כלכלי בעוד חמש שנים", עדיפה על חיסכון בלי כיוון.',
    call: 'להגדיר יחד מטרה ומועד לחיסכון',
  },
  {
    id: 'child', tag: 'ילדים',
    when: { fact: 'goal', is: 'family' },
    title: 'חיסכון לכל ילד: כסף שכבר נצבר',
    text: 'המדינה מפקידה בכל חודש לחשבון "חיסכון לכל ילד" של כל ילד, וההורים יכולים להוסיף מקצבת הילדים הפקדה בסכום זהה. כדאי לבדוק באיזו חברה ובאיזה מסלול הכסף מנוהל.',
    call: 'בדיקת "חיסכון לכל ילד", ואיך לחסוך לילדים מעבר לו',
  },

  // ---------- pension and insurance ----------
  {
    id: 'family', tag: 'שינוי משפחתי',
    when: { fact: 'lifeChange', is: 'family' },
    title: 'שינוי משפחתי: מוטבים וביטוח חיים',
    text: 'אחרי חתונה, לידה או פרידה כדאי לבדוק מי רשום כמוטב בקופות ובפוליסות, ואם סכום ביטוח החיים עדיין מתאים למשפחה. מוטבים לא מתעדכנים מעצמם.',
    call: 'עדכון מוטבים ובדיקת הכיסוי למשפחה',
  },
  {
    id: 'income', tag: 'שינוי בהכנסה',
    when: { fact: 'lifeChange', is: 'income' },
    title: 'ההכנסה השתנתה? גם הכיסוי השתנה',
    text: 'בקרן פנסיה, הכיסוי לאובדן כושר עבודה ולשאירים נקבע לפי השכר שממנו מפקידים. שינוי בהכנסה משנה את הכיסוי, ולפעמים יוצר פער בין מה שנדמה שמבוטח לבין מה שמבוטח בפועל.',
    call: 'האם הכיסוי עדיין תואם את ההכנסה',
  },
  {
    id: 'duplicate', tag: 'כפל ביטוח',
    when: { any: [{ fact: 'insReason', in: ['duplicate', 'cost'] }, { fact: 'focus', is: 'insurance' }] },
    title: 'כפל ביטוחים נפוץ יותר משנדמה',
    text: 'ביטוח בריאות פרטי חופף לעיתים כיסויים שכבר קיימים דרך השב"ן של קופת החולים, דרך מקום העבודה או בפוליסה אחרת. בהר הביטוח רואים את כל הפוליסות על שמך במקום אחד.',
    call: 'איתור כפל ביטוחים וכיסויים חופפים',
  },
  {
    id: 'map', tag: 'בדיקה עצמית',
    when: { any: [{ fact: 'knowsProducts', in: ['partial', 'no'] }, { fact: 'focus', is: 'unsure' }, { fact: 'concern', is: 'unknown' }, { fact: 'selfDeposits', is: 'unsure' }] },
    title: 'את כל מה שעל שמך אפשר לראות בחינם',
    text: 'באתר הממשלתי לאיתור חסכונות רואים את כל קופות הפנסיה, הגמל וההשתלמות על שמך, ובהר הביטוח את כל הפוליסות. בשניהם נכנסים בהזדהות אישית, וזה לוקח כמה דקות.',
    call: 'לעבור יחד על מה שמצאת, או להפיק בהסכמתך דוח מלא מהמסלקה הפנסיונית',
  },
  {
    id: 'pensionFees', tag: 'דמי ניהול',
    when: { fact: 'focus', in: ['fees', 'all', 'pension'] },
    title: 'בפנסיה יש שני סוגי דמי ניהול',
    text: 'בקרן פנסיה גובים דמי ניהול מכל הפקדה, עד 6%, ומהכסף שכבר נצבר, עד 0.5% בשנה. הפרש קטן בדמי הניהול מהצבירה מצטבר לאורך השנים לסכום משמעותי בקצבה.',
    call: 'כמה דמי ניהול משלמים היום, ובאיזה מסלול נמצא הכסף',
  },
  {
    id: 'track', tag: 'מסלול השקעה',
    when: { fact: 'lastCheck', in: ['y3plus', 'never', 'unknown'] },
    title: 'בלי בחירה, הכסף במסלול לפי גיל',
    text: 'מי שלא בחר מסלול השקעה מצורף בדרך כלל למסלול לפי הגיל. כדאי לוודא שהמסלול ודמי הניהול עדיין מתאימים, במיוחד כשהבדיקה האחרונה הייתה לפני כמה שנים.',
    call: 'בדיקת המסלול ודמי הניהול',
  },
  {
    id: 'both', tag: 'שני מקורות',
    when: { fact: 'employment', is: 'both' },
    title: 'משכורת וגם עסק: שתי בדיקות',
    text: 'ההפקדות דרך המעסיק לא פוטרות מחובת ההפקדה על ההכנסה מהעסק, וחישוב הטבות המס תלוי בשני מקורות ההכנסה יחד.',
    call: 'בדיקת ההפקדות משני מקורות ההכנסה',
  },

  // ---------- towards retirement: general information, no recommendation ----------
  {
    id: 'once', tag: 'החלטה חד־פעמית',
    when: { track: 'retire' },
    title: 'בפרישה יש החלטות שעושים פעם אחת',
    text: 'הבחירה בין קצבה למשיכה, מסלול הקצבה ואופן ניצול הפטור ממס נקבעים בדרך כלל פעם אחת, ולחלקם אין דרך חזרה. לכן כדאי לבדוק אותם לפני שמגישים בקשה לקופה, ולא אחרי.',
    call: 'מה כדאי לבדוק לפני שמגישים בקשה לקצבה',
  },
  {
    id: 'exempt', tag: 'פטור ממס',
    when: { all: [{ track: 'retire' }, { fact: 'retireTopic', in: ['tax', 'pension', 'income', 'all', 'lump', 'work'] }] },
    title: 'חלק מהקצבה יכול להיות פטור ממס',
    text: 'מגיל הפרישה אפשר לקבל פטור ממס על חלק מהקצבה, באמצעות קיבוע זכויות (טופס 161ד) ברשות המסים. האופן שבו מחלקים את הפטור בין הקצבה לבין משיכות קודמות משפיע על המס לאורך כל שנות הפרישה.',
    call: 'איך לחלק נכון את הפטור ממס',
  },

  // ---------- products already held ----------
  {
    id: 'compare', tag: 'השוואה',
    when: { any: [{ fact: 'whereNow', is: 'gemel_policy' }, { fact: 'existing', is: 'gemel_policy' }] },
    title: 'שווה לבדוק איפה הקופה שלך עומדת',
    text: 'קופות ופוליסות באותו מסלול יכולות להשיג תשואות שונות מאוד לאורך זמן. באתר אפשר לראות את התשואות של כל החברות לתקופות שונות, לפי הנתונים הרשמיים.',
    call: 'איך הקופה או הפוליסה שלך ביצעה מול מסלולים דומים',
  },
  {
    id: 'spread', tag: 'פיזור',
    when: { any: [{ fact: 'whereNow', is: 'several' }, { fact: 'existing', is: 'several' }] },
    title: 'כסף בכמה מקומות קשה לראות כמכלול',
    text: 'כשהחיסכון מפוזר בין כמה חשבונות ומוצרים, קשה לדעת כמה יש בסך הכול, כמה משלמים עליו ובאיזו רמת סיכון הוא מושקע. תמונה מרוכזת אחת היא הבסיס לכל החלטה.',
    call: 'לרכז את כל החסכונות לתמונה אחת',
  },
  {
    id: 'horizon', tag: 'טווח זמן',
    when: { fact: 'horizon', in: ['y1to3', 'y3to5', 'unknown'] },
    title: 'טווח הזמן קובע כמה תנודתיות אפשר לשאת',
    text: 'ככל שהכסף יידרש מאוחר יותר, יש יותר זמן להתאושש מירידות בשווקים. כשחלק מהסכום עשוי להידרש מוקדם יותר, מקובל להפריד אותו, כדי שלא יהיה צורך למשוך בזמן ירידה.',
    call: 'איך להתאים את הכסף למועדים שבהם עשוי להידרש',
  },
  {
    id: 'age60', tag: 'גיל 60',
    when: { any: [{ fact: 'horizon', is: 'y5plus' }, { fact: 'moneyPriority', is: 'grow' }, { fact: 'goal', is: 'longterm' }] },
    title: 'חיסכון ארוך יכול להפוך לקצבה פטורה ממס',
    text: 'בקופת גמל להשקעה, מי שמושך מגיל 60 כקצבה פטור ממס על כל הרווחים. מי שמושך בבת אחת, או לפני גיל 60, משלם עד 25% מהרווח הריאלי.',
    call: 'איך המיסוי בסוף הדרך משפיע על בחירת המוצר',
  },

  // ---------- general: closes the list ----------
  {
    id: 'order', tag: 'סדר עדיפויות',
    when: { any: [{ track: 'general' }, { fact: 'concern', is: 'order' }] },
    title: 'סדר נכון: ביטחון, ביטוח, חיסכון',
    text: 'במיפוי פיננסי מקובל להתחיל ממה שמגן: כרית ביטחון נזילה וכיסוי ביטוחי מתאים בלי כפל. אחר כך החיסכון הפנסיוני, ורק אז השקעת כסף פנוי. כך טעות בשלב מאוחר לא מערערת את הבסיס.',
    call: 'מיפוי מסודר: מה קיים, מה חסר ובמה לטפל קודם',
  },
  {
    id: 'existingMoney', tag: 'מה שכבר נצבר',
    when: null,
    title: 'גם הכסף שכבר נצבר צריך בדיקה',
    text: 'מעבר להחלטות על כסף חדש, דמי הניהול והמסלול בפנסיה ובקופות הקיימות משפיעים בכל שנה על הכסף שכבר נצבר. זו בדיקה שלא דורשת להפקיד שקל.',
    call: 'בדיקת דמי הניהול והמסלולים בחסכונות הקיימים',
  },
];

// ---------- what can be done today, alone. Links open in a new tab ----------
export const STEPS = [
  { id: 'gov', when: { any: [{ track: ['pension', 'retire'] }, { fact: 'concern', is: 'unknown' }, { fact: 'lifeChange', is: 'job' }, { fact: 'selfDeposits', is: 'unsure' }, { fact: 'pensionActive', is: 'unsure' }, { fact: 'studyFund', is: 'unsure' }] },
    text: 'לבדוק אילו קופות רשומות על שמך', label: 'איתור חסכונות, gov.il', href: 'https://www.gov.il/he/service/pension_savings_search' },
  { id: 'harb', when: { any: [{ fact: 'focus', in: ['insurance', 'all', 'unsure'] }, { fact: 'insReason', in: ['duplicate', 'cost', 'coverage', 'needs', 'general'] }, { fact: 'lifeChange', is: 'family' }] },
    text: 'לראות את כל הפוליסות על שמך', label: 'הר הביטוח, רשות שוק ההון', href: 'https://harb.cma.gov.il/' },
  { id: 'calc', when: { all: [{ track: 'selfemp' }, IN_BUSINESS] },
    text: 'לחשב בשקלים כמה שווה לך ההפקדה', label: 'מחשבון הטבות המס לעצמאים', href: '/self-employed-tax-calculator/' },
  { id: 'study', when: { any: [{ fact: 'studyFund', in: ['none', 'irregular', 'unsure'] }, { fact: 'selfGoal', is: 'openstudy' }] },
    text: 'לבדוק כמה להפקיד לקרן השתלמות השנה', label: 'בדיקת קרן השתלמות לעצמאים', href: '/study-fund' },
  { id: 'selfguide', when: { any: [{ track: 'selfemp' }, { fact: 'lifeChange', is: 'selfemp' }, { fact: 'employment', in: ['self', 'both'] }] },
    text: 'לקרוא כמה חובה להפקיד ומה לבדוק לפני סוף השנה', label: 'המדריך לעצמאים', href: '/self-employed' },
  { id: 'severance', when: { fact: 'lifeChange', is: 'job' },
    text: 'לבדוק מה קורה לפיצויים אחרי מעבר עבודה', label: 'המדריך לפיצויי פיטורים', href: '/severance' },
  { id: 'fund', when: { any: [{ track: ['invest', 'savings'] }, { fact: 'whereNow', is: 'portfolio' }] },
    text: 'להבין איך עובדת קופת גמל להשקעה', label: 'המדריך לקופת גמל להשקעה', href: '/investment-fund' },
  { id: 'yields', when: { any: [{ fact: 'whereNow', is: 'gemel_policy' }, { fact: 'existing', in: ['gemel_policy', 'several'] }, { track: ['invest', 'savings'] }] },
    text: 'להשוות תשואות בין החברות', label: 'תשואות קופות ונתוני שוק', href: '/market-data' },
  { id: 'knowledge', when: null,
    text: 'לקרוא עוד לפני השיחה', label: 'כל המדריכים והכלים', href: '/knowledge' },
];

// the last line of the call list, always
export const CALL_TAIL = 'וכל שאלה אחרת שעלתה לך';
