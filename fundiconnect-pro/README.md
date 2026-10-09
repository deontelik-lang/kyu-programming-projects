# FundiConnect Pro

**Kenya's Trusted Skilled Workers Marketplace**

FundiConnect Pro is a Kenya-first marketplace MVP connecting customers with electricians, CCTV installers, and WiFi/network technicians. This repository contains the working browser UI, same-origin HTTP API, PostgreSQL migrations, operational scripts, and CI checks for both the Fundi services marketplace and CampusConnect student/opportunity hubs.

> **Release status:** functional MVP, not yet a fully production-hardened marketplace. The deployed site is live, but no payments are taken and identity checks, SMS OTP, email verification, live dispatch, and several planned features are not connected.

## Live preview

- Website: https://t1lmltxf.basicdeploy.com
- Source branch: https://github.com/deontelik-lang/kyu-programming-projects/tree/fundiconnect-pro-mvp

## Implemented features

- Customer and fundi registration, email/phone login, password hashing with Node.js scrypt, logout, and database-backed sessions.
- Server-side role checks for customers, fundis, and administrator endpoints.
- Fundi profiles with category, professional title, bio, location, skills, experience, and an availability toggle.
- Search/filter by service category and county/town plus text search and sorting.
- Persistent quote requests and booking status transitions: pending, accepted, assigned, traveling, in progress, completed, and cancelled, with validated transitions.
- Notifications for new bookings, status changes, and reviews.
- Reviews tied to completed customer bookings; a database constraint prevents a second review for the same booking.
- Transparent deterministic trust score derived from review volume, rating, completed jobs, verification level, observed responses, and profile completeness. It is not an AI model, background check, or guarantee of quality; new profiles have limited history.
- Admin summary, recent booking list, and a protected manual verification-level control.
- Audit events, parameterized database queries, basic rate limiting, security response headers, request-size limits, origin checks, and session revocation.
- Numbered SQL migrations, code syntax checks, a browser-script check, guarded integration tests, and a GitHub Actions CI workflow.

## CampusConnect super-app modules

The app includes 13 database-backed opportunity hubs: student gigs, jobs, internships/graduate roles, housing, products, events, courses/skills academy listings, business directory, community posts, transport/delivery listings, student services, alumni/mentorship and professional service offers. Members can publish listings, search by hub and location, apply or inquire, RSVP, save items, comment on campus posts, exchange persistent listing messages, report abusive listings, and review incoming applications through owner dashboards. User profiles can include campus, course, study level, graduation year, organisation, portfolio and skills; a printable CV preview uses that profile data. Emergency request records are persistent but do not dispatch responders. A local rules-based study/career guide and user-input cost worksheet are included; neither is a connected generative AI service or external market-price engine.

The initial version implements the core flows and provides clear integration boundaries, not every item from the full vision. Wallet transfers, M-Pesa, rent collection, paid ticketing, payout/escrow, real OTP/email delivery, identity document validation/background checks, live GPS, push notifications, real-time WebSocket chat, course content delivery, employer integrations, referral reward awards and AI-provider calls are **not enabled**.

## Stack

- Node.js 24 LTS (tested with 24.21.0)
- PostgreSQL
- pg database driver
- Responsive HTML/CSS and vanilla JavaScript frontend served from the same origin

The current single-container stack was chosen to get the core marketplace working in the available low-memory deployment. It deliberately keeps database access and permission checks on the server. As usage grows, split frontend and NestJS/Next.js services, move distributed rate limits and queues to Redis, add managed object storage and search, and introduce independent migration and deployment pipelines.

## Run locally

