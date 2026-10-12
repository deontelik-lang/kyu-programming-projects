# CBC Success Hub — Original Design + Protected Exam PDF Bundles

This website preserves the supplied CBC Success Hub green/red layout and adds realistic one-page previews for 14 original practice resources across KJSEA Grade 9, KPSEA Grade 6, Grades 7–8, Grade 10 transition practice, KCSE revision and teacher resources.

## Learner experience
- Exactly one preview page is viewable online for free.
- Each published bundle costs **KSh 30**.
- After verification, learners receive two separate file links: a complete question paper PDF and a separate marking-scheme / worked-answer PDF.
- The browser source contains only preview questions. Full question data and marking answers are kept server-side, outside the public web root.
- Catalogue placeholders without complete question/answer PDFs are labelled “PDF coming soon” and cannot be purchased.

## Free past-paper links
- The homepage now includes selected external links to free KCSE question papers for 2013–2016, topical KCSE question compilations from earlier years, and a KCPE archive.
- Past-paper files are linked from the external hosting site, not copied into this repository or the CBC Success Hub server. Availability and access terms can change; the page identifies the external source and links to KNEC's official Bookshop for publication details.

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
