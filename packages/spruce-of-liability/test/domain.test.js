// Domain checks: patient liability and private-pay balances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLiability, liabilityFor } from '../src/logic.js';

const N = (id, amt, from, to = '') => ({ resident_id: id, monthly_amount: amt, effective_from: from, effective_to: to });
const B = (id, month, amt, kind = 'Liability') => ({ resident_id: id, month, amount: amt, kind });
const P = (id, date, amt) => ({ resident_id: id, date, amount: amt });
const st = (r) => r.items.map((i) => [i.resident_id, i.status, i.amount]);
const o = { month: '2026-03', asOf: '2026-03-20' };

test('the newest notice in force wins; an ended notice is not used', () => {
  const s = [N('A', 500, '2025-01-01', '2026-02-28'), N('A', 650, '2026-03-01'), N('A', 700, '2026-05-01')];
  assert.equal(liabilityFor(s, 'A', '2026-03').monthly_amount, 650);
  assert.equal(liabilityFor(s, 'A', '2026-02').monthly_amount, 500);
  assert.equal(liabilityFor(s, 'A', '2024-12'), null);
});

test('billed in full and paid: no findings; within a dollar is not a difference', () => {
  assert.deepEqual(checkLiability([N('A', 500, '2025-01-01')], [B('A', '2026-03', 499.5)], [P('A', '2026-03-03', 499.5)], null, o).items, []);
});

test('not billed, under and over', () => {
  const r = checkLiability([N('A', 500, '2025-01-01'), N('B', 500, '2025-01-01'), N('C', 500, '2025-01-01')], [B('B', '2026-03', 400), B('C', '2026-03', 650)], [P('B', '2026-03-03', 400), P('C', '2026-03-03', 650)], null, o);
  assert.deepEqual(st(r), [['A', 'not_billed', 500], ['B', 'underbilled', 100], ['C', 'overbilled', 150]]);
});

test('proration by census days, and none when the rule is off or the census is absent', () => {
  const census = [{ resident_id: 'A', payer: 'Medicaid', from: '2026-03-11' }];
  const r = checkLiability([N('A', 310, '2025-01-01')], [], [], census, o);
  assert.equal(r.items[0].expected, 210, '21 of 31 days');
  assert.equal(checkLiability([N('A', 310, '2025-01-01')], [], [], census, { ...o, prorate: false }).items[0].expected, 310);
  assert.equal(checkLiability([N('A', 310, '2025-01-01')], [], [], null, o).items[0].expected, 310);
});

test('a resident not in the building all month owes nothing that month', () => {
  const census = [{ resident_id: 'A', payer: 'Medicaid', from: '2025-01-01', to: '2026-02-15' }];
  assert.deepEqual(checkLiability([N('A', 310, '2025-01-01')], [], [], census, o).items, []);
});

test('unpaid: payments go to the oldest bills first; credits are flagged', () => {
  const bills = [B('A', '2026-01', 900, 'Private'), B('A', '2026-02', 900, 'Private'), B('A', '2026-03', 900, 'Private')];
  const r = checkLiability([], bills, [P('A', '2026-01-10', 900)], null, { month: '2026-03', asOf: '2026-04-15' });
  assert.deepEqual(st(r), [['A', 'unpaid', 1800]]); assert.equal(r.items[0].oldest_unpaid_month, '2026-02');
  const c = checkLiability([], [B('A', '2026-03', 100)], [P('A', '2026-03-02', 250)], null, o);
  assert.deepEqual(st(c), [['A', 'credit_balance', 150]]);
});

test('payments after as_of are not counted yet', () => {
  const r = checkLiability([], [B('A', '2026-01', 900)], [P('A', '2026-04-20', 900)], null, { month: '2026-03', asOf: '2026-04-15' });
  assert.equal(r.items[0].status, 'unpaid');
});
