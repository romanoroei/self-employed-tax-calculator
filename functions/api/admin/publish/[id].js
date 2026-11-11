// Publish an approved draft: one commit of the review file to main, which Cloudflare Pages then builds and deploys.
// Refused (422) unless the draft is approved and passes every publishing check; the build checks it again.
import { json, store, today, DRAFT_PREFIX, writePublished } from '../_lib.js';
import { normalize, validate, ID_RE, reviewUrl, monthLabel } from '../../../../business-site/js/reviews/model.mjs';

export async function onRequestPost({ env, params, data }) {
  if (!ID_RE.test(params.id)) return json({ error: 'bad-id' }, 400);
  const kv = store(env);
  if (!kv) return json({ error: 'no-storage' }, 503);
  const draft = JSON.parse((await kv.get(DRAFT_PREFIX + params.id)) || 'null');
  if (!draft) return json({ error: 'not-found' }, 404);
  const r = normalize(draft);
  const date = today();
  r.publishedAt = r.publishedAt || date;
  r.updatedAt = date;
  r.status = 'published';
  const { errors, warnings } = validate(r, { forPublish: true });
  if (draft.status !== 'approved') errors.unshift('הסקירה עוד לא סומנה כמאושרת');
  if (errors.length) return json({ error: 'not-ready', errors, warnings }, 422);
  if (!env.GITHUB_TOKEN) return json({ error: 'no-github', errors: ['הפרסום עוד לא חובר ל־GitHub (חסר GITHUB_TOKEN)'] }, 503);
  let commit;
  try {
    commit = await writePublished(env, r.id, r, `Market review ${r.id}: ${draft.publishedAt ? 'update' : 'publish'} (${monthLabel(r.id)}), approved in the admin by ${data.email || 'admin'}`);
  } catch (e) {
    return json({ error: 'github', errors: ['השמירה ב־GitHub נכשלה: ' + e.message] }, 502);
  }
  await kv.put(DRAFT_PREFIX + r.id, JSON.stringify(r));
  return json({ ok: true, commit, url: reviewUrl(r.id), review: r, warnings });
}
