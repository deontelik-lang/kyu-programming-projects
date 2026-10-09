'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT || 8080);
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'public');
const SESSION_COOKIE = 'fc_session';
const SESSION_TTL_DAYS = 7;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
  application_name: 'fundiconnect-pro'
});
pool.on('error', (err) => console.error('Unexpected idle PostgreSQL client error:', err.message));

const categories = [
  { name: 'CCTV Installers', slug: 'cctv', description: 'Security camera installation, repair and maintenance' },
  { name: 'WiFi & Network Technicians', slug: 'network', description: 'WiFi, routers, LAN, fiber and structured cabling' },
  { name: 'Electricians', slug: 'electrician', description: 'Electrical installation, troubleshooting and maintenance' }
];

const migrationsDir = path.join(__dirname, 'migrations');

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...extraHeaders
  });
  res.end(body);
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      try { out[k] = decodeURIComponent(v); } catch { out[k] = ''; }
    }
  }
  return out;
}

function cookieHeader(req, name, value, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (secure ? '; Secure' : '');
}

function fail(res, status, code, message) {
  return json(res, status, { error: code, message });
}

function validEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
  if (typeof phone !== 'string' || !phone.trim()) return null;
  const clean = phone.replace(/[\s()-]/g, '');
  if (!/^\+?[0-9]{9,15}$/.test(clean)) return null;
  return clean.startsWith('+') ? clean : clean;
}

function text(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function integer(value, min, max, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 65536) {
      const err = new Error('Request body is too large.');
      err.status = 413;
      throw err;
    }
  }
  if (!data) return {};
  try { return JSON.parse(data); }
  catch {
    const err = new Error('Body must be valid JSON.');
    err.status = 400;
    throw err;
  }
}

const attempts = new Map();
function limited(req, key, max = 12, windowMs = 60000) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim().slice(0, 80);
  const now = Date.now();
  const bucketKey = ip + ':' + key;
  let item = attempts.get(bucketKey);
  if (!item || item.reset < now) item = { count: 0, reset: now + windowMs };
  item.count += 1;
  attempts.set(bucketKey, item);
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  return item.count <= max;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return 'scrypt$16384$8$1$' + salt.toString('hex') + '$' + derived.toString('hex');
}

async function verifyPassword(password, encoded) {
  try {
    const bits = encoded.split('$');
    if (bits.length !== 6 || bits[0] !== 'scrypt') return false;
    const salt = Buffer.from(bits[4], 'hex');
    const expected = Buffer.from(bits[5], 'hex');
    const actual = await scrypt(password, salt, expected.length, { N: Number(bits[1]), r: Number(bits[2]), p: Number(bits[3]), maxmem: 64 * 1024 * 1024 });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

async function logAudit(actor, action, type, id, metadata = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), actor || null, action, type, id ? String(id) : null, JSON.stringify(metadata)]
    );
  } catch (e) { console.error('Audit log failed:', e.message); }
}

async function userFromRequest(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length < 40) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await pool.query(
    'SELECT u.id,u.full_name,u.email,u.phone,u.role,u.created_at FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active=true',
    [tokenHash]
  );
  if (!result.rowCount) return null;
  return result.rows[0];
}

