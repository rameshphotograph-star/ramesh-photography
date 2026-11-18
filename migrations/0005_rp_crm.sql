-- Additive RP CRM tables for enquiries, bookings and payment tracking.
-- Existing website/admin/event/gallery tables are preserved.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  event_type TEXT NOT NULL DEFAULT 'other',
  event_date TEXT,
  venue TEXT,
  package_name TEXT,
  quoted_amount REAL NOT NULL DEFAULT 0 CHECK (quoted_amount >= 0),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','follow_up','quoted','converted','lost')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS crm_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  enquiry_id INTEGER,
  event_id INTEGER,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  event_type TEXT NOT NULL DEFAULT 'other',
  event_date TEXT,
  venue TEXT,
  package_name TEXT,
  total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  advance_amount REAL NOT NULL DEFAULT 0 CHECK (advance_amount >= 0),
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('tentative','confirmed','completed','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (enquiry_id) REFERENCES crm_enquiries(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS crm_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  booking_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (booking_id) REFERENCES crm_bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_enquiries_owner_status
  ON crm_enquiries(admin_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_enquiries_phone
  ON crm_enquiries(admin_id, phone);
CREATE INDEX IF NOT EXISTS idx_crm_bookings_owner_date
  ON crm_bookings(admin_id, event_date, status);
CREATE INDEX IF NOT EXISTS idx_crm_bookings_enquiry
  ON crm_bookings(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_crm_payments_booking_date
  ON crm_payments(admin_id, booking_id, payment_date);
