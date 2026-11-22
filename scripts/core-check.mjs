#!/usr/bin/env node
// Checks that the shared cores in this repository are the canonical copies.
// fairclaim-core is shared by fairclaim-agents (its home), fairstay-agents, fairpractice-agents and
// fairpractice2-agents; fairpractice-core by fairpractice-agents (its home) and fairpractice2-agents;
// fair-agent-core (vendor/) by all 18 Fair repositories. npm has one copy per name and version, so a
// copy that differs from the others under the same version would break the products that publish second.
// If you change a core: bump its version, run `node scripts/core-check.mjs --print`, put the new hash
// below, and copy the package folder and this file to every repository that carries it.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED = {
  'vendor/fair-agent-core': { name: 'fair-agent-core', version: '8.0.0', sha256: '11c4c29f6f6ff827daada1634c3becde3f72dc33552e9c78eac62754ccea012a' },
  'packages/fairclaim-core': { name: 'fairclaim-core', version: '0.3.0', sha256: 'ea94bd31f7906130b25973fa19a6a565c44a2257bc28b2ee725ca982ee1a02ae' },
  'packages/fairpractice-core': { name: 'fairpractice-core', version: '0.3.0', sha256: '418b0f35937ecf675d76f7f3474e38392aca20b5cbbc258655dbf736c4e9d93d' },
};

export function treeHash(dir) {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d).sort()) { if (e === 'node_modules' || e === '.git') continue; const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
  walk(dir);
  const h = createHash('sha256');
  for (const f of files) { h.update(relative(dir, f).split(sep).join('/') + '\0'); h.update(readFileSync(f).toString('utf8').replace(/\r\n/g, '\n')); h.update('\0'); }
  return h.digest('hex');
}

const root = fileURLToPath(new URL('..', import.meta.url));
let bad = 0;
for (const [dir, pin] of Object.entries(PINNED)) {
  const full = join(root, dir);
  if (!existsSync(join(full, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(join(full, 'package.json'), 'utf8'));
  const hash = treeHash(full);
  if (process.argv.includes('--print')) { console.log(`${dir}  ${pkg.name}@${pkg.version}  ${hash}`); continue; }
  if (pkg.name !== pin.name || pkg.version !== pin.version || hash !== pin.sha256) {
    bad++;
    console.error(`${dir}: ${pkg.name}@${pkg.version} differs from the canonical ${pin.name}@${pin.version}` + (pkg.version === pin.version ? ' (same version, different files: this is the npm collision this check exists for)' : ''));
  } else console.log(`ok  ${pin.name}@${pin.version}`);
}
if (bad) { console.error('Copy the canonical package folder from its home repository, or bump the version and update PINNED in every repository.'); process.exit(1); }
