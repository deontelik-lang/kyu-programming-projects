# CBC Success Hub — Original Design + Free Practice Samples

This site builds on the supplied CBC Success Hub HTML design. Its existing green/red visual system, header, hero/search, category cards, M-Pesa preview flow, order lookup, and modal viewer are retained.

## Newly added
- Two complete free practice resources in every original category: KJSEA Grade 9, KPSEA Grade 6, Grade 7, Grade 8, Grade 10, KCSE, and Teacher Resources.
- Original, difficult exam-style questions with per-question worked marking guides.
- A Grade 9 indices/common-logarithms practice paper aligned to the KICD Grade 9 Mathematics design.
- A KCSE-style logarithms and indices paper including log-table calculations, domain restrictions, logarithmic equations, and exponential growth.
- A print / save-as-PDF action for free practice papers.
- The original site layout and premium preview structure remain in place.

## Important content note
These are newly written KNEC-style practice items, not leaked, copied, or official KNEC examination papers. KICD Grade 9 Mathematics curriculum context: https://kicd.ac.ke/wp-content/uploads/2024/09/GRADE-9-MATHEMATICS.pdf

Official KNEC timetable references:
- https://www.knec.ac.ke/timetables/
- https://www.knec.ac.ke/2026-kcse-timetable/

## Run locally
Open `index.html` in a browser or use any static web server.

## Hosting
The updated original-design page is published at `/exams/` on the existing BasicDeploy static-server container so its unrelated root application is not overwritten. The GitHub copy is maintained at `websites/cbc-success-hub/index.html`.

## Production note
The uploaded base HTML contains demo payment and document-delivery behaviors. Before charging customers, connect real M-Pesa verification and real secure PDF storage/delivery; never rely on a browser-only confirmation code to verify a payment.
