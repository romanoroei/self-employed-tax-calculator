import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { calendarFeed } from './calendar-feed.mjs';
import { renderYields, renderPolicySlide, renderPolicyProof } from './yields.mjs';
import { buildReviews } from './market-reviews.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const calc = path.join(output, 'self-employed-tax-calculator');
const oldUrl = 'https://romanoroei.github.io/self-employed-tax-calculator/';
const siteUrl = 'https://romanoinvest.co.il/self-employed-tax-calculator/';
// Publish an explicit file list so source, tests and working files stay private.
// Earlier share images stay published so links shared before keep their preview; v5 is the current one.
const assets = ['brand-logo.png', 'whatsapp-share-v2.jpg', 'whatsapp-share-v3.jpg', 'whatsapp-share-v4.jpg', 'whatsapp-share-v5.jpg'];
const publicSiteEntries = ['index.html','self-employed.html','savings-policy.html','investment-fund.html','knowledge.html','market-data.html','compass.html','financial-check.html','accessibility.html','disclosure.html','privacy.html','terms.html','favicon.svg','assets','css','js','magazine'];
const expectedRoot = ['404.html','_redirects','robots.txt','self-employed-tax-calculator','sitemap.xml','market-reviews.html','market-reviews',...publicSiteEntries];
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
// Calendar apps subscribe to this address, so it must keep its name.
await writeFile(path.join(output, 'magazine', 'financial-calendar.ics'), calendarFeed());
// The yields tile is plain HTML, written from the figures that scripts/update-yields.mjs refreshes.
const homeFile = path.join(output, 'index.html');
const homeSource = await readFile(homeFile, 'utf8');
assert(homeSource.includes('<!-- yields-tile -->'), 'Missing yields tile slot');
const yieldsData = JSON.parse(await readFile(path.join(root, 'scripts', 'yields-data.json'), 'utf8'));
const yieldsHtml = renderYields(yieldsData);
assert(homeSource.includes('<!-- policy-slide -->'), 'Missing policy slide slot');
await writeFile(homeFile, homeSource.replace('<!-- yields-tile -->', yieldsHtml).replace('<!-- policy-slide -->', renderPolicySlide(yieldsData)).replace('<!-- policy-proof -->', renderPolicyProof(yieldsData).proof).replace('<!-- policy-proof-note -->', renderPolicyProof(yieldsData).note));
// /market-data holds the same tile (phones see it there only): copied from the home page, its form link pointing home
const marketTile = homeSource.match(/<!-- market-tile:start -->([\s\S]*?)<!-- market-tile:end -->/);
assert(marketTile, 'Missing market tile markers on the home page');
const marketFile = path.join(output, 'market-data.html');
const marketSource = await readFile(marketFile, 'utf8');
assert(marketSource.includes('<!-- market-tile -->'), 'Missing market tile slot');
const marketHtml = marketTile[1].replace('<!-- yields-tile -->', renderYields(yieldsData, { full: true })).replace(/\s*<a class="yield-cta"[\s\S]*?<\/a>/, '').replace('<p class="yield-top5">מוצגות רק 5 החברות המובילות בכל קטגוריה</p>', '<p class="yield-top5">כל החברות בכל קטגוריה. לחיצה על שורה מוסיפה אותה לגרף</p>').replaceAll('href="#contact"', 'href="/#contact"');
await writeFile(marketFile, marketSource.replace('<!-- market-tile -->', marketHtml));
// Content versions ensure browsers pick up stylesheet and script updates together.
// Monthly market reviews: written from business-site/content/market-reviews, published ones only.
const reviewBuild = await buildReviews(root, output);
const businessPages = publicSiteEntries.filter(p=>p.endsWith('.html')).concat('magazine/tides-and-waves.html', 'magazine/financial-calendar.html', ...reviewBuild.pages);
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
// Short links for the market reviews (romanoinvest.co.il/oct26 and per channel), written from the published reviews.
await writeFile(path.join(output,'_redirects'), ['# Homepage is served directly; calculator retains its existing path.', '# Market review short links: one per review and channel, to the review with that channel\'s measuring parameters.', ...reviewBuild.redirects].join('\n') + '\n');
await writeFile(path.join(output,'404.html'), '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>העמוד לא נמצא</title><h1>העמוד לא נמצא</h1><a href="/">חזרה לאתר</a></html>');
await writeFile(path.join(output,'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://romanoinvest.co.il/sitemap.xml\n');
const sitePages = ['', 'self-employed', 'savings-policy', 'investment-fund', 'knowledge', 'market-data', 'compass', 'accessibility','disclosure','privacy','terms','magazine/tides-and-waves','magazine/financial-calendar',...reviewBuild.sitemap,'self-employed-tax-calculator/'];
await writeFile(path.join(output,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitePages.map(p=>`<url><loc>https://romanoinvest.co.il/${p}</loc></url>`).join('')}</urlset>`);
const siteCheck = spawnSync(process.execPath, ['scripts/check-site.mjs'], {cwd:root,stdio:'inherit'});
if (siteCheck.error) throw siteCheck.error;
if (siteCheck.status !== 0) process.exit(siteCheck.status || 1);
// A failed financial, consent or compass test fails the build and prevents publication.
const result = spawnSync(process.execPath, ['--test','tests/analytics.test.cjs','tests/pension.test.cjs','tests/compass.test.cjs','tests/reviews.test.cjs','tests/fcheck.test.cjs'], {
  cwd: root, stdio: 'inherit', env: {...process.env, CALCULATOR_TEST_ROOT: calc}
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('Verified Cloudflare output: dist (business site, calculator, public assets and sitemap).');
