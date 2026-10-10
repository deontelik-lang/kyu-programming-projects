# FundiConnect Pro

**Kenya's Trusted Skilled Workers Marketplace**

FundiConnect Pro is a Kenya-first marketplace MVP connecting customers with electricians, CCTV installers, and WiFi/network technicians. This repository contains the working browser UI, same-origin HTTP API, PostgreSQL migrations, operational scripts, and CI checks for both the Fundi services marketplace and CampusConnect student/opportunity hubs.

> **Release status:** functional marketplace MVP, not yet a fully production-hardened marketplace. The launch payment model is direct-to-provider: customers pay providers using provider-controlled instructions, and FundiConnect records each party's confirmation without moving or independently verifying funds. Platform M-Pesa checkout is disabled. Real identity/phone verification, SMS OTP, email verification and live dispatch remain unconnected.

## Live preview

- Website: https://t1lmltxf.basicdeploy.com
- Source branch: https://github.com/deontelik-lang/kyu-programming-projects/tree/fundiconnect-pro-mvp

## Implemented features

- Customer and fundi registration, email/phone login, password hashing with Node.js scrypt, logout, and database-backed sessions.
- Server-side role checks for customers, fundis, and administrator endpoints.
- Fundi profiles with category, professional title, bio, location, skills, experience, and an availability toggle.
- Search/filter by service category and county/town plus text search and sorting.
- Persistent single-provider quote requests and booking status transitions: pending, accepted, assigned, traveling, in progress, completed, and cancelled, with validated transitions.
- Smart multi-provider job requests: one request is shared with up to 30 available fundis matching the selected service category and county (when supplied); providers send comparable quotes with scope notes and proposed start times; customers compare quotes and select one. Selecting a quote transactionally creates a regular booking and closes competing quotes.
- Fundi Job Desk with lead and booking counts, upcoming appointments, and quote response tracking.
- Provider work portfolio with public/private project descriptions, county/year metadata, and customer-facing public portfolio viewing.
- Printable job summaries containing booking scope, status, quote, and payment-confirmation record; summaries are explicitly not tax invoices, receipts or proof of transfer.
- In-app database notifications for new booking requests, status changes, quotes and reviews; outbound email/SMS/push delivery is not connected.
- Reviews tied to completed customer bookings; a database constraint prevents a second review for the same booking.
- Transparent deterministic trust score derived from review volume, rating, completed jobs, verification level, observed responses, and profile completeness. It is not an AI model, background check, or guarantee of quality; new profiles have limited history.
- Admin summary, booking dispute timelines, provider report queue, evidence-based verification controls, moderation queue, hub analytics and 14-day signup/listing trend.
- Company/employer registration and a company workspace with organisation profile, job/internship listing metrics, response counts, and an explicit unverified status.
- Loyalty ledger that awards 10 points for a published listing and 2 points for a submitted opportunity action. Members can spend 20 points to feature one of their own published listings for seven days; repeat point awards are idempotent.
- Audit events, parameterized database queries, basic rate limiting, security response headers, request-size limits, origin checks, and session revocation.
- Numbered SQL migrations, code syntax checks, a browser-script check, guarded integration tests, and a GitHub Actions CI workflow.
- An opt-in campus/alumni profile directory with search by name, course, skills, campus and persona. Contact information is excluded from public directory responses.

## CampusConnect super-app modules

The app includes 13 database-backed opportunity hubs: student gigs, jobs, internships/graduate roles, housing, products, events, courses/skills academy listings, business directory, community posts, transport/delivery listings, student services, alumni/mentorship and professional service offers. Members can publish listings, search by hub and location, apply or inquire, RSVP, save items, comment on campus posts, exchange persistent listing messages, report abusive listings, and review incoming applications through owner dashboards. User profiles can include campus, course, study level, graduation year, organisation, portfolio and skills; a printable CV preview uses that profile data. The Campus & Alumni Directory is opt-in and private by default; users can make their profile discoverable or opt out at any time, and the directory does not expose account phone/email. Emergency request records are persistent but do not dispatch responders. A local rules-based study/career guide and user-input cost worksheet are included; neither is a connected generative AI service or external market-price engine.

