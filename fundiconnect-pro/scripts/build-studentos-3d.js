'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const asset = path.join(root, 'public', 'assets', 'studentos-sports-car.glb');
const sourceUrl = 'https://grab3d.com/dl/sports-car/sports-car.glb';
const expectedSha256 = '0bcd58581de6982f9cb3f1bf64140b2cf53c8c3d91bddecd9fe71cc8354cabe9';

async function ensureModel() {
  if (!fs.existsSync(asset)) {
    console.log('Fetching CC0 StudentOS 3D vehicle asset…');
    const response = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('3D vehicle download failed with HTTP ' + response.status);
    const data = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (hash !== expectedSha256) throw new Error('3D model integrity check failed; expected pinned SHA-256 did not match.');
    if (data.length < 1000000) throw new Error('3D vehicle asset was unexpectedly small.');
    fs.mkdirSync(path.dirname(asset), { recursive: true });
    const temp = asset + '.download';
    fs.writeFileSync(temp, data);
    fs.renameSync(temp, asset);
    console.log('3D vehicle asset verified (' + data.length.toLocaleString() + ' bytes).');
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex');
  if (actual !== expectedSha256) throw new Error('3D model integrity check failed: ' + asset);
}
async function main() {
  await ensureModel();
  await esbuild.build({
    entryPoints: [path.join(root, 'scripts', 'studentos-3d-entry.js')],
    bundle: true,
    minify: true,
    treeShaking: true,
    legalComments: 'none',
    platform: 'browser',
    target: ['es2020'],
    format: 'iife',
    outfile: path.join(root, 'public', 'studentos-3d.bundle.js')
  });
  const output = path.join(root, 'public', 'studentos-3d.bundle.js');
  console.log('Built lazy-loaded StudentOS 3D renderer (' + fs.statSync(output).size.toLocaleString() + ' bytes).');
}
main().catch(error => {
  console.error('StudentOS cinematic 3D build failed:', error.message);
  process.exitCode = 1;
});
