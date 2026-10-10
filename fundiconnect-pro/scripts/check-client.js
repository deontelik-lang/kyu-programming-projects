'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
if (!scripts.length) throw new Error('No inline application script found.');
for (const [index, source] of scripts.entries()) new vm.Script(source, { filename: 'public/index.html#script-' + (index + 1) });
for (const required of ['CampusHub — One App. Unlimited Opportunities.', '/api/fundis', '/api/bookings', '/api/auth/register', '/api/members', 'Campus & alumni network', 'state.platformProfile=d.platformProfile', 'name="publicDirectory"', 'function showPolicy', 'directPaymentLabel', 'providerPaymentPanel', 'loadAdminBookingDisputes', 'loadAdminFundiReports', 'Report profile', 'const kenyaCounties=', 'name="policyConsent"', 'function toggleTheme', 'function loadPublicStats', 'statMembersLabel', 'statProvidersLabel', 'function openSmartRequest', 'CampusHub Starter', 'manifest.webmanifest', '/sw.js', 'Tutors & academic support', '@media(max-width:570px)']) {
  if (!html.includes(required)) throw new Error('Required UI/API reference missing: ' + required);
}
const countyArray = html.match(/const kenyaCounties=(\[[^;]+\]);/);
if (!countyArray) throw new Error('Kenyan county list is missing.');
const counties = vm.runInNewContext(countyArray[1]);
if (counties.length !== 47 || new Set(counties).size !== 47) throw new Error('County dropdown must contain all 47 unique Kenyan counties.');
if (/CampusConnect|FundiConnect/.test(html)) throw new Error('Public interface still displays a legacy product brand.');
if (!html.includes('/api/public/stats') || !html.includes('function initTheme') || !html.includes('function toggleTheme')) throw new Error('CampusHub theme or live aggregate stats hooks are missing.');
const serverSource = fs.readFileSync('server.js', 'utf8');
for (const slug of ['solar','computer-repair','moving','handyperson','locksmith','tutor','freelancer']) {
  if (!serverSource.includes("slug: '" + slug + "'")) throw new Error('Service directory is missing category: ' + slug);
}
const upgradeMigration = fs.readFileSync('migrations/008_smart_requests_provider_toolkit.sql', 'utf8');
for (const required of ['CREATE TABLE IF NOT EXISTS job_requests', 'CREATE TABLE IF NOT EXISTS job_quotes', 'CREATE TABLE IF NOT EXISTS fundi_portfolio_items', 'idx_bookings_unique_job_quote']) {
  if (!upgradeMigration.includes(required)) throw new Error('Upgrade database migration is missing: ' + required);
}
for (const asset of ['public/manifest.webmanifest', 'public/sw.js', 'public/campushub-icon.svg']) {
  if (!fs.existsSync(asset)) throw new Error('Required progressive-web-app asset missing: ' + asset);
}
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
if (manifest.short_name !== 'CampusHub' || !manifest.icons?.length) throw new Error('CampusHub PWA manifest is incomplete.');
console.log('CampusHub client syntax, theme, live statistics, smart-request UI, upgrade migration, PWA assets and all 47 Kenyan counties are valid.');
