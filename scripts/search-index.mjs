// Build step for the site search (business-site/js/search.js): reads the published pages in dist,
// gives every h2/h3 in <main> an id (so a result can open the right section), and returns the index.
// Titles, kinds and summaries come from the rows of /knowledge, so the search speaks like that page.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const text = (html) => html
  .replace(/<(script|style|svg|noscript|template|form)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

const SKIP = new Set(['knowledge', 'accessibility', 'disclosure', 'privacy', 'terms']);
const KINDS = { '': 'עמוד הבית', about: 'עליי', givatayim: 'מתכנן פיננסי בגבעתיים' };
// small ranking nudges: the guides first, the local page last
const WEIGHT = { '': -4, about: -2, givatayim: -4 };
const SECTION_CHARS = 1400;

const fileOf = (p) => p === '' ? 'index.html' : p.endsWith('/') ? p + 'index.html' : p + '.html';

export async function buildSearchIndex(output, sitePages) {
  // the rows of /knowledge: href -> kind, title, summary
  const kn = await readFile(path.join(output, 'knowledge.html'), 'utf8');
  const rows = new Map();
  for (const [, href, body] of kn.matchAll(/<a class="kn-row" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const kind = (body.match(/<span class="kn-k[^"]*">([\s\S]*?)<\/span>(?=<strong>)/) || [])[1] || '';
    rows.set(href.replace(/\/$/, '') || '/', {
      k: text(kind.replace(/<span[\s\S]*?<\/span>/g, '')).replace(/\s*·.*$/, ''),
      t: text((body.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || ''),
      d: text((body.match(/<small>([\s\S]*?)<\/small>/) || [])[1] || ''),
    });
  }

  const pages = [];
  for (const p of sitePages) {
    if (SKIP.has(p)) continue;
    const file = path.join(output, fileOf(p));
    let html = await readFile(file, 'utf8');
    const mainAt = html.search(/<main\b/);
    const mainEnd = html.lastIndexOf('</main>');
    if (mainAt < 0 || mainEnd < 0) throw new Error('Search index: no <main> in ' + fileOf(p));
    let main = html.slice(mainAt, mainEnd);

    // ids for the headings that have none: q-1, q-2 ... in page order
    let n = 0;
    main = main.replace(/<(h[23])\b([^>]*)>/g, (tag, h, attrs) => {
      n++;
      return /\sid="/.test(attrs) ? tag : `<${h} id="q-${n}"${attrs}>`;
    });
    html = html.slice(0, mainAt) + main + html.slice(mainEnd);
    await writeFile(file, html);

    // sections: the text under each heading, the closing call to action left out
    const body = main
      .replace(/<section class="art-cta"[\s\S]*?<\/section>/g, ' ')
      .replace(/<nav class="toc"[\s\S]*?<\/nav>/g, ' ')
      .replace(/<p class="art-back"[\s\S]*?<\/p>/g, ' ')
      .replace(/<(div|p) class="art-byline"[\s\S]*?<\/\1>/g, ' ')
      .replace(/<table\b[\s\S]*?<\/table>/g, ' ');
    const parts = body.split(/(?=<h[23]\b)/);
    const sections = [];
    for (const part of parts) {
      const m = part.match(/^<h[23]\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/);
      const heading = m ? text(m[2]) : '';
      const rest = text(m ? part.slice(m[0].length) : part);
      if (!heading && !rest) continue;
      sections.push([heading, m ? m[1] : '', rest.length > SECTION_CHARS ? rest.slice(0, SECTION_CHARS).replace(/\s\S*$/, '') : rest]);
    }

    const url = '/' + p;
    const row = rows.get(url.replace(/\/$/, '') || '/') || {};
    const h1 = text((main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
    const title = text((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').replace(/\s*\|.*$/, '');
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const review = p.startsWith('market-reviews/');
    pages.push({
      u: url,
      t: row.t || h1 || title,
      k: row.k || KINDS[p] || (review ? 'סקירת שוק' : 'עמוד'),
      d: row.d || text(desc),
      w: WEIGHT[p] ?? (review ? 0 : 1),
      s: sections,
    });
  }
  // the one tool that lives off the site
  const draw = [...rows.entries()].find(([h]) => h.startsWith('https://'));
  if (draw) pages.push({ u: draw[0] + '/', t: draw[1].t, k: draw[1].k, d: draw[1].d, w: 0, s: [] });
  return { v: 1, pages };
}
