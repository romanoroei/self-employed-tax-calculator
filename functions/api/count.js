// Cloudflare Pages Function: anonymous totals for the business pages.
// Counts, per month: calendar subscribe clicks, visits from a calendar reminder, clicks on the contact links,
// sent lead forms, the steps of the financial compass (starts, first choices, stages reached, finishes, time bands, sources from a fixed list), clicks on the home page strip, clicks on the travel insurance purchase links, clicks on the savings policy joining links, clicks on the article share buttons, and summaries sent from the calculator (the label only, never the amounts).
// Stores only the label and a number (no IP, cookie or identifier), in the KV namespace bound as STATS.
// Without that binding it accepts the request and stores nothing, so the page never depends on it.

const LABEL = /^(?:subscribe:(?:google|apple|outlook|copy)|return:m(?:[1-9]|1[0-2])|contact:(?:whatsapp|phone|email|form|summary)|strip:(?:calculator|calendar|study|guide|compass|invest)|buy:(?:passportcard|harel|fnx)|join:(?:hachshara|fnx|tile-hachshara|tile-fnx)|share:(?:self-employed|tides|calendar|savings-policy|investment-fund)|compass:(?:start|resume|pick-[1-6]|primary-[1-6]|stage-[2-5]|done|limited|whatsapp|calculator|share|form|time-(?:fast|mid|slow)|utm-(?:tiktok|instagram|facebook|google|whatsapp|email|youtube|other)))$/;

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
