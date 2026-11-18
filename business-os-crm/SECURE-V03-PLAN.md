# Business OS v0.3 — secure multi-device CRM implementation

## Status
Planning and database foundation only. This document does not mean authentication, API routes, scheduled backups, or production security are implemented. The v0.2 local prototype remains the active app until a reviewed v0.3 release is explicitly deployed.

## Non-negotiable isolation
- Keep this app in `business-os-crm/`.
- Use a NEW Cloudflare D1 database dedicated to CRM. Never bind CRM to the existing event-gallery D1 database `ramesh-photo-db`.
- Do not modify gallery routes, admin auth, gallery database, or existing production Pages project.
- Keep real client information out of Preview and GitHub. Use fictional data only.

## Default access model
- Owner: full access, user management, finance, exports, restore, deletion and audit history.
- Staff: enquiries, bookings and shoot checklist only. No user management, finance exports, bulk deletion or restore.
- Staff access must be explicitly enabled per email by the owner; no public self-registration.
- All write APIs must enforce server-side role checks. Hiding buttons in the UI is not authorization.

## Data model
Migration `migrations/0001_crm_core.sql` defines CRM-only users/sessions, enquiries, bookings, booking checklist items, individual payment entries, audit records and backup run metadata. Monetary values are integer INR paise? No: store whole INR only; validate all amounts as non-negative integers and prevent received totals exceeding agreed totals. The schema uses whole INR integer fields.

## Required implementation phases
1. API foundation: Pages Functions under this app, D1 prepared statements, strict input validation, same-origin/CSRF protection, safe errors, rate limits, secure session cookies, hashed opaque session tokens, expiry and logout.
2. Identity: Cloudflare Access identity verification using signed JWT (team issuer + configured AUD); map verified email to active CRM user; reject unknown emails. Never trust a client-supplied role or email header.
3. Data APIs: CRUD for enquiries/bookings/checklist/payment entries; owner/staff authorization; audit log for every mutation; server-side computed balances.
4. UI: replace localStorage writes with authenticated APIs; retain a clearly labeled offline/export path only if designed safely; do not silently mix local and cloud records.
5. Backups: scheduled D1 export to private R2 bucket (or an equivalent protected destination), encryption at rest, retention policy, success/failure monitoring, and a tested restore procedure. JSON download alone is not a server backup.
6. Notifications: follow-up dashboard first. WhatsApp sending requires explicit opt-in, approved WhatsApp Business Platform setup, template approval where applicable, secure credentials and a user-confirmed send action. Never send automatically during the prototype.
7. Verification: migration tests against a new CRM D1 database, role/authorization tests, CSRF/session tests, backup restore drill, mobile browser tests, and no-regression check for existing gallery site.
8. Release: separate Pages project `ramesh-photo-crm`, separate CRM D1 binding, secrets/Access settings configured in Cloudflare dashboard, reviewed deployment and owner acceptance before real client data.

## Cloudflare resources the owner must create/configure
- New D1 database dedicated to CRM (do not select `ramesh-photo-db` or `ramesh-photo-preview-db`).
- Cloudflare Access application/policy protecting the CRM app and API, with owner and approved staff emails; configure the Access AUD and team issuer as environment values.
- Private R2 bucket for scheduled backups if R2 is chosen.
- Separate Pages project settings for the CRM. The currently deployed static prototype is not yet wired to these services.

## Important limitations
- This migration is a schema foundation only. It has not been applied to Cloudflare.
- Do not create or paste passwords, API tokens, OAuth secrets, Access service tokens or database credentials in chat or GitHub.
- No WhatsApp, SMS, email or payment provider integration is implemented by this document.
- Do not enter real client data until all phases and release checks are complete.
