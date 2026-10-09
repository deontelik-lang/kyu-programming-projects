'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
if (!scripts.length) throw new Error('No inline application script found.');
for (const [index, source] of scripts.entries()) new vm.Script(source, { filename: 'public/index.html#script-' + (index + 1) });
for (const required of ['CampusConnect + FundiConnect', '/api/fundis', '/api/bookings', '/api/auth/register', '/api/members', 'Campus & alumni network', 'state.platformProfile=d.platformProfile', 'name="publicDirectory"']) {
  if (!html.includes(required)) throw new Error('Required UI/API reference missing: ' + required);
}
console.log('Client JavaScript syntax and key UI hooks are valid.');
