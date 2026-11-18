-- Ramesh Photography CRM v0.3
-- Apply ONLY to a NEW, SEPARATE Cloudflare D1 database named for the CRM.
-- Never apply this migration to the existing event-gallery DB (ramesh-photo-db).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','staff')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_user ON crm_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_expiry ON crm_sessions(expires_at);

CREATE TABLE IF NOT EXISTS crm_enquiries (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  phone TEXT,
  event_type TEXT NOT NULL,
  event_date TEXT,
  venue TEXT,
  source TEXT,
  budget_inr INTEGER NOT NULL DEFAULT 0 CHECK (budget_inr >= 0),
  follow_up_date TEXT,
  pipeline_status TEXT NOT NULL DEFAULT 'New',
  contact_consent TEXT NOT NULL DEFAULT 'Not recorded',
  notes TEXT,
  created_by TEXT REFERENCES crm_users(id),
  updated_by TEXT REFERENCES crm_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_enquiries_followup ON crm_enquiries(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_crm_enquiries_event_date ON crm_enquiries(event_date);
CREATE INDEX IF NOT EXISTS idx_crm_enquiries_status ON crm_enquiries(pipeline_status);

CREATE TABLE IF NOT EXISTS crm_bookings (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT REFERENCES crm_enquiries(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  phone TEXT,
  event_type TEXT NOT NULL,
  event_date TEXT,
  venue TEXT,
  package_services TEXT,
  assigned_crew TEXT,
  total_agreed_inr INTEGER NOT NULL DEFAULT 0 CHECK (total_agreed_inr >= 0),
  amount_received_inr INTEGER NOT NULL DEFAULT 0 CHECK (amount_received_inr >= 0),
  booking_status TEXT NOT NULL DEFAULT 'Confirmed',
  created_by TEXT REFERENCES crm_users(id),
  updated_by TEXT REFERENCES crm_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (amount_received_inr <= total_agreed_inr)
);
CREATE INDEX IF NOT EXISTS idx_crm_bookings_event_date ON crm_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_crm_bookings_status ON crm_bookings(booking_status);

CREATE TABLE IF NOT EXISTS crm_booking_checks (
  booking_id TEXT NOT NULL REFERENCES crm_bookings(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL CHECK (step_index BETWEEN 0 AND 9),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  updated_by TEXT REFERENCES crm_users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (booking_id, step_index)
);

CREATE TABLE IF NOT EXISTS crm_payment_entries (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES crm_bookings(id) ON DELETE CASCADE,
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  payment_date TEXT NOT NULL,
  method TEXT,
  reference_note TEXT,
  created_by TEXT REFERENCES crm_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_payment_entries_booking ON crm_payment_entries(booking_id);

CREATE TABLE IF NOT EXISTS crm_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES crm_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_audit_created ON crm_audit_log(created_at);

CREATE TABLE IF NOT EXISTS crm_backup_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','failed')),
  storage_key TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
