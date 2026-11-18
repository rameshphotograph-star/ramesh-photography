# Ramesh Photography — Corporate Business OS

## Vision
Build Ramesh Photography into a premium, process-driven Photography & Cinematic Films business with a consistent client experience, measurable marketing, controlled operations, and reliable financial visibility.

Brand direction already established:
- Brand: Ramesh Photography
- Services: Wedding Photography & Cinematic Films
- Positioning: premium, luxury, international editorial style
- Visual system: matte black, ivory, charcoal, muted champagne
- Tagline: “Every Frame. A Timeless Story.”

## Current platform baseline (repository audit, 18 Nov 2026)
The existing Cloudflare Pages application is an event photo-delivery platform, not yet a complete business operating system. The repository already contains:
- Public event/gallery flow and event-code access
- Admin event and album management
- Signed Cloudinary media upload flow
- D1-backed event/media metadata
- QR-code and download workflow
- GitHub OAuth admin-authentication implementation
- Health/diagnostics endpoints and automated validation tests

Do not rebuild these capabilities without a demonstrated need. Extend them behind a separate development branch and preserve Production.

## Target operating model

### 1. Lead & CRM
- Capture enquiries from website, Instagram, WhatsApp and referrals
- Store client, event date, venue, service interest, budget range, source and next action
- Pipeline: New → Contacted → Qualified → Quoted → Follow-up → Won/Lost
- Duplicate detection, reminders, enquiry history and owner dashboard
- Consent-aware communication; no unsolicited bulk messaging

### 2. Packages, quotations & booking
- Editable service/package catalogue for photography, films, albums, drone and add-ons
- Quote builder with inclusions, exclusions, validity, taxes and payment milestones
- Booking confirmation, agreement checklist, advance/payment ledger and receipts
- Calendar conflict checks and event crew/resource planning
- Never invent prices, availability, tax treatment or legal terms; owner approval required

### 3. Client experience
- Client enquiry acknowledgement and guided discovery
- Pre-event checklist and timeline collection
- Event-day shot list / team brief
- Proofing, selection, album approval and delivery status
- Secure event galleries, QR access, expiry/retention policy and support path
- Feedback and review request after delivery

### 4. Marketing & growth
- Brand-consistent website portfolio and service landing pages
- Content calendar for Instagram/Facebook: Reels, carousels, stories and case studies
- Caption, hashtag and creative brief generation from real portfolio work
- Campaign tracking with UTM/source attribution
- Weekly measurement: reach, profile visits, enquiries, qualified leads, bookings and revenue
- No fake reviews, follower buying, spam, or automatic publishing without review

### 5. Finance & management reporting
- Enquiry-to-booking conversion, average booking value and revenue by service
- Advance due, balance due, vendor/crew costs, travel/production costs and gross margin
- Monthly cash-flow and profitability view
- Expense evidence and exportable accountant-ready reports
- Financial data access restricted to the business owner

### 6. AI agent team
- Business Analyst: weekly KPI summary and operational risks
- Marketing Strategist: content and campaign recommendations
- Content Producer: drafts captions, scripts, shot lists and client messages
- Sales Assistant: drafts enquiry responses, follow-ups and quotations from approved data
- Operations Coordinator: checklists, schedules and delivery tracking
- Finance Analyst: summarizes recorded income/cost data
- Software Engineer / QA: implements features, runs tests and reviews security

Agents may prepare and recommend. External messages, publishing, payments, contract acceptance, deletion, production deployment and other consequential actions require explicit owner approval.

## Technical approach
- Preserve the existing Cloudflare Pages + Functions + D1 + Cloudinary architecture where suitable.
- Use additive database migrations; never drop or overwrite production data as a shortcut.
- Build and test in isolated feature branches and Preview environments.
- Keep credentials in Cloudflare secrets / approved secret stores, never in source files.
- Add role-based access, audit trail, backups, retention controls and export paths before handling sensitive client/finance data.
- Add automated tests for permissions, validation, uploads, booking calculations and data isolation.
- Keep a manual fallback for client communication and gallery delivery.

## Delivery phases
1. **Audit & stabilization** — verify current production/preview deployments, database bindings, secrets configuration, backups, auth and tests.
2. **Business foundation** — CRM schema, enquiry capture, pipeline and owner dashboard.
3. **Revenue workflow** — packages, quotation, booking, payment milestones and calendar.
4. **Client operations** — event checklist, gallery delivery lifecycle, approvals and feedback.
5. **Growth engine** — website conversion, content workflow, campaign tracking and lead attribution.
6. **Management intelligence** — financial reporting, KPIs, weekly review and exception alerts.
7. **Hardening & launch** — security review, data protection, mobile QA, operational runbook and production sign-off.

## Acceptance criteria
- Every enquiry has an owner, status, source and next action.
- No booking is confirmed without an owner-approved quote and recorded client acceptance.
- Payment balances reconcile to recorded transactions.
- Client galleries are isolated by event and access policy.
- Marketing results can be traced from source to enquiry and booking.
- Dashboard figures reconcile to underlying records.
- Backups, restore procedure, audit history and permissions are tested.
- Production deployment occurs only after preview QA and explicit owner approval.

## Open inputs to collect only when implementation reaches them
- Approved package prices and inclusions
- Current enquiry channels and preferred response wording
- Booking/advance/balance rules
- Staff/crew roles and calendar constraints
- Client gallery retention and privacy policy
- Accounting/tax requirements confirmed by the owner's accountant

## Non-goals
- Do not promise guaranteed bookings, revenue or follower growth.
- Do not automate deceptive engagement, fake testimonials or spam.
- Do not store passwords, API keys, payment credentials or private client media in Git.
- Do not claim Claude or any external agent has been invoked unless an actual integration is connected and used.
