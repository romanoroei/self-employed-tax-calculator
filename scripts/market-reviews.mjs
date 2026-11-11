// Build step for the monthly market reviews: reads business-site/content/market-reviews/*.json,
// keeps the published ones, refuses any that fail validation, and writes the hub and one page per review.
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { normalize, validate, ID_RE, redirectLines } from '../business-site/js/reviews/model.mjs';
import { renderHub, renderReviewPage, renderKnowledgeReviews, sitemapPaths } from '../business-site/js/reviews/render.mjs';

export async function loadPublishedReviews(dir) {
  const names = await readdir(dir).catch(() => []);
  const reviews = [];
  for (const name of names.filter(n => n.endsWith('.json')).sort()) {
    const raw = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    if (raw.status !== 'published') continue;
    const r = normalize(raw);
    if (r.id + '.json' !== name || !ID_RE.test(r.id)) throw new Error(`Market review ${name}: file name must be <id>.json`);
    const { errors } = validate(r, { forPublish: true });
    if (errors.length) throw new Error(`Market review ${name} cannot be published:\n- ${errors.join('\n- ')}`);
    reviews.push(r);
  }
  return reviews.sort((a, b) => b.id.localeCompare(a.id)); // newest month first
}

// Writes dist/market-reviews.html and dist/market-reviews/<id>.html; returns the relative pages and sitemap paths.
export async function buildReviews(root, output) {
  const reviews = await loadPublishedReviews(path.join(root, 'business-site', 'content', 'market-reviews'));
  const dir = path.join(output, 'market-reviews');
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(output, 'market-reviews.html'), renderHub(reviews));
  reviews.forEach((r, i) => reviews[i]._page = `market-reviews/${r.id}.html`);
  for (const [i, r] of reviews.entries()) {
    await writeFile(path.join(output, r._page), renderReviewPage(r, { next: reviews[i - 1] || null, prev: reviews[i + 1] || null }));
  }
  // the reviews category on /knowledge links straight to each review
  const knowledge = path.join(output, 'knowledge.html');
  const kn = await readFile(knowledge, 'utf8');
  if (!kn.includes('<!-- market-reviews-list -->')) throw new Error('Missing market reviews slot in knowledge.html');
  await writeFile(knowledge, kn.replace('<!-- market-reviews-list -->', renderKnowledgeReviews(reviews)));
  return { redirects: redirectLines(reviews), count: reviews.length, pages: ['market-reviews.html', ...reviews.map(r => r._page)], sitemap: sitemapPaths(reviews) };
}
