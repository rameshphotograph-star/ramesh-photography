import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = [
    "0001_init.sql",
    "0002_platform_support.sql",
    "0003_login_email_throttle.sql",
    "0004_github_admin_identity.sql",
    "0005_rp_crm.sql",
]

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        first = (ROOT / "migrations" / MIGRATIONS[0]).read_text(encoding="utf-8")
        self.db.executescript(first)
        admin_id = self.db.execute(
            "INSERT INTO admins (name,email,password_hash) VALUES (?,?,?)",
            ("Owner", "owner@example.com", "test-hash")
        ).lastrowid
        self.db.execute(
            "INSERT INTO events (admin_id,event_name,event_code) VALUES (?,?,?)",
            (admin_id, "Existing wedding", "EXIST001")
        )
        self.db.commit()
        for filename in MIGRATIONS[1:]:
            sql = (ROOT / "migrations" / filename).read_text(encoding="utf-8")
            self.db.executescript(sql)

    def tearDown(self):
        self.db.close()

    def test_all_expected_tables_exist(self):
        tables = {
            row[0] for row in self.db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        expected = {
            "admins", "admin_sessions", "guest_sessions", "events", "albums",
            "photos", "login_attempts", "photo_delivery_meta",
            "crm_enquiries", "crm_bookings", "crm_payments"
        }
        self.assertTrue(expected.issubset(tables))

    def test_existing_website_records_survive_additive_migrations(self):
        self.assertEqual(
            self.db.execute("SELECT event_name FROM events WHERE event_code='EXIST001'").fetchone()[0],
            "Existing wedding"
        )
        self.assertEqual(
            self.db.execute("SELECT email_hash FROM login_attempts LIMIT 1").fetchone(),
            None
        )
        columns = {row[1] for row in self.db.execute("PRAGMA table_info(admins)")}
        self.assertIn("github_user_id", columns)

    def test_crm_foreign_keys_and_indexes_exist(self):
        for table in ("crm_enquiries", "crm_bookings", "crm_payments"):
            columns = {row[1] for row in self.db.execute(f"PRAGMA table_info({table})")}
            self.assertIn("admin_id", columns)
        indexes = {
            row[0] for row in self.db.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            )
        }
        self.assertIn("idx_crm_enquiries_owner_status", indexes)
        self.assertIn("idx_crm_bookings_owner_date", indexes)
        self.assertIn("idx_crm_payments_booking_date", indexes)

if __name__ == "__main__":
    unittest.main()
