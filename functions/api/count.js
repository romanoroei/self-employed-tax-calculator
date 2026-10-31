// Cloudflare Pages Function: anonymous totals for the financial calendar.
// Counts subscribe-button clicks and visits that arrive from a calendar reminder, per month.
// Stores only the label and a number (no IP, cookie or identifier), in the KV namespace bound as STATS.
// Without that binding it accepts the request and stores nothing, so the page never depends on it.

const LABEL = /^(?:subscribe:(?:google|apple|outlook|copy)|return:m(?:[1-9]|1[0-2]))$/;

export async function onRequestPost({ request, env }) {
  const label = (await request.text()).trim();
  if (!LABEL.test(label)) return new Response(null, { status: 400 });
  if (env.STATS) {
    const key = `${label}:${new Date().toISOString().slice(0, 7)}`;
    const total = parseInt((await env.STATS.get(key)) || '0', 10) + 1;
    await env.STATS.put(key, String(total));
  }
  return new Response(null, { status: 204 });
}
