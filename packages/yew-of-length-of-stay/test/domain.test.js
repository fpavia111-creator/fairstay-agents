// Domain checks: weekly skilled meeting list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyList } from '../src/logic.js';

const asOf = '2026-03-17';
const C = (o = {}) => [{ resident_id: 'A', payer: o.payer ?? 'Medicare A', from: o.from ?? '2026-03-01' }];
const S = (o = {}) => [{ resident_id: 'A', last_review: '2026-03-15', skilled: 'Y', ...o }];
const st = (r) => r.items.map((i) => i.status);

test('NOMNC: two full days before the last covered day', () => {
  assert.deepEqual(st(weeklyList(C(), S({ last_covered_day: '2026-03-19', nomnc_given_on: '2026-03-17' }), { asOf })), ['day_20_coming']);
  assert.deepEqual(st(weeklyList(C(), S({ last_covered_day: '2026-03-19', nomnc_given_on: '2026-03-18' }), { asOf })), ['nomnc_late', 'day_20_coming']);
  assert.deepEqual(st(weeklyList(C(), S({ last_covered_day: '2026-03-19' }), { asOf })), ['nomnc_due', 'day_20_coming']);
  assert.deepEqual(st(weeklyList(C(), S({ last_covered_day: '2026-03-18' }), { asOf })), ['nomnc_late', 'day_20_coming']);
});

test('Medicare day counts include days used in an earlier stay', () => {
  const r = weeklyList(C({ from: '2026-03-10' }), S({ part_a_days_used: 85 }), { asOf });
  assert.deepEqual(st(r), ['day_100_coming']); assert.equal(r.items[0].benefit_day, 93);
});

test('a missing review is overdue, and a blank skilled flag is not custodial', () => {
  assert.deepEqual(st(weeklyList(C({ from: '2026-03-15' }), [{ resident_id: 'A' }], { asOf })), ['review_overdue']);
});

test('only Medicare A and managed care residents are on the list', () => {
  assert.equal(weeklyList(C({ payer: 'Lone Star Medicaid' }), S({ skilled: 'N' }), { asOf }).items.length, 0);
  assert.deepEqual(st(weeklyList(C({ payer: 'Sunrise HMO' }), S({ skilled: 'N' }), { asOf })), ['custodial_on_skilled']);
});

test('an authorization ending with a plan recorded is quiet', () => {
  assert.deepEqual(st(weeklyList(C({ payer: 'Sunrise HMO' }), S({ auth_end: '2026-03-18' }), { asOf })), ['auth_ending_no_plan']);
  assert.deepEqual(st(weeklyList(C({ payer: 'Sunrise HMO' }), S({ auth_end: '2026-03-18', next_plan: 'Home with family 3/18' }), { asOf })), []);
});
