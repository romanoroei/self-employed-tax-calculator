// Fetches Bank Rate from the Bank of England's own database and writes the days it changed to
// business-site/assets/data/boe-rate.json, which /api/rates reads for the UK row.
// It runs daily in GitHub Actions (.github/workflows/update-boe.yml), because the Bank's site turns
// away Cloudflare's servers. When anything looks wrong it fails and the file keeps its last good figures.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'business-site', 'assets', 'data', 'boe-rate.json');
const YEARS = 25;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// a new day is written only once the stored one is this many days old, unless the rate changed,
// so the site redeploys about twice a week rather than every day
const REFRESH_DAYS = 3;

const from = new Date();
from.setUTCFullYear(from.getUTCFullYear() - YEARS);
const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=${String(from.getUTCDate()).padStart(2, '0')}/${MONTHS[from.getUTCMonth()]}/${from.getUTCFullYear()}&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`;

const response = await fetch(url, { headers: { 'User-Agent': 'romanoinvest.co.il rates', Accept: 'text/csv,*/*' } });
if (!response.ok) throw new Error(`Bank of England answered ${response.status}`);
const lines = (await response.text()).trim().split(/\r?\n/);
if (!/^DATE,IUDBEDR/i.test(lines[0])) throw new Error(`Unexpected answer: ${lines[0].slice(0, 80)}`);

const rows = lines.slice(1).map((line) => {
  const [date, value] = line.split(',');
  const [day, month, year] = date.split(' ');
  const m = MONTHS.indexOf(month);
  if (m < 0 || !/^\d{4}$/.test(year)) throw new Error(`Unexpected row: ${line}`);
  return [`${year}-${String(m + 1).padStart(2, '0')}-${day.padStart(2, '0')}`, Number(value)];
}).sort((a, b) => a[0].localeCompare(b[0]));
if (rows.length < 1000 || rows.some(([, v]) => !Number.isFinite(v) || v < -1 || v > 25)) throw new Error('Figures out of range');

const history = [];
for (const [date, value] of rows) if (!history.length || history[history.length - 1][1] !== value) history.push([date, value]);
const asOf = rows[rows.length - 1][0];
const age = (Date.now() - new Date(`${asOf}T00:00:00Z`)) / 86400000;
if (age > 10) throw new Error(`The latest figure is ${asOf}, too old`);

let stored = null;
try { stored = JSON.parse(await readFile(file, 'utf8')); } catch {}
const sameHistory = stored && JSON.stringify(stored.history) === JSON.stringify(history);
const storedAge = stored ? (new Date(`${asOf}T00:00:00Z`) - new Date(`${stored.asOf}T00:00:00Z`)) / 86400000 : Infinity;
if (sameHistory && storedAge < REFRESH_DAYS) {
  console.log(`No change (stored ${stored.asOf}, latest ${asOf}).`);
} else {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ source: 'Bank of England, series IUDBEDR', asOf, history })}\n`);
  console.log(`Wrote ${history.length} changes, last ${JSON.stringify(history[history.length - 1])}, as of ${asOf}.`);
}
