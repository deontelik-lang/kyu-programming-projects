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
const password = 'IntegrationPassword#12345';
const emailCustomer = 'fctest-' + runId + '-customer@example.invalid';
const emailFundi = 'fctest-' + runId + '-fundi@example.invalid';
const phone = '2547' + String(Date.now()).slice(-8);
const checks = [];
let customerId = null;
let fundiId = null;
let fundiProfileId = null;
let bookingId = null;

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {})
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
    const users = await client.query('SELECT id FROM users WHERE email=ANY($1::text[])', [[emailCustomer, emailFundi]]);
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
    check('launch categories are seeded', response.status === 200 && response.data.categories.length === 3);

    response = await request('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'FundiConnect Test Customer', email: emailCustomer, password, role: 'customer' }
    });
    check('customer registration creates session', response.status === 201 && Boolean(response.cookie));
    customerCookie = response.cookie;

    customerId = response.data.user.id;
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

    for (const status of ['accepted', 'in_progress', 'completed']) {
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

    response = await request('/api/admin/overview', { cookie: customerCookie });
    check('admin endpoints enforce role-based access', response.status === 403);

    await pool.query('UPDATE users SET role=$2,updated_at=now() WHERE id=$1', [customerId, 'admin']);
    response = await request('/api/admin/overview', { cookie: customerCookie });
    check('admin dashboard returns metrics for an admin', response.status === 200 && Array.isArray(response.data.users));
    response = await request('/api/admin/fundis', { cookie: customerCookie });
    check('admin can view verification queue', response.status === 200 && (response.data.fundis || []).some(item => item.profile_id === fundiProfileId));
    response = await request('/api/admin/fundis/' + fundiProfileId + '/verification', { method: 'PATCH', cookie: customerCookie, body: { level: 'silver' } });
    check('admin can update review status', response.status === 200 && response.data.level === 'silver');

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
