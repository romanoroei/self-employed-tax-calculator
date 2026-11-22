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
  if(rel==='check.html')assert(/<meta name="robots" content="noindex, nofollow">/.test(text)&&!/http-equiv="refresh"/.test(text),'The site questionnaire stays out of search results');
  else if(rel.startsWith('questionnaire/'))assert(/<meta name="robots" content="noindex, nofollow">/.test(text)&&!/http-equiv="refresh"/.test(text),'The client questionnaire stays out of search results: '+rel);
  else if(rel==='financial-check.html')assert(/<meta name="robots" content="noindex, nofollow">/.test(text)&&!/http-equiv="refresh"/.test(text),'The campaign page must stay out of search results');
  else assert(!/noindex|http-equiv="refresh"/.test(text),'Production page must not be hidden or redirected: '+rel);
  assert(!/0011716(?!\d)/.test(text),'Outdated license number: '+rel);
  if(/^(?:self-employed|savings-policy|investment-fund|severance|hachshara-policy|magazine\/[^/]+|market-reviews\/[^/]+)\.html$/.test(rel))assert(text.includes('class="art-share"')&&text.includes(encodeURIComponent(expected)),'Article needs a WhatsApp share of its own address: '+rel);
  if(/^(?:self-employed|savings-policy|investment-fund|severance|hachshara-policy|management-fees|old-pension-funds|pension-fund-or-managers-insurance|cash-in-bank-account|study-fund-withdraw|pension-monthly-amount|magazine\/[^/]+|market-reviews\/[^/]+)\.html$/.test(rel))assert(/href="(?:\.\.\/|\/)?css\/toc\.css[?"]/.test(text)&&/src="(?:\.\.\/|\/)?js\/toc\.js[?"]/.test(text),'Every guide, magazine article and market review needs the table of contents (css/toc.css + js/toc.js): '+rel);
 }
}
const home=await readFile(path.join(root,'index.html'),'utf8');
assert(home.includes('href="/self-employed-tax-calculator/"'),'Missing calculator entry');
assert((home.match(/<table data-yield-view=/g)||[]).length===18,'The yields tile needs all six views in all three rankings');
assert.equal((home.match(/<ol class="policy-top"[^>]*>([\s\S]*?)<\/ol>/)?.[1].match(/<li>/g)||[]).length,5,'The policy slide needs five companies');
const marketPage=await readFile(path.join(root,'market-data.html'),'utf8');
assert((marketPage.match(/<table data-yield-view=[^>]*class="yield-full"/g)||[]).length===30&&!/gemelhub/i.test(marketPage)&&marketPage.includes('js/market.js'),'The market data page needs the full tables (five columns: the last month and four periods), its script, and no GemelHub');
assert(!marketPage.includes('class="yield-cta"')&&marketPage.includes('class="yield-wa" href="https://wa.me/972528089808"'),'The market data page: a WhatsApp button per fund, no link back to its own tile');
assert(home.includes('class="yield-cta" href="/market-data"'),'The home tile sends "where does your fund stand" to /market-data');
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
assert.equal([...sitemap.matchAll(/<loc>/g)].length,27+reviewPages.length,'Sitemap must include all twenty-seven canonical pages and every published review');
for(const p of reviewPages)assert(sitemap.includes('<loc>https://romanoinvest.co.il/market-reviews/'+p.replace(/\.html$/,'')+'</loc>'),'Review missing from the sitemap: '+p);
assert(!sitemap.includes('<loc>https://romanoinvest.co.il/market-reviews</loc>'),'The reviews hub stays out of the sitemap');
// /financial-check (the campaign page): not in the sitemap, linked from no page, no Google Analytics.
// /check (the site questionnaire, same engine): linked only from the home page, one route per link (Roei, 2026-11)
assert(!sitemap.includes('financial-check')&&!sitemap.includes('/check<')&&!sitemap.includes('/questionnaire'),'The questionnaires stay out of the sitemap');
for(const file of published.filter(p=>p.endsWith('.html'))){const text=await readFile(file,'utf8');const rel=path.relative(root,file);
  assert(!/href="[^"]*financial-check/.test(text)||rel==='financial-check.html','No page links to the campaign page: '+rel);
  const links=[...text.matchAll(/href="(\/check[?"][^"]*)"/g)].map(m=>m[1]);
  if(rel==='index.html')assert(links.length===7&&links.every(l=>/^\/check\?need=(?:invest|pension|retire|selfemp|unsure)&amp;utm_source=home_(?:hero|paths)$/.test(l)),'The home page links to the routes of the site questionnaire (the hero question and the path cards)');
  else assert(!links.length,'Only the home page links to the site questionnaire: '+rel);}
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
for(const page of ['index.html','about.html','pension-check.html','financial-planning.html','givatayim.html','management-fees.html','pension-fund-or-managers-insurance.html','old-pension-funds.html','cash-in-bank-account.html','study-fund-withdraw.html','pension-monthly-amount.html','market-data.html','compass.html','study-fund.html','self-employed.html','savings-policy.html','investment-fund.html','severance.html','hachshara-policy.html','knowledge.html','magazine/financial-calendar.html','magazine/tides-and-waves.html','market-reviews.html',...reviewPages.map(p=>'market-reviews/'+p)])assert((await readFile(path.join(root,page),'utf8')).includes('class="bar-tools-toggle" href="/knowledge"'),'The knowledge tile is missing on '+page);
assert(cjs.config.includes("formspreeUrl: 'https://formspree.io/f/mvzjeykj'"),'Compass must use the agreed Formspree form');
// the home form and the compass post to our own function, which forwards to the same Formspree form and Sheets script as the questionnaires
{const contactFn=await readFile(path.join(root,'..','functions','api','contact.js'),'utf8');const leadFn=await readFile(path.join(root,'..','functions','api','lead.js'),'utf8');
const sheetsOf=(t)=>(t.match(/const SHEETS = '([^']+)'/)||[])[1];
assert(sheetsOf(contactFn)&&sheetsOf(contactFn)===sheetsOf(leadFn),'The contact function must use the same Sheets script as the lead function');
assert(contactFn.includes("const FORMSPREE = 'https://formspree.io/f/mvzjeykj'"),'The contact function must use the agreed Formspree form');
assert(js.includes("fetch('/api/contact'")&&!/script\.google|formspree/.test(js),'The home form posts only to its own function');
assert(cjs.config.includes("contactUrl: '/api/contact'")&&cjs.ui.includes('fetch(cfg.contactUrl')&&!cjs.ui.includes('cfg.sheetsUrl'),'The compass form posts only to its own function');}
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
const labels=['study:start','study:done','study:whatsapp','study:share','strip:compass','compass:start','compass:resume','compass:done','compass:limited','compass:whatsapp','compass:calculator','compass:share','compass:form','compass:utm-tiktok','compass:utm-other','review:hub','review:view-2026-10','review:cta-2026-10','review:copy-2026-10','review:from-whatsapp-2026-10','review:from-other-2027-01','share:review-2026-10','fc:view-direct','fc:view-partner01','fc:start-other','fc:sent-direct','fc:route-invest','fc:route-unsure','fc:exit-need','fc:exit-d_study_interest','fc:result-general','fc:form','fc:fail','fc:restart','fc:edit','fc:site-top','fc:site-success','cta:knowledge-mid-whatsapp','cta:knowledge-end-contact','cta:market-end-whatsapp','cta:about-end-contact','cta:pension-check-end-contact','cta:financial-planning-end-contact','float:wa-pension','float:wa-planning','float:wa-givatayim','float:wa-guide','cta:guide-end-contact','src:google','src:chatgpt','src:perplexity','lead:google','lead:chatgpt','cta:givatayim-end-contact','float:wa-about',...[1,2,3,4,5,6].flatMap(n=>['compass:pick-'+n,'compass:primary-'+n]),...[2,3,4,5].map(n=>'compass:stage-'+n),...['fast','mid','slow'].map(t=>'compass:time-'+t)];
for(const l of labels)assert(LABEL.test(l),'Counter label not whitelisted: '+l);
assert(!LABEL.test('compass:answer-50s')&&!LABEL.test('compass:utm-somebody')&&!LABEL.test('review:view-2026-13')&&!LABEL.test('review:from-roei-2026-10')&&!LABEL.test('review:view-972528089808')&&!LABEL.test('fc:view-0528089808')&&!LABEL.test('fc:result-A')&&!LABEL.test('fc:exit-x')&&!LABEL.test('cta:home-mid-whatsapp')&&!LABEL.test('src:facebook')&&!LABEL.test('lead:roei'),'Counter whitelist too loose');
// The study fund check: on the site's own address, linked from the knowledge page and the self-employed guide, no Google Analytics.
{const sf=await readFile(path.join(root,'study-fund.html'),'utf8');const sfjs=await readFile(path.join(root,'js/study-fund.js'),'utf8');
for(const t of [sf,sfjs])assert(!/googletagmanager|gtag\(|G-XF5X2QLB8L|G-9GFDYS61G9|google-analytics/i.test(t),'No Google Analytics on the study fund check');
assert(sf.includes('src="js/study-fund.js')&&sfjs.includes('972528089808'),'The study fund check needs its script and the WhatsApp number');
for(const page of ['knowledge.html','self-employed.html']){const t=await readFile(path.join(root,page),'utf8');assert(t.includes('href="/study-fund"')&&!t.includes('KerenHeshtalmut'),'Link the study fund check on the site, not on GitHub Pages: '+page);}}
// SEO: guides carry Article + breadcrumb data that parses, and the legal pages carry a share image
for(const p of ["self-employed","savings-policy","investment-fund","severance","hachshara-policy","magazine/tides-and-waves","magazine/financial-calendar"]){const t=await readFile(path.join(root,p+".html"),"utf8");const m=t.match(/<script type="application\/ld\+json">(.*?)<\/script>/);assert(m,"Structured data missing: "+p);const g=JSON.parse(m[1])["@graph"];assert(g.some(x=>x["@type"]==="Article")&&g.some(x=>x["@type"]==="BreadcrumbList"),"Article and breadcrumb data needed: "+p);}
for(const p of ["accessibility","disclosure","privacy","terms"])assert((await readFile(path.join(root,p+".html"),"utf8")).includes("og:image"),"Share image missing: "+p);
// Structured data: every block parses; one Person (#roei) with the license; FAQPage matches the questions on the page; the about page is its ProfilePage.
for(const file of published.filter(p=>p.endsWith('.html'))){const t=await readFile(file,'utf8');for(const m of t.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(m[1]);
  const faqs=(t.match(/<details class="fold faq-item">/g)||[]).length;if(faqs){const f=[...t.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1])).find(x=>x['@type']==='FAQPage');assert(f&&f.mainEntity.length===faqs,'FAQPage must hold every question on '+path.relative(root,file));}}
{const g=JSON.parse(home.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];const roei=g.find(x=>x['@id']==='https://romanoinvest.co.il/#roei');
assert(roei&&roei.hasCredential.identifier==='00117164'&&roei.url==='https://romanoinvest.co.il/about','Home needs the Person with the license and the about page');
assert(g.some(x=>x['@type']==='FinancialService'&&x.address.addressLocality==='פתח תקווה'),'Home needs the business with the Google Business Profile address');
const about=await readFile(path.join(root,'about.html'),'utf8');assert(about.includes('"@type":"ProfilePage"')&&about.includes('"mainEntity":{"@id":"https://romanoinvest.co.il/#roei"}')&&home.includes('href="/about"'),'The about page is the profile page, linked from home');}
console.log(`Site packaging checked: ${pageCount} HTML pages; local links, assets, scripts, lead fields, canonicals and crawl configuration passed.`);
