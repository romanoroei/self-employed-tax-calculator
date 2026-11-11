// Takes the "מה עשו הקופות" snapshot for one market review, once, and stores it in the review's file:
//   node scripts/review-funds.mjs 2026-10
// The figures come from scripts/yields-data.json (Finance Ministry data, refreshed daily for the home page tile):
// the general track average of each product for the latest month published, the 12 months and the 3 years to it.
// The snapshot is frozen: it is never overwritten, so a review keeps the figures known when it was written.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FUND_TRACKS, ID_RE } from '../business-site/js/reviews/model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!ID_RE.test(id || '')) throw new Error('Usage: node scripts/review-funds.mjs <YYYY-MM>');
const file = path.join(root, 'business-site', 'content', 'market-reviews', `${id}.json`);
const review = JSON.parse(await readFile(file, 'utf8'));
if (review.funds) throw new Error(`${id} already has a snapshot (${review.funds.period}, taken ${review.funds.takenAt}); it is never replaced.`);
const data = JSON.parse(await readFile(path.join(root, 'scripts', 'yields-data.json'), 'utf8'));
// the figures may not be newer than the month the review covers
if (data.period > Number(id.replace('-', ''))) throw new Error(`The data (${data.period}) is newer than the review month ${id}`);
const rows = Object.keys(FUND_TRACKS).map((key) => {
  const a = data.views[key]?.average;
  if (!a || typeof a.m1 !== 'number' || typeof a.y1 !== 'number' || typeof a.y3 !== 'number') throw new Error(`No complete average for ${key}`);
  return { key, m1: a.m1, y1: a.y1, y3: a.y3, funds: a.funds.y1, companies: a.companies.y1 };
});
review.funds = { period: data.period, takenAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()), rows };
await writeFile(file, JSON.stringify(review, null, 2) + '\n');
console.log(`Snapshot for ${id}: data to ${data.period}`, rows.map((r) => `${r.key} ${r.m1}/${r.y1}/${r.y3}`).join(' | '));