The release implements a direct-to-provider marketplace. Providers list their own payment instructions (such as M-Pesa Till/Paybill, cash or bank transfer); participants on an accepted booking can view the instructions and record timestamped confirmations. A customer report and provider receipt confirmation create a two-sided record, not independent bank verification. Booking disputes preserve a case timeline for admin review. Platform checkout, wallet transfers, escrow, provider payouts, rent collection, paid ticketing, real OTP/email delivery, automated identity validation/background checks, live GPS, push notifications, real-time WebSocket chat, course content delivery, company team invitations, employer-system integrations, referral bonuses and AI-provider calls are **not enabled**. Company dashboards and point-based listing spotlights are implemented, but do not imply an organisation is verified or guarantee a listing's outcome.

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

The script requires DATABASE_URL, updates an existing account only, and writes an audit event. This MVP does not verify email ownership itself; never promote an account based only on an unverified email claim. Verification levels require recorded checks for the relevant tier, but checks are entered by an authorised administrator and are not automated background checks. National ID/certificate uploads and automated background checks are not implemented.

## API summary

All endpoints are same-origin under **/api**. Authenticated sessions use an opaque random cookie; only the hash of the session token is stored in PostgreSQL.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | **/api/health** | Application/database health |
| GET | **/api/hubs/types** | Supported hubs |
| GET | **/api/members** | Search opt-in public campus/alumni profiles; contact information is excluded |
| GET | **/api/hubs/listings** | Search listings by hub, keyword, location |
| POST | **/api/hubs/listings** | Publish a job, gig, event, product, housing or other hub listing |
| POST | **/api/hubs/listings/:id/actions** | Apply, inquire, RSVP, enrol interest, mentor request or save |
| GET | **/api/hubs/activity** | User-owned listings, applications, points summary |
| GET | **/api/rewards** | Current points, tier, progress and recent ledger activity |
| POST | **/api/rewards/feature-listing** | Spend 20 points to feature an owned published listing for seven days |
| GET | **/api/company/dashboard** | Company profile, listing metrics and response summary (company role only) |
| PATCH | **/api/company/profile** | Save the company organisation name, website and description |
| GET | **/api/admin/analytics** | Admin-only hub, moderation, reward and daily sign-up/listing analytics |
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
| POST | **/api/auth/register** | Customer/fundi sign-up; business owner/employer persona creates a company account |
| POST | **/api/auth/login** | Email or phone + password |
| POST | **/api/auth/logout** | Revoke current session |
| GET | **/api/me** | Current account and fundi profile |
| PATCH | **/api/fundi/profile** | Update signed-in fundi profile |
| GET | **/api/bookings** | Participant bookings (admin can view platform bookings) |
| POST | **/api/bookings** | Customer requests a quote from one provider |
| GET/POST | **/api/job-requests** | Create a multi-provider request or list customer requests/provider invitations |
| POST | **/api/job-requests/:id/quotes** | Submit or update a quote for a matching invited request |
| PATCH | **/api/job-requests/:id/quotes/:quoteId/accept** | Customer selects a quote and atomically creates a booking |
| PATCH | **/api/job-requests/:id** | Customer cancels an open multi-provider request |
| POST | **/api/job-requests/:id/decline** | Provider declines a job invitation |
| GET | **/api/fundi/toolkit** | Provider job-desk counts and upcoming bookings |
| GET/POST | **/api/fundi/portfolio** | List/create portfolio items owned by the provider |
| DELETE | **/api/fundi/portfolio/:id** | Delete an owned portfolio item |
| GET | **/api/fundis/:id/portfolio** | Read public portfolio projects |
| PATCH | **/api/bookings/:id/status** | Change an authorized booking status |
| PATCH | **/api/bookings/:id/quote** | Assigned fundi sets a whole-KSh quote; booking becomes accepted |
| GET | **/api/fundi/payment-instructions** | Provider's own direct-payment instructions |
| PATCH | **/api/fundi/payment-instructions** | Save Till/Paybill, cash, bank transfer or other payment instructions (never credentials) |
| GET | **/api/bookings/:id/payment-instructions** | Booking participants view accepted quote and provider payment instructions |
| POST | **/api/bookings/:id/payment-confirmation** | Customer reports payment or provider confirms receipt; timestamped, not independently verified |
| POST | **/api/bookings/:id/disputes** | Booking participant opens a documented issue |
| GET | **/api/admin/booking-disputes** | Admin-only dispute queue with booking event timeline |
| PATCH | **/api/admin/booking-disputes/:id** | Admin updates case status and resolution note |
| POST | **/api/fundis/:id/report** | Report a provider profile |
| GET | **/api/admin/fundi-reports** | Admin-only provider report queue |
| PATCH | **/api/admin/fundi-reports/:id** | Admin resolves a provider report |
| GET / PATCH | **/api/admin/fundis/:id/verification-checks** | Record evidence checks before assigning a verification level |
| POST | **/api/reviews** | Review a completed booking once |
| GET | **/api/notifications** | Current account notifications |
| POST | **/api/notifications/read** | Mark notifications read |
| GET | **/api/admin/overview** | Admin-only summary |
| GET | **/api/admin/fundis** | Admin-only fundi verification queue |
| PATCH | **/api/admin/fundis/:id/verification** | Admin-only manual verification-level update |

