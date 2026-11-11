// Totals for the market reviews from the anonymous counter (functions/api/count.js), per review and label.
// Keys look like "review:view-2026-10:2026-11" (label : month counted).
import { json } from './_lib.js';

export async function onRequestGet({ env }) {
  if (!env.STATS) return json({ error: 'no-stats' }, 503);
  const totals = {};
  for (const prefix of ['review:', 'share:review-']) {
    let cursor;
    do {
      const page = await env.STATS.list({ prefix, cursor });
      for (const { name } of page.keys) {
        const m = name.match(/^(?:review:(view|cta|copy|from-[a-z]+)|share:(review))-(20\d\d-\d\d):20\d\d-\d\d$/);
        if (!m) continue;
        const id = m[3], label = m[1] || 'share';
        totals[id] ??= {};
        totals[id][label] = (totals[id][label] || 0) + parseInt((await env.STATS.get(name)) || '0', 10);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
  let hub = 0;
  const hubKeys = await env.STATS.list({ prefix: 'review:hub:' });
  for (const { name } of hubKeys.keys) hub += parseInt((await env.STATS.get(name)) || '0', 10);
  return json({ hub, reviews: totals });
}
