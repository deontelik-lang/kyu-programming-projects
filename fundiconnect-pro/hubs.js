'use strict';

const crypto = require('node:crypto');

const listingTypes = new Set([
  'student_gig','job','internship','housing','product','event','course',
  'business','community','transport','student_service','alumni','service_offer'
]);
const actionsByType = {
  student_gig: ['apply'], job: ['apply'], internship: ['apply'],
  housing: ['inquire'], product: ['inquire'], event: ['attend'],
  course: ['enroll'], business: ['inquire'], community: [],
  transport: ['book'], student_service: ['inquire'], alumni: ['mentor'],
  service_offer: ['inquire']
};
const personaChoices = new Set(['student','worker','customer','business','employer','alumni']);
const actionChoices = new Set(['save','apply','inquire','attend','enroll','book','mentor']);

function uuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}
function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function bounded(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
function roleProblem(user, roles, fail) {
  if (!user) return { status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in to continue.' };
  if (!roles.includes(user.role)) return { status: 403, code: 'FORBIDDEN', message: 'Your account is not permitted to do that.' };
  return null;
}
function failResult(res, fail, problem) {
  return fail(res, problem.status, problem.code, problem.message);
}

async function handleHubRoutes(ctx) {
  const { req, res, url, method, pathname, user, pool, helpers } = ctx;
  const { json, fail, text, limited, requireRole, createNotification, logAudit, hubTypes } = helpers;
  const notFound = () => fail(res, 404, 'NOT_FOUND', 'Hub endpoint not found.');
  const problemFor = (roles) => {
    const p = requireRole(user, roles);
    return p ? failResult(res, fail, p) : null;
  };

  if (method === 'GET' && pathname === '/api/members') {
    const q = bounded(url.searchParams.get('q'), 120).toLowerCase();
    const campus = bounded(url.searchParams.get('campus'), 160);
    const persona = bounded(url.searchParams.get('persona'), 30).toLowerCase();
    if (persona && !personaChoices.has(persona)) return fail(res, 400, 'INVALID_PERSONA', 'Choose a supported profile type.');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 36, 1), 80);
    const r = await pool.query("SELECT pp.id AS profile_id,u.id AS user_id,u.full_name,pp.persona,pp.headline,pp.campus,pp.course,pp.study_level,pp.graduation_year,pp.bio,pp.skills,pp.organisation,pp.portfolio_url,pp.updated_at FROM platform_profiles pp JOIN users u ON u.id=pp.user_id WHERE pp.public_directory=true AND u.is_active=true AND ($1='' OR pp.persona=$1) AND ($2='' OR lower(pp.campus)=lower($2)) AND ($3='' OR lower(u.full_name || ' ' || pp.headline || ' ' || pp.campus || ' ' || pp.course || ' ' || pp.bio || ' ' || array_to_string(pp.skills,' ')) LIKE '%' || $3 || '%') ORDER BY pp.updated_at DESC LIMIT $4",
      [persona,campus,q,limit]
    );
    return json(res, 200, { members: r.rows, count: r.rowCount, privacyNote: 'Only members who opt into the public directory appear here. Contact details are not exposed.' });
  }
  if (method === 'GET' && pathname === '/api/hubs/types') {
    return json(res, 200, {
      hubs: Object.entries(hubTypes).map(([type, info]) => ({ type, ...info })),
      status: 'mvp',
      note: 'Payments, live tracking and external verification are not connected until their providers are configured.'
    });
  }

  if (method === 'GET' && pathname === '/api/platform-profile') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const r = await pool.query('SELECT * FROM platform_profiles WHERE user_id=$1', [user.id]);
    return json(res, 200, { profile: r.rows[0] || null });
  }

  if (method === 'PATCH' && pathname === '/api/platform-profile') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const persona = bounded(body.persona, 30).toLowerCase();
    if (!personaChoices.has(persona)) return fail(res, 400, 'INVALID_PERSONA', 'Choose a valid profile type.');
    const graduation = body.graduationYear === '' || body.graduationYear == null ? null : Number(body.graduationYear);
    if (graduation !== null && (!Number.isInteger(graduation) || graduation < 1990 || graduation > 2100)) return fail(res, 400, 'INVALID_GRADUATION_YEAR', 'Enter a valid graduation year.');
    const portfolio = bounded(body.portfolioUrl, 500);
    if (portfolio && !/^https?:\/\/\S+$/i.test(portfolio)) return fail(res, 400, 'INVALID_PORTFOLIO_URL', 'Portfolio URL must begin with http:// or https://.');
    const skills = [...new Set((Array.isArray(body.skills) ? body.skills : bounded(body.skills, 1000).split(',')).map(v => bounded(String(v), 60)).filter(Boolean))].slice(0, 20);
    await pool.query(
      'INSERT INTO platform_profiles(id,user_id,persona,headline,campus,course,study_level,graduation_year,bio,skills,organisation,portfolio_url,public_directory,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()) ON CONFLICT(user_id) DO UPDATE SET persona=EXCLUDED.persona,headline=EXCLUDED.headline,campus=EXCLUDED.campus,course=EXCLUDED.course,study_level=EXCLUDED.study_level,graduation_year=EXCLUDED.graduation_year,bio=EXCLUDED.bio,skills=EXCLUDED.skills,organisation=EXCLUDED.organisation,portfolio_url=EXCLUDED.portfolio_url,public_directory=EXCLUDED.public_directory,updated_at=now()',
      [crypto.randomUUID(),user.id,persona,bounded(body.headline,140),bounded(body.campus,160),bounded(body.course,160),bounded(body.studyLevel,80),graduation,bounded(body.bio,1800),skills,bounded(body.organisation,180),portfolio,body.publicDirectory===true]
    );
    await logAudit(user.id, 'platform.profile_updated', 'platform_profile', user.id, { persona });
    const r = await pool.query('SELECT * FROM platform_profiles WHERE user_id=$1', [user.id]);
    return json(res, 200, { profile: r.rows[0] });
  }

  if (method === 'GET' && pathname === '/api/cv') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const r = await pool.query('SELECT u.full_name,u.email,u.phone,pp.persona,pp.headline,pp.campus,pp.course,pp.study_level,pp.graduation_year,pp.bio,pp.skills,pp.organisation,pp.portfolio_url FROM users u LEFT JOIN platform_profiles pp ON pp.user_id=u.id WHERE u.id=$1', [user.id]);
    return json(res, 200, { cv: r.rows[0] || null, disclaimer: 'Review this draft for accuracy before sharing it with an employer.' });
  }

  if (method === 'GET' && pathname === '/api/hubs/listings') {
    const type = bounded(url.searchParams.get('type'), 40);
    if (type && !listingTypes.has(type)) return fail(res, 400, 'INVALID_HUB_TYPE', 'Choose a supported hub category.');
    const q = bounded(url.searchParams.get('q'), 120).toLowerCase();
    const county = bounded(url.searchParams.get('county'), 100);
    const town = bounded(url.searchParams.get('town'), 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 40, 1), 100);
    const viewerId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    const r = await pool.query(
      "SELECT l.id,l.owner_user_id,l.hub_type,l.title,l.description,l.category,l.county,l.town,l.price,l.currency,l.status,l.starts_at,l.ends_at,l.metadata,l.created_at,l.updated_at,u.full_name AS owner_name,COALESCE(pp.persona,CASE WHEN u.role='fundi' THEN 'worker' ELSE 'customer' END) AS owner_persona,COALESCE(ac.action_count,0)::int AS action_count,COALESCE(cc.comment_count,0)::int AS comment_count,EXISTS(SELECT 1 FROM hub_listing_actions a WHERE a.listing_id=l.id AND a.user_id=$5 AND a.action='save') AS is_saved FROM hub_listings l JOIN users u ON u.id=l.owner_user_id LEFT JOIN platform_profiles pp ON pp.user_id=u.id LEFT JOIN LATERAL (SELECT COUNT(*) AS action_count FROM hub_listing_actions a WHERE a.listing_id=l.id AND a.action<>'save') ac ON true LEFT JOIN LATERAL (SELECT COUNT(*) AS comment_count FROM hub_comments c WHERE c.listing_id=l.id) cc ON true WHERE ($1='' OR l.hub_type=$1) AND ($2='' OR lower(l.title || ' ' || l.description || ' ' || l.category || ' ' || l.metadata::text) LIKE '%' || $2 || '%') AND ($3='' OR lower(l.county)=lower($3)) AND ($4='' OR lower(l.town)=lower($4)) AND (l.status='published' OR (l.owner_user_id=$5 AND l.status<>'hidden') OR $6=true) AND (l.ends_at IS NULL OR l.ends_at>now()) ORDER BY l.created_at DESC LIMIT $7",
      [type,q,county,town,viewerId,isAdmin,limit]
    );
    return json(res, 200, { listings: r.rows, count: r.rowCount });
  }

  if (method === 'POST' && pathname === '/api/hubs/listings') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    if (!limited(req, 'hub-listing-create', 12, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many posts. Try again later.');
    const body = object(await readBody(req));
    const type = bounded(body.type, 40);
    const title = bounded(body.title, 140);
    const description = bounded(body.description, 5000);
    const category = bounded(body.category, 100);
    const county = bounded(body.county, 100);
    const town = bounded(body.town, 100);
    const metadata = object(body.metadata);
    if (!listingTypes.has(type)) return fail(res, 400, 'INVALID_HUB_TYPE', 'Choose a supported hub category.');
    if (title.length < 4 || description.length < 10) return fail(res, 400, 'LISTING_DETAILS_REQUIRED', 'Add a title and a description of at least 10 characters.');
    if (JSON.stringify(metadata).length > 5000) return fail(res, 400, 'METADATA_TOO_LARGE', 'Extra listing details are too large.');
    let price = null;
    if (body.price !== undefined && body.price !== null && body.price !== '') {
      price = Number(body.price);
      if (!Number.isFinite(price) || price < 0 || price > 1000000000) return fail(res, 400, 'INVALID_PRICE', 'Enter a valid non-negative price in KSh.');
    }
    const startsAt = dateValue(body.startsAt);
    const endsAt = dateValue(body.endsAt);
    if (startsAt === undefined || endsAt === undefined) return fail(res, 400, 'INVALID_DATE', 'Enter a valid date and time.');
    if (startsAt && endsAt && endsAt <= startsAt) return fail(res, 400, 'INVALID_DATE_RANGE', 'The end date must be after the start date.');
    const id = crypto.randomUUID();
    const r = await pool.query(
      'INSERT INTO hub_listings(id,owner_user_id,hub_type,title,description,category,county,town,price,currency,status,starts_at,ends_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,\'KES\',\'published\',$10,$11,$12) RETURNING id,hub_type,title,status,created_at',
      [id,user.id,type,title,description,category,county,town,price,startsAt,endsAt,JSON.stringify(metadata)]
    );
    await logAudit(user.id, 'hub.listing_created', 'hub_listing', id, { type });
    return json(res, 201, { listing: r.rows[0] });
  }

  const listingStatus = pathname.match(/^\/api\/hubs\/listings\/([0-9a-f-]{36})\/status$/i);
  if (method === 'PATCH' && listingStatus) {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const status = bounded(body.status, 20);
    if (!['published','closed','hidden'].includes(status)) return fail(res, 400, 'INVALID_STATUS', 'Choose published, closed or hidden.');
    const existing = await pool.query('SELECT id,owner_user_id,status FROM hub_listings WHERE id=$1', [listingStatus[1]]);
    if (!existing.rowCount) return fail(res, 404, 'LISTING_NOT_FOUND', 'Listing not found.');
    if (existing.rows[0].owner_user_id !== user.id && user.role !== 'admin') return fail(res, 403, 'NOT_YOUR_LISTING', 'You can only manage your own listing.');
    if (status === 'hidden' && user.role !== 'admin') return fail(res, 403, 'ADMIN_ONLY', 'Only an administrator can hide a listing.');
    await pool.query('UPDATE hub_listings SET status=$2,updated_at=now() WHERE id=$1', [listingStatus[1],status]);
    await logAudit(user.id, 'hub.listing_status_changed', 'hub_listing', listingStatus[1], { status });
    return json(res, 200, { ok: true, status });
  }

  const listingAction = pathname.match(/^\/api\/hubs\/listings\/([0-9a-f-]{36})\/actions$/i);
  if (method === 'GET' && listingAction) {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const listing = await pool.query('SELECT owner_user_id FROM hub_listings WHERE id=$1', [listingAction[1]]);
    if (!listing.rowCount) return fail(res,404,'LISTING_NOT_FOUND','Listing not found.');
    if (listing.rows[0].owner_user_id !== user.id && user.role !== 'admin') return fail(res,403,'NOT_YOUR_LISTING','Only the listing owner can view responses.');
    const r = await pool.query("SELECT a.id,a.action,a.note,a.status,a.created_at,u.id AS user_id,u.full_name,pp.persona,pp.headline,pp.campus,pp.course,pp.skills FROM hub_listing_actions a JOIN users u ON u.id=a.user_id LEFT JOIN platform_profiles pp ON pp.user_id=u.id WHERE a.listing_id=$1 AND a.action<>'save' ORDER BY a.created_at DESC LIMIT 200", [listingAction[1]]);
    return json(res,200,{actions:r.rows});
  }
  if (method === 'POST' && listingAction) {

    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const action = bounded(body.action, 20);
    const note = bounded(body.note, 1500);
    if (!actionChoices.has(action)) return fail(res, 400, 'INVALID_ACTION', 'Choose a supported action.');
    const r = await pool.query('SELECT id,owner_user_id,hub_type,title,status FROM hub_listings WHERE id=$1', [listingAction[1]]);
    if (!r.rowCount || r.rows[0].status !== 'published') return fail(res, 404, 'LISTING_UNAVAILABLE', 'This listing is not available.');
    const listing = r.rows[0];
    if (listing.owner_user_id === user.id) return fail(res, 400, 'OWN_LISTING_ACTION', 'You cannot apply to, inquire about, or save your own listing.');
    if (action !== 'save' && !(actionsByType[listing.hub_type] || []).includes(action)) return fail(res, 400, 'ACTION_NOT_SUPPORTED', 'That action is not available for this hub.');
    try {
      const insert = await pool.query(
        'INSERT INTO hub_listing_actions(id,listing_id,user_id,action,note) VALUES($1,$2,$3,$4,$5) RETURNING id,action,status,created_at',
        [crypto.randomUUID(),listing.id,user.id,action,note]
      );
      if (action !== 'save') await createNotification(listing.owner_user_id, 'hub.' + action, 'New ' + action + ' on your listing', user.full_name + ' ' + action + 'ed your listing: ' + listing.title);
      await logAudit(user.id, 'hub.listing_action', 'hub_listing', listing.id, { action });
      return json(res, 201, { action: insert.rows[0], confirmationCode: action === 'attend' ? 'CC-' + insert.rows[0].id.slice(0,8).toUpperCase() : undefined });
    } catch (e) {
      if (e.code === '23505') return fail(res, 409, 'ACTION_EXISTS', 'You have already completed this action for that listing.');
      throw e;
    }
  }

  const actionStatusPath = pathname.match(/^\/api\/hubs\/actions\/([0-9a-f-]{36})\/status$/i);
  if (method === 'PATCH' && actionStatusPath) {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const status = bounded(body.status,20);
    if (!['reviewed','accepted','declined','cancelled'].includes(status)) return fail(res,400,'INVALID_ACTION_STATUS','Choose a valid application status.');
    const r = await pool.query('SELECT a.id,a.user_id,a.status,l.owner_user_id,l.title FROM hub_listing_actions a JOIN hub_listings l ON l.id=a.listing_id WHERE a.id=$1', [actionStatusPath[1]]);
    if (!r.rowCount) return fail(res,404,'ACTION_NOT_FOUND','Application or response not found.');
    if (r.rows[0].owner_user_id !== user.id && user.role !== 'admin') return fail(res,403,'NOT_YOUR_LISTING','Only the listing owner can review responses.');
    await pool.query('UPDATE hub_listing_actions SET status=$2,updated_at=now() WHERE id=$1', [actionStatusPath[1],status]);
    await createNotification(r.rows[0].user_id,'hub.application_status','Your response was updated','Your response to "'+r.rows[0].title+'" is now '+status+'.');
    await logAudit(user.id,'hub.action_reviewed','hub_listing_action',actionStatusPath[1],{status});
    return json(res,200,{ok:true,status});
  }

  const removeAction = pathname.match(/^\/api\/hubs\/listings\/([0-9a-f-]{36})\/actions\/(save|apply|inquire|attend|enroll|book|mentor)$/i);
  if (method === 'DELETE' && removeAction) {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const r = await pool.query('DELETE FROM hub_listing_actions WHERE listing_id=$1 AND user_id=$2 AND action=$3 RETURNING id', [removeAction[1],user.id,removeAction[2]]);
    return json(res, r.rowCount ? 200 : 404, r.rowCount ? { ok: true } : { error: 'ACTION_NOT_FOUND', message: 'Saved item or action not found.' });
  }

  if (method === 'GET' && pathname === '/api/hubs/activity') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const [owned, actions, messages, rewards] = await Promise.all([
      pool.query("SELECT id,hub_type,title,status,created_at FROM hub_listings WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT 30", [user.id]),
      pool.query("SELECT a.id,a.action,a.status AS action_status,a.note,a.created_at,l.id AS listing_id,l.hub_type,l.title,l.status AS listing_status,l.owner_user_id FROM hub_listing_actions a JOIN hub_listings l ON l.id=a.listing_id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 50", [user.id]),
      pool.query('SELECT COUNT(*)::int AS unread FROM hub_messages WHERE recipient_user_id=$1 AND read_at IS NULL', [user.id]),
      pool.query('SELECT COALESCE(SUM(points),0)::int AS points FROM reward_ledger WHERE user_id=$1', [user.id])
    ]);
    return json(res, 200, { myListings: owned.rows, myActions: actions.rows, unreadMessages: messages.rows[0].unread, rewardPoints: rewards.rows[0].points });
  }

  const commentPath = pathname.match(/^\/api\/hubs\/listings\/([0-9a-f-]{36})\/comments$/i);
  if ((method === 'GET' || method === 'POST') && commentPath) {
    const listing = await pool.query("SELECT id,owner_user_id,hub_type,status FROM hub_listings WHERE id=$1 AND (status='published' OR owner_user_id=$2)", [commentPath[1],user?.id || null]);
    if (!listing.rowCount || listing.rows[0].hub_type !== 'community') return fail(res, 404, 'COMMUNITY_POST_NOT_FOUND', 'Community post not found.');
    if (method === 'GET') {
      const rows = await pool.query('SELECT c.id,c.body,c.created_at,u.id AS user_id,u.full_name,pp.persona FROM hub_comments c JOIN users u ON u.id=c.user_id LEFT JOIN platform_profiles pp ON pp.user_id=u.id WHERE c.listing_id=$1 ORDER BY c.created_at ASC LIMIT 100', [commentPath[1]]);
      return json(res, 200, { comments: rows.rows });
    }
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    if (!limited(req, 'hub-comment', 30, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'You are posting too quickly. Try again later.');
    const body = object(await readBody(req));
    const comment = bounded(body.body, 1500);
    if (!comment) return fail(res, 400, 'EMPTY_COMMENT', 'Write a comment before posting.');
    const r = await pool.query('INSERT INTO hub_comments(id,listing_id,user_id,body) VALUES($1,$2,$3,$4) RETURNING id,body,created_at', [crypto.randomUUID(),commentPath[1],user.id,comment]);
    if (listing.rows[0].owner_user_id !== user.id) await createNotification(listing.rows[0].owner_user_id,'community.comment','New community reply',user.full_name + ' replied to your post.');
    return json(res, 201, { comment: r.rows[0] });
  }

  if (method === 'GET' && pathname === '/api/hubs/messages') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const r = await pool.query(
      "SELECT m.id,m.listing_id,m.sender_user_id,m.recipient_user_id,m.body,m.read_at,m.created_at,l.title AS listing_title,s.full_name AS sender_name,rr.full_name AS recipient_name FROM hub_messages m JOIN hub_listings l ON l.id=m.listing_id JOIN users s ON s.id=m.sender_user_id JOIN users rr ON rr.id=m.recipient_user_id WHERE m.sender_user_id=$1 OR m.recipient_user_id=$1 ORDER BY m.created_at DESC LIMIT 100",
      [user.id]
    );
    await pool.query('UPDATE hub_messages SET read_at=now() WHERE recipient_user_id=$1 AND read_at IS NULL', [user.id]);
    return json(res, 200, { messages: r.rows });
  }

  if (method === 'POST' && pathname === '/api/hubs/messages') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const listingId = bounded(body.listingId, 60);
    const messageBody = bounded(body.body, 3000);
    const recipientId = bounded(body.recipientUserId, 60);
    if (!uuid(listingId) || messageBody.length < 1) return fail(res, 400, 'INVALID_MESSAGE', 'Choose a listing and enter a message.');
    const r = await pool.query("SELECT id,owner_user_id,title,status FROM hub_listings WHERE id=$1 AND status='published'", [listingId]);
    if (!r.rowCount) return fail(res, 404, 'LISTING_UNAVAILABLE', 'That listing is no longer available.');
    const listing = r.rows[0];
    let recipient = listing.owner_user_id;
    if (listing.owner_user_id === user.id) {
      if (!uuid(recipientId)) return fail(res, 400, 'RECIPIENT_REQUIRED', 'Choose a person from the existing conversation.');
      const prior = await pool.query('SELECT 1 FROM hub_messages WHERE listing_id=$1 AND ((sender_user_id=$2 AND recipient_user_id=$3) OR (sender_user_id=$3 AND recipient_user_id=$2)) LIMIT 1', [listingId,user.id,recipientId]);
      if (!prior.rowCount) return fail(res, 403, 'NO_CONVERSATION', 'You can only reply to someone who has contacted you about this listing.');
      recipient = recipientId;
    }
    if (recipient === user.id) return fail(res, 400, 'INVALID_RECIPIENT', 'You cannot message yourself.');
    await pool.query('INSERT INTO hub_messages(id,listing_id,sender_user_id,recipient_user_id,body) VALUES($1,$2,$3,$4,$5)', [crypto.randomUUID(),listingId,user.id,recipient,messageBody]);
    await createNotification(recipient,'hub.message','New message about ' + listing.title,user.full_name + ' sent you a message about your listing.');
    return json(res, 201, { ok: true, message: 'Message sent.' });
  }

  const reportPath = pathname.match(/^\/api\/hubs\/listings\/([0-9a-f-]{36})\/report$/i);
  if (method === 'POST' && reportPath) {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const reason = bounded(body.reason, 30);
    const details = bounded(body.details, 1200);
    if (!['spam','fraud','unsafe','misleading','harassment','other'].includes(reason)) return fail(res, 400, 'INVALID_REPORT_REASON', 'Choose a report reason.');
    const existing = await pool.query('SELECT owner_user_id FROM hub_listings WHERE id=$1', [reportPath[1]]);
    if (!existing.rowCount) return fail(res, 404, 'LISTING_NOT_FOUND', 'Listing not found.');
    if (existing.rows[0].owner_user_id === user.id) return fail(res, 400, 'OWN_REPORT', 'You cannot report your own listing.');
    try {
      await pool.query('INSERT INTO hub_reports(id,listing_id,reporter_user_id,reason,details) VALUES($1,$2,$3,$4,$5)', [crypto.randomUUID(),reportPath[1],user.id,reason,details]);
    } catch (e) {
      if (e.code === '23505') return fail(res, 409, 'REPORT_EXISTS', 'You have already reported this listing.');
      throw e;
    }
    return json(res, 201, { ok: true, message: 'Report received for review.' });
  }

  if (method === 'GET' && pathname === '/api/favorites') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const r = await pool.query(
      "SELECT f.id,f.target_type,f.target_id,f.created_at,CASE WHEN f.target_type='fundi' THEN fu.full_name ELSE l.title END AS target_name,CASE WHEN f.target_type='fundi' THEN fp.professional_title ELSE l.hub_type END AS target_description FROM hub_favorites f LEFT JOIN fundi_profiles fp ON f.target_type='fundi' AND fp.id=f.target_id LEFT JOIN users fu ON fu.id=fp.user_id LEFT JOIN hub_listings l ON f.target_type IN ('business','listing') AND l.id=f.target_id WHERE f.user_id=$1 ORDER BY f.created_at DESC LIMIT 100",
      [user.id]
    );
    return json(res, 200, { favorites: r.rows });
  }

  if (method === 'POST' && pathname === '/api/favorites') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const type = bounded(body.targetType, 20);
    const id = bounded(body.targetId, 60);
    if (!uuid(id) || !['fundi','business','listing'].includes(type)) return fail(res, 400, 'INVALID_FAVORITE', 'Choose a valid favorite.');
    if (type === 'fundi') {
      const r = await pool.query('SELECT 1 FROM fundi_profiles fp JOIN users u ON u.id=fp.user_id WHERE fp.id=$1 AND u.is_active=true', [id]);
      if (!r.rowCount) return fail(res, 404, 'TARGET_NOT_FOUND', 'Professional not found.');
    } else {
      const r = await pool.query("SELECT 1 FROM hub_listings WHERE id=$1 AND status='published' AND ($2=false OR hub_type='business')", [id,type==='business']);
      if (!r.rowCount) return fail(res, 404, 'TARGET_NOT_FOUND', 'Listing not found.');
    }
    try {
      await pool.query('INSERT INTO hub_favorites(id,user_id,target_type,target_id) VALUES($1,$2,$3,$4)', [crypto.randomUUID(),user.id,type,id]);
    } catch (e) {
      if (e.code === '23505') return fail(res, 409, 'ALREADY_FAVORITED', 'This item is already in your favorites.');
      throw e;
    }
    return json(res, 201, { ok: true });
  }

  const favoriteDelete = pathname.match(/^\/api\/favorites\/(fundi|business|listing)\/([0-9a-f-]{36})$/i);
  if (method === 'DELETE' && favoriteDelete) {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    await pool.query('DELETE FROM hub_favorites WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [user.id,favoriteDelete[1],favoriteDelete[2]]);
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/emergency-requests') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const serviceType = bounded(body.serviceType, 30);
    const description = bounded(body.description, 1500);
    const county = bounded(body.county, 100);
    const town = bounded(body.town, 100);
    const phone = bounded(body.contactPhone, 32);
    if (!['electrician','plumber','mechanic','locksmith','security','ambulance','internet','cctv','other'].includes(serviceType)) return fail(res, 400, 'INVALID_EMERGENCY_TYPE', 'Choose an emergency category.');
    if (description.length < 5 || county.length < 2 || town.length < 2 || phone.length < 9) return fail(res, 400, 'EMERGENCY_DETAILS_REQUIRED', 'Enter the issue, town, county and a contact number.');
    const r = await pool.query('INSERT INTO emergency_requests(id,user_id,service_type,description,county,town,contact_phone) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status,created_at', [crypto.randomUUID(),user.id,serviceType,description,county,town,phone]);
    const admins = await pool.query("SELECT id FROM users WHERE role='admin' AND is_active=true LIMIT 20");
    for (const a of admins.rows) await createNotification(a.id,'emergency.new','New emergency request','A user submitted an emergency request in ' + town + ', ' + county + '.');
    await logAudit(user.id,'emergency.request_created','emergency_request',r.rows[0].id,{serviceType});
    return json(res, 201, { request: r.rows[0], warning: 'This records your request but does not dispatch a technician, ambulance, police, or emergency services. For immediate danger, contact local emergency services directly.' });
  }

  if (method === 'GET' && pathname === '/api/emergency-requests') {
    const p = problemFor(['customer','fundi','company','admin']);
    if (p) return true;
    const r = user.role === 'admin'
      ? await pool.query("SELECT e.*,u.full_name FROM emergency_requests e JOIN users u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 100")
      : await pool.query('SELECT id,service_type,description,county,town,status,created_at,updated_at FROM emergency_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [user.id]);
    return json(res, 200, { requests: r.rows });
  }

  if (method === 'GET' && pathname === '/api/admin/hubs/reports') {
    const p = problemFor(['admin']);
    if (p) return true;
    const r = await pool.query('SELECT r.*,l.title AS listing_title,l.status AS listing_status,u.full_name AS reporter_name FROM hub_reports r JOIN hub_listings l ON l.id=r.listing_id JOIN users u ON u.id=r.reporter_user_id ORDER BY CASE WHEN r.status=\'open\' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200');
    return json(res, 200, { reports: r.rows });
  }

  const reportStatus = pathname.match(/^\/api\/admin\/hubs\/reports\/([0-9a-f-]{36})$/i);
  if (method === 'PATCH' && reportStatus) {
    const p = problemFor(['admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const status = bounded(body.status, 20);
    if (!['reviewed','resolved','dismissed','open'].includes(status)) return fail(res, 400, 'INVALID_STATUS', 'Choose a valid report status.');
    const r = await pool.query('UPDATE hub_reports SET status=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1 RETURNING id,status,listing_id', [reportStatus[1],status,user.id]);
    if (!r.rowCount) return fail(res, 404, 'REPORT_NOT_FOUND', 'Report not found.');
    await logAudit(user.id,'hub.report_reviewed','hub_report',reportStatus[1],{status});
    return json(res, 200, { report: r.rows[0] });
  }

  const adminListingStatus = pathname.match(/^\/api\/admin\/hubs\/listings\/([0-9a-f-]{36})\/status$/i);
  if (method === 'PATCH' && adminListingStatus) {
    const p = problemFor(['admin']);
    if (p) return true;
    const body = object(await readBody(req));
    const status = bounded(body.status, 20);
    if (!['published','closed','hidden'].includes(status)) return fail(res, 400, 'INVALID_STATUS', 'Choose a valid listing status.');
    const r = await pool.query('UPDATE hub_listings SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status', [adminListingStatus[1],status]);
    if (!r.rowCount) return fail(res, 404, 'LISTING_NOT_FOUND', 'Listing not found.');
    await logAudit(user.id,'hub.listing_moderated','hub_listing',adminListingStatus[1],{status});
    return json(res, 200, { listing: r.rows[0] });
  }

  return false;
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

module.exports = { handleHubRoutes };
