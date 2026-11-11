// /financial-check: settings that may change without touching the questions, the rules or the engine.
export const CONFIG = {
  // the season message: on only when `enabled` and today falls between the two dates (month-day, Israel time)
  season: { enabled: true, from: '11-01', to: '12-31' },
  // partner ids used in campaign links (?ref=partner01). Counters show these by name; any other ref counts as
  // "other". The lead record always carries the ref as it came (cleaned), so a new partner works from day one.
  partners: ['partner01'],
  // where the form posts: our own function (functions/api/lead.js), which forwards to Formspree and Sheets
  leadUrl: '/api/lead',
  // the form sends for real only on these hosts; elsewhere (previews, local copies) it shows what would be sent
  productionHosts: ['romanoinvest.co.il', 'www.romanoinvest.co.il'],
  // anonymous totals (functions/api/count.js): a label and a number, nothing else
  countUrl: '/api/count',
  // progress is kept in this tab only (sessionStorage), never with contact details
  storageKey: 'rr-fcheck',
  siteUrl: 'https://romanoinvest.co.il/',
  pageUrl: 'https://romanoinvest.co.il/financial-check',
  phone: '052-8089808',
};
