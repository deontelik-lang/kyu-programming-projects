'use strict';

const crypto = require('node:crypto');

const PAYMENT_METHODS = new Set(['mpesa_till','mpesa_paybill','cash','bank_transfer','other']);
const REPORT_REASONS = new Set(['spam','fraud','unsafe','misleading','harassment','other']);
const DISPUTE_CATEGORIES = new Set(['payment','quality','missed_appointment','scope_or_price','safety','communication','other']);
const VERIFICATION_CHECKS = new Set(['identity','phone','qualification','portfolio','reference']);

function uuid() { return crypto.randomUUID(); }
function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
async function addBookingEvent(pool, bookingId, actorUserId, eventType, details = {}) {
  await pool.query(
    'INSERT INTO booking_events(id,booking_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4,$5)',
    [uuid(), bookingId, actorUserId || null, eventType, JSON.stringify(details)]
  );
}
function roleDenied(user, allowed, helpers, res) {
  const problem = helpers.requireRole(user, allowed);
  if (!problem) return false;
  helpers.fail(res, problem.status, problem.code, problem.message);
  return true;
}
async function bookingParticipant(pool, bookingId) {
  const result = await pool.query(
    'SELECT b.*,fp.user_id AS fundi_user_id,fp.id AS fundi_profile_id,cu.full_name AS customer_name,fu.full_name AS fundi_name FROM bookings b JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users cu ON cu.id=b.customer_id JOIN users fu ON fu.id=fp.user_id WHERE b.id=$1',
    [bookingId]
  );
  return result.rows[0] || null;
}
function isParticipant(user, booking) {
  return Boolean(user && booking && (user.role === 'admin' || user.id === booking.customer_id || user.id === booking.fundi_user_id));
}
function methodsForRecord(row) {
  return {
    accepted_methods: row?.accepted_methods || [],
    mpesa_till: row?.mpesa_till || '',
    mpesa_paybill: row?.mpesa_paybill || '',
    paybill_account: row?.paybill_account || '',
    account_name: row?.account_name || '',
    bank_details: row?.bank_details || '',
    other_instructions: row?.other_instructions || '',
    updated_at: row?.updated_at || null
  };
}

