'use strict';

const crypto = require('node:crypto');

let tokenCache = { value: '', expiresAt: 0 };

function enabledConfig() {
  const environment = process.env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const secret = process.env.MPESA_CALLBACK_SECRET || '';
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  let validBase = false;
  try {
    const parsed = new URL(base);
    validBase = parsed.protocol === 'https:' && parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch {}
  const enabled = process.env.MPESA_ENABLED === 'true'
    && Boolean(process.env.MPESA_CONSUMER_KEY)
    && Boolean(process.env.MPESA_CONSUMER_SECRET)
    && Boolean(process.env.MPESA_SHORTCODE)
    && Boolean(process.env.MPESA_PASSKEY)
    && /^[A-Za-z0-9_-]{32,}$/.test(secret)
    && validBase;
  return { enabled, environment, base, secret };
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function normalizeKenyanMobile(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let value = String(input).trim().replace(/[\s()-]/g, '');
  if (value.startsWith('+')) value = value.slice(1);
  if (/^0[17]\d{8}$/.test(value)) value = '254' + value.slice(1);
  if (!/^254[17]\d{8}$/.test(value)) return null;
  return value;
}

function kenyaTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return map.year + map.month + map.day + map.hour + map.minute + map.second;
}

function baseUrl(environment) {
  return environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

async function darajaToken(environment) {
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
  const key = process.env.MPESA_CONSUMER_KEY || '';
  const secret = process.env.MPESA_CONSUMER_SECRET || '';
  const auth = Buffer.from(key + ':' + secret).toString('base64');
  const response = await fetch(baseUrl(environment) + '/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: { Authorization: 'Basic ' + auth, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error('Daraja authentication was not successful.');
  const expiresSeconds = Math.min(Math.max(Number(data.expires_in) || 3000, 60), 3600);
  tokenCache = { value: data.access_token, expiresAt: Date.now() + expiresSeconds * 1000 };
  return tokenCache.value;
}

async function readProviderJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.errorMessage === 'string' ? data.errorMessage : 'Daraja rejected the request.';
    const error = new Error(message.slice(0, 240));
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function handlePaymentRoutes(ctx) {
  const { req, res, url, method, pathname, user, pool, helpers } = ctx;
  const { json, fail, limited, requireRole, readBody, text, createNotification, logAudit } = helpers;
  const deny = (roles) => {
    const problem = requireRole(user, roles);
    if (!problem) return false;
    fail(res, problem.status, problem.code, problem.message);
    return true;
  };

  if (method === 'GET' && pathname === '/api/payments/mpesa/config') {
    const config = enabledConfig();
    return json(res, 200, {
      provider: 'Safaricom Daraja / M-Pesa Express',
      enabled: config.enabled,
      environment: config.environment,
      note: config.enabled
        ? 'The payment prompt is enabled. A payment is only confirmed after a matching provider callback.'
        : 'M-Pesa checkout is disabled until the Daraja keys, shortcode, passkey, HTTPS public URL, callback secret, and explicit enable flag are configured.'
    });
  }

  const callbackPath = pathname.match(/^\/api\/payments\/mpesa\/callback\/([A-Za-z0-9_-]{32,})$/);
  if (method === 'POST' && callbackPath) {
    const config = enabledConfig();
    if (!config.secret || !safeEqual(callbackPath[1], config.secret)) {
      return fail(res, 404, 'NOT_FOUND', 'Callback endpoint not found.');
    }
    const payload = await readBody(req);
    const callback = payload?.Body?.stkCallback;
    if (!callback || typeof callback.CheckoutRequestID !== 'string' || typeof callback.MerchantRequestID !== 'string') {
      return json(res, 400, { ResultCode: 1, ResultDesc: 'Invalid callback payload.' });
    }

    const resultCode = String(callback.ResultCode ?? '');
    const resultDescription = text(callback.ResultDesc, 240);
    const result = await pool.query(
      'SELECT id,user_id,booking_id,amount,phone_number,status FROM mpesa_payments WHERE checkout_request_id=$1 AND merchant_request_id=$2 LIMIT 1',
      [callback.CheckoutRequestID, callback.MerchantRequestID]
    );
    if (!result.rowCount) {
      await logAudit(null, 'mpesa.callback_unmatched', 'mpesa_payment', callback.CheckoutRequestID, { resultCode });
      return json(res, 200, { ResultCode: 0, ResultDesc: 'Callback received.' });
    }
    const payment = result.rows[0];
    if (payment.status === 'paid' || ['failed','cancelled'].includes(payment.status)) {
      return json(res, 200, { ResultCode: 0, ResultDesc: 'Callback already processed.' });
    }

    const items = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const metadata = Object.fromEntries(items
      .filter(item => item && typeof item.Name === 'string')
      .map(item => [item.Name, item.Value]));
    const client = await pool.connect();
    let finalStatus = 'failed';
    let verifiedReceipt = null;
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        'SELECT id,user_id,booking_id,amount,phone_number,status FROM mpesa_payments WHERE id=$1 FOR UPDATE',
        [payment.id]
      );
      if (!locked.rowCount || ['paid','failed','cancelled'].includes(locked.rows[0].status)) {
        await client.query('COMMIT');
        return json(res, 200, { ResultCode: 0, ResultDesc: 'Callback already processed.' });
      }

      if (resultCode === '0') {
        const amount = Number(metadata.Amount);
        const receipt = typeof metadata.MpesaReceiptNumber === 'string' ? metadata.MpesaReceiptNumber.trim() : '';
        const phone = normalizeKenyanMobile(metadata.PhoneNumber);
        if (!Number.isFinite(amount) || amount !== Number(payment.amount)
          || !receipt || !phone || phone !== payment.phone_number) {
          await client.query('ROLLBACK');
          await logAudit(null, 'mpesa.callback_validation_failed', 'mpesa_payment', payment.id, { resultCode, amountMatched: amount === Number(payment.amount), phoneMatched: phone === payment.phone_number, hasReceipt: Boolean(receipt) });
          return json(res, 200, { ResultCode: 0, ResultDesc: 'Callback received for reconciliation.' });
        }
        finalStatus = 'paid';
        verifiedReceipt = receipt;
        await client.query(
          "UPDATE mpesa_payments SET status='paid',mpesa_receipt_number=$2,result_code=$3,result_description=$4,updated_at=now(),paid_at=now() WHERE id=$1",
          [payment.id, receipt, resultCode, resultDescription]
        );
        await client.query("UPDATE bookings SET payment_status='paid',updated_at=now() WHERE id=$1", [payment.booking_id]);
      } else {
        finalStatus = resultCode === '1032' ? 'cancelled' : 'failed';
        await client.query(
          'UPDATE mpesa_payments SET status=$2,result_code=$3,result_description=$4,updated_at=now() WHERE id=$1',
          [payment.id, finalStatus, resultCode, resultDescription]
        );
        await client.query("UPDATE bookings SET payment_status='failed',updated_at=now() WHERE id=$1 AND payment_status<>'paid'", [payment.booking_id]);
      }
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
    if (finalStatus === 'paid') {
      await createNotification(payment.user_id, 'payment.confirmed', 'M-Pesa payment confirmed', 'Payment for your service request has been confirmed. Receipt: ' + verifiedReceipt + '.');
      await logAudit(payment.user_id, 'mpesa.payment_confirmed', 'mpesa_payment', payment.id, { amount: Number(payment.amount), receipt: verifiedReceipt });
    } else {
      await createNotification(payment.user_id, 'payment.failed', 'M-Pesa payment not completed', 'The M-Pesa attempt was not completed. You may retry from your booking once the payment status is refreshed.');
      await logAudit(payment.user_id, 'mpesa.payment_not_completed', 'mpesa_payment', payment.id, { resultCode, status: finalStatus });
    }
    return json(res, 200, { ResultCode: 0, ResultDesc: 'Callback processed.' });
  }

  const quotePath = pathname.match(/^\/api\/bookings\/([0-9a-f-]{36})\/quote$/i);
  if (method === 'PATCH' && quotePath) {
    if (deny(['fundi','admin'])) return true;
    if (!limited(req, 'booking-quote', 30, 60 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many quote updates. Try again later.');
    const body = await readBody(req);
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) {
      return fail(res, 400, 'INVALID_QUOTE', 'Enter a whole-number quote in Kenyan shillings.');
    }
    const result = await pool.query(
      'SELECT b.id,b.status,b.customer_id,b.fundi_id,fp.user_id AS fundi_user_id,b.service_title FROM bookings b JOIN fundi_profiles fp ON fp.id=b.fundi_id WHERE b.id=$1',
      [quotePath[1]]
    );
    if (!result.rowCount) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    const booking = result.rows[0];
    if (user.role !== 'admin' && booking.fundi_user_id !== user.id) return fail(res, 403, 'NOT_YOUR_BOOKING', 'Only the assigned professional can quote for this request.');
    if (!['pending','accepted'].includes(booking.status)) return fail(res, 409, 'QUOTE_NOT_ALLOWED', 'Quotes can only be set for pending or accepted requests.');
    const updated = await pool.query(
      "UPDATE bookings SET quoted_price=$2,status='accepted',updated_at=now() WHERE id=$1 RETURNING id,quoted_price,status,payment_status",
      [booking.id, amount]
    );
    await createNotification(booking.customer_id, 'booking.quote', 'Service quote received', 'A quote of KSh ' + amount.toLocaleString('en-KE') + ' is ready for "' + booking.service_title + '". Review it in your dashboard.');
    await logAudit(user.id, 'booking.quote_set', 'booking', booking.id, { amount });
    return json(res, 200, { booking: updated.rows[0] });
  }

  if (method === 'GET' && pathname === '/api/payments') {
    if (deny(['customer','fundi','company','admin'])) return true;
    const result = await pool.query(
      'SELECT id,booking_id,amount,phone_number,environment,status,mpesa_receipt_number,result_code,result_description,created_at,updated_at,paid_at FROM mpesa_payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [user.id]
    );
    return json(res, 200, { payments: result.rows.map(p => ({ ...p, phone_number: '••••' + p.phone_number.slice(-4) })) });
  }

  if (method === 'POST' && pathname === '/api/payments/mpesa/stk-push') {
    if (deny(['customer'])) return true;
    if (!limited(req, 'mpesa-stk-push', 4, 10 * 60 * 1000)) return fail(res, 429, 'RATE_LIMITED', 'Too many payment prompts. Try again later.');
    const config = enabledConfig();
    if (!config.enabled) return fail(res, 503, 'MPESA_NOT_CONFIGURED', 'M-Pesa payments are not enabled yet. Configure Daraja credentials and the secure callback URL first.');
    const callbackUrl = config.base + '/api/payments/mpesa/callback/' + config.secret;
    if (!callbackUrl.startsWith('https://')) return fail(res, 503, 'MPESA_CALLBACK_NOT_SECURE', 'The callback URL must use HTTPS.');

    const body = await readBody(req);
    const bookingId = text(body.bookingId, 60);
    const phone = normalizeKenyanMobile(body.phoneNumber);
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return fail(res, 400, 'INVALID_BOOKING', 'Choose a valid booking.');
    if (!phone) return fail(res, 400, 'INVALID_PHONE', 'Enter a Kenyan Safaricom mobile number such as 0712345678 or 254712345678.');

    const bookingResult = await pool.query(
      'SELECT b.id,b.customer_id,b.status,b.quoted_price,b.payment_status,fp.user_id AS fundi_user_id FROM bookings b JOIN fundi_profiles fp ON fp.id=b.fundi_id WHERE b.id=$1',
      [bookingId]
    );
    if (!bookingResult.rowCount || bookingResult.rows[0].customer_id !== user.id) return fail(res, 404, 'BOOKING_NOT_FOUND', 'That service request was not found for your account.');
    const booking = bookingResult.rows[0];
    if (booking.status !== 'accepted') return fail(res, 409, 'BOOKING_NOT_ACCEPTED', 'The professional must accept the request and provide a quote before payment.');
    if (!booking.quoted_price || Number(booking.quoted_price) < 1) return fail(res, 409, 'QUOTE_REQUIRED', 'A positive quote is required before payment.');
    if (booking.payment_status === 'paid') return fail(res, 409, 'ALREADY_PAID', 'This booking is already marked as paid.');
    const amount = Number(booking.quoted_price);
    if (!Number.isSafeInteger(amount) || amount < 1) return fail(res, 409, 'INVALID_QUOTED_AMOUNT', 'This quote is not a valid whole-number M-Pesa amount.');
    const pending = await pool.query(
      "SELECT id,status FROM mpesa_payments WHERE booking_id=$1 AND status IN ('initiating','pending') ORDER BY created_at DESC LIMIT 1",
      [booking.id]
    );
    if (pending.rowCount) return fail(res, 409, 'PAYMENT_ALREADY_PENDING', 'A payment prompt is already pending for this request. Check your phone and refresh the dashboard before trying again.');

    const paymentId = crypto.randomUUID();
    await pool.query(
      "INSERT INTO mpesa_payments(id,user_id,booking_id,amount,phone_number,environment,status) VALUES($1,$2,$3,$4,$5,$6,'initiating')",
      [paymentId, user.id, booking.id, amount, phone, config.environment]
    );
    const shortcode = process.env.MPESA_SHORTCODE || '';
    const transactionType = process.env.MPESA_TRANSACTION_TYPE === 'CustomerBuyGoodsOnline' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
    const timestamp = kenyaTimestamp();
    const password = Buffer.from(shortcode + (process.env.MPESA_PASSKEY || '') + timestamp).toString('base64');
    try {
      const token = await darajaToken(config.environment);
      const response = await fetch(baseUrl(config.environment) + '/mpesa/stkpush/v1/processrequest', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: transactionType,
          Amount: amount,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: 'FC' + paymentId.replace(/-/g, '').slice(0, 10),
          TransactionDesc: 'ServicePayment'
        }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await readProviderJson(response);
      if (String(data.ResponseCode) !== '0' || !data.CheckoutRequestID || !data.MerchantRequestID) {
        await pool.query("UPDATE mpesa_payments SET status='failed',result_code=$2,result_description=$3,updated_at=now() WHERE id=$1", [paymentId, text(data.ResponseCode, 40), text(data.ResponseDescription || data.errorMessage || 'Daraja did not accept the STK Push request.', 240)]);
        return fail(res, 502, 'MPESA_REQUEST_REJECTED', 'Safaricom did not accept the payment prompt. Check your details and try again.');
      }
      await pool.query(
        "UPDATE mpesa_payments SET status='pending',checkout_request_id=$2,merchant_request_id=$3,result_code=$4,result_description=$5,updated_at=now() WHERE id=$1",
        [paymentId, data.CheckoutRequestID, data.MerchantRequestID, text(data.ResponseCode, 40), text(data.ResponseDescription || 'STK Push accepted for processing.', 240)]
      );
      await pool.query("UPDATE bookings SET payment_status='pending',updated_at=now() WHERE id=$1 AND payment_status<>'paid'", [booking.id]);
      await logAudit(user.id, 'mpesa.stk_push_started', 'mpesa_payment', paymentId, { bookingId: booking.id, amount, environment: config.environment });
      return json(res, 202, {
        payment: { id: paymentId, bookingId: booking.id, amount, status: 'pending' },
        message: 'Payment prompt requested. Enter your M-Pesa PIN only on your phone. The booking will be marked paid only after Safaricom confirms the payment.'
      });
    } catch (error) {
      await pool.query("UPDATE mpesa_payments SET status='failed',result_description=$2,updated_at=now() WHERE id=$1", [paymentId, text(error.message || 'Provider unavailable.', 240)]);
      console.error('Daraja STK Push failed:', error.statusCode || error.name || 'Provider error');
      return fail(res, 502, 'MPESA_PROVIDER_UNAVAILABLE', 'Safaricom could not process the payment prompt right now. No successful payment has been recorded.');
    }
  }

  const paymentPath = pathname.match(/^\/api\/payments\/([0-9a-f-]{36})$/i);
  if (method === 'GET' && paymentPath) {
    if (deny(['customer','fundi','company','admin'])) return true;
    const result = await pool.query(
      'SELECT p.id,p.booking_id,p.amount,p.phone_number,p.environment,p.status,p.mpesa_receipt_number,p.result_code,p.result_description,p.created_at,p.updated_at,p.paid_at,b.service_title FROM mpesa_payments p JOIN bookings b ON b.id=p.booking_id WHERE p.id=$1 AND (p.user_id=$2 OR $3=true)',
      [paymentPath[1], user.id, user.role === 'admin']
    );
    if (!result.rowCount) return fail(res, 404, 'PAYMENT_NOT_FOUND', 'Payment record not found.');
    const payment = result.rows[0];
    payment.phone_number = '••••' + payment.phone_number.slice(-4);
    return json(res, 200, { payment });
  }

  return false;
}

module.exports = { handlePaymentRoutes };
