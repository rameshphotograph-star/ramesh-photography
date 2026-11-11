# Ramesh Photography – Cloudflare Pages event photo delivery

This feature branch upgrades the original static starter into a D1-backed event and gallery MVP. The existing production main branch remains unchanged until review and merge.

## Existing infrastructure expected
- Cloudflare Pages project: ramesh-photography
- D1 binding: DB → ramesh-photo-db
- Cloudinary upload preset: optional; signed direct uploads work without one. If configured, it must be a signed preset.
- Existing core tables: admins, events, albums, photos, guest_sessions, admin_sessions (new Preview databases can be initialized with migrations/0001_init.sql)

Expected existing core columns:
- admins: id, name, email, password_hash, is_active, created_at
- events: id, admin_id, event_name, event_type, event_date, venue, event_code, status, created_at
- albums: id, event_id, album_name, created_at
- photos: id, event_id, album_id, object_key, file_name, content_type, file_size, uploaded_at
- admin_sessions: id, admin_id, token_hash, expires_at, created_at

## GitHub-only Admin sign-in

The application can use a single-owner GitHub OAuth App for Admin authentication while keeping Guest Gallery and QR links public. The allowlist is pinned to the authenticated repository owner's immutable GitHub user ID `340888996` (login `rameshphotograph-star`). GitHub tokens are used only for the callback and are not stored.

Create a GitHub OAuth App at https://github.com/settings/developers with:
- Application name: Ramesh Photography Admin
- Homepage URL: the exact Pages Preview or Production base URL
- Authorization callback URL: the exact `GITHUB_OAUTH_REDIRECT_URI` value below
- Device Flow: disabled

The OAuth flow uses random state, PKCE S256, `read:user` and `user:email` scopes, exact HTTPS callback validation, and requires the allowlisted numeric GitHub ID plus a verified primary email. It links the only existing active admin row on first sign-in, or creates the first admin row if the database is empty. If multiple admin rows exist and none is linked, it fails closed.

When all three OAuth variables are configured, email/password login and bootstrap are disabled, and existing session cookies are accepted only when their admin row is linked to the allowlisted GitHub ID. When they are absent, the Preview password login remains available for testing only.

### Preview OAuth variables

Set in Pages → Settings → Preview → Variables and secrets:
- `GITHUB_OAUTH_CLIENT_ID` (Text)
- `GITHUB_OAUTH_CLIENT_SECRET` (Secret)
- `GITHUB_OAUTH_REDIRECT_URI` (Text): `https://feature-photo-delivery-platf.ramesh-photography.pages.dev/api/admin/oauth/github/callback`

For the GitHub OAuth App's Preview test, set its Homepage URL to `https://feature-photo-delivery-platf.ramesh-photography.pages.dev` and its callback URL to the exact Preview URI above. After saving Preview variables, trigger/confirm a new Preview deployment before testing.

### Production OAuth variables

Set the same three variables separately under Pages → Settings → Production:
- `GITHUB_OAUTH_CLIENT_ID` (Text)
- `GITHUB_OAUTH_CLIENT_SECRET` (Secret)
- `GITHUB_OAUTH_REDIRECT_URI` (Text): `https://ramesh-photography.pages.dev/api/admin/oauth/github/callback`

Before Production deployment, update the GitHub OAuth App Homepage URL and callback URL to the exact Production values above. The app uses one callback URL at a time; after changing it from Preview to Production, Preview GitHub OAuth will no longer work until the callback is switched back.

## Required Cloudflare production variables/secrets
Set in Pages → Settings → Variables and secrets → Production:
- CLOUDINARY_CLOUD_NAME (Text)
- CLOUDINARY_API_KEY (Text)
- CLOUDINARY_API_SECRET (Secret; never expose in browser JavaScript)
- CLOUDINARY_UPLOAD_PRESET (Text; optional; only set this when the named preset is configured as signed in Cloudinary)
- ADMIN_BOOTSTRAP_KEY (Secret; only needed for legacy password-based bootstrap when GitHub OAuth is not configured)

Keep the existing Production D1 binding named DB. Do not put secrets in GitHub files, browser JavaScript, HTML or README.

## Required Cloudflare Preview variables/secrets
Set these separately in Pages → Settings → Preview → Variables and secrets:
- CLOUDINARY_CLOUD_NAME (Text)
- CLOUDINARY_API_KEY (Text)
- CLOUDINARY_API_SECRET (Secret)
- ADMIN_BOOTSTRAP_KEY (Secret; use a new random 32-byte value, different from any Production bootstrap key)
- CLOUDINARY_FOLDER_PREFIX (Text; set to ramesh-photography-preview so test uploads stay in a separate Cloudinary folder)
- CLOUDINARY_UPLOAD_PRESET is optional; when omitted, the app signs and sends only the Preview folder and timestamp. If set, the named preset must be configured as signed in Cloudinary.

Use the same Cloudinary account credentials only if you intend to store Preview test files in that Cloudinary account. Preview uploads will be written under ramesh-photography-preview/<event-code>, separated from the Production ramesh-photography/<event-code> folders.

## Database support tables
The admin bootstrap, login and authenticated admin-session paths safely ensure support schema when needed:
- login_attempts (failed-login throttling by IP and normalized account identifier)
- photo_delivery_meta (Cloudinary URLs and image/video metadata)

