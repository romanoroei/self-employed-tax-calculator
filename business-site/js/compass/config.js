// The financial compass: settings that may change without touching the engine or the texts.
(function (root) {
  'use strict';
  const config = {
    // WhatsApp: the number and the link base the "send to Roei" button uses
    whatsappNumber: '972528089808',
    whatsappBase: 'https://wa.me/',
    // the existing lead pipeline (same endpoints and the same Sheets script as the home page form)
    formspreeUrl: 'https://formspree.io/f/mvzjeykj',
    sheetsUrl: 'https://script.google.com/macros/s/AKfycbwt-mMdDo6fA___Mh57M8085t2bFPiiVpoKhq3j22hNyhqUybEKMp2t9X5RFm6PwlXa3g/exec',
    // the form sends for real only on these hosts; elsewhere (previews, local copies) it shows what would be sent
    productionHosts: ['romanoinvest.co.il', 'www.romanoinvest.co.il'],
    // anonymous totals (functions/api/count.js): a label and a number, nothing else
    countUrl: '/api/count',
    utmSources: ['tiktok', 'instagram', 'facebook', 'google', 'whatsapp', 'email', 'youtube'],
    // progress is kept in this browser only, without contact details, for this many days
    storageKey: 'rr-compass',
    storageDays: 7,
    calculatorUrl: '/self-employed-tax-calculator/',
  };
  root.CompassConfig = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof globalThis !== 'undefined' ? globalThis : this);
