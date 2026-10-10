'use strict';

const crypto = require('node:crypto');

function id() { return crypto.randomUUID(); }
function clean(value, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function failRole(user, roles, helpers, res) {
  const problem = helpers.requireRole(user, roles);
  if (!problem) return false;
  helpers.fail(res, problem.status, problem.code, problem.message);
  return true;
}
async function notifySafely(createNotification, ...args) {
  try { await createNotification(...args); }
  catch (error) { console.error('Notification delivery failed after saved action:', error.message); }
}
function futureDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : false;
}

async function handleUpgradeRoutes(ctx) {
  const { req, res, method, pathname, user, pool, helpers } = ctx;
  const { json, fail, readBody, limited, createNotification, logAudit } = helpers;
  const quoteAccept = pathname.match(/^\/api\/job-requests\/([0-9a-f-]{36})\/quotes\/([0-9a-f-]{36})\/accept$/i);
  const requestPath = pathname.match(/^\/api\/job-requests\/([0-9a-f-]{36})$/i);
  const quoteSubmitPath = pathname.match(/^\/api\/job-requests\/([0-9a-f-]{36})\/quotes$/i);
  const declinePath = pathname.match(/^\/api\/job-requests\/([0-9a-f-]{36})\/decline$/i);
  const publicPortfolioPath = pathname.match(/^\/api\/fundis\/([0-9a-f-]{36})\/portfolio$/i);
  const deletePortfolioPath = pathname.match(/^\/api\/fundi\/portfolio\/([0-9a-f-]{36})$/i);

  if (method === 'GET' && pathname === '/api/fundi/toolkit') {
    if (failRole(user, ['fundi'], helpers, res)) return true;
    const result = await pool.query(
      `SELECT fp.id AS profile_id,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.fundi_id=fp.id AND b.status='completed') AS completed_jobs,
        (SELECT COUNT(*)::int FROM bookings b WHERE b.fundi_id=fp.id AND b.status IN ('pending','accepted','assigned','traveling','in_progress')) AS active_bookings,
        (SELECT COUNT(*)::int FROM job_request_providers jrp JOIN job_requests jr ON jr.id=jrp.request_id WHERE jrp.fundi_id=fp.id AND jrp.status IN ('invited','quoted') AND jr.status='open') AS open_leads,
        (SELECT COUNT(*)::int FROM job_quotes jq WHERE jq.fundi_id=fp.id AND jq.status='submitted') AS submitted_quotes,
        (SELECT COALESCE(SUM(b.quoted_price),0)::numeric(12,2) FROM bookings b WHERE b.fundi_id=fp.id AND b.status='completed') AS completed_job_value,
        (SELECT COUNT(*)::int FROM fundi_portfolio_items pi WHERE pi.fundi_id=fp.id AND pi.is_public=true) AS portfolio_items
       FROM fundi_profiles fp WHERE fp.user_id=$1`,
      [user.id]
    );
    if (!result.rowCount) return fail(res, 404, 'FUNDI_PROFILE_NOT_FOUND', 'Complete your professional profile first.');
    const upcoming = await pool.query(
      "SELECT b.id,b.service_title,b.scheduled_at,b.status,b.county,b.town FROM bookings b JOIN fundi_profiles fp ON fp.id=b.fundi_id WHERE fp.user_id=$1 AND b.scheduled_at >= now() AND b.status NOT IN ('cancelled','completed') ORDER BY b.scheduled_at LIMIT 5",
      [user.id]
    );
    return json(res, 200, { toolkit: result.rows[0], upcoming: upcoming.rows });
  }

  if (method === 'GET' && pathname === '/api/fundi/portfolio') {
    if (failRole(user, ['fundi'], helpers, res)) return true;
    const result = await pool.query(
      'SELECT pi.* FROM fundi_portfolio_items pi JOIN fundi_profiles fp ON fp.id=pi.fundi_id WHERE fp.user_id=$1 ORDER BY pi.is_public DESC,pi.created_at DESC LIMIT 50',
      [user.id]
    );
    return json(res, 200, { items: result.rows });
  }

  if (method === 'POST' && pathname === '/api/fundi/portfolio') {
    if (failRole(user, ['fundi'], helpers, res)) return true;
    if (!limited(req, 'fundi-portfolio', 30, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many portfolio updates. Try again later.');
    const body = await readBody(req);
    const title = clean(body.title, 120);
    const description = clean(body.description, 1200);
    const county = clean(body.county, 100);
    const year = body.completedYear === '' || body.completedYear == null ? null : Number(body.completedYear);
    const isPublic = body.isPublic !== false;
    if (title.length < 3 || description.length < 10) return fail(res, 400, 'PORTFOLIO_DETAILS_REQUIRED', 'Add a project title and at least 10 characters describing the work.');
    const thisYear = new Date().getUTCFullYear();
    if (year != null && (!Number.isInteger(year) || year < 1950 || year > thisYear)) return fail(res, 400, 'INVALID_COMPLETED_YEAR', 'Enter a project year between 1950 and this year.');
    const profile = await pool.query('SELECT id FROM fundi_profiles WHERE user_id=$1', [user.id]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_PROFILE_NOT_FOUND', 'Complete your professional profile first.');
    const total = await pool.query('SELECT COUNT(*)::int AS n FROM fundi_portfolio_items WHERE fundi_id=$1', [profile.rows[0].id]);
    if (Number(total.rows[0].n) >= 50) return fail(res, 409, 'PORTFOLIO_LIMIT', 'You can keep up to 50 portfolio projects.');
    const result = await pool.query(
      'INSERT INTO fundi_portfolio_items(id,fundi_id,title,description,county,completed_year,is_public) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id(), profile.rows[0].id, title, description, county, year, isPublic]
    );
    await logAudit(user.id, 'fundi.portfolio_item_created', 'fundi_portfolio_item', result.rows[0].id, { isPublic });
    return json(res, 201, { item: result.rows[0], message: 'Project added to your portfolio.' });
  }

  if (deletePortfolioPath && method === 'DELETE') {
    if (failRole(user, ['fundi'], helpers, res)) return true;
    const removed = await pool.query(
      'DELETE FROM fundi_portfolio_items pi USING fundi_profiles fp WHERE pi.id=$1 AND pi.fundi_id=fp.id AND fp.user_id=$2 RETURNING pi.id',
      [deletePortfolioPath[1], user.id]
    );
    if (!removed.rowCount) return fail(res, 404, 'PORTFOLIO_ITEM_NOT_FOUND', 'Portfolio item not found.');
    await logAudit(user.id, 'fundi.portfolio_item_deleted', 'fundi_portfolio_item', deletePortfolioPath[1]);
    return json(res, 200, { ok: true });
  }

  if (publicPortfolioPath && method === 'GET') {
    const profile = await pool.query('SELECT id FROM fundi_profiles WHERE id=$1', [publicPortfolioPath[1]]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_NOT_FOUND', 'Professional profile not found.');
    const items = await pool.query(
      'SELECT id,title,description,county,completed_year,created_at FROM fundi_portfolio_items WHERE fundi_id=$1 AND is_public=true ORDER BY created_at DESC LIMIT 50',
      [publicPortfolioPath[1]]
    );
    return json(res, 200, { items: items.rows });
  }

  if (method === 'POST' && pathname === '/api/job-requests') {
    if (failRole(user, ['customer'], helpers, res)) return true;
    if (!limited(req, 'smart-job-request', 8, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'You have created several job requests recently. Try again later.');
    const body = await readBody(req);
    const title = clean(body.serviceTitle, 120);
    const description = clean(body.description, 3000);
    const county = clean(body.county, 100);
    const town = clean(body.town, 100);
    const categorySlug = clean(body.categorySlug, 80);
    const priority = body.priority === 'urgent' ? 'urgent' : 'standard';
    const scheduledAt = futureDate(body.scheduledAt);
    if (title.length < 3 || description.length < 5) return fail(res, 400, 'JOB_DETAILS_REQUIRED', 'Enter a service title and describe the work you need.');
    if (body.scheduledAt && !scheduledAt) return fail(res, 400, 'INVALID_DATE', 'Choose a valid appointment date and time.');
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60000) return fail(res, 400, 'PAST_DATE', 'Choose a future appointment time.');
    let categoryId = null;
    if (categorySlug) {
      const category = await pool.query('SELECT id FROM categories WHERE slug=$1 AND active=true', [categorySlug]);
      if (!category.rowCount) return fail(res, 400, 'INVALID_CATEGORY', 'Choose a valid active service category.');
      categoryId = category.rows[0].id;
    }
    const requestId = id();
    await pool.query(
      'INSERT INTO job_requests(id,customer_id,category_id,service_title,description,county,town,scheduled_at,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [requestId, user.id, categoryId, title, description, county, town, scheduledAt, priority]
    );
    const profiles = await pool.query(
      `SELECT fp.id,fp.user_id,u.full_name FROM fundi_profiles fp
       JOIN users u ON u.id=fp.user_id
       WHERE u.is_active=true AND fp.available=true AND fp.user_id<>$1
         AND ($2='' OR lower(fp.county)=lower($2))
         AND ($3::uuid IS NULL OR fp.category_id=$3::uuid)
       ORDER BY fp.updated_at DESC LIMIT 30`,
      [user.id, county, categoryId]
    );
    if (profiles.rowCount) {
      await pool.query(
        'INSERT INTO job_request_providers(request_id,fundi_id) SELECT $1,unnest($2::uuid[]) ON CONFLICT DO NOTHING',
        [requestId, profiles.rows.map(p => p.id)]
      );
      for (const provider of profiles.rows) {
        await notifySafely(createNotification, provider.user_id, 'job_request.invited', 'New job opportunity', 'A customer needs help with: ' + title + (county ? ' in ' + county : '') + '. Review the request and send a quote if it fits your services.');
      }
    }
    await logAudit(user.id, 'job_request.created', 'job_request', requestId, { county, categorySlug, priority, providersNotified: profiles.rowCount });
    return json(res, 201, {
      request: { id: requestId, status: 'open', service_title: title, county, town, priority, scheduled_at: scheduledAt ? scheduledAt.toISOString() : null },
      providersNotified: profiles.rowCount,
      message: profiles.rowCount
        ? 'Your request was shared with ' + profiles.rowCount + ' matching available professionals. You can compare their quotes in your dashboard.'
        : 'Your request is saved. No matching available professionals were found yet; try broadening the area or service category.'
    });
  }

  if (method === 'GET' && pathname === '/api/job-requests') {
    if (failRole(user, ['customer','fundi','admin'], helpers, res)) return true;
    if (user.role === 'customer') {
      const requests = await pool.query(
        `SELECT jr.*,c.slug AS category_slug,c.name AS category_name,
          (SELECT COUNT(*)::int FROM job_quotes jq WHERE jq.request_id=jr.id AND jq.status='submitted') AS quote_count
         FROM job_requests jr LEFT JOIN categories c ON c.id=jr.category_id
         WHERE jr.customer_id=$1 ORDER BY jr.created_at DESC LIMIT 100`,
        [user.id]
      );
      const requestIds = requests.rows.map(r => r.id);
      const quotes = requestIds.length ? await pool.query(
        `SELECT jq.id,jq.request_id,jq.amount,jq.notes,jq.estimated_start_at,jq.status,jq.created_at,
           fp.id AS profile_id,fp.professional_title,fp.county AS fundi_county,fp.town AS fundi_town,fp.years_experience,fp.verification_level,fp.skills,
           u.full_name AS fundi_name,c.name AS category_name,
           COALESCE(rv.rating,0)::float AS rating,COALESCE(rv.review_count,0)::int AS review_count,
           COALESCE(j.completed_jobs,0)::int AS completed_jobs
         FROM job_quotes jq JOIN fundi_profiles fp ON fp.id=jq.fundi_id JOIN users u ON u.id=fp.user_id
         LEFT JOIN categories c ON c.id=fp.category_id
         LEFT JOIN LATERAL (SELECT ROUND(AVG(r.rating)::numeric,1) AS rating,COUNT(*) AS review_count FROM reviews r WHERE r.fundi_id=fp.id) rv ON true
         LEFT JOIN LATERAL (SELECT COUNT(*)::int AS completed_jobs FROM bookings b WHERE b.fundi_id=fp.id AND b.status='completed') j ON true
         WHERE jq.request_id=ANY($1::uuid[]) ORDER BY jq.amount ASC,jq.created_at DESC`,
        [requestIds]
      ) : { rows: [] };
      const byRequest = new Map();
      for (const quote of quotes.rows) {
        if (!byRequest.has(quote.request_id)) byRequest.set(quote.request_id, []);
        byRequest.get(quote.request_id).push(quote);
      }
      return json(res, 200, { requests: requests.rows.map(r => ({ ...r, quotes: byRequest.get(r.id) || [] })) });
    }
    if (user.role === 'admin') {
      const requests = await pool.query(
        `SELECT jr.*,u.full_name AS customer_name,c.name AS category_name,
         (SELECT COUNT(*)::int FROM job_quotes jq WHERE jq.request_id=jr.id) AS quote_count
         FROM job_requests jr JOIN users u ON u.id=jr.customer_id LEFT JOIN categories c ON c.id=jr.category_id
         ORDER BY jr.created_at DESC LIMIT 200`
      );
      return json(res, 200, { requests: requests.rows });
    }
    const profile = await pool.query('SELECT id FROM fundi_profiles WHERE user_id=$1', [user.id]);
    if (!profile.rowCount) return json(res, 200, { requests: [] });
    const requests = await pool.query(
      `SELECT jr.*,cu.full_name AS customer_name,c.name AS category_name,
         jrp.status AS invitation_status,jq.id AS quote_id,jq.amount AS quote_amount,jq.notes AS quote_notes,jq.estimated_start_at AS quote_estimated_start_at,jq.status AS quote_status
       FROM job_request_providers jrp
       JOIN job_requests jr ON jr.id=jrp.request_id
       JOIN users cu ON cu.id=jr.customer_id
       LEFT JOIN categories c ON c.id=jr.category_id
       LEFT JOIN job_quotes jq ON jq.request_id=jr.id AND jq.fundi_id=jrp.fundi_id
       WHERE jrp.fundi_id=$1 AND jr.status='open' AND jrp.status IN ('invited','quoted')
       ORDER BY CASE WHEN jr.priority='urgent' THEN 0 ELSE 1 END,jr.created_at DESC LIMIT 100`,
      [profile.rows[0].id]
    );
    return json(res, 200, { requests: requests.rows });
  }

  if (quoteSubmitPath && method === 'POST') {
    if (failRole(user, ['fundi'], helpers, res)) return true;
    if (!limited(req, 'smart-job-quote', 40, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many quote submissions. Try again later.');
    const body = await readBody(req);
    const amount = Number(body.amount);
    const notes = clean(body.notes, 1200);
    const estimatedStartAt = futureDate(body.estimatedStartAt);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) return fail(res, 400, 'INVALID_QUOTE', 'Enter a whole-number quote in Kenyan shillings.');
    if (body.estimatedStartAt && !estimatedStartAt) return fail(res, 400, 'INVALID_DATE', 'Enter a valid proposed start date.');
    if (estimatedStartAt && estimatedStartAt.getTime() < Date.now() - 60000) return fail(res, 400, 'PAST_DATE', 'The proposed start date must be in the future.');
    const profile = await pool.query('SELECT id,user_id FROM fundi_profiles WHERE user_id=$1', [user.id]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_PROFILE_NOT_FOUND', 'Complete your professional profile first.');
    const job = await pool.query(
      `SELECT jr.* FROM job_requests jr JOIN job_request_providers jrp ON jrp.request_id=jr.id
       WHERE jr.id=$1 AND jrp.fundi_id=$2 AND jr.status='open' AND jrp.status IN ('invited','quoted')`,
      [quoteSubmitPath[1], profile.rows[0].id]
    );
    if (!job.rowCount) return fail(res, 404, 'JOB_REQUEST_NOT_FOUND', 'This request is no longer open or was not shared with your profile.');
    const instructionsResult = await pool.query('SELECT * FROM provider_payment_instructions WHERE fundi_id=$1', [profile.rows[0].id]);
    const instructions = instructionsResult.rows[0];
    if (!instructions || !Array.isArray(instructions.accepted_methods) || !instructions.accepted_methods.length) {
      return fail(res, 409, 'PAYMENT_METHODS_NOT_SET', 'Save your direct-payment instructions before sending a quote, so the customer knows your accepted payment methods if you are selected.');
    }
    const quote = await pool.query(
      `INSERT INTO job_quotes(id,request_id,fundi_id,amount,notes,estimated_start_at,payment_instructions_snapshot,status)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'submitted')
       ON CONFLICT(request_id,fundi_id) DO UPDATE SET amount=EXCLUDED.amount,notes=EXCLUDED.notes,estimated_start_at=EXCLUDED.estimated_start_at,payment_instructions_snapshot=EXCLUDED.payment_instructions_snapshot,status='submitted',updated_at=now()
       WHERE job_quotes.status IN ('submitted','withdrawn')
       RETURNING *`,
      [id(), job.rows[0].id, profile.rows[0].id, amount, notes, estimatedStartAt, JSON.stringify(instructions)]
    );
    if (!quote.rowCount) return fail(res, 409, 'QUOTE_LOCKED', 'This quote can no longer be changed.');
    await pool.query("UPDATE job_request_providers SET status='quoted',responded_at=now() WHERE request_id=$1 AND fundi_id=$2", [job.rows[0].id, profile.rows[0].id]);
    await notifySafely(createNotification, job.rows[0].customer_id, 'job_quote.received', 'A new service quote is ready', 'A provider submitted a quote of KSh ' + amount.toLocaleString('en-KE') + ' for "' + job.rows[0].service_title + '". Compare quotes in your dashboard.');
    await logAudit(user.id, 'job_quote.submitted', 'job_quote', quote.rows[0].id, { requestId: job.rows[0].id, amount });
    return json(res, 201, { quote: quote.rows[0], message: 'Quote sent to the customer.' });
  }

  if (declinePath && method === 'POST') {
    if (failRole(user, ['fundi'], helpers, res)) return true;
    const profile = await pool.query('SELECT id FROM fundi_profiles WHERE user_id=$1', [user.id]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_PROFILE_NOT_FOUND', 'Complete your professional profile first.');
    const updated = await pool.query(
      `UPDATE job_request_providers jrp SET status='declined',responded_at=now()
       FROM job_requests jr WHERE jrp.request_id=jr.id AND jrp.request_id=$1 AND jrp.fundi_id=$2 AND jr.status='open' AND jrp.status IN ('invited','quoted')
       RETURNING jrp.request_id`,
      [declinePath[1], profile.rows[0].id]
    );
    if (!updated.rowCount) return fail(res, 404, 'REQUEST_NOT_FOUND', 'This request is no longer open for your account.');
    await pool.query("UPDATE job_quotes SET status='withdrawn',updated_at=now() WHERE request_id=$1 AND fundi_id=$2 AND status='submitted'", [declinePath[1], profile.rows[0].id]);
    await logAudit(user.id, 'job_request.declined', 'job_request', declinePath[1]);
    return json(res, 200, { ok: true, message: 'Request declined. It will no longer appear in your job desk.' });
  }

  if (quoteAccept && method === 'PATCH') {
    if (failRole(user, ['customer'], helpers, res)) return true;
    if (!limited(req, 'job-quote-accept', 15, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many quote selection attempts. Try again later.');
    const client = await pool.connect();
    let booking;
    let selectedFundiUserId;
    let requestTitle;
    try {
      await client.query('BEGIN');
      const requestResult = await client.query('SELECT * FROM job_requests WHERE id=$1 FOR UPDATE', [quoteAccept[1]]);
      if (!requestResult.rowCount || requestResult.rows[0].customer_id !== user.id) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'JOB_REQUEST_NOT_FOUND', 'Request not found for your account.');
      }
      const job = requestResult.rows[0];
      requestTitle = job.service_title;
      if (job.status !== 'open') {
        await client.query('ROLLBACK');
        return fail(res, 409, 'REQUEST_CLOSED', 'This request already has a selected provider or has been closed.');
      }
      const quoteResult = await client.query(
        `SELECT jq.*,fp.user_id AS fundi_user_id,fp.id AS fundi_profile_id,u.full_name AS fundi_name
         FROM job_quotes jq JOIN fundi_profiles fp ON fp.id=jq.fundi_id JOIN users u ON u.id=fp.user_id
         WHERE jq.id=$1 AND jq.request_id=$2 FOR UPDATE OF jq`,
        [quoteAccept[2], job.id]
      );
      if (!quoteResult.rowCount || quoteResult.rows[0].status !== 'submitted') {
        await client.query('ROLLBACK');
        return fail(res, 409, 'QUOTE_UNAVAILABLE', 'That quote is no longer available. Refresh the comparison.');
      }
      const quote = quoteResult.rows[0];
      const methods = quote.payment_instructions_snapshot && quote.payment_instructions_snapshot.accepted_methods;
      if (!Array.isArray(methods) || !methods.length) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'PAYMENT_METHODS_NOT_SET', 'This provider must add payment instructions before you can select the quote.');
      }
      const bookingId = id();
      const inserted = await client.query(
        `INSERT INTO bookings(id,customer_id,fundi_id,service_title,description,county,town,scheduled_at,status,quoted_price,accepted_at,direct_payment_instructions_snapshot,job_request_id,job_quote_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'accepted',$9,now(),$10::jsonb,$11,$12)
         RETURNING id,status,quoted_price,service_title,created_at`,
        [bookingId, user.id, quote.fundi_id, job.service_title, job.description, job.county, job.town, job.scheduled_at || quote.estimated_start_at, quote.amount, JSON.stringify(quote.payment_instructions_snapshot), job.id, quote.id]
      );
      booking = inserted.rows[0];
      selectedFundiUserId = quote.fundi_user_id;
      await client.query("UPDATE job_quotes SET status=CASE WHEN id=$2 THEN 'accepted' ELSE 'declined' END,updated_at=now() WHERE request_id=$1 AND status='submitted'", [job.id, quote.id]);
      await client.query("UPDATE job_request_providers SET status=CASE WHEN fundi_id=$2 THEN 'selected' ELSE 'closed' END,responded_at=now() WHERE request_id=$1 AND status IN ('invited','quoted')", [job.id, quote.fundi_id]);
      await client.query("UPDATE job_requests SET status='awarded',updated_at=now() WHERE id=$1", [job.id]);
      await client.query('INSERT INTO booking_events(id,booking_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4,$5::jsonb)', [id(), booking.id, user.id, 'smart_quote_accepted', JSON.stringify({ requestId: job.id, quoteId: quote.id, amount: Number(quote.amount) })]);
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      if (error.code === '23505') return fail(res, 409, 'QUOTE_ALREADY_SELECTED', 'Another quote has already been selected for this request.');
      throw error;
    } finally {
      client.release();
    }
    await notifySafely(createNotification, selectedFundiUserId, 'job_quote.accepted', 'Your quote was selected', 'The customer selected your quote for "' + requestTitle + '". Review the new booking and agree on any final details.');
    await logAudit(user.id, 'job_quote.accepted', 'booking', booking.id, { requestId: quoteAccept[1], quoteId: quoteAccept[2] });
    return json(res, 201, { booking, message: 'Quote accepted. A booking was created and the other quotes were closed.' });
  }

  if (requestPath && method === 'PATCH') {
    if (failRole(user, ['customer'], helpers, res)) return true;
    const body = await readBody(req);
    const nextStatus = clean(body.status, 30);
    if (nextStatus !== 'cancelled') return fail(res, 400, 'INVALID_REQUEST_STATUS', 'Only cancellation is supported here.');
    const updated = await pool.query(
      "UPDATE job_requests SET status='cancelled',updated_at=now() WHERE id=$1 AND customer_id=$2 AND status='open' RETURNING id",
      [requestPath[1], user.id]
    );
    if (!updated.rowCount) return fail(res, 409, 'REQUEST_NOT_CANCELLABLE', 'This request is not open or does not belong to your account.');
    const invitedUsers = await pool.query("SELECT DISTINCT u.id,u.full_name FROM job_request_providers jrp JOIN fundi_profiles fp ON fp.id=jrp.fundi_id JOIN users u ON u.id=fp.user_id WHERE jrp.request_id=$1 AND jrp.status IN ('invited','quoted')", [requestPath[1]]);
    await pool.query("UPDATE job_request_providers SET status='closed',responded_at=now() WHERE request_id=$1 AND status IN ('invited','quoted')", [requestPath[1]]);
    for (const provider of invitedUsers.rows) await notifySafely(createNotification, provider.id, 'job_request.cancelled', 'Customer cancelled a request', 'The customer cancelled a job request you were invited to. No quote or booking action is required.');
    await logAudit(user.id, 'job_request.cancelled', 'job_request', requestPath[1]);
    return json(res, 200, { ok: true });
  }

  return false;
}

module.exports = { handleUpgradeRoutes };
