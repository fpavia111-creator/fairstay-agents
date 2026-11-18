// Domain checks: next payer planning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planNextPayer } from '../src/logic.js';

const asOf = '2026-03-10';
const C = (id, payer, from) => ({ resident_id: id, payer, from });
const st = (r) => r.items.map((i) => `${i.resident_id}:${i.status}`);

test('Part A day 100 counts census days so far plus days used earlier', () => {
  // 1 Jan to 10 Mar is 69 days; 5 earlier days makes 74, so 26 left.
  const r = planNextPayer([C('A', 'Medicare A', '2026-01-01')], [{ resident_id: 'A', part_a_days_used: 5 }], { asOf });
  assert.equal(r.items[0].days_left, 26); assert.equal(r.items[0].runs_out_on, '2026-04-05');
  assert.deepEqual(planNextPayer([C('A', 'Medicare A', '2026-01-01')], [], { asOf }).items, [], '31 days left is past a 30 day horizon');
});

test('a benefit already used up runs out today', () => {
  const r = planNextPayer([C('A', 'Medicare A', '2026-03-01')], [{ resident_id: 'A', part_a_days_used: 120 }], { asOf });
  assert.equal(r.items[0].days_left, 0);
});

test('a planned next payer turns plan_needed into plan_in_place', () => {
  const r = planNextPayer([C('A', 'Medicare A', '2026-01-01')], [{ resident_id: 'A', part_a_days_used: 5, next_payer: 'Medicaid' }], { asOf });
  assert.deepEqual(st(r), ['A:plan_in_place']);
});

test('Medicare Advantage is managed care, timed by the authorization end, not day 100', () => {
  const r = planNextPayer([C('A', 'Sunrise Medicare Advantage', '2026-01-01')], [{ resident_id: 'A', auth_end: '2026-03-15' }], { asOf });
  assert.deepEqual(st(r), ['A:plan_needed']); assert.equal(r.items[0].days_left, 5);
  assert.deepEqual(planNextPayer([C('A', 'Sunrise Medicare Advantage', '2026-01-01')], [], { asOf }).items, [], 'no auth end, nothing to time');
});

test('private funds: income offsets the rate, and the Medicaid application is flagged early', () => {
  // 380 a day less 1200 * 12 / 365 = 340.55 a day; 6500 lasts 19 days.
  const plan = { resident_id: 'A', private_funds: 6500, daily_rate: 380, monthly_income: 1200 };
  assert.deepEqual(st(planNextPayer([C('A', 'Private Pay', '2025-01-01')], [plan], { asOf })), ['A:apply_medicaid']);
  const applied = planNextPayer([C('A', 'Private Pay', '2025-01-01')], [{ ...plan, medicaid_applied_on: '2026-02-01' }], { asOf });
  assert.deepEqual(st(applied), ['A:funds_low']); assert.equal(applied.items[0].days_left, 19);
  assert.deepEqual(planNextPayer([C('A', 'Private Pay', '2025-01-01')], [{ ...plan, private_funds: 500000 }], { asOf }).items, []);
  assert.deepEqual(planNextPayer([C('A', 'Private Pay', '2025-01-01')], [{ ...plan, monthly_income: 20000 }], { asOf }).items, [], 'income covers the rate');
});

test('discharged residents and Medicaid residents are left alone', () => {
  const census = [{ resident_id: 'A', payer: 'Medicare A', from: '2026-01-01', to: '2026-02-01' }, C('B', 'Lone Star Medicaid', '2025-01-01')];
  const r = planNextPayer(census, [{ resident_id: 'A', part_a_days_used: 90 }], { asOf });
  assert.equal(r.residents, 1); assert.deepEqual(r.items, []);
});

test('soonest first within the same status', () => {
  const census = [C('A', 'Sunrise Advantage HMO', '2026-01-01'), C('B', 'Sunrise Advantage HMO', '2026-01-01')];
  const r = planNextPayer(census, [{ resident_id: 'A', auth_end: '2026-03-30' }, { resident_id: 'B', auth_end: '2026-03-12' }], { asOf });
  assert.deepEqual(st(r), ['B:plan_needed', 'A:plan_needed']);
});
