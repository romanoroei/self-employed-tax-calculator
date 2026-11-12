import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=path.resolve('dist');
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
const published=await files(root);
assert(!published.some(p=>/[/\\](?:\.git|tools|content|tests|scripts|\.impeccable|\.playwright-mcp|\.taste-skill)(?:[/\\]|$)/.test(p)),'Internal working files must not be published');
let pageCount=0;
for(const file of published){
 const ext=path.extname(file);
 if(ext==='.js') new vm.Script(await readFile(file,'utf8'),{filename:file});
 if(!['.html','.css'].includes(ext))continue;
 const text=await readFile(file,'utf8');
 const refs=ext==='.html'?[...text.matchAll(/\b(?:href|src)="([^"<>]+)"/g)].map(m=>m[1]):[...text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(m=>m[1]);
 for(const ref of refs){
  if(/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref))continue;
  const clean=decodeURIComponent(ref.split(/[?#]/)[0].replaceAll('&amp;','&'));
  if(!clean)continue;
  const target=clean.startsWith('/')?path.join(root,clean.slice(1)):path.resolve(path.dirname(file),clean);
  assert(target===root||target.startsWith(root+path.sep),'Reference escapes deployment: '+ref);
  await stat(target).catch(async()=>{
   if (!path.extname(target)) return stat(target+'.html').catch(()=>assert.fail('Missing page: '+ref));
   assert.fail('Missing asset: '+path.relative(root,file)+' -> '+ref);
  });
 }
 if(ext==='.html'){
  pageCount++;
  if(path.basename(file)==='404.html')continue;
  const rel=path.relative(root,file).replaceAll('\\','/');
  const expected='https://romanoinvest.co.il/'+(rel==='index.html'?'':rel.replace(/index\.html$/,'').replace(/\.html$/,''));
  assert(text.includes('rel="canonical" href="'+expected+'"'),'Incorrect canonical: '+rel);
  assert(/<html[^>]*lang="he"[^>]*dir="rtl"/.test(text),'Hebrew RTL missing: '+rel);
  if(rel==='financial-check.html')assert(/<meta name="robots" content="noindex, nofollow">/.test(text)&&!/http-equiv="refresh"/.test(text),'The campaign page must stay out of search results');
  else assert(!/noindex|http-equiv="refresh"/.test(text),'Production page must not be hidden or redirected: '+rel);
  assert(!/0011716(?!\d)/.test(text),'Outdated license number: '+rel);
  if(/^(?:self-employed|savings-policy|investment-fund|magazine\/[^/]+|market-reviews\/[^/]+)\.html$/.test(rel))assert(text.includes('class="art-share"')&&text.includes(encodeURIComponent(expected)),'Article needs a WhatsApp share of its own address: '+rel);
 }
}
const home=await readFile(path.join(root,'index.html'),'utf8');
assert(home.includes('href="/self-employed-tax-calculator/"'),'Missing calculator entry');
assert((home.match(/<table data-yield-view=/g)||[]).length===18,'The yields tile needs all six views in all three rankings');
const marketPage=await readFile(path.join(root,'market-data.html'),'utf8');
assert((marketPage.match(/<table data-yield-view=/g)||[]).length===18&&!/gemelhub/i.test(marketPage)&&marketPage.includes('js/market.js'),'The market data page needs the full tile, its script, and no GemelHub');
assert(!/gemelhub/i.test(home),'The home page must not mention GemelHub');
assert(home.includes('action="https://formspree.io/f/mvzjeykj"'),'Incorrect lead endpoint');
for(const name of ['שם מלא','טלפון','אימייל','מטרה'])assert(home.includes('name="'+name+'"'),'Incorrect form field '+name);
const js=await readFile(path.join(root,'js/site.js'),'utf8');
assert(home.includes('data-now-title')&&js.includes("querySelector('[data-now]')"),'Missing what-matters-now tile');
assert(!js.includes('Preview only:')&&!js.includes('הטופס אינו פעיל'),'Preview guard must not reach production');
assert(js.includes('button.disabled || !form.reportValidity()'),'Prevent repeated submits while pending');
const feed=await readFile(path.join(root,'magazine/financial-calendar.ics'),'utf8');
assert(feed.startsWith('BEGIN:VCALENDAR\r\n')&&feed.endsWith('END:VCALENDAR\r\n'),'Calendar feed is malformed');
assert.equal([...feed.matchAll(/^BEGIN:VEVENT\r$/gm)].length,6,'Calendar feed must hold six reminders');
assert(feed.split('\r\n').every(l=>Buffer.byteLength(l)<=75),'Calendar feed lines must be folded');
const robots=await readFile(path.join(root,'robots.txt'),'utf8');
assert(robots.includes('Allow: /')&&!robots.includes('Disallow: /'),'Production crawling blocked');
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const reviewPages=(await readdir(path.join(root,'market-reviews'))).filter(n=>n.endsWith('.html'));
assert.equal([...sitemap.matchAll(/<loc>/g)].length,14+reviewPages.length,'Sitemap must include all fourteen canonical pages and every published review');
for(const p of reviewPages)assert(sitemap.includes('<loc>https://romanoinvest.co.il/market-reviews/'+p.replace(/\.html$/,'')+'</loc>'),'Review missing from the sitemap: '+p);
assert(!sitemap.includes('<loc>https://romanoinvest.co.il/market-reviews</loc>'),'The reviews hub stays out of the sitemap');
// /financial-check is reached by its own campaign link only: not in the sitemap, linked from no other page, no Google Analytics
assert(!sitemap.includes('financial-check'),'The campaign page stays out of the sitemap');
for(const file of published.filter(p=>p.endsWith('.html')&&!p.endsWith('financial-check.html')))assert(!/href="[^"]*financial-check/.test(await readFile(file,'utf8')),'No page links to the campaign page: '+path.relative(root,file));
{const fc=await readFile(path.join(root,'financial-check.html'),'utf8');const fdir=path.join(root,'js','fcheck');const fjs=await Promise.all((await readdir(fdir)).map(n=>readFile(path.join(fdir,n),'utf8')));
for(const t of [fc,...fjs])assert(!/googletagmanager|gtag\(|google-analytics/i.test(t),'No Google Analytics on the campaign page');
assert(fc.includes('href="/privacy"')&&fc.includes('href="/accessibility"')&&fc.includes('רישיון סוכן פנסיוני 00117164'),'The campaign page needs the license and the policy links');
assert((fc.match(/href="\/" target="_blank"/g)||[]).length>=3,'The campaign page links to the business site at the top and the bottom, in a new tab');
assert(!/formspree|script\.google/.test(fjs.join('')),'The campaign form posts only to its own function');}
// the reviews name the Finance Ministry as the source of the fund figures, never GemelHub (Roei)
for(const p of ['market-reviews.html',...reviewPages.map(p=>'market-reviews/'+p)])assert(!/gemelhub|גמלהאב|גמל האב/i.test(await readFile(path.join(root,p),'utf8')),'A market review must not mention GemelHub: '+p);
// every published review has five short links, each a 302 to its own measured address, and none hides a real page
const redirects=(await readFile(path.join(root,'_redirects'),'utf8')).split('\n').filter(l=>l&&!l.startsWith('#'));
assert.equal(redirects.length,5*reviewPages.length,'Each review needs its five short links');
for(const l of redirects){const m=l.match(/^\/([a-z]{3}\d\d(?:-(?:fb|ig|tt|mail))?) \/market-reviews\/(20\d\d-\d\d)\?utm_source=(?:whatsapp|facebook|instagram|tiktok|email)&utm_medium=(?:noam|social|email)&utm_campaign=market-review-\2 302$/);assert(m&&reviewPages.includes(m[2]+'.html'),'Malformed short link: '+l);await stat(path.join(root,m[1]+'.html')).then(()=>assert.fail('A short link hides a page: '+m[1]),()=>{});}
const knowledgePage=await readFile(path.join(root,'knowledge.html'),'utf8');
assert(knowledgePage.includes('id="market-reviews"')&&!knowledgePage.includes('<!-- market-reviews-list -->'),'The knowledge page must hold the market reviews category');
for(const p of reviewPages.sort().reverse().slice(0,6))assert(knowledgePage.includes('href="/market-reviews/'+p.replace(/\.html$/,'')+'"'),'The knowledge page must link straight to the review '+p);
// The financial compass: the agreed lead pipeline, consents, counters, and no Google Analytics on the business site.
const compass=await readFile(path.join(root,'compass.html'),'utf8');
const cdir=path.join(root,'js','compass');
const cjs=Object.fromEntries(await Promise.all(['config','regulatory','content','engine','ui'].map(async n=>[n,await readFile(path.join(cdir,n+'.js'),'utf8')])));
const order=['config','regulatory','content','engine','ui'].map(n=>compass.indexOf('src="js/compass/'+n+'.js'));
assert(order.every((p,i)=>p>0&&(i===0||p>order[i-1])),'Compass scripts missing or out of order');
const knowledge=await readFile(path.join(root,'knowledge.html'),'utf8');
assert(home.includes('href="/compass"')&&knowledge.includes('href="/compass"'),'The compass must be linked from the home page and the knowledge page');
// every page with the top bar opens the knowledge page from the "ארביטראז' של ידע" tile
for(const page of ['index.html','market-data.html','compass.html','self-employed.html','savings-policy.html','investment-fund.html','knowledge.html','magazine/financial-calendar.html','magazine/tides-and-waves.html','market-reviews.html',...reviewPages.map(p=>'market-reviews/'+p)])assert((await readFile(path.join(root,page),'utf8')).includes('class="bar-tools-toggle" href="/knowledge"'),'The knowledge tile is missing on '+page);
assert(cjs.config.includes("formspreeUrl: 'https://formspree.io/f/mvzjeykj'"),'Compass must use the agreed Formspree form');
const sheets=(js.match(/SHEETS_URL = '([^']+)'/)||[])[1];
assert(sheets&&cjs.config.includes("sheetsUrl: '"+sheets+"'"),'Compass must use the same Sheets script as the home page');
assert(cjs.config.includes("whatsappNumber: '972528089808'"),'Compass WhatsApp number');
assert(cjs.config.includes("'romanoinvest.co.il'"),'Compass production host');
for(const name of ['שם מלא','טלפון','אימייל','הסכמה','הסכמה לדיוור','מטרה','מקור'])assert(cjs.ui.includes("'"+name+"'"),'Compass form field '+name);
assert(/name: 'הסכמה', value: 'כן', required: true/.test(cjs.ui),'Compass contact consent must be required');
assert(cjs.ui.includes("name: 'הסכמה לדיוור', value: 'כן' })")&&!/הסכמה לדיוור[^)]*checked/.test(cjs.ui),'Compass marketing opt-in must be separate and never pre-ticked');
assert(cjs.ui.includes('button.disabled || !form.reportValidity()'),'Compass form must prevent repeated submits');
assert(cjs.ui.includes('cfg.productionHosts.includes(location.hostname)'),'Compass previews must not send leads');
for(const t of [compass,...Object.values(cjs)])assert(!/googletagmanager|gtag\(|G-9GFDYS61G9|google-analytics/i.test(t),'No Google Analytics on the compass');
const countSrc=await readFile(path.resolve('functions/api/count.js'),'utf8');
const LABEL=new RegExp(countSrc.match(/const LABEL = \/(.+)\/;/)[1]);
const labels=['strip:compass','compass:start','compass:resume','compass:done','compass:limited','compass:whatsapp','compass:calculator','compass:share','compass:form','compass:utm-tiktok','compass:utm-other','review:hub','review:view-2026-10','review:cta-2026-10','review:copy-2026-10','review:from-whatsapp-2026-10','review:from-other-2027-01','share:review-2026-10','fc:view-direct','fc:view-partner01','fc:start-other','fc:sent-direct','fc:route-invest','fc:route-unsure','fc:exit-need','fc:exit-d_study_interest','fc:result-general','fc:form','fc:fail','fc:restart','fc:edit','fc:site-top','fc:site-success',...[1,2,3,4,5,6].flatMap(n=>['compass:pick-'+n,'compass:primary-'+n]),...[2,3,4,5].map(n=>'compass:stage-'+n),...['fast','mid','slow'].map(t=>'compass:time-'+t)];
for(const l of labels)assert(LABEL.test(l),'Counter label not whitelisted: '+l);
assert(!LABEL.test('compass:answer-50s')&&!LABEL.test('compass:utm-somebody')&&!LABEL.test('review:view-2026-13')&&!LABEL.test('review:from-roei-2026-10')&&!LABEL.test('review:view-972528089808')&&!LABEL.test('fc:view-0528089808')&&!LABEL.test('fc:result-A')&&!LABEL.test('fc:exit-x'),'Counter whitelist too loose');
console.log(`Site packaging checked: ${pageCount} HTML pages; local links, assets, scripts, lead fields, canonicals and crawl configuration passed.`);
