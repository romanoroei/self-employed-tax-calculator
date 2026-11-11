// What the admin page can do on this deployment. Reports only yes/no, never a value.
import { json, store } from './_lib.js';

export function onRequestGet({ env, data }) {
  return json({
    email: data.email,
    drafts: !!store(env),
    draftsStore: env.REVIEWS ? 'REVIEWS' : env.STATS ? 'STATS' : '',
    publish: !!env.GITHUB_TOKEN,
    stats: !!env.STATS,
    ai: false, // phase 2, only after the cost is approved and a key is set
  });
}
