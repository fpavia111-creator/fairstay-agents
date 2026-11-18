// Domain checks: 13-week cash projection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectCash } from '../src/logic.js';

const start = '2026-04-06';
const open = [{ balance: 1000 }];

test('receivables spread evenly over their weeks at the collection rate', () => {
  const r = projectCash(open, [{ payer_type: 'medicaid', amount: 1000 }], [], { collect: { medicaid: { pct: 0.8, weeks: 4 } } }, { start });
  assert.deepEqual(r.projection.slice(0, 5).map((w) => w.ar_collections), [200, 200, 200, 200, 0]);
  assert.equal(r.ending_cash, 1800);
});

test('new billing arrives after its lag and never past week 13', () => {
  const r = projectCash(open, [], [], { weekly_billing: { private: 100 }, lag: { private: { pct: 1, lag_weeks: 12 } } }, { start });
  assert.equal(r.projection[11].new_collections, 0); assert.equal(r.projection[12].new_collections, 100);
});

test('payroll every 14 days from the first date; fixed payments on their day', () => {
  const r = projectCash(open, [], [], { payroll: { amount: 10, first_date: '2026-04-10' }, fixed: [{ name: 'rent', amount: 5, day_of_month: 1 }] }, { start });
  assert.equal(r.projection.filter((w) => w.payroll).length, 7);
  assert.equal(r.projection.filter((w) => w.fixed).length, 3);
});

test('bills past due go to week 1 and are listed; bills after week 13 are left out', () => {
  const r = projectCash(open, [], [{ due_date: '2026-03-01', amount: 50 }, { due_date: '2026-12-01', amount: 999 }], {}, { start });
  assert.equal(r.projection[0].bills, 50); assert.equal(r.ending_cash, 950); assert.equal(r.items[0].status, 'past_due_bills');
});

test('overdrawn weeks are negative_cash, not just below minimum', () => {
  const r = projectCash(open, [], [{ due_date: '2026-04-07', amount: 2000 }], { min_cash: 500 }, { start });
  assert.ok(r.items.every((i) => i.status === 'negative_cash')); assert.equal(r.items.length, 13);
});
