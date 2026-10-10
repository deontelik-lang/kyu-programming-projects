'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
if (!scripts.length) throw new Error('No inline application script found.');
for (const [index, source] of scripts.entries()) new vm.Script(source, { filename: 'public/index.html#script-' + (index + 1) });
for (const required of ['so-hub-browser', 'Campus life & community', 'Work, learning & global opportunities', 'Housing & marketplace', 'Services & businesses', 'Media & creators']) {
  if (!html.includes(required)) throw new Error('StudentOS app navigation grouping missing: ' + required);
}
for (const required of ['StudentOS (CampusHub) — Study. Live. Work. Connect. Create. Explore.', '/api/fundis', '/api/bookings', '/api/auth/register', '/api/members', 'Campus & alumni network', 'state.platformProfile=d.platformProfile', 'name="publicDirectory"', 'function showPolicy', 'directPaymentLabel', 'providerPaymentPanel', 'loadAdminBookingDisputes', 'loadAdminFundiReports', 'Report profile', 'const kenyaCounties=', 'name="policyConsent"', 'function toggleTheme', 'function loadPublicStats', 'statMembersLabel', 'statProvidersLabel', 'function openSmartRequest', 'CampusHub Starter', 'manifest.webmanifest', '/sw.js', 'Tutors & academic support', '@media(max-width:570px)']) {
  if (!html.includes(required)) throw new Error('Required UI/API reference missing: ' + required);
}
for (const asset of ['public/engagement.css', 'public/engagement.js', 'public/studentos.css', 'public/studentos.js', 'public/soundscape.css', 'public/soundscape.js']) {
  if (!fs.existsSync(asset)) throw new Error('CampusHub discovery asset missing: ' + asset);
}
new vm.Script(fs.readFileSync('public/engagement.js', 'utf8'), { filename: 'public/engagement.js' });
new vm.Script(fs.readFileSync('public/studentos.js', 'utf8'), { filename: 'public/studentos.js' });
new vm.Script(fs.readFileSync('public/soundscape.js', 'utf8'), { filename: 'public/soundscape.js' });
const soundscape = fs.readFileSync('public/soundscape.js','utf8');
for (const required of ['StudentOSSounds','soIntroOverlay','soSoundPanel','Future City','Global Explorer','Study Mode','Premium Experience','prefers-reduced-motion','studentos:wallet-success','studentos:match-success','speechSynthesis','Welcome to <span class="gradient">StudentOS.</span>']) {
  if (!soundscape.includes(required)) throw new Error('StudentOS soundscape requirement missing: ' + required);
}
const sw = fs.readFileSync('public/sw.js','utf8');
if (!sw.includes('studentos-shell-v8') || !sw.includes('/soundscape.css?v=1') || !sw.includes('/soundscape.js?v=1')) throw new Error('Soundscape assets are missing from the refreshed PWA shell cache.');
const studentos = fs.readFileSync('public/studentos.js', 'utf8');
for (const required of ['COUNTRY_DATA', 'studentosGlobal', 'studentosLaunchpad', 'studentosEntertainment', 'My country', 'Worldwide', 'languageOptions', 'save-location', 'use-location', 'so-world-map', 'soCountryMapLegend', 'UI_TEXT', 'navGlobal', 'tileCampus', 'One home. Your whole world.', 'A global window into opportunity', 'soWorldUniversities', 'soWorldEvents', 'soWorldMedia', 'Preferred supported currency', 'UNIVERSITIES_BY_COUNTRY', 'updateUniversitySuggestions', 'Start typing your institution', 'UNIVERSITIES_BY_COUNTRY', 'updateUniversitySuggestions', 'so-university-suggestions']) {
  if (!studentos.includes(required)) throw new Error('StudentOS global/app shell requirement missing: ' + required);
}
if (!studentos.includes('function syncHomeLocationFilter') || !studentos.includes("navCommunity:'الحرم والمجتمع'")) throw new Error('Global location selector or Arabic navigation label is incorrect.');
const hubRouteSource = fs.readFileSync('hubs.js','utf8');
if (!hubRouteSource.includes('lower(pp.region)=lower($6)') || !hubRouteSource.includes('lower(pp.university)=lower($7)')) throw new Error('Public student discovery must filter by region and university as well as country/city.');
if (!html.includes('m.university||m.campus') || !html.includes('m.city,m.region,m.country')) throw new Error('Public student cards must display selected global location data.');

