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
    let response = await request('/api/health');
    check('API and PostgreSQL health', response.status === 200 && response.data.database === true);

    response = await request('/api/categories');
    check('expanded service directory is seeded', response.status === 200 && response.data.categories.length >= 13 && response.data.categories.some(c => c.slug === 'plumber'));
    response = await request('/api/hubs/types');
    check('13 super-app hubs are available', response.status === 200 && response.data.hubs.length === 13);
    response = await request('/api/payments/mpesa/config');
    const mpesaEnabled = response.status === 200 && response.data.enabled === true;
    check('M-Pesa readiness endpoint exposes status without credentials', response.status === 200 && typeof response.data.enabled === 'boolean' && !('consumerKey' in response.data));

    response = await request('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'FundiConnect Test Customer', email: emailCustomer, password, role: 'customer', persona: 'student', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1' }
    });
    check('customer registration creates session', response.status === 201 && Boolean(response.cookie));
    customerCookie = response.cookie;

    customerId = response.data.user.id;
    response = await request('/api/me', { cookie: customerCookie });
    check('student persona and campus profile persist', response.status === 200 && response.data.platformProfile?.persona === 'student' && response.data.platformProfile?.campus === 'Integration Campus');
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

    response = await request('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'FundiConnect Test Company', email: emailCompany, password, persona: 'employer', organisation: 'Integration Test Organisation', companyWebsite: 'https://example.invalid' }
    });
    check('business and employer sign-up creates a company account', response.status === 201 && response.data.user.role === 'company');
    const companyCookie = response.cookie;
    response = await request('/api/company/dashboard', { cookie: companyCookie });
    check('company workspace initializes with a self-declared profile', response.status === 200 && response.data.profile.organization_name === 'Integration Test Organisation');
    response = await request('/api/company/profile', { method: 'PATCH', cookie: companyCookie, body: { organizationName: 'Integration Test Organisation Ltd', website: 'https://example.invalid', description: 'A test company for hiring student developers.' } });
    check('company can save its organisation profile', response.status === 200 && response.data.profile.organization_name === 'Integration Test Organisation Ltd');
    response = await request('/api/hubs/listings', { method: 'POST', cookie: companyCookie, body: { type: 'internship', title: 'Company platform QA internship', description: 'A testing internship for students checking the company workspace.', category: 'Software testing', county: 'Nairobi', town: 'Kahawa' } });
    check('company account can publish an internship', response.status === 201 && response.data.listing.hub_type === 'internship');
    response = await request('/api/company/dashboard', { cookie: companyCookie });
    check('company dashboard summarizes company listings', response.status === 200 && Number(response.data.metrics.total_listings) === 1 && Number(response.data.metrics.active_roles) === 1);
    response = await request('/api/company/dashboard', { cookie: customerCookie });
    check('company dashboard blocks non-company members', response.status === 403);

    response = await request('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'FundiConnect Test Fundi', email: emailFundi, phone, password,
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
    check('assigned fundi can quote and accept a booking', response.status === 200 && Number(response.data.booking.quoted_price) === 2500 && response.data.booking.status === 'accepted');
    if (!mpesaEnabled) {
      response = await request('/api/payments/mpesa/stk-push', {
        method: 'POST', cookie: customerCookie,
        body: { bookingId, phoneNumber: phone }
      });
      check('M-Pesa checkout fails closed while provider settings are absent', response.status === 503);
    }

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

    response = await request('/api/platform-profile', { method: 'PATCH', cookie: customerCookie, body: { persona: 'student', headline: 'IT student looking for internships', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', graduationYear: 2029, bio: 'Testing CampusConnect profile', skills: ['C', 'Networking'], organisation: '', portfolioUrl: '' } });
    check('student profile can be edited', response.status === 200 && response.data.profile.campus === 'Integration Campus');
    response = await request('/api/members?q=FundiConnect%20Test%20Customer');
    check('campus directory keeps profiles private by default', response.status === 200 && !(response.data.members || []).some(m => m.user_id === customerId));
    response = await request('/api/platform-profile', { method: 'PATCH', cookie: customerCookie, body: { persona: 'student', headline: 'IT student looking for internships', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', graduationYear: 2029, bio: 'Testing CampusConnect profile', skills: ['C', 'Networking'], organisation: '', portfolioUrl: '', publicDirectory: true } });
    check('member can opt into the public directory', response.status === 200 && response.data.profile.public_directory === true);
    response = await request('/api/members?q=FundiConnect%20Test%20Customer');
    check('public campus search returns opted-in members only', response.status === 200 && (response.data.members || []).some(m => m.user_id === customerId) && !('email' in ((response.data.members || []).find(m => m.user_id === customerId) || {})));
    response = await request('/api/platform-profile', { method: 'PATCH', cookie: customerCookie, body: { persona: 'student', headline: 'IT student looking for internships', campus: 'Integration Campus', course: 'Information Technology', studyLevel: 'Year 1', graduationYear: 2029, bio: 'Testing CampusConnect profile', skills: ['C', 'Networking'], organisation: '', portfolioUrl: '', publicDirectory: false } });
    check('member can opt out of the public directory', response.status === 200 && response.data.profile.public_directory === false);
    response = await request('/api/members?q=FundiConnect%20Test%20Customer');
    check('opted-out member is no longer discoverable', response.status === 200 && !(response.data.members || []).some(m => m.user_id === customerId));
    response = await request('/api/cv', { cookie: customerCookie });
    check('CV builder data is available', response.status === 200 && response.data.cv.full_name === 'FundiConnect Test Customer');

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
    response = await request('/api/admin/fundis/' + fundiProfileId + '/verification', { method: 'PATCH', cookie: customerCookie, body: { level: 'silver' } });
    check('admin can update review status', response.status === 200 && response.data.level === 'silver');
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
