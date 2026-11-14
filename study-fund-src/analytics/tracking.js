// On romanoinvest.co.il the study fund check sends no Google Analytics (the business site has none).
// A few steps become anonymous totals through /api/count: only a fixed label is sent, never an amount.
const LABELS = Object.freeze({
  calculator_started: 'study:start',
  calculator_completed: 'study:done',
  whatsapp_clicked: 'study:whatsapp',
  share_clicked: 'study:share',
});

function count(label) {
  try { navigator.sendBeacon('/api/count', label); } catch { /* counting is optional */ }
}

export function trackEvent(eventName) {
  const label = LABELS[eventName];
  if (label) count(label);
  return Boolean(label);
}

export function trackOnce(eventName, parameters = {}, storage = globalThis.sessionStorage) {
  const key = `study_event_${eventName}`;
  try {
    if (storage?.getItem(key)) return false;
    storage?.setItem(key, '1');
  } catch { /* storage may be blocked; count anyway */ }
  return trackEvent(eventName, parameters);
}

export const trackOnceOrQueue = trackOnce;
