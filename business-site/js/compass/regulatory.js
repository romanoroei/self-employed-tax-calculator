// The financial compass: regulatory figures per tax year.
// Nothing in the engine hard-codes a threshold, rate or age: it reads them from here.
// Every figure carries its source and the date it was last checked. A figure whose status is not
// 'verified' is never used: the engine falls back to wording that does not depend on it.
// To add a year: copy the latest block, update each value, source and lastVerifiedAt, and set status.
(function (root) {
  'use strict';

  const SOURCES = {
    mofMandatory: { name: 'משרד האוצר, פנסיה חובה לעצמאים', url: 'https://www.gov.il/he/pages/independent-must-pension' },
    kolZchut: { name: 'כל זכות, הפקדות עצמאיות לביטוח פנסיוני', url: 'https://www.kolzchut.org.il/he/הפקדות_עצמאיות_לביטוח_פנסיוני' },
    taxBooklet2026: { name: 'רשות המסים, חוברת הניכויים 2026', url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf' },
    btlAverageWage: { name: 'ביטוח לאומי, שכר ממוצע לפי סעיפים 1 ו־2', url: 'https://www.btl.gov.il/Mediniyut/GeneralData/Pages/%d7%a9%d7%9b%d7%a8%20%d7%9e%d7%9e%d7%95%d7%a6%d7%a2.aspx' },
    btlSelfEmployed: { name: 'ביטוח לאומי, דמי ביטוח לעצמאים', url: 'https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/rates.aspx' },
  };

  // The 2026 figures are the ones published in the guide /self-employed, checked there on 2026-11-07.
  const VERIFIED_2026 = '2026-11-07';
  // Checked again against the source page itself on 2026-11-08.
  const RECHECKED = '2026-11-08';
  const fig = (value, unit, source, note, opts) => Object.assign({ value, unit, source: SOURCES[source], lastVerifiedAt: VERIFIED_2026, status: 'verified', note: note || '' }, opts || {});

  const YEARS = {
    2026: {
      taxYear: 2026,
      effectiveDate: '2026-01-01',
      status: 'verified',
      verificationDate: VERIFIED_2026,
      parameters: {
        averageWageMonthly: fig(13769, '₪ לחודש', 'btlAverageWage', 'השכר הממוצע לפי סעיף 2, מ־1.1.2026', { lastVerifiedAt: RECHECKED }),
        mandatoryContributionRates: {
          tier1Rate: fig(0.0445, 'שיעור', 'mofMandatory', 'על ההכנסה עד מחצית השכר הממוצע'),
          tier2Rate: fig(0.1255, 'שיעור', 'mofMandatory', 'על ההכנסה שמעל המחצית ועד השכר הממוצע'),
        },
        pensionContributionThresholds: {
          taxBenefitIncomeCap: fig(232800, '₪ לשנה', 'kolZchut', 'הכנסה מזכה לעניין הטבת המס על הפקדה לפנסיה (25,608 ₪ = 11%; 11,640 ₪ = 5%)', { lastVerifiedAt: RECHECKED }),
          taxBenefitRate: fig(0.165, 'שיעור', 'taxBooklet2026', 'במדריך: 16.5%. בכל זכות (20.8.2026): ניכוי 11% וזיכוי על 5%. לא בשימוש עד שיוכרע', { status: 'review' }),
          managersInsuranceFirstTier: fig(67743, '₪ לשנה', 'kolZchut', 'הפקדה לקרן פנסיה שאחריה מותר ביטוח מנהלים כרובד שני', { lastVerifiedAt: RECHECKED }),
        },
        studyFundThresholds: {
          deductionIncomeCap: fig(293397, '₪ לשנה', 'taxBooklet2026', 'הכנסה מרבית לניכוי'),
          deductionRate: fig(0.045, 'שיעור', 'taxBooklet2026', 'ניכוי של עד 4.5% מההכנסה'),
          exemptDepositCap: fig(20566, '₪ לשנה', 'taxBooklet2026', 'הפקדה מרבית שרווחיה פטורים ממס'),
        },
        eligibilityRules: {
          obligationMinAge: fig(21, 'גיל', 'mofMandatory', 'החובה חלה מגיל 21'),
          obligationMaxAge: fig(60, 'גיל', 'mofMandatory', 'ועד גיל פרישה מוקדמת'),
          obligationWaitingMonths: fig(6, 'חודשים', 'mofMandatory', 'מהרישום הראשון כעוסק'),
        },
      },
    },
  };

  /** The block for a tax year, or null when there is none or it is not verified. */
  function yearData(taxYear) {
    const y = YEARS[taxYear];
    return y && y.status === 'verified' ? y : null;
  }

  /** A single verified figure by path (e.g. 'eligibilityRules.obligationMaxAge'), or null. */
  function figure(taxYear, pathName) {
    const y = yearData(taxYear);
    if (!y) return null;
    const node = pathName.split('.').reduce((n, k) => (n && n[k] !== undefined ? n[k] : null), y.parameters);
    return node && node.status === 'verified' && typeof node.value === 'number' ? node.value : null;
  }

  const api = { YEARS, SOURCES, yearData, figure };
  root.CompassRegulatory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
