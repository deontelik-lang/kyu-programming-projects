# CBC Success Hub — Original Design + Protected Exam PDF Bundles

This website preserves the supplied CBC Success Hub green/red layout, offers one-page free previews for practice resources, links to KCSE subject archives for 2016–2025, and provides 30 locked, subject-specific KCSE trend packs.

## Learner experience
- Exactly one preview page is viewable online for free.
- Each published bundle costs **KSh 30**.
- After verification, learners receive two separate file links: a complete question paper PDF and a separate marking-scheme / worked-answer PDF.
- The browser source contains only the two-question previews for free practice bundles. The 30 trend packs expose no questions or topic analysis in the browser; full questions, trend notes and worked marking answers remain server-side outside the public web root.
- Catalogue placeholders without complete question/answer PDFs are labelled “PDF coming soon” and cannot be purchased.

## KCSE past-paper archives and subject trends
- The homepage links to external year archives for KCSE 2016 through 2025. Each archive page lists the subjects/papers available on that host; subject coverage and access terms vary by year.
- Thirty additional locked 50-mark practice packs cover Mathematics Alternative A/B, English, Kiswahili, Biology, Chemistry, Physics, General Science, History and Government, Geography, CRE, IRE, HRE, Agriculture, Business Studies, Computer Studies, Home Science, French, German, Arabic, Music, Art and Design, Drawing and Design, Aviation Technology, Building Construction, Electricity, Metalwork, Power Mechanics, Woodwork and Kenya Sign Language.
- The packs include subject-specific qualitative topic notes and original hard questions with a separate worked marking guide. The topic notes are not a statistically verified item-by-item count of every 2016–2025 question and are not guarantees about a future exam. The website links to outside archives rather than rehosting their past-paper files. For official publication information, it links to KNEC's Bookshop.

## Payment and access control
- New orders remain **PENDING** until an authorised staff member confirms the receipt against the merchant’s M-Pesa/Paybill transaction records.
- The server does not mark orders verified from a client-side timer, localStorage flag, or receipt code alone.
- Download endpoints check the server-side order status; files are stored outside the static website directory.
- The current deployment uses **manual receipt verification**. Automatic M-Pesa verification has not been connected because it requires the merchant’s approved Safaricom Daraja app/API credentials and configured callback endpoints. Safaricom documents C2B payment notifications and M-Pesa Express through Daraja.

## Runtime layout on BasicDeploy
- Public page: `/app/exams/index.html`
- Private full question/answer bank: `/var/lib/cbc-success-hub/papers.json`
- Private downloadable PDFs: `/var/lib/cbc-success-hub/pdfs/`
- Orders database: `/var/lib/cbc-success-hub/orders.sqlite3`
- Admin token: `/var/lib/cbc-success-hub/admin_token` (never commit or share it publicly)
- Staff verification page: `/exams/admin.html`
- Backend: `server.py`
- PDF builder: `generate_cbc_pdfs.py`

Do **not** commit `papers.json`, generated PDFs, `admin_token`, or `orders.sqlite3` to a public repository.

## Research / transparency
- KICD Grade 9 Mathematics curriculum design: https://kicd.ac.ke/wp-content/uploads/2024/09/GRADE-9-MATHEMATICS.pdf
- KNEC timetables and assessment instructions: https://www.knec.ac.ke/timetables/
- Safaricom Daraja C2B payment notifications: https://developer.safaricom.co.ke/apis/CustomerToBusiness
- Safaricom Daraja developer portal: https://daraja.safaricom.co.ke/

All papers are original KNEC-style practice material, not leaked, copied, or official KNEC examinations or marking schemes.
