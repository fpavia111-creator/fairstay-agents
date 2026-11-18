// Domain checks: managed care contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewMco, contractFor } from '../src/logic.js';

const asOf = '2026-04-01';
const K = (o = {}) => ({ payer: 'Plan A', level: o.level ?? 'L1', rate: o.rate ?? 500, start: '2025-06-01', end: o.end ?? '2027-12-31', auto_renew: o.auto ?? 'Y', notice_days: o.notice ?? 90, last_rate_change: o.changed ?? '2025-06-01' });
const P = (o = {}) => ({ payer: o.payer ?? 'Plan A', level: o.level ?? 'L1', from: o.from ?? '2026-02-01', days: o.days ?? 10, paid: o.paid ?? 5000 });
const st = (r) => r.items.map((i) => i.status);

test('a clean contract paid at rate has nothing to act on', () => {
  assert.deepEqual(st(reviewMco([K()], [P()], { asOf })), []);
});

test('underpayment by more than the tolerance only', () => {
  assert.deepEqual(st(reviewMco([K()], [P({ paid: 4999.995 })], { asOf })), []);
  const r = reviewMco([K()], [P({ paid: 4900 })], { asOf });
  assert.deepEqual(st(r), ['paid_below_contract']); assert.equal(r.underpaid, 100);
});

test('a level-specific rate wins over a blank-level rate; a later contract wins', () => {
  const C = [{ payer: 'X', level: null, rate: 1, start: '2025-01-01' }, { payer: 'x', level: 'L1', rate: 2, start: '2025-01-01' }, { payer: 'X', level: 'L1', rate: 3, start: '2026-01-01' }];
  assert.equal(contractFor(C, 'X', 'L1', '2025-06-01').rate, 2);
  assert.equal(contractFor(C, 'X', 'L1', '2026-02-01').rate, 3);
  assert.equal(contractFor(C, 'X', 'L2', '2026-02-01').rate, 1);
});

test('notice window for auto renewals, and end window without one', () => {
  assert.deepEqual(st(reviewMco([K({ end: '2026-07-15' })], [], { asOf })), ['notice_window_open']);
  assert.deepEqual(st(reviewMco([K({ end: '2026-07-31' })], [], { asOf })), []);
  assert.deepEqual(st(reviewMco([K({ end: '2026-04-20', auto: 'N' })], [], { asOf })), ['notice_window_open']);
  assert.deepEqual(st(reviewMco([K({ end: '2026-03-31', auto: 'N' })], [], { asOf })), ['contract_expired']);
});

test('payments after a non-renewing contract ended count as no contract', () => {
  const r = reviewMco([K({ end: '2026-01-31', auto: 'N' })], [P()], { asOf });
  assert.deepEqual(st(r), ['contract_expired', 'no_contract']);
  assert.match(r.items[1].message, /only an ended contract/);
});

test('benchmark and stale rate checks use the settings', () => {
  assert.deepEqual(st(reviewMco([K()], [], { asOf, benchmarks: [{ level: 'l1', rate: 520 }] })), ['below_benchmark']);
  assert.deepEqual(st(reviewMco([K({ changed: '2024-01-01' })], [], { asOf })), ['rate_unchanged']);
  assert.deepEqual(st(reviewMco([K({ changed: '2024-01-01' })], [], { asOf, staleYears: 3 })), []);
});
