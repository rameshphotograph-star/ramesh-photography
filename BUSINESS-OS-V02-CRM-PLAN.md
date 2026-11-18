# Ramesh Photography Business OS — Version 0.2 CRM & Booking

## Goal
Add a separate, mobile-first CRM and booking workflow without changing the existing event gallery, admin authentication, Cloudflare D1 data, or production configuration.

## Proposed modules
1. Enquiries: client name, phone/WhatsApp, event type, event date, venue, source, budget range, notes, consent/permission to contact, status and next follow-up date.
2. Pipeline: New → Contacted → Qualified → Quoted → Follow-up → Won/Lost.
3. Quotes: approved package/service items, inclusions, exclusions, quote validity and owner-approved amount.
4. Bookings: event date/time, venue, assigned crew, agreed services, client acceptance and booking status.
5. Payments: advance, instalments, balance due, receipt reference and due dates; never store card, UPI PIN, bank password or full account credentials.
6. Production checklist: pre-event call, shot list, shoot completed, culling, editing, client proofing, album approval and final delivery.
7. Reports: enquiry conversion, confirmed bookings, upcoming events, receivables and booking value.

## Privacy and security requirements
- Treat client contact details, event dates and financial records as sensitive.
- Before any server storage, define owner-only access, authentication/authorization, audit history, backup and retention/deletion rules.
- Do not put client personal data in Git, source code, demo fixtures or public URLs.
- Use fictional sample data only in Preview.
- No automated WhatsApp/SMS/email sending, quote dispatch, contract acceptance, payment collection or production deployment without explicit owner approval.
- Keep CRM module isolated from the existing gallery and admin flows.

## Delivery plan
- Phase A: clickable local prototype with fictional data and export/import.
- Phase B: validate workflow with owner using fictional records.
- Phase C: security design and permission tests before any server-side storage.
- Phase D: separate Preview deployment and mobile QA.
- Phase E: production rollout only after explicit approval and verified backups.

## Owner decisions needed before real client data is used
- Required fields and pipeline stages.
- Who can view/edit client records (owner only or staff roles).
- Follow-up rules and contact consent wording.
- Quote and payment milestone rules.
- Client data retention period and deletion process.