1. Install Node.js 24 LTS and PostgreSQL.
2. Copy **.env.example** to **.env** and set **DATABASE_URL**. Do not commit **.env**.
3. Install dependencies and run:

   \`\`\`bash
   npm ci
   npm test
   npm start
   \`\`\`

4. Open http://localhost:8080.

The server listens on **0.0.0.0:8080** by default. On Linux x64/arm64, **run.sh** prefers the pinned Node.js 24.21.0 runtime if installed and fails closed if the current runtime is older than Node 24. Install the self-contained runtime with `sh scripts/install-node-runtime.sh`; the installer validates its archive against Node.js's official SHA-256 manifest before extracting it. The runtime binary is ignored by Git; only bootstrap scripts are committed. At startup, the server applies new numbered SQL files once and seeds the three launch categories. Use a dedicated development database locally, not a production database.

## Admin access

Admin role is **not** granted by selecting a role or claiming an email in the public sign-up form. First create the account, verify ownership independently, and then use a trusted operator shell:

\`\`\`bash
npm run admin:promote -- administrator@example.com --confirm-identity
\`\`\`

To remove the administrator role:

\`\`\`bash
npm run admin:promote -- administrator@example.com --demote
\`\`\`

The script requires DATABASE_URL, updates an existing account only, and writes an audit event. This MVP does not verify email ownership itself; never promote an account based only on an unverified email claim. Admin verification controls should only be used after evidence has been reviewed through a separate trusted process. National ID/certificate uploads and automated background checks are not yet implemented.

## API summary

All endpoints are same-origin under **/api**. Authenticated sessions use an opaque random cookie; only the hash of the session token is stored in PostgreSQL.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | **/api/health** | Application/database health |
| GET | **/api/hubs/types** | Supported hubs |
| GET | **/api/hubs/listings** | Search listings by hub, keyword, location |
| POST | **/api/hubs/listings** | Publish a job, gig, event, product, housing or other hub listing |
| POST | **/api/hubs/listings/:id/actions** | Apply, inquire, RSVP, enrol interest, mentor request or save |
| GET | **/api/hubs/activity** | User-owned listings, applications, points summary |
| GET/POST | **/api/hubs/listings/:id/comments** | Community replies |
| GET/POST | **/api/hubs/messages** | Persistent listing messages (not live push) |
| POST | **/api/hubs/listings/:id/report** | Report potentially abusive listings |
| GET/POST | **/api/favorites** | Saved professionals/listings |
| GET/POST | **/api/emergency-requests** | Record and list emergency requests (no dispatch) |
| PATCH | **/api/platform-profile** | Update campus/career identity fields |
| GET | **/api/cv** | Build CV preview data |
| GET | **/api/categories** | Launch categories |
| GET | **/api/fundis** | Search/filter available fundi profiles |
| GET | **/api/fundis/:profileId** | Public fundi profile |
| POST | **/api/auth/register** | Customer/fundi sign-up |
| POST | **/api/auth/login** | Email or phone + password |
| POST | **/api/auth/logout** | Revoke current session |
| GET | **/api/me** | Current account and fundi profile |
| PATCH | **/api/fundi/profile** | Update signed-in fundi profile |
| GET | **/api/bookings** | Participant bookings (admin can view platform bookings) |
| POST | **/api/bookings** | Customer requests a quote |
| PATCH | **/api/bookings/:id/status** | Change an authorized booking status |
| POST | **/api/reviews** | Review a completed booking once |
| GET | **/api/notifications** | Current account notifications |
| POST | **/api/notifications/read** | Mark notifications read |
| GET | **/api/admin/overview** | Admin-only summary |
| GET | **/api/admin/fundis** | Admin-only fundi verification queue |
| PATCH | **/api/admin/fundis/:id/verification** | Admin-only manual verification-level update |

### Core data model

- users, fundi_profiles, categories
- bookings, reviews
- user_sessions, notifications
- audit_logs, schema_migrations

Migrations are numbered and run once per database. Add a new numbered migration for future schema changes; do not edit an already-applied migration in a deployed environment.

## Test and validation commands

Syntax/static check:

\`\`\`bash
npm test
\`\`\`

Live integration test (creates temporary accounts and bookings, then removes its own test records):

\`\`\`bash
FUNDICONNECT_RUN_INTEGRATION_TESTS=1 npm run test:integration
\`\`\`

Set **FUNDICONNECT_BASE_URL** if the server is not on **http://127.0.0.1:8080**. The test requires DATABASE_URL to clean up its temporary test users, and should only run against a development or staging database. It is intentionally excluded from automatic CI because CI has no production database credentials.

## Security notes

- Passwords are never stored in plain text; scrypt salts and password hashes are persisted.
- Random session tokens are sent through HttpOnly, SameSite cookies; hashed token values and expiry are stored in the database. Secure cookies are enabled behind HTTPS.
- SQL statements use parameters; input bodies have a size limit; profile/booking/review actions enforce account roles and record ownership.
- Reviews require an owned completed booking and the database enforces one review per booking.
- Admin privileges are granted by operator CLI, not public registration.
- The in-memory rate limiter is a single-process safeguard only; it resets on restart and is not suitable for multiple app instances. Use Redis or an edge/WAF rate limiter before scaling.
- The browser UI escapes user-provided values before inserting them into HTML. Continue to validate new UI/API fields.
- This MVP does not collect identity documents or sensitive payment credentials. Do not add them without secure storage, access controls, retention rules, and a reviewed privacy process.

## Not implemented yet

- Real phone OTP and email verification, password recovery, MFA/passkeys
- Upload pipeline for IDs, certificates, work portfolios, and videos
- Email/SMS/push delivery to real devices
- Real-time chat and GPS technician tracking
- Safaricom Daraja STK Push, withdrawals, wallet, escrow, payout/reconciliation/refund workflows
- Paid subscriptions, company/team management, product marketplace, and academy courses
- External full-text search, Redis queues/rate limits, CDN/object storage media workflows
- Automated abuse detection, dispute workflows, fraud monitoring, comprehensive observability, backups/restore drills, and performance/load testing

These integrations need chosen providers, credentials, webhook URLs, operational processes, and testing; the app does not simulate successful payments or messages.

## Before public production launch

1. Configure and test database backups, restore drills, and data-retention policies.
2. Configure email/phone verification and password-reset delivery; do not award verification badges until the relevant checks exist.
3. Set up external monitoring, structured log retention, alerting, automated dependency/security scans, and incident response.
4. Replace in-memory throttling with a distributed limiter and add login/registration abuse monitoring.
5. Run threat modelling, authorization tests, accessibility checks, and realistic load tests.
6. Implement payment reconciliation, refunds, disputes, and webhook signature/idempotency checks before accepting customer funds.
7. Configure a durable always-on deployment process and a managed production plan.

**Deployment note:** this instance is on the BasicDeploy Free plan. It is suitable for an MVP preview, but the account does not currently include always-on hosting. A free container may sleep and a process is not guaranteed to relaunch after a container restart, so do not treat this deployment alone as a 24/7 production SLA.

## Licence

No open-source licence has been chosen yet. Add one before inviting external contributors.
