import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const calc = path.join(output, 'self-employed-tax-calculator');
const oldUrl = 'https://romanoroei.github.io/self-employed-tax-calculator/';
const siteUrl = 'https://romanoinvest.co.il/self-employed-tax-calculator/';
// Publish an explicit file list so source, tests and working files stay private.
const assets = ['brand-logo.png', 'whatsapp-share-v2.jpg'];
const publicSiteEntries = ['index.html','accessibility.html','disclosure.html','privacy.html','terms.html','favicon.svg','assets','css','js','magazine'];
const expectedRoot = ['404.html','_redirects','robots.txt','self-employed-tax-calculator','sitemap.xml',...publicSiteEntries];
await mkdir(calc, { recursive: true });
// Refuse an output tree containing unexpected files rather than uploading them.
assert.deepEqual((await readdir(output)).filter(n=>!expectedRoot.includes(n)), [], 'Unexpected file in dist; review before publishing');
assert.deepEqual((await readdir(calc)).filter(n=>!['index.html','analytics.js',...assets].includes(n)), [], 'Unexpected calculator output file');
const analytics = await readFile(path.join(root, 'analytics.js'), 'utf8');
let html = await readFile(path.join(root, 'index.html'), 'utf8');
assert(html.includes(oldUrl) || html.includes(siteUrl), 'Missing calculator canonical URL');
html = html.replaceAll(oldUrl, siteUrl).replaceAll(encodeURIComponent(oldUrl), encodeURIComponent(siteUrl));
const version = createHash('sha256').update(analytics).digest('hex').slice(0, 12);
html = html.replace(/src="analytics\.js(?:\?[^" ]*)?"/, `src="analytics.js?v=${version}"`);
assert(html.includes(`src="analytics.js?v=${version}"`), 'Missing analytics script');
assert(!html.includes(oldUrl) && !html.includes(encodeURIComponent(oldUrl)), 'Old calculator URL remains');
html = html.replaceAll('https://romanoroei.github.io/roei-romano-landing-page/', '/').replaceAll('רועי רומנו — לדף הנחיתה', 'רועי רומנו — לדף הבית');
await writeFile(path.join(calc, 'index.html'), html);
await writeFile(path.join(calc, 'analytics.js'), analytics);
for (const asset of assets) await cp(path.join(root, asset), path.join(calc, asset));
for (const entry of publicSiteEntries) await cp(path.join(root, 'business-site', entry), path.join(output, entry), {recursive:true});
// Content versions ensure browsers pick up stylesheet and script updates together.
const businessPages = publicSiteEntries.filter(p=>p.endsWith('.html')).concat('magazine/tides-and-waves.html', 'magazine/financial-calendar.html');
for (const page of businessPages) {
  const file = path.join(output, page);
  let document = await readFile(file, 'utf8');
  const links = [...document.matchAll(/(src|href)="((?:\.\.\/)?(?:css|js)\/[^"?]+\.(?:css|js))(?:\?[^"]*)?"/g)];
  for (const [tag, attr, ref] of links) {
    const bytes = await readFile(path.resolve(path.dirname(file), ref));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0,12);
    document = document.replace(tag, `${attr}="${ref}?v=${hash}"`);
  }
  await writeFile(file, document);
}
await writeFile(path.join(output,'_redirects'), '# Homepage is served directly; calculator retains its existing path.\n');
await writeFile(path.join(output,'404.html'), '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>העמוד לא נמצא</title><h1>העמוד לא נמצא</h1><a href="/">חזרה לאתר</a></html>');
await writeFile(path.join(output,'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://romanoinvest.co.il/sitemap.xml\n');
const sitePages = ['', 'accessibility','disclosure','privacy','terms','magazine/tides-and-waves','magazine/financial-calendar','self-employed-tax-calculator/'];
await writeFile(path.join(output,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitePages.map(p=>`<url><loc>https://romanoinvest.co.il/${p}</loc></url>`).join('')}</urlset>`);
const siteCheck = spawnSync(process.execPath, ['scripts/check-site.mjs'], {cwd:root,stdio:'inherit'});
if (siteCheck.error) throw siteCheck.error;
if (siteCheck.status !== 0) process.exit(siteCheck.status || 1);
// A failed financial or consent test fails the build and prevents publication.
const result = spawnSync(process.execPath, ['--test','tests/analytics.test.cjs','tests/pension.test.cjs'], {
  cwd: root, stdio: 'inherit', env: {...process.env, CALCULATOR_TEST_ROOT: calc}
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('Verified Cloudflare output: dist (business site, calculator, public assets and sitemap).');
