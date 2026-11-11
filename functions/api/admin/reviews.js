// The admin's list: every draft in KV, plus reviews already on the site that have no draft here.
import { json, store, DRAFT_PREFIX, listPublished } from './_lib.js';

export async function onRequestGet({ env }) {
  const kv = store(env);
  if (!kv) return json({ error: 'no-storage' }, 503);
  const items = new Map();
  let cursor;
  do {
    const page = await kv.list({ prefix: DRAFT_PREFIX, cursor });
    for (const { name } of page.keys) {
      const r = JSON.parse((await kv.get(name)) || 'null');
      if (r) items.set(r.id, { id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt, publishedAt: r.publishedAt, live: !!r.publishedAt });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  let published = [];
  try { published = await listPublished(env); } catch { /* the list still shows the drafts */ }
  for (const id of published) {
    if (items.has(id)) items.get(id).live = true;
    else items.set(id, { id, title: '', status: 'published', updatedAt: '', publishedAt: '', live: true, onlyOnSite: true });
  }
  return json({ reviews: [...items.values()].sort((a, b) => b.id.localeCompare(a.id)) });
}
