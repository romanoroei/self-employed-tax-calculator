# Monthly market reviews: content

One file per review: `<YYYY-MM>.json`, where the month is the one the review covers.
The admin page (`/admin`) writes these files through the GitHub API when Roei presses "פרסום באתר";
they can also be added by hand (the admin's "הורדת קובץ הסקירה" gives the same file).

- Only `"status": "published"` reaches the site. The build (`scripts/market-reviews.mjs`) refuses a
  published review that fails `validate(..., { forPublish: true })` in `business-site/js/reviews/model.mjs`:
  source credit and date, permission ticked, approval ticked, 3–5 points, 3 topics, every figure dated and sourced.
- Pages: `/market-reviews` (hub) and `/market-reviews/<id>`, written into `dist`, added to the sitemap.
- Text is plain: blank line = paragraph, `- ` = list item, `**bold**`. No HTML is ever rendered from a review.
- `angle` (Roei's own words) shows only when `angle.approved` is true.
- `marketing` holds phase 2 (social content). It is stored, never rendered on the site.
- This folder is never published (`content` is not in the build's file list, and check-site refuses it in dist).

## Server setup (Cloudflare Pages project romanoinvest-git, Production)

The admin API (`functions/api/admin/*`) stays closed (503) until all of this is in place:

1. Zero Trust → Access → Applications: a self-hosted application for `romanoinvest.co.il/admin*` and
   `romanoinvest.co.il/api/admin/*`, policy "Allow" for Roei's email (one-time PIN). Copy its Application Audience (AUD) tag.
2. Environment variables: `ACCESS_TEAM_DOMAIN` (e.g. `<team>.cloudflareaccess.com`), `ACCESS_AUD` (the tag),
   `ADMIN_EMAILS` (comma separated, optional extra check).
3. Secret `GITHUB_TOKEN`: a fine-grained token for romanoroei/self-employed-tax-calculator only, permission Contents: Read and write.
4. Optional KV namespace bound as `REVIEWS` for drafts (otherwise drafts use `STATS` with the prefix `review-draft:`).
5. Redeploy (Deployments → ⋯ → Retry deployment) so the bindings apply.
