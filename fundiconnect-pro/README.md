# FundiConnect Pro — MVP Preview

Kenya's Trusted Skilled Workers Marketplace

This repository contains the first responsive frontend MVP preview for FundiConnect Pro, focused on the three launch categories:
- CCTV installers
- WiFi & network technicians
- Electricians

## Included in this preview
- Responsive landing page and service category cards
- Search and location filters
- Sample professional cards with experience, ratings, and illustrative profile-completion badges
- Quote request, fundi sign-up, sign-in, and emergency-request modal flows
- Explicit demo messaging where real backend integrations are not connected

## Run locally
Requires Node.js.

```bash
node server.js
```

Open http://localhost:8080.

## Important MVP limitations
This is a frontend preview with sample data. Authentication, OTP, persistent bookings, verified identity/certificates, live dispatch, messaging, real ratings, wallet, payments/M-Pesa, maps, and admin APIs are not implemented. No real technicians are contacted by the demo forms. Do not treat sample profiles, ratings, or verification labels as real-world credentials.

## Planned production architecture
- Frontend: Next.js + TypeScript + Tailwind
- API: NestJS + validation + role-based access control
- Data: PostgreSQL + Prisma
- Realtime: Socket.IO
- Media: S3-compatible object storage / Cloudinary
- Cache and queues: Redis
- Search: PostgreSQL full-text initially; dedicated search engine when justified
- Payments: Safaricom Daraja integration behind a server-side payment service
- Observability: structured logs, metrics, audit events, error tracking

## Next milestones
1. Create a proper Next.js application and shared design system.
2. Define PostgreSQL/Prisma models for users, fundi profiles, categories, services, bookings, reviews, and audit logs.
3. Implement secure authentication, phone verification, and role/ownership checks.
4. Persist quote requests and booking state transitions.
5. Add admin review workflows for identity and certificate verification.
6. Integrate payments only after reconciliation, refunds, webhook verification, and dispute flows are designed.
7. Add automated tests, CI, migrations, backups, monitoring, and deployment runbooks.
