# Monthly market reviews: content

One file per review: `<YYYY-MM>.json`, where the month is the one the review covers.

Monthly routine: Roei sends the link to the month's review on the Arbitrage site (ar-fo.co.il/professional-magazine/...).
Claude writes an edited review in Roei's brand from it, in its own words (facts and figures only from the source,
no long quotes), with `status: "draft"`, and shows Roei a preview. Only after Roei approves does the file get
`status: "published"`, `approval.content: true` and `publishedAt`, and go to main.

- Only `"status": "published"` reaches the site. The build (`scripts/market-reviews.mjs`) refuses a
  published review that fails `validate(..., { forPublish: true })` in `business-site/js/reviews/model.mjs`:
  source credit, date and link, permission, approval, 3–5 points, 3 topics, every figure dated and sourced.
- Pages: `/market-reviews` (hub) and `/market-reviews/<id>`, written into `dist`, added to the sitemap.
- Text is plain: blank line = paragraph, `- ` = list item, `**bold**`. No HTML is ever rendered from a review.
- `angle` ("הזווית שלי") is Roei's own words only, and shows only when `angle.approved` is true.
- `noam.opener` feeds Noam's WhatsApp message (`noamMessage()` in the model), sent by hand through AgendOS.
- `marketing` is reserved for phase 2 (social content). It is stored, never rendered on the site.
- This folder is never published (`content` is not in the build's file list, and check-site refuses it in dist).
- Short links (romanoinvest.co.il/oct26, -fb, -ig, -tt, -mail) are written into `_redirects` by the build: a 302 to the review with that channel's UTM. Noam's message uses the short one.