if (!html.includes('payload.county=payload.region||payload.county') || !html.includes('payload.town=payload.city||payload.town')) throw new Error('Provider profile must save the global region and city into the searchable legacy fields.');
const discoverySource = fs.readFileSync('public/engagement.js','utf8');
if (!discoverySource.includes('item.city || item.town') || !discoverySource.includes('item.region || item.county')) throw new Error('Discovery cards must show global listing locations.');
const countriesBlob = studentos.match(/const COUNTRY_DATA = `([^\`]+)`;/);
if (!countriesBlob) throw new Error('The StudentOS world country list is missing.');
const countryPairs = countriesBlob[1].split('|').map(value => value.slice(0, value.indexOf(':')));
if (countryPairs.length < 240 || new Set(countryPairs).size !== countryPairs.length) throw new Error('Global country list must contain at least 240 unique country/territory codes.');
const serverContentForStudentOS = fs.readFileSync('server.js', 'utf8');
if (!serverContentForStudentOS.includes('/studentos.css?v=2') || !serverContentForStudentOS.includes('/studentos.js?v=4') || !serverContentForStudentOS.includes('/soundscape.css?v=1') || !serverContentForStudentOS.includes('/soundscape.js?v=1') || !serverContentForStudentOS.includes('/api/public/global-stats')) throw new Error('StudentOS design or soundscape assets are not injected into the homepage.');

const serverWithDiscovery = fs.readFileSync('server.js', 'utf8');
if (!serverWithDiscovery.includes('/engagement.css?v=1') || !serverWithDiscovery.includes('/engagement.js?v=2')) throw new Error('Dynamic discovery assets are not injected into the homepage.');
const engagement = fs.readFileSync('public/engagement.js', 'utf8');
for (const required of ['Your momentum', 'Check in for today', '/api/hubs/listings?', '/api/fundis', 'on-device interest signals', 'data-save']) {
  if (!engagement.includes(required)) throw new Error('Discovery and engagement requirement missing: ' + required);
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
const modulesMigration = fs.readFileSync('migrations/010_studentos_global_modules.sql','utf8');
for (const required of ['scholarship','study_abroad','language_exchange','lost_found','student_discount','media_video','music','podcast','student_original','creator']) {
  if (!modulesMigration.includes("'" + required + "'")) throw new Error('StudentOS database migration does not permit hub type: ' + required);
}
const globalMigration = fs.readFileSync('migrations/009_global_studentos.sql','utf8');
for (const required of ['country_code','ADD COLUMN IF NOT EXISTS city','ADD COLUMN IF NOT EXISTS university','idx_hub_listings_global_location']) {
  if (!globalMigration.includes(required)) throw new Error('StudentOS global location migration missing: ' + required);
}
const upgradeMigration = fs.readFileSync('migrations/008_smart_requests_provider_toolkit.sql', 'utf8');
for (const required of ['CREATE TABLE IF NOT EXISTS job_requests', 'CREATE TABLE IF NOT EXISTS job_quotes', 'CREATE TABLE IF NOT EXISTS fundi_portfolio_items', 'idx_bookings_unique_job_quote']) {
  if (!upgradeMigration.includes(required)) throw new Error('Upgrade database migration is missing: ' + required);
}
for (const asset of ['public/manifest.webmanifest', 'public/sw.js', 'public/campushub-icon.svg']) {
  if (!fs.existsSync(asset)) throw new Error('Required progressive-web-app asset missing: ' + asset);
}
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
if (manifest.short_name !== 'StudentOS' || !manifest.icons?.length) throw new Error('StudentOS PWA manifest is incomplete.');
console.log('StudentOS/CampusHub client syntax, app shell, global country engine, cinematic soundscape, theme, discovery, location migration, PWA assets and all 47 Kenyan counties are valid.');
