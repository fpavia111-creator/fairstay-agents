// Domain checks: covenant ratios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measure, testCovenants } from '../src/logic.js';

const M = (period, o = {}) => ({ period, beds: 100, patient_days: o.pd ?? 2700, ebitdar: o.eb ?? 300, rent: o.rent ?? 200, interest: 30, principal: 20, operating_expenses: o.opex ?? 3000, cash: o.cash ?? 3000 });

test('ratio definitions', () => {
  const rows = [M('2026-04')];
  assert.equal(measure('occupancy', rows), 90);
  assert.equal(measure('rent_coverage', rows), 1.5);
  assert.equal(measure('dscr', rows), 2);
  assert.equal(measure('fccr', rows), 1.2);
  assert.equal(measure('days_cash', rows), 30);
});

test('trailing periods use the last N months up to the test period', () => {
  const fin = [M('2026-01', { eb: 100 }), M('2026-02'), M('2026-03'), M('2026-04')];
  const r = testCovenants(fin, [{ name: 'RC', test: 'rent_coverage', min: 1.3, period: 'quarter' }], { asOf: '2026-05-01' });
  assert.equal(r.items[0].value, 1.5); assert.equal(r.items[0].status, 'pass');
  const r2 = testCovenants(fin, [{ name: 'RC', test: 'rent_coverage', min: 1.3, period: 'quarter' }], { asOf: '2026-05-01', period: '2026-03' });
  assert.equal(r2.items[0].value, 1.17); assert.equal(r2.items[0].status, 'breach');
});

test('near miss uses the cushion percent', () => {
  const r = testCovenants([M('2026-04')], [{ name: 'RC', test: 'rent_coverage', min: 1.4, period: 'month' }], { asOf: '2026-05-01' });
  assert.equal(r.items[0].status, 'near_miss'); assert.equal(r.items[0].cushion_pct, 7.14);
});

test('reporting: delivered certificates are never late', () => {
  const c = { name: 'X', test: 'occupancy', min: 50, period: 'month', reporting_days: 30 };
  assert.ok(testCovenants([M('2026-04')], [c], { asOf: '2026-06-15' }).items.some((i) => i.status === 'reporting_late'));
  assert.ok(!testCovenants([M('2026-04')], [{ ...c, delivered_on: '2026-05-20' }], { asOf: '2026-06-15' }).items.some((i) => i.status === 'reporting_late'));
});

test('missing months give no_data, not a pass', () => {
  assert.equal(testCovenants([M('2026-04')], [{ name: 'X', test: 'dscr', min: 1, period: 'ttm' }], { asOf: '2026-05-01' }).items[0].status, 'no_data');
});
