'use strict';

const { Pool } = require('pg');

if (process.env.FUNDICONNECT_RUN_INTEGRATION_TESTS !== '1') {
  console.error('Refusing to create test users unless FUNDICONNECT_RUN_INTEGRATION_TESTS=1 is set.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to clean up integration-test data afterwards.');
  process.exit(2);
}

const base = (process.env.FUNDICONNECT_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const testIp = '198.51.100.' + (Math.floor(Math.random() * 200) + 20);
const password = 'IntegrationPassword#12345';
const emailCustomer = 'fctest-' + runId + '-customer@example.invalid';
const emailFundi = 'fctest-' + runId + '-fundi@example.invalid';
const emailCompany = 'fctest-' + runId + '-company@example.invalid';
const phone = '2547' + String(Date.now()).slice(-8);
const checks = [];
let customerId = null;
let fundiId = null;
let fundiProfileId = null;
let bookingId = null;
let smartRequestId = null;
let smartBookingId = null;
let portfolioItemId = null;
let hubListingId = null;
let hubReportId = null;

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      'x-forwarded-for': testIp
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return {
    status: response.status,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0]
  };
}

function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) throw new Error('FAILED: ' + name);
}

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const users = await client.query('SELECT id FROM users WHERE email=ANY($1::text[])', [[emailCustomer, emailFundi, emailCompany]]);
    const userIds = users.rows.map(r => r.id);
    const profiles = await client.query('SELECT id FROM fundi_profiles WHERE user_id=ANY($1::uuid[])', [userIds]);
    const profileIds = profiles.rows.map(r => r.id);
    const bookings = await client.query('SELECT id FROM bookings WHERE customer_id=ANY($1::uuid[]) OR fundi_id=ANY($2::uuid[])', [userIds, profileIds]);
    const bookingIds = bookings.rows.map(r => r.id);
    await client.query('DELETE FROM reviews WHERE booking_id=ANY($1::uuid[])', [bookingIds]);
    await client.query('DELETE FROM notifications WHERE user_id=ANY($1::uuid[]) OR booking_id=ANY($2::uuid[])', [userIds, bookingIds]);
    await client.query('DELETE FROM audit_logs WHERE actor_user_id=ANY($1::uuid[]) OR entity_id=ANY($2::text[])', [userIds, bookingIds]);
    await client.query('DELETE FROM bookings WHERE id=ANY($1::uuid[])', [bookingIds]);
    await client.query('DELETE FROM user_sessions WHERE user_id=ANY($1::uuid[])', [userIds]);
    await client.query('DELETE FROM fundi_profiles WHERE user_id=ANY($1::uuid[])', [userIds]);
    await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

