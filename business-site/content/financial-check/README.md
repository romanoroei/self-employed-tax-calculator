# /financial-check: the campaign questionnaire

A landing page for collaborations (the first is with a finance influencer). It is reached only by its own link.
It has `noindex`, is left out of the sitemap, and no page on the site links to it. `scripts/check-site.mjs`
enforces all three. Hiding a page is not a security measure: anyone with the link can open it.

Campaign link: `https://romanoinvest.co.il/financial-check?ref=partner01&utm_source=instagram&utm_medium=influencer&utm_campaign=year_end_2026`

## The parts

| Part | File |
|---|---|
| Question definitions (wording, options, stable ids) and the order of each route | `business-site/js/fcheck/questions.mjs` |
| Track rules, lead grade points, talking points for the call | `business-site/js/fcheck/rules.mjs` |
| Settings: season window, partner ids, endpoints | `business-site/js/fcheck/config.mjs` |
| Engine: answer state, branching, progress, result, lead message, checks | `business-site/js/fcheck/engine.mjs` |
| Interface | `business-site/financial-check.html`, `js/fcheck/ui.mjs`, `css/fcheck.css` (on top of `site.css` and `compass.css`) |
| Lead submission | `functions/api/lead.js` |
| Counters | labels `fc:*` in `functions/api/count.js` |
| Tests | `tests/fcheck.test.cjs` (run by the build) |

## Common changes

- **New partner:** add the id to `partners` in `config.mjs`. A ref that is not in the list still reaches the
  lead email as it came; in the counters it shows as `other`.
- **Season message:** `season` in `config.mjs` (`enabled`, `from`, `to`). It is shown only within the dates.
- **Change a question's wording:** in `questions.mjs`. Keep the `id`s. If you change the consent wording,
  also bump `CONSENT.version`.
- **New question:** define it in `QUESTIONS`, then place it in a route in `ROUTES`, with `when` if it is
  conditional. Run `node --test tests/fcheck.test.cjs`. The test walks every route and refuses:
  - a question outside the route;
  - a fact asked twice;
  - more than 10 questions.
- **Grade:** the points and thresholds are in `rules.mjs` (`GRADE_RULES`, `GRADE`). Points are only ever
  added. The grade is never shown to the visitor or sent to the counters.

## How a lead travels

1. The browser sends the answer ids, the contact details, the consent and the source to `/api/lead`.
2. The function checks the request:
   - the origin and the type;
   - a hidden honeypot field;
   - at most 5 submissions per hour per address;
   - a replay of the answers through the same engine;
   - the contact details and the consent version.
3. It works out the track and the grade itself and builds the message from its own texts.
4. It sends the message to Formspree, which emails Roei; the address is set in Formspree, not in the code.
   It also sends a copy to the Google Sheets script.
5. If Formspree fails, the message waits in the KV namespace `LEADS` for up to 14 days. Every later request
   retries up to 3 waiting messages.

### Optional settings in Cloudflare Pages

| Setting | Purpose |
|---|---|
| KV binding `LEADS` | Recommended. Holds the waiting messages and the duplicate and rate checks, as hashes only. Without it, the checks run in memory and a failure shows the visitor the phone number. |
| `FC_FORMSPREE_URL`, `FC_SHEETS_URL` | Replace the endpoints. The defaults are the site's existing ones. |
| `FC_ALLOWED_ORIGINS` | A comma-separated list replacing the allowed origins. |

On any host other than romanoinvest.co.il, the form does not send. It shows the email Roei would receive.