async function handleMarketplaceRoutes(ctx) {
  const { req, res, method, pathname, user, pool, helpers } = ctx;
  const { json, fail, readBody, text, limited, requireRole, createNotification, logAudit } = helpers;
  const fundiReportPath = pathname.match(/^\/api\/fundis\/([0-9a-f-]{36})\/report$/i);
  const verificationChecksPath = pathname.match(/^\/api\/admin\/fundis\/([0-9a-f-]{36})\/verification-checks$/i);
  const quotePath = pathname.match(/^\/api\/bookings\/([0-9a-f-]{36})\/quote$/i);
  const bookingInstructionsPath = pathname.match(/^\/api\/bookings\/([0-9a-f-]{36})\/payment-instructions$/i);
  const bookingConfirmationPath = pathname.match(/^\/api\/bookings\/([0-9a-f-]{36})\/payment-confirmation$/i);
  const bookingDisputesPath = pathname.match(/^\/api\/bookings\/([0-9a-f-]{36})\/disputes$/i);
  const adminDisputePath = pathname.match(/^\/api\/admin\/booking-disputes\/([0-9a-f-]{36})$/i);
  const adminFundiReportPath = pathname.match(/^\/api\/admin\/fundi-reports\/([0-9a-f-]{36})$/i);

  if (method === 'GET' && pathname === '/api/fundi/payment-instructions') {
    if (roleDenied(user, ['fundi'], helpers, res)) return true;
    const result = await pool.query(
      'SELECT p.* FROM fundi_profiles f LEFT JOIN provider_payment_instructions p ON p.fundi_id=f.id WHERE f.user_id=$1',
      [user.id]
    );
    return json(res, 200, { instructions: methodsForRecord(result.rows[0]) });
  }

  if (method === 'PATCH' && pathname === '/api/fundi/payment-instructions') {
    if (roleDenied(user, ['fundi'], helpers, res)) return true;
    if (!limited(req, 'provider-payment-instructions', 20, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many updates. Try again later.');
    const body = await readBody(req);
    const methods = [...new Set((Array.isArray(body.acceptedMethods) ? body.acceptedMethods : []).filter(v => typeof v === 'string' && PAYMENT_METHODS.has(v)))];
    if (methods.length !== (Array.isArray(body.acceptedMethods) ? new Set(body.acceptedMethods).size : 0)) {
      return fail(res, 400, 'INVALID_PAYMENT_METHOD', 'Choose only supported payment methods.');
    }
    const till = cleanString(body.mpesaTill, 80);
    const paybill = cleanString(body.mpesaPaybill, 80);
    const account = cleanString(body.paybillAccount, 100);
    const accountName = cleanString(body.accountName, 120);
    const bank = cleanString(body.bankDetails, 350);
    const other = cleanString(body.otherInstructions, 500);
    if (methods.includes('mpesa_till') && till.length < 3) return fail(res, 400, 'TILL_REQUIRED', 'Enter the M-Pesa Till details you want customers to use.');
    if (methods.includes('mpesa_paybill') && (paybill.length < 3 || account.length < 1)) return fail(res, 400, 'PAYBILL_REQUIRED', 'Enter the Paybill number and account/reference information.');
    if (methods.includes('bank_transfer') && bank.length < 4) return fail(res, 400, 'BANK_DETAILS_REQUIRED', 'Enter the bank-transfer instructions customers need.');
    if (methods.includes('other') && other.length < 4) return fail(res, 400, 'OTHER_INSTRUCTIONS_REQUIRED', 'Explain the other payment method.');
    if (/(pin|password|one.?time.?password|otp|passkey|consumer.?secret)/i.test([till,paybill,account,accountName,bank,other].join(' '))) {
      return fail(res, 400, 'SENSITIVE_CREDENTIAL', 'Do not enter PINs, passwords, OTPs, passkeys or API secrets in payment instructions.');
    }
    const profile = await pool.query('SELECT id FROM fundi_profiles WHERE user_id=$1', [user.id]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_PROFILE_NOT_FOUND', 'Complete your service-provider profile first.');
    const result = await pool.query(
      'INSERT INTO provider_payment_instructions(fundi_id,accepted_methods,mpesa_till,mpesa_paybill,paybill_account,account_name,bank_details,other_instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(fundi_id) DO UPDATE SET accepted_methods=EXCLUDED.accepted_methods,mpesa_till=EXCLUDED.mpesa_till,mpesa_paybill=EXCLUDED.mpesa_paybill,paybill_account=EXCLUDED.paybill_account,account_name=EXCLUDED.account_name,bank_details=EXCLUDED.bank_details,other_instructions=EXCLUDED.other_instructions,updated_at=now() RETURNING *',
      [profile.rows[0].id, methods, till, paybill, account, accountName, bank, other]
    );
    await logAudit(user.id, 'fundi.payment_instructions_updated', 'fundi_profile', profile.rows[0].id, { methods });
    await logAudit(user.id, 'fundi.payment_instructions_updated', 'fundi_profile', profile.rows[0].id, { methods });
    return json(res, 200, { ok: true, instructions: methodsForRecord(result.rows[0]), message: 'Your payment instructions were saved.' });
  }

  if (method === 'GET' && pathname === '/api/bookings') {
    // The normal handler builds this list. This route only enriches it if called through this module is intentionally not intercepted.
    return false;
  }

  if (quotePath && method === 'PATCH') {
    if (roleDenied(user, ['fundi','admin'], helpers, res)) return true;
    if (!limited(req, 'booking-quote', 30, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many quote updates. Try again later.');
    const body = await readBody(req);
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) return fail(res, 400, 'INVALID_QUOTE', 'Enter a whole-number quote in Kenyan shillings.');
    const booking = await bookingParticipant(pool, quotePath[1]);
    if (!booking) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    if (user.role !== 'admin' && booking.fundi_user_id !== user.id) return fail(res, 403, 'NOT_YOUR_BOOKING', 'Only the assigned professional can quote for this request.');
    if (!['pending','accepted'].includes(booking.status)) return fail(res, 409, 'QUOTE_NOT_ALLOWED', 'Quotes can only be set for pending or accepted requests.');
    if (['pending','paid'].includes(booking.payment_status) || ['customer_reported_paid','provider_reported_received','confirmed','disputed'].includes(booking.direct_payment_status)) return fail(res, 409, 'QUOTE_LOCKED', 'The quote cannot be changed after a payment has been recorded.');
    const instructionResult = await pool.query('SELECT * FROM provider_payment_instructions WHERE fundi_id=$1', [booking.fundi_id]);
    const instructions = methodsForRecord(instructionResult.rows[0]);
    if (!instructions.accepted_methods.length) return fail(res, 409, 'PAYMENT_METHODS_NOT_SET', 'Save your direct payment instructions before sending a quote.');
    const snapshot = JSON.stringify(instructions);
    const updated = await pool.query("UPDATE bookings SET quoted_price=$2,direct_payment_instructions_snapshot=$3::jsonb,status='accepted',updated_at=now() WHERE id=$1 RETURNING id,quoted_price,status,direct_payment_status,direct_payment_instructions_snapshot", [booking.id, amount, snapshot]);
    await addBookingEvent(pool, booking.id, user.id, 'quote_set', { amount });
    await createNotification(booking.customer_id, 'booking.quote', 'Service quote received', 'A quote of KSh ' + amount.toLocaleString('en-KE') + ' is ready for "' + booking.service_title + '". Review it in your dashboard.', booking.id);
    await logAudit(user.id, 'booking.quote_set', 'booking', booking.id, { amount });
    return json(res, 200, { booking: updated.rows[0] });
  }

  if (bookingInstructionsPath && method === 'GET') {
    if (roleDenied(user, ['customer','fundi','admin'], helpers, res)) return true;
    const booking = await bookingParticipant(pool, bookingInstructionsPath[1]);
    if (!booking || !isParticipant(user, booking)) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found for your account.');
    if (!['accepted','assigned','traveling','in_progress','completed'].includes(booking.status) || Number(booking.quoted_price || 0) < 1) return fail(res, 409, 'PAYMENT_INSTRUCTIONS_NOT_READY', 'Payment instructions appear after the provider accepts the request and sends a quote.');
    const snapshot = booking.direct_payment_instructions_snapshot || {};
    const snapshotMethods = Array.isArray(snapshot.accepted_methods) ? snapshot.accepted_methods : [];
    let instructions = snapshotMethods.length ? snapshot : null;
    if (!instructions) {
      const result = await pool.query('SELECT * FROM provider_payment_instructions WHERE fundi_id=$1', [booking.fundi_id]);
      instructions = methodsForRecord(result.rows[0]);
    }
    return json(res, 200, { instructions, quote: Number(booking.quoted_price), method: booking.direct_payment_method, paymentStatus: booking.direct_payment_status, providerName: booking.fundi_name, accountName: instructions.account_name || '' });
  }

  if (bookingConfirmationPath && method === 'POST') {
    if (roleDenied(user, ['customer','fundi'], helpers, res)) return true;
    if (!limited(req, 'booking-payment-confirmation', 20, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many payment confirmation requests. Try again later.');
    const body = await readBody(req);
    const action = cleanString(body.action, 40);
    const booking = await bookingParticipant(pool, bookingConfirmationPath[1]);
    if (!booking || !isParticipant(user, booking)) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found for your account.');
    const isCustomer = booking.customer_id === user.id;
    const isFundi = booking.fundi_user_id === user.id;
    if (!isCustomer && !isFundi) return fail(res, 403, 'NOT_BOOKING_PARTICIPANT', 'Only the customer and assigned provider may confirm a payment.');
    if (!['accepted','assigned','traveling','in_progress','completed'].includes(booking.status) || Number(booking.quoted_price || 0) < 1) return fail(res, 409, 'QUOTE_REQUIRED', 'A positive quote and an accepted booking are required first.');
    if (booking.direct_payment_status === 'disputed') return fail(res, 409, 'PAYMENT_DISPUTED', 'This payment is disputed. The open case must be reviewed.');
    const snapshot = booking.direct_payment_instructions_snapshot || {};
    const snapshotMethods = Array.isArray(snapshot.accepted_methods) ? snapshot.accepted_methods : [];
    let accepted = snapshotMethods;
    if (!accepted.length) {
      const instructionsResult = await pool.query('SELECT accepted_methods FROM provider_payment_instructions WHERE fundi_id=$1', [booking.fundi_id]);
      accepted = instructionsResult.rows[0]?.accepted_methods || [];
    }
    if (!accepted.length) return fail(res, 409, 'PAYMENT_METHODS_NOT_SET', 'The service provider has not added payment instructions yet.');
    const actionAllowed = (action === 'customer_paid' && isCustomer) || (action === 'provider_received' && isFundi);
    if (!actionAllowed) return fail(res, 403, 'INVALID_CONFIRMATION_ACTION', 'Customers report that they paid; providers confirm receipt.');
    const stampField = action === 'customer_paid' ? 'customer_payment_confirmed_at' : 'provider_payment_confirmed_at';
    if (booking[stampField]) return fail(res, 409, 'ALREADY_CONFIRMED', 'Your confirmation has already been recorded.');
    let paymentMethod = cleanString(body.method, 30) || booking.direct_payment_method || '';
    if (!PAYMENT_METHODS.has(paymentMethod) || !accepted.includes(paymentMethod)) return fail(res, 400, 'PAYMENT_METHOD_MISMATCH', 'Choose a payment method listed by this provider.');
    if (booking.direct_payment_method && booking.direct_payment_method !== paymentMethod) return fail(res, 409, 'PAYMENT_METHOD_MISMATCH', 'Both parties must confirm the same payment method.');
    const nextStatus = action === 'customer_paid'
      ? (booking.provider_payment_confirmed_at ? 'confirmed' : 'customer_reported_paid')
      : (booking.customer_payment_confirmed_at ? 'confirmed' : 'provider_reported_received');
    const update = await pool.query(
      'UPDATE bookings SET direct_payment_method=$2,direct_payment_status=$3,' + stampField + '=now(),updated_at=now() WHERE id=$1 RETURNING id,direct_payment_status,direct_payment_method,customer_payment_confirmed_at,provider_payment_confirmed_at',
      [booking.id, paymentMethod, nextStatus]
    );
    await addBookingEvent(pool, booking.id, user.id, action, { amount: Number(booking.quoted_price), method: paymentMethod, reference: cleanString(body.reference, 32) });
    const otherUser = isCustomer ? booking.fundi_user_id : booking.customer_id;
    await createNotification(otherUser, action === 'customer_paid' ? 'payment.customer_reported' : 'payment.provider_confirmed', action === 'customer_paid' ? 'Customer reported payment' : 'Provider confirmed payment receipt', action === 'customer_paid' ? 'The customer reported paying KSh ' + Number(booking.quoted_price).toLocaleString('en-KE') + '. Please confirm receipt if you received it.' : 'The provider recorded receipt for booking "' + booking.service_title + '". Review the payment record.', booking.id);
    await logAudit(user.id, 'booking.direct_payment_confirmation', 'booking', booking.id, { action, status: nextStatus, method: paymentMethod });
    return json(res, 200, { ok: true, booking: update.rows[0], message: nextStatus === 'confirmed' ? 'Both parties have confirmed. This is a record of their confirmations, not an independent bank verification.' : 'Your confirmation was recorded. The other party still needs to confirm.' });
  }

  if (bookingDisputesPath && method === 'POST') {
    if (roleDenied(user, ['customer','fundi'], helpers, res)) return true;
    if (!limited(req, 'booking-dispute', 6, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many dispute submissions. Try again later.');
    const body = await readBody(req);
    const category = cleanString(body.category, 40);
    const description = cleanString(body.description, 3000);
    if (!DISPUTE_CATEGORIES.has(category) || description.length < 10) return fail(res, 400, 'INVALID_DISPUTE', 'Choose a dispute category and provide at least 10 characters of detail.');
    const booking = await bookingParticipant(pool, bookingDisputesPath[1]);
    if (!booking || !isParticipant(user, booking) || user.role === 'admin') return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found for your account.');
    if (booking.status === 'cancelled') return fail(res, 409, 'BOOKING_CANCELLED', 'A cancelled booking cannot open a new case.');
    const disputeId = uuid();
    try {
      await pool.query('INSERT INTO booking_disputes(id,booking_id,opened_by,category,description) VALUES($1,$2,$3,$4,$5)', [disputeId, booking.id, user.id, category, description]);
    } catch (error) {
      if (error.code === '23505') return fail(res, 409, 'ACTIVE_DISPUTE_EXISTS', 'An open dispute already exists for this booking. Add information to the existing case through support.');
      throw error;
    }
    await pool.query("UPDATE bookings SET direct_payment_status_before_dispute=CASE WHEN direct_payment_status<>'disputed' THEN direct_payment_status ELSE direct_payment_status_before_dispute END,direct_payment_status='disputed',updated_at=now() WHERE id=$1", [booking.id]);
    await addBookingEvent(pool, booking.id, user.id, 'dispute_opened', { disputeId, category, description });
    const recipient = user.id === booking.customer_id ? booking.fundi_user_id : booking.customer_id;
    await createNotification(recipient, 'booking.dispute', 'Booking dispute opened', 'A dispute has been opened for "' + booking.service_title + '". Please keep relevant evidence and respond through support.', booking.id);
    const admins = await pool.query("SELECT id FROM users WHERE role='admin' AND is_active=true LIMIT 20");
    for (const a of admins.rows) await createNotification(a.id, 'admin.dispute', 'Booking dispute requires review', 'A dispute was opened for booking "' + booking.service_title + '".', booking.id);
    await logAudit(user.id, 'booking.dispute_opened', 'booking_dispute', disputeId, { bookingId: booking.id, category });
    return json(res, 201, { dispute: { id: disputeId, booking_id: booking.id, status: 'open' }, message: 'Dispute recorded. FundiConnect will review the submitted information but cannot reverse a direct payment.' });
  }

  if (method === 'GET' && pathname === '/api/admin/booking-disputes') {
    if (roleDenied(user, ['admin'], helpers, res)) return true;
    const cases = await pool.query(
      "SELECT d.*,b.service_title,b.status AS booking_status,b.quoted_price,b.direct_payment_status,cu.full_name AS customer_name,fu.full_name AS fundi_name,b.id AS booking_id FROM booking_disputes d JOIN bookings b ON b.id=d.booking_id JOIN users cu ON cu.id=b.customer_id JOIN fundi_profiles fp ON fp.id=b.fundi_id JOIN users fu ON fu.id=fp.user_id ORDER BY CASE WHEN d.status='open' THEN 0 WHEN d.status='reviewing' THEN 1 ELSE 2 END,d.created_at DESC LIMIT 200"
    );
    const bookingIds = [...new Set(cases.rows.map(c => c.booking_id))];
    const events = bookingIds.length ? await pool.query(
      'SELECT e.id,e.booking_id,e.event_type,e.details,e.created_at,u.full_name AS actor_name FROM booking_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.booking_id=ANY($1::uuid[]) ORDER BY e.created_at,e.id',
      [bookingIds]
    ) : { rows: [] };
    const byBooking = new Map();
    for (const e of events.rows) {
      if (!byBooking.has(e.booking_id)) byBooking.set(e.booking_id, []);
      byBooking.get(e.booking_id).push(e);
    }
    return json(res, 200, { disputes: cases.rows.map(c => ({ ...c, timeline: byBooking.get(c.booking_id) || [] })) });
  }

  if (adminDisputePath && method === 'PATCH') {
    if (roleDenied(user, ['admin'], helpers, res)) return true;
    const body = await readBody(req);
    const status = cleanString(body.status, 30);
    const resolutionNote = cleanString(body.resolutionNote, 2000);
    if (!['open','reviewing','resolved','dismissed'].includes(status)) return fail(res, 400, 'INVALID_DISPUTE_STATUS', 'Choose an allowed case status.');
    const result = await pool.query('UPDATE booking_disputes SET status=$2,resolution_note=$3,reviewed_by=$4,updated_at=now(),closed_at=CASE WHEN $2 IN (\'resolved\',\'dismissed\') THEN now() ELSE NULL END WHERE id=$1 RETURNING *', [adminDisputePath[1], status, resolutionNote, user.id]);
    if (!result.rowCount) return fail(res, 404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
    const d = result.rows[0];
    if (['resolved','dismissed'].includes(status)) {
      await pool.query("UPDATE bookings SET direct_payment_status=COALESCE(direct_payment_status_before_dispute,'unpaid'),direct_payment_status_before_dispute=NULL,updated_at=now() WHERE id=$1 AND direct_payment_status='disputed'", [d.booking_id]);
    }
    await addBookingEvent(pool, d.booking_id, user.id, 'dispute_status_changed', { disputeId: d.id, status, resolutionNote });
    await logAudit(user.id, 'booking.dispute_status_changed', 'booking_dispute', d.id, { status });
    return json(res, 200, { dispute: d });
  }

  if (fundiReportPath && method === 'POST') {
    if (roleDenied(user, ['customer','fundi','company','admin'], helpers, res)) return true;
    if (!limited(req, 'fundi-report', 10, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many reports. Try again later.');
    const profileId = fundiReportPath[1];
    const body = await readBody(req);
    const reason = cleanString(body.reason, 30);
    const details = cleanString(body.details, 1500);
    if (!REPORT_REASONS.has(reason)) return fail(res, 400, 'INVALID_REPORT_REASON', 'Choose a report reason.');
    const profile = await pool.query('SELECT id,user_id FROM fundi_profiles WHERE id=$1', [profileId]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_NOT_FOUND', 'Professional profile not found.');
    if (profile.rows[0].user_id === user.id) return fail(res, 400, 'OWN_REPORT', 'You cannot report your own profile.');
    try {
      const report = await pool.query('INSERT INTO fundi_reports(id,fundi_id,reporter_user_id,reason,details) VALUES($1,$2,$3,$4,$5) RETURNING id,status,created_at', [uuid(), profileId, user.id, reason, details]);
      await logAudit(user.id, 'fundi.profile_reported', 'fundi_report', report.rows[0].id, { profileId, reason });
      return json(res, 201, { report: report.rows[0], message: 'Report submitted to the moderation queue.' });
    } catch (error) {
      if (error.code === '23505') return fail(res, 409, 'REPORT_EXISTS', 'You have already reported this professional profile.');
      throw error;
    }
  }

  if (method === 'GET' && pathname === '/api/admin/fundi-reports') {
    if (roleDenied(user, ['admin'], helpers, res)) return true;
    const reports = await pool.query(
      "SELECT r.*,fu.full_name AS fundi_name,fp.professional_title,fp.town,fp.county,ru.full_name AS reporter_name FROM fundi_reports r JOIN fundi_profiles fp ON fp.id=r.fundi_id JOIN users fu ON fu.id=fp.user_id JOIN users ru ON ru.id=r.reporter_user_id ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200"
    );
    return json(res, 200, { reports: reports.rows });
  }

  if (adminFundiReportPath && method === 'PATCH') {
    if (roleDenied(user, ['admin'], helpers, res)) return true;
    const body = await readBody(req);
    const status = cleanString(body.status, 30);
    const note = cleanString(body.reviewNote, 1500);
    if (!['open','reviewed','resolved','dismissed'].includes(status)) return fail(res, 400, 'INVALID_REPORT_STATUS', 'Choose an allowed report status.');
    const report = await pool.query('UPDATE fundi_reports SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1 RETURNING id,status', [adminFundiReportPath[1], status, user.id, note]);
    if (!report.rowCount) return fail(res, 404, 'REPORT_NOT_FOUND', 'Report not found.');
    await logAudit(user.id, 'fundi.profile_report_reviewed', 'fundi_report', adminFundiReportPath[1], { status });
    return json(res, 200, { report: report.rows[0] });
  }

  if (verificationChecksPath && (method === 'GET' || method === 'PATCH')) {
    if (roleDenied(user, ['admin'], helpers, res)) return true;
    const profile = await pool.query('SELECT id FROM fundi_profiles WHERE id=$1', [verificationChecksPath[1]]);
    if (!profile.rowCount) return fail(res, 404, 'FUNDI_NOT_FOUND', 'Professional not found.');
    if (method === 'GET') {
      const checks = await pool.query('SELECT check_type,status,evidence_note,reviewed_at,updated_at FROM fundi_verification_checks WHERE fundi_id=$1 ORDER BY check_type', [verificationChecksPath[1]]);
      return json(res, 200, { checks: checks.rows });
    }
    const body = await readBody(req);
    const checkType = cleanString(body.checkType, 30);
    const status = cleanString(body.status, 30);
    const evidenceNote = cleanString(body.evidenceNote, 1000);
    if (!VERIFICATION_CHECKS.has(checkType) || !['pending','verified','rejected'].includes(status)) return fail(res, 400, 'INVALID_VERIFICATION_CHECK', 'Choose a supported verification check and status.');
    const r = await pool.query(
      'INSERT INTO fundi_verification_checks(id,fundi_id,check_type,status,evidence_note,reviewed_by,reviewed_at) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $4 IN (\'verified\',\'rejected\') THEN now() ELSE NULL END) ON CONFLICT(fundi_id,check_type) DO UPDATE SET status=EXCLUDED.status,evidence_note=EXCLUDED.evidence_note,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,updated_at=now() RETURNING check_type,status,evidence_note,reviewed_at',
      [uuid(), verificationChecksPath[1], checkType, status, evidenceNote, user.id]
    );
    await logAudit(user.id, 'fundi.verification_check_changed', 'fundi_profile', verificationChecksPath[1], { checkType, status });
    return json(res, 200, { check: r.rows[0] });
  }

  return false;
}

module.exports = { handleMarketplaceRoutes };
