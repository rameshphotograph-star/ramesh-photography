# Ramesh Photography – Cloudflare Pages event photo delivery

This feature branch upgrades the original static starter into a D1-backed event and gallery MVP. The existing production main branch remains unchanged until review and merge.

## Existing infrastructure expected
- Cloudflare Pages project: ramesh-photography
- D1 binding: DB → ramesh-photo-db
- Cloudinary upload preset: ramesh_photography (signed mode)
- Existing core tables: admins, events, albums, photos, guest_sessions, admin_sessions

Expected existing core columns:
- admins: id, name, email, password_hash, is_active, created_at
- events: id, admin_id, event_name, event_type, event_date, venue, event_code, status, created_at
- albums: id, event_id, album_name, created_at
- photos: id, event_id, album_id, object_key, file_name, content_type, file_size, uploaded_at
- admin_sessions: id, admin_id, token_hash, expires_at, created_at

## Required Cloudflare production variables/secrets
Set in Pages → Settings → Variables and secrets → Production:
- CLOUDINARY_CLOUD_NAME (Text)
- CLOUDINARY_API_KEY (Text)
- CLOUDINARY_API_SECRET (Secret; never expose in browser JavaScript)
- CLOUDINARY_UPLOAD_PRESET (Text; value ramesh_photography; if omitted the app defaults to this preset)
- ADMIN_BOOTSTRAP_KEY (Secret; generate and retain a long random value)

Keep the existing D1 binding named DB. Do not put secrets in GitHub files, browser JavaScript, HTML or README.

## Database support tables
The admin bootstrap, login and authenticated admin-session paths safely ensure the two support tables with CREATE TABLE IF NOT EXISTS when needed:
- login_attempts (failed-login throttling)
- photo_delivery_meta (Cloudinary URLs and image/video metadata)

This is additive and does not drop or recreate the existing core tables. The equivalent standalone migration is provided at migrations/0002_platform_support.sql for manual/local use. Do not rerun the original 0001_init.sql against a database that already has the six core tables.

## First admin setup
After reviewing and deploying this branch, open /admin.html. If the admins table is empty:
1. Enter the exact ADMIN_BOOTSTRAP_KEY configured in Cloudflare.
2. Set admin name, email and a strong password (12+ characters).
3. Create the first account. Bootstrap locks after an admin row exists.
4. Sign in.
The bootstrap key is only sent over HTTPS to the Pages Function. Passwords are stored as PBKDF2-SHA-256 hashes. Sessions use HttpOnly, Secure, SameSite=Strict cookies.

## Included in this branch
- Admin bootstrap and login/logout
- Admin event listing, event creation and archival
- Album creation
- Signed Cloudinary image/video uploads; API secret stays server-side
- D1 media metadata and public event gallery
- Paginated gallery loading, optimized Cloudinary thumbnails, album filters, photo/video preview
- QR code generation/download and original file download links
- /api/health for a safe readiness check that reports only booleans and missing table names (never secret values)

## Deliberate limitation
AI selfie/face matching is not enabled. The UI explains this clearly. Do not advertise My Photos face matching until a reviewed on-device face model, explicit-consent UX, model assets and cross-device tests are completed.

## Review and deploy
Review feature/photo-delivery-platform (including /diagnostics.html) before merging into main. Merge may trigger the existing Cloudflare Pages automatic production deployment. Confirm Production variables/secrets and the DB binding before merge. Preview builds use the Preview environment; configure a separate preview D1 database if you plan to create test events, rather than pointing preview traffic at production client data.

## Manual verification checklist
- First admin bootstrap succeeds only while admins is empty and creates the support tables.
- Bad admin credentials fail and login attempts are throttled.
- Session expiry and logout work.
- Event creation returns a unique code and only its owner can manage it.
- Signed Cloudinary upload works for an image and a video.
- Media metadata is stored in D1 and appears in the public event gallery.
- Archived events are no longer publicly accessible; existing media rows remain.
- QR code opens the event URL on a mobile phone.
- Gallery pages images in batches, album filters work, and file downloads work in the browser.
