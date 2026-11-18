// Domain checks: property company leases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPropco, rentDue } from '../src/logic.js';

const asOf = '2026-04-20';
const L = (o = {}) => ({ lease_no: 'L1', operator: 'Op', start: o.start ?? '2024-04-01', end: o.end ?? '2034-03-31', base_rent: 100000, escalator_pct: o.esc ?? 3, min_coverage: o.cov ?? '', financials_days: o.fd ?? '' });
const st = (r) => r.items.map((i) => i.status);

test('the escalator steps up on each anniversary month', () => {
  const l = L();
  assert.equal(rentDue(l, '2025-03'), 100000); assert.equal(rentDue(l, '2025-04'), 103000); assert.equal(rentDue(l, '2026-04'), 106090);
});

test('rent is late only after the due day', () => {
  const r = [{ lease_no: 'L1', period: '2026-04', billed: 106090, paid: '' }];
  assert.deepEqual(st(checkPropco([L()], r, [], { asOf: '2026-04-05' })), []);
  assert.deepEqual(st(checkPropco([L()], r, [], { asOf: '2026-04-06' })), ['rent_unpaid']);
});

test('coverage uses up to the last 12 months sent', () => {
  const fin = Array.from({ length: 14 }, (_, i) => ({ lease_no: 'L1', period: `20${i < 9 ? '25-0' + (i + 1) : i < 12 ? '25-' + (i + 1) : '26-0' + (i - 11)}`, ebitdar: i < 2 ? 0 : 120, rent: 100 }));
  assert.deepEqual(st(checkPropco([L({ cov: 1.2 })], [], fin, { asOf })), []);
  assert.deepEqual(st(checkPropco([L({ cov: 1.25 })], [], fin, { asOf })), ['coverage_below']);
});

test('financials are overdue only after the reporting days', () => {
  const fin = [{ lease_no: 'L1', period: '2026-02', ebitdar: 1, rent: 1 }];
  assert.deepEqual(st(checkPropco([L({ fd: 30 })], [], fin, { asOf })), []);
  assert.deepEqual(st(checkPropco([L({ fd: 15 })], [], fin, { asOf })), ['financials_missing']);
});
