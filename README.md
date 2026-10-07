# Leon Marchandise — Cloudflare Pages starter

A responsive bilingual (English/French) Pages project for **leonmarchandise.co.uk**. The landing page remains a factual “coming soon” page; the shop contains clearly marked demo products until verified inventory and business details are entered. Nothing here has been deployed or connected to a Cloudflare or Stripe account.

## What is included

- Accessible EN/FR language switchers on the landing page and storefront, with a saved browser preference.
- A static demo storefront and cart. Demo products cannot be purchased.
- Cloudflare Pages Functions scaffolding for a public product catalogue, Stripe Checkout session creation, and a signature-verified Stripe webhook.
- D1 migrations for products, orders and webhook events; French product name/description fields are supported.
- A noindex sample analytics dashboard at `/analytics-preview/`. Sample figures are not real; no visitor analytics are collected.
- No API keys, secrets, live product inventory, or account credentials.

## Important security and deployment notes

- This repository is a **Pages project**, not a previously described Worker export. The old Worker v1–v6 artifacts aren't present in this project.
- No Cloudflare or Stripe account was connected and no code has been deployed. The project will not start charging customers.
- The browser cart and its demo products are not a source of truth. When configured, the server reloads item IDs and prices from D1 and does not accept client-supplied prices.
- Configure verified stock/pricing, GBP tax/shipping/fulfilment and legal notices, real Cloudflare Pages/D1 resources, test-mode Stripe credentials, and the webhook before live payment.
- The webhook verifies Stripe's signature against the raw body with a 5-minute timestamp tolerance, checks GBP amount against the recorded order, and applies payment status idempotently. The success page itself never confirms payment.
- Add Cloudflare rate limiting for `POST /api/checkout` and run end-to-end tests using Stripe test mode before production.
- Analytics figures are static demo placeholders; no analytics vendor or tracking script is configured.

## Files

- `public/index.html`, `public/styles.css`, `public/site.js` — landing page and EN/FR switcher
- `public/store/` — demo storefront, cart, localized UI, and product/checkout client
- `public/analytics-preview/` — clearly labelled, static dashboard preview
- `public/checkout/success/` — informational payment-return page, not proof of payment
- `functions/api/catalog.js` — product catalogue endpoint (`GET /api/catalog?lang=en|fr`)
- `functions/api/checkout.js` — server-priced Checkout session creation and order persistence (`POST /api/checkout`)
- `functions/api/stripe-webhook.js` — signature-verified Stripe event handler (`POST /api/stripe-webhook`)
- `migrations/0001_shop.sql`, `migrations/0002_french_products.sql` — D1 schemas
- `tests/test_project.py` — static and schema safety tests
- `public/_headers`, `public/favicon.svg`, `public/robots.txt`, `public/sitemap.xml` — security and site metadata
- `wrangler.toml` — Pages settings; D1 binding remains commented out until a database is created

## Static preview

```sh
npx wrangler pages dev ./public
```

Without Pages Functions and D1, the storefront displays the demo catalogue and keeps checkout disabled.

## Configure live catalogue and checkout

1. Create a D1 database and note its ID:

   ```sh
   npx wrangler d1 create leon-marchandise-shop
   ```

2. Uncomment the `[[d1_databases]]` block in `wrangler.toml`, replace `database_id` with the actual ID, and apply both migrations:

   ```sh
   npx wrangler d1 migrations apply leon-marchandise-shop --remote
   ```

3. Insert business-verified catalogue records. IDs must match lowercase letters/numbers/hyphens; prices are GBP pence; products default inactive. Set `active = 1` only after checking prices, French descriptions, stock, fulfilment, tax and shipping.

4. Set secrets outside the repository:

   ```sh
   npx wrangler pages secret put STRIPE_SECRET_KEY --project-name leon-marchandise-site
   npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name leon-marchandise-site
   ```

   Use Stripe test-mode values in a non-production deployment first. Never use a publishable key for the server secret and never commit either secret.

5. In Stripe, configure `https://leonmarchandise.co.uk/api/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Store the signing secret with the second command above.

6. Configure checkout rate limiting in Cloudflare. Deploy Pages from the project root (so the `functions/` directory is included) using the real project/account:

   ```sh
   npx wrangler pages deploy ./public --project-name leon-marchandise-site --branch main
   ```

   Verify the Pages D1 binding and secrets before test checkout. Configure the custom domain separately in the Cloudflare account.

## Tests

```sh
python -m unittest discover -s tests -v
```

## Analytics

The analytics preview intentionally does not collect or infer visits or sales. Select a privacy-reviewed provider and configure any required notice/consent before live analytics.