#!/usr/bin/env node
// Writes the HTML and CSV reports of the key agents named in the plan on their fictional fixtures into sample-reports/,
// so a buyer can open what staff would get without installing anything.
//   node scripts/sample-reports.mjs [agent ...]
import { readFileSync, mkdirSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRuntime } from '../packages/fairclaim-core/src/index.js';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(repo, 'packages'); const OUT = join(repo, 'sample-reports');
const KEY = ['fairstay-census-billing', 'fairstay-medicaid-pending', 'fairstay-ancillary-invoices', 'fairstay-length-of-stay', 'fairstay-borrowing-base', 'fairstay-collections', 'fairstay-acquisition-underwriting'];
const only = process.argv.slice(2); const agents = only.length ? only : KEY;
mkdirSync(OUT, { recursive: true }); const index = [];
for (const n of agents) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const data = JSON.parse(readFileSync(join(PK, n, 'evals/cases.json'), 'utf8'));
  const c = data.cases.find((x) => /_write_report$/.test(x.tool) && x.expect?.status !== 'error');
  const root = mkdtempSync(join(tmpdir(), `${n}-sample-`)); cpSync(join(PK, n, 'fixtures'), join(root, 'fixtures'), { recursive: true });
  const rt = new AgentRuntime(manifest, { root, stateDir: null, audit: false });
  const r = await rt.call(c.tool, { ...c.args, out_dir: 'out' });
  if (r.status !== 'executed') { console.error(`${n}: ${r.reason}`); process.exitCode = 1; continue; }
  for (const f of r.result.files) { cpSync(join(root, f), join(OUT, basename(f))); }
  index.push({ n, files: r.result.files.map((f) => basename(f)), summary: r.result.summary });
  rmSync(root, { recursive: true, force: true }); console.log(`${n}: ${r.result.files.map((f) => basename(f)).join(', ')}`);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
writeFileSync(join(OUT, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fairstay sample reports</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 16px;color:#1d2a22;background:#fbfaf6}h1{font-size:1.6rem}li{margin:.8rem 0}small{color:#555}</style></head><body><h1>Fairstay sample reports (ver 1)</h1><p>Reports seven agents wrote from fictional nursing-home files. Real names stay in these staff files; the AI model only ever sees pseudonyms.</p><ul>${index.map((x) => `<li><strong>${esc(x.n)}</strong>: ${x.files.map((f) => `<a href="${esc(f)}">${esc(f)}</a>`).join(' · ')}<br><small>${esc(x.summary)}</small></li>`).join('')}</ul></body></html>\n`);