The support-table initializer adds the account-throttle column to an existing login_attempts table without dropping data. The standalone migration is migrations/0003_login_email_throttle.sql.

This is additive and does not drop or recreate the existing core tables. The equivalent standalone migrations are provided at migrations/0002_platform_support.sql and migrations/0003_login_email_throttle.sql for manual/local use. For a brand-new, empty Preview database, apply migrations/0001_init.sql once, followed by migrations/0002_platform_support.sql. This initial migration uses CREATE TABLE IF NOT EXISTS and does not drop data; Production already has the core tables and does not need it.

## First admin setup
After reviewing and deploying this branch, open /admin.html. If the admins table is empty:
1. Enter the exact ADMIN_BOOTSTRAP_KEY configured in Cloudflare.
2. Set admin name, email and a strong password (12+ characters).
3. Create the first account. Bootstrap locks after an admin row exists.
4. Sign in.
The bootstrap key is only sent over HTTPS to the Pages Function. When GitHub OAuth is configured, the first allowlisted GitHub sign-in provisions/links the Admin account and password bootstrap is disabled. Without OAuth variables, passwords use the Preview-only PBKDF2 compatibility setting and must not be used for Production. Sessions use HttpOnly, Secure, SameSite=Strict cookies.

## Included in this branch
- Single-owner GitHub OAuth Admin sign-in with state + PKCE S256, verified primary-email verification, immutable GitHub user-ID allowlist, and D1 identity binding
- Legacy Preview-only admin bootstrap/login/logout (automatically disabled when GitHub OAuth is fully configured)
- Admin event listing, event creation and archival
- Album creation
- Signed Cloudinary image/video uploads without requiring an upload preset; optional presets must be signed, and API secret stays server-side
- D1 media metadata and public event gallery
- Paginated gallery loading, optimized Cloudinary thumbnails, album filters, photo/video preview
- QR code generation/download and original file download links
- /api/health for a safe readiness check that reports only booleans and missing table names (never secret values)

## Deliberate limitation
AI selfie/face matching is not enabled. The UI explains this clearly. Do not advertise My Photos face matching until a reviewed on-device face model, explicit-consent UX, model assets and cross-device tests are completed.

## Review and deploy
Review feature/photo-delivery-platform (including /diagnostics.html) before merging into main. Merge may trigger the existing Cloudflare Pages automatic production deployment. Confirm Production variables/secrets and the DB binding before merge. Preview builds use the Preview environment; configure a separate preview D1 database if you plan to create test events, rather than pointing preview traffic at production client data.


Preview deployments are refreshed whenever a new commit is pushed to this feature branch. After changing Preview variables/secrets, confirm the newest Cloudflare Pages Preview deployment has completed before testing `/admin.html` or `/diagnostics.html`.

## Manual verification checklist
- First admin bootstrap succeeds only while admins is empty and creates the support tables.
- Bad admin credentials fail; login attempts are throttled to 5 per IP and 10 per normalized account identifier in a rolling 15-minute window.
- State-changing admin API calls reject requests without an exact same-origin Origin header.
- Malformed or oversized session cookie values fail closed.
- Session expiry and logout work.
- Event creation returns a unique code and only its owner can manage it.
- Signed Cloudinary upload works for an image and a video.
- Media metadata is stored in D1 and appears in the public event gallery.
- Archived events are no longer publicly accessible; existing media rows remain.
- QR code opens the event URL on a mobile phone.
- Gallery pages images in batches, album filters work, and file downloads work in the browser.


Preview bootstrap secret refresh: deploy the latest feature-branch Preview build after updating ADMIN_BOOTSTRAP_KEY in the Preview environment. This note does not change Production configuration.


## Preview password-hash compatibility note
Cloudflare Workers rejects a single Web Crypto PBKDF2 derive operation above 100,000 iterations. Preview bootstrap currently uses PBKDF2-HMAC-SHA256 at 100,000 iterations so first-admin creation works on Workers. This is a platform-compatibility setting below current OWASP PBKDF2-HMAC-SHA256 guidance, and it is not approved for Production use. Before Production release, replace it with a reviewed Workers-compatible stronger password KDF (preferably Argon2id) and add runtime-level tests. Do not promote this Preview password-hashing implementation as production-ready.


Preview deployment refresh: redeploy the feature branch after updating the CLOUDINARY_CLOUD_NAME Preview variable so the new value is active in Pages Functions.


## Production security review — work in progress

- Admin state-changing API routes now enforce an exact same-origin Origin check in addition to the Secure, HttpOnly, SameSite=Strict session cookie.
- Login throttling now applies both per client IP (5 failed attempts / 15 minutes) and per normalized account identifier (10 failed attempts / 15 minutes); existing D1 data is preserved when adding the email_hash column.
- Expired admin sessions are cleaned up when a new login succeeds.
- The current Preview password hash uses PBKDF2-HMAC-SHA256 at 100,000 iterations because Cloudflare Workers rejects a single deriveBits request above that value. This is below current OWASP guidance for PBKDF2-HMAC-SHA256 and is not Production-approved. A stronger KDF must be selected and runtime-benchmarked against the actual Cloudflare Workers plan limits before Production merge.
- Production deployment remains blocked until the password-authentication design is resolved and the full security checklist is signed off.