(async () => {
  let customerCookie = '';
  let fundiCookie = '';
  let failure = null;
  try {
    const homepageResponse = await fetch(base + '/', { headers: { 'x-forwarded-for': testIp } });
    const homepageHtml = await homepageResponse.text();
    check('homepage injects StudentOS discovery and refreshed cinematic assets', homepageResponse.status === 200 && homepageHtml.includes('/engagement.css?v=1') && homepageHtml.includes('/engagement.js?v=2') && homepageHtml.includes('/studentos.css?v=3') && homepageHtml.includes('/studentos.js?v=6') && homepageHtml.includes('/soundscape.css?v=3') && homepageHtml.includes('/soundscape.js?v=3'));
    const discoveryCss = await fetch(base + '/engagement.css?v=1');
    const discoveryJs = await fetch(base + '/engagement.js?v=2');
    const studentosCss = await fetch(base + '/studentos.css?v=3');
    const studentosJs = await fetch(base + '/studentos.js?v=6');
    const soundscapeCss = await fetch(base + '/soundscape.css?v=3');
    const soundscapeJs = await fetch(base + '/soundscape.js?v=3');
    const [cssText, jsText, soCssText, soJsText, cinemaCssText, cinemaJsText] = await Promise.all([discoveryCss.text(), discoveryJs.text(), studentosCss.text(), studentosJs.text(), soundscapeCss.text(), soundscapeJs.text()]);
    check('discovery styles are served', discoveryCss.status === 200 && cssText.includes('.dh-glass') && cssText.includes('prefers-reduced-motion'));
    check('discovery interaction layer is served', discoveryJs.status === 200 && jsText.includes('Your momentum') && jsText.includes('/api/hubs/listings?'));
    check('StudentOS responsive app shell styles are served', studentosCss.status === 200 && soCssText.includes('.so-launch-grid') && soCssText.includes('.so-mobile-nav'));
    check('StudentOS global country engine, interactive map, university suggestions and media view are served', studentosJs.status === 200 && soJsText.includes('COUNTRY_DATA') && soJsText.includes('studentosEntertainment') && soJsText.includes('My university') && soJsText.includes('so-world-map') && soJsText.includes('UI_TEXT') && soJsText.includes('syncHomeLocationFilter') && soJsText.includes('UNIVERSITIES_BY_COUNTRY') && soJsText.includes('so-university-suggestions'));
    check('StudentOS Help Centre consolidates help, FAQs, safety and account guidance', studentosJs.status === 200 && soJsText.includes('studentosHelpCentre') && soJsText.includes('soHelpSearch') && ['soHelpGroupStart','soHelpGroupAccount','soHelpGroupFaq','soHelpGroupSafety'].every(id=>soJsText.includes(id)));
    check('live cinema renderer and aurora visuals are served', soundscapeJs.status === 200 && cinemaJsText.includes('soCinemaCanvas') && cinemaJsText.includes('requestAnimationFrame') && cinemaJsText.includes('cinemaGlobe') && cinemaJsText.includes('cinemaTunnel') && cinemaJsText.includes('cinemaCar') && soundscapeCss.status === 200 && cinemaCssText.includes('.so-cinema-canvas') && cinemaCssText.includes('.so-help-topic-grid') && cinemaCssText.includes('#22d3ee') && cinemaCssText.includes('so-scene-copy-enter') && cinemaCssText.includes('soSceneLightSweep'));
    let response = await request('/api/health');
    check('API and PostgreSQL health', response.status === 200 && response.data.database === true);

    response = await request('/api/public/stats');
    check('public statistics reveal aggregate counts without identities', response.status === 200 && Number.isInteger(response.data.members) && Number.isInteger(response.data.providers) && Number.isInteger(response.data.opportunities) && !('users' in response.data));
    response = await request('/api/public/global-stats');
    check('global map exposes privacy-safe country aggregates', response.status === 200 && Array.isArray(response.data.countries) && Number.isInteger(response.data.totals?.providers) && Number.isInteger(response.data.totals?.opportunities) && Number.isInteger(response.data.totals?.publicProfiles) && !('users' in response.data) && !('coordinates' in response.data));
    response = await request('/manifest.webmanifest');
    check('StudentOS progressive web app manifest is served', response.status === 200 && response.data.short_name === 'StudentOS' && response.data.display === 'standalone');
    response = await request('/sw.js');
    check('offline shell service worker is served', response.status === 200);

    response = await request('/api/categories');
    check('expanded service directory is seeded', response.status === 200 && response.data.categories.length >= 20 && ['plumber','solar','computer-repair','moving','handyperson','locksmith','tutor','freelancer'].every(slug => response.data.categories.some(c => c.slug === slug)));
    response = await request('/api/hubs/types');
    check('expanded StudentOS hub catalogue is available', response.status === 200 && response.data.hubs.length >= 24 && ['scholarship','study_abroad','language_exchange','lost_found','student_discount','club','media_video','music','podcast','student_original','creator'].every(type => response.data.hubs.some(h => h.type === type)));
    response = await request('/api/payments/mpesa/config');
    const mpesaEnabled = response.status === 200 && response.data.enabled === true;
    check('M-Pesa readiness endpoint exposes status without credentials', response.status === 200 && typeof response.data.enabled === 'boolean' && !('consumerKey' in response.data));

    response = await request('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'FundiConnect Test Customer', email: emailCustomer, password, role: 'customer', persona: 'student' }
    });
    check('registration refuses account creation without policy acceptance', response.status === 400 && response.data.error === 'POLICY_CONSENT_REQUIRED');

    response = await request('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'StudentOS Test Customer', email: emailCustomer, password, role: 'customer', policyConsent: true, persona: 'student', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', country: 'Canada', countryCode: 'CA', region: 'Ontario', city: 'Toronto', university: 'Integration University', language: 'en', currency: 'CAD' }
    });
    check('customer registration creates session', response.status === 201 && Boolean(response.cookie));
    customerCookie = response.cookie;

    customerId = response.data.user.id;
    response = await request('/api/me', { cookie: customerCookie });
    check('student persona, campus and global profile persist', response.status === 200 && response.data.platformProfile?.persona === 'student' && response.data.platformProfile?.campus === 'Integration Campus' && response.data.platformProfile?.country === 'Canada' && response.data.platformProfile?.city === 'Toronto' && response.data.platformProfile?.university === 'Integration University' && response.data.platformProfile?.currency === 'CAD');
    response = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: emailCustomer, password: 'wrong-password' }
    });
    check('invalid password is rejected', response.status === 401);

    response = await request('/api/auth/login', {
      method: 'POST',
      body: { identifier: emailCustomer, password }
    });
    check('valid login issues a session cookie', response.status === 200 && Boolean(response.cookie));
    customerCookie = response.cookie;

    response = await request('/api/hubs/listings', {
      method:'POST', cookie:customerCookie,
      body:{type:'scholarship',title:'International scholarship opportunity',description:'A member-posted scholarship listing for global opportunity discovery tests.',category:'Funding',country:'Canada',countryCode:'CA',region:'Ontario',city:'Toronto',university:'Integration University',currency:'CAD'}
    });
    check('scholarship posts persist with global location fields', response.status === 201 && response.data.listing?.hub_type === 'scholarship' && response.data.listing.country === 'Canada' && response.data.listing.city === 'Toronto');

    response = await request('/api/hubs/listings', {
      method:'POST', cookie:customerCookie,
      body:{type:'study_abroad',title:'Study abroad exchange programme',description:'An international exchange opportunity published by a community member for integration tests.',category:'Exchange',country:'Germany',countryCode:'DE',region:'Berlin',city:'Berlin',university:'International Integration University',currency:'EUR'}
    });
    check('study-abroad programmes can be published internationally', response.status === 201 && response.data.listing?.hub_type === 'study_abroad' && response.data.listing.country === 'Germany' && response.data.listing.currency === 'EUR');

    response = await request('/api/hubs/listings', {
      method:'POST', cookie:customerCookie,
      body:{type:'media_video',title:'CampusTV creator video',description:'A student-created media listing using a public external video URL.',category:'Student Originals',country:'Kenya',countryCode:'KE',region:'Nairobi County',city:'Nairobi',university:'Integration University',currency:'KES',metadata:{mediaUrl:'https://example.com/campus-video'}}
    });
    check('creator media links can be published without pretending to upload files', response.status === 201 && response.data.listing?.hub_type === 'media_video');

    response = await request('/api/hubs/listings?type=study_abroad&country=Germany&city=Berlin&university=International%20Integration%20University');
    check('global study-abroad search filters by country city and institution', response.status === 200 && response.data.listings?.some(listing => listing.hub_type === 'study_abroad' && listing.city === 'Berlin'));

    response = await request('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'FundiConnect Test Company', email: emailCompany, password, policyConsent: true, persona: 'employer', organisation: 'Integration Test Organisation', companyWebsite: 'https://example.invalid' }
    });
    check('business and employer sign-up creates a company account', response.status === 201 && response.data.user.role === 'company');
    const companyCookie = response.cookie;
    response = await request('/api/company/dashboard', { cookie: companyCookie });
    check('company workspace initializes with a self-declared profile', response.status === 200 && response.data.profile.organization_name === 'Integration Test Organisation');
    response = await request('/api/company/profile', { method: 'PATCH', cookie: companyCookie, body: { organizationName: 'Integration Test Organisation Ltd', website: 'https://example.invalid', description: 'A test company for hiring student developers.' } });
    check('company can save its organisation profile', response.status === 200 && response.data.profile.organization_name === 'Integration Test Organisation Ltd');
    response = await request('/api/hubs/listings', { method: 'POST', cookie: companyCookie, body: { type: 'internship', title: 'Company platform QA internship', description: 'A testing internship for students checking the company workspace.', category: 'Software testing', county: 'Ontario', town: 'Toronto', country: 'Canada', countryCode: 'CA', region: 'Ontario', city: 'Toronto', university: 'Integration University', currency: 'CAD' } });
    check('company account can publish an internship', response.status === 201 && response.data.listing.hub_type === 'internship' && response.data.listing.country === 'Canada' && response.data.listing.currency === 'CAD');
    response = await request('/api/hubs/listings?type=internship&country=Canada&city=Toronto&university=Integration%20University&limit=10');
    check('global country, city and university filters return matching listing records', response.status === 200 && response.data.listings.some(listing => listing.country === 'Canada' && listing.city === 'Toronto' && listing.university === 'Integration University'));
    response = await request('/api/hubs/listings?country=Kenya&limit=10');
    check('global country filter can select Kenya independently', response.status === 200 && Array.isArray(response.data.listings));
    response = await request('/api/company/dashboard', { cookie: companyCookie });
    check('company dashboard summarizes company listings', response.status === 200 && Number(response.data.metrics.total_listings) === 1 && Number(response.data.metrics.active_roles) === 1);
    response = await request('/api/company/dashboard', { cookie: customerCookie });
    check('company dashboard blocks non-company members', response.status === 403);

    response = await request('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'FundiConnect Test Fundi', email: emailFundi, phone, password, policyConsent: true,
        role: 'fundi', categorySlug: 'network', professionalTitle: 'Network Technician',
        county: 'Nairobi', town: 'Westlands'
      }
    });
    check('fundi registration creates profile', response.status === 201 && response.data.user.role === 'fundi');
    fundiId = response.data.user.id;
    fundiCookie = response.cookie;

    response = await request('/api/fundi/profile', {
      method: 'PATCH', cookie: fundiCookie,
      body: {
        professionalTitle: 'Network Technician', categorySlug: 'network', county: 'Nairobi',
        town: 'Westlands', yearsExperience: 6, bio: 'WiFi setup and small business networking',
        skills: ['WiFi setup', 'Routers', 'LAN'], available: false
      }
    });
    check('fundi can maintain profile and availability', response.status === 200);

    response = await request('/api/me', { cookie: fundiCookie });
    check('authenticated profile persists', response.status === 200 && response.data.profile.available === false);

    response = await request('/api/fundis?category=network&county=Nairobi&available=false');
    const profile = (response.data.fundis || []).find(item => item.user_id === fundiId);
    check('directory returns real fundi and computed trust score', Boolean(profile) && Number.isFinite(profile.trust_score));
    fundiProfileId = profile && profile.profile_id;

    response = await request('/api/bookings', {
      method: 'POST', cookie: customerCookie,
      body: { fundiId: fundiProfileId, serviceTitle: 'WiFi installation', description: 'Install and configure a WiFi router', county: 'Nairobi', town: 'Westlands' }
    });
    check('unavailable fundi cannot be booked', response.status === 409);

    await request('/api/fundi/profile', {
      method: 'PATCH', cookie: fundiCookie,
      body: {
        professionalTitle: 'Network Technician', categorySlug: 'network', county: 'Nairobi',
        town: 'Westlands', yearsExperience: 6, bio: 'WiFi setup and small business networking',
        skills: ['WiFi setup', 'Routers', 'LAN'], available: true
      }
    });

    response = await request('/api/bookings', {
      method: 'POST', cookie: customerCookie,
      body: { fundiId: fundiProfileId, serviceTitle: 'WiFi installation', description: 'Install and configure a WiFi router', county: 'Nairobi', town: 'Westlands' }
    });
    check('customer can submit a persistent booking request', response.status === 201);
    bookingId = response.data.booking.id;

    response = await request('/api/bookings/' + bookingId + '/status', {
      method: 'PATCH', cookie: customerCookie, body: { status: 'accepted' }
    });
    check('customers cannot accept their own booking', response.status === 403);
    response = await request('/api/bookings/' + bookingId + '/quote', {
      method: 'PATCH', cookie: customerCookie, body: { amount: 2500 }
    });
    check('customers cannot set their own service quote', response.status === 403);
    response = await request('/api/bookings/' + bookingId + '/quote', {
      method: 'PATCH', cookie: fundiCookie, body: { amount: 2500 }
    });
    check('provider cannot issue a quote before payment instructions exist', response.status === 409 && response.data.error === 'PAYMENT_METHODS_NOT_SET');
    response = await request('/api/fundi/payment-instructions', { method: 'PATCH', cookie: customerCookie, body: { acceptedMethods: ['mpesa_till'], mpesaTill: '1234567' } });
    check('customers cannot edit provider payment instructions', response.status === 403);
    response = await request('/api/fundi/payment-instructions', { method: 'PATCH', cookie: fundiCookie, body: { acceptedMethods: ['mpesa_till','cash'], mpesaTill: '1234567', accountName: 'Fundi Test Recipient' } });
    check('fundi can save direct payment instructions without platform credentials', response.status === 200 && response.data.instructions.mpesa_till === '1234567' && response.data.instructions.accepted_methods.includes('cash'));
    response = await request('/api/bookings/' + bookingId + '/quote', {
      method: 'PATCH', cookie: fundiCookie, body: { amount: 2500 }
    });
    check('assigned fundi can quote after adding payment instructions', response.status === 200 && Number(response.data.booking.quoted_price) === 2500 && response.data.booking.status === 'accepted');
    response = await request('/api/fundi/payment-instructions', { method: 'PATCH', cookie: fundiCookie, body: { acceptedMethods: ['mpesa_till','cash'], mpesaTill: '7654321', accountName: 'Changed Default Recipient' } });
    check('provider can update defaults without silently changing an existing booking', response.status === 200 && response.data.instructions.mpesa_till === '7654321');
    response = await request('/api/bookings/' + bookingId + '/payment-instructions', { cookie: customerCookie });
    check('accepted customer sees the payment-instruction snapshot from the quote', response.status === 200 && response.data.instructions.mpesa_till === '1234567' && response.data.accountName === 'Fundi Test Recipient' && response.data.paymentStatus === 'unpaid');

    response = await request('/api/job-requests', {
      method: 'POST', cookie: customerCookie,
      body: { serviceTitle: 'WiFi troubleshooting', description: 'Diagnose and improve weak WiFi coverage in the living room.', categorySlug: 'network', county: 'Nairobi', town: 'Westlands' }
    });
    check('customer can broadcast one request to matching fundis', response.status === 201 && response.data.request.status === 'open' && response.data.providersNotified >= 1);
    smartRequestId = response.data.request.id;
    response = await request('/api/job-requests', { cookie: fundiCookie });
    check('matching fundi receives a private job-desk invitation', response.status === 200 && (response.data.requests || []).some(r => r.id === smartRequestId && r.invitation_status === 'invited'));
    response = await request('/api/fundi/toolkit', { cookie: fundiCookie });
    check('fundi business toolkit summarizes active jobs and lead counts', response.status === 200 && Number.isFinite(Number(response.data.toolkit.open_leads)));
    response = await request('/api/fundi/portfolio', { method: 'POST', cookie: fundiCookie, body: { title: 'Small office WiFi upgrade', description: 'Configured a dual-band router and improved wireless coverage across a small office.', county: 'Nairobi', completedYear: new Date().getFullYear(), isPublic: true } });
    check('fundi can publish a portfolio project', response.status === 201 && response.data.item.is_public === true);
    portfolioItemId = response.data.item.id;
    response = await request('/api/fundis/' + fundiProfileId + '/portfolio');
    check('customers can view public portfolio examples without private profile data', response.status === 200 && (response.data.items || []).some(i => i.id === portfolioItemId) && !('fundi_id' in ((response.data.items || []).find(i => i.id === portfolioItemId) || {})));
    response = await request('/api/job-requests/' + smartRequestId + '/quotes', { method: 'POST', cookie: fundiCookie, body: { amount: 3000, notes: 'Includes diagnosis and router configuration; replacement hardware excluded.', estimatedStartAt: new Date(Date.now() + 86400000).toISOString() } });
    check('fundi can send a comparable quote with scope and availability', response.status === 201 && Number(response.data.quote.amount) === 3000 && response.data.quote.status === 'submitted');
    const smartQuoteId = response.data.quote.id;
    response = await request('/api/job-requests', { cookie: customerCookie });
    const smartRequest = (response.data.requests || []).find(r => r.id === smartRequestId);
    check('customer can compare received quote and provider details', response.status === 200 && smartRequest?.quotes.some(q => q.id === smartQuoteId && Number(q.amount) === 3000 && q.fundi_name === 'FundiConnect Test Fundi'));
    response = await request('/api/job-requests/' + smartRequestId + '/quotes/' + smartQuoteId + '/accept', { method: 'PATCH', cookie: customerCookie, body: {} });
    check('accepting a quote creates a regular booking and closes the request', response.status === 201 && response.data.booking.status === 'accepted' && Number(response.data.booking.quoted_price) === 3000);
    smartBookingId = response.data.booking.id;
    response = await request('/api/job-requests/' + smartRequestId + '/quotes/' + smartQuoteId + '/accept', { method: 'PATCH', cookie: customerCookie, body: {} });
    check('request locking prevents accepting a second quote after award', response.status === 409);
    response = await request('/api/fundi/portfolio/' + portfolioItemId, { method: 'DELETE', cookie: fundiCookie });
    check('fundi can remove a portfolio project they own', response.status === 200);
    response = await request('/api/bookings/' + bookingId + '/payment-confirmation', { method: 'POST', cookie: customerCookie, body: { action: 'customer_paid', method: 'mpesa_till', reference: 'TEST-RECEIPT-01' } });
    check('customer payment report is timestamped but not independently verified', response.status === 200 && response.data.booking.direct_payment_status === 'customer_reported_paid' && Boolean(response.data.booking.customer_payment_confirmed_at));
    response = await request('/api/bookings/' + bookingId + '/payment-confirmation', { method: 'POST', cookie: fundiCookie, body: { action: 'provider_received', method: 'mpesa_till' } });
    check('provider receipt confirmation creates two-sided confirmed state', response.status === 200 && response.data.booking.direct_payment_status === 'confirmed' && Boolean(response.data.booking.provider_payment_confirmed_at));
    response = await request('/api/bookings/' + bookingId + '/payment-confirmation', { method: 'POST', cookie: customerCookie, body: { action: 'customer_paid', method: 'mpesa_till' } });
    check('duplicate customer payment confirmation is rejected', response.status === 409 && response.data.error === 'ALREADY_CONFIRMED');

    response = await request('/api/fundis/' + fundiProfileId + '/report', { method: 'POST', cookie: customerCookie, body: { reason: 'misleading', details: 'Profile details require an additional review.' } });
    check('customer can report a provider profile for moderation', response.status === 201 && response.data.report.status === 'open');

    if (!mpesaEnabled) {
      response = await request('/api/payments/mpesa/stk-push', {
        method: 'POST', cookie: customerCookie,
        body: { bookingId, phoneNumber: phone }
      });
      check('platform M-Pesa checkout is removed for direct-to-provider launch', response.status === 410 && response.data.error === 'DIRECT_PAYMENT_MODEL');
    }
    response = await request('/api/payments/legacy-test-id', { cookie: customerCookie });
    check('legacy platform payment history routes are disabled', response.status === 410 && response.data.error === 'DIRECT_PAYMENT_MODEL');

    for (const status of ['in_progress', 'completed']) {
      response = await request('/api/bookings/' + bookingId + '/status', {
        method: 'PATCH', cookie: fundiCookie, body: { status }
      });
      check('valid booking transition to ' + status, response.status === 200 && response.data.status === status);
    }

    response = await request('/api/reviews', {
      method: 'POST', cookie: customerCookie,
      body: { bookingId, rating: 5, professionalism: 5, speed: 5, communication: 5, quality: 5, value: 4, comment: 'Integration test' }
    });
    check('review requires completed job and is stored', response.status === 201);

    response = await request('/api/reviews', {
      method: 'POST', cookie: customerCookie,
      body: { bookingId, rating: 5, professionalism: 5, speed: 5, communication: 5, quality: 5, value: 5 }
    });
    check('duplicate review is prevented', response.status === 409);

    response = await request('/api/bookings/' + bookingId + '/disputes', { method: 'POST', cookie: customerCookie, body: { category: 'quality', description: 'The delivered work needs a review against the original agreement.' } });
    check('booking participant can open a documented dispute', response.status === 201 && response.data.dispute.status === 'open');
    response = await request('/api/bookings', { cookie: customerCookie });
    const testBooking = (response.data.bookings || []).find(b => b.id === bookingId);
    check('booking dashboard exposes active dispute and recorded payment status', response.status === 200 && testBooking?.has_open_dispute === true && testBooking?.direct_payment_status === 'disputed');

    response = await request('/api/platform-profile', { method: 'PATCH', cookie: customerCookie, body: { persona: 'student', headline: 'IT student looking for internships', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', graduationYear: 2029, bio: 'Testing CampusConnect profile', skills: ['C', 'Networking'], organisation: '', portfolioUrl: '' } });
    check('student profile can be edited', response.status === 200 && response.data.profile.campus === 'Integration Campus');
    response = await request('/api/members?q=StudentOS%20Test%20Customer');
    check('campus directory keeps profiles private by default', response.status === 200 && !(response.data.members || []).some(m => m.user_id === customerId));
    response = await request('/api/platform-profile', { method: 'PATCH', cookie: customerCookie, body: { persona: 'student', headline: 'IT student looking for internships', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', graduationYear: 2029, bio: 'Testing StudentOS profile', skills: ['C', 'Networking'], organisation: '', portfolioUrl: '', publicDirectory: true, country: 'Canada', countryCode: 'CA', region: 'Ontario', city: 'Toronto', university: 'Integration University', language: 'en', currency: 'CAD' } });
    check('member can opt into the public directory', response.status === 200 && response.data.profile.public_directory === true && response.data.profile.country === 'Canada' && response.data.profile.city === 'Toronto' && response.data.profile.region === 'Ontario' && response.data.profile.university === 'Integration University');
    response = await request('/api/members?q=StudentOS%20Test%20Customer');
    check('public campus search returns opted-in members only', response.status === 200 && (response.data.members || []).some(m => m.user_id === customerId) && !('email' in ((response.data.members || []).find(m => m.user_id === customerId) || {})));
    for (const [filter,query,label] of [['country','Canada','country'],['city','Toronto','city'],['region','Ontario','region'],['university','Integration%20University','university']]) {
      response = await request('/api/members?' + filter + '=' + query + '&q=StudentOS%20Test%20Customer');
      check('public member directory filters by ' + label, response.status === 200 && (response.data.members || []).some(m => m.user_id === customerId));
    }
    response = await request('/api/members?country=Kenya&q=StudentOS%20Test%20Customer');
    check('public member directory excludes profiles outside selected country', response.status === 200 && !(response.data.members || []).some(m => m.user_id === customerId));
    for (const [filter,query,label] of [['city','Ottawa','city'],['region','Quebec','region'],['university','Other%20University','university']]) {
      response = await request('/api/members?' + filter + '=' + query + '&q=StudentOS%20Test%20Customer');
      check('public member directory excludes mismatched ' + label, response.status === 200 && !(response.data.members || []).some(m => m.user_id === customerId));
    }
    response = await request('/api/platform-profile', { method: 'PATCH', cookie: customerCookie, body: { persona: 'student', headline: 'IT student looking for internships', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', graduationYear: 2029, bio: 'Testing CampusConnect profile', skills: ['C', 'Networking'], organisation: '', portfolioUrl: '', publicDirectory: false } });
    check('member can opt out of the public directory', response.status === 200 && response.data.profile.public_directory === false);
    response = await request('/api/members?q=StudentOS%20Test%20Customer');
    check('opted-out member is no longer discoverable', response.status === 200 && !(response.data.members || []).some(m => m.user_id === customerId));
    response = await request('/api/cv', { cookie: customerCookie });
    check('CV builder data is available', response.status === 200 && response.data.cv.full_name === 'StudentOS Test Customer');

    response = await request('/api/hubs/listings', { method: 'POST', cookie: customerCookie, body: { type: 'job', title: 'Integration test junior web developer', description: 'Part-time web development work for a campus project and student portfolio.', category: 'Software development', county: 'Nairobi', town: 'Kahawa', price: 5000, metadata: { extra: 'Part-time' } } });
    check('user can create a persistent job listing', response.status === 201 && response.data.listing.hub_type === 'job');
    hubListingId = response.data.listing.id;
    response = await request('/api/hubs/listings?type=job&q=junior%20web%20developer');
    check('public hub listing search works', response.status === 200 && (response.data.listings || []).some(l => l.id === hubListingId));
    response = await request('/api/hubs/listings/' + hubListingId + '/actions', { method: 'POST', cookie: fundiCookie, body: { action: 'apply', note: 'I have networking and coding skills and would like to apply.' } });
    check('member can apply for an opportunity', response.status === 201 && response.data.action.action === 'apply');
    const applicationId = response.data.action.id;
    response = await request('/api/hubs/listings/' + hubListingId + '/actions', { cookie: customerCookie });
    check('listing owner can see applications', response.status === 200 && (response.data.actions || []).some(a => a.id === applicationId));
    response = await request('/api/hubs/actions/' + applicationId + '/status', { method: 'PATCH', cookie: customerCookie, body: { status: 'accepted' } });
    check('listing owner can review an application', response.status === 200 && response.data.status === 'accepted');
    response = await request('/api/rewards', { cookie: fundiCookie });
    const pointsBeforeRepeat = Number(response.data.points || 0);
    response = await request('/api/hubs/listings/' + hubListingId + '/actions/apply', { method: 'DELETE', cookie: fundiCookie });
    check('member can withdraw an application', response.status === 200);
    response = await request('/api/hubs/listings/' + hubListingId + '/actions', { method: 'POST', cookie: fundiCookie, body: { action: 'apply', note: 'Reapplying to verify reward idempotency.' } });
    check('member may resubmit an application after withdrawing', response.status === 201);
    response = await request('/api/rewards', { cookie: fundiCookie });
    check('reapplying to the same listing cannot farm points', response.status === 200 && Number(response.data.points || 0) === pointsBeforeRepeat);

    response = await request('/api/hubs/listings', { method: 'POST', cookie: customerCookie, body: { type: 'event', title: 'Integration campus career event', description: 'A demo campus career event for testing the RSVP workflow.', county: 'Nairobi', town: 'Kahawa', startsAt: new Date(Date.now() + 86400000).toISOString() } });
    check('event listing can be published', response.status === 201);
    const eventId = response.data.listing.id;
    response = await request('/api/hubs/listings/' + eventId + '/actions', { method: 'POST', cookie: fundiCookie, body: { action: 'attend', note: 'Planning to attend.' } });
    check('event RSVP returns confirmation code', response.status === 201 && /^CC-/.test(response.data.confirmationCode));

    response = await request('/api/hubs/listings', { method: 'POST', cookie: customerCookie, body: { type: 'community', title: 'Integration campus discussion', description: 'A community post for testing discussion replies.' } });
    check('community discussion can be created', response.status === 201);
    const communityId = response.data.listing.id;
    response = await request('/api/rewards', { cookie: customerCookie });
    check('publishing listings earns reward points', response.status === 200 && response.data.points >= 30 && response.data.reward.cost === 20);
    response = await request('/api/rewards/feature-listing', { method: 'POST', cookie: customerCookie, body: { listingId: hubListingId } });
    check('reward points can feature an owned listing for seven days', response.status === 200 && response.data.pointsSpent === 20 && Number(response.data.points) >= 10);
    response = await request('/api/hubs/listings?type=job&q=junior%20web%20developer');
    check('featured listing is visible with a spotlight flag', response.status === 200 && (response.data.listings || []).some(l => l.id === hubListingId && l.is_featured === true));

    response = await request('/api/hubs/listings/' + communityId + '/comments', { method: 'POST', cookie: fundiCookie, body: { body: 'This is a test reply from a community member.' } });
    check('community reply persists', response.status === 201);
    response = await request('/api/hubs/listings/' + communityId + '/comments');
    check('community replies can be retrieved', response.status === 200 && response.data.comments.length === 1);

    response = await request('/api/hubs/messages', { method: 'POST', cookie: fundiCookie, body: { listingId: hubListingId, body: 'Hello, I have a question about this opportunity.' } });
    check('in-app message is stored', response.status === 201);
    response = await request('/api/hubs/messages', { cookie: customerCookie });
    check('listing owner can see inbound messages', response.status === 200 && response.data.messages.some(m => m.listing_id === hubListingId));
    response = await request('/api/hubs/messages', { method: 'POST', cookie: customerCookie, body: { listingId: hubListingId, recipientUserId: fundiId, body: 'Thanks for reaching out.' } });
    check('existing message participant can reply', response.status === 201);

    response = await request('/api/favorites', { method: 'POST', cookie: customerCookie, body: { targetType: 'fundi', targetId: fundiProfileId } });
    check('fundi can be saved as a favorite', response.status === 201);
    response = await request('/api/favorites', { cookie: customerCookie });
    check('favorite list persists', response.status === 200 && response.data.favorites.some(f => f.target_id === fundiProfileId));

    response = await request('/api/emergency-requests', { method: 'POST', cookie: customerCookie, body: { serviceType: 'plumber', description: 'Pipe leak reported for integration test.', county: 'Nairobi', town: 'Kahawa', contactPhone: phone } });
    check('emergency request can be recorded honestly', response.status === 201 && response.data.warning.includes('does not dispatch'));
    response = await request('/api/emergency-requests', { cookie: customerCookie });
    check('user can view own emergency request', response.status === 200 && response.data.requests.length === 1);

    response = await request('/api/hubs/listings/' + hubListingId + '/report', { method: 'POST', cookie: fundiCookie, body: { reason: 'spam', details: 'Test moderation report.' } });
    check('listing abuse report is stored', response.status === 201);

    response = await request('/api/admin/overview', { cookie: customerCookie });
    check('admin endpoints enforce role-based access', response.status === 403);

    await pool.query('UPDATE users SET role=$2,updated_at=now() WHERE id=$1', [customerId, 'admin']);
    response = await request('/api/admin/overview', { cookie: customerCookie });
    check('admin dashboard returns metrics for an admin', response.status === 200 && Array.isArray(response.data.users));
    response = await request('/api/admin/analytics', { cookie: customerCookie });
    check('admin can view hub, rewards and daily platform analytics', response.status === 200 && Array.isArray(response.data.listings) && Array.isArray(response.data.daily) && response.data.rewards);
    response = await request('/api/admin/fundis', { cookie: customerCookie });
    check('admin can view verification queue', response.status === 200 && (response.data.fundis || []).some(item => item.profile_id === fundiProfileId));
    response = await request('/api/admin/fundis/' + fundiProfileId + '/verification-checks', { method: 'PATCH', cookie: customerCookie, body: { checkType: 'identity', status: 'verified', evidenceNote: 'Test review of identity evidence' } });
    check('admin can record an identity evidence check', response.status === 200 && response.data.check.status === 'verified');
    response = await request('/api/admin/fundis/' + fundiProfileId + '/verification-checks', { method: 'PATCH', cookie: customerCookie, body: { checkType: 'phone', status: 'verified', evidenceNote: 'Test review of phone contact' } });
    check('admin can record a phone evidence check', response.status === 200 && response.data.check.status === 'verified');
    response = await request('/api/admin/fundis/' + fundiProfileId + '/verification', { method: 'PATCH', cookie: customerCookie, body: { level: 'silver' } });
    check('verification level requires the matching evidence checks', response.status === 200 && response.data.level === 'silver');
    response = await request('/api/admin/fundis/' + fundiProfileId + '/verification', { method: 'PATCH', cookie: customerCookie, body: { level: 'platinum' } });
    check('admin cannot award higher verification without required evidence', response.status === 409 && response.data.error === 'VERIFICATION_EVIDENCE_REQUIRED');
    response = await request('/api/admin/booking-disputes', { cookie: customerCookie });
    const adminDispute = (response.data.disputes || []).find(d => d.booking_id === bookingId);
    check('admin can view booking dispute and booking event timeline', response.status === 200 && Boolean(adminDispute) && adminDispute.timeline.length >= 4);
    response = await request('/api/admin/booking-disputes/' + adminDispute.id, { method: 'PATCH', cookie: customerCookie, body: { status: 'reviewing', resolutionNote: 'Reviewing both parties records.' } });
    check('admin can mark a booking dispute under review', response.status === 200 && response.data.dispute.status === 'reviewing');
    response = await request('/api/admin/booking-disputes/' + adminDispute.id, { method: 'PATCH', cookie: customerCookie, body: { status: 'resolved', resolutionNote: 'Test case reviewed and closed.' } });
    check('closing a dispute restores the underlying payment confirmation state', response.status === 200 && response.data.dispute.status === 'resolved');
    response = await request('/api/bookings', { cookie: customerCookie });
    check('resolved dispute is no longer shown as active and confirmed payment state is restored', response.status === 200 && (response.data.bookings || []).find(b=>b.id===bookingId)?.has_open_dispute===false && (response.data.bookings || []).find(b=>b.id===bookingId)?.direct_payment_status==='confirmed');

    response = await request('/api/admin/fundi-reports', { cookie: customerCookie });
    check('admin can view the provider moderation queue', response.status === 200 && (response.data.reports || []).some(r=>r.fundi_id===fundiProfileId));
    const fundiReportId=(response.data.reports||[]).find(r=>r.fundi_id===fundiProfileId)?.id;
    response = await request('/api/admin/fundi-reports/' + fundiReportId, { method:'PATCH',cookie:customerCookie,body:{status:'resolved',reviewNote:'Test report reviewed.'} });
    check('admin can resolve a provider report with a note', response.status===200 && response.data.report.status==='resolved');

    response = await request('/api/admin/hubs/reports', { cookie: customerCookie });
    check('admin can view marketplace reports', response.status === 200 && (response.data.reports || []).some(r => r.listing_id === hubListingId));
    hubReportId = (response.data.reports || []).find(r => r.listing_id === hubListingId)?.id;
    response = await request('/api/admin/hubs/reports/' + hubReportId, { method: 'PATCH', cookie: customerCookie, body: { status: 'resolved' } });
    check('admin can resolve a hub report', response.status === 200 && response.data.report.status === 'resolved');
    response = await request('/api/admin/hubs/listings/' + hubListingId + '/status', { method: 'PATCH', cookie: customerCookie, body: { status: 'hidden' } });
    check('admin can hide a reported listing', response.status === 200 && response.data.listing.status === 'hidden');
    response = await request('/api/hubs/listings?type=job&q=junior%20web%20developer');
    check('hidden listing is removed from public search', response.status === 200 && !(response.data.listings || []).some(l => l.id === hubListingId));


    response = await request('/api/auth/logout', { method: 'POST', cookie: customerCookie, body: {} });
    response = await request('/api/bookings', { cookie: customerCookie });
    check('logout revokes the session', response.status === 401);
  } catch (error) {
    failure = error;
  } finally {
    try { await cleanup(); }
    catch (cleanupError) {
      console.error('Test data cleanup failed:', cleanupError.message);
      failure = failure || cleanupError;
    }
    await pool.end();
  }

  console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, total: checks.length, checks }, null, 2));
  if (failure) {
    console.error(failure.message);
    process.exitCode = 1;
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
