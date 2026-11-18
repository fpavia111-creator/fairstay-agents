// Domain checks: collections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCollections } from '../src/logic.js';

const asOf = '2026-03-31';
const R = (o = {}) => ({ resident_id: 'A', payer: o.payer ?? 'Medicare A', from: o.from ?? '2026-01-01', to: o.to ?? '2026-01-31', billed_on: o.billed ?? '2026-02-03', balance: o.bal ?? 1000, last_follow_up: o.fu ?? '', note: o.note ?? '' });
const st = (r) => r.items.map((i) => i.status);

test('zero balances are ignored and credits are flagged first among money issues', () => {
  assert.equal(checkCollections([R({ bal: 0 })], { asOf }).open_accounts, 0);
  assert.deepEqual(st(checkCollections([R({ bal: -10 })], { asOf })), ['credit_balance']);
});

test('filing limits by payer type, with the warning window', () => {
  assert.deepEqual(st(checkCollections([R({ payer: 'Sunrise HMO', billed: '', from: '2026-01-01', to: '2026-01-10' })], { asOf })), ['timely_filing_at_risk']);
  assert.deepEqual(st(checkCollections([R({ payer: 'Sunrise HMO', billed: '', from: '2025-12-01', to: '2025-12-15' })], { asOf })), ['timely_filing_missed']);
  assert.deepEqual(st(checkCollections([R({ payer: 'Sunrise HMO', billed: '', from: '2025-12-01', to: '2025-12-15' })], { asOf, filingDays: { managed_care: 180 } })), ['not_billed']);
});

test('the follow-up clock starts at billing when nobody has worked the account', () => {
  assert.deepEqual(st(checkCollections([R({ billed: '2026-03-15' })], { asOf })), []);
  assert.deepEqual(st(checkCollections([R({ billed: '2026-02-01' })], { asOf })), ['no_followup']);
  assert.deepEqual(st(checkCollections([R({ billed: '2026-02-01', fu: '2026-03-20' })], { asOf })), []);
});

test('a denial shows the reason code, not the note text', () => {
  const r = checkCollections([R({ note: 'Denied PR-204 Jane said call back' })], { asOf });
  assert.equal(r.items[0].reason_code, 'PR-204'); assert.ok(!r.items[0].message.includes('Jane'));
});

test('aging buckets and totals by payer type', () => {
  const r = checkCollections([R({ to: '2026-03-20', bal: 100 }), R({ to: '2025-10-01', bal: 200 }), R({ payer: 'Lone Star Medicaid', to: '2026-03-30', bal: 50 })], { asOf });
  const mcr = r.aging.find((a) => a.payer_type === 'medicare_a');
  assert.equal(mcr['0-30'], 100); assert.equal(mcr['181-365'], 200); assert.equal(mcr.total, 300);
  assert.equal(r.total_ar, 350); assert.equal(r.over_90, 200);
});
