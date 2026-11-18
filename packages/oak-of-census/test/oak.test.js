import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'evergreen-core';
import { manifest } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const sandbox = () => { const root = mkdtempSync(join(tmpdir(), 'oak-')); cpSync(fixtures, root, { recursive: true }); return root; };
const f = { census: 'census-2026-02.csv', billing: 'billing-2026-02.csv', rates: 'rates.json', month: '2026-02' };

test('an accepted bed_hold_payer fact clears the hospital-leave finding from the next run', async () => {
  const root = sandbox(); const rt = new AgentRuntime(manifest, { root });
  assert.equal((await rt.call('oak_check', f)).result.by_status.bed_hold_billed, 1);
  const l = await rt.call('oak_learn', { kind: 'bed_hold_payer', value: { payer: 'Lone Star Medicaid (fictional)' } });
  const ask = await rt.call('oak_accept_learning', { id: l.result.fact.id, decision: 'accept' });
  rt.approvals.approve(ask.approval_id, 'Bea Business Office (fictional)');
  await rt.call('oak_accept_learning', { id: l.result.fact.id, decision: 'accept' });
  assert.equal((await rt.call('oak_check', f)).result.by_status.bed_hold_billed, undefined);
});

test('headers and US dates from another system map to the same fields', async () => {
  const root = sandbox(); const rt = new AgentRuntime(manifest, { root });
  writeFileSync(join(root, 'census2.csv'), 'Resident No,Name,Pay Source,Start Date,End Date,Census Status\nR1,Test Person,Medicaid,02/01/2026,,Present\n');
  writeFileSync(join(root, 'bill2.csv'), 'Res ID,Patient,Payor,From DOS,Thru DOS,Units\nR1,Test Person,Medicaid,02/01/2026,02/27/2026,27\n');
  const r = await rt.call('oak_check', { census: 'census2.csv', billing: 'bill2.csv', month: '2026-02' });
  assert.equal(r.status, 'executed', r.reason); assert.equal(r.result.by_status.unbilled, 1); assert.equal(r.result.items[0].from, '2026-02-28');
});
