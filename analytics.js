(function () {
  'use strict';
  const ID = 'G-9GFDYS61G9';
  const STORAGE_KEY = 'pension-calculator-analytics-consent-v1';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const PATH = '/self-employed-tax-calculator/';
  const EVENTS = new Set(['calculation_complete', 'contact_click', 'contact_email_open', 'contact_email_compose', 'benefit_breakdown_view', 'service_details_open', 'calculator_share']);
  const LOCATIONS = new Set(['comparison', 'page_end', 'footer']);
  const CHANNELS = new Set(['whatsapp', 'phone', 'email']);
  let consent = null, started = false, breakdownVisible = false, breakdownReported = false;
  const banner = document.getElementById('analytics-consent');
  const status = document.getElementById('analytics-consent-status');
  window['ga-disable-' + ID] = true;

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.allowed === 'boolean' && Number.isFinite(saved.at) && Date.now() - saved.at >= 0 && Date.now() - saved.at < MAX_AGE) return saved.allowed;
    } catch (_) { /* Measurement never depends on storage being available. */ }
    return null;
  }
  function pageLocation() {
    const clean = new URL('https://romanoroei.github.io' + PATH);
    const current = new URL(window.location.href);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = current.searchParams.get(key);
      if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) clean.searchParams.set(key, value);
    }
    return clean.href;
  }
  function referrer() {
    try { return new URL(document.referrer).origin + '/'; } catch (_) { return ''; }
  }
  function gtag() { window.dataLayer.push(arguments); }
  function start() {
    if (started || window.location.hostname !== 'romanoroei.github.io' || !window.location.pathname.startsWith(PATH)) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: pageLocation(),
      page_referrer: referrer(),
      page_title: 'מחשבון הטבות מס לעצמאים',
      cookie_prefix: 'pensioncalc',
      cookie_domain: 'none',
      cookie_path: PATH,
      cookie_expires: MAX_AGE / 1000,
      cookie_update: false
    });
    gtag('event', 'page_view', { send_to: ID });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    script.referrerPolicy = 'origin';
    document.head.append(script);
  }
  function clearCookies() {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (name.startsWith('pensioncalc')) document.cookie = name + '=; Max-Age=0; Path=' + PATH + '; SameSite=Lax; Secure';
    }
  }
  function applyConsent(allowed) {
    consent = allowed;
    window['ga-disable-' + ID] = !allowed;
    if (allowed) {
      if (started) gtag('consent', 'update', { analytics_storage: 'granted' });
      else start();
    } else {
      if (started) gtag('consent', 'update', { analytics_storage: 'denied' });
      clearCookies();
    }
    if (allowed) reportBreakdownView();
    status.textContent = allowed ? 'השימוש בעוגיות אושר. אפשר לשנות את הבחירה בכל עת.' : 'עוגיות ניתוח השימוש כבויות. המחשבון זמין במלואו.';
  }
  function choose(allowed) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ allowed, at: Date.now() })); } catch (_) {}
    applyConsent(allowed);
    banner.hidden = true;
  }
  function track(name, params) {
    if (consent !== true || !started || !EVENTS.has(name)) return;
    const safe = { send_to: ID };
    if (params && LOCATIONS.has(params.cta_location)) safe.cta_location = params.cta_location;
    if (params && CHANNELS.has(params.contact_channel)) safe.contact_channel = params.contact_channel;
    gtag('event', name, safe);
  }
  function locationOf(element) {
    return element.closest('#closing-cta') ? 'page_end' : element.closest('#contact-card') ? 'comparison' : 'footer';
  }
  document.getElementById('analytics-allow').addEventListener('click', () => choose(true));
  document.getElementById('analytics-deny').addEventListener('click', () => choose(false));
  for (const id of ['cookie-settings', 'cookie-settings-intro']) document.getElementById(id)?.addEventListener('click', () => {
    banner.hidden = false;
    document.getElementById(consent ? 'analytics-allow' : 'analytics-deny').focus();
  });
  document.addEventListener('pension:calculated', () => {
    track('calculation_complete');
    breakdownReported = false;
    reportBreakdownView();
  });
  document.addEventListener('pension:email-compose', () => track('contact_email_compose', { contact_channel: 'email', cta_location: emailLocation }));
  let emailLocation = 'comparison';
  document.addEventListener('click', event => {
    const target = event.target.closest('a,button');
    if (!target) return;
    const location = locationOf(target);
    if (target.id === 'email-open' || target.id === 'email-open-footer') {
      emailLocation = location;
      track('contact_email_open', { cta_location: location, contact_channel: 'email' });
    } else if (target.matches('.advisor-primary')) {
      track('contact_click', { cta_location: location, contact_channel: 'whatsapp' });
    } else if (target.matches('a[href^="mailto:"]')) {
      track('contact_click', { cta_location: location, contact_channel: 'email' });
    } else if (target.matches('a[href^="tel:"]')) {
      track('contact_click', { cta_location: location, contact_channel: 'phone' });
    } else if (target.matches('.share-calculator')) track('calculator_share');
  });
  function reportBreakdownView() {
    if (consent === true && started && breakdownVisible && !breakdownReported) {
      track('benefit_breakdown_view');
      breakdownReported = true;
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new window.IntersectionObserver(entries => {
      breakdownVisible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.1);
      reportBreakdownView();
    }, { threshold: 0.1 });
    observer.observe(document.getElementById('benefit-breakdown'));
  }
  for (const details of document.querySelectorAll('.advisor-service-details')) details.addEventListener('toggle', () => {
    if (details.open) track('service_details_open', { cta_location: locationOf(details) });
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      const saved = readConsent();
      applyConsent(saved === true);
      banner.hidden = saved !== null;
    }
  });
  const saved = readConsent();
  if (saved !== null) applyConsent(saved);
  banner.hidden = saved !== null;
}());