function requireRole(user, roles) {
  if (!user) return { status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in to continue.' };
  if (!roles.includes(user.role)) return { status: 403, code: 'FORBIDDEN', message: 'Your account is not permitted to do that.' };
  return null;
}

async function createNotification(userId, type, title, body, bookingId = null) {
  await pool.query(
    'INSERT INTO notifications(id,user_id,type,title,body,booking_id) VALUES($1,$2,$3,$4,$5,$6)',
    [crypto.randomUUID(), userId, type, title, body, bookingId]
  );
}

function calculateTrustScore(p) {
  const reviews = Number(p.review_count || 0);
  const rating = reviews ? Number(p.rating || 0) / 5 * 100 : 0;
  const reviewVolume = Math.min(reviews / 10, 1) * 100;
  const jobs = Number(p.completed_jobs || 0);
  const jobScore = Math.min(jobs / 50, 1) * 100;
  const levels = { none: 0, bronze: 25, silver: 50, gold: 75, platinum: 100 };
  const verification = levels[p.verification_level] || 0;
  const total = Number(p.total_jobs || 0);
  const response = total ? Number(p.responded_jobs || 0) / total * 100 : 0;
  const completedFields = [Boolean(p.professional_title), Boolean(p.bio && p.bio.trim()), Boolean(p.county && p.county.trim()), Boolean(p.town && p.town.trim()), Number(p.years_experience || 0) > 0, Array.isArray(p.skills) && p.skills.length > 0].filter(Boolean).length;
  const profileComplete = completedFields / 6 * 100;
  return Math.round((reviewVolume * 0.4 + rating * 0.2 + jobScore * 0.15 + verification * 0.1 + response * 0.1 + profileComplete * 0.05) * 10) / 10;
}

async function fundiStats(profileId) {
  const result = await pool.query(
    "SELECT COUNT(r.id)::int AS review_count, COALESCE(ROUND(AVG(r.rating)::numeric,1),0)::float AS rating, (SELECT COUNT(*)::int FROM bookings b WHERE b.fundi_id=$1 AND b.status='completed') AS completed_jobs FROM reviews r WHERE r.fundi_id=$1",
    [profileId]
  );
  return result.rows[0];
}

async function mainRouter(req, res, url) {
  const method = req.method || 'GET';
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    const db = await pool.query('SELECT 1 AS ok');
    return json(res, 200, { ok: true, database: db.rows[0].ok === 1, service: 'FundiConnect Pro API', time: new Date().toISOString() });
  }

  if (method === 'GET' && pathname === '/api/categories') {
    const r = await pool.query('SELECT id,name,slug,description FROM categories WHERE active=true ORDER BY name');
    return json(res, 200, { categories: r.rows });
  }

  if (method === 'GET' && pathname === '/api/fundis') {
    const q = text(url.searchParams.get('q'), 120).toLowerCase();
    const county = text(url.searchParams.get('county'), 100);
    const town = text(url.searchParams.get('town'), 100);
    const category = text(url.searchParams.get('category'), 80);
    const available = url.searchParams.get('available') !== 'false';
    const result = await pool.query(
      "SELECT fp.id AS profile_id, u.id AS user_id, u.full_name, fp.professional_title, fp.bio, fp.county, fp.town, fp.years_experience, fp.skills, fp.available, fp.verification_level, c.name AS category_name, c.slug AS category_slug, COALESCE(rv.rating,0)::float AS rating, COALESCE(rv.review_count,0)::int AS review_count, COALESCE(j.completed_jobs,0)::int AS completed_jobs, COALESCE(resp.total_jobs,0)::int AS total_jobs, COALESCE(resp.responded_jobs,0)::int AS responded_jobs, fp.created_at FROM fundi_profiles fp JOIN users u ON u.id=fp.user_id LEFT JOIN categories c ON c.id=fp.category_id LEFT JOIN LATERAL (SELECT ROUND(AVG(r.rating)::numeric,1) AS rating, COUNT(*) AS review_count FROM reviews r WHERE r.fundi_id=fp.id) rv ON true LEFT JOIN LATERAL (SELECT COUNT(*) AS completed_jobs FROM bookings b WHERE b.fundi_id=fp.id AND b.status='completed') j ON true LEFT JOIN LATERAL (SELECT COUNT(*) FILTER(WHERE b.status<>'cancelled') AS total_jobs,COUNT(*) FILTER(WHERE b.status NOT IN ('pending','cancelled')) AS responded_jobs FROM bookings b WHERE b.fundi_id=fp.id) resp ON true WHERE u.is_active=true AND ($1='' OR lower(u.full_name || ' ' || fp.professional_title || ' ' || fp.bio || ' ' || array_to_string(fp.skills,' ')) LIKE '%' || $1 || '%') AND ($2='' OR lower(fp.county)=lower($2)) AND ($3='' OR lower(fp.town)=lower($3)) AND ($4='' OR c.slug=$4) AND ($5=false OR fp.available=true) ORDER BY (CASE WHEN rv.rating IS NULL THEN 0 ELSE rv.rating END) DESC, fp.created_at DESC LIMIT 100",
      [q, county, town, category, available]
    );
    return json(res, 200, { fundis: result.rows.map(p => ({ ...p, trust_score: calculateTrustScore(p) })) });
  }

  const individualFundi = pathname.match(/^\/api\/fundis\/([0-9a-f-]{36})$/i);
  if (method === 'GET' && individualFundi) {
    const result = await pool.query(
      "SELECT fp.id AS profile_id, u.id AS user_id, u.full_name, fp.professional_title, fp.bio, fp.county, fp.town, fp.years_experience, fp.skills, fp.available, fp.verification_level, c.name AS category_name, c.slug AS category_slug, COALESCE(rv.rating,0)::float AS rating, COALESCE(rv.review_count,0)::int AS review_count, COALESCE(j.completed_jobs,0)::int AS completed_jobs, COALESCE(resp.total_jobs,0)::int AS total_jobs, COALESCE(resp.responded_jobs,0)::int AS responded_jobs, fp.created_at FROM fundi_profiles fp JOIN users u ON u.id=fp.user_id LEFT JOIN categories c ON c.id=fp.category_id LEFT JOIN LATERAL (SELECT ROUND(AVG(r.rating)::numeric,1) AS rating, COUNT(*) AS review_count FROM reviews r WHERE r.fundi_id=fp.id) rv ON true LEFT JOIN LATERAL (SELECT COUNT(*) AS completed_jobs FROM bookings b WHERE b.fundi_id=fp.id AND b.status='completed') j ON true LEFT JOIN LATERAL (SELECT COUNT(*) FILTER(WHERE b.status<>'cancelled') AS total_jobs,COUNT(*) FILTER(WHERE b.status NOT IN ('pending','cancelled')) AS responded_jobs FROM bookings b WHERE b.fundi_id=fp.id) resp ON true WHERE fp.id=$1 AND u.is_active=true",
      [individualFundi[1]]
    );
    if (!result.rowCount) return fail(res, 404, 'NOT_FOUND', 'This professional profile could not be found.');
    return json(res, 200, { fundi: { ...result.rows[0], trust_score: calculateTrustScore(result.rows[0]) } });
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    if (!limited(req, 'register', 5, 15 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many sign-up attempts. Try again later.');
    const body = await readBody(req);
    const fullName = text(body.fullName, 100);
    const email = text(body.email, 254).toLowerCase() || null;
    const rawPhone = text(body.phone, 32);
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const password = typeof body.password === 'string' ? body.password : '';
    const roleRequested = body.role === 'fundi' ? 'fundi' : 'customer';
    if (fullName.length < 2) return fail(res, 400, 'INVALID_NAME', 'Enter your full name.');
    if ((!email || !validEmail(email)) && !phone) return fail(res, 400, 'CONTACT_REQUIRED', 'Enter a valid email address or phone number.');
    if (email && !validEmail(email)) return fail(res, 400, 'INVALID_EMAIL', 'Enter a valid email address.');
    if (rawPhone && !phone) return fail(res, 400, 'INVALID_PHONE', 'Enter a phone number with 9 to 15 digits.');
    if (password.length < 10 || password.length > 200) return fail(res, 400, 'WEAK_PASSWORD', 'Use a password between 10 and 200 characters.');
    const categorySlug = text(body.categorySlug, 80) || 'network';
    const categoryResult = await pool.query('SELECT id FROM categories WHERE slug=$1 AND active=true', [categorySlug]);
    const categoryId = categoryResult.rows[0]?.id || null;
    const id = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const role = roleRequested; // Admin access is provisioned only through the trusted operator CLI, never by claiming an email address.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO users(id,full_name,email,phone,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',
        [id, fullName, email, phone, passwordHash, role]
      );
      if (role === 'fundi') {
        await client.query(
          "INSERT INTO fundi_profiles(id,user_id,category_id,professional_title,county,town) VALUES($1,$2,$3,$4,$5,$6)",
          [profileId, id, categoryId, text(body.professionalTitle, 120) || 'Skilled Professional', text(body.county, 100), text(body.town, 100)]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') return fail(res, 409, 'ACCOUNT_EXISTS', 'An account already uses this email address or phone number.');
      throw e;
    } finally { client.release(); }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+make_interval(days => $4::int))', [crypto.randomUUID(), id, tokenHash, String(SESSION_TTL_DAYS)]);
    await logAudit(id, 'account.registered', 'user', id, { role });
    const user = { id, full_name: fullName, email, phone, role };
    return json(res, 201, { user }, { 'Set-Cookie': cookieHeader(req, SESSION_COOKIE, token, SESSION_TTL_DAYS * 86400) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!limited(req, 'login', 10, 15 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again later.');
    const body = await readBody(req);
    const identifierRaw = text(body.identifier, 254);
    const identifier = identifierRaw.toLowerCase();
    const phoneIdentifier = normalizePhone(identifierRaw) || identifierRaw;
    const password = typeof body.password === 'string' ? body.password : '';
    if (!identifier || !password) return fail(res, 400, 'MISSING_CREDENTIALS', 'Enter your email or phone number and password.');
    const result = await pool.query('SELECT id,full_name,email,phone,password_hash,role,is_active FROM users WHERE email=$1 OR phone=$2 LIMIT 1', [identifier, phoneIdentifier]);
    if (!result.rowCount || !result.rows[0].is_active || !(await verifyPassword(password, result.rows[0].password_hash))) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Those credentials do not match an active account.');
    }
    const account = result.rows[0];
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+make_interval(days => $4::int))', [crypto.randomUUID(), account.id, tokenHash, String(SESSION_TTL_DAYS)]);
    await logAudit(account.id, 'account.signed_in', 'user', account.id);
    return json(res, 200, { user: { id: account.id, full_name: account.full_name, email: account.email, phone: account.phone, role: account.role } }, { 'Set-Cookie': cookieHeader(req, SESSION_COOKIE, token, SESSION_TTL_DAYS * 86400) });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await pool.query('DELETE FROM user_sessions WHERE token_hash=$1', [tokenHash]);
    }
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, SESSION_COOKIE, '', 0) });
  }

  const user = await userFromRequest(req).catch(() => null);

  if (method === 'GET' && pathname === '/api/me') {
    if (!user) return json(res, 200, { user: null });
    const profile = user.role === 'fundi' ? (await pool.query('SELECT fp.*,c.name AS category_name,c.slug AS category_slug FROM fundi_profiles fp LEFT JOIN categories c ON c.id=fp.category_id WHERE fp.user_id=$1', [user.id])).rows[0] || null : null;
    const unread = await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL', [user.id]);
    return json(res, 200, { user, profile, unreadNotifications: unread.rows[0].count });
  }

  if (method === 'PATCH' && pathname === '/api/fundi/profile') {
    const problem = requireRole(user, ['fundi']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const body = await readBody(req);
    const title = text(body.professionalTitle, 120);
    const bio = text(body.bio, 1800);
    const county = text(body.county, 100);
    const town = text(body.town, 100);
    const years = integer(body.yearsExperience, 0, 70, 0);
    const categorySlug = text(body.categorySlug, 80);
    const skills = [...new Set((Array.isArray(body.skills) ? body.skills : text(body.skills, 600).split(',')).map(s => text(String(s), 60)).filter(Boolean))].slice(0, 15);
    const available = typeof body.available === 'boolean' ? body.available : null;
    if (title.length < 3 || county.length < 2 || town.length < 2) return fail(res, 400, 'PROFILE_INCOMPLETE', 'Add a professional title, county and town (at least 2 characters each).');
    const result = await pool.query('SELECT id FROM categories WHERE slug=$1 AND active=true', [categorySlug]);
    if (!result.rowCount) return fail(res, 400, 'INVALID_CATEGORY', 'Choose one of the active launch categories.');
    await pool.query('UPDATE fundi_profiles SET professional_title=$2,bio=$3,county=$4,town=$5,years_experience=$6,category_id=$7,skills=$8,available=COALESCE($9,available),updated_at=now() WHERE user_id=$1', [user.id, title, bio, county, town, years, result.rows[0].id, skills, available]);
    await logAudit(user.id, 'fundi.profile_updated', 'fundi_profile', user.id);
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/bookings') {
    const problem = requireRole(user, ['customer','fundi','company','admin']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    let result;
    if (user.role === 'admin') {
      result = await pool.query("SELECT b.*,cu.full_name AS customer_name,fu.full_name AS fundi_name,fp.id AS fundi_profile_id,EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id=b.id) AS has_review FROM bookings b JOIN users cu ON cu.id=b.customer_id JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users fu ON fu.id=fp.user_id ORDER BY b.created_at DESC LIMIT 200");
    } else if (user.role === 'fundi') {
      result = await pool.query("SELECT b.*,cu.full_name AS customer_name,fu.full_name AS fundi_name,fp.id AS fundi_profile_id,EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id=b.id) AS has_review FROM bookings b JOIN users cu ON cu.id=b.customer_id JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users fu ON fu.id=fp.user_id WHERE fp.user_id=$1 ORDER BY b.created_at DESC LIMIT 200", [user.id]);
    } else {
      result = await pool.query("SELECT b.*,cu.full_name AS customer_name,fu.full_name AS fundi_name,fp.id AS fundi_profile_id,EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id=b.id) AS has_review FROM bookings b JOIN users cu ON cu.id=b.customer_id JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users fu ON fu.id=fp.user_id WHERE b.customer_id=$1 ORDER BY b.created_at DESC LIMIT 200", [user.id]);
    }
    return json(res, 200, { bookings: result.rows });
  }

  if (method === 'POST' && pathname === '/api/bookings') {
    const problem = requireRole(user, ['customer']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const body = await readBody(req);
    const fundiId = text(body.fundiId, 60);
    const title = text(body.serviceTitle, 120);
    const description = text(body.description, 3000);
    const county = text(body.county, 100);
    const town = text(body.town, 100);
    const scheduledRaw = text(body.scheduledAt, 80);
    const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
    if (!/^[0-9a-f-]{36}$/i.test(fundiId)) return fail(res, 400, 'INVALID_FUNDI', 'Choose a valid professional.');
    if (title.length < 3 || description.length < 5) return fail(res, 400, 'JOB_DETAILS_REQUIRED', 'Add a service title and describe the work you need.');
    if (scheduledAt && !Number.isFinite(scheduledAt.getTime())) return fail(res, 400, 'INVALID_DATE', 'Choose a valid appointment date and time.');
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60000) return fail(res, 400, 'PAST_DATE', 'Choose a future appointment time.');
    const profile = await pool.query("SELECT fp.id,fp.user_id,fp.available,u.full_name FROM fundi_profiles fp JOIN users u ON u.id=fp.user_id WHERE fp.id=$1 AND u.is_active=true", [fundiId]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_NOT_FOUND', 'That professional is no longer available.');
    if (profile.rows[0].user_id === user.id) return fail(res, 400, 'OWN_BOOKING', 'You cannot book your own profile.');
    if (!profile.rows[0].available) return fail(res, 409, 'UNAVAILABLE', 'This professional is not currently accepting requests.');
    const bookingId = crypto.randomUUID();
    await pool.query(
      'INSERT INTO bookings(id,customer_id,fundi_id,service_title,description,county,town,scheduled_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [bookingId, user.id, fundiId, title, description, county, town, scheduledAt]
    );
    await createNotification(profile.rows[0].user_id, 'booking.new', 'New service request', user.full_name + ' requested: ' + title, bookingId);
    await logAudit(user.id, 'booking.created', 'booking', bookingId, { fundiId });
    return json(res, 201, { booking: { id: bookingId, status: 'pending' }, message: 'Your service request has been sent.' });
  }

  const statusPath = pathname.match(/^\/api\/bookings\/([0-9a-f-]{36})\/status$/i);
  if (method === 'PATCH' && statusPath) {
    const problem = requireRole(user, ['customer','fundi','admin']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const body = await readBody(req);
    const nextStatus = text(body.status, 30).toLowerCase();
    const r = await pool.query("SELECT b.*,fp.user_id AS fundi_user_id,cu.full_name AS customer_name,fu.full_name AS fundi_name FROM bookings b JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users cu ON cu.id=b.customer_id JOIN users fu ON fu.id=fp.user_id WHERE b.id=$1", [statusPath[1]]);
    if (!r.rowCount) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    const b = r.rows[0];
    const isCustomer = user.id === b.customer_id;
    const isFundi = user.id === b.fundi_user_id;
    if (user.role !== 'admin' && !isCustomer && !isFundi) return fail(res, 403, 'NOT_YOUR_BOOKING', 'You can only update your own bookings.');
    const allowed = {
      pending: ['accepted','cancelled'],
      accepted: ['assigned','traveling','in_progress','cancelled'],
      assigned: ['traveling','in_progress','cancelled'],
      traveling: ['in_progress','cancelled'],
      in_progress: ['completed']
    };
    if (!allowed[b.status] || !allowed[b.status].includes(nextStatus)) return fail(res, 409, 'INVALID_TRANSITION', 'That status change is not allowed.');
    if (nextStatus === 'accepted' && !isFundi && user.role !== 'admin') return fail(res, 403, 'FUNDI_ACTION_ONLY', 'Only the assigned fundi can accept the request.');
    if (['assigned','traveling','in_progress','completed'].includes(nextStatus) && !isFundi && user.role !== 'admin') return fail(res, 403, 'FUNDI_ACTION_ONLY', 'Only the assigned fundi can update job progress.');
    if (nextStatus === 'cancelled' && !isCustomer && !isFundi && user.role !== 'admin') return fail(res, 403, 'CANCEL_NOT_ALLOWED', 'Only a booking participant can cancel.');
    const updated = await pool.query("UPDATE bookings SET status=$2,updated_at=now(),accepted_at=CASE WHEN $2='accepted' THEN now() ELSE accepted_at END,completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END WHERE id=$1 AND status=$3", [b.id, nextStatus, b.status]);
    if (!updated.rowCount) return fail(res, 409, 'BOOKING_CHANGED', 'This booking was updated by another request. Refresh and try again.');
    const recipient = isCustomer ? b.fundi_user_id : b.customer_id;
    await createNotification(recipient, 'booking.status', 'Booking ' + nextStatus.replace('_',' '), 'The service request for "' + b.service_title + '" is now ' + nextStatus.replace('_',' ') + '.', b.id);
    await logAudit(user.id, 'booking.status_changed', 'booking', b.id, { from: b.status, to: nextStatus });
    return json(res, 200, { ok: true, status: nextStatus });
  }

  if (method === 'POST' && pathname === '/api/reviews') {
    const problem = requireRole(user, ['customer']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const body = await readBody(req);
    const bookingId = text(body.bookingId, 60);
    const rating = integer(body.rating, 1, 5, 0);
    const measures = ['professionalism','speed','communication','quality','value'].map(k => integer(body[k], 1, 5, rating));
    const comment = text(body.comment, 1500);
    if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !rating) return fail(res, 400, 'INVALID_REVIEW', 'Choose a valid completed booking and rating.');
    const booking = await pool.query("SELECT id,fundi_id,status FROM bookings WHERE id=$1 AND customer_id=$2", [bookingId, user.id]);
    if (!booking.rowCount) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Completed booking not found for your account.');
    if (booking.rows[0].status !== 'completed') return fail(res, 409, 'JOB_NOT_COMPLETED', 'Reviews can only be left after a booking is completed.');
    try {
      await pool.query(
        'INSERT INTO reviews(id,booking_id,customer_id,fundi_id,rating,professionalism,speed,communication,quality,value_score,comment) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [crypto.randomUUID(), bookingId, user.id, booking.rows[0].fundi_id, rating, ...measures, comment]
      );
    } catch (e) {
      if (e.code === '23505') return fail(res, 409, 'REVIEW_EXISTS', 'You have already reviewed this booking.');
      throw e;
    }
    await createNotification((await pool.query('SELECT user_id FROM fundi_profiles WHERE id=$1', [booking.rows[0].fundi_id])).rows[0].user_id, 'review.new', 'New customer review', user.full_name + ' left a review for a completed job.', bookingId);
    await logAudit(user.id, 'review.created', 'booking', bookingId, { rating });
    return json(res, 201, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/notifications') {
    if (!user) return fail(res, 401, 'AUTH_REQUIRED', 'Please sign in to view notifications.');
    const r = await pool.query('SELECT id,type,title,body,booking_id,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [user.id]);
    return json(res, 200, { notifications: r.rows });
  }

  if (method === 'POST' && pathname === '/api/notifications/read') {
    if (!user) return fail(res, 401, 'AUTH_REQUIRED', 'Please sign in.');
    await pool.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [user.id]);
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/admin/fundis') {
    const problem = requireRole(user, ['admin']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const r = await pool.query("SELECT fp.id AS profile_id,u.id AS user_id,u.full_name,u.email,u.phone,fp.professional_title,fp.county,fp.town,fp.years_experience,fp.verification_level,fp.created_at,c.name AS category_name FROM fundi_profiles fp JOIN users u ON u.id=fp.user_id LEFT JOIN categories c ON c.id=fp.category_id ORDER BY fp.created_at DESC LIMIT 200");
    return json(res, 200, { fundis: r.rows });
  }

  if (method === 'GET' && pathname === '/api/admin/overview') {
    const problem = requireRole(user, ['admin']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const [users, fundis, bookings, revenue, recent] = await Promise.all([
      pool.query('SELECT role,COUNT(*)::int AS count FROM users GROUP BY role'),
      pool.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE verification_level<>'none')::int AS verification_levels FROM fundi_profiles"),
      pool.query('SELECT status,COUNT(*)::int AS count FROM bookings GROUP BY status'),
      pool.query('SELECT COUNT(*)::int AS total_reviews FROM reviews'),
      pool.query("SELECT b.id,b.service_title,b.status,b.created_at,cu.full_name AS customer_name,fu.full_name AS fundi_name FROM bookings b JOIN users cu ON cu.id=b.customer_id JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users fu ON fu.id=fp.user_id ORDER BY b.created_at DESC LIMIT 10")
    ]);
    return json(res, 200, { users: users.rows, fundis: fundis.rows[0], bookings: bookings.rows, reviews: revenue.rows[0], recent: recent.rows });
  }

  const verificationPath = pathname.match(/^\/api\/admin\/fundis\/([0-9a-f-]{36})\/verification$/i);
  if (method === 'PATCH' && verificationPath) {
    const problem = requireRole(user, ['admin']);
    if (problem) return fail(res, problem.status, problem.code, problem.message);
    const body = await readBody(req);
    const level = text(body.level, 20).toLowerCase();
    if (!['none','bronze','silver','gold','platinum'].includes(level)) return fail(res, 400, 'INVALID_LEVEL', 'Unknown verification level.');
    const result = await pool.query('UPDATE fundi_profiles SET verification_level=$2,updated_at=now() WHERE id=$1 RETURNING id', [verificationPath[1], level]);
    if (!result.rowCount) return fail(res, 404, 'FUNDI_NOT_FOUND', 'Professional not found.');
    await logAudit(user.id, 'fundi.verification_changed', 'fundi_profile', verificationPath[1], { level });
    return json(res, 200, { ok: true, level });
  }

  return null;
}

async function initialize() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const migrationFiles = fs.readdirSync(migrationsDir).filter(name => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
  for (const name of migrationFiles) {
    const seen = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (seen.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(migrationsDir, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.log('Applied database migration:', name);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  }
  for (const item of categories) {
    await pool.query(
      'INSERT INTO categories(id,name,slug,description) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description',
      [crypto.randomUUID(), item.name, item.slug, item.description]
    );
  }
  await pool.query('DELETE FROM user_sessions WHERE expires_at < now()');
  console.log('Database schema is ready; launch categories seeded.');
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Allow': 'GET,POST,PATCH,OPTIONS' });
    return res.end();
  }
  const unsafe = ['POST','PUT','PATCH','DELETE'].includes(req.method);
  if (unsafe && req.headers.origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    try {
      if (new URL(req.headers.origin).host !== host) return fail(res, 403, 'ORIGIN_REJECTED', 'Cross-site request rejected.');
    } catch { return fail(res, 403, 'ORIGIN_REJECTED', 'Invalid request origin.'); }
  }
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname.startsWith('/api/')) {
      if (!limited(req, 'api', 300, 60000)) return fail(res, 429, 'RATE_LIMITED', 'Too many requests. Try again shortly.');
      const result = await mainRouter(req, res, url);
      if (result === null && !res.writableEnded) return fail(res, 404, 'NOT_FOUND', 'API endpoint not found.');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname.includes('..') || pathname.includes('\\')) return fail(res, 400, 'INVALID_PATH', 'Invalid path.');
    const fullPath = path.join(ROOT, pathname.replace(/^\/+/, ''));
    if (!fullPath.startsWith(ROOT)) return fail(res, 403, 'FORBIDDEN', 'Forbidden.');
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') return json(res, 404, { error: 'NOT_FOUND', message: 'Page not found.' });
        console.error('Static file error:', err.message);
        return json(res, 500, { error: 'SERVER_ERROR', message: 'Unable to read page.' });
      }
      const ext = path.extname(fullPath);
      const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600' });
      return req.method === 'HEAD' ? res.end() : res.end(data);
    });
  } catch (e) {
    console.error('Request failed:', e.code || e.name, e.message);
    if (!res.headersSent) {
      const status = Number(e.status) || (e.code === '23505' ? 409 : 500);
      return fail(res, status, status === 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR', status === 500 ? 'The request could not be completed. Please try again.' : e.message);
    }
    res.end();
  }
});

initialize().then(() => {
  server.listen(PORT, HOST, () => console.log('FundiConnect Pro listening on ' + HOST + ':' + PORT));
}).catch((err) => {
  console.error('Startup failed:', err.stack || err.message);
  process.exit(1);
});

async function shutdown(signal) {
  console.log(signal + ' received; shutting down.');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