### Direct-payment launch model

FundiConnect does not collect or hold customer service payments. A provider controls their default payment instructions and must save them before quoting. The quote stores a snapshot of those instructions so later edits to the provider's default Till/Paybill do not silently redirect an accepted booking. Both booking parties may record their confirmations; admins may review disputes and the booking event timeline. The platform does not independently confirm transfers or guarantee refunds. Legacy platform M-Pesa endpoints, including historical platform payment records, are disabled in this release and return a direct-payment-model response.

### Core data model

- users, fundi_profiles, categories
- bookings, provider payment-instruction snapshots, booking event history, booking disputes
- provider payment instructions, provider reports, verification-check records, reviews
- user_sessions, notifications, audit_logs, schema_migrations

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
- Customer job-photo uploads (requires a secure upload pipeline and configured object storage; this release does not accept or store image uploads)
- Upload pipeline for IDs, certificates, and portfolio photos/videos (text-based portfolio projects are implemented)
- Email/SMS/push delivery to real devices (current alerts are in-app database notifications only)
- Real-time chat and GPS technician tracking
- Withdrawals, wallet, escrow, payout/reconciliation/refund workflows; the Daraja STK Push code is present but not enabled until provider configuration and sandbox validation are complete
- Paid subscriptions and company-team invitations/permissions
- External full-text search, Redis queues/rate limits, CDN/object storage media workflows
- Automated abuse detection, advanced fraud monitoring, comprehensive observability, backups/restore drills, and performance/load testing

These remaining integrations need chosen providers, credentials, webhook URLs, operational processes, and testing; the app does not simulate successful payments or messages. The M-Pesa code stays disabled until its required settings are provided and sandbox-tested.

## Before public production launch

1. Configure and test database backups, restore drills, and data-retention policies.
2. Configure email/phone verification and password-reset delivery; do not award verification badges until the relevant checks exist.
3. Set up external monitoring, structured log retention, alerting, automated dependency/security scans, and incident response.
4. Replace in-memory throttling with a distributed limiter and add login/registration abuse monitoring.
5. Run threat modelling, authorization tests, accessibility checks, and realistic load tests.
6. Before accepting customer funds in any future release, choose an authorised payments design and complete payment reconciliation, refunds, disputes, security review and applicable legal/compliance work. The current release does not collect customer funds.
7. Configure a durable always-on deployment process and a managed production plan.

**Deployment note:** this instance is on the BasicDeploy Free plan. It is suitable for an MVP preview, but the account does not currently include always-on hosting. A free container may sleep and a process is not guaranteed to relaunch after a container restart, so do not treat this deployment alone as a 24/7 production SLA.

## Licence

No open-source licence has been chosen yet. Add one before inviting external contributors.
