// Domain checks: underwriting arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { underwrite } from '../src/logic.js';

const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
const T = (o = {}) => months.flatMap((m) => [{ month: m, account: 'Revenue', group: 'revenue', amount: 100000 }, { month: m, account: 'Nursing', group: 'nursing_labor', amount: 40000 }, { month: m, account: 'Mgmt', group: 'management_fee', amount: 5000 }, { month: m, account: 'Rent', group: 'rent', amount: o.rent ?? 10000 }, { month: m, account: 'Supplies', group: 'non_labor', amount: 35000 }]);
const C = months.map((m) => ({ month: m, payer: 'Texas Medicaid', days: 2400 }));
const A = { beds: 100, cap_rate: 0.1, revenue_growth_pct: 0, expense_growth_pct: 0, occupancy_target: 0.5 };
const st = (r) => r.items.map((i) => i.status);

test('a clean T12 at a 5% management fee: EBITDAR, value and nothing to flag', () => {
  const r = underwrite(T(), C, [], A);
  assert.deepEqual(st(r), []);
  assert.equal(r.t12.ebitdar, 240000); assert.equal(r.t12.normalized_ebitdar, 240000);
  assert.equal(r.valuation.value, 2400000); assert.equal(r.t12.rent_coverage, 2);
});

test('one-time revenue comes out and one-time expense goes back', () => {
  const r = underwrite([...T(), { month: '2025-05', account: 'ERC refund', group: 'revenue', amount: 30000 }, { month: '2025-06', account: 'Lawsuit', group: 'non_labor', amount: 8000, one_time: 'Y' }], C, [], A);
  assert.deepEqual(st(r), ['one_time_item', 'one_time_item']);
  assert.equal(r.t12.normalized_ebitdar, 240000);
});

test('a missing month annualizes recurring lines and is flagged', () => {
  const r = underwrite(T().filter((l) => l.month !== '2025-03'), C, [], A);
  assert.equal(r.items[0].status, 'missing_month'); assert.equal(r.t12.revenue, 1200000);
});

test('management fee normalized to the assumption', () => {
  const r = underwrite(T(), C, [], { ...A, mgmt_fee_pct: 6 });
  assert.deepEqual(st(r), ['management_fee_normalized']); assert.equal(r.t12.normalized_ebitdar, 228000);
});

test('occupancy, rent coverage and growth', () => {
  const r = underwrite(T({ rent: 20000 }), C, [], { ...A, occupancy_target: 0.85, revenue_growth_pct: 10 });
  assert.equal(r.census.occupancy, 0.79);
  assert.deepEqual(st(r).sort(), ['occupancy_below_target', 'rent_coverage_low']);
  assert.equal(r.year_one.ebitdar, 360000);
});

test('staffing gap only when the model costs more than the T12', () => {
  assert.deepEqual(st(underwrite(T(), C, [], { ...A, staffing: { hprd: 1, hourly_cost: 10 } })), []);
  const r = underwrite(T(), C, [], { ...A, staffing: { hprd: 4, hourly_cost: 40 } });
  assert.equal(r.staffing.hours_per_day, 315.6); assert.equal(r.staffing.annual_cost, 4607760);
  assert.deepEqual(st(r), ['rent_coverage_low', 'staffing_cost_gap']);
});

test('receivables valued by payer type and age bucket; credits count as zero value', () => {
  const r = underwrite(T(), C, [{ payer: 'Texas Medicaid', age_days: 10, balance: 1000 }, { payer: 'Private Pay', age_days: 400, balance: 1000 }, { payer: 'Private Pay', age_days: 400, balance: -200 }], A);
  assert.equal(r.valuation.ar_gross, 1800); assert.equal(r.valuation.ar_value, 1050);
});
