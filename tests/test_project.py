from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


class SiteProjectTests(unittest.TestCase):
    def test_landing_page_has_localized_assets_and_security_headers(self):
        html = (PUBLIC / "index.html").read_text()
        self.assertIn('src="site.js" defer', html)
        self.assertIn('data-language="en"', html)
        self.assertIn('data-language="fr"', html)
        self.assertIn("/store/", html)
        headers = (PUBLIC / "_headers").read_text()
        self.assertIn("Content-Security-Policy", headers)
        self.assertIn("script-src 'self'", headers)

    def test_static_catalogue_checkout_is_explicitly_disabled(self):
        js = (PUBLIC / "store" / "store.js").read_text()
        html = (PUBLIC / "store" / "index.html").read_text()
        self.assertIn("checkoutAvailable = false", js)
        self.assertIn("checkoutUnavailable", js)
        self.assertIn("disabled", html)
        self.assertIn('data-language="fr"', html)
        self.assertIn("nameFr", js)
        self.assertIn("initializeStore", js)

    def test_shop_migration_has_safe_defaults_and_constraints(self):
        db = sqlite3.connect(":memory:")
        db.executescript((ROOT / "migrations" / "0001_shop.sql").read_text())
        db.executescript((ROOT / "migrations" / "0002_french_products.sql").read_text())
        columns = {row[1] for row in db.execute("PRAGMA table_info(products)")}
        self.assertTrue({"name_fr", "description_fr", "active", "price_pence"}.issubset(columns))
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO products (id, name, price_pence) VALUES (?, ?, ?)", ("bad", "Bad", 0))
        row = db.execute("INSERT INTO products (id, name, price_pence) VALUES (?, ?, ?) RETURNING active", ("sample", "Sample", 100)).fetchone()
        self.assertEqual(row[0], 0)

    def test_checkout_never_trusts_client_price_or_exposes_keys(self):
        checkout = (ROOT / "functions" / "api" / "checkout.js").read_text()
        storefront = (PUBLIC / "store" / "store.js").read_text()
        self.assertIn("SELECT id, name, price_pence, active FROM products", checkout)
        self.assertIn("unit_amount", checkout)
        self.assertIn("env.STRIPE_SECRET_KEY", checkout)
        self.assertIn("env.STRIPE_WEBHOOK_SECRET", checkout)
        self.assertIn("INSERT INTO orders", checkout)
        self.assertNotIn("STRIPE_SECRET_KEY", storefront)
        self.assertIn("content-length", checkout.lower())

    def test_webhook_checks_signature_and_order_amount(self):
        webhook = (ROOT / "functions" / "api" / "stripe-webhook.js").read_text()
        self.assertLess(webhook.index("verifyStripeSignature(rawBody"), webhook.index("JSON.parse(rawBody)"))
        self.assertIn("TOLERANCE_SECONDS = 300", webhook)
        self.assertIn("INSERT OR IGNORE INTO stripe_events", webhook)
        self.assertIn("amount_total = ? AND currency = 'gbp'", webhook)

    def test_catalogue_supports_locales_and_limits_results(self):
        catalog = (ROOT / "functions" / "api" / "catalog.js").read_text()
        self.assertIn("COALESCE(name_fr, name)", catalog)
        self.assertIn("env.DB.prepare(sql).bind(...fallbackBindings).all()", catalog)
        self.assertIn("LIMIT 100", catalog)

    def test_analytics_route_is_noindex_and_disclaims_sample_data(self):
        analytics = (PUBLIC / "analytics-preview" / "index.html").read_text()
        self.assertIn('name="robots" content="noindex, nofollow"', analytics)
        self.assertIn("Sample data", analytics)
        self.assertIn("does not track visitors", analytics)


if __name__ == "__main__":
    unittest.main()
