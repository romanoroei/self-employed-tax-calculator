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
  assert(!/noindex|http-equiv="refresh"/.test(text),'Production page must not be hidden or redirected: '+rel);
  assert(!/0011716(?!\d)/.test(text),'Outdated license number: '+rel);
 }
}
const home=await readFile(path.join(root,'index.html'),'utf8');
assert(home.includes('href="/self-employed-tax-calculator/"'),'Missing calculator entry');
assert(home.includes('action="https://formspree.io/f/mvzjeykj"'),'Incorrect lead endpoint');
for(const name of ['שם מלא','טלפון','אימייל','מטרה'])assert(home.includes('name="'+name+'"'),'Incorrect form field '+name);
const js=await readFile(path.join(root,'js/site.js'),'utf8');
assert(!js.includes('Preview only:')&&!js.includes('הטופס אינו פעיל'),'Preview guard must not reach production');
assert(js.includes('button.disabled || !form.reportValidity()'),'Prevent repeated submits while pending');
const robots=await readFile(path.join(root,'robots.txt'),'utf8');
assert(robots.includes('Allow: /')&&!robots.includes('Disallow: /'),'Production crawling blocked');
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
assert.equal([...sitemap.matchAll(/<loc>/g)].length,7,'Sitemap must include all seven canonical pages');
console.log(`Site packaging checked: ${pageCount} HTML pages; local links, assets, scripts, lead fields, canonicals and crawl configuration passed.`);
