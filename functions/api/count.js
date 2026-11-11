// Cloudflare Pages Function: anonymous totals for the business pages.
// Counts, per month: calendar subscribe clicks, visits from a calendar reminder, clicks on the contact links,
// sent lead forms, the steps of the financial compass (starts, first choices, stages reached, finishes, time bands, sources from a fixed list), clicks on the home page strip, clicks on the travel insurance purchase links, clicks on the savings policy joining links, clicks on the article share buttons, summaries sent from the calculator (the label only, never the amounts), for the market reviews: visits per month, the arrival channel from a fixed list, shares, link copies and contact clicks; and for /financial-check: views, starts and sent forms per campaign partner (a known partner id, "other" or "direct"), the route chosen, the question where a visit ended, the track of the result, form views, failed sends, restarts, changed answers and clicks to the business site. Never an answer, a sum, a grade or a contact detail.
// Stores only the label and a number (no IP, cookie or identifier), in the KV namespace bound as STATS.
// Without that binding it accepts the request and stores nothing, so the page never depends on it.

const LABEL = /^(?:subscribe:(?:google|apple|outlook|copy)|return:m(?:[1-9]|1[0-2])|contact:(?:whatsapp|phone|email|form|summary)|strip:(?:calculator|calendar|study|guide|compass|invest)|hero:(?:invest|compass|knowledge)|buy:(?:passportcard|harel|fnx)|join:(?:hachshara|fnx|tile-hachshara|tile-fnx)|share:(?:self-employed|tides|calendar|savings-policy|investment-fund|review-20\d\d-(?:0[1-9]|1[0-2]))|review:(?:hub|(?:view|cta|copy|from-(?:whatsapp|facebook|instagram|tiktok|email|other))-20\d\d-(?:0[1-9]|1[0-2]))|compass:(?:start|resume|pick-[1-6]|primary-[1-6]|stage-[2-5]|done|limited|whatsapp|calculator|share|form|time-(?:fast|mid|slow)|utm-(?:tiktok|instagram|facebook|google|whatsapp|email|youtube|other))|fc:(?:(?:view|start|sent)-(?:direct|other|[a-z][a-z0-9_]{0,23})|route-(?:invest|monthly|pension|selfemp|unsure)|exit-[a-z][a-z_]{1,24}|result-(?:invest|savings|pension|selfemp|general)|form|fail|restart|edit|site-(?:top|bottom|result|success)))$/;

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
