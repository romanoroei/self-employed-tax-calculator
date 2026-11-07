// Refreshes scripts/yields-data.json from the data GemelHub syncs from the Finance
// Ministry. Run daily by .github/workflows/update-yields.yml. Any doubt throws, and
// the site then keeps the last good numbers.
// Pass a folder as the first argument to read local copies instead.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeYields, rankedFunds, addHistory } from './yields.mjs';

const RAW = 'https://raw.githubusercontent.com/romanoroei/GemelHub/main/data/ckan/';
const localDir = process.argv[2];
const load = async (name) => {
  if (localDir) return JSON.parse(await readFile(path.join(localDir, name), 'utf8'));
  const response = await fetch(RAW + name);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
};

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'yields-data.json');
const gemel = await load('gemel-current.json');
const polisa = await load('polisa-current.json');
const ranked = computeYields({ gemel, polisa, trailing7y: await load('trailing-7y.json') });
// The chart needs each ranked fund's whole history: 2023 and the years before it sit in separate files,
// and the gemel years before 2023 are split into a file per fund.
const records = (file) => file.records ?? file;
const gemelIds = rankedFunds(ranked).filter(([key]) => key.startsWith('g')).map(([, id]) => id);
const gemelOld = (await Promise.all(gemelIds.map((id) => load(`gemel-1999-2022/${id}.json`).catch(() => [])))).flatMap(records);
const next = addHistory(ranked, {
  gemel: [...gemelOld, ...records(await load('gemel-2023.json')), ...gemel.records],
  polisa: [...records(await load('polisa-1999-2022.json')), ...records(await load('polisa-2023.json')), ...polisa.records],
});
const current = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
if (current && next.period < current.period) throw new Error(`Refusing older data: ${next.period} < ${current.period}`);
// A one-month move this large means a broken source, not a market.
const plausible = (row) => (row.y3 === null || (row.y3 <= 300 && row.y3 >= -80))
  && (row.y1 === null || Math.abs(row.y1) <= 200)
  && (row.y7 === null || (row.y7 <= 600 && row.y7 >= -90));
for (const [key, { average, rank }] of Object.entries(next.views)) {
  for (const row of [average, ...Object.values(rank).flat()]) if (!plausible(row)) throw new Error(`Implausible yield in ${key}: ${row.name || 'average'}`);
}
const text = `${JSON.stringify(next, null, 1)}\n`;
if (current && JSON.stringify(current) === JSON.stringify(next)) console.log(`No change (period ${next.period}).`);
else { await writeFile(file, text); console.log(`Updated to period ${next.period}.`); }
for (const [key, { average, rank }] of Object.entries(next.views)) {
  console.log(key, `average of ${average.count}: ${average.y1}/${average.y3}/${average.y7}`);
  for (const [column, rows] of Object.entries(rank)) console.log(' ', column, rows.map((r) => `${r.company} ${r.y1}/${r.y3}/${r.y7}`).join(' | '));
}
