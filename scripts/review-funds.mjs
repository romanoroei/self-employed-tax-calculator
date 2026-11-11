// Takes the "מה עשו הקופות" snapshot for a market review, once, and stores it in the review's file.
//   node scripts/review-funds.mjs 2026-10   one review (fails if its month's figures are not out yet)
//   node scripts/review-funds.mjs --auto    every published review still waiting whose month is now out
//                                           (run daily by .github/workflows/update-yields.yml)
// The figures come from scripts/yields-data.json (Finance Ministry data, refreshed daily for the home page tile):
// the general track average of each product for the review's own month, the 12 months and the 3 years to it.
// The ministry publishes a month about three weeks after it ends, so a review waits for its figures.
// The snapshot is frozen: it is never overwritten, so a review keeps the figures of its own month.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FUND_TRACKS, ID_RE } from '../business-site/js/reviews/model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'business-site', 'content', 'market-reviews');
const data = JSON.parse(await readFile(path.join(root, 'scripts', 'yields-data.json'), 'utf8'));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

function snapshot() {
  const rows = Object.keys(FUND_TRACKS).map((key) => {
    const a = data.views[key]?.average;
    if (!a || typeof a.m1 !== 'number' || typeof a.y1 !== 'number' || typeof a.y3 !== 'number') throw new Error(`No complete average for ${key}`);
    return { key, m1: a.m1, y1: a.y1, y3: a.y3, funds: a.funds.y1, companies: a.companies.y1 };
  });
  return { period: data.period, takenAt: today, rows };
}

async function take(id, { auto }) {
  const file = path.join(dir, `${id}.json`);
  const review = JSON.parse(await readFile(file, 'utf8'));
  if (review.funds) { if (auto) return false; throw new Error(`${id} already has a snapshot (${review.funds.period}, taken ${review.funds.takenAt}); it is never replaced.`); }
  if (data.period !== Number(id.replace('-', ''))) { if (auto) return false; throw new Error(`The figures available are for ${data.period}, not ${id}; wait until the ministry publishes ${id}.`); }
  review.funds = snapshot();
  await writeFile(file, JSON.stringify(review, null, 2) + '\n');
  console.log(`Snapshot for ${id}:`, review.funds.rows.map((r) => `${r.key} ${r.m1}/${r.y1}/${r.y3}`).join(' | '));
  return true;
}

const arg = process.argv[2];
if (arg === '--auto') {
  let taken = 0;
  for (const name of (await readdir(dir)).filter((n) => /^20\d\d-\d\d\.json$/.test(n))) {
    const review = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    if (review.status === 'published' && await take(name.slice(0, 7), { auto: true })) taken++;
  }
  console.log(taken ? `${taken} review snapshot(s) taken.` : `No review waiting for ${data.period}.`);
} else {
  if (!ID_RE.test(arg || '')) throw new Error('Usage: node scripts/review-funds.mjs <YYYY-MM> | --auto');
  await take(arg, { auto: false });
}
