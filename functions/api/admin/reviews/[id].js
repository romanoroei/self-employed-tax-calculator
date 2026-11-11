// One review: read it (the draft, else the copy on the site) or save a draft.
// Saving never publishes: the stored status is "approved" only when Roei ticked the approval and nothing blocks it.
import { json, store, today, DRAFT_PREFIX, readPublished, readJsonBody } from '../_lib.js';
import { normalize, validate, ID_RE } from '../../../../business-site/js/reviews/model.mjs';

export async function onRequestGet({ env, params }) {
  if (!ID_RE.test(params.id)) return json({ error: 'bad-id' }, 400);
  const kv = store(env);
  if (!kv) return json({ error: 'no-storage' }, 503);
  const draft = await kv.get(DRAFT_PREFIX + params.id);
  if (draft) return json({ review: JSON.parse(draft), from: 'draft' });
  try {
    const live = await readPublished(env, params.id);
    if (live) return json({ review: normalize(live.review), from: 'site' });
  } catch { return json({ error: 'github' }, 502); }
  return json({ error: 'not-found' }, 404);
}

export async function onRequestPut({ request, env, params }) {
  if (!ID_RE.test(params.id)) return json({ error: 'bad-id' }, 400);
  const kv = store(env);
  if (!kv) return json({ error: 'no-storage' }, 503);
  let body;
  try { body = await readJsonBody(request); } catch (e) { return json({ error: e.message }, e.status || 400); }
  const previous = JSON.parse((await kv.get(DRAFT_PREFIX + params.id)) || 'null');
  const r = normalize({ ...body, id: params.id });
  const check = validate(r);
  r.status = body.status === 'approved' && r.approval.content && !check.errors.length ? 'approved' : 'draft';
  if (!r.approval.content) r.approval.at = '';
  r.publishedAt = previous?.publishedAt || r.publishedAt || '';
  r.updatedAt = today();
  await kv.put(DRAFT_PREFIX + params.id, JSON.stringify(r));
  return json({ review: r, ...check });
}
