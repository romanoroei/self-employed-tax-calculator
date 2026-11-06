// Refreshes scripts/yields-data.json from the data GemelHub syncs from the Finance
// Ministry. Run daily by .github/workflows/update-yields.yml. Any doubt throws, and
// the site then keeps the last good numbers.
// Pass a folder as the first argument to read local copies instead.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeYields } from './yields.mjs';

const RAW = 'https://raw.githubusercontent.com/romanoroei/GemelHub/main/data/ckan/';
const localDir = process.argv[2];
const load = async (name) => {
  if (localDir) return JSON.parse(await readFile(path.join(localDir, name), 'utf8'));
  const response = await fetch(RAW + name);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
};

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'yields-data.json');
const next = computeYields({ gemel: await load('gemel-current.json'), polisa: await load('polisa-current.json'), trailing7y: await load('trailing-7y.json') });
const current = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
if (current && next.period < current.period) throw new Error(`Refusing older data: ${next.period} < ${current.period}`);
// A one-month move this large means a broken source, not a market.
for (const [key, rows] of Object.entries(next.views)) {
  for (const row of rows) if (row.y3 > 300 || row.y3 < -80 || Math.abs(row.ytd) > 200 || row.y7 > 600 || (row.y7 !== null && row.y7 < -90)) throw new Error(`Implausible yield in ${key}: ${row.name}`);
}
const text = `${JSON.stringify(next, null, 1)}\n`;
if (current && JSON.stringify(current) === JSON.stringify(next)) console.log(`No change (period ${next.period}).`);
else { await writeFile(file, text); console.log(`Updated to period ${next.period}.`); }
for (const [key, rows] of Object.entries(next.views)) console.log(key, rows.map((r) => `${r.company} ${r.ytd}/${r.y3}/${r.y7} [${r.name}]`).join(' | '));
