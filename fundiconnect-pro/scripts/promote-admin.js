'use strict';
const { Pool } = require('pg');
const crypto = require('node:crypto');

const email = String(process.argv[2] || '').trim().toLowerCase();
const mode = process.argv[3];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['--confirm-identity', '--demote'].includes(mode)) {
  console.error('Usage: node scripts/promote-admin.js existing-account@example.com --confirm-identity');
  console.error('   or: node scripts/promote-admin.js existing-account@example.com --demote');
  console.error('Only run this from a trusted operator shell after verifying account ownership out of band.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
(async () => {
  try {
    const role = mode === '--demote' ? 'customer' : 'admin';
    const result = await pool.query('UPDATE users SET role=$2, updated_at=now() WHERE lower(email)=$1 RETURNING id,full_name,email,role', [email, role]);
    if (!result.rowCount) {
      console.error('No account with that email exists. Register the account first, then verify ownership before promotion.');
      process.exitCode = 1;
      return;
    }
    const user = result.rows[0];
    await pool.query('INSERT INTO audit_logs(id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)', [
      crypto.randomUUID(), user.id, role === 'admin' ? 'admin.role_granted' : 'admin.role_revoked',
      'user', user.id, JSON.stringify({ email: user.email, source: 'trusted operator CLI' })
    ]);
    console.log('Updated account role:', JSON.stringify({ name: user.full_name, email: user.email, role: user.role }));
    console.log('Reminder: this MVP does not verify email ownership itself. Confirm it independently before granting admin access.');
  } finally {
    await pool.end();
  }
})().catch(err => {
  console.error('Admin role update failed:', err.message);
  process.exitCode = 1;
});
