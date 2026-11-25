// The financial compass: everything the visitor reads, and every rule, as data.
// The engine (engine.js) reads this file and never holds wording or thresholds of its own, so a later
// admin panel or AI layer can change questions, paths and scoring here without touching the engine.
// All texts await Roei's approval (see compass-brief/compass-texts-for-approval.html, generated from this file).
//
// Conditions are plain objects, evaluated by engine.js:
//   {fact:'age', in:['50s','60p']}  {fact:'x', is:'v'}  {fact:'x', has:'v'} (multi answers)
//   {fact:'x', known:true}  (answered with a real value: not "don't know", skipped or "prefer not")
//   {fact:'x', asked:true}  {priority:'tax'} (chosen at all)  {primary:'tax'}  {secondary:'tax'}
//   {score:{area:'D', atLeast:30}}  {unknownCount:{atLeast:3}}  {all:[...]}  {any:[...]}  {not:{...}}
(function (root) {
  'use strict';

  const YES_NO_UNKNOWN = [
    { value: 'yes', label: 'כן' },
    { value: 'no', label: 'לא' },
    { value: 'unknown', label: 'לא יודע/ת', gap: true },
  ];

  const content = {
    version: '2026-11-08',
    limits: { maxQuestions: 12, softMaxQuestions: 9, relevantScore: 25, limitedUnknownShare: 0.5, limitedUnknownMin: 3, maxFindings: 3, maxSteps: 3 },

    // The growth example: the average cumulative 7-year yield of the investment provident funds in each track
    // (Finance Ministry figures via GemelHub, the yields tile's group rules). Same data as TRACK_YIELDS in
    // js/fcheck/insights.mjs (a test keeps the two equal): update both with the yields.
    trackYields: {
      period: '09/2026',
      years: 7,
      rows: [
        { id: 'bank', label: 'בלי תשואה (עו"ש)', cum: 0 },
        { id: 'bonds', label: 'מסלול סולידי (אשראי ואג"ח)', cum: 32.01 },
        { id: 'general', label: 'סיכון בינוני (מסלול כללי)', cum: 71.08 },
        { id: 'stocks', label: 'סיכון גבוה (מסלול מניות)', cum: 143.1 },
      ],
    },

    // Progress is shown by diagnosis stage, never as a misleading percentage.
    stages: [
      { id: 1, label: 'מה חשוב לכם' },
      { id: 2, label: 'המצב היום' },
      { id: 3, label: 'פערים ועדיפויות' },
      { id: 4, label: 'תמונה משלימה' },
      { id: 5, label: 'התוצאה' },
    ],

    // The six options of the opening question. n is the option number in Roei's spec (used by the counters).
    priorities: {
      pension: { n: 1, area: 'A', short: 'קצבה גבוהה בפרישה', label: 'קצבה מספקת בפרישה' },
      protection: { n: 2, area: 'B', short: 'הגנה עליי ועל המשפחה', label: 'הגנה על ההכנסה ועל המשפחה' },
      tax: { n: 3, area: 'C', short: 'ניצול הטבות המס', label: 'ניצול הטבות המס' },
      minimum: { n: 4, area: 'D', short: 'להפקיד רק את המינימום', label: 'הפקדה מינימלית וגמישות כלכלית' },
      liquidity: { n: 5, area: 'E', short: 'כסף נזיל וזמין', label: 'נזילות וגמישות פיננסית' },
      unsure: { n: 6, area: 'F', short: 'להבין מה יש לי', label: 'לעשות סדר בתמונה הפנסיונית' },
    },

    // The needs map. The score ranks how relevant each area is to check, never the visitor's situation.
    areas: {
      A: { title: 'תכנון הקצבה והפרישה', wa: 'תכנון הקצבה והפרישה', cta: 'בואו נבדוק את הקצבה הצפויה שלכם' },
      B: { title: 'הגנה ביטוחית עליכם ועל המשפחה', wa: 'ההגנה הביטוחית', cta: 'בואו נבחן אם הכיסויים שלכם מתאימים לצרכים' },
      C: { title: 'ניצול הטבות המס', wa: 'ניצול הטבות המס', cta: 'בואו נבדוק את ההפקדות שלכם לשנת המס' },
      D: { title: 'בדיקת חובת ההפקדה הפנסיונית', wa: 'בדיקת חובת ההפקדה', cta: 'בואו נבדוק מה החובה שחלה עליכם' },
      E: { title: 'נזילות וחלוקת החסכונות', wa: 'נזילות וחלוקת החסכונות', cta: 'בואו נבחן את החלוקה בין החסכונות שלכם' },
      F: { title: 'מיפוי התיק הפנסיוני והפיננסי', wa: 'מיפוי התמונה הפנסיונית', cta: 'בואו נעשה סדר בתמונה הפנסיונית שלכם' },
    },

    questions: {
      priorities: {
        stage: 1, category: 'core', type: 'multi', required: true,
        text: 'כעצמאים, מה הכי חשוב לכם כשאתם חושבים על הפנסיה ועל הכסף שלכם?',
        help: 'אפשר לבחור יותר מתשובה אחת.',
        summaryLabel: 'מה חשוב',
        options: [
          { value: 'pension', label: 'להגיע לפרישה עם קצבה חודשית גבוהה ככל האפשר.' },
          { value: 'protection', label: 'להגן על עצמי ועל המשפחה אם לא אוכל לעבוד, או במקרה פטירה.' },
          { value: 'tax', label: 'לנצל כמה שיותר את הטבות המס שמגיעות לי.' },
          { value: 'minimum', label: 'להפקיד רק את המינימום שהחוק מחייב.' },
          { value: 'liquidity', label: 'שהכסף יישאר נזיל, ושאוכל להשתמש בו כשארצה.' },
          { value: 'unsure', label: 'האמת? אין לי מושג. אני מפקיד/ה את מה שרואה החשבון אמר לי.' },
        ],
      },
      primary: {
        stage: 1, category: 'core', type: 'single', required: true,
        text: 'ומה הכי חשוב לכם כרגע?',
        help: 'נתחיל ממנו, ונתייחס גם לשאר מה שבחרתם.',
        summaryLabel: 'הכי חשוב כרגע',
        optionsFrom: 'selectedPriorities',
        when: { fact: 'priorities', countAtLeast: 2 },
      },

      // ----- shared background facts: asked once, whichever path reaches them first -----
      age: {
        stage: 2, category: 'background', type: 'single', required: true,
        text: 'באיזה טווח גיל אתם?', summaryLabel: 'גיל',
        options: [
          { value: 'u30', label: 'מתחת ל־30' }, { value: '30s', label: '30–39' }, { value: '40s', label: '40–49' },
          { value: '50s', label: '50–59' }, { value: '60p', label: '60 ומעלה' },
        ],
      },
      deposits: {
        stage: 2, category: 'background', type: 'single', required: true,
        text: 'אתם מפקידים היום לחיסכון פנסיוני?', summaryLabel: 'הפקדה פנסיונית',
        options: [
          { value: 'monthly', label: 'כן, בכל חודש באופן קבוע' },
          { value: 'irregular', label: 'כן, אבל לא באופן קבוע' },
          { value: 'annual', label: 'רק הפקדה אחת בשנה' },
          { value: 'none', label: 'לא' },
          { value: 'unknown', label: 'לא יודע/ת', gap: true },
        ],
      },
      employee: {
        stage: 2, category: 'background', type: 'single', required: true,
        text: 'אתם עובדים גם כשכירים?', help: 'כלומר, יש לכם גם משכורת, לצד ההכנסה מהעסק.', summaryLabel: 'גם שכיר/ה',
        options: [{ value: 'yes', label: 'כן' }, { value: 'no', label: 'לא' }],
      },
      income: {
        stage: 2, category: 'background', type: 'single', required: true,
        text: 'מה ההכנסה השנתית החייבת המשוערת שלכם כעצמאים?',
        help: 'ההכנסה החייבת היא הרווח שעליו משלמים מס, אחרי ההוצאות המוכרות. זה לא מחזור העסק. מספיק סדר גודל.',
        summaryLabel: 'הכנסה חייבת מדווחת',
        optionsFrom: 'incomeBands',
      },
      yearsActive: {
        stage: 4, category: 'background', type: 'single', required: false,
        text: 'כמה זמן אתם עצמאים?', help: 'חובת ההפקדה מתחילה רק {obligationWaitingMonths} חודשים אחרי הרישום הראשון כעוסק.',
        summaryLabel: 'ותק כעצמאי/ת',
        needs: ['eligibilityRules.obligationWaitingMonths'],
        options: [
          { value: 'lt6m', label: 'פחות מחצי שנה' }, { value: '6m3y', label: 'בין חצי שנה ל־3 שנים' },
          { value: '3y10y', label: '3 עד 10 שנים' }, { value: 'gt10y', label: 'יותר מ־10 שנים' },
        ],
      },
      otherSavings: {
        stage: 3, category: 'background', type: 'multi', required: false,
        text: 'יש לכם חסכונות נוספים מעבר לפנסיה?', help: 'אפשר לבחור כמה.', summaryLabel: 'חסכונות נוספים',
        when: { any: [{ fact: 'age', in: ['40s', '50s', '60p'] }, { priority: 'liquidity' }, { fact: 'pensionVsLiquidity', in: ['liquid', 'both'] }, { fact: 'expectedPension', is: 'low' }, { primary: 'minimum' }] },
        options: [
          { value: 'studyFund', label: 'קרן השתלמות' }, { value: 'gemel', label: 'קופת גמל' },
          { value: 'investments', label: 'השקעות בבנק או בבית השקעות' }, { value: 'realEstate', label: 'נדל"ן' },
          { value: 'none', label: 'אין לי חסכונות נוספים', exclusive: true },
          { value: 'unknown', label: 'לא יודע/ת', exclusive: true, gap: true },
        ],
        derive: [
          { if: { has: 'studyFund' }, set: { studyFundHas: 'yes' } },
          { if: { has: 'none' }, set: { studyFundHas: 'no', otherSavingsSimple: 'no' } },
          { if: { hasAny: ['studyFund', 'gemel', 'investments', 'realEstate'] }, set: { otherSavingsSimple: 'yes' } },
          { if: { has: 'unknown' }, set: { otherSavingsSimple: 'unsure' } },
        ],
      },

      // ----- path 1: retirement income -----
      expectedPension: {
        stage: 2, category: 'A', type: 'single', required: true,
        text: 'אתם יודעים איזו קצבה חודשית צפויה לכם בפרישה?', help: 'הקצבה הצפויה מופיעה בדוח השנתי של קרן הפנסיה.',
        summaryLabel: 'קצבה צפויה',
        options: [
          { value: 'satisfied', label: 'כן, ואני מרוצה מהסכום' },
          { value: 'low', label: 'כן, אבל הסכום נמוך ממה שהייתי רוצה' },
          { value: 'notChecked', label: 'לא בדקתי', gap: true },
          { value: 'noIdea', label: 'אין לי מושג איך בודקים', gap: true },
        ],
      },
      pensionVsLiquidity: {
        stage: 3, category: 'A', type: 'single', required: true,
        text: 'מה חשוב לכם יותר?', summaryLabel: 'פרישה מול נזילות',
        when: { any: [{ primary: 'pension' }, { all: [{ priority: 'pension' }, { priority: 'liquidity' }] }] },
        options: [
          { value: 'maxRetirement', label: 'להגדיל ככל האפשר את ההכנסה בפרישה' },
          { value: 'liquid', label: 'לשמור גם כסף נזיל לשנים הקרובות' },
          { value: 'both', label: 'לשלב בין השניים' },
        ],
      },

      // ----- path 2: protection -----
      worry: {
        stage: 2, category: 'B', type: 'single', required: true,
        text: 'מה הכי מדאיג אתכם?', summaryLabel: 'מה מדאיג',
        options: [
          { value: 'income', label: 'שלא אוכל לעבוד ולהתפרנס' },
          { value: 'family', label: 'שלמשפחה לא תהיה מספיק הכנסה אם יקרה לי משהו' },
          { value: 'both', label: 'שני הדברים' },
          { value: 'unknownCover', label: 'אני לא יודע/ת אילו ביטוחים יש לי', gap: true },
        ],
        derive: [{ if: { is: 'unknownCover' }, set: { coverageKnown: 'no' } }],
      },
      family: {
        stage: 2, category: 'B', type: 'single', required: false,
        text: 'מה המצב המשפחתי שלכם?', summaryLabel: 'מצב משפחתי',
        options: [
          { value: 'single', label: 'רווק/ה' }, { value: 'partner', label: 'נשוי/אה או בזוגיות' },
          { value: 'divorced', label: 'גרוש/ה' }, { value: 'widowed', label: 'אלמן/ה' },
          { value: 'na', label: 'מעדיף/ה לא לענות', withheld: true },
        ],
      },
      dependents: {
        stage: 2, category: 'B', type: 'single', required: true,
        text: 'יש אנשים שתלויים בהכנסה שלכם?', help: 'למשל ילדים, בן או בת זוג, או הורים שאתם תומכים בהם.', summaryLabel: 'תלויים בהכנסה',
        options: [{ value: 'yes', label: 'כן' }, { value: 'partial', label: 'חלקית' }, { value: 'no', label: 'לא' }],
      },
      altIncome: {
        stage: 3, category: 'B', type: 'single', required: true,
        text: 'אם לא תוכלו לעבוד תקופה ארוכה, יש לכם מקור הכנסה חלופי?', summaryLabel: 'הכנסה חלופית',
        options: [{ value: 'yes', label: 'כן' }, { value: 'partial', label: 'חלקית' }, { value: 'no', label: 'לא' }, { value: 'unknown', label: 'לא יודע/ת', gap: true }],
      },
      coverageKnown: {
        stage: 3, category: 'B', type: 'single', required: true,
        text: 'אתם יודעים איזה כיסוי ביטוחי יש לכם היום?', summaryLabel: 'ידיעת הכיסוי הקיים',
        options: [
          { value: 'yes', label: 'כן' }, { value: 'partial', label: 'חלקית', gap: true },
          { value: 'no', label: 'לא', gap: true }, { value: 'none', label: 'אין לי ביטוחים' },
        ],
      },

      // ----- path 3: tax benefits -----
      studyFund: {
        stage: 2, category: 'C', type: 'single', required: true,
        text: 'יש לכם קרן השתלמות לעצמאים?', summaryLabel: 'קרן השתלמות',
        when: { not: { fact: 'studyFundHas', is: 'no' } },
        options: [
          { value: 'depositing', label: 'כן, ואני מפקיד/ה אליה' },
          { value: 'notDepositing', label: 'כן, אבל כרגע לא מפקיד/ה' },
          { value: 'no', label: 'לא' },
          { value: 'unknown', label: 'לא יודע/ת', gap: true },
        ],
        derive: [
          { if: { in: ['depositing', 'notDepositing'] }, set: { studyFundHas: 'yes' } },
          { if: { is: 'no' }, set: { studyFundHas: 'no' } },
          { if: { is: 'unknown' }, set: { studyFundHas: 'unknown' } },
        ],
      },
      taxReviewed: {
        stage: 3, category: 'C', type: 'single', required: true,
        text: 'מישהו בדק אתכם השנה אם ניצלתם את כל הטבות המס האפשריות?', summaryLabel: 'בדיקת הטבות המס השנה',
        options: YES_NO_UNKNOWN,
      },
      extraDeposit: {
        stage: 3, category: 'C', type: 'single', required: false,
        text: 'אם יתברר שיש הטבות מס נוספות שאפשר לנצל, תוכלו להפקיד עוד השנה?', summaryLabel: 'יכולת להפקדה נוספת השנה',
        when: { any: [{ fact: 'taxReviewed', in: ['no', 'unknown'] }, { fact: 'income', in: ['b2', 'b3'] }] },
        options: [{ value: 'yes', label: 'כן' }, { value: 'maybe', label: 'אולי, תלוי בסכום' }, { value: 'no', label: 'לא כרגע' }],
      },

      // ----- path 4: the minimum only -----
      minReason: {
        stage: 2, category: 'D', type: 'single', required: true,
        text: 'מה הסיבה העיקרית שאתם מעדיפים להפקיד רק את המינימום?', summaryLabel: 'הסיבה להפקדת מינימום',
        options: [
          { value: 'business', label: 'אני מעדיף/ה לשמור כסף בעסק' },
          { value: 'investSelf', label: 'אני מעדיף/ה להשקיע בעצמי' },
          { value: 'distrust', label: 'אני לא מאמין/ה שהפנסיה היא פתרון טוב בשבילי' },
          { value: 'cantAfford', label: 'כרגע אין לי אפשרות כלכלית להפקיד יותר' },
          { value: 'unsure', label: 'אני פשוט לא יודע/ת אם כדאי לי להפקיד יותר', gap: true },
        ],
      },
      businessNeed: {
        stage: 2, category: 'D', type: 'single', required: true,
        text: 'זה צורך זמני, או הדרך הקבועה שלכם לנהל את הכסף?', summaryLabel: 'כסף בעסק',
        when: { fact: 'minReason', is: 'business' },
        options: [{ value: 'temporary', label: 'צורך זמני' }, { value: 'permanent', label: 'גישה קבועה' }, { value: 'unknown', label: 'לא יודע/ת', gap: true }],
      },
      investWhere: {
        stage: 2, category: 'D', type: 'multi', required: true,
        text: 'איפה אתם משקיעים היום את הכסף?', help: 'אפשר לבחור כמה.', summaryLabel: 'השקעה עצמית',
        when: { fact: 'minReason', is: 'investSelf' },
        options: [
          { value: 'market', label: 'בשוק ההון, באופן עצמאי' },
          { value: 'gemelInvest', label: 'בקופות גמל להשקעה או בפוליסות חיסכון' },
          { value: 'realEstate', label: 'בנדל"ן' },
          { value: 'deposits', label: 'בפיקדונות או בקרנות כספיות' },
          { value: 'other', label: 'במקום אחר' },
          { value: 'notInvesting', label: 'כרגע אני לא משקיע/ה', exclusive: true },
        ],
      },
      pensionDislike: {
        stage: 2, category: 'D', type: 'single', required: true,
        text: 'מה הכי מפריע לכם בחיסכון הפנסיוני?', summaryLabel: 'מה מפריע בפנסיה',
        when: { fact: 'minReason', is: 'distrust' },
        options: [
          { value: 'liquidity', label: 'הכסף לא נזיל' }, { value: 'control', label: 'אין לי שליטה' },
          { value: 'fees', label: 'דמי הניהול' }, { value: 'trust', label: 'אין לי אמון בגופים המנהלים' },
          { value: 'understanding', label: 'אני לא מבין/ה את המוצר' },
        ],
      },
      obligationKnown: {
        stage: 3, category: 'D', type: 'single', required: true,
        text: 'אתם יודעים מה חובת ההפקדה שחלה עליכם?', summaryLabel: 'ידיעת חובת ההפקדה',
        options: [{ value: 'yes', label: 'כן, בערך' }, { value: 'no', label: 'לא', gap: true }, { value: 'unsure', label: 'לא בטוח/ה', gap: true }],
      },
      coverageImpact: {
        stage: 3, category: 'B', type: 'single', required: false,
        text: 'בדקתם איך הפקדה נמוכה משפיעה על הכיסוי הביטוחי שלכם?',
        help: 'בקרן פנסיה, גובה ההפקדות משפיע בדרך כלל גם על הכיסוי לנכות ולשארים.', summaryLabel: 'השפעת ההפקדה על הכיסוי',
        when: { any: [{ priority: 'minimum' }, { all: [{ priority: 'protection' }, { fact: 'deposits', in: ['irregular', 'annual', 'none'] }] }] },
        options: [{ value: 'yes', label: 'כן, בדקתי' }, { value: 'no', label: 'לא בדקתי', gap: true }, { value: 'unaware', label: 'לא ידעתי שיש קשר', gap: true }],
      },
      taxVsMinimum: {
        stage: 3, category: 'C', type: 'single', required: true,
        text: 'אם יתברר שהפקדה מעבר למינימום מקטינה לכם את המס, זה ישנה את ההחלטה?', summaryLabel: 'מינימום מול הטבת מס',
        options: [{ value: 'yes', label: 'כן, אשקול להפקיד יותר' }, { value: 'maybe', label: 'תלוי בסכום' }, { value: 'no', label: 'לא, אעדיף בכל זאת את המינימום' }],
      },

      // ----- path 5: liquidity and control -----
      liqReason: {
        stage: 2, category: 'E', type: 'single', required: true,
        text: 'למה חשוב לכם שהכסף יהיה נזיל?', summaryLabel: 'הסיבה לנזילות',
        options: [
          { value: 'business', label: 'שיהיה זמין לצורכי העסק' },
          { value: 'investSelf', label: 'כדי להשקיע אותו בעצמי' },
          { value: 'fearLock', label: 'אני חושש/ת לנעול כסף לשנים רבות' },
          { value: 'bigExpense', label: 'אני מתכנן/ת הוצאה גדולה בשנים הקרובות' },
          { value: 'flexibility', label: 'כדי לשמור על גמישות כלכלית' },
        ],
      },
      horizon: {
        stage: 2, category: 'E', type: 'single', required: true,
        text: 'בעוד כמה זמן אתם חושבים שתצטרכו את הכסף?', summaryLabel: 'טווח הזמן לכסף',
        options: [
          { value: 'y1', label: 'במהלך השנה הקרובה' }, { value: 'y1to3', label: 'בעוד שנה עד שלוש שנים' },
          { value: 'y3to5', label: 'בעוד שלוש עד חמש שנים' }, { value: 'gt5', label: 'בעוד יותר מחמש שנים' },
          { value: 'none', label: 'אין לי מועד מוגדר' },
        ],
      },
      liquidSavings: {
        stage: 2, category: 'E', type: 'single', required: true,
        text: 'יש לכם היום חסכונות נזילים?', help: 'כסף שאפשר למשוך תוך זמן קצר, כמו פיקדון, קרן כספית או תיק השקעות.', summaryLabel: 'חסכונות נזילים',
        options: [{ value: 'yes', label: 'כן' }, { value: 'no', label: 'לא' }, { value: 'unsure', label: 'לא בטוח/ה', gap: true }],
      },
      liquidAmount: {
        stage: 2, category: 'E', type: 'single', required: false,
        text: 'מה סדר הגודל של החסכונות הנזילים שלכם?', summaryLabel: 'היקף החסכונות הנזילים',
        when: { fact: 'liquidSavings', is: 'yes' },
        options: [
          { value: 'lt50', label: 'עד 50,000 ₪' }, { value: '50to150', label: '50,000–150,000 ₪' },
          { value: '150to400', label: '150,000–400,000 ₪' }, { value: '400to1m', label: '400,000–1,000,000 ₪' },
          { value: 'gt1m', label: 'מעל מיליון ₪' }, { value: 'na', label: 'מעדיף/ה לא לענות', withheld: true },
        ],
      },
      studyFundLiquid: {
        stage: 3, category: 'E', type: 'single', required: true,
        text: [
          { when: { fact: 'studyFundHas', is: 'yes' }, text: 'קרן ההשתלמות שלכם כבר נזילה?' },
          { text: 'יש לכם היום קרן השתלמות?' },
        ],
        summaryLabel: 'נזילות קרן ההשתלמות',
        when: { not: { fact: 'studyFundHas', in: ['no', 'unknown'] } },
        options: [
          { value: 'liquid', label: 'כן, היא כבר נזילה' }, { value: 'locked', label: 'כן, היא עדיין לא נזילה' },
          { value: 'no', label: 'אין לי קרן השתלמות' }, { value: 'unknown', label: 'לא יודע/ת', gap: true },
        ],
        derive: [
          { if: { in: ['liquid', 'locked'] }, set: { studyFundHas: 'yes' } },
          { if: { is: 'no' }, set: { studyFundHas: 'no' } },
        ],
      },
      taxVsLiquidity: {
        stage: 3, category: 'E', type: 'single', required: true,
        text: 'הפקדה לפנסיה עשויה להקטין את המס, אבל הכסף נשאר בה עד הפרישה. קרן השתלמות נזילה בדרך כלל אחרי שש שנים. מה חשוב לכם יותר?',
        summaryLabel: 'הטבת מס מול נזילות',
        options: [
          { value: 'liquid', label: 'שהכסף יישאר זמין, גם אם ההטבה תהיה קטנה יותר' },
          { value: 'tax', label: 'ההטבה במס, גם אם הכסף ננעל' },
          { value: 'both', label: 'חלק לכל צורך' },
          { value: 'unknown', label: 'עוד לא יודע/ת', gap: true },
        ],
      },

      // ----- path 6: "I do what the accountant told me" -----
      product: {
        stage: 2, category: 'F', type: 'single', required: true,
        text: 'אתם יודעים באיזה מוצר פנסיוני אתם חוסכים?', summaryLabel: 'מוצר פנסיוני',
        options: [
          { value: 'pensionFund', label: 'קרן פנסיה' }, { value: 'managers', label: 'ביטוח מנהלים' },
          { value: 'gemel', label: 'קופת גמל' }, { value: 'several', label: 'יש לי כמה מוצרים' },
          { value: 'noIdea', label: 'אין לי מושג', gap: true },
        ],
      },
      accumulated: {
        stage: 2, category: 'F', type: 'single', required: true,
        text: 'אתם יודעים כמה כסף כבר צברתם?', summaryLabel: 'ידיעת הצבירה',
        options: [{ value: 'yes', label: 'כן' }, { value: 'approx', label: 'בערך' }, { value: 'no', label: 'לא', gap: true }],
      },
      lastReview: {
        stage: 3, category: 'F', type: 'single', required: true,
        text: 'מתי בפעם האחרונה מישהו עבר אתכם על כל החסכונות והביטוחים?', summaryLabel: 'בדיקה אחרונה של התיק',
        options: [
          { value: 'lastYear', label: 'בשנה האחרונה' }, { value: 'fewYears', label: 'לפני כמה שנים' },
          { value: 'never', label: 'אף פעם' }, { value: 'notRemember', label: 'לא זוכר/ת', gap: true },
        ],
      },
      wantToUnderstand: {
        stage: 3, category: 'F', type: 'single', required: true,
        text: 'מה הכי הייתם רוצים להבין על החיסכון שלכם?', summaryLabel: 'מה רוצים להבין',
        options: [
          { value: 'pensionAmount', label: 'כמה פנסיה תהיה לי' }, { value: 'enough', label: 'אם אני מפקיד/ה מספיק' },
          { value: 'tax', label: 'אם אני מנצל/ת הטבות מס' }, { value: 'insurance', label: 'אם יש לי ביטוחים מתאימים' },
          { value: 'manage', label: 'אם אפשר לנהל את הכסף טוב יותר' }, { value: 'all', label: 'את כל התמונה' },
        ],
      },
      otherSavingsSimple: {
        stage: 3, category: 'F', type: 'single', required: false,
        text: 'יש לכם, מעבר לפנסיה, חסכונות או השקעות נוספים?', summaryLabel: 'חסכונות נוספים',
        options: [{ value: 'yes', label: 'כן' }, { value: 'no', label: 'לא' }, { value: 'unsure', label: 'לא בטוח/ה', gap: true }],
      },
    },

    // Each path: the core questions in order, then the one or two that matter most when it is only a secondary priority.
    paths: {
      pension: { core: ['age', 'deposits', 'expectedPension', 'pensionVsLiquidity', 'otherSavings'], key: ['age', 'expectedPension'] },
      protection: { core: ['worry', 'family', 'dependents', 'altIncome', 'coverageKnown', 'age'], key: ['dependents', 'coverageKnown'] },
      tax: { core: ['income', 'employee', 'deposits', 'studyFund', 'taxReviewed', 'extraDeposit'], key: ['income', 'taxReviewed'] },
      minimum: { core: ['minReason', 'businessNeed', 'investWhere', 'pensionDislike', 'obligationKnown', 'income', 'deposits', 'employee', 'coverageImpact', 'otherSavings'], key: ['minReason'] },
      liquidity: { core: ['liqReason', 'horizon', 'liquidSavings', 'liquidAmount', 'studyFundLiquid', 'deposits'], key: ['liqReason', 'horizon'] },
      unsure: { core: ['product', 'accumulated', 'lastReview', 'wantToUnderstand', 'otherSavingsSimple', 'age'], key: ['lastReview'] },
    },

    // Questions that weigh two chosen priorities against each other, asked right after the main path.
    bridges: [
      { pair: ['tax', 'liquidity'], questions: ['taxVsLiquidity'] },
      { pair: ['pension', 'liquidity'], questions: ['pensionVsLiquidity'] },
      { pair: ['tax', 'minimum'], questions: ['taxVsMinimum'] },
      { pair: ['protection', 'minimum'], questions: ['coverageImpact'] },
      { pair: ['pension', 'minimum'], questions: ['minReason'] },
    ],

    // Background questions, asked only when the area they inform has become relevant, within the soft limit.
    background: [
      { question: 'age' },
      { question: 'deposits', when: { any: [{ priority: 'pension' }, { priority: 'tax' }, { priority: 'minimum' }, { priority: 'liquidity' }, { score: { area: 'D', atLeast: 25 } }] } },
      { question: 'employee', when: { any: [{ score: { area: 'C', atLeast: 30 } }, { score: { area: 'D', atLeast: 30 } }] } },
      { question: 'yearsActive', when: { all: [{ score: { area: 'D', atLeast: 35 } }, { not: { fact: 'age', is: '60p' } }] } },
      { question: 'income', when: { any: [{ score: { area: 'C', atLeast: 40 } }, { score: { area: 'D', atLeast: 45 } }] } },
      { question: 'family', when: { score: { area: 'B', atLeast: 35 } } },
      { question: 'horizon', when: { score: { area: 'E', atLeast: 40 } } },
    ],

    // Short replies shown above the next question. One at most per screen, each only once, and only where it fits.
    messages: [
      { id: 'mix-tax-liquidity', after: ['priorities', 'primary'], when: { all: [{ priority: 'tax' }, { priority: 'liquidity' }, { fact: 'primary', asked: true }] }, text: 'אני מבין שהנזילות חשובה לכם, אבל גם הטבות המס מעניינות אתכם. ננסה להבין איך שני הדברים משתלבים.' },
      { id: 'mix-pension-minimum', after: ['priorities', 'primary'], when: { all: [{ priority: 'pension' }, { priority: 'minimum' }, { fact: 'primary', asked: true }] }, text: 'קצבה גבוהה והפקדת מינימום מושכות לכיוונים שונים. זה לא בהכרח סותר, וננסה להבין מה מכריע אצלכם.' },
      { id: 'mix-pension-liquidity', after: ['priorities', 'primary'], when: { all: [{ priority: 'pension' }, { priority: 'liquidity' }, { fact: 'primary', asked: true }] }, text: 'קצבה טובה בפרישה לצד כסף זמין היום: ננסה להבין איך לאזן בין השניים.' },
      { id: 'mix-protection-minimum', after: ['priorities', 'primary'], when: { all: [{ priority: 'protection' }, { priority: 'minimum' }, { fact: 'primary', asked: true }] }, text: 'ההגנה הביטוחית וגובה ההפקדה קשורים זה בזה יותר ממה שנדמה. נבדוק גם את זה.' },
      { id: 'start-liquidity', after: ['priorities', 'primary'], when: { primary: 'liquidity' }, text: 'מובן. לעצמאים, היכולת לשמור על גמישות כלכלית יכולה להיות משמעותית. בואו נבין למה הנזילות חשובה לכם.' },
      { id: 'start-unsure', after: ['priorities', 'primary'], when: { primary: 'unsure' }, text: 'זה מצב נפוץ מאוד, ובשביל זה בדיוק עושים מיפוי. נתחיל ממה שאתם כן יודעים.' },
      { id: 'start-minimum', after: ['priorities', 'primary'], when: { primary: 'minimum' }, text: 'זו בחירה לגיטימית. נבין מה עומד מאחוריה.' },
      { id: 'start-pension', after: ['priorities', 'primary'], when: { primary: 'pension' }, text: 'נתחיל מהמצב היום, ואחר כך נבין כמה רחוק אתם מהיעד.' },
      { id: 'start-protection', after: ['priorities', 'primary'], when: { primary: 'protection' }, text: 'נבין קודם על מה הכי חשוב לכם להגן.' },
      { id: 'start-tax', after: ['priorities', 'primary'], when: { primary: 'tax' }, text: 'ההטבות תלויות בהכנסה ובהפקדות, אז נתחיל מהן.' },
      { id: 'many-unknowns', after: '*', when: { unknownCount: { atLeast: 3 } }, text: 'לא לדעת זה בסדר גמור, וזה בעצמו ממצא: נקודת הפתיחה תהיה מיפוי של מה שיש.' },
      { id: 'late-pension', after: ['expectedPension', 'age'], when: { all: [{ fact: 'age', in: ['50s', '60p'] }, { fact: 'expectedPension', in: ['notChecked', 'noIdea'] }] }, text: 'בשלב הזה של הקריירה, כדאי לדעת מה הקצבה הצפויה. זה לא אומר שיש בעיה, רק שכדאי לבדוק.' },
      { id: 'no-deposits', after: ['deposits'], when: { fact: 'deposits', is: 'none' }, text: 'לפני שמחליטים כמה להפקיד, כדאי לדעת אם חלה עליכם חובת הפקדה. נחזור לזה בתוצאה.' },
      { id: 'no-cover', after: ['coverageKnown'], when: { fact: 'coverageKnown', is: 'none' }, text: 'רשמתי. לפעמים יש כיסוי שלא יודעים עליו, למשל בקרן הפנסיה, ולכן כדאי לבדוק לפני שמסיקים מסקנות.' },
      { id: 'dependents', after: ['dependents'], when: { fact: 'dependents', in: ['yes', 'partial'] }, text: 'כשיש מי שתלוי בהכנסה שלכם, ההגנה על המשפחה מקבלת משקל גדול יותר.' },
      { id: 'short-horizon', after: ['horizon'], when: { fact: 'horizon', in: ['y1', 'y1to3'] }, text: 'טווח קצר משפיע גם על רמת הסיכון שמתאימה לכסף הזה.' },
      { id: 'employee', after: ['employee'], when: { all: [{ fact: 'employee', is: 'yes' }, { any: [{ priority: 'tax' }, { priority: 'minimum' }, { score: { area: 'D', atLeast: 30 } }] }] }, text: 'ההפקדות דרך המשכורת עשויות להשפיע גם על החישוב כעצמאים. ניקח את זה בחשבון.' },
      { id: 'big-liquid', after: ['liquidAmount'], when: { fact: 'liquidAmount', in: ['150to400', '400to1m', 'gt1m'] }, text: 'כשיש סכום נזיל משמעותי, עולה שאלה של תכנון: כמה להשאיר זמין, וכמה לייעד לטווח ארוך.' },
    ],

    // ----- the needs map: every point is a rule with its reason, so each score can be explained and tested -----
    // kind: preference | answer | gap | unchecked | horizon | clarity
    scoring: [
      // explicit preference: the main priority 40, every other chosen priority 20
      ...['pension', 'protection', 'tax', 'minimum', 'liquidity', 'unsure'].flatMap((p) => {
        const area = { pension: 'A', protection: 'B', tax: 'C', minimum: 'D', liquidity: 'E', unsure: 'F' }[p];
        return [
          { area, pts: 40, kind: 'preference', when: { primary: p }, why: 'בחרתם בזה כדבר החשוב לכם ביותר כרגע' },
          { area, pts: 20, kind: 'preference', when: { secondary: p }, why: 'בחרתם בזה גם כחשוב לכם' },
        ];
      }),

      // A: retirement
      { area: 'A', pts: 30, kind: 'gap', when: { all: [{ fact: 'age', in: ['50s', '60p'] }, { fact: 'expectedPension', in: ['notChecked', 'noIdea'] }] }, why: 'אתם מעל גיל 50 ועדיין לא יודעים מה הקצבה הצפויה' },
      { area: 'A', pts: 25, kind: 'answer', when: { fact: 'expectedPension', is: 'low' }, why: 'ציינתם שהקצבה הצפויה נמוכה ממה שהייתם רוצים' },
      { area: 'A', pts: 15, kind: 'gap', when: { fact: 'expectedPension', in: ['notChecked', 'noIdea'] }, why: 'הקצבה הצפויה עדיין לא ידועה לכם' },
      { area: 'A', pts: 15, kind: 'answer', when: { all: [{ fact: 'age', in: ['u30', '30s'] }, { fact: 'deposits', in: ['irregular', 'annual', 'none'] }] }, why: 'בגיל צעיר, לקצב החיסכון לאורך זמן יש השפעה גדולה' },
      { area: 'A', pts: 15, kind: 'answer', when: { all: [{ fact: 'age', in: ['40s', '50s'] }, { fact: 'deposits', in: ['irregular', 'annual'] }] }, why: 'ההפקדות אינן סדירות, וזה משפיע על הקצבה' },
      { area: 'A', pts: 10, kind: 'unchecked', when: { all: [{ fact: 'income', in: ['b2', 'b3'] }, { not: { fact: 'deposits', is: 'monthly' } }] }, why: 'ההכנסה מעל השכר הממוצע, וחובת ההפקדה מחושבת רק עד השכר הממוצע' },
      { area: 'A', pts: 10, kind: 'answer', when: { fact: 'deposits', is: 'none' }, why: 'כרגע אין הפקדה לחיסכון פנסיוני' },
      { area: 'A', pts: 10, kind: 'horizon', when: { fact: 'age', in: ['50s', '60p'] }, why: 'הפרישה קרובה יותר' },
      { area: 'A', pts: 10, kind: 'answer', when: { fact: 'pensionVsLiquidity', is: 'maxRetirement' }, why: 'העדפתם להגדיל את ההכנסה בפרישה' },
      { area: 'A', pts: 20, kind: 'answer', when: { fact: 'wantToUnderstand', in: ['pensionAmount', 'enough'] }, why: 'רציתם להבין כמה פנסיה תהיה לכם, ואם אתם מפקידים מספיק' },
      { area: 'A', pts: 10, kind: 'unchecked', when: { priority: 'minimum' }, why: 'הפקדת מינימום משפיעה גם על החיסכון לפרישה' },

      // B: protection
      { area: 'B', pts: 15, kind: 'answer', when: { fact: 'worry', in: ['income', 'family'] }, why: 'ציינתם מה הכי מדאיג אתכם' },
      { area: 'B', pts: 20, kind: 'answer', when: { fact: 'worry', is: 'both' }, why: 'גם ההכנסה וגם המשפחה מדאיגות אתכם' },
      { area: 'B', pts: 20, kind: 'gap', when: { fact: 'worry', is: 'unknownCover' }, why: 'לא ידוע לכם אילו ביטוחים יש לכם' },
      { area: 'B', pts: 25, kind: 'answer', when: { fact: 'dependents', is: 'yes' }, why: 'יש מי שתלוי בהכנסה שלכם' },
      { area: 'B', pts: 15, kind: 'answer', when: { fact: 'dependents', is: 'partial' }, why: 'יש מי שתלוי חלקית בהכנסה שלכם' },
      { area: 'B', pts: 15, kind: 'gap', when: { all: [{ fact: 'coverageKnown', in: ['partial', 'no'] }, { not: { fact: 'worry', is: 'unknownCover' } }] }, why: 'הכיסוי הקיים לא ידוע לכם במלואו' },
      { area: 'B', pts: 20, kind: 'gap', when: { fact: 'coverageKnown', is: 'none' }, why: 'דיווחתם שאין לכם ביטוחים, וכדאי לוודא זאת מול הנתונים' },
      { area: 'B', pts: 15, kind: 'answer', when: { fact: 'altIncome', is: 'no' }, why: 'אין מקור הכנסה חלופי אם לא תוכלו לעבוד' },
      { area: 'B', pts: 10, kind: 'answer', when: { fact: 'altIncome', in: ['partial', 'unknown'] }, why: 'מקור ההכנסה החלופי חלקי או לא ידוע' },
      { area: 'B', pts: 15, kind: 'unchecked', when: { fact: 'coverageImpact', in: ['no', 'unaware'] }, why: 'עוד לא נבדקה ההשפעה של גובה ההפקדה על הכיסוי' },
      { area: 'B', pts: 10, kind: 'unchecked', when: { priority: 'minimum' }, why: 'גובה ההפקדה משפיע בדרך כלל גם על הכיסוי בקרן הפנסיה' },
      { area: 'B', pts: 20, kind: 'answer', when: { fact: 'wantToUnderstand', is: 'insurance' }, why: 'רציתם להבין אם יש לכם ביטוחים מתאימים' },
      { area: 'B', pts: 10, kind: 'gap', when: { fact: 'lastReview', in: ['never', 'notRemember'] }, why: 'הביטוחים לא נבדקו לאחרונה' },

      // C: tax benefits
      { area: 'C', pts: 25, kind: 'answer', when: { all: [{ fact: 'income', in: ['b2', 'b3'] }, { fact: 'taxReviewed', in: ['no', 'unknown'] }] }, why: 'ההכנסה גבוהה, ועוד לא נבדק השנה אם ההטבות נוצלו' },
      { area: 'C', pts: 15, kind: 'gap', when: { fact: 'taxReviewed', in: ['no', 'unknown'] }, why: 'עוד לא נבדק השנה אם ניצלתם את הטבות המס' },
      { area: 'C', pts: 10, kind: 'answer', when: { fact: 'deposits', in: ['irregular', 'annual'] }, why: 'ההפקדות אינן קבועות, ולכן כדאי לבדוק אותן מול שנת המס' },
      { area: 'C', pts: 15, kind: 'answer', when: { fact: 'studyFund', is: 'notDepositing' }, why: 'יש לכם קרן השתלמות שלא מפקידים אליה כרגע' },
      { area: 'C', pts: 10, kind: 'unchecked', when: { fact: 'studyFund', is: 'no' }, why: 'אין לכם קרן השתלמות, וכדאי לדעת אם היא רלוונטית לכם' },
      { area: 'C', pts: 10, kind: 'gap', when: { fact: 'studyFund', is: 'unknown' }, why: 'לא ידוע לכם אם יש קרן השתלמות' },
      { area: 'C', pts: 10, kind: 'answer', when: { fact: 'employee', is: 'yes' }, why: 'יש לכם גם משכורת, והפקדות דרכה עשויות להשפיע על החישוב' },
      { area: 'C', pts: 10, kind: 'answer', when: { fact: 'extraDeposit', in: ['yes', 'maybe'] }, why: 'ייתכן שתוכלו להפקיד עוד השנה' },
      { area: 'C', pts: 10, kind: 'answer', when: { fact: 'taxVsLiquidity', is: 'tax' }, why: 'העדפתם את ההטבה במס על פני הנזילות' },
      { area: 'C', pts: 10, kind: 'answer', when: { fact: 'taxVsMinimum', in: ['yes', 'maybe'] }, why: 'הטבת מס עשויה לשנות את ההחלטה על גובה ההפקדה' },
      { area: 'C', pts: 20, kind: 'answer', when: { fact: 'wantToUnderstand', is: 'tax' }, why: 'רציתם להבין אם אתם מנצלים הטבות מס' },
      { area: 'C', pts: 10, kind: 'unchecked', when: { priority: 'minimum' }, why: 'גובה ההפקדה משפיע גם על הטבות המס' },
      { area: 'C', pts: 5, kind: 'gap', when: { fact: 'income', is: 'unknown' }, why: 'ההכנסה החייבת לא ידועה לכם' },

      // D: the legal obligation (the figures come from regulatory.js)
      { area: 'D', pts: 35, kind: 'answer', when: { fact: 'deposits', is: 'none' }, why: 'כרגע אין הפקדה לחיסכון פנסיוני' },
      { area: 'D', pts: 25, kind: 'gap', when: { fact: 'deposits', is: 'unknown' }, why: 'לא ברור לכם אם יש הפקדה פנסיונית' },
      { area: 'D', pts: 20, kind: 'answer', when: { fact: 'deposits', is: 'irregular' }, why: 'ההפקדות אינן סדירות, וכדאי לוודא שהחובה השנתית מתמלאת' },
      { area: 'D', pts: 5, kind: 'answer', when: { fact: 'deposits', is: 'annual' }, why: 'הפקדה שנתית צריכה להיקלט באותה שנת מס' },
      { area: 'D', pts: 20, kind: 'gap', when: { fact: 'obligationKnown', in: ['no', 'unsure'] }, why: 'החובה שחלה עליכם לא ידועה לכם' },
      { area: 'D', pts: 10, kind: 'answer', when: { fact: 'employee', is: 'yes' }, why: 'יש לכם גם משכורת, ולכן צריך לבדוק את החובה לפי שני מקורות ההכנסה' },
      { area: 'D', pts: 15, kind: 'unchecked', when: { all: [{ priority: 'liquidity' }, { fact: 'deposits', in: ['none', 'unknown'] }] }, why: 'כדאי לבדוק את חובת ההפקדה לפני שמעדיפים כסף נזיל' },
      { area: 'D', pts: -20, kind: 'answer', needs: ['eligibilityRules.obligationWaitingMonths'], when: { fact: 'yearsActive', is: 'lt6m' }, why: 'ב־{obligationWaitingMonths} החודשים הראשונים כעוסק החובה עדיין לא חלה' },
      { area: 'D', pts: -25, kind: 'answer', needs: ['eligibilityRules.obligationMaxAge'], when: { fact: 'age', is: '60p' }, why: 'מגיל {obligationMaxAge} החובה בדרך כלל כבר לא חלה' },

      // E: liquidity and how savings are split
      { area: 'E', pts: 20, kind: 'answer', when: { fact: 'liquidAmount', is: '150to400' }, why: 'יש לכם סכום נזיל משמעותי' },
      { area: 'E', pts: 30, kind: 'answer', when: { fact: 'liquidAmount', in: ['400to1m', 'gt1m'] }, why: 'יש לכם סכום נזיל גדול' },
      { area: 'E', pts: 15, kind: 'horizon', when: { fact: 'horizon', in: ['y1', 'y1to3'] }, why: 'תצטרכו את הכסף בטווח קצר' },
      { area: 'E', pts: 5, kind: 'horizon', when: { fact: 'horizon', is: 'y3to5' }, why: 'תצטרכו את הכסף בטווח בינוני' },
      { area: 'E', pts: 10, kind: 'answer', when: { fact: 'liqReason', in: ['business', 'bigExpense', 'investSelf'] }, why: 'יש לכם שימוש מוגדר לכסף הנזיל' },
      { area: 'E', pts: 15, kind: 'answer', when: { fact: 'minReason', in: ['business', 'investSelf'] }, why: 'אתם מעדיפים להחזיק את הכסף מחוץ לפנסיה' },
      { area: 'E', pts: 10, kind: 'answer', when: { fact: 'businessNeed', is: 'permanent' }, why: 'החזקת הכסף בעסק היא הגישה הקבועה שלכם' },
      { area: 'E', pts: 10, kind: 'answer', when: { fact: 'investWhere', hasAny: ['market', 'gemelInvest', 'deposits'] }, why: 'יש לכם השקעות מחוץ לפנסיה' },
      { area: 'E', pts: 15, kind: 'answer', when: { fact: 'pensionDislike', is: 'liquidity' }, why: 'מה שמפריע לכם בפנסיה הוא שהכסף לא נזיל' },
      { area: 'E', pts: 15, kind: 'answer', when: { fact: 'pensionVsLiquidity', in: ['liquid', 'both'] }, why: 'חשוב לכם לשמור גם כסף נזיל' },
      { area: 'E', pts: 15, kind: 'answer', when: { fact: 'taxVsLiquidity', in: ['liquid', 'both'] }, why: 'הנזילות חשובה לכם גם מול הטבת המס' },
      { area: 'E', pts: 10, kind: 'answer', when: { fact: 'otherSavings', hasAny: ['investments', 'realEstate'] }, why: 'יש לכם חסכונות והשקעות מחוץ לפנסיה' },
      { area: 'E', pts: 10, kind: 'gap', when: { all: [{ priority: 'liquidity' }, { fact: 'liquidSavings', is: 'no' }] }, why: 'אין לכם כרגע כסף נזיל, למרות שהנזילות חשובה לכם' },
      { area: 'E', pts: 15, kind: 'answer', when: { fact: 'wantToUnderstand', is: 'manage' }, why: 'רציתם להבין אם אפשר לנהל את הכסף טוב יותר' },

      // F: mapping the whole picture
      { area: 'F', pts: 25, kind: 'gap', when: { fact: 'product', is: 'noIdea' }, why: 'לא ידוע לכם באיזה מוצר אתם חוסכים' },
      { area: 'F', pts: 15, kind: 'answer', when: { fact: 'product', is: 'several' }, why: 'יש לכם כמה מוצרים, וכדאי לראות אותם יחד' },
      { area: 'F', pts: 15, kind: 'gap', when: { fact: 'accumulated', is: 'no' }, why: 'לא ידוע לכם כמה כבר צברתם' },
      { area: 'F', pts: 5, kind: 'gap', when: { fact: 'accumulated', is: 'approx' }, why: 'הצבירה ידועה לכם רק בערך' },
      { area: 'F', pts: 25, kind: 'gap', when: { fact: 'lastReview', in: ['never', 'notRemember'] }, why: 'אף אחד לא עבר אתכם לאחרונה על כל החסכונות והביטוחים' },
      { area: 'F', pts: 15, kind: 'gap', when: { fact: 'lastReview', is: 'fewYears' }, why: 'הבדיקה האחרונה הייתה לפני כמה שנים' },
      { area: 'F', pts: 20, kind: 'answer', when: { fact: 'wantToUnderstand', is: 'all' }, why: 'רציתם להבין את כל התמונה' },
      { area: 'F', pts: 20, kind: 'clarity', when: { unknownCount: { atLeast: 3 } }, why: 'בכמה שאלות עניתם שאינכם יודעים, ולכן כדאי להתחיל ממיפוי' },
      { area: 'F', pts: 10, kind: 'gap', when: { fact: 'deposits', is: 'unknown' }, why: 'לא ברור לכם אם יש הפקדה פנסיונית' },
      { area: 'F', pts: 5, kind: 'gap', when: { fact: 'otherSavingsSimple', is: 'unsure' }, why: 'לא ברור לכם אם יש חסכונות נוספים' },
    ],

    // Answers that do not sit well together. Shown as things to clarify, never as an error of the visitor.
    contradictions: [
      { id: 'pension-and-minimum', areas: ['A', 'D'], when: { all: [{ priority: 'pension' }, { priority: 'minimum' }] }, text: 'בחרתם גם קצבה גבוהה וגם הפקדת מינימום. שתי המטרות מושכות לכיוונים שונים, וכדאי לברר מה מכריע.' },
      { id: 'satisfied-no-deposits', areas: ['A', 'D'], when: { all: [{ fact: 'expectedPension', is: 'satisfied' }, { fact: 'deposits', is: 'none' }] }, text: 'ציינתם שאתם מרוצים מהקצבה הצפויה, וגם שאינכם מפקידים היום. כדאי לברר מאיפה תגיע הקצבה.' },
      { id: 'no-cover-but-fund', areas: ['B', 'F'], when: { all: [{ fact: 'coverageKnown', is: 'none' }, { fact: 'product', in: ['pensionFund', 'several'] }] }, text: 'ציינתם שאין לכם ביטוחים, וגם שיש לכם קרן פנסיה, שכוללת בדרך כלל כיסוי לנכות ולשארים.' },
      { id: 'family-worry-no-dependents', areas: ['B'], when: { all: [{ fact: 'worry', in: ['family', 'both'] }, { fact: 'dependents', is: 'no' }] }, text: 'הדאגה להכנסת המשפחה עלתה, אבל ציינתם שאין מי שתלוי בהכנסה שלכם. כדאי לברר למי ההגנה נועדה.' },
      { id: 'reviewed-but-unknown', areas: ['C', 'D'], when: { all: [{ fact: 'taxReviewed', is: 'yes' }, { fact: 'deposits', is: 'unknown' }] }, text: 'ציינתם שהטבות המס נבדקו השנה, אבל לא ידוע לכם אם יש הפקדה פנסיונית.' },
      { id: 'cant-afford-but-extra', areas: ['C', 'D'], when: { all: [{ fact: 'minReason', is: 'cantAfford' }, { fact: 'extraDeposit', is: 'yes' }] }, text: 'ציינתם שכרגע אין אפשרות להפקיד יותר, וגם שתוכלו להפקיד עוד השנה.' },
      { id: 'no-savings-but-fund', areas: ['C', 'E'], when: { all: [{ fact: 'otherSavings', has: 'none' }, { fact: 'studyFund', in: ['depositing', 'notDepositing'] }] }, text: 'ציינתם שאין לכם חסכונות נוספים, וגם שיש לכם קרן השתלמות.' },
    ],

    // ----- the result screen -----
    result: {
      title: 'מה עלה מהתשובות שלכם',
      subtitle: 'לפי התשובות שלכם, אלה הנושאים שכדאי לתת להם תשומת לב.',
      findingsLead: (n) => `${n === 1 ? 'נקודה אחת' : n === 2 ? 'שתי נקודות' : 'שלוש נקודות'} ש${n === 1 ? 'נוגעת' : 'נוגעות'} למצב שלכם, לפי הכללים של {year}. את רובן אפשר לבדוק גם לבד, והצעדים מופיעים בהמשך.`,
      stepsTitle: 'מה אפשר לעשות כבר היום, לבד',
      callsLead: 'שיחת התאמה קצרה, ללא עלות וללא התחייבות. על מה נדבר:',
      mapSummary: 'מפת הנושאים: איך המצפן דירג את מה שסיפרתם',
      limitedNote: 'בחלק גדול מהשאלות עניתם שאינכם יודעים, ולכן זה אבחון מוגבל. זה בסדר גמור: זו בדיוק נקודת ההתחלה של מיפוי.',
      primaryPrefix: 'העדיפות המרכזית שלכם:',
      mapTitle: 'מפת הנושאים',
      mapNote: 'הציון מראה עד כמה כדאי לבדוק כל נושא, לפי מה שסיפרתם. הוא לא מדרג את המצב הכלכלי שלכם.',
      complementTitle: 'עוד שני נושאים שעלו',
      checksTitle: 'מה כדאי לבדוק?',
      missingTitle: 'מה להכין לשיחה',
      missingIntro: 'כדי שהשיחה תהיה קצרה ומדויקת, כדאי לברר או להביא:',
      cannotTell: 'על בסיס המידע שמסרתם, עדיין אי אפשר לדעת אם מדובר בפער אמיתי. כדאי לבדוק זאת בשיחה מקצועית.',
      contradictionsIntro: 'שתי תשובות שכדאי לברר:',
      noDocuments: 'האבחון נשען רק על מה שסיפרתם. לא נבדקו מסמכים או דוחות.',
      inviteTitle: 'רוצים לעבור על זה עם רועי?',
      inviteText: 'אני רועי רומנו, מתכנן פיננסי וסוכן פנסיוני. בשיחת התאמה נוכל לעבור על הצרכים שעלו ולבחון אם יש מקום לבדיקה מקצועית מעמיקה יותר.',
      inviteButton: 'לתיאום שיחת התאמה אישית עם רועי',
      whatsappButton: 'לשלוח לרועי בוואטסאפ',
      numbersButton: 'אני רוצה להבין את המספרים שלי',
      numbersNote: 'מחשבון הטבות המס לעצמאים: הפקדות לפנסיה ולקרן השתלמות.',
      disclaimer: 'המצפן מציג אבחון צרכים ראשוני בלבד, על סמך דיווח עצמי. הוא אינו ייעוץ פנסיוני, ייעוץ מס או המלצה על מוצר, חברה מנהלת, מסלול או סכום הפקדה. בדיקה מקצועית נעשית מול הנתונים והמסמכים שלכם.',

      // ----- what the visitor gets back: findings in shekels, steps for today, and what the call covers -----
      // Shown in order, the first `limits.maxFindings` that hold; the one with a figure goes to the gold tile.
      // Every figure comes from regulatory.js through the tokens below, and a finding whose figures are not
      // verified for the year is dropped (needs). General information only: never a product, track or company.
      // Tokens: {mandMax} {mandMonthly} {half} {avgYear} {tier1} {tier2} {sfRate} {sfCap} {sfMax}
      // {sfExempt} {sfYou} {sfFigure} {benefitCap} {ifCap} {days} {daysText} {lumpEx} {bonds} {general} {stocks} {period}
      findings: [
        {
          id: 'horizon-short', tag: 'טווח קצר',
          when: { fact: 'horizon', is: 'y1' },
          title: 'כסף שיידרש בקרוב צריך כללים אחרים',
          text: 'כשהכסף עשוי להידרש בתוך שנה, השאלה הראשונה היא נזילות ותנודתיות, לא תשואה. ירידה בשווקים ממש לפני מועד השימוש עלולה לשבש את התוכנית.',
          call: 'איך לשמור על הכסף זמין ויציב לקראת המועד שבו יידרש',
        },
        {
          id: 'obligation-full', tag: 'חובת ההפקדה',
          needs: ['averageWageMonthly', 'mandatoryContributionRates.tier1Rate', 'mandatoryContributionRates.tier2Rate'],
          when: { all: [{ fact: 'income', in: ['b2', 'b3'] }, { not: { fact: 'age', is: '60p' } }, { not: { fact: 'yearsActive', is: 'lt6m' } },
            { any: [{ priority: 'minimum' }, { priority: 'tax' }, { priority: 'liquidity' }, { fact: 'deposits', in: ['none', 'irregular', 'annual', 'unknown'] }, { fact: 'obligationKnown', in: ['no', 'unsure'] }] }] },
          title: 'זו ההפקדה שהחוק מחייב אתכם השנה',
          text: 'החובה מחושבת עד השכר הממוצע במשק בלבד: {tier1}% על ההכנסה עד {half} ₪ בשנה, ו־{tier2}% על החלק שמעליה ועד {avgYear} ₪. בהכנסה כמו שציינתם זו ההפקדה המרבית לפי החובה, כ־{mandMonthly} ₪ לחודש, והיא צריכה להיכנס באותה שנת מס.',
          figure: { value: '{mandMax} ₪', caption: 'חובת ההפקדה לפנסיה ב־2026, בהכנסה חייבת מעל {avgYear} ₪ בשנה' },
          call: 'אם ההפקדות של השנה כבר עומדות בחובה, ומה חסר עד 31.12',
        },
        {
          id: 'obligation-partial', tag: 'חובת ההפקדה',
          needs: ['averageWageMonthly', 'mandatoryContributionRates.tier1Rate', 'mandatoryContributionRates.tier2Rate'],
          when: { all: [{ any: [{ fact: 'income', in: ['b1', 'unknown'] }, { fact: 'income', asked: false }] }, { not: { fact: 'age', is: '60p' } }, { not: { fact: 'yearsActive', is: 'lt6m' } },
            { any: [{ priority: 'minimum' }, { priority: 'tax' }, { priority: 'liquidity' }, { fact: 'deposits', in: ['none', 'irregular', 'annual', 'unknown'] }, { fact: 'obligationKnown', in: ['no', 'unsure'] }] }] },
          title: 'כמה להפקיד השנה: לפי ההכנסה החייבת שלכם',
          text: 'מצאו בטבלה את ההכנסה הקרובה לשלכם. זה הסכום השנתי שהחוק מחייב להפקיד לפנסיה: {tier1}% על ההכנסה עד {half} ₪, ו־{tier2}% על החלק שמעליה ועד {avgYear} ₪. על הכנסה מעל {avgYear} ₪ אין חובה נוספת. ההפקדה צריכה להיכנס עד 31.12.',
          figure: { kind: 'obligation', head: ['הכנסה חייבת בשנה', 'חובת ההפקדה בשנה'], caption: 'חובת ההפקדה לפנסיה לעצמאים ב־{year}.' },
          call: 'כמה בדיוק החובה לפי ההכנסה שלכם, ואם היא כבר מולאה השנה',
        },
        {
          id: 'obligation-third', tag: 'לא הכול ננעל',
          when: { any: [{ fact: 'minReason', in: ['business', 'cantAfford'] }, { fact: 'pensionDislike', is: 'liquidity' }, { fact: 'liqReason', in: ['business', 'fearLock'] }] },
          title: 'שליש מהפקדת החובה לא ננעל עד הפרישה',
          text: 'שליש מההפקדה לפי החוק נשמר לסיוע במצבי אבטלה. אפשר למשוך אותו בסגירת עסק, בפטור ממס ובכפוף לתנאים שבחוק. מי שלא מושך, הסכום מצטרף לקצבה.',
          call: 'איך החובה משתלבת עם הצורך בכסף זמין לעסק',
        },
        {
          id: 'annual-deposit', tag: 'הפקדה שנתית',
          when: { fact: 'deposits', is: 'annual' },
          title: 'הפקדה שנתית נחשבת רק אם נקלטה באותה שנה',
          text: 'הפקדה לפנסיה נחשבת לשנת המס, גם לעניין החובה וגם לעניין הטבת המס, רק אם נקלטה בקופה עד 31.12. כדאי לא להשאיר אותה לימים האחרונים של דצמבר.',
          variants: [{ when: { monthAtLeast: 11 }, text: 'הפקדה לפנסיה נחשבת לשנת המס, גם לעניין החובה וגם לעניין הטבת המס, רק אם נקלטה בקופה עד 31.12, {daysText}. כדאי לא להשאיר אותה לימים האחרונים של דצמבר.' }],
          call: 'מתי ואיך להפקיד השנה כדי שההפקדה תיחשב ל־2026',
        },
        {
          id: 'study-fund', tag: 'קרן השתלמות',
          needs: ['studyFundThresholds.deductionIncomeCap', 'studyFundThresholds.deductionRate', 'studyFundThresholds.exemptDepositCap'],
          when: { all: [{ not: { fact: 'age', is: '60p' } }, { any: [{ fact: 'studyFund', in: ['no', 'notDepositing', 'unknown'] }, { fact: 'studyFundLiquid', is: 'no' }, { all: [{ fact: 'otherSavings', has: 'none' }, { any: [{ priority: 'tax' }, { priority: 'liquidity' }] }] }] }] },
          title: 'קרן השתלמות: ניכוי ממס, וכסף שנזיל אחרי 6 שנים',
          text: 'עצמאים יכולים לנכות ממס הפקדה של עד {sfRate}% מההכנסה, עד הכנסה של {sfCap} ₪. {sfYou} רווחים על הפקדה של עד {sfExempt} ₪ פטורים ממס, והכסף נזיל בדרך כלל אחרי שש שנים.',
          variants: [{ when: { monthAtLeast: 11 }, text: 'עצמאים יכולים לנכות ממס הפקדה של עד {sfRate}% מההכנסה, עד הכנסה של {sfCap} ₪. {sfYou} רווחים על הפקדה של עד {sfExempt} ₪ פטורים ממס, והכסף נזיל בדרך כלל אחרי שש שנים. הפקדה ל־2026 צריכה להיכנס עד 31.12 ({daysText}).' }],
          figure: { value: '{sfFigure}', caption: 'הניכוי האפשרי ממס בהפקדה לקרן השתלמות ב־2026, לפי טווח ההכנסה שציינתם' },
          call: 'כמה אפשר להפקיד לקרן השתלמות, ומה ההטבה בשקלים',
        },
        {
          id: 'above-average', tag: 'מעל השכר הממוצע',
          needs: ['averageWageMonthly', 'pensionContributionThresholds.taxBenefitIncomeCap'],
          when: { all: [{ fact: 'income', in: ['b2', 'b3'] }, { any: [{ priority: 'pension' }, { priority: 'tax' }, { fact: 'taxVsMinimum', in: ['yes', 'maybe'] }] }] },
          title: 'החובה מכסה רק עד השכר הממוצע',
          text: 'על ההכנסה שמעל {avgYear} ₪ בשנה אין חובת הפקדה, ולכן מי שמרוויח יותר ומפקיד רק את המינימום חוסך על חלק מהכנסתו בלבד, וההפרש יורגש בקצבה. הפקדה מעבר לחובה מזכה בהטבת מס, עד הכנסה של {benefitCap} ₪ בשנה.',
          call: 'כמה מעבר לחובה מזכה בהטבת מס במקרה שלכם',
        },
        {
          id: 'liquid-growth', tag: 'תשואה לאורך זמן',
          when: { all: [{ fact: 'liquidAmount', in: ['lt50', '50to150', '150to400', '400to1m', 'gt1m'] }, { not: { fact: 'horizon', is: 'y1' } }] },
          title: 'מה עשו 7 השנים האחרונות ל־{lumpEx} ₪',
          text: 'סכום של {lumpEx} ₪ שנשאר בעו"ש לפני 7 שנים שווה היום אותו דבר. בקופות גמל להשקעה, לפי התשואה הממוצעת של כל מסלול, הוא היה מגיע לכ־{bonds} ₪ במסלול סולידי, {general} ₪ במסלול בסיכון בינוני ו־{stocks} ₪ במסלול בסיכון גבוה. מסלול עם יותר מניות עלה יותר לאורך זמן, אבל גם ירד יותר בדרך.',
          figure: { kind: 'growth', caption: 'סכום של {lumpEx} ₪ לפני 7 שנים. ממוצע קופות הגמל להשקעה בכל מסלול עד {period}, לפני דמי ניהול ובלי התאמה לאינפלציה. תשואות עבר אינן מעידות על תשואות בעתיד.' },
          call: 'כמה מהסכום הנזיל צריך להישאר זמין, ואיזו רמת סיכון מתאימה לשאר',
        },
        {
          id: 'investment-fund', tag: 'נזיל ועם הטבה',
          needs: ['investmentFundCap'],
          when: { any: [{ all: [{ primary: 'liquidity' }, { not: { fact: 'horizon', is: 'y1' } }] }, { fact: 'minReason', is: 'investSelf' }, { fact: 'pensionDislike', in: ['liquidity', 'control'] }, { fact: 'liqReason', is: 'investSelf' }] },
          title: 'קופת גמל להשקעה: נזילה, ומגיל 60 קצבה פטורה ממס',
          text: 'בקופת גמל להשקעה הכסף נזיל בכל עת, ובמשיכה משלמים עד 25% מהרווח הריאלי. מי שמושך מגיל 60 כקצבה פטור ממס על כל הרווחים, ומעבר בין מסלולים או בין חברות לא נחשב אירוע מס. אפשר להפקיד עד {ifCap} ₪ בשנה, בכל הקופות יחד.',
          call: 'איך לחלק בין כסף זמין, חיסכון לטווח ארוך והפקדת החובה',
        },
        {
          id: 'retirement-report', tag: 'הקצבה הצפויה',
          when: { any: [{ fact: 'expectedPension', in: ['notChecked', 'noIdea'] }, { fact: 'wantToUnderstand', in: ['pensionAmount', 'enough'] }] },
          title: 'הקצבה בדוח השנתי היא נקודת פתיחה, לא תחזית אישית',
          text: 'הקצבה הצפויה בדוח השנתי מחושבת לפי הנחות ברירת מחדל. הקצבה בפועל יכולה להיות שונה ממנו.',
          call: 'חישוב הקצבה הצפויה לפי המצב האישי שלכם, לא לפי הנחות ברירת המחדל',
        },
        {
          id: 'pension-low', tag: 'הקצבה',
          when: { fact: 'expectedPension', is: 'low' },
          title: 'מה קובע את גובה הקצבה',
          text: 'גובה הקצבה נקבע מגובה ההפקדות ומהרציפות שלהן, מדמי הניהול, ממסלול ההשקעה וממקדם ההמרה בפרישה. שינוי באחד מהם, גם קטן, מצטבר לאורך השנים שנותרו עד הפרישה.',
          call: 'מה משפיע על הקצבה שלכם, ומה אפשר לשנות',
        },
        {
          id: 'pension-assumes', tag: 'הדוח השנתי',
          when: { fact: 'expectedPension', is: 'satisfied' },
          title: 'הקצבה בדוח מניחה שההפקדות יימשכו',
          text: 'הקצבה הצפויה בדוח השנתי מחושבת בהנחה שההפקדות יימשכו עד הפרישה באותו קצב. הפסקה או ירידה בהפקדות, למשל בשנה חלשה בעסק, מקטינות אותה.',
          call: 'מה קורה לקצבה אם ההפקדות משתנות',
        },
        {
          id: 'managers-factor', tag: 'ביטוח מנהלים',
          when: { fact: 'product', in: ['managers', 'several'] },
          title: 'בביטוח מנהלים, מקדם ההמרה הוא נתון מפתח',
          text: 'מקדם ההמרה קובע כמה קצבה תקבלו על כל שקל שנצבר. בפוליסות ישנות הוא נקבע לעיתים כבר בהצטרפות, ובחדשות רק בפרישה. זה נתון שכדאי להכיר לפני כל שינוי בפוליסה.',
          call: 'מה מקדם ההמרה בפוליסה שלכם, ומה המשמעות שלו',
        },
        {
          id: 'disability', tag: 'אם לא תוכלו לעבוד',
          when: { any: [{ fact: 'altIncome', in: ['no', 'partial'] }, { fact: 'worry', in: ['income', 'both'] }] },
          title: 'לעצמאים אין מעסיק שימשיך לשלם',
          text: 'בקרן פנסיה יש בדרך כלל כיסוי לנכות של עד 75% מההכנסה המבוטחת, וביטוח אובדן כושר עבודה פרטי יכול להשלים אותו. כדאי לדעת כמה תקבלו בפועל אם לא תוכלו לעבוד, ומאיזה חודש.',
          call: 'כמה הכנסה תקבלו אם לא תוכלו לעבוד, ומאיפה',
        },
        {
          id: 'gemel-no-cover', tag: 'קופת גמל',
          when: { fact: 'product', is: 'gemel' },
          title: 'בקופת גמל אין כיסוי ביטוחי',
          text: 'בשונה מקרן פנסיה, בקופת גמל אין כיסוי לנכות ולשארים. מי שחוסך לפרישה רק בה כדאי שיידע איך הוא מבוטח למקרה שלא יוכל לעבוד, ומה יקבלו בני המשפחה.',
          call: 'איך אתם מבוטחים היום לנכות ולשארים',
        },
        {
          id: 'compare-yields', tag: 'השוואה',
          when: { fact: 'wantToUnderstand', in: ['manage', 'all'] },
          title: 'שווה לבדוק איפה הקופה שלכם עומדת',
          text: 'קופות באותו מסלול יכולות להשיג תשואות שונות מאוד לאורך זמן. באתר אפשר לראות את התשואות של כל החברות לתקופות שונות, לפי הנתונים הרשמיים.',
          call: 'איך הקופה שלכם ביצעה מול מסלולים דומים',
        },
        {
          id: 'young-time', tag: 'הזמן עובד בשבילכם',
          when: { all: [{ fact: 'age', in: ['u30', '30s'] }, { fact: 'deposits', in: ['irregular', 'annual', 'none'] }] },
          title: 'הפקדה היום שווה יותר מהפקדה בעוד 20 שנה',
          text: 'לכסף שמופקד בגיל צעיר יש עשרות שנים לצבור תשואה עד הפרישה. לכן הפקדות סדירות עכשיו משפיעות על הקצבה יותר מהפקדות גדולות מאוחר יותר.',
          call: 'איזה קצב הפקדה מתאים לכם היום',
        },
        {
          id: 'coverage-deposit', tag: 'ביטוח בקרן הפנסיה',
          when: { any: [{ fact: 'coverageImpact', in: ['no', 'unaware'] }, { all: [{ priority: 'protection' }, { fact: 'deposits', in: ['irregular', 'annual', 'none'] }] }] },
          title: 'גובה ההפקדה קובע גם את הכיסוי',
          text: 'בקרן פנסיה, הכיסוי לנכות ולשארים נקבע לפי ההכנסה שממנה מפקידים. הפקדה נמוכה מקטינה גם את הכיסוי, וכשאין הפקדות הכיסוי נמשך זמן מוגבל בלבד.',
          call: 'מה הכיסוי שיש לכם היום בקרן, ואם הוא מתאים להכנסה',
        },
        {
          id: 'see-everything', tag: 'בדיקה עצמית',
          when: { any: [{ fact: 'product', is: 'noIdea' }, { fact: 'accumulated', is: 'no' }, { fact: 'coverageKnown', in: ['no', 'partial', 'none'] }, { fact: 'worry', is: 'unknownCover' }, { fact: 'deposits', is: 'unknown' }, { unknownCount: { atLeast: 3 } }] },
          title: 'את כל מה שעל שמכם אפשר לראות בחינם',
          text: 'באתר הממשלתי לאיתור חסכונות רואים את כל קופות הפנסיה, הגמל וההשתלמות על שמכם, ובהר הביטוח את כל הפוליסות. בשניהם נכנסים בהזדהות אישית, וזה לוקח כמה דקות.',
          call: 'לעבור יחד על מה שמצאתם, או להפיק בהסכמתכם דוח מלא מהמסלקה הפנסיונית',
        },
        {
          id: 'beneficiaries', tag: 'מוטבים',
          when: { any: [{ fact: 'dependents', in: ['yes', 'partial'] }, { fact: 'family', in: ['partner', 'divorced', 'widowed'] }] },
          title: 'מוטבים לא מתעדכנים מעצמם',
          text: 'אחרי חתונה, לידה או פרידה כדאי לבדוק מי רשום כמוטב בקופות ובפוליסות, ואם סכום ביטוח החיים מתאים למי שתלוי בהכנסה שלכם.',
          call: 'בדיקת המוטבים והכיסוי למשפחה',
        },
        {
          id: 'employee-too', tag: 'גם שכירים',
          when: { fact: 'employee', is: 'yes' },
          title: 'משכורת וגם עסק: שתי בדיקות',
          text: 'ההפקדות דרך המעסיק לא פוטרות מחובת ההפקדה על ההכנסה מהעסק, וחישוב הטבות המס תלוי בשני מקורות ההכנסה יחד.',
          call: 'בדיקת ההפקדות משני מקורות ההכנסה',
        },
        {
          id: 'portfolio-tax', tag: 'מס על השקעות',
          when: { fact: 'investWhere', has: 'market' },
          title: 'בתיק רגיל, כל שינוי עולה מס',
          text: 'מי שמחזיק קרנות נאמנות או ניירות ערך בחשבון רגיל משלם מס על הרווח בכל מכירה. בקופת גמל להשקעה, מעבר בין מסלולים או בין חברות לא נחשב מכירה, והמס נדחה עד המשיכה.',
          call: 'ההבדל במיסוי בין תיק רגיל לבין קופת גמל להשקעה',
        },
        {
          id: 'pension-fees', tag: 'דמי ניהול',
          when: { fact: 'pensionDislike', is: 'fees' },
          title: 'בפנסיה יש שני סוגי דמי ניהול',
          text: 'בקרן פנסיה גובים דמי ניהול מכל הפקדה, עד 6%, ומהכסף שכבר נצבר, עד 0.5% בשנה. הפרש קטן בדמי הניהול מהצבירה מצטבר לאורך השנים לסכום משמעותי בקצבה.',
          call: 'כמה דמי ניהול משלמים היום, ובאיזה מסלול נמצא הכסף',
        },
        {
          id: 'default-track', tag: 'מסלול השקעה',
          when: { fact: 'lastReview', in: ['never', 'fewYears', 'notRemember'] },
          title: 'בלי בחירה, הכסף במסלול לפי גיל',
          text: 'מי שלא בחר מסלול השקעה מצורף בדרך כלל למסלול לפי הגיל. כדאי לוודא שהמסלול ודמי הניהול עדיין מתאימים, במיוחד כשהבדיקה האחרונה הייתה לפני כמה שנים.',
          call: 'בדיקת המסלול ודמי הניהול',
        },
        {
          id: 'existing-money', tag: 'מה שכבר נצבר',
          when: null,
          title: 'גם הכסף שכבר נצבר צריך בדיקה',
          text: 'מעבר להחלטות על הפקדות חדשות, דמי הניהול והמסלול בפנסיה ובקופות הקיימות משפיעים בכל שנה על הכסף שכבר נצבר. זו בדיקה שלא דורשת להפקיד שקל.',
          call: 'בדיקת דמי הניהול והמסלולים בחסכונות הקיימים',
        },
        {
          id: 'yearly-check', tag: 'בדיקה שנתית',
          when: null,
          title: 'שלוש בדיקות שכדאי לעשות פעם בשנה',
          text: 'שההפקדות של השנה עומדות בחובה ונקלטו עד 31.12, שהכיסוי הביטוחי מתאים להכנסה של היום, ושהמוטבים רשומים נכון. את שלושתן אפשר לבדוק מול הדוח השנתי של הקופה.',
          call: 'בדיקה שנתית של ההפקדות, הכיסוי והמוטבים',
        },
      ],

      // What can be done today, alone. Up to `limits.maxSteps`, in this order. Links open in a new tab.
      steps: [
        { id: 'calc', when: { any: [{ priority: 'tax' }, { priority: 'minimum' }, { fact: 'income', in: ['b1', 'b2', 'b3'] }] }, text: 'לחשב בשקלים כמה שווה לכם ההפקדה', label: 'מחשבון הטבות המס לעצמאים', href: '/self-employed-tax-calculator/' },
        { id: 'gov', when: { any: [{ fact: 'product', is: 'noIdea' }, { fact: 'accumulated', is: 'no' }, { fact: 'deposits', is: 'unknown' }, { fact: 'expectedPension', in: ['notChecked', 'noIdea'] }, { priority: 'unsure' }, { unknownCount: { atLeast: 2 } }] }, text: 'לבדוק אילו קופות רשומות על שמכם', label: 'איתור חסכונות, gov.il', href: 'https://www.gov.il/he/service/pension_savings_search' },
        { id: 'harb', when: { any: [{ priority: 'protection' }, { fact: 'coverageKnown', in: ['no', 'partial', 'none'] }, { fact: 'worry', is: 'unknownCover' }] }, text: 'לראות את כל הפוליסות על שמכם', label: 'הר הביטוח, רשות שוק ההון', href: 'https://harb.cma.gov.il/' },
        { id: 'study', when: { any: [{ fact: 'studyFund', in: ['no', 'notDepositing', 'unknown'] }, { fact: 'studyFundLiquid', is: 'no' }] }, text: 'לבדוק כמה להפקיד לקרן השתלמות השנה', label: 'בדיקת קרן השתלמות לעצמאים', href: '/study-fund' },
        { id: 'guide', when: { any: [{ priority: 'minimum' }, { priority: 'tax' }, { fact: 'obligationKnown', in: ['no', 'unsure'] }, { fact: 'deposits', in: ['none', 'irregular', 'annual'] }] }, text: 'לקרוא כמה חובה להפקיד ומה לבדוק לפני סוף השנה', label: 'המדריך לעצמאים', href: '/self-employed' },
        { id: 'fund', when: { any: [{ priority: 'liquidity' }, { fact: 'minReason', is: 'investSelf' }, { fact: 'liquidAmount', in: ['lt50', '50to150', '150to400', '400to1m', 'gt1m'] }] }, text: 'להבין איך עובדת קופת גמל להשקעה', label: 'המדריך לקופת גמל להשקעה', href: '/investment-fund' },
        { id: 'yields', when: { any: [{ priority: 'liquidity' }, { fact: 'wantToUnderstand', in: ['manage', 'all'] }, { fact: 'pensionDislike', in: ['fees', 'trust'] }, { fact: 'liquidAmount', in: ['lt50', '50to150', '150to400', '400to1m', 'gt1m'] }] }, text: 'להשוות תשואות בין החברות', label: 'תשואות קופות ונתוני שוק', href: '/market-data' },
        { id: 'knowledge', when: null, text: 'לקרוא עוד לפני השיחה', label: 'כל המדריכים והכלים', href: '/knowledge' },
      ],
      callTail: 'וכל שאלה אחרת שעלתה לכם',

      // Section ב: the explanation for the main priority, plus sentences that fit the answers.
      explain: {
        A: {
          base: 'התשובות שלכם מצביעות על כך שהכנסה מספקת בפרישה היא יעד משמעותי עבורכם. כדי להבין אם אתם בדרך ליעד, כדאי לבדוק את החיסכון הקיים, את ההפקדות ואת הקצבה הצפויה, לצד מקורות הכנסה נוספים.',
          adds: [
            { when: { all: [{ fact: 'age', in: ['50s', '60p'] }, { fact: 'expectedPension', in: ['notChecked', 'noIdea'] }] }, text: 'מכיוון שאתם מעל גיל 50 ועדיין לא יודעים מה הקצבה הצפויה, הצעד הראשון הוא בדיקת מוכנות לפרישה.' },
            { when: { all: [{ fact: 'age', in: ['u30', '30s'] }, { fact: 'deposits', in: ['irregular', 'annual', 'none'] }] }, text: 'בגיל שלכם, לשיעור החיסכון לאורך זמן יש השפעה גדולה, ולכן כדאי לבחון אותו כבר עכשיו.' },
            { when: { any: [{ fact: 'pensionVsLiquidity', in: ['liquid', 'both'] }, { priority: 'liquidity' }] }, text: 'ציינתם שחשוב לכם גם כסף נזיל, ולכן כדאי לבחון את האיזון בין חיסכון לפרישה לבין חיסכון זמין.' },
          ],
        },
        B: {
          base: 'מהתשובות שלכם עולה שההגנה על ההכנסה ועל המשפחה חשובה לכם במיוחד. כדאי לבחון את הכיסויים הקיימים, את ההכנסה המבוטחת ואת ההתאמה שלהם למצב המשפחתי והכלכלי שלכם.',
          adds: [
            { when: { fact: 'dependents', in: ['yes', 'partial'] }, text: 'כשיש מי שתלוי בהכנסה שלכם, יש משקל מיוחד לבחינת ההגנה על המשפחה.' },
            { when: { fact: 'coverageKnown', in: ['no', 'partial', 'none'] }, text: 'בלי לראות את הפוליסות ואת הדוחות עצמם, אי אפשר לדעת אם הכיסוי הקיים מתאים לצרכים.' },
          ],
        },
        C: {
          base: 'נראה שכדאי לבדוק את ניצול הטבות המס שלכם בחיסכון הפנסיוני ובקרן ההשתלמות. החישוב תלוי, בין היתר, בהכנסה החייבת, בהפקדות שבוצעו ובזכאות האישית שלכם.',
          adds: [
            { when: { fact: 'employee', is: 'yes' }, text: 'מכיוון שיש לכם גם משכורת, ההפקדות דרכה עשויות להשפיע על החישוב, וצריך לבדוק את שני מקורות ההכנסה יחד.' },
            { when: { any: [{ priority: 'liquidity' }, { fact: 'taxVsLiquidity', in: ['liquid', 'both'] }] }, text: 'ציינתם שחשובה לכם גם נזילות, ולכן כדאי לבחון יחד את ההטבה במס ואת הזמינות של הכסף.' },
            { text: 'את גובה ההטבה בפועל אפשר לחשב רק מול הנתונים האישיים, כולל ההבדל בין ניכוי לזיכוי וחבות המס שלכם.' },
          ],
        },
        D: {
          base: 'מהתשובות שלכם עולה שאתם מעדיפים לצמצם את ההפקדה הפנסיונית ולשמור על גמישות כלכלית. כדאי לבדוק את חובת ההפקדה האישית שלכם, ואת המשמעות של הפקדת מינימום לחיסכון לפרישה, לכיסוי הביטוחי ולהטבות המס.',
          adds: [
            { when: { fact: 'minReason', is: 'cantAfford' }, text: 'ציינתם שכרגע אין אפשרות להפקיד יותר. זה מצב לגיטימי, וכדאי לדעת מה הסכום שהחוק מחייב ומה המשמעות שלו.' },
            { when: { fact: 'minReason', in: ['business', 'investSelf'] }, text: 'הפקדת מינימום אינה בהכרח טעות. השאלה היא אם החלוקה בין הכסף בעסק או בהשקעות לבין החיסכון לפרישה מתאימה למטרות שלכם.' },
            { when: { fact: 'employee', is: 'yes' }, text: 'מכיוון שיש לכם גם משכורת, את החובה צריך לבדוק לפי שני מקורות ההכנסה.' },
          ],
        },
        E: {
          base: 'התשובות שלכם מצביעות על כך שגמישות ושליטה בכסף הן עדיפויות מרכזיות עבורכם. כדאי לבחון את החלוקה בין כספים שצריכים להישאר זמינים לבין חסכונות לטווח ארוך, תוך התחשבות בחובת ההפקדה הפנסיונית.',
          adds: [
            { when: { fact: 'horizon', in: ['y1', 'y1to3'] }, text: 'מכיוון שתצטרכו את הכסף בטווח קצר, חשוב שהנזילות ורמת הסיכון יתאימו לטווח הזה.' },
            { when: { fact: 'deposits', in: ['none', 'unknown'] }, text: 'לפני שמחליטים להעדיף כסף נזיל על פני חיסכון פנסיוני, כדאי לבדוק אם חלה עליכם חובת הפקדה.' },
          ],
        },
        F: {
          base: 'מהתשובות שלכם עולה שכדאי להתחיל במיפוי התמונה הפנסיונית והפיננסית. מטרת הבדיקה היא להבין מה קיים היום, אילו זכויות וכיסויים יש לכם, והאם החיסכון מתאים למטרות שלכם.',
          adds: [
            { when: { primary: 'unsure' }, text: 'רואה החשבון והמתכנן הפיננסי ממלאים תפקידים שונים ומשלימים. מיפוי כזה מוסיף לתמונה שכבר יש לכם, ולא בא במקומה.' },
          ],
        },
      },

      // Section ג: one line under each of the two further topics. Falls back to the strongest reason in the score.
      complement: {
        A: 'כדאי לבדוק אם החיסכון וההפקדות מובילים לקצבה שתתאים לכם.',
        B: 'כדאי לבחון אילו כיסויים יש לכם היום, ואם הם מתאימים להכנסה ולמשפחה.',
        C: 'כדאי לבדוק אם ההפקדות לפנסיה ולקרן השתלמות מנוצלות לטובתכם בשנת המס.',
        D: 'כדאי לבדוק אם חלה עליכם חובת הפקדה, ובאיזה סכום.',
        E: 'כדאי לבחון את החלוקה בין כסף זמין לבין חיסכון לטווח ארוך.',
        F: 'כדאי להתחיל מרשימה מסודרת של המוצרים, הצבירות והכיסויים.',
      },

      // Section ד: concrete checks, at most three on screen.
      checks: {
        A: [
          { when: { fact: 'age', in: ['50s', '60p'] }, text: 'מה צריך לבדוק עכשיו, כשהפרישה מתקרבת: הקצבה הצפויה, מקורות ההכנסה ומועד הפרישה.' },
          { text: 'איזו קצבה חודשית צפויה לכם לפי הדוחות האחרונים, ואיך היא משתנה אם ההפקדות משתנות?' },
          { text: 'האם קצב החיסכון היום מתאים ליעד שלכם לפרישה?' },
        ],
        B: [
          { text: 'אילו כיסויים יש לכם היום, למשל בקרן הפנסיה, בביטוח לאובדן כושר עבודה ובביטוח חיים?' },
          { when: { fact: 'dependents', in: ['yes', 'partial'] }, text: 'האם ההגנה למשפחה מתאימה למי שתלוי בהכנסה שלכם?' },
          { text: 'האם ההכנסה המבוטחת מתאימה להכנסה שלכם בפועל?' },
        ],
        C: [
          { text: 'כמה הפקדתם השנה לפנסיה ולקרן השתלמות, ומה עוד אפשר להפקיד עד סוף שנת המס?' },
          { when: { fact: 'employee', is: 'yes' }, text: 'איך ההפקדות דרך המשכורת משתלבות בחישוב כעצמאים?' },
          { text: 'האם ההפקדות מתאימות לחבות המס שלכם, בין ניכוי לזיכוי?' },
        ],
        D: [
          { text: 'מהו הסכום שאתם מחויבים להפקיד לחיסכון פנסיוני השנה, לפי ההכנסה שלכם?' },
          { when: { priority: 'minimum' }, text: 'מה המשמעות של הפקדת מינימום לחיסכון לפרישה, לכיסוי הביטוחי ולהטבות המס?' },
          { text: 'האם ההפקדות שכבר בוצעו השנה עומדות בחובה?' },
        ],
        E: [
          { text: 'כמה כסף כדאי לשמור נזיל לצורכי העסק והמשפחה?' },
          { when: { fact: 'horizon', in: ['y1', 'y1to3'] }, text: 'האם הכסף שתצטרכו בקרוב נמצא במקום שמתאים לטווח קצר?' },
          { text: 'האם החלוקה הנוכחית בין החסכונות מתאימה למטרות ולטווחי הזמן שלכם?' },
        ],
        F: [
          { text: 'אילו מוצרים, צבירות וכיסויים יש לכם היום?' },
          { text: 'האם החיסכון מתאים למטרות שלכם?' },
          { text: 'מי רשומים כמוטבים, והאם זה עדיין נכון?' },
        ],
      },

      // Section ה: what is still missing. A fact counts as missing when it was not asked, skipped or answered "don't know".
      missingFacts: [
        { fact: 'expectedPension', areas: ['A'], text: 'הקצבה הצפויה לפי הדוח השנתי' },
        { fact: 'deposits', areas: ['A', 'C', 'D'], text: 'אם ואיך אתם מפקידים היום לחיסכון פנסיוני' },
        { fact: 'income', areas: ['C', 'D'], text: 'ההכנסה החייבת המשוערת' },
        { fact: 'employee', areas: ['C', 'D'], text: 'אם יש לכם גם הכנסה ממשכורת' },
        { fact: 'yearsActive', areas: ['D'], text: 'ממתי אתם עצמאים' },
        { fact: 'coverageKnown', areas: ['B'], text: 'אילו כיסויים ביטוחיים יש לכם היום' },
        { fact: 'dependents', areas: ['B'], text: 'מי תלוי בהכנסה שלכם' },
        { fact: 'altIncome', areas: ['B'], text: 'מקורות הכנסה חלופיים אם לא תוכלו לעבוד' },
        { fact: 'studyFund', areas: ['C'], text: 'מצב קרן ההשתלמות' },
        { fact: 'liquidSavings', areas: ['E'], text: 'החסכונות הנזילים שלכם' },
        { fact: 'horizon', areas: ['E'], text: 'מתי תצטרכו את הכסף' },
        { fact: 'product', areas: ['F'], text: 'באילו מוצרים אתם חוסכים' },
        { fact: 'accumulated', areas: ['A', 'F'], text: 'כמה כבר צברתם' },
        { fact: 'age', areas: ['A', 'D'], text: 'טווח הגיל שלכם' },
      ],
      documents: {
        A: 'הדוחות השנתיים מהקופות, כולל הצבירה והקצבה הצפויה',
        B: 'פוליסות הביטוח והכיסויים שבקרן הפנסיה',
        C: 'אישורי ההפקדות לשנת המס',
        D: 'ההכנסה מהעסק וההפקדות שבוצעו השנה',
        E: 'פירוט החסכונות הנזילים וטווחי הזמן שלהם',
        F: 'ריכוז של כל המוצרים, למשל דרך שירות איתור החסכונות של רשות שוק ההון',
      },
    },

    // ----- the internal summary for Roei (section 19) -----
    summary: {
      title: 'סיכום ליד, המצפן הפיננסי לעצמאים',
      selfReported: 'כל הנתונים מבוססים על דיווח עצמי של הפונה ולא אומתו מול מסמכים.',
      urgency: [
        { level: 'גבוהה יחסית', when: { all: [{ fact: 'age', in: ['50s', '60p'] }, { score: { area: 'A', atLeast: 50 } }] }, text: 'הפרישה מתקרבת והקצבה הצפויה לא נבדקה או נמוכה' },
        { level: 'גבוהה יחסית', when: { all: [{ fact: 'dependents', in: ['yes', 'partial'] }, { fact: 'coverageKnown', in: ['no', 'partial', 'none'] }] }, text: 'יש תלויים בהכנסה, והכיסוי הקיים לא ידוע' },
        { level: 'לפני סוף שנת המס', when: { all: [{ fact: 'deposits', in: ['none', 'unknown', 'irregular'] }, { score: { area: 'D', atLeast: 25 } }] }, text: 'ייתכן שחלה חובת הפקדה לשנת המס הנוכחית' },
        { level: 'לפני סוף שנת המס', when: { all: [{ score: { area: 'C', atLeast: 40 } }, { monthAtLeast: 10 }] }, text: 'הפקדות עם הטבת מס נבדקות מול 31.12' },
      ],
      urgencyUnknown: 'אי אפשר לקבוע מהמידע שנמסר',
      opening: {
        A: [
          { when: { all: [{ priority: 'pension' }, { fact: 'age', in: ['50s', '60p'] }] }, text: 'ראיתי שהפרישה מתקרבת ושחשוב לכם להגיע אליה עם הכנסה מספקת. בואו נתחיל מהדוח השנתי האחרון: מה הקצבה הצפויה שמופיעה בו?' },
          { when: { priority: 'pension' }, text: 'ראיתי שחשוב לכם להגיע לפרישה עם הכנסה מספקת. מה הייתם רוצים שתהיה ההכנסה החודשית שלכם בפרישה, ומה אתם יודעים על החיסכון היום?' },
          { text: 'בואו נראה יחד מה צפוי לכם בפרישה לפי החיסכון של היום. מה אתם יודעים על הקופות שלכם?' },
        ],
        B: [
          { when: { fact: 'dependents', in: ['yes', 'partial'] }, text: 'ראיתי שיש מי שתלוי בהכנסה שלכם. בואו נעבור יחד על הביטוחים הקיימים ונבין מה קורה להכנסה אם לא תוכלו לעבוד.' },
          { when: { priority: 'protection' }, text: 'ראיתי שההגנה על ההכנסה חשובה לכם. אילו ביטוחים אתם יודעים שיש לכם היום, ואיפה?' },
          { text: 'אילו ביטוחים אתם יודעים שיש לכם היום, ומה קורה להכנסה אם לא תוכלו לעבוד תקופה ארוכה?' },
        ],
        C: [
          { when: { all: [{ priority: 'tax' }, { priority: 'liquidity' }] }, text: 'ראיתי שחשוב לכם לנצל את הטבות המס, אבל גם לשמור על נזילות. בואו נבדוק קודם מה כבר הפקדתם השנה ומה אתם מתכננים לעשות עם הכספים הפנויים.' },
          { when: { priority: 'tax' }, text: 'ראיתי שחשוב לכם לנצל את הטבות המס. בואו נבדוק מה כבר הפקדתם השנה לפנסיה ולקרן השתלמות.' },
          { text: 'בואו נבדוק מה הפקדתם השנה לפנסיה ולקרן השתלמות, ואיך זה משתלב בחבות המס שלכם.' },
        ],
        D: [
          { when: { priority: 'minimum' }, text: 'ראיתי שאתם מעדיפים להפקיד את המינימום. בואו נבדוק קודם מה החוק מחייב אתכם, ואחר כך נבין מה המשמעות של זה לגביכם.' },
          { text: 'בואו נבדוק קודם אם חלה עליכם חובת הפקדה השנה, ובאיזה סכום, ואיך זה מסתדר עם ההכנסה מהעסק.' },
        ],
        E: [
          { when: { fact: 'horizon', in: ['y1', 'y1to3'] }, text: 'ראיתי שתצטרכו חלק מהכסף בשנים הקרובות. בשביל מה, ובערך כמה?' },
          { when: { priority: 'liquidity' }, text: 'ראיתי שהגמישות חשובה לכם. כמה כסף אתם רוצים שיהיה זמין תמיד, ולמה?' },
          { text: 'כמה מהכסף שלכם צריך להישאר זמין, ולאילו צרכים?' },
        ],
        F: [
          { text: 'ראיתי שתרצו לעשות סדר בתמונה. נתחיל ממה שיש: אילו קופות, פוליסות וחסכונות אתם מכירים?' },
        ],
      },
    },

    whatsapp: {
      opening: 'שלום רועי, מילאתי את המצפן הפיננסי באתר שלך.',
      primary: 'הנושא המרכזי שחשוב לי הוא {primary}.',
      more: 'עוד נושאים שעלו: {more}.',
      closing: 'אשמח לשיחת התאמה.',
    },

    // The deterministic safety layer: wording that must never reach a visitor or the summary.
    forbidden: [
      'מובטח', 'מבטיח', 'הבטחה לתשואה', 'תשואה של', 'החזר מס של', 'תחסכו', 'תרוויחו',
      'אינכם מבוטחים', 'אין לכם כיסוי', 'תת ביטוח', 'תת-ביטוח', 'מבוטחים בחסר',
      'מומלץ לרכוש', 'כדאי לכם לעבור', 'חייבים להפקיד לקרן פנסיה', 'עברתם על החוק', 'הפרתם',
      'ייעוץ השקעות אישי', 'ניהול תיקי השקעות', 'ניהול התיק שלכם',
    ],
  };

  root.CompassContent = content;
  if (typeof module !== 'undefined' && module.exports) module.exports = content;
})(typeof globalThis !== 'undefined' ? globalThis : this);
